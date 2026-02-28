import { ConfigManager } from '../config';

export async function authenticatedApiCall<T>(
  apiCall: (token: string) => Promise<T>
): Promise<T> {
  const config = new ConfigManager();
  let token = await config.ensureAuthenticated();

  try {
    return await apiCall(token);
  } catch (error: any) {
    // Check for 401 status code
    if (error.statusCode === 401) {
      token = await config.ensureAuthenticated(true);
      return await apiCall(token);
    }
    throw error;
  }
}
