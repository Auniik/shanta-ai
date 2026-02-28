import { ConfigManager } from '../config';
import { PortfolioService } from '../services/portfolioService';
import { encode as toonEncode } from '@toon-format/toon';
import { printDefaultChart, printMarkdownChart } from '../views/chart';

type TimePeriod = '1M' | '3M' | '6M' | '1y' | 'Max';

export async function portfolioChartCommand(
  period: string = '1M',
  options: { json?: boolean; toon?: boolean; markdown?: boolean }
): Promise<void> {
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

  // Validate period
  const validPeriods: TimePeriod[] = ['1M', '3M', '6M', '1y', 'Max'];
  if (!validPeriods.includes(period as TimePeriod)) {
    console.error(`Error: Invalid time period. Valid options: ${validPeriods.join(', ')}`);
    process.exit(1);
  }

  try {
    console.log(`📊 Fetching portfolio trend (${period})...\n`);
    
    const portfolioService = new PortfolioService();
    const chartData = await portfolioService.getPortfolioChart(token, period as TimePeriod);

    if (options.json) {
      console.log(JSON.stringify(chartData, null, 2));
      return;
    }

    if (options.toon) {
      console.log(toonEncode(chartData));
      return;
    }

    if (options.markdown) {
      printMarkdownChart(chartData, period);
      return;
    }

    printDefaultChart(chartData, period);

  } catch (error) {
    console.error('❌ Failed to fetch portfolio chart:', error instanceof Error ? error.message : error);
    console.log('\nYour token may have expired. Please run "shanta-ai auth" to re-authenticate.');
    process.exit(1);
  }
}
