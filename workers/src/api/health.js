// File: workers/src/api/health.js
/**
 * Health check API handlers
 * 
 * This module provides comprehensive status checks for the worker and database
 */
import { log } from '../utils/logging';
import { getDbClient } from '../db/client';

export async function getHealth(request) {
  const headers = { 'Content-Type': 'application/json' };
  
  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.5.1',
      worker: {
        status: 'ok',
        environment: request.env.ENVIRONMENT || 'production'
      },
      socketio: {
        status: 'limited',
        message: 'Basic Socket.IO compatibility layer available'
      },
      database: {
        status: 'checking'
      },
      features: {
        rest_api: 'full',
        websockets: 'partial',
        socketio: 'minimal',
        database: 'full'
      }
    };
    
    // Test database connection if available
    try {
      if (request.env.DATABASE_URL) {
        const pool = getDbClient(request.env);
        const result = await pool.query('SELECT NOW() as time');
        
        healthData.database = {
          status: 'ok',
          time: result.rows[0].time
        };
      } else {
        healthData.database = {
          status: 'disabled',
          message: 'No database connection available'
        };
      }
    } catch (dbError) {
      log(`Database health check failed: ${dbError.message}`, 'error');
      
      healthData.database = {
        status: 'error',
        error: dbError.message
      };
      
      healthData.status = 'degraded';
    }
    
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