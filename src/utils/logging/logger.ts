import pino from 'pino';
import { Config } from '../../types/index.js';

export class Logger {
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  static create(config: Config['logging']): Logger {
    const options: pino.LoggerOptions = {
      level: config?.level || 'info',
      transport: config?.format === 'pretty' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      } : undefined,
    };

    if (config?.file) {
      options.transport = {
        targets: [
          {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
          {
            target: 'pino/file',
            options: {
              destination: config.file,
            },
          },
        ],
      };
    }

    const pinoLogger = pino(options);
    return new Logger(pinoLogger);
  }

  debug(message: string, data?: any): void {
    this.logger.debug(data || {}, message);
  }

  info(message: string, data?: any): void {
    this.logger.info(data || {}, message);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(data || {}, message);
  }

  error(message: string, data?: any): void {
    this.logger.error(data || {}, message);
  }

  fatal(message: string, data?: any): void {
    this.logger.fatal(data || {}, message);
  }

  child(bindings: Record<string, any>): Logger {
    return new Logger(this.logger.child(bindings));
  }
}