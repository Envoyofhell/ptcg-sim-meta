// server/raid/core/RaidEventBus.js

export class RaidEventBus {
    constructor() {
        this.listeners = new Map();
        console.log('[RaidEventBus] Event Bus Initialized.');
    }

    /**
     * Registers an event listener for the given event name.
     * @param {string} eventName - The name of the event to listen for.
     * @param {Function} callback - The function to call when the event is emitted.
     */
    on(eventName, callback) {
        if (typeof callback !== 'function') {
            console.error(`[RaidEventBus] Invalid callback provided for event: ${eventName}`);
            return;
        }
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
        // console.log(`[RaidEventBus] Listener registered for: ${eventName}`);
    }

    /**
     * Emits an event with the given name and data.
     * All registered listeners for this event will be called.
     * @param {string} eventName - The name of the event to emit.
     * @param {any} data - The data to pass to the event listeners.
     */
    emit(eventName, data) {
        // console.log(`[RaidEventBus] Emitting event: ${eventName}`, data);
        if (this.listeners.has(eventName)) {
            // Call listeners in a try-catch to prevent one listener from crashing others
            this.listeners.get(eventName).forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`[RaidEventBus] Error in listener for event '${eventName}':`, e);
                }
            });
        }
    }

    /**
     * Removes a specific event listener for the given event name.
     * @param {string} eventName - The name of the event.
     * @param {Function} callback - The specific callback function to remove.
     */
    off(eventName, callback) {
        if (this.listeners.has(eventName)) {
            const eventListeners = this.listeners.get(eventName);
            const index = eventListeners.indexOf(callback);
            if (index > -1) {
                eventListeners.splice(index, 1);
                // console.log(`[RaidEventBus] Listener removed for: ${eventName}`);
                if (eventListeners.length === 0) {
                    this.listeners.delete(eventName);
                }
            }
        }
    }

    /**
     * Removes all listeners for a given event, or all listeners if no eventName is specified.
     * @param {string} [eventName] - The name of the event. If omitted, all listeners for all events are removed.
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this.listeners.delete(eventName);
            // console.log(`[RaidEventBus] All listeners removed for: ${eventName}`);
        } else {
            this.listeners.clear();
            // console.log('[RaidEventBus] All listeners removed.');
        }
    }
}