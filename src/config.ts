import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  apiKey?: string;
  refreshToken?: string;
  apiUrl?: string;
  userId?: string;
  email?: string;
}

export class ConfigManager {
  private configDir: string;
  private configPath: string;

  constructor() {
    this.configDir = path.join(os.homedir(), '.shanta-ai');
    this.configPath = path.join(this.configDir, 'config.json');
    this.ensureConfigDir();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  public load(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    return {};
  }

  public save(config: Config): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }

  public get(key: keyof Config): string | undefined {
    const config = this.load();
    return config[key];
  }

  public set(key: keyof Config, value: string): void {
    const config = this.load();
    config[key] = value;
    this.save(config);
  }

  public clear(): void {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }
  }

  public isAuthenticated(): boolean {
    const config = this.load();
    return !!config.apiKey;
  }
}
