// ===================================================================
// File: client/src/raid/ui/RaidUIController.js
// Path: /client/src/raid/ui/RaidUIController.js
// Purpose: Centralized UI state management and display coordination for Raid Battles.
// Version: 2.2.0
//
// Changelog:
//   v2.2.0 - Added clientCore reference for debug toggle.
//            - Ensured all relevant element IDs are cached.
//            - Improved robustness of element checks before manipulation.
//            - Added more console logs for UI actions.
//   v2.1.0 - Integrated with RaidClientCore v1.0.0 and raid-test.html v2
// ===================================================================

import { raidErrorHandler } from '../../../shared/raid/RaidErrorHandler.js';
import { TurnIndicatorBar } from '../components/TurnIndicatorBar.js'; 

export class RaidUIController {
    constructor(sessionManager) { 
        this.sessionManager = sessionManager;
        this.clientCore = null; // Will be set by RaidClientCore instance
        this.currentView = 'lobby'; 
        this.elements = {}; 
        this.turnIndicatorBar = null;

        this.state = {
            raidId: null,
            playerId: null, 
            connectionStatus: 'initializing',
            isSpectator: false, 
            creatingRaid: false, 
            joiningRaid: false, 
        };

        this.config = {
            angleOffset: 0,
            positionScale: 1.0,
            animationSpeed: 300,
            showDebugInfo: false,
            autoScrollLog: true,
        };
        
        console.log('RaidUIController: Constructor called.');
        // Defer UI initialization to a method called after DOM is ready
        // This is typically handled by the main script that instantiates UIController
        // For now, assuming it's called appropriately.
        // this.initializeBaseUI(); // Call this after DOM load, e.g. from RaidClientCore or main script
    }

    initializeBaseUI() {
        console.log('RaidUIController: initializeBaseUI() called.');
        this.cacheBaseElements();
        this.setupGlobalEventListeners(); 
        this.createSessionDisplay(); 
        this.createNotificationSystem();
        this.createDebugPanel();

        const turnIndicatorContainer = this.elements.turnIndicatorContainer;
        if (turnIndicatorContainer) {
            try {
                this.turnIndicatorBar = new TurnIndicatorBar('turnIndicatorContainer'); 
                turnIndicatorContainer.style.display = 'none'; 
            } catch (e) {
                console.error("Failed to initialize TurnIndicatorBar:", e);
                this.logStatus("Error: Could not load TurnIndicatorBar.", "error");
            }
        } else {
            console.warn('[RaidUIController] Turn indicator container (turnIndicatorContainer) not found.');
        }

        this.logStatus('RaidUIController initialized.', 'info');
    }

