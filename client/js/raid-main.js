/* ===================================================================
 * File: client/js/raid-main.js
 * Purpose: Main initialization and setup for PTCG Raid System
 * Version: 1.0.0
 * Author: PTCG Sim Meta Team
 *
 * Description:
 *   Main entry point for the raid system client. Handles initialization,
 *   event listeners, and coordination between components.
 *
 * Dependencies:
 *   - src/raid/RaidClientCore.js
 *   - Socket.IO client library
 *   - DOM APIs
 *
 * Used By:
 *   - raid-test.html (via module import)
 *
 * Changelog:
 *   v1.0.0 - Initial modular implementation
 * ===================================================================*/

import { RaidClientCore } from '../src/raid/RaidClientCore.js';

/**
 * Global application state and utilities
 */
window.raidClient = {
  clientCore: null,
  gameLog: {
    entries: [],
    currentTab: 'all',
    maxEntries: 100,

    /**
     * Add a new log entry
     * @param {string} message - The message to log
     * @param {string} type - The type of message (system, action, debug, error)
     */
    add(message, type = 'system') {
      const entry = {
        timestamp: new Date().toLocaleTimeString(),
        message: message,
        type: type,
        id: Date.now() + Math.random(),
      };

      this.entries.push(entry);

      // Maintain max entries
      if (this.entries.length > this.maxEntries) {
        this.entries = this.entries.slice(-this.maxEntries);
      }

      this.render();
    },

    /**
     * Render the game log based on current filter
     */
    render() {
      const content = document.getElementById('gameLogContent');
      if (!content) return;

      const filtered =
        this.currentTab === 'all'
          ? this.entries
          : this.entries.filter((e) => {
              if (this.currentTab === 'actions')
                return ['action', 'damage', 'heal'].includes(e.type);
              if (this.currentTab === 'debug') return e.type === 'debug';
              if (this.currentTab === 'errors') return e.type === 'error';
              return true;
            });

      content.innerHTML = filtered
        .map(
          (e) =>
            `<div class="log-entry ${e.type}">[${e.timestamp}] ${e.message}</div>`
        )
        .reverse()
        .join('');
    },

    /**
     * Clear all log entries
     */
    clear() {
      this.entries = [];
      this.render();
    },
  },
};

/**
 * Initialize the PTCG Raid System
 */
function initializeRaidSystem() {
  console.log('🚀 Initializing Enhanced Raid Client v1.0.0...');

  try {
    // Create client core instance
    window.raidClient.clientCore = new RaidClientCore();

    // Initialize the base UI through the UI controller
    window.raidClient.clientCore.uiController.initializeBaseUI();

    // Setup additional UI event listeners
    setupEnhancedUIListeners();

    // Setup game log integration
    setupGameLogIntegration();

    // Connect to server
    window.raidClient.clientCore.connect();

    // Setup view switching enhancement
    enhanceViewSwitching();

    console.log('✅ Raid system initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize raid system:', error);

    // Show error to user
    const statusDisplay = document.getElementById('connectionStatusDisplay');
    if (statusDisplay) {
      statusDisplay.textContent = 'Initialization Error';
      statusDisplay.className = 'error';
    }

    // Log error
    window.raidClient.gameLog.add(
      `Initialization failed: ${error.message}`,
      'error'
    );
  }
}

/**
 * Setup enhanced UI event listeners
 */
function setupEnhancedUIListeners() {
  console.log('📋 Setting up enhanced UI listeners...');

  // Game log tabs
  document.querySelectorAll('.log-tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      // Update active tab
      document
        .querySelectorAll('.log-tab-btn')
        .forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');

      // Update current tab and re-render
      window.raidClient.gameLog.currentTab = e.target.dataset.tab;
      window.raidClient.gameLog.render();
    });
  });

  // Debug panel close button
  const closeDebugBtn = document.getElementById('closeDebugBtn');
  if (closeDebugBtn) {
    closeDebugBtn.addEventListener('click', () => {
      document.getElementById('debugPanel').style.display = 'none';
    });
  }

  // Enhanced button actions with better error handling
  setupButtonListeners();

  // Handle URL parameters for auto-join
  handleURLParameters();

  console.log('✅ Enhanced UI listeners setup complete');
}

/**
 * Setup main button event listeners
 */
