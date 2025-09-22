/**
 * CKG数据库类
 * 负责代码知识图谱的构建、存储和查询
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import { 
  FunctionEntry, 
  ClassEntry, 
  CodebaseSnapshot, 
  EXTENSION_TO_LANGUAGE,
  SUPPORTED_LANGUAGES,
  QueryResultType,
  CKG_DATABASE_EXPIRY_TIME,
  MAX_RESPONSE_LEN,
  TRUNCATED_MESSAGE
} from './types.js';

/**
 * CKG数据库类
 */
export class CKGDatabase {
  private db: Database.Database;
  private codebasePath: string;
  private snapshot: CodebaseSnapshot;

  // SQL表创建语句
  private static readonly SQL_CREATE_TABLES = {
    functions: `
      CREATE TABLE IF NOT EXISTS functions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        body TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        parent_function TEXT,
        parent_class TEXT
      )
    `,
    classes: `
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        body TEXT NOT NULL,
        fields TEXT,
        methods TEXT,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL
      )
    `
  };

  constructor(codebasePath: string) {
    this.codebasePath = path.resolve(codebasePath);
    this.snapshot = this.getCodebaseSnapshot();
    
    // 确保CKG存储目录存在
    const ckgStoragePath = this.getCKGStoragePath();
    fs.ensureDirSync(ckgStoragePath);
    
    // 获取或创建数据库
    const dbPath = this.getDatabasePath();
    this.db = new Database(dbPath);
    
    // 创建表结构
    this.initializeTables();
    
    // 如果数据库为空，构建CKG
    if (this.isDatabaseEmpty()) {
      this.constructCKG();
    }
  }

  /**
   * 获取代码库快照
   */
  private getCodebaseSnapshot(): CodebaseSnapshot {
    const isGitRepo = this.isGitRepository();
    const hash = isGitRepo ? this.getGitStatusHash() : this.getFileMetadataHash();
    
    return {
      hash,
      path: this.codebasePath,
      lastModified: new Date(),
      isGitRepository: isGitRepo
    };
  }

