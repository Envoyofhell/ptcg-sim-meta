/**
 * Zone Buttons Initialization
 * Sets up event listeners for various zone-related buttons in both player containers
 */
import {
  closeDisplay,
  discardAll,
  handAll,
  leaveAll,
  lostZoneAll,
  shuffleAll,
  shuffleBottom,
  sort,
} from '../../../actions/zones/general.js';
import { systemState } from '../../../front-end.js';

/**
 * Initialize all zone buttons with event listeners
 * Uses querySelector instead of getElementById for proper container targeting
 */
export const initializeZoneButtons = () => {
  try {
    // Helper function to safely get an element and add event listener
    const addListener = (containerSelector, elementId, event, handler) => {
      const element = document.querySelector(`${containerSelector} #${elementId}`);
      if (element) {
        element.addEventListener(event, handler);
      } else {
        console.warn(`Element not found: ${containerSelector} #${elementId}`);
      }
    };

    // ==========================================
    // Self Container Buttons
    // ==========================================
    
    // Deck buttons
    addListener('#selfContainer', 'shuffleDeckButton', 'click', () =>
      shuffleAll('self', systemState.initiator, 'deck')
    );

    // Discard buttons
    addListener('#selfContainer', 'shuffleDiscardButton', 'click', () => {
      if (confirm('Are you sure you want to shuffle all cards into the deck?')) {
        shuffleAll('self', systemState.initiator, 'discard');
      }
    });

    // Attached Cards buttons
    addListener('#selfContainer', 'discardAttachedCardsButton', 'click', () =>
      discardAll('self', systemState.initiator, 'attachedCards')
    );

    addListener('#selfContainer', 'shuffleAttachedCardsButton', 'click', () =>
      shuffleAll('self', systemState.initiator, 'attachedCards')
    );

    addListener('#selfContainer', 'lostZoneAttachedCardsButton', 'click', () =>
      lostZoneAll('self', systemState.initiator, 'attachedCards')
    );

    addListener('#selfContainer', 'handAttachedCardsButton', 'click', () =>
      handAll('self', systemState.initiator, 'attachedCards')
    );

    addListener('#selfContainer', 'leaveAttachedCardsButton', 'click', () =>
      leaveAll('self', systemState.initiator, 'attachedCards')
    );

    // View Cards buttons
    addListener('#selfContainer', 'discardViewCardsButton', 'click', () =>
      discardAll('self', systemState.initiator, 'viewCards')
    );

    addListener('#selfContainer', 'shuffleViewCardsButton', 'click', () =>
      shuffleAll('self', systemState.initiator, 'viewCards')
    );

    addListener('#selfContainer', 'shuffleBottomViewCardsButton', 'click', () =>
      shuffleBottom('self', systemState.initiator, 'viewCards')
    );

    addListener('#selfContainer', 'lostZoneViewCardsButton', 'click', () =>
      lostZoneAll('self', systemState.initiator, 'viewCards')
    );

    addListener('#selfContainer', 'handViewCardsButton', 'click', () =>
      handAll('self', systemState.initiator, 'viewCards')
    );

    // Close buttons
    addListener('#selfContainer', 'closeDeckButton', 'click', () =>
      closeDisplay('self', 'deck')
    );

    addListener('#selfContainer', 'closeDiscardButton', 'click', () =>
      closeDisplay('self', 'discard')
    );

    addListener('#selfContainer', 'closeLostZoneButton', 'click', () =>
      closeDisplay('self', 'lostZone')
    );

    // Sort checkboxes
    addListener('#selfContainer', 'sortHandCheckbox', 'change', () => 
      sort('self', 'hand')
    );

    addListener('#selfContainer', 'sortDeckCheckbox', 'change', () => 
      sort('self', 'deck')
    );

    addListener('#selfContainer', 'sortDiscardCheckbox', 'change', () =>
      sort('self', 'discard')
    );

    addListener('#selfContainer', 'sortLostZoneCheckbox', 'change', () =>
      sort('self', 'lostZone')
    );

    // ==========================================
    // Opponent Container Buttons
    // ==========================================
    
    // Deck buttons
    addListener('#oppContainer', 'shuffleDeckButton', 'click', () =>
      shuffleAll('opp', systemState.initiator, 'deck')
    );

    // Discard buttons
    addListener('#oppContainer', 'shuffleDiscardButton', 'click', () => {
      if (confirm('Are you sure you want to shuffle all cards into the deck?')) {
        shuffleAll('opp', systemState.initiator, 'discard');
      }
    });

    // Attached Cards buttons
    addListener('#oppContainer', 'discardAttachedCardsButton', 'click', () =>
      discardAll('opp', systemState.initiator, 'attachedCards')
    );

    addListener('#oppContainer', 'shuffleAttachedCardsButton', 'click', () =>
      shuffleAll('opp', systemState.initiator, 'attachedCards')
    );

    addListener('#oppContainer', 'lostZoneAttachedCardsButton', 'click', () =>
      lostZoneAll('opp', systemState.initiator, 'attachedCards')
    );

    addListener('#oppContainer', 'handAttachedCardsButton', 'click', () =>
      handAll('opp', systemState.initiator, 'attachedCards')
    );

    addListener('#oppContainer', 'leaveAttachedCardsButton', 'click', () =>
      leaveAll('opp', systemState.initiator, 'attachedCards')
    );

    // View Cards buttons
    addListener('#oppContainer', 'discardViewCardsButton', 'click', () =>
      discardAll('opp', systemState.initiator, 'viewCards')
    );

    addListener('#oppContainer', 'shuffleViewCardsButton', 'click', () =>
      shuffleAll('opp', systemState.initiator, 'viewCards')
    );

    addListener('#oppContainer', 'shuffleBottomViewCardsButton', 'click', () =>
      shuffleBottom('opp', systemState.initiator, 'viewCards')
    );

    addListener('#oppContainer', 'lostZoneViewCardsButton', 'click', () =>
      lostZoneAll('opp', systemState.initiator, 'viewCards')
    );

    addListener('#oppContainer', 'handViewCardsButton', 'click', () =>
      handAll('opp', systemState.initiator, 'viewCards')
    );

    // Close buttons
    addListener('#oppContainer', 'closeDeckButton', 'click', () =>
      closeDisplay('opp', 'deck')
    );

    addListener('#oppContainer', 'closeDiscardButton', 'click', () =>
      closeDisplay('opp', 'discard')
    );

    addListener('#oppContainer', 'closeLostZoneButton', 'click', () =>
      closeDisplay('opp', 'lostZone')
    );

    // Sort checkboxes
    addListener('#oppContainer', 'sortHandCheckbox', 'change', () => 
      sort('opp', 'hand')
    );

    addListener('#oppContainer', 'sortDeckCheckbox', 'change', () => 
      sort('opp', 'deck')
    );

    addListener('#oppContainer', 'sortDiscardCheckbox', 'change', () =>
      sort('opp', 'discard')
    );

    addListener('#oppContainer', 'sortLostZoneCheckbox', 'change', () =>
      sort('opp', 'lostZone')
    );
    
    console.log('Zone buttons initialized successfully');
  } catch (error) {
    console.error('Error initializing zone buttons:', error);
  }
};