// ===================================================================
// File: client/shared/raid/RaidSessionManager.js
// Path: /client/shared/raid/RaidSessionManager.js
// Purpose: Session management and state persistence for raid system
// Version: 1.0.0
//
// Dependencies:
//   - None (standalone utility)
//
// Used By:
//   - ../src/raid/RaidClientCore.js
//   - ../src/raid/ui/RaidUIController.js
//
// Changelog:
//   v1.0.0 - Initial implementation
// ===================================================================

export class RaidSessionManager {
  constructor() {
    this.config = {
      sessionPrefix: 'RAID',
      storagePrefix: 'ptcg_raid',
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxSessions: 10,
    };

    this.currentSession = null;
    this.sessionHistory = [];
    this.preferences = {};

    this.loadFromStorage();
    console.log('[RaidSessionManager] Initialized');
  }

  // ================ SESSION MANAGEMENT ================

  createSession(raidId, raidData = {}) {
    const session = {
      id: this.generateSessionId(),
      raidId: raidId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: {
        playerCount: 0,
        layout: 'versus',
        phase: 'lobby',
        ...raidData,
      },
      events: [],
      isActive: true,
    };

    this.currentSession = session;
    this.addToHistory(session);
    this.saveToStorage();

    console.log(
      `[RaidSessionManager] Created session ${session.id} for raid ${raidId}`
    );
    return session;
  }

  updateSession(updates) {
    if (!this.currentSession) return false;

    this.currentSession.data = {
      ...this.currentSession.data,
      ...updates,
    };
    this.currentSession.lastActivity = Date.now();

    this.saveToStorage();
    return true;
  }

  endSession() {
    if (!this.currentSession) return false;

    this.currentSession.isActive = false;
    this.currentSession.endedAt = Date.now();

    console.log(`[RaidSessionManager] Ended session ${this.currentSession.id}`);

    this.currentSession = null;
    this.saveToStorage();
    return true;
  }

  getCurrentSession() {
    return this.currentSession;
  }

  // ================ EVENT LOGGING ================

  logEvent(eventType, eventData = {}) {
    if (!this.currentSession) return false;

    const event = {
      type: eventType,
      data: eventData,
      timestamp: Date.now(),
    };

    this.currentSession.events.push(event);

    // Keep only last 100 events per session
    if (this.currentSession.events.length > 100) {
      this.currentSession.events = this.currentSession.events.slice(-100);
    }

    this.currentSession.lastActivity = Date.now();
    this.saveToStorage();

    return true;
  }

  getSessionEvents(limit = 50) {
    if (!this.currentSession) return [];

    return this.currentSession.events.slice(-limit);
  }

  // ================ HISTORY MANAGEMENT ================

  addToHistory(session) {
    // Remove any existing session with same raid ID
    this.sessionHistory = this.sessionHistory.filter(
      (s) => s.raidId !== session.raidId
    );

    // Add new session to beginning
    this.sessionHistory.unshift({ ...session });

    // Maintain max history size
    if (this.sessionHistory.length > this.config.maxSessions) {
      this.sessionHistory = this.sessionHistory.slice(
        0,
        this.config.maxSessions
      );
    }
  }

  getSessionHistory() {
    return [...this.sessionHistory];
  }

  getSessionById(sessionId) {
    return this.sessionHistory.find((s) => s.id === sessionId);
  }

  clearHistory() {
    this.sessionHistory = [];
    this.saveToStorage();
  }

  // ================ PREFERENCES ================

  setPreference(key, value) {
    this.preferences[key] = value;
    this.saveToStorage();
  }

  getPreference(key, defaultValue = null) {
    return this.preferences.hasOwnProperty(key)
      ? this.preferences[key]
      : defaultValue;
  }

  clearPreferences() {
    this.preferences = {};
    this.saveToStorage();
  }

  // ================ STORAGE ================

  saveToStorage() {
    try {
      const data = {
        currentSession: this.currentSession,
        sessionHistory: this.sessionHistory,
        preferences: this.preferences,
        lastSaved: Date.now(),
      };

      localStorage.setItem(
        `${this.config.storagePrefix}_sessions`,
        JSON.stringify(data)
      );
      return true;
    } catch (error) {
      console.warn(
        '[RaidSessionManager] Failed to save to localStorage:',
        error
      );
      return false;
    }
  }

  loadFromStorage() {
    try {
      const data = localStorage.getItem(
        `${this.config.storagePrefix}_sessions`
      );
      if (!data) return false;

      const parsed = JSON.parse(data);

      this.sessionHistory = parsed.sessionHistory || [];
      this.preferences = parsed.preferences || {};

      // Don't restore current session - it should be created fresh
      this.currentSession = null;

      // Clean up old sessions
      this.cleanupOldSessions();

      return true;
    } catch (error) {
      console.warn(
        '[RaidSessionManager] Failed to load from localStorage:',
        error
      );
      return false;
    }
  }

  cleanupOldSessions() {
    const cutoffTime = Date.now() - this.config.sessionTimeout;

    this.sessionHistory = this.sessionHistory.filter((session) => {
      return session.lastActivity > cutoffTime;
    });

    if (this.currentSession && this.currentSession.lastActivity < cutoffTime) {
      this.endSession();
    }
  }

  // ================ UTILITIES ================

  generateSessionId() {
    return `${this.config.sessionPrefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isSessionExpired(session) {
    if (!session) return true;

    const cutoffTime = Date.now() - this.config.sessionTimeout;
    return session.lastActivity < cutoffTime;
  }

  getSessionDuration(session = null) {
    const targetSession = session || this.currentSession;
    if (!targetSession) return 0;

    const endTime = targetSession.endedAt || Date.now();
    return endTime - targetSession.createdAt;
  }

  formatSessionDuration(session = null) {
    const duration = this.getSessionDuration(session);
    const minutes = Math.floor(duration / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // ================ ANALYTICS ================

  getSessionStats() {
    const stats = {
      totalSessions: this.sessionHistory.length,
      averageDuration: 0,
      totalEvents: 0,
      preferredLayout: this.getPreference('layout', 'versus'),
      lastActivity: null,
    };

    if (this.sessionHistory.length > 0) {
      const totalDuration = this.sessionHistory.reduce((sum, session) => {
        return sum + this.getSessionDuration(session);
      }, 0);

      stats.averageDuration = totalDuration / this.sessionHistory.length;

      stats.totalEvents = this.sessionHistory.reduce((sum, session) => {
        return sum + (session.events ? session.events.length : 0);
      }, 0);

      stats.lastActivity = Math.max(
        ...this.sessionHistory.map((s) => s.lastActivity)
      );
    }

    return stats;
  }

  exportSessionData() {
    return {
      config: this.config,
      currentSession: this.currentSession,
      sessionHistory: this.sessionHistory,
      preferences: this.preferences,
      stats: this.getSessionStats(),
      exportTime: Date.now(),
    };
  }

  // ================ DEBUG METHODS ================

  debugInfo() {
    return {
      currentSession: this.currentSession
        ? {
            id: this.currentSession.id,
            raidId: this.currentSession.raidId,
            duration: this.formatSessionDuration(),
            eventCount: this.currentSession.events.length,
            isActive: this.currentSession.isActive,
          }
        : null,
      historyCount: this.sessionHistory.length,
      preferences: { ...this.preferences },
      stats: this.getSessionStats(),
    };
  }
}
