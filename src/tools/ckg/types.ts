/**
 * CKG工具相关的类型定义
 */

/**
 * 函数条目
 */
export interface FunctionEntry {
  name: string;
  filePath: string;
  body: string;
  startLine: number;
  endLine: number;
  parentFunction?: string;
  parentClass?: string;
}

/**
 * 类条目
 */
export interface ClassEntry {
  name: string;
  filePath: string;
  body: string;
  startLine: number;
  endLine: number;
  fields?: string;
  methods?: string;
}

/**
 * CKG工具命令类型
 */
export type CKGToolCommand = 'search_function' | 'search_class' | 'search_class_method';

/**
 * CKG工具参数
 */
export interface CKGToolArguments {
  command: CKGToolCommand;
  path: string;
  identifier: string;
  printBody?: boolean;
}

/**
 * 工具执行结果
 */
export interface ToolExecResult {
  success: boolean;
  output?: string;
  error?: string;
  errorCode?: number;
}

/**
 * 代码库快照信息
 */
export interface CodebaseSnapshot {
  hash: string;
  path: string;
  lastModified: Date;
  isGitRepository: boolean;
}

/**
 * 文件扩展名到语言的映射
 */
export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.c++': 'cpp',
  '.cxx': 'cpp',
  '.cc': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
};

/**
 * 支持的语言列表
 */
export const SUPPORTED_LANGUAGES = [
  'python',
  'java',
  'cpp',
  'c',
  'typescript',
  'javascript',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * 数据库表结构
 */
export interface DatabaseSchema {
  functions: {
    id: number;
    name: string;
    file_path: string;
    body: string;
    start_line: number;
    end_line: number;
    parent_function?: string;
    parent_class?: string;
  };
  classes: {
    id: number;
    name: string;
    file_path: string;
    body: string;
    fields?: string;
    methods?: string;
    start_line: number;
    end_line: number;
  };
}

/**
 * 查询结果类型
 */
export type QueryResultType = 'function' | 'class_method';

/**
 * 常量定义
 */
export const MAX_RESPONSE_LEN = 10000;
export const TRUNCATED_MESSAGE = '<response clipped>';
export const CKG_DATABASE_EXPIRY_TIME = 60 * 60 * 24 * 7; // 1 week in seconds
