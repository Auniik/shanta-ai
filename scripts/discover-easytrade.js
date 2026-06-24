#!/usr/bin/env node
/**
 * EasyTrade API Discovery Script
 *
 * Opens easytrade.shantasecurities.com in a visible mobile browser.
 * You log in manually and navigate around (dashboard, orders, buy screen, sell screen).
 * Every API call is intercepted and saved to easytrade-api-map.json.
 *
 * Run: node scripts/discover-easytrade.js
 * Close the browser window when done exploring.
 */

const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, 'easytrade-api-map.json');
const TARGET_URL = 'https://easytrade.shantasecurities.com';

// iPhone 13 Pro viewport
const MOBILE_DEVICE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
};

const captured = {
  baseUrls: new Set(),
  endpoints: {},
  authHeaders: {},
  requests: [],
};

function categorize(url, method) {
  const u = new URL(url);
  const path = u.pathname;

  if (path.includes('login') || path.includes('auth') || path.includes('token')) return 'AUTH';
  if (path.includes('order') || path.includes('trade')) return 'ORDER';
  if (path.includes('portfolio') || path.includes('holding') || path.includes('position')) return 'PORTFOLIO';
  if (path.includes('balance') || path.includes('cash') || path.includes('account') || path.includes('fund')) return 'ACCOUNT';
  if (path.includes('stock') || path.includes('instrument') || path.includes('market') || path.includes('price')) return 'MARKET';
  if (path.includes('user') || path.includes('profile') || path.includes('customer')) return 'USER';
  return 'OTHER';
}

async function main() {
  console.log('\n🚀 Launching EasyTrade mobile browser...\n');
  console.log('📱 Viewport: iPhone 13 Pro (390x844)');
  console.log(`🌐 URL: ${TARGET_URL}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('INSTRUCTIONS:');
  console.log('  1. Log in with your EasyTrade credentials');
  console.log('  2. Navigate: Dashboard → Orders → Buy screen → Sell screen');
  console.log('  3. Check order history, account balance, watchlist');
  console.log('  4. When done, CLOSE the browser window');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    ...MOBILE_DEVICE,
    // Record all network activity
    recordHar: { path: path.join(__dirname, 'easytrade-session.har') },
  });

  const page = await context.newPage();

  // Intercept all requests
  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();

    // Skip static assets
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)(\?|$)/.test(url)) return;
    if (url.startsWith('data:')) return;

    const category = categorize(url, method);
    const headers = request.headers();
    const postData = request.postData();

    // Track base API URLs
    try {
      const u = new URL(url);
      captured.baseUrls.add(u.origin);
    } catch (_) {}

    // Capture auth tokens from headers
    if (headers['authorization']) {
      captured.authHeaders['Authorization'] = headers['authorization'];
    }
    if (headers['x-auth-token']) {
      captured.authHeaders['x-auth-token'] = headers['x-auth-token'];
    }

    const entry = {
      method,
      url,
      category,
      headers: {
        authorization: headers['authorization'] || null,
        'content-type': headers['content-type'] || null,
        origin: headers['origin'] || null,
        referer: headers['referer'] || null,
      },
      body: postData ? (() => { try { return JSON.parse(postData); } catch { return postData; } })() : null,
      timestamp: new Date().toISOString(),
    };

    captured.requests.push(entry);

    // Group by endpoint
    const key = `${method} ${new URL(url).pathname}`;
    if (!captured.endpoints[key]) {
      captured.endpoints[key] = { method, path: new URL(url).pathname, url, category, sampleBody: entry.body };
    }

    // Live console output for important calls
    if (category !== 'OTHER' || method !== 'GET') {
      const icon = { AUTH: '🔐', ORDER: '📋', PORTFOLIO: '💼', ACCOUNT: '💰', MARKET: '📈', USER: '👤', OTHER: '🔗' }[category];
      console.log(`${icon} [${category}] ${method} ${new URL(url).pathname}`);
      if (entry.body && typeof entry.body === 'object') {
        // Mask sensitive values
        const safe = JSON.parse(JSON.stringify(entry.body));
        ['password', 'pin', 'otp', 'secret'].forEach(k => { if (safe[k]) safe[k] = '***'; });
        console.log(`   Body: ${JSON.stringify(safe)}`);
      }
    }
  });

  // Also capture responses to understand response shapes
  page.on('response', async (response) => {
    const url = response.url();
    if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)(\?|$)/.test(url)) return;
    if (url.startsWith('data:')) return;

    const status = response.status();
    const key = `${response.request().method()} ${new URL(url).pathname}`;

    if (captured.endpoints[key]) {
      captured.endpoints[key].status = status;
      if (status >= 200 && status < 300) {
        try {
          const json = await response.json();
          // Store just the shape (keys), not values
          captured.endpoints[key].responseShape = extractShape(json);
        } catch (_) {}
      }
    }
  });

  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

  // Wait for browser to close
  await new Promise((resolve) => {
    browser.on('disconnected', resolve);
  });

  // Save results
  const output = {
    capturedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
    baseUrls: [...captured.baseUrls],
    authHeadersFound: Object.keys(captured.authHeaders),
    summary: {
      totalRequests: captured.requests.length,
      byCategory: Object.values(captured.endpoints).reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + 1;
        return acc;
      }, {}),
    },
    endpoints: Object.values(captured.endpoints).sort((a, b) => a.category.localeCompare(b.category)),
    allRequests: captured.requests,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Browser closed. Results saved to:`);
  console.log(`   ${OUTPUT_FILE}`);
  console.log(`\n📊 Summary:`);
  console.log(`   Total API calls captured: ${captured.requests.length}`);
  console.log(`   Unique endpoints: ${Object.keys(captured.endpoints).length}`);
  console.log(`   Base API URLs found: ${[...captured.baseUrls].join(', ')}`);
  console.log(`   Categories: ${JSON.stringify(output.summary.byCategory)}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function extractShape(obj, depth = 0) {
  if (depth > 3) return '...';
  if (Array.isArray(obj)) return obj.length > 0 ? [extractShape(obj[0], depth + 1)] : [];
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.keys(obj).map(k => [k, extractShape(obj[k], depth + 1)]));
  }
  return typeof obj;
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
