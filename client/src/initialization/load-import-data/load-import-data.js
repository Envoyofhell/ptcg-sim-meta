import { acceptAction } from '../../setup/general/accept-action.js';
import { refreshBoardImages } from '../../setup/sizing/refresh-board.js';

export function loadImportData() {
  const importDataJSON = document.getElementById('importDataJSON').textContent;

  if (importDataJSON && importDataJSON.trim() !== '') {
    let importData;

    try {
      importData = JSON.parse(importDataJSON);
    } catch (error) {
      console.error("Failed to parse import data JSON:", error);
      // Display an error message to users or handle appropriately
      return; // Exit the function on JSON parse error
    }

    // Remove any objects containing version property
    const actions = importData.filter((obj) => !('version' in obj));

    // Process each action
    actions.forEach((data) => {
      acceptAction(data.user, data.action, data.parameters, true);
    });
    
    // Refresh board images
    refreshBoardImages();
  }
}
