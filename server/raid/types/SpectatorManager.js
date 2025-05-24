// ===================================================================
// File: server/raid/types/SpectatorManager.js
// Path: /server/raid/types/SpectatorManager.js
// Location: Server-side spectator management for raids
// Changes: Initial implementation of spectator mode functionality
// Dependencies: ../core/RaidEngine.js
// Dependents: TCGOfficialGameState.js, ../core/RaidSocketHandler.js
// Changelog: 
//   v1.0.0 - Initial implementation with join/auto-conversion
//   v1.0.1 - Added spectator-specific events and permissions
// Version: 1.0.1
// ===================================================================

export class SpectatorManager {
    constructor(gameState) {
      this.gameState = gameState;
      this.spectators = new Map();
      this.spectatorSettings = {
        canSeeHiddenInfo: false,  // Can see face-down cards, etc.
        canSeePlayerActions: true, // Can see what players are planning
        receiveRealTimeUpdates: true,
        maxSpectators: 10
      };
      
      this.eventLog = []; // Track events for new spectators
      this.maxEventLogSize = 50;
    }
  
    // ================ SPECTATOR MANAGEMENT ================
  
    addSpectator(playerId, username, isAutoConverted = false) {
      if (this.spectators.size >= this.spectatorSettings.maxSpectators) {
        return { success: false, error: 'Maximum spectators reached' };
      }
  
      const spectator = {
        id: playerId,
        username: username,
        joinedAt: Date.now(),
        wasPlayer: isAutoConverted, // True if they were a player first
        permissions: this.getSpectatorPermissions(isAutoConverted),
        lastEventIndex: this.eventLog.length - 1 // Start with current events
      };
  
      this.spectators.set(playerId, spectator);
      
      this.logEvent({
        type: 'spectatorJoined',
        spectatorId: playerId,
        username: username,
        wasPlayer: isAutoConverted,
        timestamp: Date.now()
      });
  
      return {
        success: true,
        spectator: spectator,
        gameState: this.getSpectatorGameState(spectator),
        eventHistory: this.getRecentEvents(10) // Give recent context
      };
    }
  
    removeSpectator(playerId) {
      const spectator = this.spectators.get(playerId);
      if (!spectator) {
        return { success: false, error: 'Spectator not found' };
      }
  
      this.spectators.delete(playerId);
      
      this.logEvent({
        type: 'spectatorLeft',
        spectatorId: playerId,
        username: spectator.username,
        timestamp: Date.now()
      });
  
      return { success: true };
    }
  
    convertPlayerToSpectator(playerId) {
      const player = this.gameState.players.get(playerId);
      if (!player) {
        return { success: false, error: 'Player not found' };
      }
  
      // Add as spectator with enhanced permissions (was a player)
      const result = this.addSpectator(playerId, player.username, true);
      
      if (result.success) {
        this.logEvent({
          type: 'playerEliminated',
          playerId: playerId,
          username: player.username,
          eliminationReason: 'allPokemonKO',
          convertedToSpectator: true,
          timestamp: Date.now()
        });
      }
  
      return result;
    }
  
    // ================ PERMISSIONS & ACCESS ================
  
    getSpectatorPermissions(wasPlayer) {
      return {
        canSeeHiddenInfo: wasPlayer, // Ex-players can see more info
        canSeePlayerHands: wasPlayer,
        canSeeBossAttackDeck: false,
        canSeeUpcomingEvents: wasPlayer,
        canUseSpectatorChat: true,
        canSuggestActions: wasPlayer, // Ex-players can make suggestions
        priorityUpdates: wasPlayer // Get updates before regular spectators
      };
    }
  
    getSpectatorGameState(spectator) {
      const baseState = this.gameState.getGameState();
      
      // Filter based on spectator permissions
      const spectatorState = {
        ...baseState,
        spectatorMode: true,
        spectatorInfo: {
          id: spectator.id,
          joinedAt: spectator.joinedAt,
          wasPlayer: spectator.wasPlayer,
          permissions: spectator.permissions
        }
      };
  
      // Add hidden info if permitted
      if (spectator.permissions.canSeeHiddenInfo) {
        spectatorState.hiddenInfo = {
          bossAttackDeckSize: this.gameState.bossAttackDeck.length,
          upcomingBossAttacks: this.gameState.bossAttackDeck.slice(0, 3), // Next 3 cards
          playerIntentions: this.getPlayerIntentions() // What players are planning
        };
      }
  
      return spectatorState;
    }
  
    getPlayerIntentions() {
      // Get any declared player intentions/preparations
      const intentions = {};
      
      this.gameState.players.forEach((player, playerId) => {
        if (player.status === 'active' && player.lastAction) {
          intentions[playerId] = {
            lastAction: player.lastAction,
            pokemonStatus: {
              active: {
                name: player.pokemon.active.name,
                hp: player.pokemon.active.hp,
                maxHP: player.pokemon.active.maxHP,
                status: player.pokemon.active.status
              },
              bench: {
                name: player.pokemon.bench.name,
                hp: player.pokemon.bench.hp,
                maxHP: player.pokemon.bench.maxHP,
                status: player.pokemon.bench.status
              }
            }
          };
        }
      });
  
      return intentions;
    }
  
