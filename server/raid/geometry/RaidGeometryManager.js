  // server/raid/geometry/RaidGeometryManager.js
  // Handles all angular positioning and scaling logic
  
  export class RaidGeometryManager {
    constructor() {
      this.layouts = {
        // Circular layout - players around boss
        circular: {
          2: [0, 180],           // 2 players: opposite sides
          3: [0, 120, 240],      // 3 players: triangle
          4: [0, 90, 180, 270]   // 4 players: square
        },
        // Linear layout - players vs boss (using your angular concept)
        versus: {
          2: this.generateVersusAngles(2),
          3: this.generateVersusAngles(3), 
          4: this.generateVersusAngles(4)
        }
      };
    }
  
    generateVersusAngles(playerCount) {
      // Based on your image: distribute players across one side (0° to 90°)
      const startAngle = 15; // Start at 15° like your image
      const endAngle = 75;   // End at 75° like your image
      const angleSpread = endAngle - startAngle;
      
      if (playerCount === 1) return [45]; // Center position
      
      const angles = [];
      for (let i = 0; i < playerCount; i++) {
        const angle = startAngle + (angleSpread * i / (playerCount - 1));
        angles.push(angle);
      }
      return angles;
    }
  
    calculatePlayerPositions(raid) {
      const playerCount = raid.players.size;
      const layout = raid.config.layout || 'circular';
      const angles = this.layouts[layout][playerCount];
      
      if (!angles) {
        console.warn(`No layout defined for ${playerCount} players in ${layout} mode`);
        return;
      }
  
      const positions = [];
      const centerX = 50; // Percentage
      const centerY = 50;
      const radius = this.calculateRadius(playerCount, layout);
  
      angles.forEach((angle, index) => {
        const radians = (angle * Math.PI) / 180;
        const x = centerX + radius * Math.cos(radians);
        const y = centerY + radius * Math.sin(radians);
        
        positions.push({
          playerId: Array.from(raid.players.keys())[index],
          angle,
          x: Math.max(5, Math.min(95, x)), // Keep within bounds
          y: Math.max(5, Math.min(95, y)),
          overlapFactor: this.calculateOverlap(angle, angles) // From your image concept
        });
      });
  
      raid.playerPositions = positions;
      return positions;
    }
  
    calculateRadius(playerCount, layout) {
      // Scale radius based on player count to prevent overlap
      const baseRadius = layout === 'versus' ? 35 : 30;
      const scaleFactor = Math.max(1, playerCount / 4);
      return baseRadius * scaleFactor;
    }
  
    calculateOverlap(currentAngle, allAngles) {
      // Calculate overlap factor based on proximity to other players
      // This could be used for visual effects or collision detection
      let minDistance = 360;
      
      allAngles.forEach(angle => {
        if (angle !== currentAngle) {
          const distance = Math.abs(angle - currentAngle);
          minDistance = Math.min(minDistance, distance);
        }
      });
      
      // Convert to overlap factor (0 = no overlap, 1 = high overlap)
      return Math.max(0, 1 - (minDistance / 90));
    }
  
    recalculatePositions(raid) {
      this.calculatePlayerPositions(raid);
      
      // Emit position update event
      return {
        event: 'positionsUpdated',
        positions: raid.playerPositions,
        bossPosition: this.getBossPosition(raid)
      };
    }
  
    getBossPosition(raid) {
      const layout = raid.config.layout || 'circular';
      
      if (layout === 'versus') {
        // Boss on opposite side from players (around 225-315° range)
        return { x: 50, y: 15, angle: 270 }; // Top center for versus mode
      } else {
        // Boss in center for circular
        return { x: 50, y: 50, angle: 0 };
      }
    }
  
    // Support for your angular time/fraction concept
    getPositionAtTime(raid, timePercent) {
      // If raid has time-based mechanics, calculate positions over time
      const basePositions = raid.playerPositions;
      
      return basePositions.map(pos => ({
        ...pos,
        // Add time-based animation or rotation
        animatedAngle: pos.angle + (timePercent * 15), // Slight rotation over time
        fraction: this.calculateTimeFraction(pos.angle, timePercent)
      }));
    }
  
    calculateTimeFraction(angle, timePercent) {
      // Based on your analog clock concept - calculate what "fraction" of the battle this represents
      const normalizedAngle = (angle % 360) / 360;
      return (normalizedAngle + timePercent) % 1;
    }
  }