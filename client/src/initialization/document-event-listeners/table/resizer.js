// Project: PTCGO-Online
// File Created: 2023-10-01
// client\src\setup\spectator\handle-spectator-buttons.js
import {
  oppHandleMouseDown,
  selfHandleMouseDown,
} from '../../../setup/sizing/resizer.js';

export const initializeResizers = () => {
  const selfResizer = document.getElementById('selfResizer');
  selfResizer.addEventListener('mousedown', selfHandleMouseDown);

  const oppResizer = document.getElementById('oppResizer');
  oppResizer.addEventListener('mousedown', oppHandleMouseDown);
};
