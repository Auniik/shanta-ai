#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand, whoamiCommand, logoutCommand } from './commands/auth';
import { portfolioCommand } from './commands/portfolio';
import { portfolioChartCommand } from './commands/portfolio-chart';
import {
  tradeAuthCommand,
  tradeBalanceCommand,
  tradeOrdersCommand,
  tradeBuyCommand,
  tradeSellCommand,
  tradeCancelCommand,
  tradeHoldingsCommand,
  tradeSummaryCommand,
} from './commands/trade';

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

// Trade command group (EasyTrade OMS integration)
const trade = program
  .command('trade')
  .description(
    'DSE/CSE order management via EasyTrade OMS (DirectFN WebSocket). ' +
    'Run "trade auth" once to save credentials. All read commands support --json for structured output.'
  );

trade
  .command('auth')
  .description(
    'Save EasyTrade OMS credentials to ~/.shanta-ai/easytrade.json. ' +
    'Required once before all other trade commands. Credentials are separate from shantaeasyx login.'
  )
  .option('-u, --username <username>', 'EasyTrade username (e.g. D00211)')
  .option('-p, --password <password>', 'EasyTrade password')
  .action(async (options) => {
    await tradeAuthCommand(options);
  });

trade
  .command('balance')
  .description(
    'Cash balance, buying power, and per-exchange (DSE/CSE) breakdown. ' +
    '--json fields: cash_balance, buying_power, od_limit, open_buy_block, net_receivable, ' +
    'pending_payment (T+1 settlement due), cash_for_withdrawal, dse.settling_qty, dse.today_bought_qty.'
  )
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await tradeBalanceCommand(options);
  });

trade
  .command('orders')
  .description(
    'All of today\'s orders across DSE and CSE with full status history. ' +
    '--json fields per order: order_id, symbol, side (BUY/SELL), qty, filled_qty, price, ' +
    'status (pending|partial|filled|cancelled|modified|rejected|expired), time.'
  )
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await tradeOrdersCommand(options);
  });

trade
  .command('buy <symbol>')
  .description(
    'Place a limit or market buy order on DSE. Symbol is the DSE ticker (e.g. CITYBANK, BRACBANK). ' +
    'Default is limit order at --price. Use --market for market order (price=0). ' +
    'Check buying_power from "trade balance --json" before placing.'
  )
  .requiredOption('-q, --qty <quantity>', 'Number of shares to buy')
  .option('-p, --price <price>', 'Limit price per share in BDT', '0')
  .option('--market', 'Place a market order instead of limit')
  .option('--account <accId>', 'Trading account ID (default: DSE account)')
  .option('--json', 'Output order response as JSON')
  .action(async (symbol, options) => {
    await tradeBuyCommand(symbol, options);
  });

trade
  .command('sell <symbol>')
  .description(
    'Place a limit or market sell order on DSE. ' +
    'Only qty.sellable shares can be sold; qty.unsettled_t1 shares are T+1 and cannot be sold until tomorrow. ' +
    'Check qty.sellable from "trade holdings --json" before placing.'
  )
  .requiredOption('-q, --qty <quantity>', 'Number of shares to sell')
  .option('-p, --price <price>', 'Limit price per share in BDT', '0')
  .option('--market', 'Place a market order instead of limit')
  .option('--account <accId>', 'Trading account ID (default: DSE account)')
  .option('--json', 'Output order response as JSON')
  .action(async (symbol, options) => {
    await tradeSellCommand(symbol, options);
  });

trade
  .command('cancel')
  .description(
    'Cancel a pending or partially filled order. ' +
    'Get order_id from "trade orders --json" (orders with status: pending or partial). ' +
    'Filled or cancelled orders cannot be cancelled.'
  )
  .requiredOption('--order-id <id>', 'Order ID (order_id from trade orders --json)')
  .option('--account <accId>', 'Trading account ID (default: DSE account)')
  .option('--json', 'Output cancellation response as JSON')
  .action(async (options) => {
    await tradeCancelCommand(options);
  });

trade
  .command('holdings')
  .description(
    'All current positions with settlement breakdown and P&L. ' +
    '--json fields per position: symbol, exchange, qty.total/settled/unsettled_t1/sellable/pending_sell/pending_buy/pledged, ' +
    'price.avg_buy/avg_cost_with_fees/market, value.cost_basis/market_value/unrealized_pnl/unrealized_pnl_pct/realized_pnl. ' +
    'DSE T+1: shares bought today settle tomorrow and are not sellable until then.'
  )
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await tradeHoldingsCommand(options);
  });

trade
  .command('summary')
  .description(
    'Complete account snapshot in one call — preferred for AI agents needing full context. ' +
    '--json is a superset of balance + holdings + orders combined. ' +
    'Top-level keys: account, cash (with dse/cse breakdowns), portfolio (aggregated P&L), holdings (per-position), orders (counts + list).'
  )
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    await tradeSummaryCommand(options);
  });

program.parse(process.argv);
