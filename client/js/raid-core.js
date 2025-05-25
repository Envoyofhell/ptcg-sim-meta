/* ===================================================================
 * File: client/js/raid-core.js
 * Purpose: Pokemon Raid Battle System - Authentic Pokemon Playmat Edition
 * Version: 4.0.0
 * Author: PTCG Sim Meta Team
 *
 * Description:
 *   Complete authentic Pokemon raid battle system with playmat design,
 *   Pokemon team selection, enhanced player cards, and 3D battlefield.
 *   Based on official Pokemon TCG raid battle mechanics.
 *
 * Features:
 *   - Authentic Pokemon TCG playmat design
 *   - Pokemon team selection system
 *   - Enhanced player cards with detailed Pokemon info
 *   - 3D angled battlefield perspective
 *   - Real-time turn management
 *   - Advanced visual effects and animations
 * ===================================================================*/

// ================ GLOBAL POKEMON RAID SYSTEM ================
window.PokemonRaidSystem = {
  // Core state management
  state: {
    isConnected: false,
    currentRaid: null,
    playerId: null,
    username: 'Trainer',
    selectedPokemon: {
      active: null,
      bench: null,
    },
    viewMode: 'battlefield',
    debugMode: false,
    isInitialized: false,
    gamePhase: 'lobby',
    spectators: [],
  },

  // Socket management
  socket: null,

  // UI components
  ui: {
    launcher: null,
    container: null,
    battlefield: null,
    playerPanel: null,
    turnIndicator: null,
    gameControls: null,
    playerCards: new Map(),
    spectatorPanel: null,
    pokemonGrid: null,
  },

  // Configuration
  config: {
    serverUrl: window.location.origin,
    autoConnect: true,
    debugEnabled: true,
    logMaxEntries: 100,
    reconnectAttempts: 3,
    reconnectInterval: 5000,

    // 3D rendering options
    perspective: '1200px',
    battlefieldRotationX: '25deg',
    battlefieldRotationY: '-10deg',
  },

  // Event system
  events: new EventTarget(),

  // Logging system
  log: {
    entries: [],
    levels: {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
      SUCCESS: 'success',
    },
  },

  // Enhanced notification system
  notifications: {
    container: null,
    queue: [],
    maxVisible: 5,
    defaultDuration: 4000,

    show: function (title, message, type = 'info', duration = null) {
      if (!this.container) {
        this.container = document.getElementById('gameNotifications');
      }

      const notification = this.create(
        title,
        message,
        type,
        duration || this.defaultDuration
      );
      this.container.appendChild(notification);

      // Auto-remove after duration
      if (duration !== 0) {
        setTimeout(() => {
          this.remove(notification);
        }, duration || this.defaultDuration);
      }

      // Limit visible notifications
      this.limitVisible();
      return notification;
    },

    create: function (title, message, type, duration) {
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;

      const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        pokemon: '⚡',
      };

      notification.innerHTML = `
        <div class="notification-content">
          <div class="notification-icon">${icons[type] || icons.info}</div>
          <div class="notification-text">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
          </div>
          <button class="notification-close">×</button>
        </div>
      `;

      // Close button functionality
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', () => {
        this.remove(notification);
      });

      return notification;
    },

    remove: function (notification) {
      if (notification && notification.parentNode) {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    },

    limitVisible: function () {
      if (!this.container) return;

      const notifications = this.container.querySelectorAll('.notification');
      if (notifications.length > this.maxVisible) {
        for (let i = 0; i < notifications.length - this.maxVisible; i++) {
          this.remove(notifications[i]);
        }
      }
    },

    clear: function () {
      if (this.container) {
        this.container.innerHTML = '';
      }
    },
  },

  // Modal management system
  modals: {
    pokemonDetail: null,
    attackSelection: null,

    init: function () {
      this.pokemonDetail = document.getElementById('pokemonDetailModal');
      this.attackSelection = document.getElementById('attackSelectionModal');

      // Set up close handlers
      this.setupCloseHandlers();
    },

    setupCloseHandlers: function () {
      // Pokemon detail modal
      if (this.pokemonDetail) {
        const closeBtn = this.pokemonDetail.querySelector('#closePokemonModal');
        const backdrop = this.pokemonDetail.querySelector('.modal-backdrop');

        if (closeBtn)
          closeBtn.addEventListener('click', () => this.close('pokemon'));
        if (backdrop)
          backdrop.addEventListener('click', () => this.close('pokemon'));
      }

      // Attack selection modal
      if (this.attackSelection) {
        const closeBtn =
          this.attackSelection.querySelector('#closeAttackModal');
        const backdrop = this.attackSelection.querySelector('.modal-backdrop');
        const cancelBtn = this.attackSelection.querySelector('#cancelAttack');

        if (closeBtn)
          closeBtn.addEventListener('click', () => this.close('attack'));
        if (backdrop)
          backdrop.addEventListener('click', () => this.close('attack'));
        if (cancelBtn)
          cancelBtn.addEventListener('click', () => this.close('attack'));
      }

      // ESC key handler for all modals
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeAll();
        }
      });
    },

    show: function (modalType, data = {}) {
      switch (modalType) {
        case 'pokemon':
          this.showPokemonDetail(data);
          break;
        case 'attack':
          this.showAttackSelection(data);
          break;
      }
    },

    close: function (modalType) {
      let modal = null;

      switch (modalType) {
        case 'pokemon':
          modal = this.pokemonDetail;
          break;
        case 'attack':
          modal = this.attackSelection;
          break;
      }

      if (modal) {
        modal.style.display = 'none';
      }
    },

    closeAll: function () {
      if (this.pokemonDetail) this.pokemonDetail.style.display = 'none';
      if (this.attackSelection) this.attackSelection.style.display = 'none';
    },

    showPokemonDetail: function (pokemon) {
      if (!this.pokemonDetail || !pokemon) return;

      // Populate pokemon information
      const nameEl = document.getElementById('modalPokemonName');
      const iconEl = document.getElementById('modalPokemonIcon');
      const typeEl = document.getElementById('modalPokemonType');
      const hpEl = document.getElementById('modalPokemonHP');
      const rarityEl = document.getElementById('modalPokemonRarity');
      const weaknessEl = document.getElementById('modalPokemonWeakness');
      const resistanceEl = document.getElementById('modalPokemonResistance');
      const movesEl = document.getElementById('modalPokemonMoves');
      const abilitiesEl = document.getElementById('modalPokemonAbilities');

      if (nameEl) nameEl.textContent = `${pokemon.name} Details`;
      if (iconEl)
        iconEl.textContent = PokemonRaidSystem.core.getPokemonIcon(
          pokemon.name
        );

      if (typeEl) {
        typeEl.textContent = pokemon.type.toUpperCase();
        typeEl.className = `pokemon-type-large type-${pokemon.type}`;
        typeEl.style.backgroundColor = PokemonRaidSystem.utils.getTypeColor(
          pokemon.type
        );
      }

      if (hpEl)
        hpEl.textContent = `${pokemon.currentHP || pokemon.maxHP}/${pokemon.maxHP}`;
      if (rarityEl) rarityEl.textContent = pokemon.rarity || 'Common';
      if (weaknessEl) weaknessEl.textContent = pokemon.weakness || 'None';
      if (resistanceEl) resistanceEl.textContent = pokemon.resistance || 'None';

      // Populate moves
      if (movesEl && pokemon.moves) {
        movesEl.innerHTML = '';
        pokemon.moves.forEach((move) => {
          const moveEl = document.createElement('div');
          moveEl.className = 'move-item';
          moveEl.innerHTML = `
            <div class="move-name">${move.name}</div>
            <div class="move-damage">💥 ${move.damage} Damage</div>
            <div class="move-cost">Cost: ${move.cost ? move.cost.join(', ') : 'Unknown'}</div>
          `;
          movesEl.appendChild(moveEl);
        });
      }

      // Populate abilities
      if (abilitiesEl && pokemon.abilities) {
        abilitiesEl.innerHTML = '';
        pokemon.abilities.forEach((ability) => {
          const abilityEl = document.createElement('div');
          abilityEl.className = 'ability-item';
          abilityEl.textContent = ability;
          abilitiesEl.appendChild(abilityEl);
        });
      }

      this.pokemonDetail.style.display = 'flex';
    },

    showAttackSelection: function (pokemon) {
      if (!this.attackSelection || !pokemon || !pokemon.moves) return;

      // Update active Pokemon info
      const iconEl = document.getElementById('attackModalPokemonIcon');
      const nameEl = document.getElementById('attackModalPokemonName');
      const optionsEl = document.getElementById('attackOptions');

      if (iconEl)
        iconEl.textContent = PokemonRaidSystem.core.getPokemonIcon(
          pokemon.name
        );
      if (nameEl) nameEl.textContent = pokemon.name;

      // Populate attack options
      if (optionsEl) {
        optionsEl.innerHTML = '';

        pokemon.moves.forEach((move, index) => {
          const option = document.createElement('div');
          option.className = 'attack-option';
          option.dataset.moveIndex = index;

          option.innerHTML = `
            <div class="attack-option-header">
              <div class="attack-option-name">${move.name}</div>
              <div class="attack-option-damage">${move.damage}</div>
            </div>
            <div class="attack-option-cost">Energy Cost: ${move.cost ? move.cost.join(', ') : 'None'}</div>
            <div class="attack-option-description">${PokemonRaidSystem.utils.getRandomDescription(pokemon)}</div>
          `;

          // Add click handler
          option.addEventListener('click', () => {
            // Remove previous selections
            optionsEl.querySelectorAll('.attack-option').forEach((opt) => {
              opt.classList.remove('selected');
            });

            // Select this option
            option.classList.add('selected');

            // Execute attack after short delay
            setTimeout(() => {
              this.executeAttack(move, pokemon);
              this.close('attack');
            }, 500);
          });

          optionsEl.appendChild(option);
        });
      }

      this.attackSelection.style.display = 'flex';
    },

    executeAttack: function (move, pokemon) {
      PokemonRaidSystem.notifications.show(
        'Attack Launched!',
        `${pokemon.name} used ${move.name} for ${move.damage} damage!`,
        'pokemon'
      );

      // Send the attack to the server
      if (PokemonRaidSystem.core) {
        PokemonRaidSystem.core.sendRaidAction('playerAttack', {
          damage: move.damage,
          attackName: move.name,
          pokemonUsed: pokemon.name,
          energyCost: move.cost,
        });
      }
    },
  },

  // Enhanced utilities
  utils: {
    generateRaidId: () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = 'RAID-';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    },

    formatTime: () => {
      return new Date().toLocaleTimeString();
    },

    getTypeColor: (type) => {
      const typeColors = {
        grass: '#7ac74c',
        fire: '#ee8130',
        water: '#6390f0',
        electric: '#f7d02c',
        psychic: '#f95587',
        ice: '#96d9d6',
        dragon: '#6f35fc',
        dark: '#705746',
        fairy: '#d685ad',
        normal: '#a8a878',
        fighting: '#c22e28',
        poison: '#a33ea1',
        ground: '#e2bf65',
        flying: '#a98ff3',
        bug: '#a6b91a',
        rock: '#b6a136',
        ghost: '#735797',
        steel: '#b7b7ce',
      };
      return typeColors[type.toLowerCase()] || '#a8a878';
    },

    savePokemonTeam: (activeId, benchId) => {
      localStorage.setItem(
        'pokemonTeam',
        JSON.stringify({ activeId, benchId })
      );
    },

    loadPokemonTeam: () => {
      const saved = localStorage.getItem('pokemonTeam');
      return saved ? JSON.parse(saved) : null;
    },

    // New utility functions for enhanced features
    formatMovesList: (moves) => {
      return moves
        .map((move) => `${move.name} (${move.damage} damage)`)
        .join(', ');
    },

    getRandomDescription: (pokemon) => {
      const descriptions = {
        pikachu:
          'This Electric Mouse Pokémon is known for its adorable appearance and powerful electric attacks.',
        charizard:
          'A mighty Fire/Flying type that soars through the skies, breathing intense flames.',
        blastoise:
          'This Water-type turtle Pokémon can withdraw into its shell and blast water from its cannons.',
        venusaur:
          'A Grass/Poison type with a beautiful flower that releases a soothing scent.',
        lucario:
          'An Aura Pokémon that can sense emotions and channel fighting energy.',
        gardevoir:
          'A Psychic/Fairy type that can predict the future and protect its trainer.',
        dragonite:
          'Despite its bulky appearance, this Dragon/Flying type is incredibly fast and kind-hearted.',
        mewtwo:
          'A Legendary Psychic-type created through genetic manipulation, possessing incredible psychic powers.',
      };
      return (
        descriptions[pokemon.id] || 'A powerful Pokémon with unique abilities.'
      );
    },
  },

  // Pokemon database
  pokemonDatabase: [
    {
      id: 'pikachu',
      name: 'Pikachu',
      type: 'electric',
      maxHP: 120,
      moves: [
        { name: 'Thunder Shock', damage: 60, cost: ['Electric'] },
        { name: 'Quick Attack', damage: 40, cost: ['Colorless'] },
      ],
      abilities: ['Static'],
      weakness: 'Fighting',
      resistance: 'Metal',
      rarity: 'Common',
    },
    {
      id: 'charizard',
      name: 'Charizard',
      type: 'fire',
      maxHP: 180,
      moves: [
        { name: 'Flamethrower', damage: 90, cost: ['Fire', 'Colorless'] },
        { name: 'Wing Attack', damage: 60, cost: ['Colorless', 'Colorless'] },
      ],
      abilities: ['Blaze'],
      weakness: 'Water',
      resistance: 'Fighting',
      rarity: 'Rare',
    },
    {
      id: 'blastoise',
      name: 'Blastoise',
      type: 'water',
      maxHP: 170,
      moves: [
        { name: 'Hydro Pump', damage: 100, cost: ['Water', 'Water'] },
        { name: 'Bubble Beam', damage: 50, cost: ['Water'] },
      ],
      abilities: ['Torrent'],
      weakness: 'Electric',
      resistance: 'Fire',
      rarity: 'Rare',
    },
    {
      id: 'venusaur',
      name: 'Venusaur',
      type: 'grass',
      maxHP: 160,
      moves: [
        { name: 'Solar Beam', damage: 120, cost: ['Grass', 'Grass'] },
        { name: 'Vine Whip', damage: 50, cost: ['Grass'] },
      ],
      abilities: ['Overgrow'],
      weakness: 'Fire',
      resistance: 'Water',
      rarity: 'Rare',
    },
    {
      id: 'lucario',
      name: 'Lucario',
      type: 'fighting',
      maxHP: 140,
      moves: [
        { name: 'Aura Sphere', damage: 80, cost: ['Fighting', 'Colorless'] },
        { name: 'Force Palm', damage: 60, cost: ['Fighting'] },
      ],
      abilities: ['Inner Focus'],
      weakness: 'Psychic',
      resistance: 'Dark',
      rarity: 'Rare',
    },
    {
      id: 'gardevoir',
      name: 'Gardevoir',
      type: 'psychic',
      maxHP: 130,
      moves: [
        { name: 'Psychic', damage: 70, cost: ['Psychic', 'Colorless'] },
        { name: 'Teleport', damage: 30, cost: ['Psychic'] },
      ],
      abilities: ['Synchronize'],
      weakness: 'Ghost',
      resistance: 'Fighting',
      rarity: 'Rare',
    },
    {
      id: 'dragonite',
      name: 'Dragonite',
      type: 'dragon',
      maxHP: 200,
      moves: [
        { name: 'Dragon Rush', damage: 110, cost: ['Dragon', 'Colorless'] },
        { name: 'Hurricane', damage: 80, cost: ['Colorless', 'Colorless'] },
      ],
      abilities: ['Inner Focus'],
      weakness: 'Fairy',
      resistance: 'Fighting',
      rarity: 'Rare',
    },
    {
      id: 'mewtwo',
      name: 'Mewtwo',
      type: 'psychic',
      maxHP: 190,
      moves: [
        { name: 'Psystrike', damage: 120, cost: ['Psychic', 'Psychic'] },
        { name: 'Psycho Cut', damage: 70, cost: ['Psychic'] },
      ],
      abilities: ['Pressure'],
      weakness: 'Ghost',
      resistance: 'Fighting',
      rarity: 'Legendary',
    },
  ],
};

