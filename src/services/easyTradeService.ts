import { WebSocket } from 'ws';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── Constants decoded from the DirectFN OMS bundle ────────────────────────────
// AiolosProtocol message type numbers (msgTyp in HED)
const MSG = {
  AUTH: 1,
  NEW_ORDER: 2,
  HOLDINGS: 4,
  PULSE: 3,
  LOGOUT: 402,
  ORDER_LIST: 23,
  CANCEL_ORDER: 16,
  BUYING_POWER: 46,
  CUSTOMER_DETAILS: 6,
  OTP_RESEND: 407,
  OTP_VALIDATE: 406,
} as const;

const ORDER_SIDE = { BUY: '1', SELL: '2' } as const;
const ORDER_TYPE = { MARKET: '1', LIMIT: '2' } as const;
const APP_VERSION = 'DFNUAMOB_XX_SHANTA_1.010.06.0+9dbc1750'; // must match full Ember APP.version
const OMS_URL = 'wss://easytrade.shantasecurities.com/streaming-api';
const CHANNEL_ID = 32; // iPhone mobile channel (iPhoneChannelId)
const CRED_FILE = path.join(os.homedir(), '.shanta-ai', 'easytrade.json');

// ── Credential storage ─────────────────────────────────────────────────────────
export interface EasyTradeCredentials {
  username: string;
  password: string; // stored as plaintext; hashed on send
}

