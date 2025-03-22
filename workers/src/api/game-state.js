/**
 * Game state API handlers
 * 
 * This module provides HTTP handlers for game state operations,
 * mapping API requests to database operations.
 */
import { log } from '../utils/logging';
import { isValidKey, generateRandomKey } from '../utils/key-generator';
import * as gameStateDb from '../db/game-state';

/**
 * Get a game state by key
 * 
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
export async function getGameState(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  
  // Set content type to JSON for all responses
  const headers = { 'Content-Type': 'application/json' };
  
  // Validate key parameter
  if (!key) {
    log('Request missing key parameter', 'warn');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Key parameter is missing' 
      }), 
      { status: 400, headers }
    );
  }
  
  // Validate key format
  if (!isValidKey(key)) {
    log(`Invalid key format: ${key}`, 'warn');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Invalid key format' 
      }), 
      { status: 400, headers }
    );
  }
  
  try {
    // Get game state from database
    const result = await gameStateDb.getGameStateByKey(request.env, key);
    
    if (!result.found) {
      log(`Game state with key ${key} not found`, 'warn');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Game state not found' 
        }), 
        { status: 404, headers }
      );
    }
    
    // Parse game state data
    try {
      const jsonData = JSON.parse(result.value);
      
      // Return the game state data directly
      // This matches the expected format for the client
      return new Response(
        result.value,
        { status: 200, headers }
      );
    } catch (parseError) {
      log(`Error parsing JSON data: ${parseError.message}`, 'error');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error parsing game state data',
          details: parseError.message
        }), 
        { status: 500, headers }
      );
    }
  } catch (error) {
    log(`Error retrieving game state: ${error.message}`, 'error');
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Database error',
        details: error.message
      }), 
      { status: 500, headers }
    );
  }
}

/**
 * Store a game state
 * 
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
export async function storeGameState(request) {
  const headers = { 'Content-Type': 'application/json' };
  
  try {
    // Parse request body
    const body = await request.json();
    
    // Validate body
    if (!body || (!body.gameState && !body.exportData)) {
      log('Request missing gameState in body', 'warn');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Game state data is missing'
        }),
        { status: 400, headers }
      );
    }
    
    // Get game state data from request
    // Support both formats: gameState (HTTP API) and exportData (Socket.IO compatible)
    const gameStateData = body.gameState || body.exportData;
    
    // Get or generate key
    const key = body.key || generateRandomKey(4);
    
    // Validate custom key if provided
    if (body.key && !isValidKey(body.key)) {
      log(`Invalid custom key format: ${body.key}`, 'warn');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid key format'
        }),
        { status: 400, headers }
      );
    }
    
    // Validate data type
    const gameStateStr = typeof gameStateData === 'string' 
      ? gameStateData 
      : JSON.stringify(gameStateData);
    
    // Check size
    const sizeBytes = new TextEncoder().encode(gameStateStr).length;
    const sizeMB = sizeBytes / (1024 * 1024);
    const maxSizeMB = 50; // 50MB limit
    
    if (sizeMB > maxSizeMB) {
      log(`Game state too large: ${sizeMB.toFixed(2)}MB > ${maxSizeMB}MB`, 'warn');
      return new Response(
        JSON.stringify({
          success: false,
          error: `Game state too large (${sizeMB.toFixed(2)}MB > ${maxSizeMB}MB limit)`
        }),
        { status: 413, headers }
      );
    }
    
    // Collect metadata
    const metadata = {
      ...(body.metadata || {}),
      userAgent: request.headers.get('User-Agent'),
      contentType: request.headers.get('Content-Type'),
      timestamp: new Date().toISOString(),
      origin: request.headers.get('Origin')
    };
    
    // Store game state
    const result = await gameStateDb.storeGameState(
      request.env,
      key,
      gameStateStr,
      metadata
    );
    
    // Return success response
    // Support exportGameStateSuccessful format for Socket.IO compatibility
    if (body.exportData) {
      return new Response(
        JSON.stringify({
          success: true,
          key: key,
          size: {
            bytes: result.size_bytes,
            megabytes: (result.size_bytes / (1024 * 1024)).toFixed(2)
          }
        }),
        { status: 201, headers }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          key: key,
          size: {
            bytes: result.size_bytes,
            megabytes: (result.size_bytes / (1024 * 1024)).toFixed(2)
          }
        }),
        { status: 201, headers }
      );
    }
  } catch (error) {
    log(`Error storing game state: ${error.message}`, 'error');
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error storing game state in database',
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}

/**
 * Delete a game state
 * 
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
export async function deleteGameState(request) {
  const headers = { 'Content-Type': 'application/json' };
  
  // Get key from URL params
  const { params } = request;
  const key = params.key;
  
  // Validate key
  if (!isValidKey(key)) {
    log(`Invalid key format for deletion: ${key}`, 'warn');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid key format'
      }),
      { status: 400, headers }
    );
  }
  
  try {
    // Delete game state
    const result = await gameStateDb.deleteGameState(request.env, key);
    
    if (result.deleted) {
      log(`Deleted game state ${key} from database`, 'success');
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Game state not found'
        }),
        { status: 404, headers }
      );
    }
  } catch (error) {
    log(`Error deleting game state: ${error.message}`, 'error');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Database error',
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}

/**
 * Get database statistics
 * 
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
export async function getStats(request) {
  const headers = { 'Content-Type': 'application/json' };
  
  try {
    const stats = await gameStateDb.getDatabaseStats(request.env);
    
    return new Response(
      JSON.stringify(stats),
      { status: 200, headers }
    );
  } catch (error) {
    log(`Error getting database stats: ${error.message}`, 'error');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error retrieving database statistics',
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}