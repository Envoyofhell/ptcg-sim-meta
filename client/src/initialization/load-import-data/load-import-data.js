/**
 * Enhanced Load Import Data Module
 * 
 * This module handles fetching and loading saved game states from the server.
 * It includes improved error handling, better user feedback, and cross-environment compatibility.
 */
import { acceptAction } from '../../setup/general/accept-action.js';
import { refreshBoardImages } from '../../setup/sizing/refresh-board.js';

/**
 * Configuration options - customizable via environment or build settings
 */
const CONFIG = {
  // Maximum time to wait for server response in milliseconds
  requestTimeout: 30000,
  
  // Number of retries for failed requests
  maxRetries: 2,
  
  // Server URLs for different environments
  serverUrls: {
    production: 'https://ptcg-sim-meta.onrender.com',
    development: 'https://ptcg-sim-meta-dev.onrender.com',
    local: '',
  }
};

/**
 * Determines the appropriate API base URL based on environment
 * @returns {string} Base URL for API requests
 */
function determineApiBaseUrl() {
  // Detect environment based on hostname
  if (window.location.hostname.includes('ptcg-sim-meta.pages.dev')) {
    // Production Cloudflare Pages
    console.log('Environment detected: Production (Cloudflare Pages)');
    return CONFIG.serverUrls.production;
  } else if (window.location.hostname.includes('ptcg-sim-meta-dev.pages.dev')) {
    // Development Cloudflare Pages
    console.log('Environment detected: Development (Cloudflare Pages)');
    return CONFIG.serverUrls.development;
  } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Local development - use relative path
    console.log('Environment detected: Local development');
    return CONFIG.serverUrls.local;
  } else {
    // Fallback for other environments
    console.log('Environment detected: Unknown, using production URL');
    return CONFIG.serverUrls.production;
  }
}

/**
 * Display message in the chatbox with colored formatting
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
 * Fetch with timeout and retry
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} retries - Number of retries
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options = {}, timeout = CONFIG.requestTimeout, retries = CONFIG.maxRetries) {
  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // Add abort signal to options
  const fetchOptions = {
    ...options,
    signal: controller.signal
  };
  
  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`Request to ${url} timed out after ${timeout}ms`);
      if (retries > 0) {
        console.log(`Retrying... (${retries} attempts left)`);
        return fetchWithRetry(url, options, timeout, retries - 1);
      }
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    
    if (retries > 0) {
      console.log(`Request failed, retrying... (${retries} attempts left)`);
      return fetchWithRetry(url, options, timeout, retries - 1);
    }
    
    throw error;
  }
}

/**
 * Load game state from server using key in URL parameters
 * Enhanced with better error handling, retry logic, and user feedback
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
  
  // Build the full URL
  const url = `${baseUrl}/api/importData?key=${key}`;
  console.log(`Fetching game state from: ${url}`);
  
  // Fetch the saved game state from the server with retry logic
  fetchWithRetry(url)
    .then(response => {
      console.log(`Received response with status: ${response.status}`);
      
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
      
      // Try to parse the response as JSON
      return response.json().catch(error => {
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
            displayMessage(`Warning: Error applying action #${index}`, 'warning');
          }
        });
        
        // Refresh the board after all actions are applied
        refreshBoardImages();
        
        // Display success message with action count
        displayMessage(`Game state loaded successfully! Applied ${appliedCount}/${actions.length} actions.`, 'success');
        
        // If not all actions were applied, show a warning
        if (appliedCount < actions.length) {
          displayMessage(`Warning: ${actions.length - appliedCount} actions could not be applied.`, 'warning');
        }
        
        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        displayMessage(`Import completed at ${timestamp}`, 'info');
      } catch (processingError) {
        console.error('Error processing game state:', processingError);
        displayMessage(`Error processing game state: ${processingError.message}`, 'error');
      }
    })
    .catch(error => {
      console.error('Error loading game state:', error);
      
      // Display user-friendly error message
      let errorMessage;
      
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.name === 'AbortError' || error.message.includes('timed out')) {
        errorMessage = 'Request timed out. The server may be busy or unavailable.';
      } else {
        errorMessage = `Failed to load game state: ${error.message}`;
      }
      
      displayMessage(errorMessage, 'error');
      
      // Suggest fixes
      displayMessage('Suggestions:', 'info');
      displayMessage('1. Check that the URL is correct', 'info');
      displayMessage('2. Try refreshing the page', 'info');
      displayMessage('3. Try again later', 'info');
    });
}