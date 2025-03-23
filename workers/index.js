// workers/index.js (Simplified Socket.IO support)

import { Router } from 'itty-router';
import { corsHeaders, handleOptions } from './src/utils/cors';
import * as gameStateApi from './src/api/game-state';
import * as healthApi from './src/api/health';

const router = Router();

// Basic Socket.IO handshake handler
async function handleSocketIO(request) {
  const url = new URL(request.url);
  const headers = {
    'Content-Type': 'text/plain; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  
  // For handshake
  if (!url.searchParams.has('sid')) {
    const sid = Math.random().toString(36).substring(2, 15);
    const handshakeData = {
      sid,
      upgrades: ['websocket'],
      pingInterval: 25000,
      pingTimeout: 20000
    };
    
    return new Response(`0${JSON.stringify(handshakeData)}`, { headers });
  }
  
  // For polling GET (client receiving data)
  if (request.method === 'GET') {
    return new Response('', { headers });
  }
  
  // For polling POST (client sending data)
  if (request.method === 'POST') {
    try {
      const body = await request.text();
      console.log(`Received Socket.IO message: ${body}`);
      
      // Acknowledge message
      return new Response('3', { headers });
    } catch (error) {
      console.error(`Error processing Socket.IO message: ${error}`);
      return new Response('4{"message":"Error processing message"}', { headers });
    }
  }
  
  return new Response('Method not allowed', { status: 405, headers });
}

// Setup routes
router.options('*', handleOptions);
router.get('/health', healthApi.getHealth);
router.get('/api/health', healthApi.getHealth);
router.get('/api/importData', gameStateApi.getGameState);
router.post('/api/storeGameState', gameStateApi.storeGameState);
router.delete('/api/gameState/:key', gameStateApi.deleteGameState);
router.get('/api/stats', gameStateApi.getStats);

// Socket.IO compatibility routes
router.get('/socket.io/', handleSocketIO);
router.post('/socket.io/', handleSocketIO);

// Catch-all 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request, env, ctx) {
    try {
      request.env = env;
      
      const response = await router.handle(request);
      
      // Add CORS headers
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      console.error(`Error handling request: ${error}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Internal Server Error',
          message: error.message 
        }), 
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
  }
};