// ================ ENHANCED POKEMON RAID CORE ================
class PokemonRaidCore {
  constructor() {
    this.initializeSystem();
  }

  initializeSystem() {
    console.log('🚀 Initializing Pokemon Raid Battle System v4.0.0...');

    // Initialize core systems
    this.initializeLogging();
    this.initializeUI();
    this.initializePokemonSelection();
    this.initializeSocket();
    this.initializeEventHandlers();
    this.initializeKeyboardShortcuts();

    // Initialize new systems
    this.initializeNotifications();
    this.initializeModals();

    // Mark as initialized
    PokemonRaidSystem.state.isInitialized = true;
    this.log('Pokemon Raid Battle System initialized successfully', 'SUCCESS');

    // Show welcome notification
    setTimeout(() => {
      PokemonRaidSystem.notifications.show(
        'Welcome!',
        'Pokemon Raid Battle System v4.0 - Authentic Playmat Edition is ready!',
        'success'
      );
    }, 1000);
  }

  // ================ LOGGING SYSTEM ================
  initializeLogging() {
    PokemonRaidSystem.log.add = (message, level = 'INFO', data = null) => {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        message: message,
        data: data,
        id: Date.now() + Math.random(),
      };

      PokemonRaidSystem.log.entries.push(entry);

      // Maintain max entries
      if (
        PokemonRaidSystem.log.entries.length >
        PokemonRaidSystem.config.logMaxEntries
      ) {
        PokemonRaidSystem.log.entries = PokemonRaidSystem.log.entries.slice(
          -PokemonRaidSystem.config.logMaxEntries
        );
      }

      // Enhanced console output with timestamps
      const consoleMsg = `[${PokemonRaidSystem.utils.formatTime()}] ${message}`;
      switch (level.toUpperCase()) {
        case 'DEBUG':
          console.debug(consoleMsg, data);
          break;
        case 'SUCCESS':
          console.log(
            `%c${consoleMsg}`,
            'color: green; font-weight: bold;',
            data
          );
          break;
        case 'WARN':
          console.warn(consoleMsg, data);
          break;
        case 'ERROR':
          console.error(consoleMsg, data);
          break;
        default:
          console.log(consoleMsg, data);
      }

      // Emit log event
      PokemonRaidSystem.events.dispatchEvent(
        new CustomEvent('log', { detail: entry })
      );
    };

