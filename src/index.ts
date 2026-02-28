import { ConfigManager } from './config';

export class ShantaAI {
  private config: ConfigManager;

  constructor() {
    this.config = new ConfigManager();
  }

  async process(input: string): Promise<string> {
    if (!this.config.isAuthenticated()) {
      throw new Error('Not authenticated. Please run "shanta-ai auth" first.');
    }
    
    // Implementation here
    return `Processed: ${input}`;
  }

  isAuthenticated(): boolean {
    return this.config.isAuthenticated();
  }
}

export { ConfigManager } from './config';
export default ShantaAI;
