/* eslint-disable no-undef */
import { preloadImage } from '../../setup/general/preload-image.js';
import { getZone } from '../../setup/zones/get-zone.js';

export const version = '1.5.1';

// Define server URL based on environment or hostname
let socketUrl;
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  socketUrl = 'http://localhost:4000';
} else if (window.location.hostname === 'ptcg-sim-meta-dev.pages.dev') {
  socketUrl = 'https://ptcg-sim-meta-dev.jasonh1993.workers.dev';
} else if (window.location.hostname === 'ptcg-sim-meta.pages.dev') {
  socketUrl = 'https://ptcg-sim-meta.jasonh1993.workers.dev';
} else {
  // Fallback to production
  socketUrl = 'https://ptcg-sim-meta.jasonh1993.workers.dev';
}

// Create the socket connection
export const socket = io(socketUrl);

// export references to HTML elements 'selfContainer' and 'oppContainer', and their respective content window documents for ease of access to the iframes
export const selfContainer = document.getElementById('selfContainer');
export const selfContainerDocument = selfContainer.contentWindow.document;
export const oppContainer = document.getElementById('oppContainer');
export const oppContainerDocument = oppContainer.contentWindow.document;

// create globally accessible variable systemState, which holds information relevant to the state of the user's game
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
  isReplay: false, // should be treated as false no matter what if isTwoPlayer is true
  replayActionData: [],
  turn: 0,
  get initiator() {
    return selfContainer.classList.contains('self') ? 'self' : 'opp';
    //refers to the user on the bottom half of the screen, e.g., initiator === 'self' means that the bottom half is the 'self' user
  },
  roomId: '',
  p1Username: (user) => {
    return user === 'self' ? 'Blue' : 'Red';
  },
  p2SelfUsername: '',
  p2OppUsername: '',
  spectatorUsername: '',
  selfDeckData: '',
  p1OppDeckData: '', // refers to the opponent's data in 1 player mode, i.e., the "alt" deck data
  p2OppDeckData: '', // refers to the opponent's data in 2 player mode, i.e., the other player's deck data
  cardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
  p1OppCardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
  p2OppCardBackSrc: 'https://ptcg-sim-meta.pages.dev/src/assets/ccb.png',
};

// preload image
preloadImage('https://ptcgsim.online/src/assets/ccb.png');

document.body.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), url('https://static0.gamerantimages.com/wordpress/wp-content/uploads/wm/2025/03/pokemon-legends-z-a-totodile-with-lumiose-bg.jpg')`;
document.body.style.backgroundPosition = '-200px 0';

// create global variable that holds the information of a selected card, i.e., the card that has been clicked and highlighted and can trigger keybinds
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