/**
 * Table Initialization Module
 * Coordinates initialization of all table-related components
 */
import { initializeBoardButtons } from './board-buttons.js';
import { initializeDocuments } from './documents.js';
import { initializeResizers } from './resizer.js';
import { initializeZoneButtons } from './zone-buttons.js';
import { initializeZones } from './zones.js';

/**
 * Initialize all table-related components
 * Uses try/catch for each component to prevent cascading failures
 */
export const initializeTable = () => {
  // Create an array of initialization functions and their names
  // This allows us to initialize each component independently
  const initializers = [
    { fn: initializeBoardButtons, name: 'Board buttons' },
    { fn: initializeDocuments, name: 'Documents' },
    { fn: initializeResizers, name: 'Resizers' },
    { fn: initializeZoneButtons, name: 'Zone buttons' },
    { fn: initializeZones, name: 'Zones' }
  ];
  
  // Initialize each component separately with error handling
  // This way, if one component fails, others can still initialize
  for (const { fn, name } of initializers) {
    try {
      fn();
      console.log(`${name} initialized successfully`);
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
      // Continue with other initializers despite errors
      // This allows partial functionality even when some components fail
    }
  }
};