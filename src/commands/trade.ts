import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { EasyTradeService, loadEasyTradeCreds, saveEasyTradeCreds } from '../services/easyTradeService';

// ── Shared service instance ────────────────────────────────────────────────────
let _svc: EasyTradeService | null = null;

async function getConnectedService(username?: string, password?: string): Promise<EasyTradeService> {
  const creds = (username && password)
    ? { username, password }
    : loadEasyTradeCreds();

  if (!creds) {
    throw new Error('No EasyTrade credentials found. Run: shanta-ai trade auth');
  }

  const svc = new EasyTradeService();
  await svc.login(creds.username, creds.password);
  _svc = svc;
  return svc;
}

function formatCurrency(n: number | string | undefined): string {
  if (n === undefined || n === null || n === '') return chalk.gray('—');
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return chalk.gray(String(n));
  return num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Symbol / board / instrument helpers (order generalization) ───────────────────
// Instrument-type codes decoded from the EasyTrade app bundle (instrumentType_N).
const INSTRUMENT_CODES: Record<string, string> = {
  equity: '0', stock: '0', share: '0', shares: '0',
  fund: '2', mutualfund: '2', mf: '2',
  option: '10', options: '10',
  trust: '65',
  right: '66', rights: '66',
  bond: '75',
  etf: '86', etfs: '86',
};

// undefined → let the service default to '0' (Equity).
function resolveInstrument(name?: string): string | undefined {
  if (!name) return undefined;
  const code = INSTRUMENT_CODES[name.toLowerCase().replace(/[^a-z]/g, '')];
  if (!code) throw new Error(`Unknown instrument "${name}". Valid: equity, fund, option, trust, rights, bond, etf`);
  return code;
}

// Accepts "SYMBOL", "SYMBOL`BOARD" or "SYMBOL:BOARD", plus an optional --board override.
function splitSymbolBoard(input: string, boardOpt?: string): { ticker: string; board?: string } {
  const s = input.toUpperCase().trim();
  const m = s.match(/^([^`:]+)[`:](.+)$/);
  if (m) return { ticker: m[1], board: (boardOpt ?? m[2]).toUpperCase() };
  return { ticker: s, board: boardOpt?.toUpperCase() };
}

// Board-qualified symbol for the OMS; left bare when no board (service defaults to `PB).
function buildOmsSymbol(ticker: string, board?: string): string {
  return board ? `${ticker}\`${board}` : ticker;
}

// For sells, when no board is given, reuse the exact board the position is held on
// (holdings symbols are board-qualified, e.g. "CITYBANK`PB") so any board works.
async function resolveSellSymbol(
  svc: EasyTradeService, tradingAccId: string, ticker: string, board?: string
): Promise<string> {
  if (board) return buildOmsSymbol(ticker, board);
  const resp = await svc.getHoldings(tradingAccId);
  const holdings = resp?.DAT?.holdings ?? [];
  const held = holdings.find((h: any) => cleanSymbol(h.symbol ?? '') === ticker);
  return held?.symbol ?? buildOmsSymbol(ticker, undefined);
}

// ── trade auth ─────────────────────────────────────────────────────────────────
export async function tradeAuthCommand(options: { username?: string; password?: string }): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise(res => rl.question(q, res));

  try {
    const username = options.username ?? await ask('EasyTrade username: ');
    const password = options.password ?? await (async () => {
      process.stdout.write('EasyTrade password: ');
      // Disable echo for password
      if (process.stdin.isTTY) (process.stdin as any).setRawMode?.(true);
      const pwd = await ask('');
      if (process.stdin.isTTY) (process.stdin as any).setRawMode?.(false);
      process.stdout.write('\n');
      return pwd;
    })();

    rl.close();

    const spinner = ora('Connecting to EasyTrade OMS...').start();
    try {
      const svc = new EasyTradeService();
      const session = await svc.login(username.trim(), password.trim());
      svc.logout();

      saveEasyTradeCreds({ username: username.trim(), password: password.trim() });

      spinner.succeed(`Logged in as ${chalk.green(session.displayName)}`);
      console.log(`  Customer ID : ${session.customerId}`);
      if (session.tradingAccounts.length > 0) {
        console.log('  Accounts:');
        for (const acc of session.tradingAccounts) {
          console.log(`    ${chalk.cyan(acc.tradingAccId)} — ${acc.exchg} (cash: ${acc.cashAccId})`);
        }
      }
    } catch (err: any) {
      spinner.fail(`Login failed: ${err.message}`);
      process.exit(1);
    }
  } catch (err: any) {
    rl.close();
    console.error(chalk.red('Error:'), err.message);
    process.exit(1);
  }
}

// ── trade balance ──────────────────────────────────────────────────────────────
export async function tradeBalanceCommand(options: { json?: boolean }): Promise<void> {
  const spinner = ora('Fetching account balance...').start();
  try {
    const svc = await getConnectedService();
    const session = svc.getSession()!;

    const results: any[] = [];
    // Only need one account — both share the same cash account
    const acc = session.tradingAccounts.find(a => a.exchg === 'DSE') ?? session.tradingAccounts[0];
    if (acc) {
      const resp = await svc.getBuyingPower(acc.tradingAccId, acc.cashAccId);
      results.push({ account: acc, data: resp?.DAT });
    }

    svc.logout();
    spinner.stop();

    if (options.json) {
      const first = results[0];
      const d = first?.data ?? {};
      const shaped = {
        currency:              d.curr ?? 'BDT',
        cash_balance:          d.balance ?? d.cashAmt ?? 0,
        buying_power:          d.buyPwr ?? 0,
        od_limit:              d.odLmt ?? 0,
        open_buy_block:        d.openBuyBlock ?? 0,
        blocked_amount:        d.blkAmt ?? 0,
        cash_for_withdrawal:   d.cashForWith ?? 0,
        net_receivable:        d.netReceivable ?? 0,
        portfolio_value:       d.pvIncPld ?? d.pvExcPld ?? 0,
        pending_payment:       d.payAmt ?? 0,
        dse: {
          buying_power:        d.buyPwrDSE ?? 0,
          pending_payment:     d.payAmtDSE ?? 0,
          settling_qty:        d.totalRecQtyDSE ?? 0,
          today_bought_qty:    d.dailyTotalBuyDSE ?? 0,
          today_sold_qty:      d.dailyTotalSellDSE ?? 0,
          pending_buy_qty:     d.totalPendBuyDSE ?? 0,
          pending_sell_qty:    d.totalPendSellDSE ?? 0,
        },
        cse: {
          buying_power:        d.buyPwrCSE ?? 0,
          pending_payment:     d.payAmtCSE ?? 0,
          settling_qty:        d.totalRecQtyCSE ?? 0,
          today_bought_qty:    d.dailyTotalBuyCSE ?? 0,
          today_sold_qty:      d.dailyTotalSellCSE ?? 0,
          pending_buy_qty:     d.totalPendBuyCSE ?? 0,
          pending_sell_qty:    d.totalPendSellCSE ?? 0,
        },
        accounts: results.map(r => ({
          trading_account_id: r.account.tradingAccId,
          cash_account_id:    r.account.cashAccId,
          exchange:           r.account.exchg,
          description:        r.account.description,
        })),
      };
      console.log(JSON.stringify(shaped, null, 2));
      return;
    }

    // Both accounts share the same cash account — only show cash summary once
    const first = results[0];
    if (first?.data) {
      const d = first.data;
      console.log('');
      console.log(`  Cash Balance   : ${chalk.green(formatCurrency(d.balance ?? d.cashAmt))} BDT`);
      console.log(`  Buying Power   : ${chalk.green(formatCurrency(d.buyPwr))} BDT`);
      console.log(`  Portfolio Value: ${chalk.cyan(formatCurrency(d.pvIncPld ?? d.pvExcPld))} BDT`);
      if (d.payAmt) console.log(`  Pending Pay    : ${formatCurrency(d.payAmt)} BDT`);
      if (d.odLmt) console.log(`  OD Limit       : ${formatCurrency(d.odLmt)} BDT`);
    } else {
      console.log(chalk.gray('No balance data'));
    }
  } catch (err: any) {
    spinner.fail(err.message);
    _svc?.logout();
    process.exit(1);
  }
}

// FIX protocol + DirectFN status code mapping
function formatOrderStatus(sts: string | number | undefined): string {
  const s = String(sts ?? '');
  const map: Record<string, [string, (t: string) => string]> = {
    '0': ['Pending',   chalk.yellow],
    '1': ['Partial',   chalk.yellow],
    '2': ['Filled',    chalk.green],
    '3': ['Done/Day',  chalk.gray],
    '4': ['Cancelled', chalk.gray],
    '5': ['Replaced',  chalk.blue],
    '6': ['Pnd Cancel',chalk.yellow],
    '7': ['Stopped',   chalk.gray],
    '8': ['Rejected',  chalk.red],
    '9': ['Suspended', chalk.gray],
    'A': ['Pnd New',   chalk.yellow],
    'C': ['Expired',   chalk.gray],
    'm': ['Modified',  chalk.blue],
    'X': ['Cancelled', chalk.gray],
  };
  const [label, color] = map[s] ?? [s, chalk.white];
  return color(label);
}

function parseOrderTime(t: string | null | undefined): string {
  if (!t || t.length < 14) return '—';
  // format: YYYYMMDDHHmmss
  return `${t.slice(6,8)}/${t.slice(4,6)} ${t.slice(8,10)}:${t.slice(10,12)}`;
}

function cleanSymbol(sym: string): string {
  // "BRACBANK`PB" → "BRACBANK"
  return sym.includes('`') ? sym.split('`')[0] : sym;
}

// ── trade orders ───────────────────────────────────────────────────────────────
export async function tradeOrdersCommand(options: { json?: boolean }): Promise<void> {
  const spinner = ora('Fetching orders...').start();
  try {
    const svc = await getConnectedService();
    const session = svc.getSession()!;

    // Query all accounts, combine results (orders usually on DSE account)
    const allOrders: any[] = [];
    for (const acc of session.tradingAccounts) {
      const resp = await svc.getOrderList(acc.tradingAccId);
      const lst = resp?.DAT?.ordLst ?? resp?.DAT?.orderList ?? [];
      if (Array.isArray(lst)) allOrders.push(...lst);
    }

    svc.logout();
    spinner.stop();

    // Deduplicate across accounts (same order returned by both DSE and CSE accounts)
    const seen = new Set<string>();
    const orders = allOrders.filter(o => {
      // Use compound key: clOrdId + ordSts so status history rows are preserved
      const k = `${o.clOrdId ?? o.ordNo}-${o.ordSts}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (options.json) {
      console.log(JSON.stringify(orders, null, 2));
      return;
    }

    if (orders.length === 0) {
      console.log(chalk.gray('No orders today.'));
      return;
    }

    // Don't pad colored strings — chalk ANSI codes break padEnd width calculation.
    // Instead: fixed-width plain columns, append colored status at end.
    console.log('\n' + chalk.bold(
      'Time'.padEnd(10) + '  ' + 'Symbol'.padEnd(13) + 'Side  ' +
      'Qty'.padStart(5) + '/Fill  ' + 'Price'.padStart(8) + '  Status'
    ));
    console.log('─'.repeat(65));

    for (const o of orders) {
      const isBuy = o.ordSide === 1 || o.ordSide === '1';
      const side = isBuy ? chalk.green('BUY ') : chalk.red('SELL');
      const sym = cleanSymbol(o.symbol ?? o.tradeSymbol ?? '').padEnd(13);
      const qty = String(o.ordQty ?? 0).padStart(5);
      const fill = String(o.cumQty ?? 0).padStart(4);
      const price = formatCurrency(o.price).padStart(8);
      const time = parseOrderTime(o.crdTime ?? o.lstUptdTme).padEnd(10);
      const status = formatOrderStatus(o.ordSts);

      console.log(`${time}  ${sym}${side}  ${qty}/${fill}  ${price}  ${status}`);
    }
  } catch (err: any) {
    spinner.fail(err.message);
    _svc?.logout();
    process.exit(1);
  }
}

// ── trade buy ──────────────────────────────────────────────────────────────────
export async function tradeBuyCommand(
  symbol: string,
  options: { qty: string; price: string; account?: string; market?: boolean; json?: boolean; board?: string; submarket?: string; instrument?: string }
): Promise<void> {
  const qty = parseInt(options.qty, 10);
  const price = parseFloat(options.price);

  if (!qty || qty <= 0) { console.error(chalk.red('Invalid quantity')); process.exit(1); }
  if (!options.market && (!price || price <= 0)) { console.error(chalk.red('Invalid price')); process.exit(1); }

  const { ticker, board } = splitSymbolBoard(symbol, options.board);
  const spinner = ora(`Placing BUY order: ${qty} × ${ticker} @ ${price}...`).start();
  try {
    const instruTyp = resolveInstrument(options.instrument);
    const svc = await getConnectedService();
    const session = svc.getSession()!;

    const acc = options.account
      ? session.tradingAccounts.find(a => a.tradingAccId === options.account)
      : session.tradingAccounts.find(a => a.exchg === 'DSE') ?? session.tradingAccounts[0];

    if (!acc) throw new Error(`Trading account not found: ${options.account ?? '(default)'}`);

    const resp = await svc.placeOrder({
      tradingAccId: acc.tradingAccId,
      symbol: buildOmsSymbol(ticker, board),
      exg: acc.exchg,
      side: 'BUY',
      type: options.market ? 'MARKET' : 'LIMIT',
      qty,
      price: options.market ? 0 : price,
      marketCode: options.submarket,
      instruTyp,
    });

    svc.logout();

    if (options.json) {
      spinner.stop();
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const dat = resp?.DAT;
    const ordNo = dat?.ordNo ?? dat?.clOrdId ?? 'pending';
    spinner.succeed(`BUY order placed — Order #${chalk.cyan(ordNo)}`);
    if (dat?.rejResn) console.log(chalk.red(`  Rejected: ${dat.rejResn}`));
  } catch (err: any) {
    spinner.fail(err.message);
    _svc?.logout();
    process.exit(1);
  }
}

// ── trade sell ─────────────────────────────────────────────────────────────────
export async function tradeSellCommand(
  symbol: string,
  options: { qty: string; price: string; account?: string; market?: boolean; json?: boolean; board?: string; submarket?: string; instrument?: string }
): Promise<void> {
  const qty = parseInt(options.qty, 10);
  const price = parseFloat(options.price);

  if (!qty || qty <= 0) { console.error(chalk.red('Invalid quantity')); process.exit(1); }
  if (!options.market && (!price || price <= 0)) { console.error(chalk.red('Invalid price')); process.exit(1); }

  const { ticker, board } = splitSymbolBoard(symbol, options.board);
  const spinner = ora(`Placing SELL order: ${qty} × ${ticker} @ ${price}...`).start();
  try {
    const instruTyp = resolveInstrument(options.instrument);
    const svc = await getConnectedService();
    const session = svc.getSession()!;

    const acc = options.account
      ? session.tradingAccounts.find(a => a.tradingAccId === options.account)
      : session.tradingAccounts.find(a => a.exchg === 'DSE') ?? session.tradingAccounts[0];

    if (!acc) throw new Error(`Trading account not found: ${options.account ?? '(default)'}`);

    const omsSymbol = await resolveSellSymbol(svc, acc.tradingAccId, ticker, board);
    const resp = await svc.placeOrder({
      tradingAccId: acc.tradingAccId,
      symbol: omsSymbol,
      exg: acc.exchg,
      side: 'SELL',
      type: options.market ? 'MARKET' : 'LIMIT',
      qty,
      price: options.market ? 0 : price,
      marketCode: options.submarket,
      instruTyp,
    });

    svc.logout();

    if (options.json) {
      spinner.stop();
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const dat = resp?.DAT;
    const ordNo = dat?.ordNo ?? dat?.clOrdId ?? 'pending';
    spinner.succeed(`SELL order placed — Order #${chalk.cyan(ordNo)}`);
    if (dat?.rejResn) console.log(chalk.red(`  Rejected: ${dat.rejResn}`));
  } catch (err: any) {
    spinner.fail(err.message);
    _svc?.logout();
    process.exit(1);
  }
}

// ── trade cancel ───────────────────────────────────────────────────────────────
export async function tradeCancelCommand(
  options: { orderId: string; account?: string; json?: boolean }
): Promise<void> {
  const spinner = ora(`Cancelling order #${options.orderId}...`).start();
  try {
    const svc = await getConnectedService();
    const session = svc.getSession()!;

    // First fetch order list to get full order details
    const acc = options.account
      ? session.tradingAccounts.find(a => a.tradingAccId === options.account)
      : session.tradingAccounts.find(a => a.exchg === 'DSE') ?? session.tradingAccounts[0];

    if (!acc) throw new Error('No trading account found');

    const ordersResp = await svc.getOrderList(acc.tradingAccId);
    const orders = ordersResp?.DAT?.ordLst ?? ordersResp?.DAT?.orderList ?? ordersResp?.DAT?.orders ?? [];
    const order = Array.isArray(orders)
      ? orders.find((o: any) => String(o.ordNo) === options.orderId || String(o.clOrdId) === options.orderId)
      : null;

    if (!order) {
      throw new Error(`Order ${options.orderId} not found in active orders`);
    }

    const resp = await svc.cancelOrder({
      tradingAccId: acc.tradingAccId,
      symbol: order.symbol,
      exg: order.exg ?? acc.exchg,
      ordNo: order.ordNo,
      clOrdId: order.clOrdId,
      orgClOrdId: order.orgClOrdId ?? order.clOrdId,
      ordTyp: order.ordTyp,
      ordSide: order.ordSide,
      tif: order.tif,
    });

    svc.logout();

    if (options.json) {
      spinner.stop();
      console.log(JSON.stringify(resp, null, 2));
      return;
    }

    const dat = resp?.DAT;
    if (dat?.rejResn) {
      spinner.fail(`Cancel rejected: ${dat.rejResn}`);
    } else {
      spinner.succeed(`Order #${chalk.cyan(options.orderId)} cancellation submitted`);
    }
  } catch (err: any) {
    spinner.fail(err.message);
    _svc?.logout();
    process.exit(1);
  }
}

// ── table helpers ──────────────────────────────────────────────────────────────
// Rule: pad the PLAIN string first, then wrap with chalk.
// chalk wraps add invisible escape codes — padding them gives wrong visual width.

function fmtN(n: number | null | undefined, dec = 2): string {
  if (n === undefined || n === null) return '—';
  return Math.abs(n).toLocaleString('en-BD', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// Fixed-width P&L: e.g. colPnl(-173.25, 12) → right-padded red "-173.25"
function colPnl(n: number, w: number): string {
  const s = ((n >= 0 ? '+' : '-') + fmtN(n)).padStart(w);
  return n > 0 ? chalk.green(s) : n < 0 ? chalk.red(s) : chalk.gray(s);
}

function colPct(pct: number, w: number): string {
  const s = ((pct >= 0 ? '+' : '') + pct.toFixed(2) + '%').padStart(w);
  return pct > 0 ? chalk.green(s) : pct < 0 ? chalk.red(s) : chalk.gray(s);
}

// Fixed-width quantity: green if >0, gray if 0
function colQty(n: number, w: number): string {
  const s = String(n).padStart(w);
  return n > 0 ? chalk.green(s) : chalk.gray(s);
}

// Fixed-width receivable: yellow if >0, spaces if 0
function colRec(n: number, w: number): string {
  if (n === 0) return ' '.repeat(w);
  return chalk.yellow(String(n).padStart(w));
}

export async function tradeHoldingsCommand(options: { json?: boolean }): Promise<void> {
  const spinner = ora('Fetching holdings...').start();
  try {
    const svc = await getConnectedService();
    const session = svc.getSession()!;

    const allHoldings: any[] = [];
    for (const acc of session.tradingAccounts) {
      const resp = await svc.getHoldings(acc.tradingAccId);
      const lst = resp?.DAT?.holdings ?? [];
      allHoldings.push(...lst);
    }

    svc.logout();
    spinner.stop();

    // Filter visible, non-zero positions; deduplicate by symbol
    const seen = new Set<string>();
    const positions = allHoldings.filter(h => {
      const sym = h.symbol ?? '';
      const total = (h.longHoldingQty ?? 0) + (h.recQty ?? 0);
      if (h.isDisply !== 1 || total === 0) return false;
      if (seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });

    if (options.json) {
      const shaped = positions.map(h => {
        const totalQty   = h.longHoldingQty ?? ((h.qty ?? 0) + (h.recQty ?? 0));
        const avgCost    = h.avgCst ?? h.avgPrice ?? 0;
        const mkt        = h.mktPri ?? 0;
        const sym        = h.symbol ?? '';
        const [ticker, board] = sym.includes('`') ? sym.split('`') : [sym, null];
        const costBasis  = parseFloat((avgCost * totalQty).toFixed(2));
        const mktValue   = parseFloat((mkt * totalQty).toFixed(2));
        const pnl        = parseFloat((mktValue - costBasis).toFixed(2));
        const pnlPct     = avgCost > 0 ? parseFloat(((mkt / avgCost - 1) * 100).toFixed(2)) : 0;
        return {
          symbol:   ticker,
          exchange: h.exg ?? 'DSE',
          board:    board ?? null,
          currency: h.curr ?? 'BDT',
          qty: {
            total:        totalQty,
            settled:      h.qty ?? 0,
            unsettled_t1: h.recQty ?? 0,
            sellable:     h.avaiQtyForSell ?? 0,
            pending_sell: h.pendSell ?? 0,
            pending_buy:  h.pendBuy ?? 0,
            pledged:      h.pldQty ?? 0,
          },
          price: {
            avg_buy:           parseFloat((h.avgPrice ?? 0).toFixed(4)),
            avg_cost_with_fees: parseFloat(avgCost.toFixed(4)),
            market:            parseFloat(mkt.toFixed(2)),
          },
          value: {
            cost_basis:          costBasis,
            market_value:        mktValue,
            unrealized_pnl:      pnl,
            unrealized_pnl_pct:  pnlPct,
            realized_pnl:        h.realizedGainLost ?? 0,
          },
        };
      });
      console.log(JSON.stringify(shaped, null, 2));
      return;
    }

    if (positions.length === 0) {
      console.log(chalk.gray('No holdings.'));
      return;
    }

    const hasRec = positions.some(h => (h.recQty ?? 0) > 0);

    // Column widths — must fit the widest value in each column, not just the header.
    // Total-row cost/market can be e.g. "127,342.47" = 10 chars, so avg/mkt need ≥ 11.
    const W = { sym: 12, settled: 8, rec: 8, sell: 9, avg: 11, mkt: 10, pnl: 12, pct: 9 };
    const S = '  '; // column separator
    const LINE = W.sym + W.settled + W.rec + W.sell + W.avg + W.mkt + W.pnl + W.pct + S.length * 7;

    const hdr = (s: string, w: number) => s.padStart(w);
    console.log('\n' + chalk.bold(
      'Symbol'.padEnd(W.sym) + S +
      hdr('Settled', W.settled) + S +
      hdr('T+1 Rec', W.rec) + S +
      hdr('Sellable', W.sell) + S +
      hdr('AvgCost', W.avg) + S +
      hdr('Market', W.mkt) + S +
      hdr('P&L', W.pnl) + S +
      hdr('%', W.pct)
    ));
    console.log('─'.repeat(LINE));

    let totalCost = 0, totalMktVal = 0;
    for (const h of positions) {
      const settled  = h.qty ?? 0;
      const rec      = h.recQty ?? 0;
      const sellable = h.avaiQtyForSell ?? h.avaiQty ?? settled;
      const pendSell = h.pendSell ?? 0;
      const totalQty = h.longHoldingQty ?? (settled + rec);
      const avgCst   = h.avgCst ?? h.avgPrice ?? 0;
      const mkt      = h.mktPri ?? 0;
      const pl       = (mkt - avgCst) * totalQty;
      const pct      = avgCst > 0 ? ((mkt / avgCst) - 1) * 100 : 0;

      totalCost   += avgCst * totalQty;
      totalMktVal += mkt * totalQty;

      // pendSell: if shares locked in sell orders, append as suffix to sell col
      const sellCore = colQty(sellable, pendSell > 0 ? W.sell - String(pendSell).length - 1 : W.sell);
      const sellCol  = pendSell > 0 ? sellCore + chalk.yellow(`-${pendSell}`) : sellCore;

      console.log(
        cleanSymbol(h.symbol ?? '').padEnd(W.sym) + S +
        String(settled).padStart(W.settled) + S +
        colRec(rec, W.rec) + S +
        sellCol + S +
        fmtN(avgCst).padStart(W.avg) + S +
        fmtN(mkt).padStart(W.mkt) + S +
        colPnl(pl, W.pnl) + S +
        colPct(pct, W.pct)
      );
    }

    console.log('─'.repeat(LINE));
    const totalPL  = totalMktVal - totalCost;
    const totalPct = totalCost > 0 ? ((totalMktVal / totalCost) - 1) * 100 : 0;
    console.log(
      'Total'.padEnd(W.sym) + S +
      ' '.repeat(W.settled) + S +
      ' '.repeat(W.rec) + S +
      ' '.repeat(W.sell) + S +
      fmtN(totalCost).padStart(W.avg) + S +
      fmtN(totalMktVal).padStart(W.mkt) + S +
      colPnl(totalPL, W.pnl) + S +
      colPct(totalPct, W.pct)
    );

    if (hasRec) {
      console.log(chalk.gray('\n  T+1 Rec = settling tomorrow  |  Sellable = can sell right now'));
    }
  } catch (err: any) {
    spinner.fail(err.message);
    _svc?.logout();
    process.exit(1);
  }
}

// ── trade summary ──────────────────────────────────────────────────────────────
export async function tradeSummaryCommand(options: { json?: boolean }): Promise<void> {
  const spinner = ora('Loading account summary...').start();
  try {
    const svc = await getConnectedService();
    const session = svc.getSession()!;

    // Fetch balance, holdings, orders in parallel
    const dseAcc = session.tradingAccounts.find(a => a.exchg === 'DSE') ?? session.tradingAccounts[0];
    if (!dseAcc) throw new Error('No trading account found');

    const [balResp, holdResp, ordResp] = await Promise.all([
      svc.getBuyingPower(dseAcc.tradingAccId, dseAcc.cashAccId),
      svc.getHoldings(dseAcc.tradingAccId),
      svc.getOrderList(dseAcc.tradingAccId),
    ]);

    svc.logout();
    spinner.stop();

    const bal = balResp?.DAT ?? {};
    const holdings = (holdResp?.DAT?.holdings ?? []).filter((h: any) =>
      h.isDisply === 1 && ((h.longHoldingQty ?? 0) > 0 || (h.recQty ?? 0) > 0)
    );
    const orders: any[] = ordResp?.DAT?.ordLst ?? [];

    // Order status counts
    const ordCounts: Record<string, number> = {};
    for (const o of orders) {
      const s = String(o.ordSts ?? '?');
      ordCounts[s] = (ordCounts[s] ?? 0) + 1;
    }
    const filledCount = ordCounts['2'] ?? 0;
    const cancelledCount = (ordCounts['4'] ?? 0) + (ordCounts['X'] ?? 0);
    const pendingCount = (ordCounts['0'] ?? 0) + (ordCounts['A'] ?? 0);
    const modifiedCount = ordCounts['m'] ?? 0;

    // Portfolio P&L
    let totalCost = 0, totalMktVal = 0;
    const settlingCount = holdings.filter((h: any) => (h.recQty ?? 0) > 0).length;
    for (const h of holdings) {
      const qty = h.longHoldingQty ?? ((h.qty ?? 0) + (h.recQty ?? 0));
      const avgCst = h.avgCst ?? h.avgPrice ?? 0;
      const mkt = h.mktPri ?? 0;
      totalCost += avgCst * qty;
      totalMktVal += mkt * qty;
    }
    const totalPL = totalMktVal - totalCost;
    const totalPct = totalCost > 0 ? ((totalMktVal / totalCost) - 1) * 100 : 0;

    if (options.json) {
      const shapedHoldings = holdings.map((h: any) => {
        const totalQty  = h.longHoldingQty ?? ((h.qty ?? 0) + (h.recQty ?? 0));
        const avgCost   = h.avgCst ?? h.avgPrice ?? 0;
        const mkt       = h.mktPri ?? 0;
        const sym       = h.symbol ?? '';
        const [ticker, board] = sym.includes('`') ? sym.split('`') : [sym, null];
        const costBasis = parseFloat((avgCost * totalQty).toFixed(2));
        const mktValue  = parseFloat((mkt * totalQty).toFixed(2));
        const pnl       = parseFloat((mktValue - costBasis).toFixed(2));
        const pnlPct    = avgCost > 0 ? parseFloat(((mkt / avgCost - 1) * 100).toFixed(2)) : 0;
        return {
          symbol: ticker, exchange: h.exg ?? 'DSE', board: board ?? null,
          qty: { total: totalQty, settled: h.qty ?? 0, unsettled_t1: h.recQty ?? 0, sellable: h.avaiQtyForSell ?? 0, pending_sell: h.pendSell ?? 0, pending_buy: h.pendBuy ?? 0, pledged: h.pldQty ?? 0 },
          price: { avg_buy: parseFloat((h.avgPrice ?? 0).toFixed(4)), avg_cost_with_fees: parseFloat(avgCost.toFixed(4)), market: parseFloat(mkt.toFixed(2)) },
          value: { cost_basis: costBasis, market_value: mktValue, unrealized_pnl: pnl, unrealized_pnl_pct: pnlPct, realized_pnl: h.realizedGainLost ?? 0 },
        };
      });

      const STATUS_LABEL: Record<string, string> = {
        '0': 'pending', 'A': 'pending_new', '1': 'partial', '2': 'filled',
        '4': 'cancelled', 'X': 'cancelled', 'm': 'modified', '8': 'rejected', 'C': 'expired',
      };
      const seenOrds = new Set<string>();
      const shapedOrders = orders
        .filter((o: any) => {
          const k = `${o.clOrdId}|${o.ordSts}`;
          if (seenOrds.has(k)) return false;
          seenOrds.add(k);
          return true;
        })
        .map((o: any) => ({
          order_id:    o.ordNo ?? o.clOrdId,
          symbol:      cleanSymbol(o.symbol ?? o.tradeSymbol ?? ''),
          side:        o.ordSide === '1' || o.ordSide === 1 ? 'BUY' : 'SELL',
          qty:         o.ordQty ?? 0,
          filled_qty:  o.cumQty ?? 0,
          price:       o.price ?? 0,
          status:      STATUS_LABEL[String(o.ordSts)] ?? String(o.ordSts),
          time:        parseOrderTime(o.crdTime ?? o.lstUptdTme),
        }));

      const shaped = {
        account: { name: session.displayName, login_id: session.loginId },
        cash: {
          currency:            bal.curr ?? 'BDT',
          cash_balance:        bal.balance ?? bal.cashAmt ?? 0,
          buying_power:        bal.buyPwr ?? 0,
          od_limit:            bal.odLmt ?? 0,
          open_buy_block:      bal.openBuyBlock ?? 0,
          blocked_amount:      bal.blkAmt ?? 0,
          cash_for_withdrawal: bal.cashForWith ?? 0,
          net_receivable:      bal.netReceivable ?? 0,
          pending_payment:     bal.payAmt ?? 0,
          dse: {
            buying_power:    bal.buyPwrDSE ?? 0,
            pending_payment: bal.payAmtDSE ?? 0,
            settling_qty:    bal.totalRecQtyDSE ?? 0,
            today_bought_qty: bal.dailyTotalBuyDSE ?? 0,
            today_sold_qty:  bal.dailyTotalSellDSE ?? 0,
            pending_buy_qty: bal.totalPendBuyDSE ?? 0,
            pending_sell_qty: bal.totalPendSellDSE ?? 0,
          },
          cse: {
            buying_power:    bal.buyPwrCSE ?? 0,
            pending_payment: bal.payAmtCSE ?? 0,
            settling_qty:    bal.totalRecQtyCSE ?? 0,
            today_bought_qty: bal.dailyTotalBuyCSE ?? 0,
            today_sold_qty:  bal.dailyTotalSellCSE ?? 0,
            pending_buy_qty: bal.totalPendBuyCSE ?? 0,
            pending_sell_qty: bal.totalPendSellCSE ?? 0,
          },
          accounts: session.tradingAccounts.map(a => ({
            trading_account_id: a.tradingAccId,
            cash_account_id:    a.cashAccId,
            exchange:           a.exchg,
          })),
        },
        portfolio: {
          market_value:       parseFloat(totalMktVal.toFixed(2)),
          cost_basis:         parseFloat(totalCost.toFixed(2)),
          unrealized_pnl:     parseFloat(totalPL.toFixed(2)),
          unrealized_pnl_pct: parseFloat(totalPct.toFixed(2)),
          position_count:     holdings.length,
          settling_tomorrow:  settlingCount,
        },
        holdings: shapedHoldings,
        orders: {
          total: shapedOrders.length,
          filled: filledCount,
          pending: pendingCount,
          cancelled: cancelledCount,
          modified: modifiedCount,
          list: shapedOrders,
        },
      };
      console.log(JSON.stringify(shaped, null, 2));
      return;
    }

    console.log('');
    console.log(chalk.bold(`${session.displayName}`) + chalk.gray(`  (${session.loginId})`));
    console.log('');

    // Cash
    console.log(chalk.bold('  Cash'));
    console.log(`    Balance      : ${chalk.green(formatCurrency(bal.balance ?? bal.cashAmt))} BDT`);
    console.log(`    Buying Power : ${chalk.cyan(formatCurrency(bal.buyPwr))} BDT`);
    console.log(`    Pending Pay  : ${chalk.yellow(formatCurrency(bal.payAmt))} BDT`);
    console.log('');

    // Portfolio
    console.log(chalk.bold('  Portfolio'));
    console.log(`    Market Value : ${chalk.cyan(formatCurrency(totalMktVal))} BDT`);
    console.log(`    Cost Basis   : ${formatCurrency(totalCost)} BDT`);
    console.log(`    Unrealized   : ${colPnl(totalPL, 0)} BDT  (${colPct(totalPct, 0)})`);
    console.log(`    Positions    : ${holdings.length} stocks` + (settlingCount > 0 ? chalk.yellow(`  (${settlingCount} settling tomorrow)`) : ''));
    console.log('');

    // Today's orders
    if (orders.length > 0) {
      const parts: string[] = [];
      if (filledCount)   parts.push(chalk.green(`${filledCount} filled`));
      if (pendingCount)  parts.push(chalk.yellow(`${pendingCount} pending`));
      if (modifiedCount) parts.push(chalk.blue(`${modifiedCount} modified`));
      if (cancelledCount)parts.push(chalk.gray(`${cancelledCount} cancelled`));
      console.log(chalk.bold('  Today\'s Orders'));
      console.log(`    ${orders.length} total — ${parts.join('  ')}`);
      console.log('');
    }
  } catch (err: any) {
    spinner.fail(err.message);
    _svc?.logout();
    process.exit(1);
  }
}
