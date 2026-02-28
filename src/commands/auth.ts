import * as readline from 'readline';
import { ConfigManager } from '../config';
import { AuthService } from '../services/authService';
import { printProfile } from '../views/profile';

export async function authCommand(apiKey?: string): Promise<void> {
  const config = new ConfigManager();

  if (apiKey) {
    // Manual token provided
    config.set('apiKey', apiKey.trim());
    console.log('✓ Authentication successful!');
    console.log('Your token has been saved to ~/.shanta-ai/config.json');
    return;
  }

  // Use API-based authentication
  console.log('🔐 Starting authentication...\n');
  
  const accountCode = await promptForInput('Enter your account code: ');
  const password = await promptForPassword('Enter your password: ');

  if (!accountCode || !password) {
    console.error('Error: Account code and password are required');
    process.exit(1);
  }

  try {
    const authService = new AuthService();
    const result = await authService.login({ accountCode, password });

    // Save the tokens
    config.set('apiKey', result.accessToken);
    if (result.refreshToken) {
      config.set('refreshToken', result.refreshToken);
    }
    config.set('userId', accountCode);

    console.log('\n✓ Authentication successful!');
    console.log('Your tokens have been saved to ~/.shanta-ai/config.json');
  } catch (error) {
    console.error('\n❌ Authentication failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

export async function whoamiCommand(verbose: boolean = false): Promise<void> {
  const config = new ConfigManager();

  if (!config.isAuthenticated()) {
    console.error('Error: Not authenticated. Please run "shanta-ai auth" first.');
    process.exit(1);
  }

  const token = config.get('apiKey');
  if (!token) {
    console.error('Error: No token found. Please run "shanta-ai auth" first.');
    process.exit(1);
  }

  try {
    console.log('🔍 Fetching profile information...\n');
    
    const authService = new AuthService();
    const profile = await authService.getUserProfile(token);

    printProfile(profile, verbose);

  } catch (error) {
    console.error('❌ Failed to fetch profile:', error instanceof Error ? error.message : error);
    console.log('\nYour token may have expired. Please run "shanta-ai auth" to re-authenticate.');
    process.exit(1);
  }
}

export async function logoutCommand(): Promise<void> {
  const config = new ConfigManager();

  if (!config.isAuthenticated()) {
    console.log('You are not logged in.');
    return;
  }

  config.clear();
  console.log('✓ Successfully logged out!');
}

function promptForInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptForPassword(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}
