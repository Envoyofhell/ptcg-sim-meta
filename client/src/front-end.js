// Import the WebSocket client first to ensure it's available globally
import { socket } from './websocket-client.js';

// Make socket available globally for interceptor script in index.html
window.socket = socket;

// Initialize all globally accessible variables
export * from './initialization/global-variables/global-variables.js';

import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';

// Initialize connection only when needed (to avoid premature connections)
const joinRoomButton = document.getElementById('joinRoomButton');
if (joinRoomButton) {
  joinRoomButton.addEventListener('click', () => {
    const roomIdInput = document.getElementById('roomIdInput');
    const nameInput = document.getElementById('nameInput');
    const spectatorModeCheckbox = document.getElementById('spectatorModeCheckbox');
    
    if (roomIdInput && nameInput) {
      const roomId = roomIdInput.value.trim();
      const username = nameInput.value.trim();
      const isSpectator = spectatorModeCheckbox && spectatorModeCheckbox.checked;
      
      if (roomId && username) {
        // Connect the WebSocket client when joining a room
        socket.connect(roomId, username, isSpectator);
      }
    }
  });
}

// Initialize socket event listeners before other functionality
initializeSocketEventListeners();

// Initialize other components
initializeDOMEventListeners();
initializeMutationObservers();
loadImportData();

// Add a helper function to detect environment
export function getEnvironmentInfo() {
  return {
    host: window.location.host,
    protocol: window.location.protocol,
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1'),
    isCloudflare: window.location.hostname.includes('.pages.dev') || 
                 window.location.hostname.includes('meta-ptcg.org') ||
                 window.location.hostname.includes('.workers.dev')
  };
}

// Log environment info for debugging
console.log('Environment:', getEnvironmentInfo());