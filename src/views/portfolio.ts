export function printDefaultPortfolio(portfolio: any): void {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    PORTFOLIO SUMMARY                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Total Value:         ৳${String(portfolio.value.toFixed(2)).padEnd(37)}║`);
  console.log(`║ Total Equity:        ৳${String(portfolio.totalEquity.toFixed(2)).padEnd(37)}║`);
  console.log(`║ Market Value:        ৳${String(portfolio.totalMarketValue.toFixed(2)).padEnd(37)}║`);
  console.log(`║ Cash Balance:        ৳${String(portfolio.totalCash.toFixed(2)).padEnd(37)}║`);
  console.log(`║ Unrealized P&L:      ${formatPnLInline(portfolio.unrealiseGainLoss).padEnd(38)}║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Stock:               ${portfolio.stock.percentage.padEnd(38)}║`);
  console.log(`║ Cash:                ${portfolio.cash.percentage.padEnd(38)}║`);
  console.log(`║ Bond:                ${portfolio.bond.percentage.padEnd(38)}║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log('\n📈 HOLDINGS:\n');
  
  portfolio.stocks.forEach((stock: any, index: number) => {
    const pnlSymbol = stock.unrealizedGain >= 0 ? '📈' : '📉';
    console.log(`${index + 1}. ${stock.symbol} - ${stock.name}`);
    console.log(`   Shares: ${stock.shares} | Price: ৳${stock.price} | Value: ৳${stock.marketValue.toFixed(2)}`);
    console.log(`   ${pnlSymbol} P&L: ${formatPnLDisplay(stock.difference)} (${stock.percentage})`);
    console.log('');
  });
}

export function printMarkdownPortfolio(portfolio: any): void {
  console.log('# Portfolio Summary\n');
  console.log(`- **Total Value:** ৳${portfolio.value}`);
  console.log(`- **Market Value:** ৳${portfolio.totalMarketValue}`);
  console.log(`- **Cash Balance:** ৳${portfolio.totalCash}`);
  console.log(`- **Unrealized P&L:** ৳${portfolio.unrealiseGainLoss.toFixed(2)}\n`);
  
  console.log('## Holdings\n');
  console.log('| Symbol | Name | Qty | Price | Value | P&L | % |');
  console.log('|--------|------|-----|-------|-------|-----|---|');
  
  portfolio.stocks.forEach((stock: any) => {
    console.log(`| ${stock.symbol} | ${stock.name} | ${stock.shares} | ৳${stock.price} | ৳${stock.marketValue.toFixed(2)} | ৳${stock.difference.toFixed(2)} | ${stock.percentage} |`);
  });
}

function formatPnLInline(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}৳${value.toFixed(2)}`;
}

function formatPnLDisplay(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}৳${value.toFixed(2)}`;
}
