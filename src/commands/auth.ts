import * as readline from 'readline';
import { ConfigManager } from '../config';
import { AuthService } from '../services/authService';
import { printProfile } from '../views/profile';
import { jwtDecode } from 'jwt-decode';
import { authenticatedApiCall } from '../utils/apiWrapper';
import ora from 'ora';

function decodeTokenExpiry(token: string): number | null {
  try {
    const decoded: any = jwtDecode(token);
    if (decoded.exp) {
      return decoded.exp * 1000; // Convert to milliseconds
    }
  } catch (error) {
    console.error('Warning: Failed to decode token expiry');
  }
  return null;
}

export async function authCommand(apiKey?: string, options?: { username?: string; password?: string }): Promise<void> {
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
  
  const accountCode = options?.username || await promptForInput('Enter your account code: ');
  const password = options?.password || await promptForPassword('Enter your password: ');

  if (!accountCode || !password) {
    console.error('Error: Account code and password are required');
    process.exit(1);
  }

  try {
    const authService = new AuthService();
    const result = await authService.login({ accountCode, password });

    // Decode JWT to get expiry time
    const expiresAt = decodeTokenExpiry(result.accessToken);

    // Save the tokens and expiry
    config.set('apiKey', result.accessToken);
    if (result.refreshToken) {
      config.set('refreshToken', result.refreshToken);
    }
    if (expiresAt) {
      config.set('expiresAt', String(expiresAt));
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
  const spinner = ora('Fetching profile information...').start();
  try {
    const authService = new AuthService();
    
    const profile = await authenticatedApiCall((token: string) => 
      authService.getUserProfile(token)
    );

    spinner.stop();

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
