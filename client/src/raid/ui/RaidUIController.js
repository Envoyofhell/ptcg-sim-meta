// ===================================================================
// File: client/src/raid/ui/RaidUIController.js
// Path: /client/src/raid/ui/RaidUIController.js
// Purpose: Centralized UI state management and display coordination
// Version: 2.0.0
// 
// Dependencies:
//   - shared/raid/RaidSessionManager.js
//   - shared/raid/RaidErrorHandler.js
// 
// Used By:
//   - client/src/raid/RaidClientCore.js
//   - client/raid-test.html
// 
// Changelog:
//   v2.0.0 - Complete rewrite fixing display issues
// ===================================================================

import { raidErrorHandler } from '../../../shared/raid/RaidErrorHandler.js';

export class RaidUIController {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.currentView = 'lobby'; // lobby, game, spectator
        this.elements = new Map();
        this.animations = new Map();
        
        // UI State
        this.state = {
            sessionId: null,
            playerId: null,
            playerData: null,
            positions: [],
            bossPosition: null,
            gameState: null,
            isSpectator: false,
            connectionStatus: 'disconnected'
        };
        
        // Display configuration
        this.config = {
            angleOffset: 0, // Fixes angle display mismatch
            positionScale: 1.0,
            animationSpeed: 300,
            showDebugInfo: false,
            autoScrollLog: true
        };
        