    cacheBaseElements() {
        console.log('RaidUIController: cacheBaseElements() called.');
        const ids = [
            'raidLauncher', 'createRaidBtn', 'joinRaidBtn', 'raidIdInput', 'usernameInput',
            'launcherToggleLayoutBtn', 'launcherCurrentLayoutSpan', 'testMultiplayerBtn', 'quickTestBtn', 'stressTestBtn',
            'raidStatusLog', 'connectionStatusDisplay',
            'raidContainer', 'raidTable', 'raidPlayersContainer', 'raidBossDisplay',
            'layoutIndicatorGfx', 'layoutNameDisplay', 'bossNameDisplay', 'bossHPDisplay',
            'raidControls', 'controlRaidId', 'controlPlayerCount', 'controlLayoutDisplay',
            'controlYourAngle', 'controlRaidPhase', 'controlsSwitchLayoutBtn', 'leaveRaidBtn', 'toggleDebugPanelBtn',
            'gameActions', 'attackBtn', 'useItemBtn', 'cheerBtn', 'retreatBtn', 'passTurnBtn', 'testKOBtn',
            'turnIndicatorContainer'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                this.elements[id] = el;
            } else {
                console.warn(`[RaidUIController] Element '${id}' not found.`);
            }
        });
        // Specific caching for dynamically added elements will happen in their creation methods
    }

    setupGlobalEventListeners() {
        console.log('RaidUIController: setupGlobalEventListeners() called.');
        const toggleDebugBtn = this.elements.toggleDebugPanelBtn;
        if (toggleDebugBtn) {
            toggleDebugBtn.addEventListener('click', () => this.toggleDebug());
        } else {
            console.warn("toggleDebugPanelBtn not found for listener setup.");
        }
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' && e.shiftKey) {
                e.preventDefault();
                this.toggleDebug();
            }
        });

        raidErrorHandler.onError('*', (error) => { 
            this.displayErrorToUser(error);
        });
    }

    updateConnectionStatus(status, type = 'info') {
        console.log(`RaidUIController: updateConnectionStatus(${status}, ${type})`);
        this.state.connectionStatus = status;
        if (this.elements.connectionStatusDisplay) {
            this.elements.connectionStatusDisplay.textContent = status;
            this.elements.connectionStatusDisplay.className = type; 
        } else {
            console.warn("connectionStatusDisplay element not found for update.");
        }
    }

    updateRaidFullDisplay(raidState, currentPlayerId) {
        console.log('RaidUIController: updateRaidFullDisplay called with raidState:', raidState, "currentPlayerId:", currentPlayerId);
        if (!raidState) {
            this.logStatus('Cannot update raid display: No raid state.', 'warning');
            return;
        }
        this.state.raidId = raidState.id;
        this.state.playerId = currentPlayerId;

        this.updatePlayerVisuals(raidState.players, raidState.layout, currentPlayerId, raidState.positions);
        this.updateBossVisual(raidState.boss, raidState.positions);
        this.updateControlPanel(raidState, currentPlayerId);
        this.updateLayoutIndicatorGfx(raidState.layout);
        this.updateActionButtons(raidState, currentPlayerId);

        if (this.turnIndicatorBar && raidState.turnIndicator) {
            this.turnIndicatorBar.handleTurnUpdate({ turnIndicator: raidState.turnIndicator });
        } else if (this.turnIndicatorBar && !raidState.turnIndicator) {
            // console.warn("Turn indicator data missing in raidState for update.");
        }
        
        if (this.elements.turnIndicatorContainer) {
            this.elements.turnIndicatorContainer.style.display = (raidState.gamePhase === 'playing' || raidState.gamePhase === 'bossTurn') ? 'block' : 'none';
        }
        
        // Update debug panel if visible
        if (this.config.showDebugInfo && this.clientCore) {
            this.updateDebugInfo({ username: this.clientCore.username, layoutPreference: this.clientCore.getLayoutPreference(), currentRaidId: this.clientCore.currentRaidId }, raidState);
        }
    }

    updatePlayerVisuals(playersData, layout, currentPlayerId, positions) {
        const container = this.elements.raidPlayersContainer;
        if (!container) return console.warn("raidPlayersContainer not found for visuals.");
        container.innerHTML = ''; 

        if (!positions || !positions.players || !playersData) {
            // console.warn("Missing positions or playersData for player visuals.");
            return;
        }

        playersData.forEach(player => {
            const posData = positions.players.find(p => p.playerId === player.id);
            if (!posData) return; 

            const playerEl = document.createElement('div');
            playerEl.className = 'raid-player';
            if (player.id === currentPlayerId) playerEl.classList.add('current-player');

            const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#9b59b6', '#1abc9c'];
            const playerIndex = playersData.findIndex(p => p.id === player.id);
            playerEl.style.background = player.id === currentPlayerId ? 'linear-gradient(45deg, #f1c40f, #f39c12)' : (colors[playerIndex % colors.length] || '#7f8c8d');
            
            playerEl.style.left = `${posData.x}%`;
            playerEl.style.top = `${posData.y}%`;
            playerEl.style.transform = 'translate(-50%, -50%)'; 

            playerEl.innerHTML = `
                <div class="player-name">${player.username || `P${playerIndex + 1}`} ${player.id === currentPlayerId ? '<small>(You)</small>' : ''}</div>
                <div class="player-angle-display">${Math.round(posData.angle)}°</div>
            `;
            container.appendChild(playerEl);
        });
    }

    updateBossVisual(bossData, positions) {
        const bossEl = this.elements.raidBossDisplay;
        if (!bossEl) return console.warn("raidBossDisplay element not found.");

        const bossNameEl = this.elements.bossNameDisplay;
        const bossHPEl = this.elements.bossHPDisplay;
        const bossHpBar = bossEl.querySelector('.boss-hp-bar');

        if (!bossData || !positions || !positions.boss) {
            bossEl.style.display = 'none';
            return;
        }
        bossEl.style.display = 'flex';
        bossEl.style.left = `${positions.boss.x}%`;
        bossEl.style.top = `${positions.boss.y}%`;

        if (bossNameEl) bossNameEl.textContent = bossData.name || 'Raid Boss';
        if (bossHPEl) bossHPEl.textContent = `HP: ${bossData.currentHP || 0} / ${bossData.maxHP || 0}`;

        if (bossHpBar && bossData.maxHP > 0) {
            const hpPercent = (bossData.currentHP / bossData.maxHP) * 100;
            bossHpBar.style.width = `${Math.max(0, hpPercent)}%`;
        } else if (bossHpBar) {
            bossHpBar.style.width = '0%';
        }
    }

    updateControlPanel(raidState, currentPlayerId) {
        if (!this.elements.raidControls) return console.warn("raidControls element not found.");
        
        const playerPosition = raidState.positions?.players?.find(p => p.playerId === currentPlayerId);

        if (this.elements.controlRaidId) this.elements.controlRaidId.textContent = raidState.id || '-';
        if (this.elements.controlPlayerCount) this.elements.controlPlayerCount.textContent = `${raidState.players?.length || 0}/${raidState.maxPlayers || 4}`;
        if (this.elements.controlLayoutDisplay) this.elements.controlLayoutDisplay.textContent = raidState.layout || '-';
        if (this.elements.controlYourAngle) this.elements.controlYourAngle.textContent = playerPosition ? Math.round(playerPosition.angle) : '-';
        if (this.elements.controlRaidPhase) this.elements.controlRaidPhase.textContent = raidState.gamePhase || 'Lobby';
    }
    
    updateLayoutIndicatorGfx(layout) {
        if (!layout) return;
        if (this.elements.layoutNameDisplay) this.elements.layoutNameDisplay.textContent = layout.charAt(0).toUpperCase() + layout.slice(1);
        if (this.elements.layoutIndicatorGfx) {
            this.elements.layoutIndicatorGfx.className = `layout-indicator-gfx layout-${layout}`;
        }
    }

    updateActionButtons(raidState, currentPlayerId) {
        if (!raidState) return;
        const isMyTurn = raidState.gamePhase === 'playing' && raidState.currentTurnPlayerId === currentPlayerId;
        const gameIsActive = raidState.gamePhase === 'playing' || raidState.gamePhase === 'bossTurn';
        const gameEnded = raidState.gamePhase === 'ended';

        const actionButtons = {
            attackBtn: isMyTurn && !gameEnded,
            useItemBtn: false, // NYI
            cheerBtn: false, // NYI
            retreatBtn: false, // NYI
            passTurnBtn: false, // NYI
            testKOBtn: gameIsActive && !gameEnded, // Keep enabled for debug during active game
        };

        for (const btnId in actionButtons) {
            const btn = this.elements[btnId];
            if (btn) {
                btn.disabled = !actionButtons[btnId];
            } else {
                // console.warn(`Action button ${btnId} not found for update.`);
            }
        }
    }

    switchView(viewName) { 
        console.log(`RaidUIController: switchView(${viewName}) called.`);
        this.currentView = viewName;
        const launcher = this.elements.raidLauncher;
        const container = this.elements.raidContainer;
        const controls = this.elements.raidControls;
        const actions = this.elements.gameActions;
        const turnIndicator = this.elements.turnIndicatorContainer;

        if (viewName === 'lobby') {
            if (launcher) launcher.style.display = 'block'; else console.warn("raidLauncher not found for lobby view");
            if (container) container.style.display = 'none';
            if (controls) controls.style.display = 'none';
            if (actions) actions.style.display = 'none';
            if (turnIndicator) turnIndicator.style.display = 'none';
        } else if (viewName === 'game') {
            if (launcher) launcher.style.display = 'none';
            if (container) container.style.display = 'block'; else console.warn("raidContainer not found for game view");
            if (controls) controls.style.display = 'block'; else console.warn("raidControls not found for game view");
            if (actions) actions.style.display = 'flex'; else console.warn("gameActions not found for game view");
            // Turn indicator visibility is handled by updateRaidFullDisplay
        }
        this.logStatus(`Switched view to: ${viewName}`, 'info');
    }

    createSessionDisplay() {
        console.log('RaidUIController: createSessionDisplay() called.');
        const launcher = this.elements.raidLauncher;
        if (!launcher) return console.warn("raidLauncher not found for session display creation.");

        const existingDisplay = document.getElementById('sessionDisplayContainer');
        if (existingDisplay) existingDisplay.remove();

        const sessionDisplayContainer = document.createElement('div');
        sessionDisplayContainer.id = 'sessionDisplayContainer';
        sessionDisplayContainer.className = 'session-display'; 
        sessionDisplayContainer.innerHTML = `
            <div class="session-header">
                <h3>Current Session</h3>
                <button id="refreshSessionBtn" class="icon-btn" title="Refresh (NYI)" disabled>🔄</button>
            </div>
            <div class="session-info">
                <div class="session-id-container">
                    <label for="currentSessionIdInput" style="color: #ddd; font-size: 0.9em;">Session ID:</label>
                    <input type="text" id="currentSessionIdInput" readonly placeholder="No active session">
                    <button id="copySessionIdBtn" class="icon-btn" title="Copy ID">📋</button>
                </div>
                <div class="session-stats">
                    <span>Players: <strong id="sessionPlayerCountDisplay">-</strong></span>
                    <span>Status: <strong id="sessionStatusDisplay">Lobby</strong></span>
                </div>
            </div>
        `;
        const firstButtonGroup = launcher.querySelector('.button-group');
        if (firstButtonGroup) {
            launcher.insertBefore(sessionDisplayContainer, firstButtonGroup);
        } else {
            launcher.prepend(sessionDisplayContainer);
        }

        this.elements.currentSessionIdInput = document.getElementById('currentSessionIdInput');
        this.elements.copySessionIdBtn = document.getElementById('copySessionIdBtn');
        this.elements.sessionPlayerCountDisplay = document.getElementById('sessionPlayerCountDisplay');
        this.elements.sessionStatusDisplay = document.getElementById('sessionStatusDisplay');
        this.elements.refreshSessionBtn = document.getElementById('refreshSessionBtn');

        if (this.elements.copySessionIdBtn) {
            this.elements.copySessionIdBtn.addEventListener('click', () => this.copySessionIdToClipboard());
        }
    }

    updateSessionDisplay(raidState) {
        console.log('RaidUIController: updateSessionDisplay called with raidState:', raidState);
        if (!raidState) {
            this.clearSessionDisplay();
            return;
        }
        if (this.elements.currentSessionIdInput) this.elements.currentSessionIdInput.value = raidState.id;
        if (this.elements.sessionPlayerCountDisplay) this.elements.sessionPlayerCountDisplay.textContent = `${raidState.players?.length || 0}/${raidState.maxPlayers || 4}`;
        if (this.elements.sessionStatusDisplay) {
            this.elements.sessionStatusDisplay.textContent = raidState.gamePhase || 'Lobby';
            this.elements.sessionStatusDisplay.className = `status-${(raidState.gamePhase || 'lobby').toLowerCase()}`;
        }
    }
    
    clearSessionDisplay() {
        console.log('RaidUIController: clearSessionDisplay() called.');
        if (this.elements.currentSessionIdInput) this.elements.currentSessionIdInput.value = '';
        if (this.elements.sessionPlayerCountDisplay) this.elements.sessionPlayerCountDisplay.textContent = '-';
        if (this.elements.sessionStatusDisplay) {
            this.elements.sessionStatusDisplay.textContent = 'N/A';
            this.elements.sessionStatusDisplay.className = '';
        }
    }

    copySessionIdToClipboard() {
        console.log('RaidUIController: copySessionIdToClipboard() called.');
        const sessionId = this.elements.currentSessionIdInput ? this.elements.currentSessionIdInput.value : null;
        if (!sessionId) {
            this.showNotification('No Session ID to copy.', 'warning');
            return;
        }
        navigator.clipboard.writeText(sessionId).then(() => {
            this.showNotification('Session ID copied!', 'success');
            if(this.elements.copySessionIdBtn) {
                this.elements.copySessionIdBtn.textContent = '✅';
                setTimeout(() => { if(this.elements.copySessionIdBtn) this.elements.copySessionIdBtn.textContent = '📋'; }, 1500);
            }
        }).catch(err => {
            this.showNotification('Failed to copy Session ID.', 'error');
            console.error('Failed to copy text: ', err);
        });
    }
    
    setRaidIdInputValue(raidId) {
        if (this.elements.raidIdInput) this.elements.raidIdInput.value = raidId;
        if (this.elements.currentSessionIdInput && (!this.elements.currentSessionIdInput.value || this.elements.currentSessionIdInput.value === raidId)) {
             this.elements.currentSessionIdInput.value = raidId;
        }
    }

    setUsernameInputValue(username) {
        if (this.elements.usernameInput) this.elements.usernameInput.value = username;
    }
    
    updateLauncherLayoutDisplay(layout) {
        if (this.elements.launcherCurrentLayoutSpan) {
            this.elements.launcherCurrentLayoutSpan.textContent = layout;
        } else {
            console.warn("launcherCurrentLayoutSpan not found for update.");
        }
    }

    createNotificationSystem() {
        console.log('RaidUIController: createNotificationSystem() called.');
        const existingContainer = document.getElementById('notificationContainer');
        if (existingContainer) return; 

        const container = document.createElement('div');
        container.id = 'notificationContainer';
        container.className = 'notification-container';
        document.body.appendChild(container);
        this.elements.notificationContainer = container;
    }

    showNotification(message, type = 'info', duration = 4000) {
        console.log(`RaidUIController: showNotification (Type: ${type}, Msg: ${message})`);
        const container = this.elements.notificationContainer;
        if (!container) {
            console.warn('Notification container not found. Message:', message);
            alert(`${type.toUpperCase()}: ${message}`); // Fallback
            return;
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`; 
        notification.textContent = message;
        container.prepend(notification); 

        requestAnimationFrame(() => { 
            notification.classList.add('notification-show');
        });

        setTimeout(() => {
            notification.classList.remove('notification-show');
            notification.addEventListener('transitionend', () => notification.remove(), { once: true });
        }, duration);
    }

    logStatus(message, type = 'info') { 
        const logContainer = this.elements.raidStatusLog;
        if (!logContainer) {
            console.log(`[STATUS LOG - ${type}] ${message}`); // Fallback if UI not ready
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `status-entry ${type}`; 
        entry.innerHTML = `[${timestamp}] ${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`; 

        logContainer.appendChild(entry);
        if (this.config.autoScrollLog) {
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }
    
    createDebugPanel() {
        console.log('RaidUIController: createDebugPanel() called.');
        const existingPanel = document.getElementById('debugPanel');
        if (existingPanel) return;

        const panel = document.createElement('div');
        panel.id = 'debugPanel';
        panel.className = 'debug-panel';
        panel.style.display = this.config.showDebugInfo ? 'block' : 'none';
        panel.innerHTML = `
            <div class="debug-header">
                <h4>🐞 Debug Info</h4>
                <button id="closeDebugBtn" class="icon-btn" title="Close (Shift+F12)">✕</button>
            </div>
            <div class="debug-content">
                <h5>Client Core State:</h5>
                <pre id="debugClientCoreState"></pre>
                <h5>UI Controller State:</h5>
                <pre id="debugUiControllerState"></pre>
                <h5>Last Full Raid State:</h5>
                <pre id="debugLastRaidState"></pre>
                <h5>Recent Errors:</h5>
                <pre id="debugRecentErrors"></pre>
            </div>
        `;
        document.body.appendChild(panel);
        this.elements.debugPanel = panel;
        this.elements.debugClientCoreState = document.getElementById('debugClientCoreState');
        this.elements.debugUiControllerState = document.getElementById('debugUiControllerState');
        this.elements.debugLastRaidState = document.getElementById('debugLastRaidState');
        this.elements.debugRecentErrors = document.getElementById('debugRecentErrors');

        const closeBtn = document.getElementById('closeDebugBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.toggleDebug(false));
        } else {
            console.warn("closeDebugBtn not found for debug panel.");
        }
    }

    toggleDebug(show) {
        this.config.showDebugInfo = show === undefined ? !this.config.showDebugInfo : show;
        console.log(`RaidUIController: toggleDebug(${this.config.showDebugInfo}) called.`);
        if (this.elements.debugPanel) {
            this.elements.debugPanel.style.display = this.config.showDebugInfo ? 'block' : 'none';
        }
        if (this.config.showDebugInfo && this.clientCore) { // Ensure clientCore is available
             this.updateDebugInfo({ username: this.clientCore.username, layoutPreference: this.clientCore.getLayoutPreference(), currentRaidId: this.clientCore.currentRaidId }, this.clientCore.raidState);
        } else if (this.config.showDebugInfo) {
            this.updateDebugInfo(); // Update with whatever state UI controller has
        }
    }

    updateDebugInfo(clientCoreSnapshot = {}, currentRaidStateSnapshot = {}) {
        if (!this.config.showDebugInfo || !this.elements.debugPanel) return;
        // console.log("RaidUIController: updateDebugInfo called.");

        if (this.elements.debugClientCoreState) {
            this.elements.debugClientCoreState.textContent = JSON.stringify(clientCoreSnapshot, null, 2);
        }
        if (this.elements.debugUiControllerState) {
             const uiStateSnapshot = {
                currentView: this.currentView,
                stateRaidId: this.state.raidId,
                statePlayerId: this.state.playerId,
                connectionStatus: this.state.connectionStatus,
             };
            this.elements.debugUiControllerState.textContent = JSON.stringify(uiStateSnapshot, null, 2);
        }
        if (this.elements.debugLastRaidState) {
            this.elements.debugLastRaidState.textContent = JSON.stringify(currentRaidStateSnapshot, null, 2);
        }
        if (this.elements.debugRecentErrors) {
            const errors = raidErrorHandler.getErrorHistory(null, 5).map(e => ({
                id: e.id.slice(-6), code: e.code, msg: e.message, time: new Date(e.timestamp).toLocaleTimeString()
            }));
            this.elements.debugRecentErrors.textContent = JSON.stringify(errors, null, 2);
        }
    }
    
    displayErrorToUser(error) { 
        console.error(`RaidUIController: displayErrorToUser: ${error.message} (Code: ${error.code})`);
        this.showNotification(`Error: ${error.message} (Code: ${error.code})`, 'error', 5000);
        this.logStatus(`ERROR: ${error.message} (Code: ${error.code}, Details: ${JSON.stringify(error.details || {})})`, 'error');
        if (this.config.showDebugInfo && this.clientCore) { // Ensure clientCore is available
             this.updateDebugInfo({ username: this.clientCore.username, layoutPreference: this.clientCore.getLayoutPreference(), currentRaidId: this.clientCore.currentRaidId }, this.clientCore.raidState);
        }
    }

    setCreatingRaid(isCreating, raidId = '') {
        console.log(`RaidUIController: setCreatingRaid(${isCreating}, RaidID: ${raidId})`);
        this.state.creatingRaid = isCreating;
        if (this.elements.createRaidBtn) this.elements.createRaidBtn.disabled = isCreating;
        if (this.elements.joinRaidBtn) this.elements.joinRaidBtn.disabled = isCreating;
        if (isCreating) {
            this.logStatus(`Creating raid ${raidId ? '('+raidId+') ' : ''}...`, 'info');
        }
    }
}