function setupButtonListeners() {
  const buttonConfigs = [
    {
      id: 'createRaidBtn',
      action: () => {
        console.log('🎮 Create Raid button clicked');
        const layout = window.raidClient.clientCore.getLayoutPreference();
        window.raidClient.clientCore.createRaid(layout);
      },
    },
    {
      id: 'joinRaidBtn',
      action: () => {
        console.log('🚪 Join Raid button clicked');
        const raidId = document.getElementById('raidIdInput')?.value?.trim();
        const username =
          document.getElementById('usernameInput')?.value?.trim() || 'Player';

        if (!raidId) {
          window.raidClient.gameLog.add(
            'Please enter a Raid ID to join',
            'error'
          );
          return;
        }

        window.raidClient.clientCore.joinRaid(raidId, username);
      },
    },
    {
      id: 'launcherToggleLayoutBtn',
      action: () => {
        console.log('🔄 Layout toggle button clicked');
        const current = window.raidClient.clientCore.getLayoutPreference();
        const newLayout = current === 'versus' ? 'circular' : 'versus';
        window.raidClient.clientCore.setLayoutPreference(newLayout);
      },
    },
    {
      id: 'controlsSwitchLayoutBtn',
      action: () => {
        console.log('🔀 Switch layout button clicked');
        const current = window.raidClient.clientCore.getActiveRaidLayout();
        const newLayout = current === 'versus' ? 'circular' : 'versus';
        window.raidClient.clientCore.requestLayoutSwitch(newLayout);
      },
    },
    {
      id: 'leaveRaidBtn',
      action: () => {
        console.log('🚪 Leave raid button clicked');
        if (confirm('Are you sure you want to leave the raid?')) {
          window.raidClient.clientCore.leaveRaid();
        }
      },
    },
    {
      id: 'attackBtn',
      action: () => {
        console.log('⚔️ Attack button clicked');
        window.raidClient.clientCore.sendRaidAction('playerAttack', {
          pokemon: 'active',
          attackName: 'Thunder Shock',
          damage: 60,
        });
      },
    },
    {
      id: 'testKOBtn',
      action: () => {
        console.log('💀 Test KO button clicked');
        window.raidClient.clientCore.sendRaidAction('testKO', {
          pokemon: 'active',
        });
      },
    },
    {
      id: 'quickTestBtn',
      action: () => {
        console.log('⚡ Quick test button clicked');
        window.raidClient.clientCore.createRaid('versus', null);
      },
    },
    {
      id: 'testMultiplayerBtn',
      action: () => {
        console.log('🔗 Multiplayer test button clicked');
        const testRaidId =
          'TEST-' + Date.now().toString(36).slice(-4).toUpperCase();
        window.raidClient.clientCore.createRaid('circular', testRaidId);

        setTimeout(() => {
          const url = `${window.location.origin}${window.location.pathname}?autoJoin=true&testRaid=${testRaidId}&testPlayer=Player`;

          // Copy URL to clipboard if possible
          if (navigator.clipboard) {
            navigator.clipboard
              .writeText(url)
              .then(() => {
                alert(
                  `🎮 Multiplayer Test Created!\n\n🆔 Raid ID: ${testRaidId}\n\n📋 URL copied to clipboard!\n\nShare this URL or open in other tabs to test multiplayer.`
                );
              })
              .catch(() => {
                alert(
                  `🎮 Multiplayer Test Created!\n\n🆔 Raid ID: ${testRaidId}\n\n🔗 Test URL:\n${url}`
                );
              });
          } else {
            alert(
              `🎮 Multiplayer Test Created!\n\n🆔 Raid ID: ${testRaidId}\n\n🔗 Test URL:\n${url}`
            );
          }
        }, 1000);
      },
    },
    {
      id: 'stressTestBtn',
      action: () => {
        console.log('🔥 Stress test button clicked');
        window.raidClient.clientCore.createRaid('versus', null);

        setTimeout(() => {
          let count = 0;
          const interval = setInterval(() => {
            if (count >= 10) {
              clearInterval(interval);
              window.raidClient.gameLog.add('Stress test completed!', 'debug');
              return;
            }

            window.raidClient.clientCore.sendRaidAction('playerAttack', {
              pokemon: 'active',
              damage: 25,
            });
            count++;
          }, 500);
        }, 2000);
      },
    },
  ];

  // Setup button listeners with error handling
  buttonConfigs.forEach((config) => {
    const button = document.getElementById(config.id);
    if (button) {
      button.addEventListener('click', (e) => {
        try {
          // Add visual feedback
          button.classList.add('animate-button-press');
          setTimeout(
            () => button.classList.remove('animate-button-press'),
            200
          );

          // Execute action
          config.action();
        } catch (error) {
          console.error(`Error in ${config.id} handler:`, error);
          window.raidClient.gameLog.add(
            `Button error: ${error.message}`,
            'error'
          );
        }
      });
    } else {
      console.warn(`Button ${config.id} not found for event listener setup`);
    }
  });
}

