import {
  oppContainerDocument,
  selfContainerDocument,
  systemState,
} from '../../front-end.js';
import { processAction } from '../../setup/general/process-action.js';
import { getZone } from '../../setup/zones/get-zone.js';

export const updatemiscCounter = (
  user,
  zoneId,
  index,
  miscAmount,
  emit = true
) => {
  if (user === 'opp' && emit && systemState.isTwoPlayer) {
    processAction(user, emit, 'updatemiscCounter', [zoneId, index, miscAmount]);
    return;
  }

  const miscCounter = getZone(user, zoneId).array[index].image.miscCounter;
  if (miscCounter.textContent !== miscAmount) {
    miscCounter.textContent = miscAmount;
  }

  // Color logic
  let text = miscCounter.textContent.toUpperCase();
  switch (text) {
    case 'P':
      miscCounter.style.backgroundColor = 'green';
      miscCounter.style.color = 'white';
      break;
    case 'B':
      miscCounter.style.backgroundColor = 'red';
      miscCounter.style.color = 'white';
      break;
    case 'A':
      miscCounter.style.backgroundColor = 'blue';
      miscCounter.style.color = 'white';
      break;
    case 'PA':
      miscCounter.style.backgroundColor = 'yellow';
      miscCounter.style.color = 'black';
      break;
    case 'C':
      miscCounter.style.backgroundColor = 'purple';
      miscCounter.style.color = 'white';
      break;
    default:
      miscCounter.style.backgroundColor = 'white';
      miscCounter.style.color = 'black';
      break;
  }

  processAction(user, emit, 'updatemiscCounter', [zoneId, index, miscAmount]);
};

export const removemiscCounter = (user, zoneId, index, emit = true) => {
  if (user === 'opp' && emit && systemState.isTwoPlayer) {
    processAction(user, emit, 'removemiscCounter', [zoneId, index]);
    return;
  }

  const targetCard = getZone(user, zoneId).array[index];
  //make sure targetCard exists (it won't exist if it's already been removed)
  if (targetCard.image.miscCounter) {
    targetCard.image.miscCounter.removeEventListener(
      'input',
      targetCard.image.miscCounter.handleInput
    );
    targetCard.image.miscCounter.handleInput = null;
    targetCard.image.miscCounter.removeEventListener(
      'blur',
      targetCard.image.miscCounter.handleRemoveWrapper
    );
    targetCard.image.miscCounter.handleRemove = null;
    window.removeEventListener(
      'resize',
      targetCard.image.miscCounter.handleResize
    );
    targetCard.image.miscCounter.remove();
    targetCard.image.miscCounter = null;
  }

  processAction(user, emit, 'removemiscCounter', [zoneId, index]);
};

