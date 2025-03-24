// Inline CORS utility for PTCG-Sim-Meta
// This file is automatically generated during build

/**
 * CORS headers for cross-origin requests
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * Handle OPTIONS requests for CORS preflight
 *
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response with CORS headers
 */
export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// For compatibility with both named and default exports
export default { corsHeaders, handleOptions };
