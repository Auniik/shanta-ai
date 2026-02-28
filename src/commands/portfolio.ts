import { ConfigManager } from '../config';
import { PortfolioService } from '../services/portfolioService';
import { encode as toonEncode } from '@toon-format/toon';
import { printDefaultPortfolio, printMarkdownPortfolio } from '../views/portfolio';

export async function portfolioCommand(options: { json?: boolean; toon?: boolean; markdown?: boolean }): Promise<void> {
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

  try {
    console.log('📊 Fetching portfolio...\n');
    
    const portfolioService = new PortfolioService();
    const portfolio = await portfolioService.getPortfolio(token);

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
