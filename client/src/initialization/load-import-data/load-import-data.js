/**
 * Load imported game state data from server database
 * 
 * This script handles fetching saved game states using a key parameter
 * from the URL and applies the actions to restore the game state.
 * Updated to work with both local development and production environments.
 */
import { acceptAction } from '../../setup/general/accept-action.js';
import { refreshBoardImages } from '../../setup/sizing/refresh-board.js';

/**
 * Determines the appropriate API base URL based on environment
 * @returns {string} Base URL for API requests
 */
function determineApiBaseUrl() {
    // Check if we're running on Cloudflare Pages
    if (window.location.hostname.includes('pages.dev')) {
        // Production environment - use the Render server URL
        console.log('Environment detected: Cloudflare Pages (production)');
        return 'https://ptcg-sim-meta.onrender.com';
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Local development - use relative path
        console.log('Environment detected: Local development');
        return '';
    } else {
        // Fallback for other environments
        console.log('Environment detected: Unknown');
        return '';
    }
}

/**
 * Display message in the chatbox
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, info)
 */
function displayMessage(message, type = 'info') {
    const chatbox = document.getElementById('chatbox');
    if (!chatbox) {
        console.warn('Chatbox element not found');
        return;
    }
    
    const messageElement = document.createElement('p');
    
    // Set message style based on type
    switch (type) {
        case 'success':
            messageElement.style.color = 'green';
            break;
        case 'error':
            messageElement.style.color = 'red';
            break;
        case 'info':
        default:
            messageElement.style.color = 'blue';
            break;
    }
    
    messageElement.textContent = message;
    chatbox.appendChild(messageElement);
    
    // Scroll to bottom of chatbox
    chatbox.scrollTop = chatbox.scrollHeight;
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
    console.log(`Fetching game state from: ${baseUrl}/api/importData?key=${key}`);
    
    fetch(`${baseUrl}/api/importData?key=${key}`)
        .then(response => {
            console.log(`Received response with status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(importData => {
            if (importData && Array.isArray(importData) && importData.length > 0) {
                console.log(`Successfully loaded game state with ${importData.length} actions`);
                
                // Filter out any non-action objects (like version metadata)
                let actions = importData.filter((obj) => !('version' in obj));
                console.log(`Applying ${actions.length} game actions`);
                
                // Apply each action to restore the game state
                actions.forEach((data, index) => {
                    try {
                        acceptAction(data.user, data.action, data.parameters, true);
                    } catch (actionError) {
                        console.error(`Error applying action #${index}:`, actionError, data);
                    }
                });
                
                // Refresh the board after all actions are applied
                refreshBoardImages();
                
                // Display success message
                displayMessage('Game state loaded successfully!', 'success');
            } else {
                console.error('Invalid or empty import data received:', importData);
                displayMessage('Error: Received invalid game state data', 'error');
            }
        })
        .catch(error => {
            console.error('Error loading game state:', error);
            displayMessage(`Failed to load game state: ${error.message}`, 'error');
        });
}