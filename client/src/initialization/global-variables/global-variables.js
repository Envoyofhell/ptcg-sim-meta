/* eslint-disable no-undef */
import { preloadImage } from '../../setup/general/preload-image.js';
import { getZone } from '../../setup/zones/get-zone.js';

// Function to check for path duplication
const checkImportPath = (path) => {
  // Convert file URL to a pathname format
  const pathname = new URL(path).pathname;
  if (pathname.includes('/initialization/initialization')) {
    console.warn('Warning: You are trying to import from an invalid path that includes duplication.');
  }
};

// Only check in module environments
if (typeof import.meta !== 'undefined' && import.meta.url) {
  checkImportPath(import.meta.url);
}

// Application version
export const version = '1.5.1';

// Socket connection with improved configuration
export const socket = io('https://ptcg-sim-meta.onrender.com', {
  path: "/socket.io/",
  withCredentials: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket', 'polling'],
  autoConnect: true,
  forceNew: true
});

// Connection event handlers for better debugging
socket.on('connect', () => {
  console.log('Socket connected successfully with ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket disconnected:', reason);
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Socket reconnection attempt:', attemptNumber);
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Socket reconnected after attempts:', attemptNumber);
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Function to initialize DOM elements safely
const getElement = (id) => {
  const element = document.getElementById(id);
  if (!element) console.warn(`${id} not found in the DOM.`);
  return element || {};
};

// Get DOM container references
// These are direct DOM elements, not documents 
export const selfContainer = getElement('selfContainer');
export const oppContainer = getElement('oppContainer');

// Export references for backward compatibility
export const selfContainerDocument = selfContainer;
export const oppContainerDocument = oppContainer;

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
  cardBackSrc: '/src/assets/cardback.png',
  p1OppCardBackSrc: '/src/assets/cardback.png',
  p2OppCardBackSrc: '/src/assets/cardback.png',
};

// Preload images
const preloadImages = (imageUrls) => {
  imageUrls.forEach(preloadImage);
};

preloadImages([
  '/src/assets/cardback.png',
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