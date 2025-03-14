// resizer.js
const { 
  oppHandleMouseDown, 
  selfHandleMouseDown,
  oppContainerDocument 
} = require('../../front-end.js');

const initializeResizers = () => {
  const selfResizer = document.getElementById('selfResizer');
  selfResizer.addEventListener('mousedown', selfHandleMouseDown);

  const oppResizer = document.getElementById('oppResizer');
  oppResizer.addEventListener('mousedown', oppHandleMouseDown);
};

module.exports = { initializeResizers };