// ===================================================================
// File: client/src/raid/components/RaidPlayerCard.js
// Path: /client/src/raid/components/RaidPlayerCard.js
// Purpose: Player visual component for raid interface
// Version: 1.0.0
//
// Dependencies:
//   - None (pure DOM manipulation)
//
// Used By:
//   - ../RaidClientCore.js
//   - ./RaidGameUI.js
//
// Changelog:
//   v1.0.0 - Initial implementation with health bars and animations
// ===================================================================

export class RaidPlayerCard {
  constructor(playerId, playerData, container) {
    this.playerId = playerId;
    this.playerData = { ...playerData };
    this.container = container;
    this.element = null;
    this.animations = new Map();

    this.state = {
      isCurrentTurn: false,
      isVisible: true,
      lastHP: playerData.pokemon?.active?.currentHP || 100,
      statusEffects: [],
    };

    this.createPlayerCard();
    console.log(`[RaidPlayerCard] Created for player ${playerId}`);
  }

  // ================ CARD CREATION ================

  createPlayerCard() {
    this.element = document.createElement('div');
    this.element.className = 'raid-player';
    this.element.id = `player-${this.playerId}`;
    this.element.setAttribute('data-player-id', this.playerId);

    // Apply player color based on index or data
    const colorIndex = this.getPlayerColorIndex();
    this.element.style.background = this.getPlayerGradient(colorIndex);

    this.element.innerHTML = this.generateCardHTML();
    this.container.appendChild(this.element);

    // Add event listeners
    this.attachEventListeners();

    // Initial position and animation
    this.updatePosition();
    this.animateEntry();
  }

  generateCardHTML() {
    const pokemon = this.playerData.pokemon?.active || {};
    const username = this.playerData.username || 'Anonymous';
    const currentHP = pokemon.currentHP || 100;
    const maxHP = pokemon.maxHP || 100;
    const hpPercentage = (currentHP / maxHP) * 100;
    const pokemonName = pokemon.name || 'Unknown';

    return `
      <div class="player-header">
        <div class="player-name" title="${username}">${this.truncateText(username, 12)}</div>
        <div class="player-turn-indicator" style="display: none;">
          <div class="turn-pulse"></div>
        </div>
      </div>
      
      <div class="player-pokemon">
        <div class="pokemon-name">${pokemonName}</div>
        <div class="pokemon-sprite">
          ${this.getPokemonIcon(pokemonName)}
        </div>
      </div>

      <div class="player-hp-container">
        <div class="hp-label">
          <span class="hp-current">${currentHP}</span>/<span class="hp-max">${maxHP}</span>
        </div>
        <div class="player-hp-bar">
          <div class="player-hp-fill" style="width: ${hpPercentage}%"></div>
          <div class="hp-damage-overlay"></div>
        </div>
      </div>

      <div class="player-status">
        <div class="status-effects"></div>
        <div class="player-actions">
          <div class="action-indicator"></div>
        </div>
      </div>

      <div class="player-angle-display">
        <span class="angle-value">0°</span>
      </div>

      <div class="player-ko-overlay" style="display: none;">
        <div class="ko-text">KO</div>
      </div>
    `;
  }

  // ================ UPDATE METHODS ================

  updatePlayerData(newData) {
    const oldData = { ...this.playerData };
    this.playerData = { ...newData };

    // Check for significant changes
    this.handleDataChanges(oldData, newData);
    this.updateVisualElements();
  }

  handleDataChanges(oldData, newData) {
    const oldPokemon = oldData.pokemon?.active || {};
    const newPokemon = newData.pokemon?.active || {};

    // HP changes
    if (oldPokemon.currentHP !== newPokemon.currentHP) {
      this.animateHPChange(
        oldPokemon.currentHP,
        newPokemon.currentHP,
        newPokemon.maxHP
      );
    }

    // Status changes
    if (oldData.status !== newData.status) {
      this.handleStatusChange(oldData.status, newData.status);
    }

    // Pokemon changes (retreat)
    if (oldPokemon.name !== newPokemon.name) {
      this.animatePokemonSwitch(oldPokemon, newPokemon);
    }
  }

