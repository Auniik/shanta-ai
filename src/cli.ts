#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand, whoamiCommand, logoutCommand } from './commands/auth';
import { portfolioCommand } from './commands/portfolio';
import { portfolioChartCommand } from './commands/portfolio-chart';

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
  .option('-u, --username <username>', 'Account code')
  .option('-p, --password <password>', 'Password')
  .action(async (apiKey, options) => {
    await authCommand(apiKey, options);
  });

// Whoami command
program
  .command('whoami')
  .description('Display current authentication information')
  .option('-v, --verbose', 'Show detailed profile information')
  .action(async (options) => {
    await whoamiCommand(options.verbose);
  });

// Portfolio command
program
  .command('portfolio')
  .description('Display portfolio information')
  .option('--json', 'Output as JSON')
  .option('--toon', 'Output as toon encoded format')
  .option('--markdown', 'Output as markdown')
  .action(async (options) => {
    await portfolioCommand(options);
  });

// Portfolio trend command
program
  .command('portfolio-trend')
  .description('Display portfolio trend chart')
  .argument('[period]', 'Time period: 1M, 3M, 6M, 1y, Max (default: 1M)', '1M')
  .option('--json', 'Output as JSON')
  .option('--toon', 'Output as toon encoded format')
  .option('--markdown', 'Output as markdown')
  .action(async (period, options) => {
    await portfolioChartCommand(period, options);
  });

// Logout command
program
  .command('logout')
  .description('Remove authentication credentials')
  .action(async () => {
    await logoutCommand();
  });

program.parse(process.argv);
