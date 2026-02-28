import axios from 'axios';

export class PortfolioService {
  private readonly apiUrl = 'https://api-shantaeasyx.shantasecurities.com';

  private getBrowserHeaders(token: string): Record<string, string> {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Authorization': `Bearer ${token}`,
      'Connection': 'keep-alive',
      'Origin': 'https://shantaeasyx.shantasecurities.com',
      'Referer': 'https://shantaeasyx.shantasecurities.com/',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
    };
  }

  async getPortfolio(token: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/customer-dashboard/portfolio`, {
        headers: this.getBrowserHeaders(token),
      });
      return response.data.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const message = error.response?.data?.message || error.message;
        const err: any = new Error(`Failed to fetch portfolio: ${message}`);
        err.statusCode = statusCode;
        throw err;
      }
      throw error;
    }
  }

  async getPortfolioChart(token: string, timePeriod: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/api/customer-dashboard/v2/portfolio-chart`, {
        params: { timePeriod },
        headers: this.getBrowserHeaders(token),
      });
      return response.data.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const message = error.response?.data?.message || error.message;
        const err: any = new Error(`Failed to fetch portfolio chart: ${message}`);
        err.statusCode = statusCode;
        throw err;
      }
      throw error;
    }
  }
}
