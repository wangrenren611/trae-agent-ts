import * as path from 'path';
import { ToolExecutor } from './base.js';
import { ToolResult, ToolExecutionContext } from '../types/index.js';
import { CKGDatabase } from './ckg/ckg-database.js';
import { 
  CKGToolCommand, 
  CKGToolArguments, 
  MAX_RESPONSE_LEN, 
  TRUNCATED_MESSAGE 
} from './ckg/types.js';
import { Logger } from '../utils/logging/logger.js';

export class CKGTool extends ToolExecutor {
  private logger: Logger;
  private databases: Map<string, CKGDatabase> = new Map();

  constructor(logger: Logger) {
    super('ckg', {
      name: 'ckg',
      description: '查询代码库的代码知识图谱。状态在命令调用和用户讨论之间保持持久。支持搜索函数、类和类方法。',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: '要执行的命令。支持的命令: search_function, search_class, search_class_method',
          },
          path: {
            type: 'string',
            description: '代码库的路径',
          },
          identifier: {
            type: 'string',
            description: '要在代码知识图谱中搜索的函数或类的标识符',
          },
          print_body: {
            type: 'boolean',
            description: '是否打印函数或类的主体。默认为true',
            default: true,
          },
        },
        required: ['command', 'path', 'identifier'],
      },
    });

    this.logger = logger.child({ component: 'CKGTool' });
  }

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    try {
      this.validateParams(params);

      const command = params.command as CKGToolCommand;
      const codebasePath = (params.path as string) || context.workingDirectory;
      const identifier = params.identifier as string;
      const printBody = params.print_body !== false; // 默认为true

      // 验证路径
      if (!codebasePath) {
        return this.createErrorResult('缺少代码库路径参数');
      }

      if (!identifier) {
        return this.createErrorResult('缺少标识符参数');
      }

      // 获取或创建数据库
      const database = await this.getOrCreateDatabase(codebasePath);

      // 执行具体命令
      switch (command) {
        case 'search_function':
          return await this.searchFunction(database, identifier, printBody);
        case 'search_class':
          return await this.searchClass(database, identifier, printBody);
        case 'search_class_method':
          return await this.searchClassMethod(database, identifier, printBody);
        default:
          return this.createErrorResult(`不支持的命令: ${command}`);
      }
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * 获取或创建数据库
   */
  private async getOrCreateDatabase(codebasePath: string): Promise<CKGDatabase> {
    const normalizedPath = path.resolve(codebasePath);
    
    if (this.databases.has(normalizedPath)) {
      return this.databases.get(normalizedPath)!;
    }

    const database = new CKGDatabase(normalizedPath);
    this.databases.set(normalizedPath, database);
    return database;
  }

  /**
   * 搜索函数
   */
  private async searchFunction(
    database: CKGDatabase,
    identifier: string,
    printBody: boolean = true
  ): Promise<ToolResult> {
    try {
      this.logger.debug(`搜索函数: ${identifier}`);

      const functions = database.queryFunction(identifier, 'function');

      if (functions.length === 0) {
        return this.createSuccessResult(`未找到名为 ${identifier} 的函数`);
      }

      let output = `找到 ${functions.length} 个名为 ${identifier} 的函数:\n\n`;
      let index = 1;

      for (const func of functions) {
        output += `${index}. ${func.filePath}:${func.startLine}-${func.endLine}\n`;
        
        if (printBody) {
          output += `${func.body}\n\n`;
        }

        index++;

        // 检查输出长度限制
        if (output.length > MAX_RESPONSE_LEN) {
          output = output.substring(0, MAX_RESPONSE_LEN) + 
                   `\n${TRUNCATED_MESSAGE} ${functions.length - index + 1} 个条目未显示`;
          break;
        }
      }

      return this.createSuccessResult(output.trim());
    } catch (error) {
      return this.createErrorResult(`搜索函数时发生错误: ${error}`);
    }
  }

  /**
   * 搜索类
   */
  private async searchClass(
    database: CKGDatabase,
    identifier: string,
    printBody: boolean = true
  ): Promise<ToolResult> {
    try {
      this.logger.debug(`搜索类: ${identifier}`);

      const classes = database.queryClass(identifier);

      if (classes.length === 0) {
        return this.createSuccessResult(`未找到名为 ${identifier} 的类`);
      }

      let output = `找到 ${classes.length} 个名为 ${identifier} 的类:\n\n`;
      let index = 1;

      for (const cls of classes) {
        output += `${index}. ${cls.filePath}:${cls.startLine}-${cls.endLine}\n`;
        
        if (cls.fields) {
          output += `字段:\n${cls.fields}\n`;
        }
        
        if (cls.methods) {
          output += `方法:\n${cls.methods}\n`;
        }
        
        if (printBody) {
          output += `${cls.body}\n\n`;
        }

        index++;

        // 检查输出长度限制
        if (output.length > MAX_RESPONSE_LEN) {
          output = output.substring(0, MAX_RESPONSE_LEN) + 
                   `\n${TRUNCATED_MESSAGE} ${classes.length - index + 1} 个条目未显示`;
          break;
        }
      }

      return this.createSuccessResult(output.trim());
    } catch (error) {
      return this.createErrorResult(`搜索类时发生错误: ${error}`);
    }
  }

  /**
   * 搜索类方法
   */
  private async searchClassMethod(
    database: CKGDatabase,
    identifier: string,
    printBody: boolean = true
  ): Promise<ToolResult> {
    try {
      this.logger.debug(`搜索类方法: ${identifier}`);

      const methods = database.queryFunction(identifier, 'class_method');

      if (methods.length === 0) {
        return this.createSuccessResult(`未找到名为 ${identifier} 的类方法`);
      }

      let output = `找到 ${methods.length} 个名为 ${identifier} 的类方法:\n\n`;
      let index = 1;

      for (const method of methods) {
        output += `${index}. ${method.filePath}:${method.startLine}-${method.endLine} 在类 ${method.parentClass} 中\n`;
        
        if (printBody) {
          output += `${method.body}\n\n`;
        }

        index++;

        // 检查输出长度限制
        if (output.length > MAX_RESPONSE_LEN) {
          output = output.substring(0, MAX_RESPONSE_LEN) + 
                   `\n${TRUNCATED_MESSAGE} ${methods.length - index + 1} 个条目未显示`;
          break;
        }
      }

      return this.createSuccessResult(output.trim());
    } catch (error) {
      return this.createErrorResult(`搜索类方法时发生错误: ${error}`);
    }
  }

  /**
   * 更新代码库的CKG
   */
  public async updateCodebase(codebasePath: string): Promise<ToolResult> {
    try {
      const normalizedPath = path.resolve(codebasePath);
      const database = this.databases.get(normalizedPath);
      
      if (!database) {
        return this.createErrorResult(`未找到代码库的CKG数据库: ${codebasePath}`);
      }

      database.update();
      
      return this.createSuccessResult(`代码库CKG更新完成: ${codebasePath}`);
    } catch (error) {
      return this.createErrorResult(`更新代码库CKG时发生错误: ${error}`);
    }
  }

  /**
   * 关闭所有数据库连接
   */
  public closeAll(): void {
    for (const database of this.databases.values()) {
      database.close();
    }
    this.databases.clear();
  }
}

// Register the tool
import { globalToolRegistry } from './base.js';

// 注意：这里不直接注册，而是在需要时通过工厂模式创建
// 因为Logger需要从外部传入