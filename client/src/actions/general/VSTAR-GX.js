import {
  oppContainerDocument,
  selfContainerDocument,
  systemState,
} from '../../front-end.js';
import { appendMessage } from '../../setup/chatbox/append-message.js';
import { determineUsername } from '../../setup/general/determine-username.js';
import { processAction } from '../../setup/general/process-action.js';

export const VSTARGXFunction = (user, type, emit = true) => {
  console.log(
    `VSTARGXFunction called with user: ${user}, type: ${type}, emit: ${emit}`
  );

  if (user === 'opp' && emit && systemState.isTwoPlayer) {
    processAction(user, emit, 'VSTARGXFunction', [type]);
    return;
  }

  // Try to get buttons from main document first, then fallback to container documents
  const selfGXButton =
    document.getElementById('selfGXButton') ||
    selfContainerDocument.getElementById('GXButton');
  const selfVSTARButton =
    document.getElementById('selfVSTARButton') ||
    selfContainerDocument.getElementById('VSTARButton');
  const selfForteButton =
    document.getElementById('selfForteButton') ||
    selfContainerDocument.getElementById('ForteButton');
  const oppGXButton =
    document.getElementById('oppGXButton') ||
    oppContainerDocument.getElementById('GXButton');
  const oppForteButton =
    document.getElementById('oppForteButton') ||
    oppContainerDocument.getElementById('ForteButton');
  const oppVSTARButton =
    document.getElementById('oppVSTARButton') ||
    oppContainerDocument.getElementById('VSTARButton');

  let button;
  let allUserButtons;

  if (user === 'self') {
    allUserButtons = [selfGXButton, selfVSTARButton, selfForteButton];
    if (type === 'GX') {
      button = selfGXButton;
    } else if (type === 'VSTAR') {
      button = selfVSTARButton;
    } else if (type === 'Forte') {
      button = selfForteButton;
    }
  } else {
    allUserButtons = [oppGXButton, oppVSTARButton, oppForteButton];
    if (type === 'GX') {
      button = oppGXButton;
    } else if (type === 'VSTAR') {
      button = oppVSTARButton;
    } else if (type === 'Forte') {
      button = oppForteButton;
    }
  }

  if (button && button.classList.contains('used-special-move')) {
    // If clicking the same button that's already active, deactivate it
    console.log(`Deactivating ${type} button for ${user}`);
    button.classList.remove('used-special-move');
    const message = determineUsername(user) + ' reset their ' + type;
    appendMessage(user, message, 'player', false);
  } else if (button) {
    // Activate the clicked button (don't clear others - allow multiple to be active)
    console.log(`Activating ${type} button for ${user}`);
    button.classList.add('used-special-move');
    const message = determineUsername(user) + ' used their ' + type + '!';
    appendMessage(user, message, 'player', false);
  } else {
    console.log(`Button not found for ${user} ${type}`);
  }

  processAction(user, emit, 'VSTARGXFunction', [type]);
};
