// filename: client/src/setup/deck-constructor/deck-manager.js
/**
 * Deck Manager
 * Purpose: Main integration point for enhanced deck import and management
 * @author: [Your Name]
 * @created: April 28, 2025
 */

import { enhancedImportDecklist, saveToCloudflare, loadFromCloudflare } from './enhanced-import.js';
import { showEnhancedDeckSelection } from './custom-deck-categories.js';
import { checkForUpdates, parseUpdateList, applyUpdates } from './update-system.js';
import { showPopup } from '../general/pop-up-message.js';
import { systemState } from '../../front-end.js';

// Initialize deck manager
export const initializeDeckManager = () => {
  // Replace standard deck import with enhanced version
  window.enhancedImportDecklist = enhancedImportDecklist;
  
  // Add deck selection button and update check button to the UI
  addManagerButtons();
  
  // Check for updates on startup
  setTimeout(automaticUpdateCheck, 2000);
};

// Add deck manager buttons to the UI
const addManagerButtons = () => {
  const importButton = document.getElementById('importButton');
  const decklistsButton = document.getElementById('decklistsButton');
  
  if (importButton && decklistsButton) {
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
    
    // Add click handlers
    browseButton.addEventListener('click', () => {
      const user = document.getElementById('mainDeckImportInput').style.display !== 'none' ? 'self' : 'opp';
      showEnhancedDeckSelection(user);
    });
    
    updateButton.addEventListener('click', manualUpdateCheck);
    
    // Insert buttons into DOM
    const parentElement = decklistsButton.parentElement;
    parentElement.insertBefore(browseButton, decklistsButton.nextSibling);
    parentElement.insertBefore(updateButton, decklistsButton.nextSibling);
    
    // Add corresponding CSS
    const style = document.createElement('style');
    style.textContent = `
      .browse-deck-button, .check-updates-button {
        display: inline-block;
        padding: 8px 12px;
        margin-left: 8px;
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
    `;
    
    document.head.appendChild(style);
  }
};

// Automatic update check
const automaticUpdateCheck = async () => {
  // Don't check for updates if less than 24 hours since last check
  const lastCheckTime = localStorage.getItem('lastUpdateCheck');
  const now = Date.now();
  
  if (lastCheckTime && now - parseInt(lastCheckTime) < 24 * 60 * 60 * 1000) {
    return;
  }
  
  // Save current check time
  localStorage.setItem('lastUpdateCheck', now.toString());
  
  try {
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

// Manual update check
const manualUpdateCheck = async () => {
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

// Add option to save current deck to database
export const saveCurrentDeck = async (user, deckName, category, format) => {
  try {
    // Get deck data from current deck table
    const deckData = [];
    
    const tableId = user === 'self' ? 'selfCurrentDecklistTable' : 'oppCurrentDecklistTable';
    const table = document.getElementById(tableId);
    
    if (!table) {
      throw new Error('No current deck found.');
    }
    
    const rows = table.rows;
    
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].cells;
      
      if (cells.length < 4) continue;
      
      const quantity = parseInt(cells[0].innerText) || 1;
      const name = cells[1].innerText;
      const type = cells[2].querySelector('select')?.value || 'Unknown';
      const imageUrl = cells[3].innerText;
      
      deckData.push({
        quantity,
        name,
        type,
        imageUrl
      });
    }
    
    if (deckData.length === 0) {
      throw new Error('No cards found in current deck.');
    }
    
    // Save to Cloudflare database
    await saveToCloudflare(
      deckName || 'My Deck',
      deckData,
      category || 'My Saved Decks',
      format || 'Standard'
    );
    
    showPopup('Deck saved successfully!');
    
    return true;
  } catch (error) {
    console.error('Error saving deck:', error);
    showPopup(`Error saving deck: ${error.message}`);
    
    return false;
  }
};

// Initialize the deck manager when the page loads
document.addEventListener('DOMContentLoaded', initializeDeckManager);