// resizer.js
import { 
  oppHandleMouseDown, 
  selfHandleMouseDown,
  oppContainerDocument, 
} from '../../../front-end.js';

export const initializeResizers = () => {
  const selfResizer = document.getElementById('selfResizer');
  selfResizer.addEventListener('mousedown', selfHandleMouseDown);

  const oppResizer = document.getElementById('oppResizer');
  oppResizer.addEventListener('mousedown', oppHandleMouseDown);
};