// filename: server/workers.js
/**
 * Cloudflare Worker for PTCG Simulator
 * Purpose: Handle API requests and serve the web application
 * @author: [Your Name]
 * @created: April 29, 2025
 */

// Import required modules
import { Router } from 'itty-router';

// Create a new router
const router = Router();

// Define API routes
router.get('/api/cards', async (request, env) => {
  try {
    const { set, name, type } = request.query || {};
    
    let query = "SELECT * FROM cards";
    let conditions = [];
    let params = [];
    
    if (set) {
      conditions.push("card_set = ?");
      params.push(set);
    }
    
    if (name) {
      conditions.push("name LIKE ?");
      params.push(`%${name}%`);
    }
    
    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }
    
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    
    const stmt = env.DB.prepare(query);
    
    if (params.length > 0) {
      for (let i = 0; i < params.length; i++) {
        stmt.bind(i + 1, params[i]);
      }
    }
    
    const { results } = await stmt.all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

router.get('/api/cards/image', async (request, env) => {
  try {
    const { set, number } = request.query || {};
    
    if (!set || !number) {
      return new Response(JSON.stringify({ error: 'Set and number parameters required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { results } = await env.DB.prepare(
      "SELECT image_url, type FROM cards WHERE card_set = ? AND set_number = ?"
    ).bind(set, number).all();
    
    if (results.length === 0) {
      return new Response(JSON.stringify({ error: 'Card not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      imageUrl: results[0].image_url, 
      type: results[0].type 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Add more API routes here...

// Catch-all route
router.all('*', async (request) => {
  return new Response('Not Found', { status: 404 });
});

// Export the handler function
export default {
  async fetch(request, env, ctx) {
    // Enable CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
      });
    }
    
    // Add CORS headers to all responses
    const response = await router.handle(request, env, ctx);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
    
    // Add headers to the response
    Object.keys(corsHeaders).forEach(key => {
      response.headers.set(key, corsHeaders[key]);
    });
    
    return response;
  }
};