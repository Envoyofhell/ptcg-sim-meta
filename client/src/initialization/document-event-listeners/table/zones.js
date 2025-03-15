/**
 * Zones Initialization Module
 * Sets up drag and drop event handlers for all game zones
 */
import { dragLeave, dragOver, drop } from '../../../setup/image-logic/drag.js';

/**
 * Adds drag and drop event listeners to a zone element
 * @param {HTMLElement|null} zoneElement - The element to add listeners to
 */
const addZoneEventListeners = (zoneElement) => {
  // Skip if element doesn't exist
  if (!zoneElement) return;
  
  // Add drag and drop event listeners
  zoneElement.addEventListener('dragover', dragOver);
  zoneElement.addEventListener('dragleave', dragLeave);
  zoneElement.addEventListener('drop', drop);
};

/**
 * Initialize all zones with drag and drop event listeners
 * Handles both self and opponent containers
 */
export const initializeZones = () => {
  try {
    // List of all zone IDs that need drag-and-drop functionality
    const zoneIds = [
      'hand',
      'prizes',
      'active',
      'bench',
      'deck',
      'discard',
      'lostZone',
      'deckCover',
      'discardCover',
      'lostZoneCover',
      'board',
      'viewCards',
      'attachedCards',
    ];

    // Special handling for stadium which is outside containers
    const stadiumElement = document.getElementById('stadium');
    if (stadiumElement) {
      addZoneEventListeners(stadiumElement);
    } else {
      console.warn('Stadium element not found, drag and drop not initialized for stadium');
    }

    // Add listeners to elements in both containers
    for (const zoneId of zoneIds) {
      // Get elements from both containers
      const selfElement = document.querySelector(`#selfContainer #${zoneId}`);
      const oppElement = document.querySelector(`#oppContainer #${zoneId}`);
      
      // Add event listeners to each element (if it exists)
      addZoneEventListeners(selfElement);
      addZoneEventListeners(oppElement);
      
      // Log warnings for missing elements
      if (!selfElement) {
        console.warn(`Self ${zoneId} element not found, drag and drop not initialized`);
      }
      
      if (!oppElement) {
        console.warn(`Opponent ${zoneId} element not found, drag and drop not initialized`);
      }
    }
    
    console.log('Zone drag-and-drop handlers initialized successfully');
  } catch (error) {
    console.error('Failed to initialize zone event listeners:', error);
  }
};