  updateVisualElements() {
    if (!this.element) return;

    const pokemon = this.playerData.pokemon?.active || {};
    const currentHP = pokemon.currentHP || 0;
    const maxHP = pokemon.maxHP || 100;
    const hpPercentage = Math.max(0, (currentHP / maxHP) * 100);

    // Update HP display
    const hpCurrent = this.element.querySelector('.hp-current');
    const hpMax = this.element.querySelector('.hp-max');
    const hpFill = this.element.querySelector('.player-hp-fill');

    if (hpCurrent) hpCurrent.textContent = currentHP;
    if (hpMax) hpMax.textContent = maxHP;
    if (hpFill) {
      hpFill.style.width = `${hpPercentage}%`;
      hpFill.className = `player-hp-fill ${this.getHPBarClass(hpPercentage)}`;
    }

    // Update Pokemon name
    const pokemonNameEl = this.element.querySelector('.pokemon-name');
    if (pokemonNameEl) pokemonNameEl.textContent = pokemon.name || 'Unknown';

    // Update sprite
    this.updatePokemonSprite(pokemon.name);

    // Update status effects
    this.updateStatusEffects();

    // Update KO state
    this.updateKOState();
  }

  updatePosition(angle = null, radius = 35) {
    if (!this.element || !this.playerData.position) return;

    const position = this.playerData.position;
    const x = position.x || 50;
    const y = position.y || 50;
    const displayAngle = angle !== null ? angle : position.angle || 0;

    this.element.style.left = `${x}%`;
    this.element.style.top = `${y}%`;
    this.element.style.transform = 'translate(-50%, -50%)';

    // Update angle display
    const angleDisplay = this.element.querySelector('.angle-value');
    if (angleDisplay) {
      angleDisplay.textContent = `${Math.round(displayAngle)}°`;
    }
  }

  // ================ TURN MANAGEMENT ================

  setCurrentTurn(isCurrentTurn) {
    if (this.state.isCurrentTurn === isCurrentTurn) return;

    this.state.isCurrentTurn = isCurrentTurn;

    if (isCurrentTurn) {
      this.element.classList.add('current-player');
      this.showTurnIndicator();
      this.animateTurnStart();
    } else {
      this.element.classList.remove('current-player');
      this.hideTurnIndicator();
    }
  }

  showTurnIndicator() {
    const indicator = this.element.querySelector('.player-turn-indicator');
    if (indicator) {
      indicator.style.display = 'block';
      indicator.classList.add('turn-active');
    }
  }

  hideTurnIndicator() {
    const indicator = this.element.querySelector('.player-turn-indicator');
    if (indicator) {
      indicator.style.display = 'none';
      indicator.classList.remove('turn-active');
    }
  }

  // ================ ANIMATIONS ================

  animateEntry() {
    if (!this.element) return;

    this.element.style.opacity = '0';
    this.element.style.transform = 'translate(-50%, -50%) scale(0.5)';

    // Trigger reflow
    this.element.offsetHeight;

    this.element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    this.element.style.opacity = '1';
    this.element.style.transform = 'translate(-50%, -50%) scale(1)';
  }

  animateHPChange(oldHP, newHP, maxHP) {
    const hpFill = this.element?.querySelector('.player-hp-fill');
    const hpCurrent = this.element?.querySelector('.hp-current');
    const damageOverlay = this.element?.querySelector('.hp-damage-overlay');

    if (!hpFill || !hpCurrent) return;

    const oldPercentage = (oldHP / maxHP) * 100;
    const newPercentage = (newHP / maxHP) * 100;
    const isDamage = newHP < oldHP;

    if (isDamage) {
      // Show damage overlay
      if (damageOverlay) {
        damageOverlay.style.width = `${oldPercentage}%`;
        damageOverlay.style.background = 'rgba(231, 76, 60, 0.7)';
        damageOverlay.style.display = 'block';
      }

      // Animate damage numbers
      this.showDamageNumber(oldHP - newHP);

      // Shake animation
      this.animateShake();
    } else {
      // Healing animation
      this.animateHeal(oldHP, newHP);
    }

    // Animate HP bar
    setTimeout(
      () => {
        hpFill.style.transition = 'width 0.8s ease';
        hpFill.style.width = `${newPercentage}%`;
        hpFill.className = `player-hp-fill ${this.getHPBarClass(newPercentage)}`;

        // Animate HP number
        this.animateHPNumber(oldHP, newHP);

        // Hide damage overlay
        if (damageOverlay) {
          setTimeout(() => {
            damageOverlay.style.display = 'none';
          }, 800);
        }
      },
      isDamage ? 500 : 0
    );

    this.state.lastHP = newHP;
  }

