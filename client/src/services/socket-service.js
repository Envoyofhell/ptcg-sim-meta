/**
 * Enhanced Socket.IO Service for PTCG-Sim-Meta
 * 
 * This service handles the Socket.IO connection with better error handling,
 * reconnection logic, and offline mode support.
 * 
 * File: client/src/services/socket-service.js
 */
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
    
    // Metrics for debugging
    this.connectionMetrics = {
      connectCount: 0,
      disconnectCount: 0,
      errorCount: 0,
      lastErrorMessage: null,
      lastConnectedTime: null
    };
    
    // Debug log storage
    this.debugLog = [];
    this.debugLogMaxSize = 100;
  }

  /**
   * Initialize the Socket.IO connection
   * @returns {Object} Socket.IO connection or offline fallback
   */
  async initialize() {
    try {
      log('Initializing Socket.IO connection...', 'info', 'socket');
      
      // Detect environment and choose appropriate socket URL
      const socketUrl = this.determineSocketUrl();
      log(`Using Socket.IO URL: ${socketUrl}`, 'debug', 'socket');
      
      // Connection options with increased timeout and reliability settings
      const options = {
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        timeout: 15000, // Increased timeout 
        transports: ['polling', 'websocket'],
        forceNew: true,
        autoConnect: true,
        query: {
          version: '1.5.1',
          client: 'web',
          timestamp: Date.now()
        }
      };
      
      // Check if io is available
      if (typeof io === 'undefined') {
        log('Socket.IO library not available', 'error', 'socket');
        this.switchToOfflineMode('Socket.IO library not available');
        return this.createOfflineModeSocket();
      }
      
      // Create socket with error handling
      this.socket = io(socketUrl, options);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Set a connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.connected) {
          log('Socket.IO connection timeout', 'error', 'socket');
          this.switchToOfflineMode('Connection timeout');
        }
      }, 20000);
      
      return this.socket;
    } catch (error) {
      log(`Error initializing Socket.IO: ${error.message}`, 'error', 'socket');
      this.switchToOfflineMode(error.message);
      return this.createOfflineModeSocket();
    }
  }
  
  /**
   * Set up Socket.IO event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;
    
    this.socket.on('connect', () => {
      clearTimeout(this.connectionTimeout);
      this.connected = true;
      this.reconnectAttempts = 0;
      this.offlineMode = false;
      
      // Update metrics
      this.connectionMetrics.connectCount++;
      this.connectionMetrics.lastConnectedTime = new Date().toISOString();
      
      log(`Socket.IO connected (ID: ${this.socket.id})`, 'info', 'socket');
      
      // Process any pending emits
      this.processPendingEmits();
      
      // Update UI to show connected status
      this.displayConnectionStatus(true);
    });
    
    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      
      // Update metrics
      this.connectionMetrics.disconnectCount++;
      
      log(`Socket.IO disconnected: ${reason}`, 'warn', 'socket');
      
      // Update UI to show disconnected status
      this.displayConnectionStatus(false, reason);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        log('Server initiated disconnect, not attempting to reconnect', 'warn', 'socket');
      }
    });
    
    this.socket.on('connect_error', (error) => {
      // Update metrics
      this.connectionMetrics.errorCount++;
      this.connectionMetrics.lastErrorMessage = error.message;
      
      log(`Socket.IO connection error: ${error.message}`, 'error', 'socket');
      
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
  
  /**
   * Determine the appropriate Socket.IO URL based on environment
   * @returns {string} Socket.IO server URL
   */
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
  
  /**
   * Switch to offline mode for local play
   * @param {string} reason - Reason for switching to offline mode
   */
  switchToOfflineMode(reason) {
    if (this.offlineMode) return; // Already in offline mode
    
    this.offlineMode = true;
    log(`Switching to offline mode: ${reason}`, 'warn', 'socket');
    
    // Create offline mode socket
    this.socket = this.createOfflineModeSocket();
    
    // Update UI to show offline mode
    this.displayConnectionStatus(false, 'Offline Mode');
    
    // Notify the user of offline mode
    this.displayOfflineModeNotification();
  }
  
  /**
   * Create an offline mode socket that mimics Socket.IO
   * @returns {Object} Offline mode socket
   */
  createOfflineModeSocket() {
    log('Creating offline mode socket', 'info', 'socket');
    
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
        log(`[Offline] Emit ${event}`, 'debug', 'socket');
        
        // Handle special events
        if (event === 'storeGameState') {
          this.handleOfflineStoreGameState(...args);
        }
        
        return fakeSocket;
      },
      
      // Add other Socket.IO methods for compatibility
      connect: () => {
        fakeSocket.connected = true;
        fakeSocket.disconnected = false;
        return fakeSocket;
      },
      
      disconnect: () => {
        fakeSocket.connected = false;
        fakeSocket.disconnected = true;
        return fakeSocket;
      }
    };
    
    // Simulate a connection event
    setTimeout(() => {
      const connectHandlers = this.eventHandlers.get('connect') || [];
      connectHandlers.forEach(handler => handler());
    }, 100);
    
    return fakeSocket;
  }
  
  /**
   * Handle offline game state storage
   * @param {Object} data - Game state data
   */
  handleOfflineStoreGameState(data) {
    try {
      // Generate a unique key
      const key = this.generateOfflineKey();
      
      // Store in localStorage
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      localStorage.setItem(`ptcg-gamestate-${key}`, dataStr);
      
      // Trigger success handlers
      const handlers = this.eventHandlers.get('exportGameStateSuccessful') || [];
      handlers.forEach(handler => handler(key));
      
      log(`Game state saved locally with key: ${key}`, 'info', 'storage');
    } catch (error) {
      log(`Error saving game state locally: ${error.message}`, 'error', 'storage');
      
      // Trigger error handlers
      const handlers = this.eventHandlers.get('exportGameStateFailed') || [];
      handlers.forEach(handler => handler('Error storing game state'));
    }
  }
  
  /**
   * Generate a key for offline storage
   * @returns {string} Random key
   */
  generateOfflineKey() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    
    for (let i = 0; i < 4; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      key += characters.charAt(randomIndex);
    }
    
    return key;
  }
  
  /**
   * Emit an event through Socket.IO
   * @param {string} event - Event name
   * @param  {...any} args - Event arguments
   */
  emit(event, ...args) {
    // Track event in debug log
    this.addToDebugLog('emit', event, args);
    
    if (!this.socket) {
      log(`Cannot emit ${event}: Socket not initialized`, 'error', 'socket');
      this.pendingEmits.push({ event, args });
      return;
    }
    
    if (this.connected || this.offlineMode) {
      log(`Emitting ${event}`, 'debug', 'socket');
      this.socket.emit(event, ...args);
    } else {
      log(`Queuing emission of ${event} until connected`, 'debug', 'socket');
      this.pendingEmits.push({ event, args });
    }
  }
  
  /**
   * Process pending socket emissions
   */
  processPendingEmits() {
    while (this.pendingEmits.length > 0) {
      const { event, args } = this.pendingEmits.shift();
      log(`Processing queued event: ${event}`, 'debug', 'socket');
      this.socket.emit(event, ...args);
    }
  }
  
  /**
   * Display connection status in the UI
   * @param {boolean} connected - Whether connected
   * @param {string} reason - Reason for disconnection
   */
  displayConnectionStatus(connected, reason = '') {
    // Add to debug log
    this.addToDebugLog('status', 
      connected ? 'connected' : `disconnected (${reason})`);
    
    // Find an appropriate element to display the status
    const statusElement = document.getElementById('connectionStatus');
    
    if (statusElement) {
      // Update existing status element
      statusElement.className = connected ? 'connection-status connected' : 
                              'connection-status disconnected';
      
      statusElement.textContent = connected ? 'Connected' : 
                                 `Disconnected: ${reason}`;
    } else {
      // Create a new status element
      const newStatusElement = document.createElement('div');
      newStatusElement.id = 'connectionStatus';
      newStatusElement.className = connected ? 'connection-status connected' : 
                                  'connection-status disconnected';
      
      newStatusElement.textContent = connected ? 'Connected' : 
                                    `Disconnected: ${reason}`;
      
      // Style the status element
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
  
  /**
   * Display offline mode notification to the user
   */
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
  
  /**
   * Add entry to debug log
   * @param {string} type - Log entry type
   * @param {string} event - Event name
   * @param {Array} args - Optional arguments
   */
  addToDebugLog(type, event, args = []) {
    // Create log entry
    const entry = {
      timestamp: new Date().toISOString(),
      type,
      event,
      args: args.length > 0 ? [...args] : undefined
    };
    
    // Add to log, maintaining maximum size
    this.debugLog.unshift(entry);
    if (this.debugLog.length > this.debugLogMaxSize) {
      this.debugLog.pop();
    }
  }
  
  /**
   * Get diagnostic information for debugging
   * @returns {Object} Diagnostic data
   */
  getDiagnostics() {
    return {
      connected: this.connected,
      offlineMode: this.offlineMode,
      reconnectAttempts: this.reconnectAttempts,
      socketId: this.socket?.id,
      metrics: this.connectionMetrics,
      pendingEmitsCount: this.pendingEmits.length,
      debugLog: this.debugLog.slice(0, 20), // Return last 20 entries
      eventHandlersRegistered: Array.from(this.eventHandlers.keys())
    };
  }
}

// Export a singleton instance
export const socketService = new SocketService();