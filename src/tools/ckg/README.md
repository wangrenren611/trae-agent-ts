# CKG (Code Knowledge Graph) 工具

CKG 工具是一个用于构建和查询代码知识图谱的工具，它能够分析代码库中的函数、类和方法，并提供强大的搜索功能。

## 功能特性

- **多语言支持**: 支持 Python、TypeScript、JavaScript、Java、C++、C 等编程语言
- **智能解析**: 使用 AST 解析技术准确识别代码结构
- **持久化存储**: 使用 SQLite 数据库存储代码知识图谱
- **Git 集成**: 自动检测 Git 仓库变化，智能更新索引
- **高效搜索**: 支持函数、类和类方法的精确搜索

## 支持的命令

### 1. search_function
搜索代码库中的函数定义。

**参数:**
- `command`: "search_function"
- `path`: 代码库路径
- `identifier`: 函数名称
- `print_body`: 是否显示函数体（可选，默认为 true）

**示例:**
```json
{
  "command": "search_function",
  "path": "./src",
  "identifier": "execute",
  "print_body": true
}
```

### 2. search_class
搜索代码库中的类定义。

**参数:**
- `command`: "search_class"
- `path`: 代码库路径
- `identifier`: 类名称
- `print_body`: 是否显示类体（可选，默认为 true）

**示例:**
```json
{
  "command": "search_class",
  "path": "./src",
  "identifier": "ToolExecutor",
  "print_body": true
}
```

### 3. search_class_method
搜索代码库中的类方法。

**参数:**
- `command`: "search_class_method"
- `path`: 代码库路径
- `identifier`: 方法名称
- `print_body`: 是否显示方法体（可选，默认为 true）

**示例:**
```json
{
  "command": "search_class_method",
  "path": "./src",
  "identifier": "execute",
  "print_body": true
}
```

## 支持的文件类型

| 扩展名 | 语言 |
|--------|------|
| .py | Python |
| .java | Java |
| .cpp, .hpp, .c++, .cxx, .cc | C++ |
| .c, .h | C |
| .ts, .tsx | TypeScript |
| .js, .jsx | JavaScript |

## 架构设计

### 核心组件

1. **CKGTool**: 主要的工具类，负责处理用户请求
2. **CKGDatabase**: 数据库管理类，负责代码解析和存储
3. **类型定义**: 完整的 TypeScript 类型系统

### 数据存储

- 使用 SQLite 数据库存储代码知识图谱
- 数据库文件存储在 `~/.trae-agent/ckg/` 目录下
- 每个代码库使用独立的数据库文件
- 支持 Git 状态检测，自动更新索引

### 代码解析

- 使用正则表达式进行基础代码解析
- 支持嵌套结构识别（类中的方法、函数中的函数）
- 提取函数/类的完整定义和位置信息

## 使用示例

```typescript
import { CKGTool } from './ckg-tool.js';
import { Logger } from '../utils/logging/logger.js';

// 创建工具实例
const logger = Logger.create({ level: 'info', format: 'pretty' });
const ckgTool = new CKGTool(logger);

// 搜索函数
const result = await ckgTool.execute({
  command: 'search_function',
  path: './src',
  identifier: 'execute',
  print_body: true
}, {
  workingDirectory: './',
  environment: {}
});

console.log(result);
```

## 注意事项

1. **首次使用**: 第一次分析代码库时，工具会构建完整的知识图谱，可能需要一些时间
2. **存储空间**: 大型代码库的索引文件可能较大，请确保有足够的磁盘空间
3. **权限要求**: 需要读取代码库文件的权限
4. **Git 支持**: 如果代码库是 Git 仓库，工具会自动检测变化并更新索引

## 错误处理

工具会处理以下常见错误：
- 代码库路径不存在
- 文件权限不足
- 数据库连接失败
- 代码解析错误

所有错误都会返回详细的错误信息，便于调试和问题定位。

## 性能优化

- 使用增量更新机制，只重新解析变化的文件
- 数据库连接池管理，避免频繁连接
- 智能缓存策略，提高查询效率
- 支持并发处理，提高大型代码库的处理速度
