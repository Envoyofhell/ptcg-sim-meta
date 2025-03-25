import { acceptAction } from '../../setup/general/accept-action.js';
import { refreshBoardImages } from '../../setup/sizing/refresh-board.js';

export function loadImportData() {
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get('key');
  if (key) {
    fetch(`/api/importData?key=${key}`)
      .then((response) => response.json())
      .then((importData) => {
        if (importData && importData.length > 0) {
          let actions = importData.filter((obj) => !('version' in obj));
          actions.forEach((data) => {
            acceptAction(data.user, data.action, data.parameters, true);
          });
          refreshBoardImages();
        }
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
      });
  }
}
