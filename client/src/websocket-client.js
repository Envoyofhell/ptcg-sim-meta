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
      
      // Socket.io compatible event names
      this.EVENTS = {
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        ERROR: 'error'
      };
    }
    
    connect(roomId, username, isSpectator = false) {
      // Determine WebSocket URL based on environment
      const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
      const host = window.location.host;
      const url = `${protocol}${host}/websocket?roomId=${roomId}`;
      
      this.socket = new WebSocket(url);
      this.roomId = roomId;
      this.username = username;
      this.isSpectator = isSpectator;
      
      this.socket.onopen = () => {
        console.log('WebSocket connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Send join message automatically
        if (roomId) {
          this.emit('joinGame', { roomId, username, isSpectator });
        }
        
        // Trigger connect event handlers
        this._triggerEvent(this.EVENTS.CONNECT, {});
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const { type, ...payload } = data;
          
          // Trigger event handlers
          this._triggerEvent(type, payload);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.socket.onclose = () => {
        console.log('WebSocket connection closed');
        this.isConnected = false;
        
        // Attempt to reconnect if not manually closed
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(this.roomId, this.username, this.isSpectator);
          }, 1000 * Math.pow(2, this.reconnectAttempts)); // Exponential backoff
        }
        
        // Trigger disconnect event handlers
        this._triggerEvent(this.EVENTS.DISCONNECT, {});
      };
      
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // Trigger error event handlers
        this._triggerEvent(this.EVENTS.ERROR, { error });
      };
    }
    
    // Socket.io-compatible emit method
    emit(eventType, data = {}) {
      if (!this.isConnected) {
        console.warn('WebSocket not connected, message not sent');
        return;
      }
      
      this.socket.send(JSON.stringify({
        type: eventType,
        ...data
      }));
    }
    
    // Socket.io-compatible on method
    on(eventType, callback) {
      if (!this.eventHandlers[eventType]) {
        this.eventHandlers[eventType] = [];
      }
      this.eventHandlers[eventType].push(callback);
    }
    
    // Socket.io-compatible off method
    off(eventType, callback) {
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
      if (this.socket) {
        this.socket.close();
      }
      
      // Clear reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    }
  }
  
  // Export singleton instance
  export const socket = new WebSocketClient();