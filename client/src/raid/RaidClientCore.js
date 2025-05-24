// ===================================================================
// File: client/src/raid/RaidClientCore.js
// Path: /client/src/raid/RaidClientCore.js
// Purpose: Core client-side logic for the PTCG Raid Battle System.
// Version: 1.1.0
//
// Changelog:
//   v1.1.0 - Added console logs for button actions.
//            - Distinguished layout preference from active raid layout.
//            - Added getActiveRaidLayout for controls.
//            - Ensured UIController is robustly called.
//   v1.0.0 - Initial implementation.
// ===================================================================

import { RaidUIController } from './ui/RaidUIController.js';
import { raidErrorHandler } from '../../shared/raid/RaidErrorHandler.js';
import { RaidSessionManager } from '../../shared/raid/RaidSessionManager.js';

export class RaidClientCore {
    constructor() {
        this.socket = null;
        this.currentRaidId = null;
        this.raidState = null; 
        this.playerId = null; 
        this.username = 'Player';
        this._layoutPreference = 'versus'; // Internal preference for new raids

        this.sessionManager = new RaidSessionManager();
        this.uiController = new RaidUIController(this.sessionManager); 
        this.uiController.clientCore = this; // Give UIController a reference back for certain actions if needed (e.g. debug toggle)


        this.isAttemptingConnection = false;
        this.log('RaidClientCore: Initializing (v1.1.0)...');
        this.uiController.logStatus('RaidClientCore: Initializing...');
        this.uiController.updateLauncherLayoutDisplay(this._layoutPreference); // Initialize launcher display
    }

    connect() {
        console.log('RaidClientCore: connect() called.');
        if (this.socket && this.socket.connected) {
            this.log('RaidClientCore: Already connected.');
            return;
        }
        if (this.isAttemptingConnection) {
            this.log('RaidClientCore: Connection attempt already in progress.');
            return;
        }

        this.log('RaidClientCore: Attempting to connect to server...');
        this.uiController.updateConnectionStatus('Connecting...', 'info');
        this.isAttemptingConnection = true;

        if (typeof io === 'undefined') {
            this.log('RaidClientCore: Socket.IO client (io) not found!', 'error', true);
            raidErrorHandler.logError(raidErrorHandler.codes.SYSTEM, 'Socket.IO client not loaded.');
            this.isAttemptingConnection = false;
            this.uiController.updateConnectionStatus('Error: Socket.IO missing', 'error');
            return;
        }

        this.socket = io();
        this.setupSocketListeners();
    }

    setupSocketListeners() {
        if (!this.socket) return;
        console.log('RaidClientCore: setupSocketListeners() called.');

        this.socket.on('connect', () => {
            this.playerId = this.socket.id;
            this.isAttemptingConnection = false;
            this.log(`RaidClientCore: Connected (ID: ${this.socket.id})`, 'success');
            this.uiController.updateConnectionStatus('Connected', 'success');
            this.uiController.logStatus(`Connected with ID: ${this.socket.id}`);
            this.attemptAutoJoinFromUrl();
        });

        this.socket.on('disconnect', (reason) => {
            this.isAttemptingConnection = false;
            this.log(`RaidClientCore: Disconnected. Reason: ${reason}`, 'warning');
            this.uiController.updateConnectionStatus(`Disconnected: ${reason}`, 'error');
            if (this.currentRaidId) {
                this.uiController.showNotification('Disconnected from raid server!', 'error');
            }
        });

        this.socket.on('connect_error', (error) => {
            this.isAttemptingConnection = false;
            this.log(`RaidClientCore: Connection error: ${error.message}`, 'error', true);
            raidErrorHandler.logError(raidErrorHandler.codes.CONNECTION_LOST, `Connection error: ${error.message}`, { originalError: error });
            this.uiController.updateConnectionStatus(`Conn Error: ${error.message}`, 'error');
        });

        this.socket.on('raidCreated', (data) => this.handleRaidCreated(data));
        this.socket.on('raidJoined', (data) => this.handleRaidJoined(data));
        this.socket.on('raidJoinFailed', (data) => this.handleRaidJoinFailed(data));
        this.socket.on('playerJoinedRaid', (data) => this.handlePlayerJoinedRaid(data));
        this.socket.on('playerLeftRaid', (data) => this.handlePlayerLeftRaid(data));
        this.socket.on('layoutUpdated', (data) => this.handleLayoutUpdated(data));
        this.socket.on('gameStateUpdate', (data) => this.handleGameStateUpdate(data));
        this.socket.on('raidActionResult', (data) => this.handleRaidActionResult(data));
        this.socket.on('raidActionFailed', (data) => this.handleRaidActionFailed(data));
        this.socket.on('raidEnded', (data) => this.handleRaidEnded(data));
        this.socket.on('raidError', (data) => this.handleRaidError(data));
    }

