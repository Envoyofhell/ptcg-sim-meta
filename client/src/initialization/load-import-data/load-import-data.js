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
 */
function determineApiBaseUrl() {
    // Check if we're running on Cloudflare Pages
    if (window.location.hostname.includes('pages.dev')) {
        // Production environment - use the Render server URL
        return 'https://ptcg-sim-meta.onrender.com';
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // Local development - use relative path or local server
        return '';
    } else {
        // Fallback for other environments
        return '';
    }
}

/**
 * Load game state from server using key in URL parameters
 */
export function loadImportData() {
    // Get the import key from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key');
    
    if (!key) {
        console.warn('No import key provided in URL parameters');
        return;
    }
    
    // Determine the base URL based on environment
    const baseUrl = determineApiBaseUrl();
    
    // Fetch the saved game state from the server
    fetch(`${baseUrl}/api/importData?key=${key}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(importData => {
            if (importData && Array.isArray(importData) && importData.length > 0) {
                console.log(`Loaded game state with ${importData.length} actions`);
                
                // Filter out any non-action objects (like version metadata)
                let actions = importData.filter((obj) => !('version' in obj));
                
                // Apply each action to restore the game state
                actions.forEach((data) => {
                    acceptAction(data.user, data.action, data.parameters, true);
                });
                
                // Refresh the board after all actions are applied
                refreshBoardImages();
                
                // Add success message to chat
                const chatbox = document.getElementById('chatbox');
                if (chatbox) {
                    const successMsg = document.createElement('p');
                    successMsg.style.color = 'green';
                    successMsg.textContent = `Successfully loaded game state!`;
                    chatbox.appendChild(successMsg);
                }
            } else {
                console.error('Invalid or empty import data received');
                
                // Add error message to chat
                const chatbox = document.getElementById('chatbox');
                if (chatbox) {
                    const errorMsg = document.createElement('p');
                    errorMsg.style.color = 'red';
                    errorMsg.textContent = `Error: Received invalid game state data`;
                    chatbox.appendChild(errorMsg);
                }
            }
        })
        .catch(error => {
            console.error('Error loading game state:', error);
            
            // Display error message to user
            const chatbox = document.getElementById('chatbox');
            if (chatbox) {
                const errorMsg = document.createElement('p');
                errorMsg.style.color = 'red';
                errorMsg.textContent = `Failed to load game state: ${error.message}`;
                chatbox.appendChild(errorMsg);
            }
        });
}