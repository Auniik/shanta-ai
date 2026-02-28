export function printDefaultChart(data: any, period: string): void {
  const result = data.result || [];
  if (result.length === 0) {
    console.log('No data available for this period.');
    return;
  }

  const firstValue = result[0].value;
  const lastValue = result[result.length - 1].value;
  const change = lastValue - firstValue;
  const changePercent = firstValue !== 0 ? ((change / firstValue) * 100).toFixed(2) : '0.00';
  const trend = change >= 0 ? '📈' : '📉';
  const sign = change >= 0 ? '+' : '';

  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log(`│  Portfolio Trend (${period.padEnd(47)})│`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│  ${trend} Change: ${sign}${change.toFixed(2)}% (${sign}${changePercent}%)${' '.repeat(Math.max(0, 36 - (sign + change.toFixed(2) + changePercent).length))}│`);
  console.log(`│  Range: ${data.min}% - ${data.max}%${' '.repeat(Math.max(0, 44 - String(data.min + data.max).length))}│`);
  console.log('└─────────────────────────────────────────────────────────┘\n');

  // Show ASCII chart
  console.log('Performance:');
  const maxVal = data.max;
  const minVal = data.min;
  const range = maxVal - minVal || 1;

  // Sample points for display (show max 30 points)
  const step = Math.ceil(result.length / 30);
  const sampledData = result.filter((_: any, i: number) => i % step === 0);

  sampledData.forEach((point: any) => {
    const normalizedValue = ((point.value - minVal) / range);
    const barLength = Math.round(normalizedValue * 40);
    const bar = '█'.repeat(barLength);
    const valueStr = `${point.value.toFixed(1)}%`;
    console.log(`${point.date.padEnd(12)} ${bar} ${valueStr}`);
  });

  console.log(`\nShowing ${result.length} data points from ${result[0].date} to ${result[result.length - 1].date}`);
}

export function printMarkdownChart(data: any, period: string): void {
  console.log(`# Portfolio Trend (${period})\n`);
  
  const result = data.result || [];
  if (result.length === 0) {
    console.log('No data available.');
    return;
  }

  const firstValue = result[0].value;
  const lastValue = result[result.length - 1].value;
  const change = lastValue - firstValue;
  const changePercent = firstValue !== 0 ? ((change / firstValue) * 100).toFixed(2) : '0.00';

  console.log(`- **Period:** ${period}`);
  console.log(`- **Change:** ${change.toFixed(2)}% (${changePercent}%)`);
  console.log(`- **Range:** ${data.min}% - ${data.max}%`);
  console.log(`- **Data Points:** ${result.length}\n`);

  console.log('## Data\n');
  console.log('| Date | Value |');
  console.log('|------|-------|');
  result.forEach((point: any) => {
    console.log(`| ${point.date} | ${point.value}% |`);
  });
}