    log(message, type = 'info', isCritical = false) {
        const formattedMessage = `[RCCore] ${message}`;
        switch (type) {
            case 'success': console.log(`%c${formattedMessage}`, 'color: green; font-weight: bold;'); break;
            case 'warning': console.warn(formattedMessage); break;
            case 'error': console.error(formattedMessage); break;
            default: console.log(formattedMessage); break;
        }
        if (this.uiController) {
            this.uiController.logStatus(message, type);
            // Pass core state for debug updates
            if (this.uiController.config.showDebugInfo) {
                 this.uiController.updateDebugInfo({ username: this.username, layoutPreference: this._layoutPreference, currentRaidId: this.currentRaidId }, this.raidState);
            }
        }
        if (isCritical && type === 'error') {
            raidErrorHandler.logError(raidErrorHandler.codes.SYSTEM, message);
        }
    }

    createRaid(preferredLayout = 'versus', customRaidId = null) {
        console.log(`RaidClientCore: createRaid(Layout: ${preferredLayout}, CustomID: ${customRaidId}) called.`);
        if (!this.socket || !this.socket.connected) {
            this.log('Cannot create raid: Not connected.', 'error', true);
            this.uiController.showNotification('Not connected to server!', 'error');
            return;
        }
        this.setLayoutPreference(preferredLayout); // Ensure preference is up-to-date
        const raidIdToCreate = customRaidId || `${this.sessionManager.config.sessionPrefix}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase();

        this.log(`Requesting create raid: ${raidIdToCreate} (Layout: ${this._layoutPreference})`);
        this.socket.emit('createRaid', {
            raidId: raidIdToCreate,
            raidType: 'tcg-official',
            maxPlayers: 4,
            layout: this._layoutPreference,
            createdBy: this.username || 'UnknownPlayer'
        });
        this.uiController.setCreatingRaid(true, raidIdToCreate);
    }

    joinRaid(raidId, username) {
        console.log(`RaidClientCore: joinRaid(RaidID: ${raidId}, User: ${username}) called.`);
        if (!this.socket || !this.socket.connected) {
            this.log('Cannot join raid: Not connected.', 'error', true);
            this.uiController.showNotification('Not connected to server!', 'error');
            return;
        }
        if (!raidId || !username) {
            this.log('Raid ID and Username are required.', 'error', true);
            this.uiController.showNotification('Raid ID and Username required!', 'error');
            return;
        }
        this.username = username;
        this.log(`Attempting join: ${raidId} as ${this.username}`);
        this.uiController.logStatus(`Attempting to join raid: ${raidId} as ${this.username}`);

        const playerData = {
            username: this.username,
            // Example, should be dynamic
            activePokemon: { name: 'Pikachu', hp: 120, maxHP: 120, attacks: [{ name: 'Thunder Shock', damage: 60 }] },
        };
        this.socket.emit('joinRaid', { raidId: raidId, playerData: playerData });
    }

    leaveRaid() {
        console.log('RaidClientCore: leaveRaid() called.');
        if (!this.socket || !this.socket.connected || !this.currentRaidId) {
            this.log('Cannot leave: Not in a raid or not connected.', 'warning');
            return;
        }
        this.log(`Leaving raid: ${this.currentRaidId}`);
        this.socket.emit('leaveRaid', { raidId: this.currentRaidId });
    }

    sendRaidAction(actionType, payload) {
        console.log(`RaidClientCore: sendRaidAction(Type: ${actionType}, Payload: ${JSON.stringify(payload)}) called.`);
        if (!this.socket || !this.socket.connected || !this.currentRaidId) {
            this.log(`Cannot send '${actionType}': Not in a raid or not connected.`, 'error', true);
            this.uiController.showNotification('Not in a raid or disconnected!', 'error');
            return;
        }
        this.log(`Sending action: ${actionType}`);
        this.socket.emit('raidAction', {
            raidId: this.currentRaidId,
            action: { type: actionType, playerId: this.playerId, ...payload }
        });
    }

    requestLayoutSwitch(newLayout) {
        console.log(`RaidClientCore: requestLayoutSwitch(NewLayout: ${newLayout}) called.`);
        if (!this.socket || !this.socket.connected || !this.currentRaidId) {
            this.log('Cannot switch layout: Not in a raid or not connected.', 'warning');
            return;
        }
        if (this.raidState && this.raidState.layout === newLayout) {
            this.log(`Layout is already ${newLayout}.`, 'info');
            this.uiController.showNotification(`Layout is already ${newLayout}.`, 'info');
            return;
        }
        this.log(`Requesting layout switch to: ${newLayout}`);
        this.socket.emit('switchLayout', { raidId: this.currentRaidId, layout: newLayout });
    }

    handleRaidCreated(data) {
        console.log('RaidClientCore: handleRaidCreated received:', data);
        this.uiController.setCreatingRaid(false);
        if (data.success) {
            this.log(`Raid created: ${data.raidId}. You are: ${data.playerId}`, 'success');
            this.currentRaidId = data.raidId;
            this.playerId = data.playerId;
            this.raidState = data.raidState;
            // Ensure username is updated if server provides it or if it was set before creating
            this.username = this.raidState.players.find(p => p.id === this.playerId)?.username || this.username;


            if(this.uiController){
                this.uiController.updateSessionDisplay(this.raidState);
                this.uiController.showNotification(`Raid ${data.raidId} created! Share ID.`, 'success', 5000);
                this.uiController.setRaidIdInputValue(data.raidId);
                this.uiController.switchView('game');
                this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
            }
        } else {
            this.log(`Failed to create raid: ${data.error}`, 'error', true);
            if(this.uiController) this.uiController.showNotification(`Raid creation failed: ${data.error}`, 'error');
        }
    }

    handleRaidJoined(data) {
        console.log('RaidClientCore: handleRaidJoined received:', data);
        if (data.success) {
            this.log(`Joined raid: ${data.raidState.id}. Your ID: ${data.playerId}`, 'success');
            this.currentRaidId = data.raidState.id;
            this.playerId = data.playerId;
            this.raidState = data.raidState;
            this.username = this.raidState.players.find(p => p.id === this.playerId)?.username || this.username;

            if(this.uiController){
                this.uiController.updateSessionDisplay(this.raidState);
                this.uiController.showNotification(`Joined raid: ${this.currentRaidId}`, 'success');
                this.uiController.switchView('game');
                this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
            }
        } else {
            this.log(`Failed to join raid: ${data.error}`, 'error', true);
            if(this.uiController) this.uiController.showNotification(`Failed to join raid: ${data.error}`, 'error');
            this.currentRaidId = null;
        }
    }

    handleRaidJoinFailed(data) {
        console.log('RaidClientCore: handleRaidJoinFailed received:', data);
        this.log(`Raid join failed: ${data.message || 'Unknown'} (Code: ${data.code || 'N/A'})`, 'error', true);
        if(this.uiController) this.uiController.showNotification(`Join failed: ${data.message}`, 'error');
    }

    handlePlayerJoinedRaid(data) {
        console.log('RaidClientCore: handlePlayerJoinedRaid received:', data);
        this.log(`Player ${data.player.username} joined. Total: ${data.playerCount}`, 'info');
        if (this.currentRaidId === data.raidId && data.updatedRaidState) {
            this.raidState = data.updatedRaidState;
            if(this.uiController) {
                this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
                this.uiController.updateSessionDisplay(this.raidState);
                this.uiController.showNotification(`${data.player.username} joined!`, 'info');
            }
        }
    }

    handlePlayerLeftRaid(data) {
        console.log('RaidClientCore: handlePlayerLeftRaid received:', data);
        this.log(`Player ${data.playerUsername} left. Total: ${data.playerCount}`, 'info');
        if (this.currentRaidId === data.raidId) {
            if (data.playerId === this.playerId) {
                this.log('You have left the raid.', 'info');
                if(this.uiController){
                    this.uiController.showNotification('You have left the raid.', 'info');
                    this.uiController.switchView('lobby');
                    this.uiController.clearSessionDisplay();
                }
                this.currentRaidId = null;
                this.raidState = null;
            } else if (data.updatedRaidState) {
                this.raidState = data.updatedRaidState;
                 if(this.uiController){
                    this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
                    this.uiController.updateSessionDisplay(this.raidState);
                    this.uiController.showNotification(`${data.playerUsername} left.`, 'info');
                }
            }
        }
    }

    handleLayoutUpdated(data) {
        console.log('RaidClientCore: handleLayoutUpdated received:', data);
        this.log(`Layout updated to ${data.layout} for raid ${data.raidId}.`, 'info');
        if (this.currentRaidId === data.raidId && data.updatedRaidState) {
            this.raidState = data.updatedRaidState; // Server is source of truth for layout
             if(this.uiController){
                this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
                this.uiController.showNotification(`Layout changed to ${data.layout}.`, 'info');
            }
        }
    }

    handleGameStateUpdate(data) {
        console.log('RaidClientCore: handleGameStateUpdate received for phase:', data.raidState?.gamePhase);
        if (this.currentRaidId === data.raidId) {
            this.raidState = data.raidState;
            if(this.uiController){
                this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
                // No separate call to updateActionButtons, updateRaidFullDisplay handles it
            }
        }
    }

    handleRaidActionResult(data) {
        console.log('RaidClientCore: handleRaidActionResult received:', data);
        this.log(`Action '${data.actionType}' result: ${data.message}`, data.success ? 'success' : 'warning');
        if(this.uiController) this.uiController.showNotification(data.message, data.success ? 'info' : 'warning');
        if (this.currentRaidId === data.raidId && data.updatedRaidState) {
            this.raidState = data.updatedRaidState;
            if(this.uiController) this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
        }
    }

    handleRaidActionFailed(data) {
        console.log('RaidClientCore: handleRaidActionFailed received:', data);
        this.log(`Action failed: ${data.error} (Action: ${data.actionType})`, 'error', true);
        if(this.uiController) this.uiController.showNotification(`Action Failed: ${data.error}`, 'error');
    }

    handleRaidEnded(data) {
        console.log('RaidClientCore: handleRaidEnded received:', data);
        this.log(`Raid ${data.raidId} ended. Reason: ${data.reason}. Victory: ${data.victory}`, data.victory ? 'success' : 'info');
        if(this.uiController) this.uiController.showNotification(`Raid Ended: ${data.reason}`, data.victory ? 'success' : 'info', 7000);
        if (this.currentRaidId === data.raidId) {
            if (this.raidState) this.raidState.gamePhase = 'ended'; // Mark as ended
             if(this.uiController) this.uiController.updateRaidFullDisplay(this.raidState, this.playerId);
        }
    }

    handleRaidError(data) {
        console.log('RaidClientCore: handleRaidError received:', data);
        this.log(`Server raid error for ${data.raidId || 'N/A'}: ${data.message} (Code: ${data.code || 'N/A'})`, 'error', true);
        if(this.uiController) this.uiController.showNotification(`Error: ${data.message}`, 'error');
    }

    attemptAutoJoinFromUrl() {
        console.log('RaidClientCore: attemptAutoJoinFromUrl() called.');
        const urlParams = new URLSearchParams(window.location.search);
        const autoJoinFlag = urlParams.get('autoJoin');
        const raidIdFromUrl = urlParams.get('testRaid');
        const usernameFromUrl = urlParams.get('testPlayer') || `Player${Math.floor(Math.random() * 1000)}`;

        if (autoJoinFlag === 'true' && raidIdFromUrl) {
            this.log(`URL Auto-join: ${raidIdFromUrl} as ${usernameFromUrl}`);
            if(this.uiController){
                this.uiController.setRaidIdInputValue(raidIdFromUrl);
                this.uiController.setUsernameInputValue(usernameFromUrl);
            }
            setTimeout(() => {
                if (this.socket && this.socket.connected) {
                    this.joinRaid(raidIdFromUrl, usernameFromUrl);
                } else {
                    this.log('Auto-join deferred: Socket not connected yet.', 'warning');
                }
            }, 1500);
        }
    }

    // Layout preference for creating new raids
    setLayoutPreference(layout) {
        console.log(`RaidClientCore: setLayoutPreference(${layout}) called.`);
        this._layoutPreference = layout;
        if (this.uiController) {
            this.uiController.updateLauncherLayoutDisplay(layout);
        }
    }

    getLayoutPreference() {
        return this._layoutPreference;
    }

    // Gets the layout of the currently active raid
    getActiveRaidLayout() {
        return this.raidState ? this.raidState.layout : this._layoutPreference;
    }
    
    setUsername(username) {
        console.log(`RaidClientCore: setUsername(${username}) called.`);
        this.username = username;
    }
}
