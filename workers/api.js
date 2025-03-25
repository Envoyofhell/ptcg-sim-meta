// workers/api.js
/**
 * API request handlers for the PTCG-sim-meta application
 */

import { getGameState } from './gamestate.js';

/**
 * Handles API requests for game data
 *
 * @param {Request} request - Incoming HTTP request
 * @param {Object} env - Worker environment bindings
 * @returns {Response|null} - HTTP response or null if not handled
 */
export async function handleApiRequests(request, env) {
  const url = new URL(request.url);

  // Handle importing game data
  if (url.pathname === '/api/importData') {
    return await handleImportData(request, env);
  }

  // If no handler matched, return null
  return null;
}

/**
 * Handle game state import requests
 *
 * @param {Request} request - Incoming HTTP request
 * @param {Object} env - Worker environment bindings
 * @returns {Response} - HTTP response
 */
async function handleImportData(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (!key) {
    return jsonResponse({ error: 'Key parameter is missing' }, 400);
  }

  try {
    // Get game state from D1 database
    const gameState = await getGameState(env, key);

    if (gameState) {
      // Return the game state data
      return new Response(gameState, {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return jsonResponse({ error: 'Game state not found' }, 404);
    }
  } catch (error) {
    console.error(`Error retrieving game state: ${error.message}`);
    return jsonResponse(
      {
        error: 'Database error',
        details: error.message,
      },
      500
    );
  }
}

/**
 * Create a JSON response
 *
 * @param {Object} data - Response data
 * @param {number} status - HTTP status code
 * @returns {Response} - HTTP response
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