export const addmiscCounter = (
  user,
  zoneId,
  index,
  miscAmount,
  emit = true
) => {
  if (user === 'opp' && emit && systemState.isTwoPlayer) {
    processAction(user, emit, 'addmiscCounter', [zoneId, index, miscAmount]);
    return;
  }

  const zone = getZone(user, zoneId);
  const targetCard = zone.array[index];
  const targetRect = targetCard.image.getBoundingClientRect();
  const zoneElementRect = zone.element.getBoundingClientRect();

  let miscCounter = targetCard.image.miscCounter;
  if (miscCounter) {
    miscCounter.removeEventListener('input', miscCounter.handleInput);
    miscCounter.handleInput = null;
    miscCounter.removeEventListener('blur', miscCounter.handleRemoveWrapper);
    miscCounter.handleRemove = null;
    window.removeEventListener('resize', miscCounter.handleResize);
  } else {
    if (user === 'self') {
      miscCounter = selfContainerDocument.createElement('div');
      miscCounter.className =
        systemState.initiator === 'self' ? 'self-circle' : 'opp-circle';
    } else {
      miscCounter = oppContainerDocument.createElement('div');
      miscCounter.className =
        systemState.initiator === 'self' ? 'opp-circle' : 'self-circle';
    }
    miscCounter.contentEditable = 'true';
    miscCounter.textContent = miscAmount ? miscAmount : 'A';
  }

  // Changed positioning to left side of card, about halfway down
  miscCounter.style.display = 'inline-block';
  miscCounter.style.left = `${targetRect.left - zoneElementRect.left}px`;
  miscCounter.style.top = `${targetRect.top - zoneElementRect.top + targetRect.height / 2 + targetRect.height / 8}px`;
  zone.element.appendChild(miscCounter);

  if (targetCard.image.parentElement.classList.contains('full-view')) {
    miscCounter.style.display = 'none';
  }
  miscCounter.style.width = `${targetRect.width / 3}px`;
  miscCounter.style.height = `${targetRect.width / 3}px`;
  miscCounter.style.lineHeight = `${targetRect.width / 3}px`;
  miscCounter.style.fontSize = `${targetRect.width / 6}px`;
  miscCounter.style.zIndex = '1';

  // Apply initial color immediately
  let text = miscCounter.textContent.toUpperCase();
  switch (text) {
    case 'P':
      miscCounter.style.backgroundColor = 'green';
      miscCounter.style.color = 'white';
      break;
    case 'B':
      miscCounter.style.backgroundColor = 'red';
      miscCounter.style.color = 'white';
      break;
    case 'A':
      miscCounter.style.backgroundColor = 'blue';
      miscCounter.style.color = 'white';
      break;
    case 'PA':
      miscCounter.style.backgroundColor = 'yellow';
      miscCounter.style.color = 'black';
      break;
    case 'C':
      miscCounter.style.backgroundColor = 'purple';
      miscCounter.style.color = 'white';
      break;
    default:
      miscCounter.style.backgroundColor = 'white';
      miscCounter.style.color = 'black';
      break;
  }

  // Define event handlers
  const handleInput = (event) => {
    // Apply color immediately on input
    let text = miscCounter.textContent.toUpperCase();
    switch (text) {
      case 'P':
        miscCounter.style.backgroundColor = 'green';
        miscCounter.style.color = 'white';
        break;
      case 'B':
        miscCounter.style.backgroundColor = 'red';
        miscCounter.style.color = 'white';
        break;
      case 'A':
        miscCounter.style.backgroundColor = 'blue';
        miscCounter.style.color = 'white';
        break;
      case 'PA':
        miscCounter.style.backgroundColor = 'yellow';
        miscCounter.style.color = 'black';
        break;
      case 'C':
        miscCounter.style.backgroundColor = 'purple';
        miscCounter.style.color = 'white';
        break;
      default:
        miscCounter.style.backgroundColor = 'white';
        miscCounter.style.color = 'black';
        break;
    }
    // Also call the updatemiscCounter function for network synchronization
    updatemiscCounter(user, zoneId, index, miscCounter.textContent);
  };

  const handleResize = () => {
    addmiscCounter(user, zoneId, index, false, false);
  };

  const handleRemove = (fromBlurEvent = false) => {
    if (
      targetCard.image.miscCounter &&
      (targetCard.image.miscCounter.textContent.trim() === '' ||
        targetCard.image.miscCounter.textContent <= 0)
    ) {
      targetCard.image.miscCounter.removeEventListener(
        'input',
        targetCard.image.miscCounter.handleInput
      );
      targetCard.image.miscCounter.handleInput = null;
      targetCard.image.miscCounter.removeEventListener(
        'blur',
        targetCard.image.miscCounter.handleRemoveWrapper
      );
      targetCard.image.miscCounter.handleRemove = null;
      window.removeEventListener(
        'resize',
        targetCard.image.miscCounter.handleResize
      );
      targetCard.image.miscCounter.remove();
      targetCard.image.miscCounter = null;
      if (fromBlurEvent) {
        removemiscCounter(user, zoneId, index);
      }
    }
  };

  // Attach event listeners
  miscCounter.addEventListener('input', handleInput);
  miscCounter.handleInput = handleInput;

  miscCounter.handleRemoveWrapper = () => handleRemove(true);
  miscCounter.addEventListener('blur', miscCounter.handleRemoveWrapper);
  miscCounter.handleRemove = handleRemove;

  miscCounter.handleResize = handleResize;
  window.addEventListener('resize', handleResize);

  targetCard.image.miscCounter = miscCounter;

  processAction(user, emit, 'addmiscCounter', [zoneId, index, miscAmount]);
};
