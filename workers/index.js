/**
 * Simplified PTCG-Sim-Meta Worker
 * This version focuses on correctly serving HTML content
 */

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
};

// Handle OPTIONS requests for CORS preflight
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

/**
 * Get the appropriate content type for a file path
 * @param {string} path - File path
 * @returns {string} Content type
 */
function getContentType(path) {
  // First handle HTML files and default pages
  if (path.endsWith('.html') || path === '/' || path.endsWith('/')) {
    return 'text/html; charset=utf-8';
  }

  const extensionMap = {
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };

  // Check if path ends with one of the extensions
  for (const [extension, contentType] of Object.entries(extensionMap)) {
    if (path.endsWith(extension)) {
      return contentType;
    }
  }

  // Default content type
  return 'application/octet-stream';
}

// Main fetch handler
export default {
  async fetch(request, env, ctx) {
    try {
      // Parse the URL from the request
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return handleOptions(request);
      }
      
      // API routes (handled separately)
      if (path.startsWith('/api/')) {
        // Return your API response logic here
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      // Determine content type based on path
      const contentType = getContentType(path);
      
      // Fetch the requested resource
      let response;
      try {
        response = await fetch(request);
        
        // If response wasn't successful, try fetching index.html for SPA routing
        if (!response.ok && (path !== '/' && !path.endsWith('.html'))) {
          // For SPA routing, serve index.html for non-file routes
          const indexRequest = new Request(new URL('/', url), request);
          response = await fetch(indexRequest);
        }
      } catch (error) {
        // If fetch fails, create a simple error response
        return new Response(`Error fetching: ${error.message}`, {
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
            ...corsHeaders
          }
        });
      }
      
      // If we got a response, ensure it has the correct content type
      if (response) {
        const body = await response.text();
        
        return new Response(body, {
          status: response.status,
          headers: {
            'Content-Type': contentType,
            ...corsHeaders
          }
        });
      }
      
      // Fallback to 404
      return new Response('Not Found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        }
      });
    } catch (error) {
      // Handle any errors
      return new Response(`Internal Server Error: ${error.message}`, {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        }
      });
    }
  }
};