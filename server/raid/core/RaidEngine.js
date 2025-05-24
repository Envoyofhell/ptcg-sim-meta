// server/raid/core/RaidEngine.js
// Main serverside raid battle engine - completely modular and expandable
// At the very top of server/raid/core/RaidEngine.js

import { RaidInstance } from './RaidInstance.js'; // It's in the same 'core' directory
import { RaidGeometryManager } from '../geometry/RaidGeometryManager.js'; // Up one level, then into 'geometry'
import { TCGOfficialRaid } from '../types/TCGOfficialRaid.js'; // Up one level, then into 'types'
import { RaidEventBus } from './RaidEventBus.js';
import { TCGCommunityRaid } from '../types/TCGCommunityRaid.js';
// We still need to import RaidEventBus and TCGCommunityRaid

export class RaidEngine {
    constructor() {
        this.activeRaids = new Map();
        this.raidTypes = new Map();
        this.geometryManager = new RaidGeometryManager();

        // This will cause an error until RaidEventBus is correctly imported
        this.eventBus = new RaidEventBus();

        // Register built-in raid types
        this.registerRaidType('tcg-official', new TCGOfficialRaid());

        // This will cause an error until TCGCommunityRaid is correctly imported
        this.registerRaidType('tcg-community', new TCGCommunityRaid());
        // Future: this.registerRaidType('pokemon-go', new PokeGORaid());
    }

    registerRaidType(typeId, raidTypeHandler) {
        this.raidTypes.set(typeId, raidTypeHandler);
        console.log(`[RaidEngine] Registered raid type: ${typeId}`);
    }

    createRaid(raidId, config) {
        console.log(`[RaidEngine] Attempting to create raid '${raidId}' of type '${config.type}'`);
        const raidTypeHandler = this.raidTypes.get(config.type);
        if (!raidTypeHandler) {
            console.error(`[RaidEngine] Unknown raid type: ${config.type}`);
            throw new Error(`Unknown raid type: ${config.type}`);
        }

        const raid = new RaidInstance(raidId, raidTypeHandler, config, this.geometryManager);
        this.activeRaids.set(raidId, raid);
        console.log(`[RaidEngine] Raid '${raidId}' created. Calculating initial positions.`);

        // Calculate initial player positions using angular geometry
        // This is now typically handled within RaidInstance or called after player joins
        // If you want to calculate initial abstract positions or boss position here, you can.
        // For actual player positions, it's better to do it as players join or when the raid starts.
        // this.geometryManager.calculatePlayerPositions(raid); // Might be redundant if RaidInstance does it

        this.eventBus.emit('raidCreated', { raidId: raid.id, config: raid.config, state: raid.getState() });
        return raid;
    }

    joinRaid(raidId, playerId, playerData) {
        const raid = this.activeRaids.get(raidId);
        if (!raid) {
            console.error(`[RaidEngine] Attempt to join non-existent raid: ${raidId}`);
            throw new Error(`Raid ${raidId} not found`);
        }

        console.log(`[RaidEngine] Player '${playerId}' attempting to join raid '${raidId}'`);
        const success = raid.addPlayer(playerId, playerData);

        if (success) {
            console.log(`[RaidEngine] Player '${playerId}' joined raid '${raidId}'. Recalculating positions.`);
            // RaidInstance's addPlayer method or a dedicated method should now handle position recalculation.
            // The geometryManager.recalculatePositions(raid) was called in RaidInstance.addPlayer if needed.
            // Or, if it's a direct responsibility of the engine after a player joins:
            // this.geometryManager.recalculatePositions(raid); // Ensure this updates raid.playerPositions

            this.eventBus.emit('playerJoined', {
                raidId,
                playerId,
                playerData, // Send the joined player's data
                raidState: raid.getState() // Send the new overall state
            });
        } else {
            console.warn(`[RaidEngine] Player '${playerId}' failed to join raid '${raidId}'.`);
        }
        return raid.getState(); // Return the latest state regardless of join success for the caller
    }

    leaveRaid(raidId, playerId) {
        const raid = this.activeRaids.get(raidId);
        if (!raid) {
            console.warn(`[RaidEngine] Attempt to leave non-existent raid: ${raidId}`);
            return false;
        }
        const removed = raid.removePlayer(playerId);
        if (removed) {
            console.log(`[RaidEngine] Player '${playerId}' left raid '${raidId}'.`);
            this.eventBus.emit('playerLeft', {
                raidId,
                playerId,
                raidState: raid.getState()
            });
            if (raid.players.size === 0 && raid.config.autoEndOnEmpty) { // Assuming a config for this
                this.endRaid(raidId, 'Raid empty');
            }
        }
        return removed;
    }

    processAction(raidId, playerId, action) {
        const raid = this.activeRaids.get(raidId);
        if (!raid) {
            console.error(`[RaidEngine] Action for non-existent raid: ${raidId}`);
            return { success: false, error: `Raid ${raidId} not found` };
        }

        console.log(`[RaidEngine] Processing action for player '${playerId}' in raid '${raidId}':`, action);
        const result = raid.processPlayerAction(playerId, action);

        if (result.success) {
            this.eventBus.emit('actionProcessed', {
                raidId,
                playerId,
                action,
                result,
                newState: raid.getState()
            });

            // Check for game end conditions after any successful action
            const gameEndStatus = raid.checkWinConditions();
            if (gameEndStatus.victory || gameEndStatus.defeat) {
                this.endRaid(raidId, gameEndStatus.reason);
                this.eventBus.emit('raidEnded', { raidId, status: raid.state, reason: gameEndStatus.reason, finalState: raid.getState() });
            }

        } else {
            console.warn(`[RaidEngine] Action failed for player '${playerId}' in raid '${raidId}': ${result.error}`);
        }
        return result; // Return the direct result of the action processing
    }

    getRaidState(raidId) {
        const raid = this.activeRaids.get(raidId);
        return raid ? raid.getState() : null;
    }

    endRaid(raidId, reason) {
        const raid = this.activeRaids.get(raidId);
        if (raid) {
            console.log(`[RaidEngine] Ending raid '${raidId}': ${reason}`);
            raid.endRaid(reason); // Assuming RaidInstance has an endRaid method to set state
            // Optionally, remove from activeRaids after a delay or based on policy
            // For now, we keep it so its final state can be queried, but mark as inactive.
            // this.activeRaids.delete(raidId); // Or move to an inactive/completed raids map
        }
    }

    // This method would be called by the EnhancedRaidSocketHandler when a client disconnects
    handleClientDisconnect(socketId) {
        // Find if this socket was a player in any active raid
        this.activeRaids.forEach(raid => {
            if (raid.players.has(socketId)) {
                console.log(`[RaidEngine] Player ${socketId} disconnected from raid ${raid.id}. Removing.`);
                this.leaveRaid(raid.id, socketId);
            }
        });
    }
}
  

  

  

  
