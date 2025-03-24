/**
 * Stub CORS utility module for PTCG-Sim-Meta
 * This file is loaded when the real CORS module can't be found
 *
 * File: client/workers/src/utils/cors-stub.js
 */

// Define basic CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400', // 24 hours
};

// Handle OPTIONS requests for CORS preflight
export function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// For compatibility with both named and default exports
export default { corsHeaders, handleOptions };
