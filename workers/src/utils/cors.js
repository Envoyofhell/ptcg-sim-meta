// File: workers/src/utils/cors.js
/**
 * Enhanced CORS utility functions for PTCG-Sim-Meta
 * 
 * Provides robust CORS headers and handlers for cross-origin requests
 * with specific support for Socket.IO connections
 */

// Define allowed origins
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
    'Access-Control-Max-Age': '86400' // 24 hours
  };
  
  /**
   * Get expanded CORS headers for Socket.IO requests
   * 
   * @param {Request} request - HTTP request
   * @returns {Object} - CORS headers tailored to the request
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
    const headers = getExpandedCorsHeaders(request);
    
    return new Response(null, {
      status: 204,
      headers
    });
  }