  /**
   * 检查是否为Git仓库
   */
  private isGitRepository(): boolean {
    try {
      const result = spawn('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: this.codebasePath,
        stdio: 'pipe'
      });
      
      return new Promise<boolean>((resolve) => {
        result.on('close', (code) => {
          resolve(code === 0);
        });
        result.on('error', () => {
          resolve(false);
        });
      }) as any; // 简化处理，实际应该使用异步方式
    } catch {
      return false;
    }
  }

  /**
   * 获取Git状态哈希
   */
  private getGitStatusHash(): string {
    try {
      // 获取Git状态
      const statusResult = spawn('git', ['status', '--porcelain'], {
        cwd: this.codebasePath,
        stdio: 'pipe'
      });
      
      // 获取当前提交哈希
      const commitResult = spawn('git', ['rev-parse', 'HEAD'], {
        cwd: this.codebasePath,
        stdio: 'pipe'
      });
      
      // 简化处理，实际应该使用异步方式获取结果
      const baseHash = 'current-commit'; // 占位符
      const uncommittedHash = crypto.createHash('md5').update('status').digest('hex').substring(0, 8);
      
      return `git-dirty-${baseHash}-${uncommittedHash}`;
    } catch {
      return this.getFileMetadataHash();
    }
  }

  /**
   * 获取文件元数据哈希
   */
  private getFileMetadataHash(): string {
    const hash = crypto.createHash('md5');
    
    const walkDirectory = (dir: string) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.')) {
          walkDirectory(filePath);
        } else if (stat.isFile() && !file.startsWith('.')) {
          hash.update(file);
          hash.update(stat.mtime.getTime().toString());
          hash.update(stat.size.toString());
        }
      }
    };
    
    walkDirectory(this.codebasePath);
    return `metadata-${hash.digest('hex')}`;
  }

  /**
   * 获取CKG存储路径
   */
  private getCKGStoragePath(): string {
    const os = require('os');
    return path.join(os.homedir(), '.trae-agent', 'ckg');
  }

  /**
   * 获取数据库路径
   */
  private getDatabasePath(): string {
    const storagePath = this.getCKGStoragePath();
    return path.join(storagePath, `${this.snapshot.hash}.db`);
  }

  /**
   * 初始化数据库表
   */
  private initializeTables(): void {
    for (const sql of Object.values(CKGDatabase.SQL_CREATE_TABLES)) {
      this.db.exec(sql);
    }
  }

  /**
   * 检查数据库是否为空
   */
  private isDatabaseEmpty(): boolean {
    const functionsCount = this.db.prepare('SELECT COUNT(*) as count FROM functions').get() as { count: number };
    const classesCount = this.db.prepare('SELECT COUNT(*) as count FROM classes').get() as { count: number };
    return functionsCount.count === 0 && classesCount.count === 0;
  }

  /**
   * 构建代码知识图谱
   */
  private constructCKG(): void {
    console.log(`构建代码知识图谱: ${this.codebasePath}`);
    
    // 清空现有数据
    this.db.exec('DELETE FROM functions');
    this.db.exec('DELETE FROM classes');
    
    // 遍历代码库文件
    this.walkCodebase();
    
    console.log('代码知识图谱构建完成');
  }

  /**
   * 遍历代码库
   */
  private walkCodebase(): void {
    const walkDirectory = (dir: string) => {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('.')) {
          walkDirectory(filePath);
        } else if (stat.isFile() && !file.startsWith('.')) {
          this.processFile(filePath);
        }
      }
    };
    
    walkDirectory(this.codebasePath);
  }

  /**
   * 处理单个文件
   */
  private processFile(filePath: string): void {
    const ext = path.extname(filePath);
    const language = EXTENSION_TO_LANGUAGE[ext];
    
    if (!language || !SUPPORTED_LANGUAGES.includes(language as any)) {
      return;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.parseFile(content, filePath, language as any);
    } catch (error) {
      console.warn(`解析文件失败: ${filePath}`, error);
    }
  }

  /**
   * 解析文件内容
   */
  private parseFile(content: string, filePath: string, language: string): void {
    // 这里应该使用tree-sitter进行AST解析
    // 由于tree-sitter的Node.js绑定比较复杂，这里使用简化的正则表达式解析
    
    switch (language) {
      case 'python':
        this.parsePythonFile(content, filePath);
        break;
      case 'typescript':
      case 'javascript':
        this.parseTypeScriptFile(content, filePath);
        break;
      case 'java':
        this.parseJavaFile(content, filePath);
        break;
      case 'cpp':
      case 'c':
        this.parseCppFile(content, filePath);
        break;
    }
  }

  /**
   * 解析Python文件
   */
  private parsePythonFile(content: string, filePath: string): void {
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // 解析类定义
      if (line.startsWith('class ')) {
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'class');
          
          const classBody = lines.slice(i, endLine + 1).join('\n');
          const classEntry: ClassEntry = {
            name: className,
            filePath,
            body: classBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertClass(classEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      // 解析函数定义
      if (line.startsWith('def ')) {
        const funcMatch = line.match(/def\s+(\w+)/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'def');
          
          const funcBody = lines.slice(i, endLine + 1).join('\n');
          const funcEntry: FunctionEntry = {
            name: funcName,
            filePath,
            body: funcBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertFunction(funcEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      i++;
    }
  }

  /**
   * 解析TypeScript/JavaScript文件
   */
  private parseTypeScriptFile(content: string, filePath: string): void {
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // 解析类定义
      if (line.includes('class ') && line.includes('{')) {
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'class');
          
          const classBody = lines.slice(i, endLine + 1).join('\n');
          const classEntry: ClassEntry = {
            name: className,
            filePath,
            body: classBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertClass(classEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      // 解析函数定义
      if (line.includes('function ') || line.includes('=>')) {
        const funcMatch = line.match(/(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?(?:function|\(.*\)\s*=>))/);
        if (funcMatch) {
          const funcName = funcMatch[1] || funcMatch[2];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'function');
          
          const funcBody = lines.slice(i, endLine + 1).join('\n');
          const funcEntry: FunctionEntry = {
            name: funcName,
            filePath,
            body: funcBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertFunction(funcEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      i++;
    }
  }

  /**
   * 解析Java文件
   */
  private parseJavaFile(content: string, filePath: string): void {
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // 解析类定义
      if (line.includes('class ') && line.includes('{')) {
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'class');
          
          const classBody = lines.slice(i, endLine + 1).join('\n');
          const classEntry: ClassEntry = {
            name: className,
            filePath,
            body: classBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertClass(classEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      // 解析方法定义
      if (line.includes('(') && line.includes(')') && line.includes('{')) {
        const methodMatch = line.match(/(\w+)\s*\(/);
        if (methodMatch) {
          const methodName = methodMatch[1];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'method');
          
          const methodBody = lines.slice(i, endLine + 1).join('\n');
          const methodEntry: FunctionEntry = {
            name: methodName,
            filePath,
            body: methodBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertFunction(methodEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      i++;
    }
  }

  /**
   * 解析C++/C文件
   */
  private parseCppFile(content: string, filePath: string): void {
    const lines = content.split('\n');
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // 解析类定义
      if (line.includes('class ') && line.includes('{')) {
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
          const className = classMatch[1];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'class');
          
          const classBody = lines.slice(i, endLine + 1).join('\n');
          const classEntry: ClassEntry = {
            name: className,
            filePath,
            body: classBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertClass(classEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      // 解析函数定义
      if (line.includes('(') && line.includes(')') && line.includes('{')) {
        const funcMatch = line.match(/(\w+)\s*\(/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          const startLine = i + 1;
          const endLine = this.findBlockEnd(lines, i, 'function');
          
          const funcBody = lines.slice(i, endLine + 1).join('\n');
          const funcEntry: FunctionEntry = {
            name: funcName,
            filePath,
            body: funcBody,
            startLine,
            endLine: endLine + 1
          };
          
          this.insertFunction(funcEntry);
          i = endLine + 1;
          continue;
        }
      }
      
      i++;
    }
  }

  /**
   * 查找代码块的结束位置
   */
  private findBlockEnd(lines: string[], startIndex: number, blockType: string): number {
    let braceCount = 0;
    let foundStart = false;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // 查找开始的大括号
      if (!foundStart) {
        if (line.includes('{')) {
          foundStart = true;
          braceCount = 1;
        }
        continue;
      }
      
      // 计算大括号
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      
      if (braceCount === 0) {
        return i;
      }
    }
    
    return lines.length - 1;
  }

  /**
   * 插入函数条目
   */
  private insertFunction(entry: FunctionEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO functions (name, file_path, body, start_line, end_line, parent_function, parent_class)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      entry.name,
      entry.filePath,
      entry.body,
      entry.startLine,
      entry.endLine,
      entry.parentFunction || null,
      entry.parentClass || null
    );
  }

  /**
   * 插入类条目
   */
  private insertClass(entry: ClassEntry): void {
    const stmt = this.db.prepare(`
      INSERT INTO classes (name, file_path, body, fields, methods, start_line, end_line)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      entry.name,
      entry.filePath,
      entry.body,
      entry.fields || null,
      entry.methods || null,
      entry.startLine,
      entry.endLine
    );
  }

  /**
   * 查询函数
   */
  public queryFunction(identifier: string, entryType: QueryResultType = 'function'): FunctionEntry[] {
    const stmt = this.db.prepare(`
      SELECT name, file_path, body, start_line, end_line, parent_function, parent_class 
      FROM functions 
      WHERE name = ?
    `);
    
    const records = stmt.all(identifier) as any[];
    const entries: FunctionEntry[] = [];
    
    for (const record of records) {
      if (entryType === 'function' && !record.parent_class) {
        entries.push({
          name: record.name,
          filePath: record.file_path,
          body: record.body,
          startLine: record.start_line,
          endLine: record.end_line,
          parentFunction: record.parent_function,
          parentClass: record.parent_class
        });
      } else if (entryType === 'class_method' && record.parent_class) {
        entries.push({
          name: record.name,
          filePath: record.file_path,
          body: record.body,
          startLine: record.start_line,
          endLine: record.end_line,
          parentFunction: record.parent_function,
          parentClass: record.parent_class
        });
      }
    }
    
    return entries;
  }

  /**
   * 查询类
   */
  public queryClass(identifier: string): ClassEntry[] {
    const stmt = this.db.prepare(`
      SELECT name, file_path, body, fields, methods, start_line, end_line 
      FROM classes 
      WHERE name = ?
    `);
    
    const records = stmt.all(identifier) as any[];
    const entries: ClassEntry[] = [];
    
    for (const record of records) {
      entries.push({
        name: record.name,
        filePath: record.file_path,
        body: record.body,
        startLine: record.start_line,
        endLine: record.end_line,
        fields: record.fields,
        methods: record.methods
      });
    }
    
    return entries;
  }

  /**
   * 更新CKG
   */
  public update(): void {
    this.constructCKG();
  }

  /**
   * 获取快照信息
   */
  public getSnapshot(): CodebaseSnapshot {
    return this.snapshot;
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    this.db.close();
  }
}
