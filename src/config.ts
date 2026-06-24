import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { jwtDecode } from 'jwt-decode';

export interface Config {
  apiKey?: string;
  refreshToken?: string;
  apiUrl?: string;
  userId?: string;
  email?: string;
  expiresAt?: number;
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

  public get(key: keyof Config): string | number | undefined {
    const config = this.load();
    return config[key];
  }

  public set(key: keyof Config, value: string | number): void {
    const config = this.load();
    config[key] = value as any;
    this.save(config);
  }

  public clear(): void {
    if (fs.existsSync(this.configPath)) {
      fs.unlinkSync(this.configPath);
    }
  }

  public isAuthenticated(): boolean {
    const config = this.load();
    if (!config.apiKey) {
      return false;
    }
    
    // Check if token is expired
    if (config.expiresAt && config.expiresAt < Date.now()) {
      return false;
    }
    
    return true;
  }

  public async ensureAuthenticated(forceRefresh: boolean = false, spinner?: any): Promise<string> {
    if (!forceRefresh && this.isAuthenticated()) {
      const token = this.get('apiKey');
      if (token && typeof token === 'string') {
        return token;
      }
    }

    // Try auto-refresh with saved credentials
    const config = this.load();
    const username = config.userId;
    let password = process.env.SHANTA_AI_PASSWORD;

    // If we have username but no password, prompt for it
    if (username && !password) {
      // Stop spinner if provided to allow interactive input
      if (spinner) {
        spinner.stop();
      }
      
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      password = await new Promise<string>((resolve) => {
        rl.question(`Enter password for ${username}: `, (answer) => {
          rl.close();
          resolve(answer);
        });
      });

      if (!password) {
        throw new Error('Password is required for re-authentication.');
      }
    }

    if (!username || !password) {
      throw new Error('Not authenticated. Please run "shanta-ai auth" first or set SHANTA_AI_PASSWORD environment variable.');
    }

    // Re-authenticate silently
    const { AuthService } = await import('./services/authService');
    const authService = new AuthService();
    
    try {
      const result = await authService.login({ accountCode: username, password }, true);
      
      // Decode JWT to get expiry time
      const expiresAt = this.decodeTokenExpiry(result.accessToken);
      
      // Save new tokens
      this.set('apiKey', result.accessToken);
      if (result.refreshToken) {
        this.set('refreshToken', result.refreshToken);
      }
      if (expiresAt) {
        this.set('expiresAt', expiresAt);
      }
      
      // Restart spinner if it was stopped
      if (spinner) {
        spinner.start();
      }
      
      return result.accessToken;
    } catch (error) {
      throw new Error('Auto-refresh failed. Please run "shanta-ai auth" again.');
    }
  }

  private decodeTokenExpiry(token: string): number | null {
    try {
      const decoded: any = jwtDecode(token);
      if (decoded.exp) {
        return decoded.exp * 1000; // Convert to milliseconds
      }
    } catch (error) {
      // Silent fail
    }
    return null;
  }
}
