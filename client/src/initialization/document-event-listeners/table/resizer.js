import { 
  oppHandleMouseDown, 
  selfHandleMouseDown,
  oppContainerDocument 
} from '../../../../front-end.js';

console.log('Imported oppContainerDocument:', oppContainerDocument);
console.log('Imported oppHandleMouseDown:', oppHandleMouseDown);
console.log('Imported selfHandleMouseDown:', selfHandleMouseDown);

export const initializeResizers = () => {
  const selfResizer = document.getElementById('selfResizer');
  selfResizer.addEventListener('mousedown', selfHandleMouseDown);

  const oppResizer = document.getElementById('oppResizer');
  oppResizer.addEventListener('mousedown', oppHandleMouseDown);
};