  animateHPNumber(startHP, endHP) {
    const hpCurrent = this.element?.querySelector('.hp-current');
    if (!hpCurrent) return;

    const duration = 800;
    const startTime = performance.now();
    const diff = endHP - startHP;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const currentValue = Math.round(
        startHP + diff * this.easeOutCubic(progress)
      );
      hpCurrent.textContent = currentValue;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  showDamageNumber(damage) {
    const damageEl = document.createElement('div');
    damageEl.className = 'damage-number';
    damageEl.textContent = `-${damage}`;
    damageEl.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      color: #e74c3c;
      font-weight: bold;
      font-size: 16px;
      z-index: 10;
      pointer-events: none;
      animation: damageFloat 2s ease-out forwards;
    `;

    this.element.appendChild(damageEl);

    setTimeout(() => {
      if (damageEl.parentNode) {
        damageEl.parentNode.removeChild(damageEl);
      }
    }, 2000);
  }

  animateShake() {
    if (!this.element) return;

    this.element.style.animation = 'playerShake 0.5s ease-in-out';

    setTimeout(() => {
      this.element.style.animation = '';
    }, 500);
  }

  animateHeal(oldHP, newHP) {
    const healAmount = newHP - oldHP;

    // Show heal number
    const healEl = document.createElement('div');
    healEl.className = 'heal-number';
    healEl.textContent = `+${healAmount}`;
    healEl.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      color: #27ae60;
      font-weight: bold;
      font-size: 16px;
      z-index: 10;
      pointer-events: none;
      animation: healFloat 2s ease-out forwards;
    `;

    this.element.appendChild(healEl);

    // Healing glow
    this.element.style.boxShadow = '0 0 20px rgba(46, 204, 113, 0.8)';

    setTimeout(() => {
      this.element.style.boxShadow = '';
      if (healEl.parentNode) {
        healEl.parentNode.removeChild(healEl);
      }
    }, 2000);
  }

  animateTurnStart() {
    if (!this.element) return;

    this.element.style.animation = 'turnHighlight 1s ease-in-out';

    setTimeout(() => {
      this.element.style.animation = '';
    }, 1000);
  }

  animatePokemonSwitch(oldPokemon, newPokemon) {
    const sprite = this.element?.querySelector('.pokemon-sprite');
    if (!sprite) return;

    // Fade out old pokemon
    sprite.style.transition = 'opacity 0.3s ease';
    sprite.style.opacity = '0';

    setTimeout(() => {
      // Update sprite and fade in
      sprite.innerHTML = this.getPokemonIcon(newPokemon.name);
      sprite.style.opacity = '1';
    }, 300);
  }

  // ================ STATUS EFFECTS ================

  updateStatusEffects() {
    const statusContainer = this.element?.querySelector('.status-effects');
    if (!statusContainer) return;

    const effects = this.playerData.pokemon?.active?.statusEffects || [];

    statusContainer.innerHTML = '';

    effects.forEach((effect) => {
      const effectEl = document.createElement('div');
      effectEl.className = `status-effect status-${effect.name}`;
      effectEl.title = `${effect.name} (${effect.duration} turns)`;
      effectEl.textContent = this.getStatusIcon(effect.name);
      statusContainer.appendChild(effectEl);
    });
  }

  getStatusIcon(statusName) {
    const icons = {
      paralyzed: '⚡',
      poisoned: '☠️',
      confused: '😵',
      asleep: '😴',
      burned: '🔥',
      frozen: '❄️',
    };
    return icons[statusName] || '?';
  }

  // ================ KO STATE ================

  updateKOState() {
    const isKO =
      this.playerData.status === 'ko' ||
      (this.playerData.pokemon?.active?.currentHP || 0) <= 0;

    if (isKO) {
      this.element.classList.add('ko');
      this.showKOOverlay();
    } else {
      this.element.classList.remove('ko');
      this.hideKOOverlay();
    }
  }

  showKOOverlay() {
    const overlay = this.element?.querySelector('.player-ko-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.animation = 'koAppear 0.5s ease-out';
    }
  }

  hideKOOverlay() {
    const overlay = this.element?.querySelector('.player-ko-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // ================ UTILITY METHODS ================

  getPlayerColorIndex() {
    // Extract index from player ID or use hash
    const match = this.playerId.match(/\d+/);
    if (match) {
      return parseInt(match[0]) % 6;
    }

    // Simple hash for consistent colors
    let hash = 0;
    for (let i = 0; i < this.playerId.length; i++) {
      hash = ((hash << 5) - hash + this.playerId.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 6;
  }

  getPlayerGradient(index) {
    const gradients = [
      'linear-gradient(45deg, #3498db, #2980b9)', // Blue
      'linear-gradient(45deg, #e74c3c, #c0392b)', // Red
      'linear-gradient(45deg, #2ecc71, #27ae60)', // Green
      'linear-gradient(45deg, #f39c12, #e67e22)', // Orange
      'linear-gradient(45deg, #9b59b6, #8e44ad)', // Purple
      'linear-gradient(45deg, #1abc9c, #16a085)', // Teal
    ];
    return gradients[index] || gradients[0];
  }

  getHPBarClass(percentage) {
    if (percentage > 60) return 'hp-healthy';
    if (percentage > 30) return 'hp-warning';
    return 'hp-critical';
  }

  getPokemonIcon(pokemonName) {
    // Simple pokemon icons - in a real app, these would be actual sprites
    const icons = {
      Pikachu: '⚡',
      Charizard: '🔥',
      Squirtle: '💧',
      Bulbasaur: '🌱',
      Jigglypuff: '🎵',
      Psyduck: '🦆',
      Mewtwo: '🧠',
      Snorlax: '😴',
    };

    return `<span class="pokemon-icon">${icons[pokemonName] || '❓'}</span>`;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '…';
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // ================ EVENT HANDLING ================

  attachEventListeners() {
    if (!this.element) return;

    // Click to select/view player
    this.element.addEventListener('click', (e) => {
      e.preventDefault();
      this.handlePlayerClick();
    });

    // Hover effects
    this.element.addEventListener('mouseenter', () => {
      this.handlePlayerHover(true);
    });

    this.element.addEventListener('mouseleave', () => {
      this.handlePlayerHover(false);
    });

    // Context menu for actions
    this.element.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.handlePlayerContextMenu(e);
    });
  }

  handlePlayerClick() {
    const event = new CustomEvent('raidPlayerClick', {
      detail: {
        playerId: this.playerId,
        playerData: this.playerData,
        element: this.element,
      },
    });
    document.dispatchEvent(event);
  }

  handlePlayerHover(isHovering) {
    if (isHovering) {
      this.element.style.transform = 'translate(-50%, -50%) scale(1.05)';
      this.element.style.zIndex = '100';
    } else {
      this.element.style.transform = 'translate(-50%, -50%) scale(1)';
      this.element.style.zIndex = '';
    }
  }

  handlePlayerContextMenu(event) {
    const contextEvent = new CustomEvent('raidPlayerContextMenu', {
      detail: {
        playerId: this.playerId,
        playerData: this.playerData,
        mouseX: event.clientX,
        mouseY: event.clientY,
      },
    });
    document.dispatchEvent(contextEvent);
  }

  // ================ CLEANUP ================

  destroy() {
    // Clear animations
    this.animations.forEach((animation) => {
      if (animation.cancel) animation.cancel();
    });
    this.animations.clear();

    // Remove element
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }

    console.log(`[RaidPlayerCard] Destroyed for player ${this.playerId}`);
  }

  // ================ DEBUG METHODS ================

  setHP(newHP) {
    const oldHP = this.playerData.pokemon?.active?.currentHP || 0;
    if (this.playerData.pokemon?.active) {
      this.playerData.pokemon.active.currentHP = newHP;
    }
    this.animateHPChange(
      oldHP,
      newHP,
      this.playerData.pokemon?.active?.maxHP || 100
    );
  }

  simulateAction(actionType) {
    const actionEl = this.element?.querySelector('.action-indicator');
    if (!actionEl) return;

    actionEl.textContent = actionType;
    actionEl.style.opacity = '1';

    setTimeout(() => {
      actionEl.style.opacity = '0';
    }, 2000);
  }
}
