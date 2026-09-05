import * as path from 'path';
import * as fs from 'fs-extra';

export interface ServiceConfig {
  auth0: {
    domain: string;
    clientId: string;
    clientSecret: string;
    audience: string;
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
    const defaultConfigPath = path.join(process.cwd(), 'config', 'service.json');
    const finalConfigPath = configPath || defaultConfigPath;
    
    if (!fs.existsSync(finalConfigPath)) {
      // Create default configuration if it doesn't exist
      this.createDefaultConfig(finalConfigPath);
    }

    try {
      const configData = fs.readJsonSync(finalConfigPath);
      
      // Override with environment variables
      this.config = {
        ...configData,
        auth0: {
          ...configData.auth0,
          domain: process.env.AUTH0_DOMAIN || configData.auth0?.domain,
          clientId: process.env.AUTH0_M2M_CLIENT_ID || configData.auth0?.clientId,
          clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET || configData.auth0?.clientSecret,
          audience: process.env.AUTH0_AUDIENCE || configData.auth0?.audience
        },
        api: {
          ...configData.api,
          baseUrl: process.env.API_BASE_URL || configData.api?.baseUrl || 'https://api.abhijeetkharkar.com/cinema-manager',
          timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
          retryCount: parseInt(process.env.API_RETRY_COUNT || '3', 10)
        },
        agent: {
          ...configData.agent,
          id: process.env.AGENT_ID || configData.agent?.id || this.generateAgentId(),
          name: process.env.AGENT_NAME || configData.agent?.name || `Cinema Agent - ${require('os').hostname()}`
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load configuration: ${errorMessage}`);
    }
  }

  private createDefaultConfig(configPath: string): void {
    const defaultConfig: ServiceConfig = {
      auth0: {
        domain: 'your-domain.auth0.com',
        clientId: 'your-m2m-client-id',
        clientSecret: 'your-m2m-client-secret',
        audience: 'https://api.abhijeetkharkar.com/cinema-manager'
      },
      api: {
        baseUrl: 'https://api.abhijeetkharkar.com/cinema-manager',
        timeout: 30000,
        retryCount: 3
      },
      agent: {
        id: this.generateAgentId(),
        name: `Cinema Agent - ${require('os').hostname()}`,
        watchPaths: [
          'C:\\Users\\Public\\Videos',
          `C:\\Users\\${process.env.USERNAME || 'DefaultUser'}\\Downloads`,
          `C:\\Users\\${process.env.USERNAME || 'DefaultUser'}\\Videos`
        ]
      }
    };

    // Ensure config directory exists
    const configDir = path.dirname(configPath);
    fs.ensureDirSync(configDir);
    
    // Write default configuration
    fs.writeJsonSync(configPath, defaultConfig, { spaces: 2 });
    
    console.log(`Created default configuration file: ${configPath}`);
    console.log('Please update the Auth0 credentials in the configuration file.');
  }

  private generateAgentId(): string {
    const crypto = require('crypto');
    const os = require('os');
    
    // Generate agent ID based on machine characteristics
    const machineId = os.hostname() + os.platform() + os.arch();
    return crypto.createHash('md5').update(machineId).digest('hex').substring(0, 16);
  }
}