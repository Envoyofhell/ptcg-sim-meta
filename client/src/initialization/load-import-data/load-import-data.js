/**
 * PostgreSQL-Compatible Game State Loader
 * 
 * This module handles loading saved game states from the PostgreSQL database
 * through the server's API endpoint. Features include:
 * - Cross-environment detection (production, dev, local)
 * - Enhanced error handling and user feedback
 * - Retries for failed network requests
 * - Timeout handling
 * - Detailed logging
 */
import { acceptAction } from '../../setup/general/accept-action.js';
import { refreshBoardImages } from '../../setup/sizing/refresh-board.js';

/**
 * Configuration options
 */
const CONFIG = {
  // Request timeout in milliseconds
  requestTimeout: 30000,
  
  // Number of retries for failed requests
  maxRetries: 2,
  
  // Retry delay in milliseconds
  retryDelay: 1000,
  
  // Server URLs for different environments
  serverUrls: {
    production: 'https://ptcg-sim-meta.jasonh1993.workers.dev',
    development: 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
    local: ''
  },
  
  // Debug mode for detailed logging
  debug: true
};

/**
 * Enhanced console logging with timestamps
 * @param {string} message - Log message
 * @param {string} level - Log level (info, warn, error, debug)
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  let method = console.log;
  let prefix = '';
  
  switch (level) {
    case 'error':
      method = console.error;
      prefix = '🔴 ERROR';
      break;
    case 'warn':
      method = console.warn;
      prefix = '🟠 WARNING';
      break;
    case 'debug':
      if (!CONFIG.debug) return;
      prefix = '🔍 DEBUG';
      break;
    case 'success':
      prefix = '🟢 SUCCESS';
      break;
    default:
      prefix = '🔵 INFO';
  }
  
  method(`[${timestamp}] ${prefix}: ${message}`);
}

/**
 * Determines the appropriate API base URL based on current environment
 * @returns {string} Base URL for API requests
 */
function determineApiBaseUrl() {
  const hostname = window.location.hostname;
  log(`Current hostname: ${hostname}`, 'debug');
  
  // Production environment (Cloudflare Pages)
  if (hostname.includes('ptcg-sim-meta.pages.dev')) {
    log('Environment detected: Production Cloudflare Pages', 'info');
    return CONFIG.serverUrls.production;
  } 
  // Development environment (Cloudflare Pages Dev)
  else if (hostname.includes('ptcg-sim-meta-dev.pages.dev')) {
    log('Environment detected: Development Cloudflare Pages', 'info');
    return CONFIG.serverUrls.development;
  }
  // Local development environment
  else if (hostname === 'localhost' || hostname === '127.0.0.1') {
    log('Environment detected: Local development', 'info');
    // For local development, we use a relative URL which doesn't need a base
    return CONFIG.serverUrls.local;
  }
  // Fallback for unknown environments
  else {
    log('Environment detected: Unknown, using production URL', 'warn');
    return CONFIG.serverUrls.production;
  }
}

/**
 * Display message in the chatbox
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, info, warning)
 */
function displayMessage(message, type = 'info') {
  const chatbox = document.getElementById('chatbox');
  if (!chatbox) {
    log('Chatbox element not found, cannot display message', 'warn');
    return;
  }
  
  const messageElement = document.createElement('p');
  
  // Set message style based on type
  switch (type) {
    case 'success':
      messageElement.style.color = '#2ecc71'; // Green
      break;
    case 'error':
      messageElement.style.color = '#e74c3c'; // Red
      break;
    case 'warning':
      messageElement.style.color = '#f39c12'; // Orange
      break;
    case 'info':
    default:
      messageElement.style.color = '#3498db'; // Blue
      break;
  }
  
  messageElement.textContent = message;
  chatbox.appendChild(messageElement);
  
  // Scroll to bottom of chatbox
  chatbox.scrollTop = chatbox.scrollHeight;
}

/**
 * Fetch with timeout to prevent hanging requests
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithTimeout(url, options = {}) {
  // Create abort controller for timeout
  const controller = new AbortController();
  const signal = controller.signal;
  
  // Set timeout to abort request if it takes too long
  const timeout = setTimeout(() => {
    controller.abort();
  }, CONFIG.requestTimeout);
  
  try {
    // Make request with abort signal
    const response = await fetch(url, {
      ...options,
      signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Fetch with retry capability for resilience
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithRetry(url, options = {}) {
  let lastError;
  
  // Try the request multiple times
  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      // If not the first attempt, wait before retrying
      if (attempt > 0) {
        log(`Retry attempt ${attempt}/${CONFIG.maxRetries}...`, 'info');
        await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay));
      }
      
      // Make the request with timeout
      return await fetchWithTimeout(url, options);
    } catch (error) {
      lastError = error;
      log(`Request failed (attempt ${attempt + 1}/${CONFIG.maxRetries + 1}): ${error.message}`, 'warn');
      
      // If this was the last attempt, throw the error
      if (attempt === CONFIG.maxRetries) {
        throw error;
      }
    }
  }
  
  // This should never happen, but just in case
  throw lastError || new Error('Failed to fetch after retries');
}

/**
 * Process error response and extract useful information
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} - Error details
 */
