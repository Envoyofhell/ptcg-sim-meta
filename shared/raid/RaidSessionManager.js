// ===================================================================
// File: shared/raid/RaidSessionManager.js
// Path: /shared/raid/RaidSessionManager.js
// Purpose: Centralized raid session management with ID persistence
// Version: 2.0.0
// 
// Dependencies: 
//   - None (core module)
// 
// Used By:
//   - client/src/raid/RaidClientCore.js
//   - server/raid/core/RaidServerCore.js
// 
// Changelog:
//   v2.0.0 - Complete rewrite with proper ID management
//   v2.0.1 - Added session persistence and recovery
// ===================================================================

export class RaidSessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionHistory = [];
        this.maxHistorySize = 10;
        this.currentSessionId = null;
        
        // Session configuration
        this.config = {
            sessionPrefix: 'raid',
            idLength: 6,
            persistenceEnabled: true,
            persistenceKey: 'ptcg_raid_sessions'
        };
        
        this.loadPersistedSessions();
    }
    
    // ================ SESSION CREATION ================
    
    /**
     * Creates a new raid session with proper ID management
     * @param {Object} options - Session configuration options
     * @returns {Object} Session object with ID and metadata
     */
    createSession(options = {}) {
        const sessionId = this.generateSessionId(options.customId);
        
        const session = {
            id: sessionId,
            createdAt: Date.now(),
            createdBy: options.createdBy || 'unknown',
            type: options.type || 'tcg-official',
            maxPlayers: options.maxPlayers || 4,
            minPlayers: options.minPlayers || 1,
            layout: options.layout || 'versus',
            status: 'lobby',
            players: new Map(),
            spectators: new Map(),
            metadata: options.metadata || {},
            
            // Session state
            gameState: null,
            lastActivity: Date.now(),
            
            // Session settings
            settings: {
                autoStart: options.autoStart || false,
                allowSpectators: options.allowSpectators !== false,
                publicSession: options.publicSession || false,
                passwordProtected: !!options.password,
                password: options.password || null
            }
        };
        
        this.sessions.set(sessionId, session);
        this.addToHistory(session);
        this.persistSessions();
        
        console.log(`[SessionManager] Created session: ${sessionId}`);
        return session;
    }
    
    /**
     * Generates a unique session ID with proper formatting
     */
    generateSessionId(customId) {
        if (customId && this.validateSessionId(customId)) {
            return customId;
        }
        
        const timestamp = Date.now().toString(36).slice(-4);
        const random = Math.random().toString(36).substring(2, 6);
        return `${this.config.sessionPrefix}-${timestamp}-${random}`.toUpperCase();
    }
    
    /**
     * Validates a session ID format
     */
    validateSessionId(sessionId) {
        const pattern = new RegExp(`^${this.config.sessionPrefix}-[A-Z0-9]{4}-[A-Z0-9]{4}$`, 'i');
        return pattern.test(sessionId);
    }
    
    // ================ SESSION RETRIEVAL ================
    
    /**
     * Gets a session by ID with validation
     */
    getSession(sessionId) {
        if (!sessionId) return null;
        
        const normalizedId = this.normalizeSessionId(sessionId);
        const session = this.sessions.get(normalizedId);
        
        if (session) {
            session.lastActivity = Date.now();
            return session;
        }
        
        // Try to find in history
        const historicalSession = this.sessionHistory.find(s => s.id === normalizedId);
        if (historicalSession && historicalSession.status !== 'ended') {
            // Restore from history
            this.sessions.set(normalizedId, historicalSession);
            return historicalSession;
        }
        
        return null;
    }
    
    /**
     * Gets all active sessions
     */
    getActiveSessions() {
        const activeSessions = [];
        
        this.sessions.forEach((session, id) => {
            if (session.status !== 'ended') {
                activeSessions.push({
                    id: session.id,
                    type: session.type,
                    playerCount: session.players.size,
                    maxPlayers: session.maxPlayers,
                    status: session.status,
                    layout: session.layout,
                    createdAt: session.createdAt,
                    createdBy: session.createdBy,
                    isPublic: session.settings.publicSession,
                    isPasswordProtected: session.settings.passwordProtected
                });
            }
        });
        
        return activeSessions;
    }
    
    /**
     * Gets session history
     */
    getSessionHistory() {
        return this.sessionHistory.map(session => ({
            id: session.id,
            createdAt: session.createdAt,
            createdBy: session.createdBy,
            status: session.status,
            playerCount: session.players.size,
            endedAt: session.endedAt
        }));
    }
    
    // ================ SESSION MODIFICATION ================
    
    /**
     * Updates session properties
     */
    updateSession(sessionId, updates) {
        const session = this.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        
        // Validate updates
        const allowedUpdates = ['layout', 'maxPlayers', 'settings', 'metadata', 'gameState'];
        const validUpdates = {};
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedUpdates.includes(key)) {
                validUpdates[key] = value;
            }
        }
        
        // Apply updates
        Object.assign(session, validUpdates);
        session.lastActivity = Date.now();
        
        this.persistSessions();
        
        return { success: true, session };
    }
    
    /**
     * Ends a session
     */
    endSession(sessionId, reason = 'manual') {
        const session = this.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        
        session.status = 'ended';
        session.endedAt = Date.now();
        session.endReason = reason;
        
        // Move to history
        this.addToHistory(session);
        this.sessions.delete(sessionId);
        this.persistSessions();
        
        return { success: true };
    }
    
    // ================ PLAYER MANAGEMENT ================
    
    /**
     * Adds a player to a session
     */
    addPlayer(sessionId, playerId, playerData) {
        const session = this.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        
        if (session.players.size >= session.maxPlayers) {
            return { success: false, error: 'Session is full' };
        }
        
        if (session.settings.passwordProtected && playerData.password !== session.settings.password) {
            return { success: false, error: 'Invalid password' };
        }
        
        session.players.set(playerId, {
            id: playerId,
            ...playerData,
            joinedAt: Date.now(),
            status: 'active'
        });
        
        session.lastActivity = Date.now();
        this.persistSessions();
        
        return { success: true, session };
    }
    
    /**
     * Removes a player from a session
     */
    removePlayer(sessionId, playerId) {
        const session = this.getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Session not found' };
        }
        
        session.players.delete(playerId);
        session.lastActivity = Date.now();
        
        // Check if session should end
        if (session.players.size === 0 && session.status === 'active') {
            this.endSession(sessionId, 'empty');
        } else {
            this.persistSessions();
        }
        
        return { success: true, session };
    }
    
    // ================ PERSISTENCE ================
    
    /**
     * Normalizes session ID format
     */
    normalizeSessionId(sessionId) {
        if (!sessionId) return null;
        return sessionId.toUpperCase().trim();
    }
    
    /**
     * Adds session to history
     */
    addToHistory(session) {
        // Remove if already exists
        this.sessionHistory = this.sessionHistory.filter(s => s.id !== session.id);
        
        // Add to beginning
        this.sessionHistory.unshift({...session});
        
        // Trim history
        if (this.sessionHistory.length > this.maxHistorySize) {
            this.sessionHistory = this.sessionHistory.slice(0, this.maxHistorySize);
        }
    }
    
    /**
     * Persists sessions to storage
     */
    persistSessions() {
        if (!this.config.persistenceEnabled) return;
        
        try {
            const dataToStore = {
                sessions: Array.from(this.sessions.entries()).map(([id, session]) => ({
                    id,
                    session: this.serializeSession(session)
                })),
                history: this.sessionHistory.map(s => this.serializeSession(s)),
                currentSessionId: this.currentSessionId,
                timestamp: Date.now()
            };
            
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(this.config.persistenceKey, JSON.stringify(dataToStore));
            }
        } catch (error) {
            console.error('[SessionManager] Failed to persist sessions:', error);
        }
    }
    
    /**
     * Loads persisted sessions from storage
     */
    loadPersistedSessions() {
        if (!this.config.persistenceEnabled) return;
        
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const stored = window.localStorage.getItem(this.config.persistenceKey);
                if (!stored) return;
                
                const data = JSON.parse(stored);
                
                // Only restore sessions less than 1 hour old
                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                if (data.timestamp < oneHourAgo) {
                    console.log('[SessionManager] Persisted sessions too old, ignoring');
                    return;
                }
                
                // Restore sessions
                data.sessions.forEach(({id, session}) => {
                    const deserialized = this.deserializeSession(session);
                    if (deserialized.status !== 'ended') {
                        this.sessions.set(id, deserialized);
                    }
                });
                
                // Restore history
                this.sessionHistory = data.history.map(s => this.deserializeSession(s));
                this.currentSessionId = data.currentSessionId;
                
                console.log(`[SessionManager] Restored ${this.sessions.size} sessions from storage`);
            }
        } catch (error) {
            console.error('[SessionManager] Failed to load persisted sessions:', error);
        }
    }
    
    /**
     * Serializes a session for storage
     */
    serializeSession(session) {
        return {
            ...session,
            players: Array.from(session.players.entries()),
            spectators: Array.from(session.spectators.entries())
        };
    }
    
    /**
     * Deserializes a session from storage
     */
    deserializeSession(data) {
        return {
            ...data,
            players: new Map(data.players || []),
            spectators: new Map(data.spectators || [])
        };
    }
    
    // ================ CLEANUP ================
    
    /**
     * Cleans up inactive sessions
     */
    cleanupInactiveSessions(maxInactiveTime = 30 * 60 * 1000) {
        const now = Date.now();
        const sessionsToRemove = [];
        
        this.sessions.forEach((session, id) => {
            if (now - session.lastActivity > maxInactiveTime) {
                sessionsToRemove.push(id);
            }
        });
        
        sessionsToRemove.forEach(id => {
            this.endSession(id, 'inactive');
        });
        
        return sessionsToRemove.length;
    }
    
    /**
     * Gets session manager statistics
     */
    getStatistics() {
        return {
            activeSessions: this.sessions.size,
            totalPlayers: Array.from(this.sessions.values()).reduce((sum, s) => sum + s.players.size, 0),
            sessionHistory: this.sessionHistory.length,
            currentSessionId: this.currentSessionId
        };
    }
}

// ===================================================================
// Future Scripts Needed:
// 1. client/src/raid/RaidClientCore.js - Core client functionality
// 2. client/src/raid/ui/RaidUIManager.js - UI state management
// 3. client/src/raid/ui/RaidSessionList.js - Session browser UI
// 4. server/raid/core/RaidServerCore.js - Server-side core
// 5. shared/raid/RaidErrorHandler.js - Centralized error handling
// ===================================================================