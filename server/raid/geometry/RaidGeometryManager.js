// server/raid/geometry/RaidGeometryManager.js
// Implements the angular positioning system from your clock diagram

export class RaidGeometryManager {
    constructor() {
      this.layouts = {
        // Versus layout - players on one side (15°-75°), boss opposite (225°-315°)
        versus: {
          2: this.generateVersusAngles(2),
          3: this.generateVersusAngles(3), 
          4: this.generateVersusAngles(4)
        },
        // Circular layout - players distributed around center
        circular: {
          2: [45, 225],           // 2 players: diagonal opposite
          3: [30, 150, 270],      // 3 players: triangle
          4: [45, 135, 225, 315]  // 4 players: diamond pattern
        }
      };
  
      // Configuration based on your clock diagram
      this.config = {
        versus: {
          playerStartAngle: 15,   // From your diagram
          playerEndAngle: 75,     // From your diagram  
          bossAngle: 270,         // Top center (12 o'clock position)
          radius: 35              // Distance from center
        },
        circular: {
          radius: 30
        }
      };
    }
  
    generateVersusAngles(playerCount) {
      const { playerStartAngle, playerEndAngle } = this.config.versus;
      const angleSpread = playerEndAngle - playerStartAngle;
      
      if (playerCount === 1) return [45]; // Center position for single player
      
      const angles = [];
      for (let i = 0; i < playerCount; i++) {
        // Distribute evenly across the arc, matching your diagram
        const angle = playerStartAngle + (angleSpread * i / (playerCount - 1));
        angles.push(angle);
      }
      return angles;
    }
  
    calculatePlayerPositions(raid) {
      const playerCount = raid.players.size;
      const layout = raid.config.layout || 'versus';
      const angles = this.layouts[layout][playerCount];
      
      if (!angles) {
        console.warn(`No layout defined for ${playerCount} players in ${layout} mode`);
        return this.generateFallbackPositions(playerCount, layout);
      }
  
      const positions = [];
      const centerX = 50; // Percentage of container
      const centerY = 50;
      const radius = this.config[layout].radius;
  
      // Create positions for each player
      const playerIds = Array.from(raid.players.keys());
      angles.forEach((angle, index) => {
        const radians = (angle * Math.PI) / 180;
        
        // Calculate position using polar coordinates
        const x = centerX + radius * Math.cos(radians);
        const y = centerY + radius * Math.sin(radians);
        
        // Calculate overlap factor and fraction (from your clock diagram)
        const overlapFactor = this.calculateOverlapFactor(angle, angles);
        const fraction = this.calculateTimeFraction(angle);
        
        positions.push({
          playerId: playerIds[index],
          angle: angle,
          x: Math.max(5, Math.min(95, x)), // Keep within bounds
          y: Math.max(5, Math.min(95, y)),
          radius: radius,
          overlapFactor: overlapFactor,
          fraction: fraction, // From your clock diagram concept
          layout: layout,
          index: index
        });
      });
  
      raid.playerPositions = positions;
      return positions;
    }
  
    calculateOverlapFactor(currentAngle, allAngles) {
      // Calculate overlap based on proximity to other players
      // This affects visual scaling/positioning when players are close
      let minDistance = 360;
      
      allAngles.forEach(angle => {
        if (angle !== currentAngle) {
          let distance = Math.abs(angle - currentAngle);
          // Handle wrap-around (e.g., 350° and 10° are only 20° apart)
          distance = Math.min(distance, 360 - distance);
          minDistance = Math.min(minDistance, distance);
        }
      });
      
      // Convert to overlap factor (0 = no overlap, 1 = high overlap)
      // This can be used for visual effects or collision detection
      return Math.max(0, 1 - (minDistance / 60)); // 60° is comfortable spacing
    }
  
    calculateTimeFraction(angle) {
      // Based on your clock diagram - what "time" this angle represents
      // 0° = 3 o'clock = 0.25, 90° = 6 o'clock = 0.5, etc.
      const normalizedAngle = ((angle + 270) % 360) / 360; // Adjust so 0° = 12 o'clock
      return normalizedAngle;
    }
  
