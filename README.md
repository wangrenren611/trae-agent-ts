# Trae Agent TypeScript

A TypeScript implementation of Trae Agent - an AI-powered software engineering assistant that helps with programming and software development tasks.

## Features

- **Multi-LLM Support**: Works with Anthropic Claude, OpenAI GPT, Google Gemini, and more
- **Rich Tool Ecosystem**: File editing, bash execution, JSON manipulation, structured thinking
- **Docker Integration**: Secure containerized execution environment
- **Trajectory Recording**: Detailed execution logging for debugging and analysis
- **MCP Support**: Model Context Protocol for external tool integration
- **Interactive Mode**: Conversational interface for iterative development
- **TypeScript Native**: Full type safety and modern development experience

## Installation

```bash
npm install trae-agent-ts
# or
yarn add trae-agent-ts
```

## Quick Start

### Command Line Interface

```bash
# Run with a task
npx trae-agent-ts run "Create a React component for a todo list"

# Interactive mode
npx trae-agent-ts interactive

# Generate configuration file
npx trae-agent-ts config generate
```

### Programmatic Usage

```typescript
import { Agent, ConfigManager } from 'trae-agent-ts';

async function main() {
  // Load configuration
  const configManager = await ConfigManager.getInstance();
  const config = configManager.getConfig();

  // Create agent
  const agent = await Agent.create({
    config,
    workingDirectory: './workspace',
  });

  // Execute task
  const trajectory = await agent.execute(
    "Create a Node.js Express server with TypeScript"
  );

  console.log(`Task completed: ${trajectory.success}`);
  console.log(`Steps taken: ${trajectory.steps.length}`);
}

main().catch(console.error);
```

## Configuration

Create a `trae_config.yaml` file:

```yaml
llm:
  provider: anthropic
  model: claude-3-5-sonnet-20241022
  api_key: ${ANTHROPIC_API_KEY}
  max_tokens: 4096
  temperature: 0.7

agent:
  max_steps: 30
  working_directory: .
  enable_docker: false
  enable_trajectory_recording: true
  tools:
    - edit_tool
    - bash_tool
    - json_edit_tool
    - sequential_thinking_tool
    - task_done_tool
    - ckg_tool

docker:
  image: node:18-alpine
  volumes:
    - ./workspace:/workspace

logging:
  level: info
  format: pretty
```

### Environment Variables

You can override configuration with environment variables:

- `TRAELLM_PROVIDER` - LLM provider (anthropic, openai, google)
- `TRAELLM_MODEL` - Model name
- `TRAELLM_API_KEY` - API key
- `TRAELLM_BASE_URL` - Custom API base URL
- `TRAE_MAX_STEPS` - Maximum steps
- `TRAE_WORKING_DIRECTORY` - Working directory
- `TRAE_ENABLE_DOCKER` - Enable Docker support
- `TRAE_LOG_LEVEL` - Log level

## Available Tools

### Core Tools

- **edit_tool**: View, create, and edit files
- **bash_tool**: Execute shell commands with session management
- **json_edit_tool**: Manipulate JSON files
- **sequential_thinking_tool**: Structured problem-solving process
- **task_done_tool**: Signal task completion

### Advanced Tools

- **ckg_tool**: Code Knowledge Graph for codebase analysis
- **mcp_tool**: Model Context Protocol integration

## API Reference

### Agent Creation

```typescript
import { Agent, ConfigManager } from 'trae-agent-ts';

const configManager = await ConfigManager.getInstance();
const agent = await Agent.create({
  config: configManager.getConfig(),
  workingDirectory: './workspace',
  logger: customLogger, // optional
});
```

### Task Execution

```typescript
const trajectory = await agent.execute(
  "Your task description here",
  maxSteps // optional, defaults to config
);
```

### Custom Tools

```typescript
import { ToolExecutor } from 'trae-agent-ts';

class MyCustomTool extends ToolExecutor {
  constructor() {
    super('my_tool', {
      name: 'my_tool',
      description: 'My custom tool',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Parameter 1' }
        },
        required: ['param1']
      }
    });
  }

  async execute(params, context) {
    // Your tool logic here
    return this.createSuccessResult({ result: 'success' });
  }
}
```

### Custom LLM Providers

```typescript
import { LLMClient, LLMMessage, LLMResponse } from 'trae-agent-ts';

class MyCustomLLM extends LLMClient {
  async chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    // Your LLM implementation
    return {
      content: 'Response content',
      model: 'my-model'
    };
  }

  async *stream(messages: LLMMessage[]): AsyncGenerator<string> {
    // Your streaming implementation
    yield 'Response chunk';
  }
}
```

## Docker Support

Enable Docker for secure, isolated execution:

```yaml
agent:
  enable_docker: true

docker:
  image: node:18-alpine
  container_name: trae-agent
  volumes:
    - ./workspace:/workspace
  environment:
    NODE_ENV: development
```

## Trajectory Recording

Enable detailed execution logging:

```yaml
agent:
  enable_trajectory_recording: true
  trajectory_output_dir: ./trajectories
```

Each trajectory includes:
- Complete message history
- Tool calls and results
- Execution timing
- Success/failure status

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/trae-agent-ts.git
cd trae-agent-ts

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linting
npm run lint

# Development mode
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Examples

### File Operations

```typescript
const trajectory = await agent.execute(
  "Create a TypeScript file with a simple calculator class"
);
```

### Code Analysis

```typescript
const trajectory = await agent.execute(
  "Analyze the codebase structure and identify potential improvements"
);
```

### Project Setup

```typescript
const trajectory = await agent.execute(
  "Set up a new React project with TypeScript, ESLint, and Prettier"
);
```

## Architecture

```
src/
├── agent/              # Core agent implementation
├── tools/              # Tool implementations
├── utils/
│   ├── llm_clients/    # LLM provider implementations
│   ├── config/         # Configuration management
│   ├── logging/        # Logging utilities
│   ├── trajectory/     # Trajectory recording
│   └── docker/         # Docker integration
├── types/              # TypeScript type definitions
└── cli.ts              # Command-line interface
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/your-org/trae-agent-ts/wiki)
- 🐛 [Issue Tracker](https://github.com/your-org/trae-agent-ts/issues)
- 💬 [Discussions](https://github.com/your-org/trae-agent-ts/discussions)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.## Comparison with Python Version

This TypeScript version provides several advantages over the original Python implementation:

- **Type Safety**: Full TypeScript type definitions for better development experience
- **Performance**: Node.js runtime can offer better performance for I/O operations
- **Ecosystem**: Access to the vast Node.js ecosystem
- **Modern JavaScript**: Latest ES features and async/await patterns
- **Better Tooling**: Improved IDE support and development tools
- **Cross-platform**: Consistent behavior across different operating systems

## Roadmap

- [ ] Add more LLM providers (Azure, OpenRouter, Ollama)
- [ ] Implement parallel tool execution
- [ ] Add more built-in tools
- [ ] Improve Docker container management
- [ ] Add web interface
- [ ] Implement plugin system
- [ ] Add more comprehensive examples
- [ ] Performance optimizations

---

**Trae Agent TypeScript** - Empowering developers with AI-assisted software engineering