        this.initializeUI();
    }
    
    // ================ INITIALIZATION ================
    
    /**
     * Initializes all UI elements and event listeners
     */
    initializeUI() {
        this.cacheElements();
        this.setupEventListeners();
        this.createSessionDisplay();
        this.createNotificationSystem();
        this.createDebugPanel();
    }
    
    /**
     * Caches DOM elements for performance
     */
    cacheElements() {
        const elementIds = [
            // Main containers
            'raidLauncher', 'raidContainer', 'raidControls', 'gameActions',
            
            // Session elements
            'sessionDisplay', 'sessionList', 'currentSessionId', 'sessionIdDisplay',
            
            // Input elements
            'raidIdInput', 'usernameInput', 'passwordInput',
            
            // Status elements
            'connectionStatus', 'playerCount', 'controlLayout', 'yourAngle',
            'raidPhase', 'raidStatus',
            
            // Game elements
            'raidPlayers', 'raidBoss', 'bossName', 'bossHP',
            
            // Buttons
            'createRaidBtn', 'joinRaidBtn', 'copyIdBtn', 'refreshBtn',
            'attackBtn', 'retreatBtn', 'cheerBtn', 'testKOBtn'
        ];
        
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        });
    }
    
    /**
     * Creates session display panel
     */
    createSessionDisplay() {
        const sessionDisplay = document.createElement('div');
        sessionDisplay.id = 'sessionDisplay';
        sessionDisplay.className = 'session-display';
        sessionDisplay.innerHTML = `
            <div class="session-header">
                <h3>Current Session</h3>
                <button id="refreshSessionBtn" class="icon-btn" title="Refresh">🔄</button>
            </div>
            <div class="session-info">
                <div class="session-id-container">
                    <label>Session ID:</label>
                    <input type="text" id="currentSessionId" readonly>
                    <button id="copyIdBtn" class="icon-btn" title="Copy ID">📋</button>
                </div>
                <div class="session-stats">
                    <span>Players: <strong id="sessionPlayerCount">0/0</strong></span>
                    <span>Status: <strong id="sessionStatus">-</strong></span>
                </div>
            </div>
            <div class="session-actions">
                <button id="shareSessionBtn" class="session-btn">Share Session</button>
                <button id="sessionSettingsBtn" class="session-btn">Settings</button>
            </div>
        `;
        
        const launcher = this.elements.get('raidLauncher');
        if (launcher) {
            launcher.insertBefore(sessionDisplay, launcher.firstChild);
        }
        
        // Cache new elements
        this.cacheElements();
        
        // Setup copy functionality
        const copyBtn = document.getElementById('copyIdBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copySessionId());
        }
    }
    
    /**
     * Creates notification system
     */
    createNotificationSystem() {
        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
        
        this.elements.set('notificationContainer', notificationContainer);
    }
    
    /**
     * Creates debug panel
     */
    createDebugPanel() {
        const debugPanel = document.createElement('div');
        debugPanel.id = 'debugPanel';
        debugPanel.className = 'debug-panel';
        debugPanel.style.display = this.config.showDebugInfo ? 'block' : 'none';
        debugPanel.innerHTML = `
            <div class="debug-header">
                <h4>Debug Info</h4>
                <button id="closeDebugBtn" class="icon-btn">✕</button>
            </div>
            <div class="debug-content">
                <div id="debugPositions"></div>
                <div id="debugGameState"></div>
                <div id="debugErrors"></div>
            </div>
        `;
        
        document.body.appendChild(debugPanel);
        this.elements.set('debugPanel', debugPanel);
        
        // Setup close button
        const closeBtn = document.getElementById('closeDebugBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleDebug(false));
        }
    }
    
    // ================ SESSION MANAGEMENT ================
    
    /**
     * Updates session display with current session info
     */
    updateSessionDisplay(session) {
        if (!session) {
            this.clearSessionDisplay();
            return;
        }
        
        // Update session ID
        const sessionIdInput = this.elements.get('currentSessionId');
        if (sessionIdInput) {
            sessionIdInput.value = session.id;
        }
        
        // Update player count (fix the display issue)
        const playerCountEl = document.getElementById('sessionPlayerCount');
        if (playerCountEl) {
            playerCountEl.textContent = `${session.players.size}/${session.maxPlayers}`;
        }
        
        // Update status
        const statusEl = document.getElementById('sessionStatus');
        if (statusEl) {
            statusEl.textContent = session.status;
            statusEl.className = `status-${session.status}`;
        }
        
        // Update main player count display (fix the duplicate max players issue)
        const mainPlayerCount = this.elements.get('playerCount');
        if (mainPlayerCount) {
            mainPlayerCount.textContent = `${session.players.size}/${session.maxPlayers}`;
        }
        
        this.state.sessionId = session.id;
    }
    
    /**
     * Clears session display
     */
    clearSessionDisplay() {
        const sessionIdInput = this.elements.get('currentSessionId');
        if (sessionIdInput) {
            sessionIdInput.value = '';
        }
        
        const elements = ['sessionPlayerCount', 'sessionStatus'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });
        
        this.state.sessionId = null;
    }
    
    /**
     * Copies session ID to clipboard
     */
    async copySessionId() {
        const sessionIdInput = this.elements.get('currentSessionId');
        if (!sessionIdInput || !sessionIdInput.value) {
            this.showNotification('No session ID to copy', 'warning');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(sessionIdInput.value);
            this.showNotification('Session ID copied!', 'success');
            
            // Visual feedback
            const copyBtn = document.getElementById('copyIdBtn');
            if (copyBtn) {
                copyBtn.textContent = '✓';
                setTimeout(() => {
                    copyBtn.textContent = '📋';
                }, 1000);
            }
        } catch (error) {
            this.showNotification('Failed to copy ID', 'error');
        }
    }
    
    // ================ POSITION MANAGEMENT ================
    
    /**
     * Updates player positions with proper angle calculation
     */
    updatePlayerPositions(positions) {
        const container = this.elements.get('raidPlayers');
        if (!container) return;
        
        // Clear existing players
        container.innerHTML = '';
        
        positions.forEach((position, index) => {
            const playerEl = this.createPlayerElement(position, index);
            container.appendChild(playerEl);
            
            // Update angle display for current player (fix angle mismatch)
            if (position.playerId === this.state.playerId) {
                const angleEl = this.elements.get('yourAngle');
                if (angleEl) {
                    // Apply angle offset correction
                    const displayAngle = (position.angle + this.config.angleOffset) % 360;
                    angleEl.textContent = Math.round(displayAngle);
                }
            }
        });
        
        this.state.positions = positions;
    }
    
    /**
     * Creates player element with proper positioning
     */
    createPlayerElement(position, index) {
        const playerEl = document.createElement('div');
        const isCurrentPlayer = position.playerId === this.state.playerId;
        
        playerEl.className = 'raid-player' + (isCurrentPlayer ? ' current-player' : '');
        playerEl.dataset.playerId = position.playerId;
        
        // Apply position with scaling
        const scaledX = position.x * this.config.positionScale;
        const scaledY = position.y * this.config.positionScale;
        
        playerEl.style.left = `${scaledX}%`;
        playerEl.style.top = `${scaledY}%`;
        playerEl.style.transform = 'translate(-50%, -50%)';
        
        // Create inner content
        const username = position.username || `Player ${index + 1}`;
        playerEl.innerHTML = `
            <div class="player-info">
                <div class="player-name">${isCurrentPlayer ? 'YOU' : username}</div>
                <div class="player-angle">${Math.round(position.angle)}°</div>
            </div>
            <div class="angle-indicator">${Math.round(position.angle)}</div>
        `;
        
        // Add hover effect
        playerEl.addEventListener('mouseenter', () => {
            this.showPlayerTooltip(position);
        });
        
        return playerEl;
    }
    
    /**
     * Updates boss position
     */
    updateBossPosition(bossPosition) {
        const bossEl = this.elements.get('raidBoss');
        if (!bossEl || !bossPosition) return;
        
        bossEl.style.left = `${bossPosition.x}%`;
        bossEl.style.top = `${bossPosition.y}%`;
        
        this.state.bossPosition = bossPosition;
    }
    
    // ================ GAME STATE DISPLAY ================
    
    /**
     * Updates game state display
     */
    updateGameState(gameState) {
        if (!gameState) return;
        
        this.state.gameState = gameState;
        
        // Update boss info
        this.updateBossInfo(gameState.boss);
        
        // Update player info
        this.updatePlayerInfo(gameState.players);
        
        // Update game phase
        this.updateGamePhase(gameState.gamePhase);
        
        // Update action buttons
        this.updateActionButtons(gameState);
    }
    
    /**
     * Updates boss information display
     */
    updateBossInfo(boss) {
        if (!boss) return;
        
        const bossNameEl = this.elements.get('bossName');
        if (bossNameEl) {
            bossNameEl.textContent = boss.card?.name || 'Raid Boss';
        }
        
        const bossHPEl = this.elements.get('bossHP');
        if (bossHPEl) {
            bossHPEl.textContent = `HP: ${boss.currentHP || 0} / ${boss.maxHP || 0}`;
            
            // Update HP bar if exists
            const hpPercent = (boss.currentHP / boss.maxHP) * 100;
            const hpBar = document.querySelector('.boss-hp-bar');
            if (hpBar) {
                hpBar.style.width = `${hpPercent}%`;
            }
        }
    }
    
    /**
     * Updates player information
     */
    updatePlayerInfo(players) {
        // This would update player-specific UI elements
        // Implementation depends on your UI structure
    }
    
    /**
     * Updates game phase display
     */
    updateGamePhase(phase) {
        const phaseEl = this.elements.get('raidPhase');
        if (phaseEl) {
            phaseEl.textContent = phase;
            phaseEl.className = `phase-${phase}`;
        }
    }
    
    /**
     * Updates action button states
     */
    updateActionButtons(gameState) {
        const buttons = ['attackBtn', 'retreatBtn', 'cheerBtn', 'testKOBtn'];
        
        buttons.forEach(btnId => {
            const btn = this.elements.get(btnId);
            if (!btn) return;
            
            // Enable/disable based on game state and player status
            const canAct = gameState.gamePhase === 'playing' && 
                          !this.state.isSpectator;
            
            btn.disabled = !canAct;
        });
    }
    
    // ================ NOTIFICATIONS ================
    
    /**
     * Shows a notification
     */
    showNotification(message, type = 'info', duration = 3000) {
        const container = this.elements.get('notificationContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        container.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('notification-show');
        }, 10);
        
        // Remove after duration
        setTimeout(() => {
            notification.classList.remove('notification-show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
    }
    
    // ================ VIEW MANAGEMENT ================
    
    /**
     * Switches to a different view
     */
    switchView(viewName) {
        const views = {
            lobby: ['raidLauncher'],
            game: ['raidContainer', 'raidControls', 'gameActions'],
            spectator: ['raidContainer', 'raidControls']
        };
        
        // Hide all views
        Object.values(views).flat().forEach(id => {
            const el = this.elements.get(id);
            if (el) el.style.display = 'none';
        });
        
        // Show requested view
        const viewElements = views[viewName] || [];
        viewElements.forEach(id => {
            const el = this.elements.get(id);
            if (el) el.style.display = 'block';
        });
        
        this.currentView = viewName;
    }
    
    // ================ ERROR HANDLING ================
    
    /**
     * Displays an error in the UI
     */
    displayError(error) {
        // Show notification
        this.showNotification(error.message, 'error', 5000);
        
        // Log to status
        this.logStatus(error.message, 'error');
        
        // Update debug panel if visible
        if (this.config.showDebugInfo) {
            this.updateDebugErrors(error);
        }
    }
    
    /**
     * Logs a status message
     */
    logStatus(message, type = 'info') {
        const statusEl = this.elements.get('raidStatus');
        if (!statusEl) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `status-entry status-${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        statusEl.appendChild(entry);
        
        if (this.config.autoScrollLog) {
            statusEl.scrollTop = statusEl.scrollHeight;
        }
    }
    
    // ================ DEBUG FUNCTIONS ================
    
    /**
     * Toggles debug panel
     */
    toggleDebug(show = null) {
        this.config.showDebugInfo = show ?? !this.config.showDebugInfo;
        
        const debugPanel = this.elements.get('debugPanel');
        if (debugPanel) {
            debugPanel.style.display = this.config.showDebugInfo ? 'block' : 'none';
        }
        
        if (this.config.showDebugInfo) {
            this.updateDebugInfo();
        }
    }
    
    /**
     * Updates debug information
     */
    updateDebugInfo() {
        this.updateDebugPositions();
        this.updateDebugGameState();
        this.updateDebugErrors();
    }
    
    /**
     * Updates debug position info
     */
    updateDebugPositions() {
        const container = document.getElementById('debugPositions');
        if (!container) return;
        
        const positions = this.state.positions.map(pos => ({
            id: pos.playerId.substr(-6),
            angle: pos.angle,
            x: pos.x.toFixed(1),
            y: pos.y.toFixed(1)
        }));
        
        container.innerHTML = `
            <h5>Positions</h5>
            <pre>${JSON.stringify(positions, null, 2)}</pre>
        `;
    }
    
    /**
     * Updates debug game state
     */
    updateDebugGameState() {
        const container = document.getElementById('debugGameState');
        if (!container || !this.state.gameState) return;
        
        container.innerHTML = `
            <h5>Game State</h5>
            <pre>${JSON.stringify({
                phase: this.state.gameState.gamePhase,
                bossHP: this.state.gameState.boss?.currentHP,
                playerCount: this.state.gameState.players?.size
            }, null, 2)}</pre>
        `;
    }
    
    /**
     * Updates debug errors
     */
    updateDebugErrors(error = null) {
        const container = document.getElementById('debugErrors');
        if (!container) return;
        
        const errors = raidErrorHandler.getErrorHistory(null, 5);
        
        container.innerHTML = `
            <h5>Recent Errors</h5>
            <pre>${JSON.stringify(errors.map(e => ({
                code: e.code,
                message: e.message,
                time: new Date(e.timestamp).toLocaleTimeString()
            })), null, 2)}</pre>
        `;
    }
    
    // ================ EVENT LISTENERS ================
    
    /**
     * Sets up UI event listeners
     */
    setupEventListeners() {
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' && e.shiftKey) {
                this.toggleDebug();
            }
        });
        
        // Error handler integration
        raidErrorHandler.onError('*', (error) => {
            this.displayError(error);
        });
    }
    
    // ================ UTILITY METHODS ================
    
    /**
     * Shows player tooltip
     */
    showPlayerTooltip(position) {
        // Implementation for player hover tooltips
    }
    
    /**
     * Gets UI controller state
     */
    getState() {
        return {
            ...this.state,
            currentView: this.currentView,
            config: this.config
        };
    }
    
    /**
     * Updates UI configuration
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
    }
}

// ===================================================================
// Styles needed for this controller (add to your CSS)
// ===================================================================
const styles = `
<style>
/* Session Display */
.session-display {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 20px;
}

.session-id-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px 0;
}

#currentSessionId {
    flex: 1;
    padding: 8px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.2);
    color: white;
    border-radius: 5px;
}

.icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 18px;
    padding: 5px;
    transition: transform 0.2s;
}

.icon-btn:hover {
    transform: scale(1.1);
}

/* Notifications */
.notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
}

.notification {
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    margin-bottom: 10px;
    transform: translateX(400px);
    transition: transform 0.3s ease;
}

.notification-show {
    transform: translateX(0);
}

.notification-success {
    border-left: 4px solid #2ecc71;
}

.notification-error {
    border-left: 4px solid #e74c3c;
}

.notification-warning {
    border-left: 4px solid #f39c12;
}

.notification-info {
    border-left: 4px solid #3498db;
}

/* Debug Panel */
.debug-panel {
    position: fixed;
    bottom: 20px;
    left: 20px;
    width: 300px;
    max-height: 400px;
    background: rgba(0, 0, 0, 0.95);
    color: white;
    border-radius: 10px;
    overflow: hidden;
    z-index: 9999;
}

.debug-header {
    background: rgba(255, 255, 255, 0.1);
    padding: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.debug-content {
    padding: 10px;
    overflow-y: auto;
    max-height: 350px;
    font-size: 12px;
}

.debug-content pre {
    margin: 0;
    white-space: pre-wrap;
}

/* Status colors */
.status-lobby { color: #3498db; }
.status-active { color: #2ecc71; }
.status-ended { color: #e74c3c; }

/* Player tooltips */
.player-tooltip {
    position: absolute;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 10px;
    border-radius: 5px;
    font-size: 12px;
    pointer-events: none;
    z-index: 1000;
}
</style>
`;

// ===================================================================
// Future Scripts Needed:
// 1. client/src/raid/RaidClientCore.js - Main client integration
// 2. client/src/raid/RaidSocketClient.js - Socket connection handler
// 3. client/src/raid/ui/RaidSessionBrowser.js - Session browser UI
// 4. client/src/raid/ui/RaidGameUI.js - Game-specific UI components
// ===================================================================