// client/src/initialization/global-variables/global-variables.js
import { preloadImage } from '../../setup/general/preload-image.js';
import { getZone } from '../../setup/zones/get-zone.js';
import { socket } from '../../websocket-client.js'; // Import WebSocket client

export const version = '1.5.1';

// export references to HTML elements
export const selfContainer = document.getElementById('selfContainer');
export const selfContainerDocument = selfContainer.contentWindow.document;
export const oppContainer = document.getElementById('oppContainer');
export const oppContainerDocument = oppContainer.contentWindow.document;

// create globally accessible variable systemState
export const systemState = {
  coachingMode: false,
  isUndoInProgress: false,
  selfCounter: 0,
  selfActionData: [],
  oppActionData: [],
  spectatorCounter: 0,
  exportActionData: [],
  spectatorId: '',
  oppCounter: 0,
  isTwoPlayer: false,
  isReplay: false,
  replayActionData: [],
  turn: 0,
  get initiator() {
    return selfContainer.classList.contains('self') ? 'self' : 'opp';
  },
  roomId: '',
  p1Username: (user) => {
    return user === 'self' ? 'Blue' : 'Red';
  },
  p2SelfUsername: '',
  p2OppUsername: '',
  spectatorUsername: '',
  selfDeckData: '',
  p1OppDeckData: '',
  p2OppDeckData: '',
  // Use dynamic URLs based on current domain instead of hardcoded URLs
  get cardBackSrc() {
    return `${window.location.protocol}//${window.location.host}/src/assets/ccb.png`;
  },
  get p1OppCardBackSrc() {
    return `${window.location.protocol}//${window.location.host}/src/assets/ccb.png`;
  },
  get p2OppCardBackSrc() {
    return `${window.location.protocol}//${window.location.host}/src/assets/ccb.png`;
  },
};

// Export socket for use throughout the application
export { socket };

// Update preload image URL to use dynamic URL instead of hardcoded domain
preloadImage(`${window.location.protocol}//${window.location.host}/src/assets/ccb.png`);

// Set background image with dynamic URL
document.body.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), url('${window.location.protocol}//${window.location.host}/src/assets/background1.jpg')`;
document.body.style.backgroundPosition = '-200px 0';

// create global variable that holds the information of a selected card
export const mouseClick = {
  cardIndex: '',
  zoneId: '',
  cardUser: '',
  playContainer: '',
  playContainerParent: '',
  selectingCard: false,
  isActiveZone: '',
  get card() {
    if (this.zoneId) {
      return getZone(this.cardUser, this.zoneId).array[this.cardIndex];
    }
    return null;
  },
};