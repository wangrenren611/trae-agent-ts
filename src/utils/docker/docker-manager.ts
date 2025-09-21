import Docker from 'dockerode';
import { Config } from '../../types/index.js';
import { Logger } from '../logging/logger.js';

export class DockerManager {
  private docker: Docker;
  private config: Config;
  private logger: Logger;
  private containers: Map<string, string> = new Map(); // container name -> container id

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger.child({ component: 'DockerManager' });
    this.docker = new Docker();
  }

  async initialize(): Promise<void> {
    try {
      // Test Docker connection
      await this.docker.ping();
      this.logger.info('Docker connection established');
    } catch (error) {
      this.logger.error('Failed to connect to Docker daemon', { error });
      throw new Error('Docker daemon is not available. Please ensure Docker is installed and running.');
    }
  }

  async createContainer(
    name: string,
    workingDir: string,
    environment: Record<string, string> = {}
  ): Promise<string> {
    if (!this.config.docker) {
      throw new Error('Docker configuration not provided');
    }

    try {
      const containerConfig = {
        Image: this.config.docker.image,
        name: this.config.docker.container_name || `trae-agent-${name}-${Date.now()}`,
        WorkingDir: workingDir,
        Env: Object.entries({ ...this.config.docker.environment, ...environment })
          .map(([key, value]) => `${key}=${value}`),
        Volumes: {},
        HostConfig: {
          Binds: [
            `${workingDir}:${workingDir}`,
            ...this.config.docker.volumes,
          ],
          AutoRemove: true,
          NetworkMode: 'bridge',
        },
        Cmd: ['/bin/sh', '-c', 'while true; do sleep 30; done'],
      };

      this.logger.debug('Creating Docker container', { config: containerConfig });

      const container = await this.docker.createContainer(containerConfig);
      await container.start();

      this.containers.set(name, container.id);
      this.logger.info(`Docker container created and started: ${container.id}`);

      return container.id;
    } catch (error) {
      this.logger.error('Failed to create Docker container', { error });
      throw error;
    }
  }

  async executeCommand(
    containerName: string,
    command: string[],
    timeout = 30000
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerId = this.containers.get(containerName);
    if (!containerId) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      const container = this.docker.getContainer(containerId);

      // Execute command
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      return new Promise((resolve, reject) => {
        let stdout = '';
        let stderr = '';
        let timeoutId: NodeJS.Timeout;

        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
        };

        // Set timeout
        if (timeout > 0) {
          timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Command timed out after ${timeout}ms`));
          }, timeout);
        }

        // Handle stream data
        stream.on('data', (chunk: Buffer) => {
          // Docker multiplexes stdout and stderr
          // First 8 bytes are header, rest is content
          if (chunk.length > 8) {
            const header = chunk.slice(0, 8);
            const content = chunk.slice(8).toString();
            const streamType = header[0];

            if (streamType === 1) {
              stdout += content;
            } else if (streamType === 2) {
              stderr += content;
            }
          }
        });

        stream.on('end', async () => {
          cleanup();

          try {
            const inspect = await exec.inspect();
            resolve({
              stdout: stdout.trim(),
              stderr: stderr.trim(),
              exitCode: inspect.ExitCode || 0,
            });
          } catch (error) {
            reject(error);
          }
        });

        stream.on('error', (error: Error) => {
          cleanup();
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error('Failed to execute command in container', { error, containerName, command });
      throw error;
    }
  }

  async writeFile(containerName: string, path: string, content: string): Promise<void> {
    const containerId = this.containers.get(containerName);
    if (!containerId) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      const container = this.docker.getContainer(containerId);

      // Create directory if it doesn't exist
      const dir = path.split('/').slice(0, -1).join('/');
      if (dir) {
        await this.executeCommand(containerName, ['mkdir', '-p', dir]);
      }

      // Write file using echo (simple approach)
      const escapedContent = content.replace(/'/g, "'\"'\"'");
      await this.executeCommand(containerName, [
        'sh', '-c', `echo '${escapedContent}' > ${path}`
      ]);

      this.logger.debug(`File written to container: ${path}`);
    } catch (error) {
      this.logger.error('Failed to write file to container', { error, containerName, path });
      throw error;
    }
  }

  async readFile(containerName: string, path: string): Promise<string> {
    const containerId = this.containers.get(containerName);
    if (!containerId) {
      throw new Error(`Container not found: ${containerName}`);
    }

    try {
      const result = await this.executeCommand(containerName, ['cat', path]);

      if (result.exitCode !== 0) {
        throw new Error(`Failed to read file: ${result.stderr}`);
      }

      return result.stdout;
    } catch (error) {
      this.logger.error('Failed to read file from container', { error, containerName, path });
      throw error;
    }
  }

  async destroyContainer(containerName: string): Promise<void> {
    const containerId = this.containers.get(containerName);
    if (!containerId) {
      return;
    }

    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      await container.remove();

      this.containers.delete(containerName);
      this.logger.info(`Docker container destroyed: ${containerId}`);
    } catch (error) {
      this.logger.error('Failed to destroy Docker container', { error, containerName, containerId });
      // Don't throw - container might already be stopped/removed
    }
  }

  async destroyAllContainers(): Promise<void> {
    const promises = Array.from(this.containers.keys()).map(name =>
      this.destroyContainer(name).catch(error =>
        this.logger.warn(`Failed to destroy container ${name}`, { error })
      )
    );

    await Promise.all(promises);
  }

  getContainerStatus(containerName: string): Promise<any> {
    const containerId = this.containers.get(containerName);
    if (!containerId) {
      throw new Error(`Container not found: ${containerName}`);
    }

    const container = this.docker.getContainer(containerId);
    return container.inspect();
  }

  isDockerAvailable(): boolean {
    return this.docker !== null;
  }

  getActiveContainers(): string[] {
    return Array.from(this.containers.keys());
  }
}