async function processErrorResponse(response) {
  // Try to parse as JSON first
  try {
    const errorData = await response.json();
    return {
      status: response.status,
      message: errorData.error || response.statusText,
      details: errorData.details || null
    };
  } catch (e) {
    // If not JSON, try to get text
    try {
      const errorText = await response.text();
      
      // Check if it's HTML (likely an error page)
      if (errorText.includes('<!DOCTYPE html>') || errorText.includes('<html')) {
        return {
          status: response.status,
          message: 'Received HTML error page instead of JSON',
          isHtml: true,
          preview: errorText.substring(0, 100) + '...'
        };
      } else {
        return {
          status: response.status,
          message: response.statusText,
          text: errorText.substring(0, 100) + (errorText.length > 100 ? '...' : '')
        };
      }
    } catch (textError) {
      // If we can't even get text, just return the status
      return {
        status: response.status,
        message: response.statusText
      };
    }
  }
}

/**
 * Load game state from server using key in URL parameters
 * Enhanced with better error handling, retry logic, and user feedback
 */
export function loadImportData() {
  log('Initializing loadImportData function', 'info');
  
  // Get the import key from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get('key');
  
  if (!key) {
    log('No import key provided in URL parameters', 'warn');
    return;
  }
  
  log(`Found import key in URL: ${key}`, 'info');
  
  // Determine the base URL based on environment
  const baseUrl = determineApiBaseUrl();
  log(`Using API base URL: ${baseUrl || 'relative path'}`, 'debug');
  
  // Build the full URL
  const url = `${baseUrl}/api/importData?key=${key}`;
  log(`Fetching game state from: ${url}`, 'info');
  
  // Show loading message
  displayMessage('Loading game state...', 'info');
  
  // Fetch the saved game state from the server with retry logic
  fetchWithRetry(url)
    .then(response => {
      log(`Received response with status: ${response.status}`, 'debug');
      
      // Check content type to detect HTML error pages
      const contentType = response.headers.get('content-type');
      log(`Response content type: ${contentType}`, 'debug');
      
      if (contentType && contentType.includes('text/html')) {
        // This is an HTML response, not JSON - likely an error page
        return response.text().then(html => {
          log('Received HTML instead of JSON', 'error');
          log(`HTML preview: ${html.substring(0, 100)}...`, 'debug');
          throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured.');
        });
      }
      
      // If response is not OK, process the error
      if (!response.ok) {
        return processErrorResponse(response).then(errorDetails => {
          throw new Error(`Server error (${errorDetails.status}): ${errorDetails.message}`);
        });
      }
      
      // Try to parse JSON response
      return response.json().catch(jsonError => {
        log(`JSON parsing error: ${jsonError.message}`, 'error');
        throw new Error('Invalid JSON response from server');
      });
    })
    .then(importData => {
      // Validate the imported data
      if (!importData) {
        throw new Error('Received empty response from server');
      }
      
      if (!Array.isArray(importData)) {
        log(`Unexpected data format: ${typeof importData}`, 'error');
        log(`Data preview: ${JSON.stringify(importData).substring(0, 100)}...`, 'debug');
        throw new Error('Invalid game state data format (not an array)');
      }
      
      if (importData.length === 0) {
        throw new Error('Game state contains no actions');
      }
      
      log(`Successfully loaded game state with ${importData.length} actions`, 'success');
      
      try {
        // Filter out any non-action objects (like version metadata)
        let actions = importData.filter((obj) => !('version' in obj));
        log(`Applying ${actions.length} game actions`, 'info');
        
        // Apply each action to restore the game state
        let appliedCount = 0;
        let errors = 0;
        
        actions.forEach((data, index) => {
          try {
            // Apply the action to restore state
            acceptAction(data.user, data.action, data.parameters, true);
            appliedCount++;
          } catch (actionError) {
            errors++;
            log(`Error applying action #${index}: ${actionError.message}`, 'error');
          }
        });
        
        // Refresh the board after all actions are applied
        refreshBoardImages();
        
        // Display success message with action count
        displayMessage(`Game state loaded successfully! Applied ${appliedCount}/${actions.length} actions.`, 'success');
        
        // If there were errors, show a warning
        if (errors > 0) {
          displayMessage(`Warning: ${errors} action(s) failed to apply.`, 'warning');
        }
      } catch (processingError) {
        log(`Error processing game state: ${processingError.message}`, 'error');
        displayMessage(`Error processing game state: ${processingError.message}`, 'error');
      }
    })
    .catch(error => {
      log(`Error loading game state: ${error.message}`, 'error');
      
      // Display user-friendly error message
      let errorMessage;
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The server may be busy or unavailable.';
      } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('HTML')) {
        errorMessage = 'The server returned an HTML page instead of game data. This may indicate a server configuration issue.';
      } else {
        errorMessage = `Failed to load game state: ${error.message}`;
      }
      
      displayMessage(errorMessage, 'error');
      
      // Show troubleshooting tips
      displayMessage('Troubleshooting tips:', 'info');
      displayMessage('1. Check that the URL and key are correct', 'info');
      displayMessage('2. Make sure the server is running', 'info');
      displayMessage('3. Try refreshing the page', 'info');
    });
}