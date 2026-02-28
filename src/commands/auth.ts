import * as readline from 'readline';
import { ConfigManager } from '../config';
import { AuthService } from '../services/authService';

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

    if (verbose) {
      // Verbose output with all details
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║               DETAILED PROFILE INFORMATION                 ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Name:           ${formatField(profile.surname || 'N/A')}`);
      console.log(`║ Account Code:   ${formatField(profile.accountCode || 'N/A')}`);
      console.log(`║ Email:          ${formatField(profile.email || 'N/A')}`);
      console.log(`║ Phone:          ${formatField(profile.phone || 'N/A')}`);
      console.log(`║ BO ID:          ${formatField(profile.boId || 'N/A')}`);
      console.log(`║ National ID:    ${formatField(profile.nationalId || 'N/A')}`);
      console.log(`║ Tax ID:         ${formatField(profile.taxId || 'N/A')}`);
      console.log(`║ Customer Type:  ${formatField(profile.customerType || 'N/A')}`);
      console.log(`║ Role:           ${formatField(profile.role?.name || 'N/A')}`);
      console.log(`║ Role Created:   ${formatField(profile.role?.createdAt ? new Date(profile.role.createdAt).toLocaleDateString() : 'N/A')}`);
      console.log(`║ Cash Balance:   ${formatField(`৳ ${profile.cash?.toFixed(2) || '0.00'}`)}`);
      console.log(`║ Status:         ${formatField(profile.isActive ? '✓ Active' : '✗ Inactive')}`);
      
      const address = profile.address || {};
      const addressLine = address.address1 || 'N/A';
      console.log('╠════════════════════════════════════════════════════════════╣');
      // Wrap long address if needed
      if (addressLine.length > 42) {
        const lines = wrapText(addressLine, 42);
        lines.forEach((line, index) => {
          if (index === 0) {
            console.log(`║ Address:        ${formatField(line)}`);
          } else {
            console.log(`║                 ${formatField(line)}`);
          }
        });
      } else {
        console.log(`║ Address:        ${formatField(addressLine)}`);
      }
      
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log('║                      BANK DETAILS                          ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      
      const bank = profile.bank || {};
      console.log(`║ Bank Name:      ${formatField(bank.name || 'N/A')}`);
      console.log(`║ Branch:         ${formatField(bank.branchName || 'N/A')}`);
      console.log(`║ Account No:     ${formatField(bank.accountNumber || 'N/A')}`);
      console.log(`║ Routing No:     ${formatField(bank.routingNumber || 'N/A')}`);
      console.log('╚════════════════════════════════════════════════════════════╝');
    } else {
      // Standard output
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                    PROFILE INFORMATION                     ║');
      console.log('╠════════════════════════════════════════════════════════════╣');
      console.log(`║ Name:           ${formatField(profile.surname || 'N/A')}`);
      console.log(`║ Account Code:   ${formatField(profile.accountCode || 'N/A')}`);
      console.log(`║ Email:          ${formatField(profile.email || 'N/A')}`);
      console.log(`║ Phone:          ${formatField(profile.phone || 'N/A')}`);
      console.log(`║ BO ID:          ${formatField(profile.boId || 'N/A')}`);
      console.log(`║ Customer Type:  ${formatField(profile.customerType || 'N/A')}`);
      console.log(`║ Role:           ${formatField(profile.role?.name || 'N/A')}`);
      console.log(`║ Cash Balance:   ${formatField(`৳ ${profile.cash?.toFixed(2) || '0.00'}`)}`);
      console.log(`║ Status:         ${formatField(profile.isActive ? '✓ Active' : '✗ Inactive')}`);
      console.log('╚════════════════════════════════════════════════════════════╝');
    }
    
    console.log('');

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

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '****';
  }
  return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
}

function formatField(value: string, width: number = 42): string {
  const padding = ' '.repeat(Math.max(0, width - value.length));
  return `${value}${padding} ║`;
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
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