/**
 * Setup game log integration with existing logging
 */
function setupGameLogIntegration() {
  console.log('📝 Setting up game log integration...');

  // Enhanced logging that integrates with the game log
  if (window.raidClient.clientCore) {
    // Override the log method to also add to game log
    const originalLog = window.raidClient.clientCore.log.bind(
      window.raidClient.clientCore
    );

    window.raidClient.clientCore.log = function (
      message,
      type = 'info',
      isCritical = false
    ) {
      // Call original log method
      originalLog(message, type, isCritical);

      // Map log types to game log types
      const gameLogType =
        {
          success: 'action',
          warning: 'debug',
          error: 'error',
          info: 'system',
        }[type] || 'system';

      // Add to game log
      window.raidClient.gameLog.add(message, gameLogType);
    };
  }

  console.log('✅ Game log integration complete');
}

/**
 * Enhance view switching to show/hide components properly
 */
function enhanceViewSwitching() {
  console.log('🔄 Enhancing view switching...');

  if (
    window.raidClient.clientCore &&
    window.raidClient.clientCore.uiController
  ) {
    // Store original switchView method
    const originalSwitchView =
      window.raidClient.clientCore.uiController.switchView.bind(
        window.raidClient.clientCore.uiController
      );

    // Enhanced switchView method
    window.raidClient.clientCore.uiController.switchView = function (viewName) {
      // Call original method
      originalSwitchView(viewName);

      // Enhanced view-specific logic
      const gameLog = document.getElementById('gameLogContainer');
      const spectatorList = document.getElementById('spectatorList');

      if (viewName === 'game') {
        // Show game-specific components
        if (gameLog) {
          gameLog.style.display = 'block';
          gameLog.classList.add('animate-slide-in-left');
        }
        if (spectatorList) {
          spectatorList.style.display = 'block';
          spectatorList.classList.add('animate-slide-in-right');
        }

        window.raidClient.gameLog.add('Entered game view', 'system');
      } else {
        // Hide game-specific components
        if (gameLog) gameLog.style.display = 'none';
        if (spectatorList) spectatorList.style.display = 'none';

        if (viewName === 'lobby') {
          window.raidClient.gameLog.add('Returned to lobby', 'system');
        }
      }
    };
  }

  console.log('✅ View switching enhancement complete');
}

/**
 * Handle URL parameters for auto-join and testing
 */
function handleURLParameters() {
  const urlParams = new URLSearchParams(window.location.search);

  // Check for debug mode
  if (urlParams.get('debug') === 'true') {
    console.log('🐞 Debug mode enabled via URL parameter');
    setTimeout(() => {
      if (window.raidClient.clientCore?.uiController) {
        window.raidClient.clientCore.uiController.toggleDebug(true);
      }
    }, 1000);
  }

  // Check for auto-clear logs
  if (urlParams.get('clearLogs') === 'true') {
    console.log('🧹 Auto-clearing logs via URL parameter');
    window.raidClient.gameLog.clear();
  }
}

/**
 * Setup error handling and recovery
 */
function setupErrorHandling() {
  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    window.raidClient.gameLog.add(
      `Global error: ${event.error?.message || 'Unknown error'}`,
      'error'
    );
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    window.raidClient.gameLog.add(
      `Promise rejection: ${event.reason?.message || 'Unknown error'}`,
      'error'
    );
  });
}

/**
 * Initialize when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM loaded, starting raid system initialization...');

  // Setup error handling first
  setupErrorHandling();

  // Initialize the raid system
  initializeRaidSystem();

  // Add initialization complete message
  setTimeout(() => {
    window.raidClient.gameLog.add('🚀 Raid system ready!', 'system');
  }, 500);
});

// Export for global access if needed
window.initializeRaidSystem = initializeRaidSystem;

/* ===================================================================
 * END OF FILE: client/js/raid-main.js
 *
 * Notes:
 *   - This is the main entry point for the raid system
 *   - Handles initialization, event listeners, and coordination
 *   - Provides enhanced error handling and logging
 *   - Maintains modular structure for easy extension
 *   - Can be easily integrated into larger applications
 * ===================================================================*/
