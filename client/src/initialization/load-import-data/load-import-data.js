import { acceptAction } from '../../setup/general/accept-action.js';
import { refreshBoardImages } from '../../setup/sizing/refresh-board.js';

/**
 * Loads imported game state data from the DOM
 * This function is called during initialization to load saved game states
 */
export function loadImportData() {
  // Look for the import data element in the DOM
  const importDataElement = document.getElementById('importDataJSON');
  
  // If element doesn't exist or has no content, just return without error
  if (!importDataElement || !importDataElement.textContent || importDataElement.textContent.trim() === '') {
    console.log("No import data found, skipping import");
    return;
  }

  // Get the JSON string from the element
  const importDataJSON = importDataElement.textContent;

  try {
    // Parse the JSON data
    const importData = JSON.parse(importDataJSON);
    
    // Check if importData is an array before using filter
    if (!Array.isArray(importData)) {
      console.warn("Import data is not an array, skipping import");
      return;
    }

    // Remove any objects containing version property
    const actions = importData.filter((obj) => !('version' in obj));

    // Process each action
    actions.forEach((data) => {
      acceptAction(data.user, data.action, data.parameters, true);
    });
    
    // Refresh board images
    refreshBoardImages();
    
    console.log("Import data loaded successfully");
  } catch (error) {
    console.error("Failed to parse or process import data:", error);
  }
}