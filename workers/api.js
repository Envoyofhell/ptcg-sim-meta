// workers/api.js
// API request handlers

/**
 * Handles API requests for game data
 */
export async function handleApiRequests(request, env) {
    const url = new URL(request.url);
    
    // Handle importing game data
    if (url.pathname === '/api/importData') {
      const key = url.searchParams.get('key');
      if (!key) {
        return new Response(JSON.stringify({ error: 'Key parameter is missing' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        // Query from D1 database
        const stmt = env.DB.prepare('SELECT value FROM KeyValuePairs WHERE key = ?').bind(key);
        const result = await stmt.first();
        
        if (result) {
          return new Response(result.value, {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ error: 'Key not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Database error', details: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return null;
  }