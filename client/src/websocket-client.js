// client/src/websocket-client.js
// WebSocket client to replace Socket.io

class WebSocketClient {
    constructor() {
      this.socket = null;
      this.eventHandlers = {};
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectTimeout = null;
      this.id = crypto.randomUUID(); // Generate a client ID to replace socket.io's id
      console.log('WebSocketClient constructed with ID:', this.id);
    }
    
    connect(roomId, username, isSpectator = false) {
      // Close any existing connection
      if (this.socket) {
        console.log('Closing existing WebSocket connection');
        this.socket.close();
      }
      
      // Use the current host for WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      const host = window.location.host;
      const url = `${protocol}${host}/websocket?roomId=${roomId}`;
      
      console.log(`Connecting WebSocket to: ${url} as ${username} (spectator: ${isSpectator})`);
      
      try {
        this.socket = new WebSocket(url);
        this.roomId = roomId;
        this.username = username;
        this.isSpectator = isSpectator;
        
        this.socket.onopen = () => {
          console.log('WebSocket connection established successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send join message automatically
          if (roomId) {
            console.log(`Emitting joinGame event for room: ${roomId}`);
            this.emit('joinGame', { roomId, username, isSpectator });
          }
          
          // Trigger connect event handlers
          this._triggerEvent('connect', {});
        };
        
        this.socket.onmessage = (event) => {
          try {
            console.log('WebSocket message received:', event.data.slice(0, 100) + '...');
            const data = JSON.parse(event.data);
            const { type, ...payload } = data;
            
            // Trigger event handlers
            this._triggerEvent(type, payload);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        this.socket.onclose = (event) => {
          console.log(`WebSocket connection closed: code=${event.code}, reason=${event.reason}`);
          this.isConnected = false;
          
          // Attempt to reconnect if not manually closed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = 1000 * Math.pow(2, this.reconnectAttempts);
            console.log(`Scheduling reconnect attempt ${this.reconnectAttempts+1} in ${delay}ms`);
            
            this.reconnectTimeout = setTimeout(() => {
              this.reconnectAttempts++;
              console.log(`Attempting reconnect #${this.reconnectAttempts}`);
              this.connect(this.roomId, this.username, this.isSpectator);
            }, delay); // Exponential backoff
          } else {
            console.log('Maximum reconnect attempts reached');
          }
          
          // Trigger disconnect event handlers
          this._triggerEvent('disconnect', {});
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Trigger error event handlers
          this._triggerEvent('error', { error });
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
      }
    }
    
    // Socket.io-compatible emit method
    emit(eventType, data = {}) {
      if (!this.isConnected) {
        console.warn('WebSocket not connected, message not sent:', eventType);
        return;
      }
      
      try {
        const message = JSON.stringify({
          type: eventType,
          ...data
        });
        console.log(`Emitting WebSocket message: ${eventType}`);
        this.socket.send(message);
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
    
    // Socket.io-compatible on method
    on(eventType, callback) {
      console.log('Registering event handler for:', eventType);
      if (!this.eventHandlers[eventType]) {
        this.eventHandlers[eventType] = [];
      }
      this.eventHandlers[eventType].push(callback);
    }
    
    // Socket.io-compatible off method
    off(eventType, callback) {
      console.log('Removing event handler for:', eventType);
      if (!this.eventHandlers[eventType]) return;
      
      if (callback) {
        this.eventHandlers[eventType] = this.eventHandlers[eventType]
          .filter(handler => handler !== callback);
      } else {
        delete this.eventHandlers[eventType];
      }
    }
    
    // Internal method to trigger event handlers
    _triggerEvent(eventType, data) {
      if (!this.eventHandlers[eventType]) return;
      
      console.log(`Triggering ${this.eventHandlers[eventType].length} handlers for event:`, eventType);
      for (const handler of this.eventHandlers[eventType]) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventType} event handler:`, error);
        }
      }
    }
    
    // Close connection
    disconnect() {
      console.log('Disconnecting WebSocket');
      if (this.socket) {
        this.socket.close();
      }
      
      // Clear reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    }
    
    // Getter for id property (to match Socket.io's socket.id)
    get id() {
      return this._id;
    }
    
    // Setter for id property
    set id(value) {
      this._id = value;
    }
  }
  
  // Export singleton instance
  export const socket = new WebSocketClient();
  // Make it globally available
  window.socket = socket;
  
  // Log that the WebSocket client is ready
  console.log('WebSocket client exported and ready to use');