/* eslint-disable no-undef */
import { preloadImage } from '../../setup/general/preload-image.js';
import { getZone } from '../../setup/zones/get-zone.js';

// Application version
export const version = '1.5.1';

// Exports a WebSocket connection using the Socket.IO library, loaded via CDN in index.ejs
export const socket = io('https://ptcg-sim-meta.vercel.app/'); // Vercel production URL
// Uncomment for local development
// export const socket = io('http://localhost:4000/');

// Export references to HTML elements 'selfContainer' and 'oppContainer', ensuring they are defined
export const selfContainer = document.getElementById('selfContainer') || {};
export const selfContainerDocument = selfContainer.contentWindow ? selfContainer.contentWindow.document : {};
export const oppContainer = document.getElementById('oppContainer') || {};
export const oppContainerDocument = oppContainer.contentWindow ? oppContainer.contentWindow.document : {};

// Create globally accessible variable systemState, which holds information relevant to the state of the user's game
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
  isReplay: false, // Should be treated as false if isTwoPlayer is true
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
  p1OppDeckData: '', // Opponent's data in 1-player mode
  p2OppDeckData: '', // Opponent's data in 2-player mode
  cardBackSrc: 'https://ptcg-sim-meta.vercel.app/src/assets/cardback.png', // Updated to Vercel URL
  p1OppCardBackSrc: 'https://ptcg-sim-meta.vercel.app/src/assets/cardback.png', // Updated to Vercel URL
  p2OppCardBackSrc: 'https://ptcg-sim-meta.vercel.app/src/assets/cardback.png', // Updated to Vercel URL
};

// Preload image
preloadImage('https://ptcg-sim-meta.vercel.app/src/assets/cardback.png'); // Updated to Vercel URL

// Background styling for the body
document.body.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), url('https://wallpapercave.com/wp/wp10484598.jpg')`;
document.body.style.backgroundPosition = '-200px 0';

// Create global variable that holds the information of a selected card, i.e., the card that has been clicked and highlighted and can trigger keybinds
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
