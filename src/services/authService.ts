import axios from 'axios';

export interface LoginCredentials {
  accountCode: string;
  password: string;
}

export interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
  hidePostLoginScreen: boolean;
}

export interface LoginResponse {
  data: LoginResponseData;
}

export interface AuthResult {
  accessToken: string;
  refreshToken?: string;
}

export class AuthService {
  private readonly apiUrl = 'https://api-shantaeasyx.shantasecurities.com';

  private getBrowserHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Content-Type': 'application/json',
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

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      console.log('🔐 Authenticating...');
      const response = await axios.post<LoginResponse>(
        `${this.apiUrl}/api/auth/login`,
        {
          accountCode: credentials.accountCode,
          password: credentials.password,
        },
        {
          headers: this.getBrowserHeaders(),
        }
      );

      const accessToken = response.data.data?.accessToken;
      const refreshToken = response.data.data?.refreshToken;

      if (!accessToken) {
        throw new Error('No token found in response');
      }

      console.log('✅ Authentication successful!');
      return {
        accessToken,
        refreshToken,
      };

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`Authentication failed: ${message}`);
      }
      throw error;
    }
  }

  async getUserProfile(token: string): Promise<any> {
    try {
      const headers = this.getBrowserHeaders();
      headers['Authorization'] = `Bearer ${token}`;
      
      const response = await axios.get(`${this.apiUrl}/api/user/me`, {
        headers,
      });
      return response.data.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || error.message;
        throw new Error(`Failed to fetch profile: ${message}`);
      }
      throw error;
    }
  }

  async validateToken(token: string): Promise<boolean> {
    try {
      await this.getUserProfile(token);
      return true;
    } catch {
      return false;
    }
  }
}
