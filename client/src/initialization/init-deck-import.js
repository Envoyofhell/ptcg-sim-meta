// filename: client/src/initialization/init-deck-import.js
/**
 * Initialize Enhanced Deck Import System
 * Purpose: Initialize the enhanced deck import and storage system for the PTCG Simulator
 * @author: [Your Name]
 * @created: April 28, 2025
 */

import { enhancedImportDecklist } from '../setup/deck-constructor/enhanced-import.js';
import { showEnhancedDeckSelection } from '../setup/deck-constructor/custom-deck-categories.js';
import { checkForUpdates, parseUpdateList, applyUpdates } from '../setup/deck-constructor/update-system.js';
import { showPopup } from '../setup/general/pop-up-message.js';

// Override the standard import function with our enhanced version
export const initDeckImport = () => {
  // Make enhanced functions globally available
  window.enhancedImportDecklist = enhancedImportDecklist;
  window.showEnhancedDeckSelection = showEnhancedDeckSelection;
  
  // Add custom buttons to UI
  addCustomButtons();
  
  // Check for updates
  setTimeout(checkForCardUpdates, 2000);
};

// Add custom buttons to the UI
const addCustomButtons = () => {
  const importButton = document.getElementById('importButton');
  const decklistsButton = document.getElementById('decklistsButton');
  
  if (!importButton || !decklistsButton) {
    // If buttons aren't loaded yet, try again later
    setTimeout(addCustomButtons, 500);
    return;
  }
  
  // Create parent container for buttons
  const importButtonsContainer = document.createElement('div');
  importButtonsContainer.id = 'importButtonsContainer';
  importButtonsContainer.className = 'import-buttons-container';
  
  // Style the container
  importButtonsContainer.style.display = 'flex';
  importButtonsContainer.style.gap = '8px';
  importButtonsContainer.style.marginBottom = '12px';
  
  // Move existing buttons to container
  const parentElement = importButton.parentElement;
  importButtonsContainer.appendChild(decklistsButton.cloneNode(true));
  importButtonsContainer.appendChild(importButton.cloneNode(true));
  
  // Remove original buttons
  decklistsButton.remove();
  importButton.remove();
  
  // Create "Browse Decks" button
  const browseButton = document.createElement('button');
  browseButton.id = 'browseDeckButton';
  browseButton.textContent = 'Browse Decks';
  browseButton.className = 'browse-deck-button';
  
  // Create "Check Updates" button
  const updateButton = document.createElement('button');
  updateButton.id = 'checkUpdatesButton';
  updateButton.textContent = 'Check Updates';
  updateButton.className = 'check-updates-button';
  
  // Add buttons to container
  importButtonsContainer.appendChild(browseButton);
  importButtonsContainer.appendChild(updateButton);
  
  // Add container to DOM
  parentElement.insertBefore(importButtonsContainer, parentElement.firstChild);
  
  // Add click handlers
  document.getElementById('browseDeckButton').addEventListener('click', () => {
    const user = document.getElementById('mainDeckImportInput').style.display !== 'none' ? 'self' : 'opp';
    showEnhancedDeckSelection(user);
  });
  
  document.getElementById('checkUpdatesButton').addEventListener('click', () => {
    manualCheckForUpdates();
  });
  
  // Add corresponding CSS
  const style = document.createElement('style');
  style.textContent = `
    .browse-deck-button, .check-updates-button {
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      background-color: #0078d7;
      color: white;
      border: none;
    }
    
    .browse-deck-button:hover, .check-updates-button:hover {
      background-color: #0062b1;
    }
    
    .dark-mode-1 .browse-deck-button, .dark-mode-1 .check-updates-button {
      background-color: #2995ff;
    }
    
    .dark-mode-1 .browse-deck-button:hover, .dark-mode-1 .check-updates-button:hover {
      background-color: #1d7dd7;
    }
    
    .import-buttons-container {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
  `;
  
  document.head.appendChild(style);
  
  // Update event listeners for cloned buttons
  document.getElementById('decklistsButton').addEventListener('click', () => {
    showDecklistsContextMenu();
  });
  
  document.getElementById('importButton').addEventListener('click', () => {
    const user = document.getElementById('mainDeckImportInput').style.display !== 'none' ? 'self' : 'opp';
    enhancedImportDecklist(user);
  });
};

// Check for card updates
const checkForCardUpdates = async () => {
  try {
    // Don't check for updates if less than 24 hours since last check
    const lastCheckTime = localStorage.getItem('lastUpdateCheck');
    const now = Date.now();
    
    if (lastCheckTime && now - parseInt(lastCheckTime) < 24 * 60 * 60 * 1000) {
      return;
    }
    
    // Save current check time
    localStorage.setItem('lastUpdateCheck', now.toString());
    
    const updateInfo = await checkForUpdates();
    
    if (updateInfo.hasUpdates) {
      // Show notification about updates
      const updateConfirm = confirm(`New card data update available (version ${updateInfo.latestVersion}). Would you like to download it now?`);
      
      if (updateConfirm) {
        const updateListInfo = await parseUpdateList(updateInfo.updateListUrl);
        await applyUpdates({
          date: updateInfo.latestVersion,
          files: updateListInfo.files
        });
      }
    }
  } catch (error) {
    console.error('Auto update check failed:', error);
    // Silent fail for automatic checks
  }
};

// Manual check for updates
const manualCheckForUpdates = async () => {
  try {
    showPopup('Checking for updates...');
    
    const updateInfo = await checkForUpdates();
    
    if (updateInfo.hasUpdates) {
      const updateConfirm = confirm(`New card data update available (version ${updateInfo.latestVersion}). Current version: ${updateInfo.currentVersion}. Would you like to download it now?`);
      
      if (updateConfirm) {
        const updateListInfo = await parseUpdateList(updateInfo.updateListUrl);
        await applyUpdates({
          date: updateInfo.latestVersion,
          files: updateListInfo.files
        });
      } else {
        showPopup('Update canceled.');
      }
    } else {
      showPopup('You have the latest version of card data.');
    }
  } catch (error) {
    console.error('Manual update check failed:', error);
    showPopup(`Update check failed: ${error.message}`);
  }
};

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDeckImport);
} else {
  initDeckImport();
}