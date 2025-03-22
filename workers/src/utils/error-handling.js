/**
 * Error handling utilities
 * 
 * This module provides functions for consistent error handling
 * and response formatting across API endpoints.
 */
import { log, logError } from './logging';
import { corsHeaders } from './cors';

/**
 * Create a JSON error response with consistent formatting
 * 
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Optional error details
 * @returns {Response} HTTP error response
 */
export function errorResponse(status, message, details = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...corsHeaders
  };
  
  const body = {
    success: false,
    error: message
  };
  
  // Add details if provided
  if (details) {
    body.details = details;
  }
  
  return new Response(
    JSON.stringify(body),
    { status, headers }
  );
}

/**
 * Handle errors in request processing
 * 
 * @param {Error} error - Error object
 * @param {string} context - Error context description
 * @returns {Response} HTTP error response
 */
export function handleError(error, context = 'API Error') {
  // Log the error with context
  logError(error, context);
  
  // Default error message and status
  let status = 500;
  let message = 'Internal Server Error';
  let details = error.message;
  
  // Customize response based on error type
  if (error.name === 'ValidationError') {
    status = 400;
    message = 'Validation Error';
  } else if (error.name === 'NotFoundError') {
    status = 404;
    message = 'Resource Not Found';
  } else if (error.name === 'AuthenticationError') {
    status = 401;
    message = 'Authentication Required';
  } else if (error.name === 'AuthorizationError') {
    status = 403;
    message = 'Permission Denied';
  } else if (error.name === 'RateLimitError') {
    status = 429;
    message = 'Rate Limit Exceeded';
  }
  
  // Create and return the error response
  return errorResponse(status, message, details);
}

/**
 * Wrap a request handler with error handling
 * 
 * @param {Function} handler - Request handler function
 * @param {string} context - Error context description
 * @returns {Function} Wrapped handler with error handling
 */
export function withErrorHandling(handler, context) {
  return async (request, ...args) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return handleError(error, context);
    }
  };
}

/**
 * Create custom error classes for different error types
 */

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}