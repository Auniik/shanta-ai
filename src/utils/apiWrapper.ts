import { ConfigManager } from '../config';

export async function authenticatedApiCall<T>(
  apiCall: (token: string) => Promise<T>,
  spinner?: any
): Promise<T> {
  const config = new ConfigManager();
  let token = await config.ensureAuthenticated(false, spinner);

  try {
    return await apiCall(token);
  } catch (error: any) {
    // Check for 401 status code
    if (error.statusCode === 401) {
      token = await config.ensureAuthenticated(true, spinner);
      return await apiCall(token);
    }
    throw error;
  }
}
