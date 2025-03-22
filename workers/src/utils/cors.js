/**
 * CORS utility functions
 * 
 * This module provides CORS headers and handlers for cross-origin requests.
 * It allows the worker to be accessed from the client domains.
 */

// Define allowed origins
const allowedOrigins = [
    'https://ptcg-sim-meta.pages.dev',
    'https://ptcg-sim-meta-dev.pages.dev',
    'http://localhost:3000',
    'http://localhost:4000'
  ];
  
  /**
   * CORS headers to be applied to all responses
   */
  export const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Replace with specific origins in production
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
  
  /**
   * Handle OPTIONS requests for CORS preflight
   * 
   * @param {Request} request - HTTP request
   * @returns {Response} HTTP response with CORS headers
   */
  export function handleOptions(request) {
    // Get the origin from the request
    const origin = request.headers.get('Origin');
    
    // Create headers
    const headers = new Headers(corsHeaders);
    
    // Set origin-specific header if origin is in allowed list
    if (origin && allowedOrigins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
    
    // Return the response with CORS headers
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
    const origin = request.headers.get('Origin');
    const headers = new Headers(response.headers);
    
    // Copy existing CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
    
    // Set origin-specific header if origin is in allowed list
    if (origin && allowedOrigins.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    }
    
    // Create a new response with the same body but updated headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }