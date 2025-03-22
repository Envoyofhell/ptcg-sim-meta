/**
 * PostgreSQL-Compatible Game State Loader
 * 
 * This module handles loading saved game states from the PostgreSQL database
 * through the server's API endpoint. It includes robust error handling and
 * cross-environment compatibility.
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
  
  // Server URLs for different environments
  serverUrls: {
    production: 'https://ptcg-sim-meta.onrender.com',
    development: 'https://ptcg-sim-meta-dev.onrender.com',
    local: ''
  }
};

/**
 * Determines the appropriate API base URL based on current environment
 * @returns {string} Base URL for API requests
 */
function determineApiBaseUrl() {
  // Production environment (Cloudflare Pages)
  if (window.location.hostname.includes('ptcg-sim-meta.pages.dev')) {
    console.log('Environment detected: Production Cloudflare Pages');
    return CONFIG.serverUrls.production;
  } 
  // Development environment (Cloudflare Pages Dev)
  else if (window.location.hostname.includes('ptcg-sim-meta-dev.pages.dev')) {
    console.log('Environment detected: Development Cloudflare Pages');
    return CONFIG.serverUrls.development;
  }
  // Local development environment
  else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('Environment detected: Local development');
    return CONFIG.serverUrls.local;
  }
  // Fallback for unknown environments
  else {
    console.log('Environment detected: Unknown, using production URL');
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
    console.warn('Chatbox element not found, cannot display message');
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
 * Fetch with timeout and retry capability
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * Fetch with retry capability
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithRetry(url, options = {}) {
  let retries = CONFIG.maxRetries;
  
  while (retries >= 0) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      if (retries === 0) throw error;
      console.warn(`Request failed, retrying... (${retries} attempts left)`);
      retries--;
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Load game state from server using key in URL parameters
 */
export function loadImportData() {
  console.log('Initializing loadImportData function');
  
  // Get the import key from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get('key');
  
  if (!key) {
    console.warn('No import key provided in URL parameters');
    return;
  }
  
  console.log(`Found import key in URL: ${key}`);
  
  // Determine the base URL based on environment
  const baseUrl = determineApiBaseUrl();
  console.log(`Using API base URL: ${baseUrl || 'relative path'}`);
  
  // Show loading message
  displayMessage('Loading game state...', 'info');
  
  // Fetch the saved game state from the server
  const url = `${baseUrl}/api/importData?key=${key}`;
  console.log(`Fetching game state from: ${url}`);
  
  fetchWithRetry(url)
    .then(response => {
      console.log(`Received response with status: ${response.status}`);
      
      // Check content type header to detect HTML error pages
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        // This is an HTML response, not JSON - likely an error page
        return response.text().then(html => {
          console.error('Received HTML instead of JSON:', html.substring(0, 150) + '...');
          throw new Error('Server returned HTML instead of JSON. The API endpoint may be misconfigured.');
        });
      }
      
      if (!response.ok) {
        // Handle different error codes
        switch (response.status) {
          case 404:
            throw new Error('Game state not found. The key may be incorrect or expired.');
          case 500:
            throw new Error('Server error. Please try again later.');
          default:
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
      }
      
      // Parse the JSON response
      return response.json().catch(error => {
        console.error('Error parsing response:', error);
        throw new Error('Invalid response format. Expected JSON.');
      });
    })
    .then(importData => {
      // Validate the imported data
      if (!importData || !Array.isArray(importData) || importData.length === 0) {
        throw new Error('Invalid game state data format');
      }
      
      console.log(`Successfully loaded game state with ${importData.length} actions`);
      
      try {
        // Filter out any non-action objects (like version metadata)
        let actions = importData.filter((obj) => !('version' in obj));
        console.log(`Applying ${actions.length} game actions`);
        
        // Apply each action to restore the game state
        let appliedCount = 0;
        actions.forEach((data, index) => {
          try {
            acceptAction(data.user, data.action, data.parameters, true);
            appliedCount++;
          } catch (actionError) {
            console.error(`Error applying action #${index}:`, actionError, data);
          }
        });
        
        // Refresh the board after all actions are applied
        refreshBoardImages();
        
        // Display success message
        displayMessage(`Game state loaded successfully! Applied ${appliedCount}/${actions.length} actions.`, 'success');
      } catch (processingError) {
        console.error('Error processing game state:', processingError);
        displayMessage(`Error processing game state: ${processingError.message}`, 'error');
      }
    })
    .catch(error => {
      console.error('Error loading game state:', error);
      
      // Format a user-friendly error message
      let errorMessage = `Failed to load game state: ${error.message}`;
      
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The server may be busy or unavailable.';
      } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      displayMessage(errorMessage, 'error');
    });
}