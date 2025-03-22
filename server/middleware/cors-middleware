/**
 * CORS middleware configuration for PTCG-Sim-Meta
 * Sets up CORS for Express application
 */
import cors from 'cors';
import { getAppropriateConfig } from '../config/cors.js';

/**
 * Create CORS middleware with appropriate configuration
 * 
 * @param {Array<string>} additionalOrigins - Additional origins to allow
 * @returns {Function} - Express middleware function
 */
export function createCorsMiddleware(additionalOrigins = []) {
  const corsOptions = getAppropriateConfig(additionalOrigins);
  return cors(corsOptions);
}

/**
 * Apply CORS middleware to Express application
 * 
 * @param {Object} app - Express application
 * @param {Array<string>} additionalOrigins - Additional origins to allow
 */
export function applyCors(app, additionalOrigins = []) {
  const middleware = createCorsMiddleware(additionalOrigins);
  app.use(middleware);
  
  // Enable pre-flight requests for all routes
  app.options('*', middleware);
  
  console.log('CORS middleware applied');
}