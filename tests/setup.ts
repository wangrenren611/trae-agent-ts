// Test setup file

// Mock console methods to reduce noise in tests
const mockConsole = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

(global as any).console = mockConsole;

// Set test environment variables
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GOOGLE_API_KEY = 'test-google-key';

// Increase test timeout
jest.setTimeout(30000);