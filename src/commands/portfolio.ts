import { ConfigManager } from '../config';
import { PortfolioService } from '../services/portfolioService';
import { encode as toonEncode } from '@toon-format/toon';
import { printDefaultPortfolio, printMarkdownPortfolio } from '../views/portfolio';
import { authenticatedApiCall } from '../utils/apiWrapper';
import ora from 'ora';

export async function portfolioCommand(options: { json?: boolean; toon?: boolean; markdown?: boolean }): Promise<void> {
  const spinner = options.json ? undefined : ora('Fetching portfolio...').start();
  try {
    const portfolioService = new PortfolioService();
    
    const portfolio = await authenticatedApiCall(
      (token: string) => portfolioService.getPortfolio(token),
      spinner
    );

    spinner?.stop();

    if (options.json) {
      console.log(JSON.stringify(portfolio, null, 2));
      return;
    }

    if (options.toon) {
      console.log(toonEncode(portfolio));
      return;
    }

    if (options.markdown) {
      printMarkdownPortfolio(portfolio);
      return;
    }

    printDefaultPortfolio(portfolio);

  } catch (error) {
    console.error('❌ Failed to fetch portfolio:', error instanceof Error ? error.message : error);
    console.log('\nYour token may have expired. Please run "shanta-ai auth" to re-authenticate.');
    process.exit(1);
  }
}
