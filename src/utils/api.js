/**
 * Get the base API URL from environment variables
 * In production (Vercel), set VITE_API_URL in the Vercel dashboard
 * For local development, set it in .env file or leave empty to use proxy
 */
export function getApiUrl() {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Construct a full API endpoint URL
 * @param {string} endpoint - API endpoint path (e.g., '/api/subjects')
 * @returns {string} Full URL or relative path for local dev
 */
export function getApiEndpoint(endpoint) {
  const apiUrl = getApiUrl();
  // Remove leading slash from endpoint if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  if (apiUrl) {
    // Ensure API URL doesn't end with a slash
    const cleanApiUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    return `${cleanApiUrl}${cleanEndpoint}`;
  }
  
  // For local development, use relative path (Vite proxy will handle it)
  return cleanEndpoint;
}

