import { ConfigManager } from '../config';
import { PortfolioService } from '../services/portfolioService';
import { encode as toonEncode } from '@toon-format/toon';
import { printDefaultChart, printMarkdownChart } from '../views/chart';
import { authenticatedApiCall } from '../utils/apiWrapper';
import ora from 'ora';

type TimePeriod = '1M' | '3M' | '6M' | '1y' | 'Max';

export async function portfolioChartCommand(
  period: string = '1M',
  options: { json?: boolean; toon?: boolean; markdown?: boolean }
): Promise<void> {
  // Validate period
  const validPeriods: TimePeriod[] = ['1M', '3M', '6M', '1y', 'Max'];
  if (!validPeriods.includes(period as TimePeriod)) {
    console.error(`Error: Invalid time period. Valid options: ${validPeriods.join(', ')}`);
    process.exit(1);
  }

  const spinner = ora(`Fetching portfolio trend (${period})...`).start();
  try {
    const portfolioService = new PortfolioService();
    
    const chartData = await authenticatedApiCall((token: string) => 
      portfolioService.getPortfolioChart(token, period as TimePeriod)
    );

    spinner.stop();

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