    getBossPosition(raid) {
      const layout = raid.config.layout || 'versus';
      
      if (layout === 'versus') {
        // Boss opposite players (based on your diagram)
        const { bossAngle, radius } = this.config.versus;
        const radians = (bossAngle * Math.PI) / 180;
        
        return {
          x: 50 + radius * Math.cos(radians),
          y: 50 + radius * Math.sin(radians),
          angle: bossAngle,
          layout: layout
        };
      } else {
        // Boss in center for circular layout
        return {
          x: 50,
          y: 50,
          angle: 0,
          layout: layout
        };
      }
    }
  
    recalculatePositions(raid) {
      const newPositions = this.calculatePlayerPositions(raid);
      const bossPosition = this.getBossPosition(raid);
      
      return {
        event: 'positionsUpdated',
        positions: newPositions,
        bossPosition: bossPosition,
        playerCount: raid.players.size,
        layout: raid.config.layout
      };
    }
  
    generateFallbackPositions(playerCount, layout) {
      // Fallback for unsupported player counts
      const positions = [];
      const angleStep = 360 / playerCount;
      
      for (let i = 0; i < playerCount; i++) {
        const angle = i * angleStep;
        const radians = (angle * Math.PI) / 180;
        const radius = 30;
        
        positions.push({
          playerId: `player-${i}`,
          angle: angle,
          x: 50 + radius * Math.cos(radians),
          y: 50 + radius * Math.sin(radians),
          radius: radius,
          overlapFactor: 0,
          fraction: angle / 360,
          layout: layout,
          index: i
        });
      }
      
      return positions;
    }
  
    // Advanced positioning for animations/transitions
    getPositionAtTime(raid, timePercent) {
      // If raid has time-based mechanics, calculate positions over time
      const basePositions = raid.playerPositions || [];
      
      return basePositions.map(pos => ({
        ...pos,
        // Add time-based animation or rotation
        animatedAngle: pos.angle + (timePercent * 10), // Slight rotation over time
        animatedFraction: (pos.fraction + timePercent * 0.1) % 1,
        scale: 1 + (Math.sin(timePercent * Math.PI * 2) * 0.05) // Subtle breathing effect
      }));
    }
  
    // Convert positions to CSS transforms for client rendering
    positionToCSS(position, containerWidth = 100, containerHeight = 100) {
      const scaleX = containerWidth / 100;
      const scaleY = containerHeight / 100;
      
      return {
        position: 'absolute',
        left: `${position.x * scaleX}%`,
        top: `${position.y * scaleY}%`,
        transform: `translate(-50%, -50%) rotate(${position.angle}deg)`,
        '--overlap-factor': position.overlapFactor,
        '--time-fraction': position.fraction,
        '--player-angle': `${position.angle}deg`,
        zIndex: Math.floor(100 - position.overlapFactor * 10)
      };
    }
  
    // Calculate viewing angles for perspective effects
    calculateViewingAngle(viewerPosition, targetPosition) {
      const dx = targetPosition.x - viewerPosition.x;
      const dy = targetPosition.y - viewerPosition.y;
      
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      
      return angle;
    }
  
    // For future 3D implementation
    to3DPosition(position, height = 0) {
      const radians = (position.angle * Math.PI) / 180;
      
      return {
        x: position.radius * Math.cos(radians),
        y: height,
        z: position.radius * Math.sin(radians),
        angle: position.angle,
        fraction: position.fraction
      };
    }
  }
  
  // server/raid/geometry/LayoutPresets.js
  // Predefined layouts for different scenarios
  
  export class LayoutPresets {
    static getPreset(name) {
      const presets = {
        'classic-versus': {
          layout: 'versus',
          playerAngles: {
            2: [30, 60],
            3: [15, 45, 75], 
            4: [15, 35, 55, 75]
          },
          bossAngle: 270,
          description: 'Players face boss across table'
        },
  
        'circular-coop': {
          layout: 'circular',
          playerAngles: {
            2: [0, 180],
            3: [0, 120, 240],
            4: [45, 135, 225, 315]
          },
          bossAngle: null, // Center
          description: 'Players surround central boss'
        },
  
        'dynamic-scaling': {
          layout: 'versus',
          playerAngles: {
            2: [37.5, 52.5], // Closer together for 2 players
            3: [25, 45, 65],
            4: [15, 35, 55, 75] // Full spread for 4 players
          },
          bossAngle: 270,
          description: 'Adjusts spacing based on player count'
        }
      };
  
      return presets[name] || presets['classic-versus'];
    }
  
    static getAllPresets() {
      return Object.keys(this.getPreset()).map(name => ({
        name,
        ...this.getPreset(name)
      }));
    }
  }