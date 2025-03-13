/* eslint-disable no-undef */
import { preloadImage } from '../../setup/general/preload-image.js';
import { getZone } from '../../setup/zones/get-zone.js';

// Application version
export const version = '1.5.1';

// Socket connection
export const socket = io('https://ptcg-sim-meta.vercel.app/'); // Production URL
// Uncomment for local development
// export const socket = io('http://localhost:4000/');

// Function to initialize DOM elements safely
const getElement = (id) => {
  const element = document.getElementById(id);
  if (!element) console.warn(`${id} not found in the DOM.`);
  return element || {};
};

// Create and export DOM container references
export const selfContainerDocument = getElement('selfContainer'); // Ensure this ID exists in your HTML
export const oppContainerDocument = getElement('oppContainer'); // Ensure this ID also exists in your HTML

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
    return selfContainerDocument.classList.contains('self') ? 'self' : 'opp';
  },
  roomId: '',
  cardBackSrc: 'https://ptcg-sim-meta.vercel.app/src/assets/cardback.png',
  p1OppCardBackSrc: 'https://ptcg-sim-meta.vercel.app/src/assets/cardback.png',
  p2OppCardBackSrc: 'https://ptcg-sim-meta.vercel.app/src/assets/cardback.png',
};

// Preload images
const preloadImages = (imageUrls) => {
  imageUrls.forEach(preloadImage);
};

preloadImages([
  'https://ptcg-sim-meta.vercel.app/src/assets/cardback.png',
  // Add more images as needed
]);

// Background styling for the body
document.body.style.backgroundImage = `linear-gradient(rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0.75)), url('https://wallpapercave.com/wp/wp10484598.jpg')`;
document.body.style.backgroundPosition = '-200px 0';

// Selected card information
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
