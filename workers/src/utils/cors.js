/**
 * Enhanced CORS utility functions for PTCG-Sim-Meta
 * 
 * Provides robust CORS headers and handlers with specific WebSocket support
 */

// Define allowed origins with expanded domains
export const allowedOrigins = [
    'https://ptcg-sim-meta.pages.dev',
    'https://ptcg-sim-meta-dev.pages.dev',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:4000'
  ];
  
  /**
   * Basic CORS headers for standard requests
   */
  export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
  
  /**
   * Get expanded CORS headers for a specific request
   * Allows origin-specific headers and WebSocket support
   * 
   * @param {Request} request - HTTP request
   * @returns {Object} - CORS headers
   */
  export function getExpandedCorsHeaders(request) {
    const origin = request.headers.get('Origin');
    const headers = { ...corsHeaders };
    
    // Set origin-specific header if origin is in allowed list
    if (origin && allowedOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
    
    // Add WebSocket support
    headers['Access-Control-Allow-Headers'] += ', Upgrade, Connection';
    
    return headers;
  }
  
  /**
   * Handle OPTIONS requests for CORS preflight
   * 
   * @param {Request} request - HTTP request
   * @returns {Response} HTTP response with CORS headers
   */
  export function handleOptions(request) {
    // Get expanded headers for this specific request
    const headers = getExpandedCorsHeaders(request);
    
    // Return empty response with CORS headers
    return new Response(null, {
      status: 204,
      headers
    });
  }
  
  /**
   * Apply CORS headers to a response
   * 
   * @param {Response} response - HTTP response
   * @param {Request} request - HTTP request
   * @returns {Response} Response with CORS headers
   */
  export function applyCorsHeaders(response, request) {
    const headers = new Headers(response.headers);
    const expandedHeaders = getExpandedCorsHeaders(request);
    
    // Add all expanded headers
    Object.entries(expandedHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    // Create a new response with the same body but updated headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }