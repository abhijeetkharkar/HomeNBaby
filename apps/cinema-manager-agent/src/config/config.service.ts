import * as path from 'path';
import * as fs from 'fs-extra';

export interface ServiceConfig {
  auth0?: {
    domain?: string;
    clientId?: string;
    clientSecret?: string;
    audience?: string;
  };
  api: {
    baseUrl: string;
    timeout: number;
    retryCount: number;
  };
  agent: {
    id: string;
    name: string;
    watchPaths: string[];
  };
}

/**
 * Configuration service for Windows agent
 * Loads configuration from JSON file with environment variable overrides
 */
export class ConfigService {
  private config!: ServiceConfig;

  constructor(configPath?: string) {
    this.loadConfig(configPath);
  }

  /**
   * Get configuration value by dot-notation key
   * @param key - Configuration key (e.g., 'auth0.domain')
   * @returns Configuration value
   */
  get(key: string): unknown {
    const keys = key.split('.');
    let value: unknown = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Get all configuration
   * @returns Complete configuration object
   */
  getAll(): ServiceConfig {
    return { ...this.config };
  }

  private loadConfig(configPath?: string): void {
    const os = require('os');
    const exeDir = path.dirname(process.execPath);
    const userConfigDir = path.join(os.homedir(), '.cinema-manager');

    const candidatePaths = [
      configPath,
      path.join(exeDir, 'service.json'),
      path.join(exeDir, 'config', 'service.json'),
      path.join(process.cwd(), 'service.json'),
      path.join(process.cwd(), 'config', 'service.json'),
      path.join(userConfigDir, 'service.json'),
    ].filter(Boolean) as string[];

    let finalConfigPath = candidatePaths.find((p) => fs.existsSync(p));

    if (!finalConfigPath) {
      finalConfigPath = path.join(userConfigDir, 'service.json');
      try {
        this.createDefaultConfig(finalConfigPath);
      } catch (err) {
        console.warn('Could not write default config file:', err);
      }
    }

    try {
      let configData: any = {};
      if (finalConfigPath && fs.existsSync(finalConfigPath)) {
        try {
          configData = fs.readJsonSync(finalConfigPath);
        } catch {
          configData = {};
        }
      }
      
      // Override with environment variables
      this.config = {
        api: {
          baseUrl: process.env.API_BASE_URL || configData.api?.baseUrl || 'https://api.abhijeetkharkar.com/cinema-manager',
          timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
          retryCount: parseInt(process.env.API_RETRY_COUNT || '3', 10),
        },
        agent: {
          id: process.env.AGENT_ID || (configData.agent?.id && configData.agent.id.trim()) || this.generateAgentId(),
          name: process.env.AGENT_NAME || (configData.agent?.name && configData.agent.name.trim()) || `Cinema Agent - ${os.hostname()}`,
          watchPaths: Array.isArray(configData.agent?.watchPaths) ? configData.agent.watchPaths : [],
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load configuration: ${errorMessage}`);
    }
  }

  private createDefaultConfig(configPath: string): void {
    const defaultConfig = {
      api: {
        baseUrl: 'https://api.abhijeetkharkar.com/cinema-manager',
        timeout: 30000,
        retryCount: 3,
      },
    };

    // Ensure config directory exists
    const configDir = path.dirname(configPath);
    fs.ensureDirSync(configDir);

    // Write clean default configuration
    fs.writeJsonSync(configPath, defaultConfig, { spaces: 2 });
  }

  private generateAgentId(): string {
    const crypto = require('crypto');
    const os = require('os');
    
    // Generate agent ID based on machine characteristics
    const machineId = os.hostname() + os.platform() + os.arch();
    return crypto.createHash('md5').update(machineId).digest('hex').substring(0, 16);
  }
}