/**
 * Health check API handlers
 * 
 * This module provides endpoints for monitoring the health and status
 * of the worker and its database connection.
 */
import { log } from '../utils/logging';
import { getDbClient } from '../db/client';

/**
 * Get health status of the worker and database
 * 
 * @param {Request} request - HTTP request
 * @returns {Response} HTTP response
 */
export async function getHealth(request) {
  const headers = { 'Content-Type': 'application/json' };
  
  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      worker: {
        status: 'ok',
        environment: request.env.ENVIRONMENT || 'unknown'
      },
      database: {
        status: 'unknown'
      }
    };
    
    // Test database connection
    try {
      const pool = getDbClient(request.env);
      const result = await pool.query('SELECT NOW() as time');
      
      healthData.database = {
        status: 'ok',
        time: result.rows[0].time
      };
    } catch (dbError) {
      log(`Database health check failed: ${dbError.message}`, 'error');
      
      healthData.status = 'degraded';
      healthData.database = {
        status: 'error',
        error: dbError.message
      };
    }
    
    // Return health status
    return new Response(
      JSON.stringify(healthData),
      { 
        status: healthData.status === 'ok' ? 200 : 503,
        headers
      }
    );
  } catch (error) {
    log(`Error in health check: ${error.message}`, 'error');
    
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      }),
      { status: 500, headers }
    );
  }
}