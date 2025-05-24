// Project: PTCGO-Online
// File Created: 2023-10-01
// client\src\setup\spectator\handle-spectator-buttons.js
export const hideOptionsContextMenu = (event) => {
  const optionsContextMenu = document.getElementById('optionsContextMenu');
  if (!optionsContextMenu.contains(event.target)) {
    optionsContextMenu.style.display = 'none';
    document.removeEventListener('mousedown', hideOptionsContextMenu);
  }
};
