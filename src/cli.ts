#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand, whoamiCommand, logoutCommand } from './commands/auth';

const pkg = require('../package.json');

const program = new Command();

program
  .name('shanta-ai')
  .description('AI Assistant CLI')
  .version(pkg.version);

// Auth command
program
  .command('auth')
  .description('Authenticate with your API key')
  .argument('[apiKey]', 'API key (optional, will prompt if not provided)')
  .action(async (apiKey) => {
    await authCommand(apiKey);
  });

// Whoami command
program
  .command('whoami')
  .description('Display current authentication information')
  .option('-v, --verbose', 'Show detailed profile information')
  .action(async (options) => {
    await whoamiCommand(options.verbose);
  });

// Logout command
program
  .command('logout')
  .description('Remove authentication credentials')
  .action(async () => {
    await logoutCommand();
  });

program.parse(process.argv);