    // Shorthand methods
    this.log = (msg, level = 'INFO', data = null) =>
      PokemonRaidSystem.log.add(msg, level, data);
  }

  // ================ UI MANAGEMENT ================
  initializeUI() {
    this.log('Initializing Pokemon raid UI components...');

    // Main UI references
    PokemonRaidSystem.ui = {
      // Views
      launcher: document.getElementById('raidLauncher'),
      container: document.getElementById('raidContainer'),
      battlefield: document.getElementById('raidBattlefield'),
      playerPanel: document.getElementById('playerPanel'),
      turnIndicator: document.getElementById('turnIndicator'),
      gameControls: document.getElementById('gameControls'),

      // Game elements
      bossZone: document.getElementById('bossZone'),
      bossName: document.getElementById('bossName'),
      bossHPText: document.getElementById('bossHPText'),
      bossHPFill: document.getElementById('bossHPFill'),
      playerZones: document.getElementById('playerZones'),

      // Player panel elements
      playerCardsContainer: document.getElementById('playerCardsContainer'),
      spectatorSection: document.getElementById('spectatorSection'),
      spectatorList: document.getElementById('spectatorList'),

      // Info displays
      raidIdDisplay: document.getElementById('raidIdDisplay'),
      playerCountDisplay: document.getElementById('playerCountDisplay'),
      gamePhaseDisplay: document.getElementById('gamePhaseDisplay'),
      currentTurnDisplay: document.getElementById('currentTurnDisplay'),

      // Pokemon selection
      pokemonGrid: document.getElementById('pokemonGrid'),
      activeSlot: document.getElementById('activeSlot'),
      benchSlot: document.getElementById('benchSlot'),

      // Controls
      playerCards: new Map(),
    };

    this.log('✅ Pokemon raid UI components initialized');

    // Initialize view management
    this.initializeViewManagement();
  }

  initializeViewManagement() {
    // Enhanced view switching with Pokemon-themed transitions
    PokemonRaidSystem.ui.switchView = (viewName) => {
      this.log(`Switching to view: ${viewName}`);

      const launcher = PokemonRaidSystem.ui.launcher;
      const container = PokemonRaidSystem.ui.container;
      const gameControls = PokemonRaidSystem.ui.gameControls;

      // Hide all views with fade effect
      [launcher, container].forEach((el) => {
        if (el) el.style.display = 'none';
      });

      // Show target view
      if (viewName === 'launcher') {
        if (launcher) launcher.style.display = 'block';
        if (gameControls) gameControls.style.display = 'none';
      } else if (viewName === 'game') {
        if (container) container.style.display = 'block';
        if (gameControls) gameControls.style.display = 'flex';
      }
    };

    // Initialize in launcher view
    PokemonRaidSystem.ui.switchView('launcher');
  }

  // ================ POKEMON SELECTION SYSTEM ================
  initializePokemonSelection() {
    this.log('Initializing Pokemon team selection system...');

    const pokemonGrid = PokemonRaidSystem.ui.pokemonGrid;
    if (!pokemonGrid) return;

    // Clear existing content
    pokemonGrid.innerHTML = '';

    // Create Pokemon cards
    PokemonRaidSystem.pokemonDatabase.forEach((pokemon) => {
      const card = this.createPokemonSelectionCard(pokemon);
      pokemonGrid.appendChild(card);
    });

    // Load saved team
    const savedTeam = PokemonRaidSystem.utils.loadPokemonTeam();
    if (savedTeam) {
      this.selectPokemon(savedTeam.activeId, 'active');
      this.selectPokemon(savedTeam.benchId, 'bench');
    }

    this.log('✅ Pokemon team selection system initialized');
  }

  createPokemonSelectionCard(pokemon) {
    const card = document.createElement('div');
    card.className = 'pokemon-card-mini';
    card.dataset.pokemonId = pokemon.id;

    const typeColor = PokemonRaidSystem.utils.getTypeColor(pokemon.type);

    card.innerHTML = `
      <div class="pokemon-name">${pokemon.name}</div>
      <div class="pokemon-type type-${pokemon.type}" style="background-color: ${typeColor};">
        ${pokemon.type.toUpperCase()}
      </div>
      <div class="pokemon-hp">HP: ${pokemon.maxHP}</div>
      <div class="pokemon-moves">
        ${pokemon.moves
          .map((move) => `• ${move.name} (${move.damage})`)
          .join('<br>')}
      </div>
    `;

    card.addEventListener('click', () => {
      this.handlePokemonSelection(pokemon);
    });

    return card;
  }

  handlePokemonSelection(pokemon) {
    // Determine which slot to fill (prioritize active, then bench)
    const activeSlot = PokemonRaidSystem.state.selectedPokemon.active;
    const benchSlot = PokemonRaidSystem.state.selectedPokemon.bench;

    if (!activeSlot) {
      this.selectPokemon(pokemon.id, 'active');
    } else if (!benchSlot && pokemon.id !== activeSlot) {
      this.selectPokemon(pokemon.id, 'bench');
    } else {
      // Both slots filled or same Pokemon - allow switching
      if (pokemon.id === activeSlot) {
        this.selectPokemon(null, 'active');
      } else if (pokemon.id === benchSlot) {
        this.selectPokemon(null, 'bench');
      } else {
        // Replace active slot
        this.selectPokemon(pokemon.id, 'active');
      }
    }

    this.updatePokemonSelectionUI();
  }

  selectPokemon(pokemonId, slot) {
    // Remove from other slot if already selected
    if (pokemonId) {
      if (
        slot === 'active' &&
        PokemonRaidSystem.state.selectedPokemon.bench === pokemonId
      ) {
        PokemonRaidSystem.state.selectedPokemon.bench = null;
      } else if (
        slot === 'bench' &&
        PokemonRaidSystem.state.selectedPokemon.active === pokemonId
      ) {
        PokemonRaidSystem.state.selectedPokemon.active = null;
      }
    }

    PokemonRaidSystem.state.selectedPokemon[slot] = pokemonId;

    // Save to localStorage
    const { active, bench } = PokemonRaidSystem.state.selectedPokemon;
    if (active || bench) {
      PokemonRaidSystem.utils.savePokemonTeam(active, bench);
    }

    this.log(`Selected ${pokemonId || 'none'} for ${slot} slot`);
  }

  updatePokemonSelectionUI() {
    const { active, bench } = PokemonRaidSystem.state.selectedPokemon;

    // Update card selections
    document.querySelectorAll('.pokemon-card-mini').forEach((card) => {
      const pokemonId = card.dataset.pokemonId;
      card.classList.toggle(
        'selected',
        pokemonId === active || pokemonId === bench
      );
    });

    // Update slot displays
    this.updateSlotDisplay('active', active);
    this.updateSlotDisplay('bench', bench);
  }

  updateSlotDisplay(slot, pokemonId) {
    const slotElement = PokemonRaidSystem.ui[`${slot}Slot`];
    if (!slotElement) return;

    if (pokemonId) {
      const pokemon = PokemonRaidSystem.pokemonDatabase.find(
        (p) => p.id === pokemonId
      );
      if (pokemon) {
        const typeColor = PokemonRaidSystem.utils.getTypeColor(pokemon.type);
        slotElement.classList.add('filled');
        slotElement.querySelector('.slot-content').innerHTML = `
          <div style="font-weight: bold; margin-bottom: 5px;">${pokemon.name}</div>
          <div class="pokemon-type type-${pokemon.type}" style="background-color: ${typeColor}; margin-bottom: 5px;">
            ${pokemon.type.toUpperCase()}
          </div>
          <div style="font-size: 12px;">HP: ${pokemon.maxHP}</div>
        `;
      }
    } else {
      slotElement.classList.remove('filled');
      slotElement.querySelector('.slot-content').textContent =
        slot === 'active'
          ? 'Choose your active Pokemon'
          : 'Choose your bench Pokemon';
    }
  }

  // ================ SOCKET MANAGEMENT ================
  initializeSocket() {
    this.log('Initializing socket connection...');

    PokemonRaidSystem.socket = io();

    // Connection events
    PokemonRaidSystem.socket.on('connect', () => {
      PokemonRaidSystem.state.isConnected = true;
      PokemonRaidSystem.state.playerId = PokemonRaidSystem.socket.id;
      this.updateConnectionStatus('Connected', 'success');
      this.log(
        `Connected to server with ID: ${PokemonRaidSystem.state.playerId}`,
        'SUCCESS'
      );
    });

    PokemonRaidSystem.socket.on('disconnect', () => {
      PokemonRaidSystem.state.isConnected = false;
      this.updateConnectionStatus('Disconnected', 'error');
      this.log('Disconnected from server', 'WARN');
    });

    PokemonRaidSystem.socket.on('connect_error', (error) => {
      this.updateConnectionStatus('Connection Error', 'error');
      this.log('Connection error', 'ERROR', error);
    });

    // Setup raid-specific socket events
    this.setupRaidSocketEvents();
  }

  setupRaidSocketEvents() {
    // Raid creation and joining
    PokemonRaidSystem.socket.on('raidCreated', (data) => {
      this.log('Raid created successfully!', 'SUCCESS');
      this.handleRaidCreated(data);
    });

    PokemonRaidSystem.socket.on('raidJoined', (data) => {
      this.log('Successfully joined raid!', 'SUCCESS');
      this.handleRaidJoined(data);
    });

    PokemonRaidSystem.socket.on('playerJoinedRaid', (data) => {
      this.log(`Player ${data.player?.username || 'Unknown'} joined raid`);
      this.handlePlayerJoined(data);
    });

    PokemonRaidSystem.socket.on('playerLeftRaid', (data) => {
      this.log(`Player left raid`);
      this.handlePlayerLeft(data);
    });

    // Game state and actions
    PokemonRaidSystem.socket.on('raidActionResult', (data) => {
      this.log(`Action result: ${data.actionType} - ${data.message}`, 'INFO');
      this.showActionFeedback(data.message, data.actionType);
      this.renderRaidState();
    });

    PokemonRaidSystem.socket.on('gameStateUpdate', (data) => {
      this.log('Game state updated');
      this.handleGameStateUpdate(data);
    });

    // Error handling
    PokemonRaidSystem.socket.on('raidCreationFailed', (data) => {
      this.log(`Failed to create raid: ${data.message}`, 'ERROR');
    });

    PokemonRaidSystem.socket.on('raidJoinFailed', (data) => {
      this.log(`Failed to join raid: ${data.message}`, 'ERROR');
    });

    PokemonRaidSystem.socket.on('raidActionFailed', (data) => {
      this.log(`Action failed: ${data.error}`, 'ERROR');
    });
  }

  // ================ EVENT HANDLERS ================
  initializeEventHandlers() {
    this.log('Setting up Pokemon raid event handlers...');

    // Launcher controls
    this.setupElement('createRaidBtn', () => this.createRaid());
    this.setupElement('joinRaidBtn', () => this.joinRaid());
    this.setupElement('testMultiplayerBtn', () => this.testMultiplayer());

    // Game actions
    this.setupElement('attackBtn', () => this.sendAttack());
    this.setupElement('defendBtn', () => this.sendDefend());
    this.setupElement('leaveRaidBtn', () => this.leaveRaid());

    // Check for URL parameters
    this.checkURLParameters();
  }

  setupElement(id, handler) {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener('click', handler);
    }
  }

  initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Quick attack: Space (when in game)
      if (e.key === ' ' && PokemonRaidSystem.state.currentRaid) {
        e.preventDefault();
        this.sendAttack();
      }

      // Leave raid: Escape
      if (e.key === 'Escape' && PokemonRaidSystem.state.currentRaid) {
        e.preventDefault();
        this.leaveRaid();
      }
    });
  }

  checkURLParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const raidId = urlParams.get('raid');
    const username = urlParams.get('username');
    const autoJoin = urlParams.get('join');

    if (raidId && autoJoin === 'auto') {
      this.log(`Auto-joining raid: ${raidId}`, 'INFO');

      setTimeout(() => {
        if (username) {
          const usernameInput = document.getElementById('usernameInput');
          if (usernameInput) usernameInput.value = username;
          PokemonRaidSystem.state.username = username;
        }

        const raidInput = document.getElementById('raidIdInput');
        if (raidInput) {
          raidInput.value = raidId;
          this.joinRaid();
        }
      }, 1000);
    }
  }

  // ================ 3D RENDERING SYSTEM ================
  renderRaidState() {
    if (!PokemonRaidSystem.state.currentRaid) return;

    this.log(`Rendering Pokemon raid battlefield`);

    // Render all components
    this.renderBattlefield();
    this.renderPlayerZones();
    this.renderPlayerCards();
    this.renderBossDisplay();
    this.renderTurnIndicator();
    this.renderSpectatorPanel();
    this.updateRaidInfo();
  }

  renderBattlefield() {
    const battlefield = PokemonRaidSystem.ui.battlefield;
    if (!battlefield) return;

    // Apply 3D perspective styling
    battlefield.className = 'raid-battlefield';
    this.log('Applied 3D battlefield perspective');
  }

  renderPlayerZones() {
    const playerZones = PokemonRaidSystem.ui.playerZones;
    if (!playerZones || !PokemonRaidSystem.state.currentRaid?.players) return;

    // Clear existing zones
    playerZones.innerHTML = '';

    // Calculate positions for player zones
    const players = PokemonRaidSystem.state.currentRaid.players;
    const positions = this.calculatePlayerZonePositions(players.length);

    players.forEach((player, index) => {
      const position = positions[index];
      if (!position) return;

      const zone = this.createPlayerZone(player, position, index);
      playerZones.appendChild(zone);
    });

    this.log(`Rendered ${players.length} player zones`);
  }

  calculatePlayerZonePositions(playerCount) {
    const positions = [];

    // Position players around the bottom and sides of the battlefield
    for (let i = 0; i < playerCount; i++) {
      let x, y;

      switch (i) {
        case 0: // Bottom center
          x = 45;
          y = 85;
          break;
        case 1: // Bottom right
          x = 75;
          y = 80;
          break;
        case 2: // Bottom left
          x = 15;
          y = 80;
          break;
        case 3: // Right side
          x = 85;
          y = 60;
          break;
        default:
          x = 10 + i * 20;
          y = 85;
      }

      positions.push({ x, y });
    }

    return positions;
  }

  createPlayerZone(player, position, index) {
    const zone = document.createElement('div');
    zone.className = 'player-zone';
    zone.id = `player-zone-${player.id}`;

    // Position the zone
    zone.style.left = `${position.x}%`;
    zone.style.top = `${position.y}%`;

    // Check if it's current turn
    const isCurrentTurn =
      PokemonRaidSystem.state.currentRaid.currentTurnPlayerId === player.id;
    if (isCurrentTurn) {
      zone.classList.add('current-turn');
    }

    // Check if player is KO'd
    const isKO = player.status === 'ko' || player.status === 'spectator';
    if (isKO) {
      zone.classList.add('ko');
    }

    zone.innerHTML = `
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">
        ${isCurrentTurn ? '⭐' : ''} ${player.username}
      </div>
      <div style="font-size: 12px; opacity: 0.8;">
        ${isKO ? "KO'd" : 'Active'}
      </div>
    `;

    // Add click event for focusing on player
    zone.addEventListener('click', () => {
      this.focusOnPlayer(player.id);
    });

    return zone;
  }

  renderPlayerCards() {
    const container = PokemonRaidSystem.ui.playerCardsContainer;
    if (!container || !PokemonRaidSystem.state.currentRaid?.players) return;

    // Clear existing cards
    container.innerHTML = '';
    PokemonRaidSystem.ui.playerCards.clear();

    // Create player cards
    PokemonRaidSystem.state.currentRaid.players.forEach((player) => {
      const card = this.createPlayerCard(player);
      container.appendChild(card);
      PokemonRaidSystem.ui.playerCards.set(player.id, card);
    });

    this.log(
      `Rendered ${PokemonRaidSystem.state.currentRaid.players.length} player cards`
    );
  }

  createPlayerCard(player) {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.id = `player-card-${player.id}`;

    // Check if it's current turn
    const isCurrentTurn =
      PokemonRaidSystem.state.currentRaid.currentTurnPlayerId === player.id;
    if (isCurrentTurn) {
      card.classList.add('current-turn');
    }

    // Get player's Pokemon data
    const activePokemon =
      player.pokemon?.active || this.getDefaultPokemon('active');
    const benchPokemon =
      player.pokemon?.bench || this.getDefaultPokemon('bench');

    // Player avatar based on their selected Pokemon or default
    const avatarIcon = this.getPokemonIcon(activePokemon.name);

    card.innerHTML = `
      <div class="player-header">
        <div class="player-avatar">${avatarIcon}</div>
        <div class="player-info">
          <div class="player-name">${player.username}</div>
          <div class="player-status">${isCurrentTurn ? 'Current Turn' : player.status || 'Active'}</div>
        </div>
      </div>
      
      <div class="pokemon-layout">
        ${this.createPokemonSlotHTML(activePokemon, 'active')}
        ${this.createPokemonSlotHTML(benchPokemon, 'bench')}
      </div>
      
      <div class="player-stats">
        <div class="stat-item">
          <div class="stat-value">${player.raidData?.damageDealt || 0}</div>
          <div class="stat-label">Damage</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${player.raidData?.actionsUsed || 0}</div>
          <div class="stat-label">Actions</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${player.raidData?.turnsPlayed || 0}</div>
          <div class="stat-label">Turns</div>
        </div>
      </div>
    `;

    // Add click event for detailed view
    card.addEventListener('click', () => {
      this.showPlayerDetails(player);
    });

    return card;
  }

  createPokemonSlotHTML(pokemon, slotType) {
    const typeColor = PokemonRaidSystem.utils.getTypeColor(pokemon.type);
    const hpPercentage = (pokemon.currentHP / pokemon.maxHP) * 100;
    const isKO = pokemon.currentHP <= 0;

    const slotHTML = `
      <div class="pokemon-slot ${slotType} ${isKO ? 'ko' : ''}" data-pokemon-id="${pokemon.id || pokemon.name.toLowerCase()}">
        <div class="slot-label">${slotType === 'active' ? 'Active' : 'Bench'}</div>
        <div class="pokemon-card-content">
          <div class="pokemon-name">${pokemon.name}</div>
          <div class="pokemon-type-badge type-${pokemon.type}" style="background-color: ${typeColor};">
            ${pokemon.type.toUpperCase()}
          </div>
          <div class="hp-section">
            <div class="hp-bar">
              <div class="hp-fill ${hpPercentage <= 25 ? 'critical' : ''}" style="width: ${hpPercentage}%;"></div>
            </div>
            <div class="hp-text">${pokemon.currentHP}/${pokemon.maxHP} HP</div>
          </div>
          <div class="moves-section">
            ${
              pokemon.moves
                ? pokemon.moves
                    .slice(0, 2)
                    .map((move) => `• ${move.name}`)
                    .join('<br>')
                : ''
            }
          </div>
        </div>
        <div class="status-indicator status-${isKO ? 'ko' : 'active'}"></div>
      </div>
    `;

    return slotHTML;
  }

  // Enhanced method to create Pokemon slot with click handlers
  createPokemonSlotElement(pokemon, slotType) {
    const slotContainer = document.createElement('div');
    slotContainer.innerHTML = this.createPokemonSlotHTML(pokemon, slotType);
    const slot = slotContainer.firstElementChild;

    // Add click handler for Pokemon details
    slot.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showPokemonDetails(pokemon);
    });

    // Add hover effects
    slot.addEventListener('mouseenter', () => {
      slot.style.transform = 'scale(1.02)';
      slot.style.transition = 'all 0.2s ease';
    });

    slot.addEventListener('mouseleave', () => {
      slot.style.transform = 'scale(1)';
    });

    return slot;
  }

  showPokemonDetails(pokemon) {
    this.log(`Showing details for ${pokemon.name}`);

    // Enhance pokemon data with additional info if needed
    const enhancedPokemon = {
      ...pokemon,
      description: PokemonRaidSystem.utils.getRandomDescription(pokemon),
    };

    PokemonRaidSystem.modals.show('pokemon', enhancedPokemon);

    // Show notification
    PokemonRaidSystem.notifications.show(
      'Pokemon Details',
      `Viewing ${pokemon.name} information`,
      'info',
      2000
    );
  }

  getDefaultPokemon(slot) {
    // Return default Pokemon data for players who haven't selected yet
    const defaults = {
      active: {
        name: 'Pikachu',
        type: 'electric',
        currentHP: 120,
        maxHP: 120,
        moves: [{ name: 'Thunder Shock' }],
      },
      bench: {
        name: 'Squirtle',
        type: 'water',
        currentHP: 100,
        maxHP: 100,
        moves: [{ name: 'Water Gun' }],
      },
    };
    return defaults[slot];
  }

  getPokemonIcon(pokemonName) {
    const icons = {
      Pikachu: '⚡',
      Charizard: '🔥',
      Blastoise: '💧',
      Venusaur: '🌿',
      Lucario: '👊',
      Gardevoir: '🔮',
      Dragonite: '🐉',
      Mewtwo: '🧠',
    };
    return icons[pokemonName] || '🎮';
  }

  renderBossDisplay() {
    const boss = PokemonRaidSystem.state.currentRaid?.boss;
    if (!boss) return;

    this.log(
      `🎯 Rendering boss: ${boss.name} - HP: ${boss.currentHP}/${boss.maxHP}`,
      'DEBUG'
    );

    // Update boss info
    if (PokemonRaidSystem.ui.bossName) {
      PokemonRaidSystem.ui.bossName.textContent = boss.name;
    }

    if (PokemonRaidSystem.ui.bossHPText) {
      PokemonRaidSystem.ui.bossHPText.textContent = `HP: ${boss.currentHP} / ${boss.maxHP}`;
    }

    // Update HP bar
    if (PokemonRaidSystem.ui.bossHPFill) {
      const percentage = (boss.currentHP / boss.maxHP) * 100;
      PokemonRaidSystem.ui.bossHPFill.style.width = `${percentage}%`;

      this.log(`🎯 Boss HP bar updated: ${percentage.toFixed(1)}%`, 'DEBUG');
    }
  }

  renderTurnIndicator() {
    const turnDisplay = document.getElementById('turnDisplay');
    const turnData = PokemonRaidSystem.state.currentRaid?.turnIndicator;

    if (!turnDisplay || !turnData?.elements) {
      if (turnDisplay) {
        turnDisplay.innerHTML =
          '<div class="turn-element">Waiting for players...</div>';
      }
      return;
    }

    turnDisplay.innerHTML = '';

    // Create turn elements
    turnData.elements.forEach((element, index) => {
      const turnEl = document.createElement('div');
      turnEl.className = `turn-element ${element.status} ${element.type}`;

      // Content
      turnEl.innerHTML = `
        <span>${element.type === 'boss' ? '👹' : '👤'}</span>
        <span>${element.username || element.name}</span>
      `;

      turnDisplay.appendChild(turnEl);
    });
  }

  renderSpectatorPanel() {
    const spectators = PokemonRaidSystem.state.currentRaid?.spectators || [];
    const section = PokemonRaidSystem.ui.spectatorSection;
    const list = PokemonRaidSystem.ui.spectatorList;

    if (!section || !list) return;

    if (spectators.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = '';

    spectators.forEach((spectator) => {
      const spectatorEl = document.createElement('div');
      spectatorEl.className = `spectator-item ${spectator.wasPlayer ? 'was-player' : ''}`;
      spectatorEl.innerHTML = `
        <span>${spectator.wasPlayer ? '💀' : '👻'}</span>
        <span>${spectator.username}</span>
      `;
      list.appendChild(spectatorEl);
    });

    this.log(`Rendered ${spectators.length} spectators`);
  }

  // ================ RAID ACTIONS ================
  createRaid() {
    const { active, bench } = PokemonRaidSystem.state.selectedPokemon;

    if (!active || !bench) {
      this.log(
        'Please select both active and bench Pokemon before creating a raid',
        'ERROR'
      );
      alert(
        'Please select both active and bench Pokemon before creating a raid!'
      );
      return;
    }

    const raidId = PokemonRaidSystem.utils.generateRaidId();
    this.log(`Creating raid: ${raidId}`);

    const playerData = this.createPlayerData();

    PokemonRaidSystem.socket.emit('createRaid', {
      raidId: raidId,
      raidType: 'pokemon-tcg',
      maxPlayers: 4,
      minPlayers: 1,
      playerData: playerData,
    });
  }

  joinRaid() {
    const raidId = document.getElementById('raidIdInput')?.value?.trim();
    const username =
      document.getElementById('usernameInput')?.value?.trim() || 'Trainer';

    if (!raidId) {
      this.log('Please enter a raid ID', 'ERROR');
      return;
    }

    const { active, bench } = PokemonRaidSystem.state.selectedPokemon;

    if (!active || !bench) {
      this.log(
        'Please select both active and bench Pokemon before joining a raid',
        'ERROR'
      );
      alert(
        'Please select both active and bench Pokemon before joining a raid!'
      );
      return;
    }

    PokemonRaidSystem.state.username = username;
    this.log(`Joining raid: ${raidId} as ${username}`);

    const playerData = this.createPlayerData();

    PokemonRaidSystem.socket.emit('joinRaid', {
      raidId: raidId,
      playerData: playerData,
    });
  }

  createPlayerData() {
    const { active, bench } = PokemonRaidSystem.state.selectedPokemon;
    const activePokemon = PokemonRaidSystem.pokemonDatabase.find(
      (p) => p.id === active
    );
    const benchPokemon = PokemonRaidSystem.pokemonDatabase.find(
      (p) => p.id === bench
    );

    return {
      username: PokemonRaidSystem.state.username,
      pokemon: {
        active: {
          ...activePokemon,
          currentHP: activePokemon.maxHP,
          status: 'active',
        },
        bench: {
          ...benchPokemon,
          currentHP: benchPokemon.maxHP,
          status: 'bench',
        },
      },
      profile: {
        icon: this.getPokemonIcon(activePokemon.name),
        favoriteType: activePokemon.type,
        level: Math.floor(Math.random() * 50) + 1,
        wins: Math.floor(Math.random() * 100),
        losses: Math.floor(Math.random() * 50),
      },
    };
  }

  testMultiplayer() {
    const raidId = PokemonRaidSystem.utils.generateRaidId();
    this.log(`Creating multiplayer test: ${raidId}`);

    const testUrl = `${window.location.origin}/raid-isolated.html?raid=${raidId}&username=TestTrainer&join=auto`;

    // Copy to clipboard
    navigator.clipboard
      .writeText(testUrl)
      .then(() => {
        this.log('Test URL copied to clipboard!', 'SUCCESS');
      })
      .catch(() => {
        this.log(`Test URL: ${testUrl}`);
      });

    // Create the raid
    const playerData = this.createPlayerData();
    PokemonRaidSystem.socket.emit('createRaid', {
      raidId: raidId,
      raidType: 'pokemon-tcg',
      maxPlayers: 4,
      playerData: playerData,
    });
  }

  sendAttack() {
    if (!PokemonRaidSystem.state.currentRaid) {
      PokemonRaidSystem.notifications.show(
        'Cannot Attack',
        'You are not in an active raid battle!',
        'warning'
      );
      return;
    }

    const activePokemon = PokemonRaidSystem.state.selectedPokemon.active;
    if (!activePokemon) {
      PokemonRaidSystem.notifications.show(
        'No Active Pokemon',
        'Please select an active Pokemon first!',
        'warning'
      );
      return;
    }

    const pokemon = PokemonRaidSystem.pokemonDatabase.find(
      (p) => p.id === activePokemon
    );

    if (!pokemon || !pokemon.moves || pokemon.moves.length === 0) {
      PokemonRaidSystem.notifications.show(
        'No Moves Available',
        'Your Pokemon has no available moves!',
        'error'
      );
      return;
    }

    // Show attack selection modal instead of auto-using first move
    this.log(`Opening attack selection for ${pokemon.name}`);
    PokemonRaidSystem.modals.show('attack', pokemon);
  }

  sendDefend() {
    if (!PokemonRaidSystem.state.currentRaid) {
      PokemonRaidSystem.notifications.show(
        'Cannot Defend',
        'You are not in an active raid battle!',
        'warning'
      );
      return;
    }

    this.log('Using defensive action');

    PokemonRaidSystem.notifications.show(
      'Defending!',
      'Your Pokemon is taking a defensive stance!',
      'info'
    );

    this.sendRaidAction('playerDefend', {
      defenseType: 'guard',
      damageReduction: 50,
    });
  }

  sendRaidAction(actionType, actionData = {}) {
    if (!PokemonRaidSystem.socket || !PokemonRaidSystem.state.currentRaid)
      return;

    PokemonRaidSystem.socket.emit('raidAction', {
      raidId: PokemonRaidSystem.state.currentRaid.id,
      action: {
        type: actionType,
        ...actionData,
      },
    });
  }

  leaveRaid() {
    if (!PokemonRaidSystem.state.currentRaid) return;

    PokemonRaidSystem.socket.emit('leaveRaid', {
      raidId: PokemonRaidSystem.state.currentRaid.id,
    });

    PokemonRaidSystem.state.currentRaid = null;
    PokemonRaidSystem.ui.switchView('launcher');
    this.log('Left raid');
  }

  // ================ EVENT HANDLERS ================
  handleRaidCreated(data) {
    PokemonRaidSystem.state.currentRaid = data.raidState;
    PokemonRaidSystem.state.playerId = data.playerId;
    PokemonRaidSystem.ui.switchView('game');
    this.renderRaidState();

    // Show success notification
    PokemonRaidSystem.notifications.show(
      'Raid Created!',
      `Successfully created raid: ${data.raidState.id}`,
      'success'
    );
  }

  handleRaidJoined(data) {
    PokemonRaidSystem.state.currentRaid = data.raidState;
    PokemonRaidSystem.state.playerId = data.playerId;
    PokemonRaidSystem.ui.switchView('game');
    this.renderRaidState();

    // Show success notification
    PokemonRaidSystem.notifications.show(
      'Joined Raid!',
      `Successfully joined raid: ${data.raidState.id}`,
      'success'
    );
  }

  handlePlayerJoined(data) {
    this.log(`${data.player?.username || 'Player'} joined the raid`);
    this.renderRaidState();

    // Show player joined notification
    PokemonRaidSystem.notifications.show(
      'Player Joined',
      `${data.player?.username || 'A trainer'} joined the raid!`,
      'info'
    );
  }

  handlePlayerLeft(data) {
    this.log(`${data.playerUsername || 'Player'} left the raid`);
    this.renderRaidState();

    // Show player left notification
    PokemonRaidSystem.notifications.show(
      'Player Left',
      `${data.playerUsername || 'A trainer'} left the raid`,
      'warning'
    );
  }

  handleGameStateUpdate(data) {
    PokemonRaidSystem.state.currentRaid = data.raidState;
    this.renderRaidState();
    this.log('Game state updated');

    // Check for significant game events
    if (data.raidState.gamePhase !== PokemonRaidSystem.state.gamePhase) {
      PokemonRaidSystem.state.gamePhase = data.raidState.gamePhase;

      let phaseMessage = '';
      switch (data.raidState.gamePhase) {
        case 'battle':
          phaseMessage = 'Battle phase has begun!';
          break;
        case 'victory':
          phaseMessage = 'Victory! The raid boss has been defeated!';
          break;
        case 'defeat':
          phaseMessage = 'Defeat... The raid boss was too strong.';
          break;
        default:
          phaseMessage = `Game phase changed to: ${data.raidState.gamePhase}`;
      }

      PokemonRaidSystem.notifications.show(
        'Game Update',
        phaseMessage,
        data.raidState.gamePhase === 'victory'
          ? 'success'
          : data.raidState.gamePhase === 'defeat'
            ? 'error'
            : 'info'
      );
    }
  }

  showActionFeedback(message, actionType) {
    this.log(`Action feedback: ${message}`);

    // Determine notification type based on action
    let notificationType = 'info';
    if (actionType === 'playerAttack') {
      notificationType = 'pokemon';
    } else if (actionType === 'playerDefend') {
      notificationType = 'info';
    } else if (message.includes('failed') || message.includes('error')) {
      notificationType = 'error';
    } else if (message.includes('success')) {
      notificationType = 'success';
    }

    PokemonRaidSystem.notifications.show(
      'Action Result',
      message,
      notificationType
    );
  }

  focusOnPlayer(playerId) {
    this.log(`Focusing on player: ${playerId}`);
    // Future: Add camera animation to focus on specific player
  }

  showPlayerDetails(player) {
    this.log(`Showing details for player: ${player.username}`);
    // Future: Show detailed modal with Pokemon information
  }

  // ================ UI UPDATES ================
  updateConnectionStatus(status, type = 'info') {
    const statusEl = document.getElementById('connectionStatusDisplay');
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.className = type;
    }
  }

  updateRaidInfo() {
    if (!PokemonRaidSystem.state.currentRaid) return;

    const updates = {
      raidIdDisplay: PokemonRaidSystem.state.currentRaid.id,
      playerCountDisplay: `${PokemonRaidSystem.state.currentRaid.players.length}/${PokemonRaidSystem.state.currentRaid.config.maxPlayers}`,
      gamePhaseDisplay: PokemonRaidSystem.state.currentRaid.gamePhase,
      currentTurnDisplay:
        PokemonRaidSystem.state.currentRaid.currentTurnPlayer?.username || '-',
    };

    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    this.log(
      `Raid info updated - ${PokemonRaidSystem.state.currentRaid.players.length} players`
    );
  }

  // ================ NEW SYSTEM INITIALIZATION ================
  initializeNotifications() {
    this.log('Initializing notification system...');
    PokemonRaidSystem.notifications.container =
      document.getElementById('gameNotifications');

    // Add slideOutRight animation if not already present
    if (!document.querySelector('style[data-animations]')) {
      const style = document.createElement('style');
      style.setAttribute('data-animations', 'true');
      style.textContent = `
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  initializeModals() {
    this.log('Initializing modal systems...');
    PokemonRaidSystem.modals.init();
  }
}

// ================ AUTO-INITIALIZATION ================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize the Pokemon Raid Battle System
    window.PokemonRaidSystem.core = new PokemonRaidCore();
    window.PokemonRaidSystem.initialized = true;

    console.log('✅ Pokemon Raid Battle System fully initialized and ready!');
  } catch (error) {
    console.error('❌ Failed to initialize Pokemon Raid Battle System:', error);
  }
});

/* ===================================================================
 * END OF FILE: client/js/raid-core.js
 *
 * Pokemon Raid Battle System with:
 * - Authentic Pokemon TCG playmat design
 * - Pokemon team selection system
 * - Enhanced player cards with detailed Pokemon info
 * - 3D battlefield perspective
 * - Real-time multiplayer synchronization
 * - Advanced visual effects and animations
 * ===================================================================*/