export function loadEasyTradeCreds(): EasyTradeCredentials | null {
  try {
    if (fs.existsSync(CRED_FILE)) {
      return JSON.parse(fs.readFileSync(CRED_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

export function saveEasyTradeCreds(creds: EasyTradeCredentials): void {
  fs.writeFileSync(CRED_FILE, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface UserSession {
  loginId: string;
  instId: string;
  sessionId: string;
  routeId: string;
  customerId: string;
  tradingAccounts: TradingAccount[];
  displayName: string;
}

export interface TradingAccount {
  tradingAccId: string;
  cashAccId: string;
  description: string;
  exchg: string;
}

export interface OrderRequest {
  tradingAccId: string;
  symbol: string;
  exg: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  qty: number;
  price: number;
  tif?: string;
  instruTyp?: string;
}

export interface CancelRequest {
  tradingAccId: string;
  symbol: string;
  exg: string;
  ordNo: string;
  clOrdId: string;
  orgClOrdId: string;
  ordTyp?: string;
  ordSide?: string;
  tif?: string;
}

// ── Main service ───────────────────────────────────────────────────────────────
export class EasyTradeService {
  private ws: WebSocket | null = null;
  private session: UserSession | null = null;
  private msgCounter = 0;
  private readonly startTs = Date.now();
  private pendingCallbacks = new Map<string, (msg: any) => void>();
  private responseBuffer = '';

  private hashPassword(pwd: string): string {
    return crypto.createHash('sha256').update(pwd).digest('hex');
  }

  private buildMsg(msgTyp: number, dat: object): string {
    const unqReqId = `${this.msgCounter++}_${this.startTs}`;
    const s = this.session;
    return JSON.stringify({
      HED: {
        msgTyp,
        channel: CHANNEL_ID,
        commVer: APP_VERSION,
        loginId: s?.loginId ?? '',
        instId: s?.instId ?? '',
        sesnId: s?.sessionId ?? '',
        routeId: s?.routeId ?? '',
        clientIp: '192.168.0.1',
        tenantCode: 'DEFAULT_TENANT',
        unqReqId,
      },
      DAT: dat,
    });
  }

  private send(msg: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(msg);
  }

  // Connect and authenticate, then fetch account list. Resolves with the session on success.
  async login(username: string, password: string): Promise<UserSession> {
    await this._connect(username, password);
    await this.fetchCustomerDetails();
    return this.session!;
  }

  private _connect(username: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(OMS_URL, {
        headers: {
          'Origin': 'https://easytrade.shantasecurities.com',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        },
      });
      this.ws = ws;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 30000);

      ws.on('open', () => {
        const authMsg = this.buildMsg(MSG.AUTH, {
          lgnNme: username,
          isSkipTwoFCTA: '0',
          pwd: this.hashPassword(password),
        });
        ws.send(authMsg);
      });

      ws.on('message', (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg?.HED?.msgTyp !== MSG.AUTH) return;

          clearTimeout(timeout);
          const hed = msg.HED ?? {};
          const dat = msg.DAT ?? {};

          if (dat?.authSts !== 1 || dat?.rejResn) {
            ws.close();
            reject(new Error(`Auth failed: ${dat?.rejResn || `authSts=${dat?.authSts}`}`));
            return;
          }

          // loginId + sesnId in HED; routeId/instId/customerId/cusNme in DAT
          this.session = {
            loginId: String(hed?.loginId ?? username),
            instId: String(dat?.instId ?? '1'),
            sessionId: hed?.sesnId ?? '',
            routeId: String(dat?.routeId ?? ''),
            customerId: String(dat?.customerId ?? hed?.loginId ?? ''),
            displayName: dat?.cusNme ?? dat?.lgnAls ?? username,
            tradingAccounts: [],
          };

          // Switch to ongoing message handler
          ws.removeAllListeners('message');
          ws.removeAllListeners('error');
          ws.removeAllListeners('close');
          ws.on('message', (d: Buffer | string) => this.handleMessage(d.toString()));
          ws.on('error', (err: Error) => console.error('WS error:', err.message));
          ws.on('close', () => { this.ws = null; this.session = null; });

          resolve();
        } catch (_) { /* ignore parse errors */ }
      });

      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error: ${err.message}`));
      });

      ws.on('close', () => {
        clearTimeout(timeout);
        reject(new Error('Connection closed before auth completed'));
      });
    });
  }

  // Fetch trading and cash account lists after auth (msgTyp:6)
  private async fetchCustomerDetails(): Promise<void> {
    const custId = this.session!.customerId;
    const resp = await this.request(MSG.CUSTOMER_DETAILS, { customerId: custId });
    const dat = resp?.DAT ?? {};

    // Response has tradingAccounts[] and cashAccounts[]
    const tradingAccs: TradingAccount[] = (dat.tradingAccounts ?? []).map((a: any) => ({
      tradingAccId: String(a.tradingAccId ?? ''),
      cashAccId: String(a.cashAccountId ?? custId),
      description: a.tradingAccName ?? `${a.exchangeAccNo}-${a.exchange}`,
      exchg: a.exchange === 'XCHG' ? 'CSE' : (a.exchange ?? 'DSE'),
    }));

    this.session!.tradingAccounts = tradingAccs;
  }

  private parseTradingAccounts(_dat: any): TradingAccount[] {
    return []; // populated via fetchCustomerDetails() after auth
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      const typ = msg?.HED?.msgTyp;
      const reqId = msg?.HED?.unqReqId;

      // Dispatch to waiting callback by reqId if available
      if (reqId && this.pendingCallbacks.has(reqId)) {
        const cb = this.pendingCallbacks.get(reqId)!;
        this.pendingCallbacks.delete(reqId);
        cb(msg);
        return;
      }

      // Dispatch by message type
      if (reqId) {
        // Find any pending callback for this msgTyp (best-effort)
        for (const [key, cb] of this.pendingCallbacks) {
          if (key.startsWith(`type:${typ}`)) {
            this.pendingCallbacks.delete(key);
            cb(msg);
            return;
          }
        }
      }
    } catch {}
  }

  private request(msgTyp: number, dat: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const msg = this.buildMsg(msgTyp, dat);
      const parsed = JSON.parse(msg);
      const reqId = parsed.HED.unqReqId;

      const timer = setTimeout(() => {
        this.pendingCallbacks.delete(reqId);
        this.pendingCallbacks.delete(`type:${msgTyp}`);
        reject(new Error(`Request timeout (msgTyp=${msgTyp})`));
      }, 15000);

      const cb = (response: any) => {
        clearTimeout(timer);
        resolve(response);
      };

      // Register by reqId and also by type as fallback
      this.pendingCallbacks.set(reqId, cb);
      this.pendingCallbacks.set(`type:${msgTyp}`, cb);

      this.send(msg);
    });
  }

  getSession(): UserSession | null {
    return this.session;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.session !== null;
  }

  async getOrderList(tradingAccId: string): Promise<any> {
    return this.request(MSG.ORDER_LIST, { tradingAccId, ordCatgry: 0 });
  }

  async getBuyingPower(tradingAccId: string, cashAccId: string): Promise<any> {
    const cusId = this.session?.customerId ?? '';
    return this.request(MSG.BUYING_POWER, { tradingAccountId: Number(tradingAccId), cashAcntId: Number(cashAccId), cusId: Number(cusId) });
  }

  async getHoldings(tradingAccId: string): Promise<any> {
    return this.request(MSG.HOLDINGS, { tradingAccId });
  }

  async placeOrder(req: OrderRequest): Promise<any> {
    const dat = {
      tradingAccId: req.tradingAccId,
      symbol: req.symbol,
      exg: req.exg,
      ordTyp: ORDER_TYPE[req.type],
      ordSide: ORDER_SIDE[req.side],
      ordQty: req.qty,
      tif: req.tif ?? 'DAY',
      disQty: 0,
      minQty: 0,
      price: req.price,
      dayOrd: 0,
      instruTyp: req.instruTyp ?? 'EQ',
      expDte: '',
      bkId: '',
      marketCode: 'ALL',
    };
    return this.request(MSG.NEW_ORDER, dat);
  }

  async cancelOrder(req: CancelRequest): Promise<any> {
    const dat = {
      tradingAccId: req.tradingAccId,
      symbol: req.symbol,
      exg: req.exg,
      ordTyp: req.ordTyp ?? '2',
      ordSide: req.ordSide ?? '1',
      tif: req.tif ?? 'DAY',
      bkId: '',
      ordNo: req.ordNo,
      orgClOrdId: req.orgClOrdId,
      clOrdId: req.clOrdId,
    };
    return this.request(MSG.CANCEL_ORDER, dat);
  }

  logout(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try { this.send(this.buildMsg(MSG.LOGOUT, {})); } catch {}
      this.ws.close();
    }
    this.ws = null;
    this.session = null;
  }
}
