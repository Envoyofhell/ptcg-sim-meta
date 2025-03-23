// New client/src/services/socket-service.js
import { log } from '../utils/logging.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.offlineMode = false;
    this.eventHandlers = new Map();
    this.pendingEmits = [];
    
    this.lastConnectedTime = null;
    this.connectionMetrics = {
      connectCount: 0,
      disconnectCount: 0,
      errorCount: 0,
      lastErrorMessage: null
    };
    this.debugLog = [];
    this.debugLogMaxSize = 100;
  }

  async initialize() {
    try {
      log('Initializing Socket.IO connection...', 'info');
      
      // Detect environment and choose appropriate socket URL
      const socketUrl = this.determineSocketUrl();
      log(`Using Socket.IO URL: ${socketUrl}`, 'debug');
      
      // Connection options with increased timeout and reliability settings
      const options = {
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 15000, // Increased timeout 
        transports: ['polling', 'websocket'],
        forceNew: true,
        autoConnect: true
      };
      
      // Check if io is available
      if (typeof io === 'undefined') {
        this.switchToOfflineMode('Socket.IO library not available');
        return;
      }
      
      // Create socket with error handling
      this.socket = io(socketUrl, options);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Set a connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.connected) {
          log('Socket.IO connection timeout', 'error');
          this.switchToOfflineMode('Connection timeout');
        }
      }, 20000);
      
      return this.socket;
    } catch (error) {
      log(`Error initializing Socket.IO: ${error.message}`, 'error');
      this.switchToOfflineMode(error.message);
      return this.createOfflineModeSocket();
    }
  }
  
  setupEventHandlers() {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      clearTimeout(this.connectionTimeout);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.offlineMode = false;
      log(`Socket.IO connected (ID: ${this.socket.id})`, 'success');
      
      // Process any pending emits
      this.processPendingEmits();
      
      // Notify connection success to UI
      this.displayConnectionStatus(true);
    });
    
    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      log(`Socket.IO disconnected: ${reason}`, 'warn');
      
      // Notify connection loss to UI
      this.displayConnectionStatus(false, reason);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        log('Server initiated disconnect, not attempting to reconnect', 'warn');
      }
    });
    
    this.socket.on('connect_error', (error) => {
      log(`Socket.IO connection error: ${error.message}`, 'error');
      
      // If we've reached max reconnection attempts, switch to offline mode
      if (++this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.switchToOfflineMode(`Failed after ${this.maxReconnectAttempts} attempts`);
      }
    });
    
    // Initialize with a heartbeat to keep the connection alive
    setInterval(() => {
      if (this.connected && this.socket) {
        this.socket.emit('heartbeat');
      }
    }, 25000);
  }
  
  determineSocketUrl() {
    const hostname = window.location.hostname;
    
    // Map of environments to socket URLs
    const urls = {
      'localhost': 'http://localhost:4000',
      '127.0.0.1': 'http://localhost:4000',
      'ptcg-sim-meta-dev.pages.dev': 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev',
      'ptcg-sim-meta.pages.dev': 'https://ptcg-sim-meta.jasonh1993.workers.dev'
    };
    
    // Get URL from map or use production as default
    return urls[hostname] || 'https://ptcg-sim-meta.jasonh1993.workers.dev';
  }
  
  switchToOfflineMode(reason) {
    if (this.offlineMode) return; // Already in offline mode
    
    this.offlineMode = true;
    log(`Switching to offline mode: ${reason}`, 'warn');
    
    // Create offline mode socket
    this.socket = this.createOfflineModeSocket();
    this.displayConnectionStatus(false, 'Offline Mode');
    
    // Notify the user of offline mode
    this.displayOfflineModeNotification();
  }
  
  createOfflineModeSocket() {
    log('Creating offline mode socket', 'info');
    
    // Create a fake socket that mimics the real one
    const fakeSocket = {
      id: `offline-${Date.now()}`,
      connected: true,
      disconnected: false,
      
      on: (event, callback) => {
        if (!this.eventHandlers.has(event)) {
          this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(callback);
        return fakeSocket;
      },
      
      emit: (event, ...args) => {
        log(`[Offline] Emit ${event}`, 'debug');
        
        // Handle special events
        if (event === 'storeGameState') {
          this.handleOfflineStoreGameState(...args);
        }
        
        return fakeSocket;
      },
      
      // Add other Socket.IO methods as needed
      connect: () => fakeSocket,
      disconnect: () => fakeSocket
    };
    
    // Simulate a connection event
    setTimeout(() => {
      const connectHandlers = this.eventHandlers.get('connect') || [];
      connectHandlers.forEach(handler => handler());
    }, 100);
    
    return fakeSocket;
  }
  
  handleOfflineStoreGameState(data) {
    try {
      // Store game state in local storage instead of server
      const key = `game-state-${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(data));
      
      // Trigger success handler
      const handlers = this.eventHandlers.get('exportGameStateSuccessful') || [];
      handlers.forEach(handler => handler(key));
      
      log(`Game state saved locally with key: ${key}`, 'success');
    } catch (error) {
      log(`Error saving game state locally: ${error.message}`, 'error');
      
      const handlers = this.eventHandlers.get('exportGameStateFailed') || [];
      handlers.forEach(handler => handler('Error storing game state'));
    }
  }
  
  emit(event, ...args) {
    if (!this.socket) {
      log(`Cannot emit ${event}: Socket not initialized`, 'error');
      this.pendingEmits.push({ event, args });
      return;
    }
    
    if (this.connected || this.offlineMode) {
      log(`Emitting ${event}`, 'debug');
      this.socket.emit(event, ...args);
    } else {
      log(`Queuing emission of ${event} until connected`, 'debug');
      this.pendingEmits.push({ event, args });
    }
  }
  
  processPendingEmits() {
    while (this.pendingEmits.length > 0) {
      const { event, args } = this.pendingEmits.shift();
      log(`Processing queued event: ${event}`, 'debug');
      this.socket.emit(event, ...args);
    }
  }
  
  displayConnectionStatus(connected, reason = '') {
    // Update UI to show connection status
    const statusClass = connected ? 'connected' : 'disconnected';
    const statusMessage = connected ? 'Connected' : `Disconnected: ${reason}`;
    
    // Find an appropriate element to display the status
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.className = statusClass;
      statusElement.textContent = statusMessage;
    } else {
      // Create a status element if it doesn't exist
      const newStatusElement = document.createElement('div');
      newStatusElement.id = 'connectionStatus';
      newStatusElement.className = statusClass;
      newStatusElement.textContent = statusMessage;
      newStatusElement.style.position = 'fixed';
      newStatusElement.style.bottom = '10px';
      newStatusElement.style.right = '10px';
      newStatusElement.style.padding = '5px 10px';
      newStatusElement.style.borderRadius = '5px';
      newStatusElement.style.fontSize = '12px';
      newStatusElement.style.zIndex = '9999';
      newStatusElement.style.color = 'white';
      newStatusElement.style.backgroundColor = connected ? '#2ecc71' : '#e74c3c';
      document.body.appendChild(newStatusElement);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        newStatusElement.style.opacity = '0.5';
      }, 5000);
    }
  }
  
  displayOfflineModeNotification() {
    const chatbox = document.getElementById('chatbox');
    if (chatbox) {
      const notification = document.createElement('div');
      notification.className = 'offline-mode-notification';
      notification.innerHTML = `
        <strong>Running in offline mode</strong>
        <p>Multiplayer features are limited, but you can still play single-player.</p>
        <p>Game data will be stored locally.</p>
        <p>Click to dismiss this message.</p>
      `;
      
      notification.style.backgroundColor = '#fff3cd';
      notification.style.color = '#856404';
      notification.style.padding = '10px';
      notification.style.borderRadius = '5px';
      notification.style.margin = '10px 0';
      notification.style.cursor = 'pointer';
      
      notification.addEventListener('click', () => {
        notification.style.display = 'none';
      });
      
      chatbox.prepend(notification);
    }
  }
}

// Export a singleton instance
export const socketService = new SocketService();