    // ================ EVENT SYSTEM ================
  
    logEvent(event) {
      event.id = this.eventLog.length;
      this.eventLog.push(event);
      
      // Trim log if too large
      if (this.eventLog.length > this.maxEventLogSize) {
        this.eventLog = this.eventLog.slice(-this.maxEventLogSize);
        // Adjust indices
        this.eventLog.forEach((event, index) => {
          event.id = index;
        });
      }
  
      // Notify spectators of new event
      this.broadcastEventToSpectators(event);
    }
  
    getRecentEvents(count = 10) {
      return this.eventLog.slice(-count);
    }
  
    getEventsForSpectator(spectatorId, sinceIndex = 0) {
      const spectator = this.spectators.get(spectatorId);
      if (!spectator) return [];
  
      const relevantEvents = this.eventLog.slice(sinceIndex);
      
      // Filter events based on permissions
      return relevantEvents.filter(event => {
        if (event.type === 'hiddenAction' && !spectator.permissions.canSeeHiddenInfo) {
          return false;
        }
        return true;
      });
    }
  
    broadcastEventToSpectators(event) {
      this.spectators.forEach((spectator, spectatorId) => {
        // Check if spectator should receive this event
        if (this.shouldReceiveEvent(spectator, event)) {
          // Will be handled by socket handler to actually send
          this.gameState.eventQueue = this.gameState.eventQueue || [];
          this.gameState.eventQueue.push({
            type: 'spectatorEvent',
            spectatorId: spectatorId,
            event: event,
            timestamp: Date.now()
          });
        }
      });
    }
  
    shouldReceiveEvent(spectator, event) {
      // Priority events for ex-players
      if (spectator.permissions.priorityUpdates && event.priority) {
        return true;
      }
  
      // Regular event filtering
      switch (event.type) {
        case 'hiddenAction':
          return spectator.permissions.canSeeHiddenInfo;
        case 'playerIntention':
          return spectator.permissions.canSeePlayerActions;
        case 'bossAIDecision':
          return spectator.permissions.canSeeUpcomingEvents;
        default:
          return true; // Most events are visible to all spectators
      }
    }
  
    // ================ SPECTATOR ACTIONS ================
  
    processSpectatorSuggestion(spectatorId, suggestion) {
      const spectator = this.spectators.get(spectatorId);
      if (!spectator || !spectator.permissions.canSuggestActions) {
        return { success: false, error: 'Permission denied' };
      }
  
      this.logEvent({
        type: 'spectatorSuggestion',
        spectatorId: spectatorId,
        suggestion: suggestion,
        timestamp: Date.now()
      });
  
      return {
        success: true,
        message: 'Suggestion logged',
        suggestion: suggestion
      };
    }
  
    processSpectatorChat(spectatorId, message) {
      const spectator = this.spectators.get(spectatorId);
      if (!spectator || !spectator.permissions.canUseSpectatorChat) {
        return { success: false, error: 'Chat permission denied' };
      }
  
      const chatEvent = {
        type: 'spectatorChat',
        spectatorId: spectatorId,
        username: spectator.username,
        message: message,
        timestamp: Date.now()
      };
  
      this.logEvent(chatEvent);
  
      // Broadcast to all spectators
      this.spectators.forEach((_, otherSpectatorId) => {
        if (otherSpectatorId !== spectatorId) {
          this.gameState.eventQueue = this.gameState.eventQueue || [];
          this.gameState.eventQueue.push({
            type: 'spectatorChatMessage',
            spectatorId: otherSpectatorId,
            chat: chatEvent,
            timestamp: Date.now()
          });
        }
      });
  
      return { success: true, chatEvent: chatEvent };
    }
  
    // ================ UTILITY METHODS ================
  
    getSpectators() {
      return Array.from(this.spectators.values());
    }
  
    getSpectatorCount() {
      return this.spectators.size;
    }
  
    getSpectatorById(spectatorId) {
      return this.spectators.get(spectatorId);
    }
  
    updateSpectatorSettings(newSettings) {
      this.spectatorSettings = { ...this.spectatorSettings, ...newSettings };
      
      this.logEvent({
        type: 'spectatorSettingsChanged',
        newSettings: this.spectatorSettings,
        timestamp: Date.now()
      });
    }
  
    // ================ STATE EXPORT ================
  
    getSpectatorManagerState() {
      return {
        spectators: Object.fromEntries(this.spectators),
        spectatorCount: this.spectators.size,
        settings: this.spectatorSettings,
        recentEvents: this.getRecentEvents(5),
        totalEventsLogged: this.eventLog.length
      };
    }
  
    // Clean up old events and inactive spectators
    cleanup() {
      const now = Date.now();
      const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
  
      // Remove inactive spectators
      this.spectators.forEach((spectator, spectatorId) => {
        if (now - spectator.joinedAt > inactiveThreshold && !spectator.wasPlayer) {
          this.removeSpectator(spectatorId);
        }
      });
  
      // Clear old events
      if (this.eventLog.length > this.maxEventLogSize) {
        this.eventLog = this.eventLog.slice(-Math.floor(this.maxEventLogSize * 0.8));
      }
    }
  }