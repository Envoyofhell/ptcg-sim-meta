// Import the WebSocket client first
import { socket } from './websocket-client.js';

// Make the WebSocket client globally available
window.socket = socket;

// Register any Socket.IO event handlers that were stored by the mock
if (window._socketEvents && Array.isArray(window._socketEvents)) {
  window._socketEvents.forEach(({event, callback}) => {
    if (window.socket && window.socket.on) {
      console.log('Transferring event handler from mock to WebSocket:', event);
      window.socket.on(event, callback);
    }
  });
}

// Initialize all globally accessible variables
export * from './initialization/global-variables/global-variables.js';

import { initializeDOMEventListeners } from './initialization/document-event-listeners/initialize-document-event-listeners.js';
import { loadImportData } from './initialization/load-import-data/load-import-data.js';
import { initializeMutationObservers } from './initialization/mutation-observers/initialize-mutation-observers.js';
import { initializeSocketEventListeners } from './initialization/socket-event-listeners/socket-event-listeners.js';

// Initialize socket event listeners
initializeSocketEventListeners();

// Setup the join room button handler
document.addEventListener('DOMContentLoaded', () => {
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
          console.log(`Connecting to room: ${roomId} as ${username} (spectator: ${isSpectator})`);
          // Connect the WebSocket client when joining a room
          socket.connect(roomId, username, isSpectator);
        }
      }
    });
  }
});

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