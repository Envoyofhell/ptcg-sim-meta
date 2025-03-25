// client/src/websocket-client.js
/**
 * Enhanced WebSocket client for Cloudflare Workers
 *
 * This implementation provides a Socket.IO-like API over native WebSockets
 * with improved connection handling, automatic reconnection, and better
 * error reporting specifically designed to work with Cloudflare Workers.
 */

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.eventHandlers = {};
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.connectionQueue = [];
    this.id = crypto.randomUUID(); // Generate a client ID to replace socket.io's id
    this.roomId = null;
    this.username = null;
    this.isSpectator = false;

    console.log('WebSocketClient initialized with ID:', this.id);
  }

  /**
   * Connect to a WebSocket server
   *
   * @param {string} roomId - The room ID to join
   * @param {string} username - The user's name
   * @param {boolean} isSpectator - Whether the user is a spectator
   * @returns {Promise} - Resolves when connected or rejects on failure
   */
  connect(roomId, username, isSpectator = false) {
    return new Promise((resolve, reject) => {
      // Store connection parameters
      this.roomId = roomId;
      this.username = username;
      this.isSpectator = isSpectator;

      // Already connected to the right room
      if (this.isConnected && this.roomId === roomId) {
        console.log(`Already connected to room ${roomId}`);
        this._sendJoinRequest();
        resolve();
        return;
      }

      // Already attempting to connect
      if (this.isConnecting) {
        console.log('Connection already in progress, queuing request');
        this.connectionQueue.push({
          roomId,
          username,
          isSpectator,
          resolve,
          reject,
        });
        return;
      }

      this.isConnecting = true;

      // Close any existing connection
      if (this.socket) {
        console.log('Closing existing WebSocket connection');
        this.socket.close();
        this.socket = null;
      }

      // Determine the WebSocket URL based on the current location
      const protocol =
        window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      const host = window.location.host;
      const url = `${protocol}${host}/websocket?roomId=${roomId}`;

      console.log(
        `Connecting WebSocket to: ${url} as ${username} (spectator: ${isSpectator})`
      );

      try {
        // Create a new WebSocket connection
        this.socket = new WebSocket(url);

        // Set up connection event handlers
        this.socket.onopen = () => {
          console.log('WebSocket connection established successfully');
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          // Send join message
          this._sendJoinRequest();

          // Process any queued connection requests
          this._processConnectionQueue();

          // Trigger connect event handlers
          this._triggerEvent('connect', {});

          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            console.log(
              'WebSocket message received',
              event.data.slice(0, 100) + (event.data.length > 100 ? '...' : '')
            );
            const data = JSON.parse(event.data);
            const { type, ...payload } = data;

            // Trigger event handlers
            this._triggerEvent(type, payload);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        this.socket.onclose = (event) => {
          console.log(
            `WebSocket connection closed: code=${event.code}, reason=${event.reason}`
          );
          this.isConnected = false;
          this.isConnecting = false;

          // Reject the current connection attempt
          if (!this.isConnected) {
            reject(
              new Error(
                `Connection closed: code=${event.code}, reason=${event.reason}`
              )
            );
          }

          // Attempt to reconnect if not manually closed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = 1000 * Math.pow(2, this.reconnectAttempts);
            console.log(
              `Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${delay}ms`
            );

            this.reconnectTimeout = setTimeout(() => {
              this.reconnectAttempts++;
              console.log(`Attempting reconnect #${this.reconnectAttempts}`);
              this.connect(this.roomId, this.username, this.isSpectator).catch(
                (err) => {
                  console.error('Reconnection failed:', err);
                }
              );
            }, delay); // Exponential backoff
          } else {
            console.log('Maximum reconnect attempts reached');
          }

          // Trigger disconnect event handlers
          this._triggerEvent('disconnect', {});
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;

          // Reject the current connection attempt
          reject(new Error('WebSocket connection error'));

          // Trigger error event handlers
          this._triggerEvent('error', { error });
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Send a join request to the server
   * @private
   */
  _sendJoinRequest() {
    if (this.isConnected && this.roomId) {
      console.log(`Emitting joinGame event for room: ${this.roomId}`);
      this.emit('joinGame', {
        roomId: this.roomId,
        username: this.username,
        isSpectator: this.isSpectator,
      });
    }
  }

  /**
   * Process any queued connection requests
   * @private
   */
  _processConnectionQueue() {
    if (this.connectionQueue.length > 0) {
      const nextConnection = this.connectionQueue.shift();
      console.log('Processing queued connection request');
      this.connect(
        nextConnection.roomId,
        nextConnection.username,
        nextConnection.isSpectator
      )
        .then(nextConnection.resolve)
        .catch(nextConnection.reject);
    }
  }

  /**
   * Socket.io-compatible emit method
   * @param {string} eventType - The event type to emit
   * @param {object} data - The data to send
   * @returns {boolean} - Whether the message was sent
   */
  emit(eventType, data = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn(
        `WebSocket not connected, message not sent: ${eventType}`,
        data
      );

      // Queue important messages like joinGame for when connection is established
      if (eventType === 'joinGame' && !this.isConnected && !this.isConnecting) {
        console.log(
          'Connection not established, attempting to connect first...'
        );
        this.connect(data.roomId, data.username, data.isSpectator).catch(
          (err) => {
            console.error('Failed to establish connection:', err);
          }
        );
      }

      return false;
    }

    try {
      // Normalize data format to handle both object and multiple arguments
      const messageData =
        typeof data === 'object'
          ? { type: eventType, ...data }
          : { type: eventType, data: Array.from(arguments).slice(1) };

      const message = JSON.stringify(messageData);
      console.log(`Emitting WebSocket message: ${eventType}`);
      this.socket.send(message);
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  /**
   * Socket.io-compatible on method
   * @param {string} eventType - The event type to listen for
   * @param {function} callback - The callback function
   */
  on(eventType, callback) {
    console.log('Registering event handler for:', eventType);
    if (!this.eventHandlers[eventType]) {
      this.eventHandlers[eventType] = [];
    }
    this.eventHandlers[eventType].push(callback);
  }

  /**
   * Socket.io-compatible off method
   * @param {string} eventType - The event type to remove handler for
   * @param {function} callback - The specific callback to remove (optional)
   */
  off(eventType, callback) {
    console.log('Removing event handler for:', eventType);
    if (!this.eventHandlers[eventType]) return;

    if (callback) {
      this.eventHandlers[eventType] = this.eventHandlers[eventType].filter(
        (handler) => handler !== callback
      );
    } else {
      delete this.eventHandlers[eventType];
    }
  }

  /**
   * Internal method to trigger event handlers
   * @private
   * @param {string} eventType - The event type to trigger
   * @param {object} data - The data to pass to handlers
   */
  _triggerEvent(eventType, data) {
    if (!this.eventHandlers[eventType]) return;

    console.log(
      `Triggering ${this.eventHandlers[eventType].length} handlers for event:`,
      eventType
    );
    for (const handler of this.eventHandlers[eventType]) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${eventType} event handler:`, error);
      }
    }
  }

  /**
   * Close connection
   */
  disconnect() {
    console.log('Disconnecting WebSocket');
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * Check if connected to server
   * @returns {boolean} - Connection status
   */
  get connected() {
    return this.isConnected;
  }
}

// Export singleton instance
export const socket = new WebSocketClient();

// Make it globally available
window.socket = socket;

// Log that the WebSocket client is ready
console.log('WebSocket client exported and ready to use');
