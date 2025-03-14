/**
 * Resizer Module for PTCG Simulator
 * Manages container resizing functionality with advanced positioning calculations
 * 
 * @module Resizer
 * @description Provides functionality for resizing game containers with complex card adjustment
 */

import { addAbilityCounter } from '../../actions/counters/ability-counter.js';
import { addDamageCounter } from '../../actions/counters/damage-counter.js';
import { addSpecialCondition } from '../../actions/counters/special-condition.js';
import { closeFullView } from '../../actions/general/close-popups.js';
import { getZone } from '../zones/get-zone.js';
import { adjustAlignment } from './adjust-alignment.js';

// Enhanced logging utility
const logger = {
  error: (message, details = {}) => {
    console.error(`[Resizer Error] ${message}`, details);
  },
  warn: (message, details = {}) => {
    console.warn(`[Resizer Warning] ${message}`, details);
  },
  info: (message, details = {}) => {
    console.info(`[Resizer Info] ${message}`, details);
  }
};

/**
 * Creates a resizer object with container references and resize handlers
 * @param {Object} params Configuration parameters
 * @param {HTMLElement} params.selfContainer Reference to self container
 * @param {HTMLElement} params.oppContainer Reference to opponent container
 * @param {HTMLElement} params.selfContainerDocument Document reference for self container
 * @param {HTMLElement} params.oppContainerDocument Document reference for opponent container
 * @param {Function} params.getInitiator Function that returns the current initiator
 * @returns {Object} Resizer object with mouse handlers
 */
export const createResizer = (params) => {
  // Destructure parameters with defaults
  const {
    selfContainer,
    oppContainer,
    selfContainerDocument,
    oppContainerDocument,
    getInitiator = () => false
  } = params || {};

  // Validate required parameters
  if (!selfContainer || !oppContainer) {
    logger.error('Container references are required');
    return null;
  }

  // Create the overlay div
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.left = 0;
  overlay.style.zIndex = 1000;

  // Get DOM element references
  const handElement = selfContainerDocument.getElementById('hand');
  const oppHandElement = oppContainerDocument.getElementById('hand');
  const boardButtonContainer = document.getElementById('boardButtonContainer');
  const stadiumElement = document.getElementById('stadium');
  const selfResizer = document.getElementById('selfResizer');
  const oppResizer = document.getElementById('oppResizer');

  /**
   * Adjust card positioning and scaling after resize
   * @param {string} user User identifier ('self' or 'opp')
   * @param {string} zoneId Zone identifier
   * @param {number} ratio Scaling ratio
   */
  const adjustCards = (user, zoneId, ratio) => {
    try {
      const zone = getZone(user, zoneId);
      zone.array.forEach((card) => {
        if (card.image.attached) {
          if (card.type === 'Pokémon') {
            const oldBottom = parseFloat(card.image.style.bottom);
            const newBottom = oldBottom * ratio;
            card.image.style.bottom = `${newBottom}px`;
          } else {
            const oldLeft = parseFloat(card.image.style.left);
            const newLeft = oldLeft * ratio;
            card.image.style.left = `${newLeft}px`;
          }
        } else {
          const baseWidth = parseFloat(card.image.clientWidth);
          const adjustment = parseFloat(card.image.clientWidth / 6);
          const newWidth = (baseWidth + card.image.energyLayer * adjustment) * ratio;
          card.image.parentElement.style.width = `${newWidth}px`;
        }
        
        const index = zone.array.findIndex((loopCard) => loopCard === card);
        
        // Update counters if present
        if (card.image.damageCounter) {
          addDamageCounter(user, zoneId, index, false, false);
        }
        if (card.image.specialCondition) {
          addSpecialCondition(user, zoneId, index, false);
        }
        if (card.image.abilityCounter) {
          addAbilityCounter(user, zoneId, index);
        }
      });
    } catch (error) {
      logger.error('Card adjustment failed', { error, user, zoneId });
    }
  };

  /**
   * Handler for self container resizing
   * @param {Event} e Mouse move event
   */
  const selfResize = (e) => {
    [handElement, oppHandElement].forEach(adjustAlignment);

    const oldSelfHeight = parseInt(selfContainer.offsetHeight);
    const oldOppHeight = parseInt(oppContainer.offsetHeight);
    const clientY = Math.max(
      0,
      Math.min(e.clientY, window.innerHeight + window.innerHeight * 0.01)
    );
    
    let newSelfHeight = ((window.innerHeight - clientY) / window.innerHeight) * 100 + 1;
    let newOppHeight = 100 - newSelfHeight;

    // Apply the new heights
    selfContainer.style.height = Math.max(1, newSelfHeight) + '%';

    // Apply the new bottom position
    selfResizer.style.bottom = 100 - (clientY / window.innerHeight) * 100 + '%';
    newSelfHeight = parseInt(selfContainer.offsetHeight);
    const selfRatio = newSelfHeight / oldSelfHeight;
    
    // Readjust the width of containers on the active/bench
    adjustCards('self', 'bench', selfRatio);
    adjustCards('self', 'active', selfRatio);

    let selfResizerBottom = parseInt(
      window.getComputedStyle(selfResizer).getPropertyValue('bottom')
    );
    let oppResizerBottom = parseInt(
      window.getComputedStyle(oppResizer).getPropertyValue('bottom')
    );

    oppResizer.style.bottom = oppResizer.style.bottom
      ? oppResizer.style.bottom
      : '51%';
    
    if (selfResizerBottom + selfResizer.offsetHeight > oppResizerBottom) {
      oppResizer.style.bottom = 100 + 2 - (clientY / window.innerHeight) * 100 + '%';
      oppContainer.style.height = Math.max(1, newOppHeight) + '%';
      oppContainer.style.bottom = 100 + 1 - (clientY / window.innerHeight) * 100 + '%';
      newOppHeight = parseInt(oppContainer.offsetHeight);
      const oppRatio = newOppHeight / oldOppHeight;
      adjustCards('opp', 'bench', oppRatio);
      adjustCards('opp', 'active', oppRatio);
    }
    
    stadiumElement.style.bottom =
      Math.min(
        84,
        (parseFloat(oppResizer.style.bottom) +
          parseFloat(selfResizer.style.bottom)) /
          2 -
          8
      ) + '%';
    
    boardButtonContainer.style.bottom =
      Math.min(
        90,
        (parseFloat(oppResizer.style.bottom) +
          parseFloat(selfResizer.style.bottom)) /
          2 -
          3
      ) + '%';
    
    oppResizer.style.height = '2%';
    if (parseFloat(oppResizer.style.bottom) > 100) {
      oppResizer.style.height = '6%';
    }
    
    selfResizer.style.height = '2%';
    if (parseFloat(selfResizer.style.bottom) < 0) {
      selfResizer.style.height = '6%';
    }
  };

  /**
   * Handler for opponent container resizing
   * @param {Event} e Mouse move event
   */
  const oppResize = (e) => {
    [handElement, oppHandElement].forEach(adjustAlignment);

    const oldSelfHeight = parseInt(selfContainer.offsetHeight);
    const oldOppHeight = parseInt(oppContainer.offsetHeight);

    const clientY = Math.max(
      -window.innerHeight * 0.01,
      Math.min(e.clientY, window.innerHeight)
    );
    
    let newSelfHeight = ((window.innerHeight - clientY) / window.innerHeight) * 100 - 1;
    let newOppHeight = 100 - newSelfHeight;

    oppResizer.style.bottom = 100 - (clientY / window.innerHeight) * 100 + '%';
    oppContainer.style.height = Math.max(1, newOppHeight) + '%';
    oppContainer.style.bottom = 100 - 1 - (clientY / window.innerHeight) * 100 + '%';
    newOppHeight = parseInt(oppContainer.offsetHeight);
    const oppRatio = newOppHeight / oldOppHeight;
    adjustCards('opp', 'bench', oppRatio);
    adjustCards('opp', 'active', oppRatio);

    let selfResizerBottom = parseInt(
      window.getComputedStyle(selfResizer).getPropertyValue('bottom')
    );
    let oppResizerBottom = parseInt(
      window.getComputedStyle(oppResizer).getPropertyValue('bottom')
    );

    selfResizer.style.bottom = selfResizer.style.bottom
      ? selfResizer.style.bottom
      : '49%';
    
    if (selfResizerBottom + selfResizer.offsetHeight > oppResizerBottom) {
      selfContainer.style.height = Math.max(1, newSelfHeight) + '%';
      selfResizer.style.bottom = 100 - 2 - (clientY / window.innerHeight) * 100 + '%';
      newSelfHeight = parseInt(selfContainer.offsetHeight);
      const selfRatio = newSelfHeight / oldSelfHeight;
      adjustCards('self', 'bench', selfRatio);
      adjustCards('self', 'active', selfRatio);
    }
    
    stadiumElement.style.bottom =
      Math.min(
        84,
        (parseFloat(oppResizer.style.bottom) +
          parseFloat(selfResizer.style.bottom)) /
          2 -
          8
      ) + '%';
    
    boardButtonContainer.style.bottom =
      Math.min(
        90,
        (parseFloat(oppResizer.style.bottom) +
          parseFloat(selfResizer.style.bottom)) /
          2 -
          3
      ) + '%';
    
    oppResizer.style.height = '2%';
    if (parseFloat(oppResizer.style.bottom) > 100) {
      oppResizer.style.height = '6%';
    }
    
    selfResizer.style.height = '2%';
    if (parseFloat(selfResizer.style.bottom) < 0) {
      selfResizer.style.height = '6%';
    }
  };

  /**
   * Handler for flipped self container resizing
   * @param {Event} e Mouse move event
   */
  const flippedSelfResize = (e) => {
    [handElement, oppHandElement].forEach(adjustAlignment);

    const oldSelfHeight = parseInt(selfContainer.offsetHeight);
    const oldOppHeight = parseInt(oppContainer.offsetHeight);

    const clientY = Math.max(1, Math.min(e.clientY, window.innerHeight - 1));
    let newOppHeight = ((window.innerHeight - clientY) / window.innerHeight) * 100;
    let newSelfHeight = 100 - newOppHeight;

    // Apply the new heights
    oppContainer.style.height = newOppHeight + '%';

    // Apply the new bottom position
    selfResizer.style.bottom = 100 - 1 - (clientY / window.innerHeight) * 100 + '%';
    newOppHeight = parseInt(oppContainer.offsetHeight);
    const oppRatio = newOppHeight / oldOppHeight;
    
    // Readjust the width of containers on the active/bench
    adjustCards('opp', 'bench', oppRatio);
    adjustCards('opp', 'active', oppRatio);

    let selfResizerBottom = parseInt(
      window.getComputedStyle(selfResizer).getPropertyValue('bottom')
    );
    let oppResizerBottom = parseInt(
      window.getComputedStyle(oppResizer).getPropertyValue('bottom')
    );

    oppResizer.style.bottom = oppResizer.style.bottom
      ? oppResizer.style.bottom
      : '51%';
    
    if (selfResizerBottom + selfResizer.offsetHeight > oppResizerBottom) {
      oppResizer.style.bottom = 100 + 1 - (clientY / window.innerHeight) * 100 + '%';
      selfContainer.style.height = newSelfHeight + '%';
      selfContainer.style.bottom = 100 - (clientY / window.innerHeight) * 100 + '%';
      newSelfHeight = parseInt(selfContainer.offsetHeight);
      const selfRatio = newSelfHeight / oldSelfHeight;
      adjustCards('self', 'bench', selfRatio);
      adjustCards('self', 'active', selfRatio);
    }
    
    stadiumElement.style.bottom =
      Math.min(
        84,
        (parseFloat(selfResizer.style.bottom) +
          parseFloat(oppResizer.style.bottom)) /
          2 -
          8
      ) + '%';
    
    boardButtonContainer.style.bottom =
      Math.min(
        90,
        (parseFloat(selfResizer.style.bottom) +
          parseFloat(oppResizer.style.bottom)) /
          2 -
          3
      ) + '%';
    
    oppResizer.style.height = '2%';
    if (parseFloat(oppResizer.style.bottom) > 100) {
      oppResizer.style.height = '5%';
    }
    
    selfResizer.style.height = '2%';
    if (parseFloat(selfResizer.style.bottom) < 0) {
      selfResizer.style.height = '6%';
    }
  };

  /**
   * Handler for flipped opponent container resizing
   * @param {Event} e Mouse move event
   */
  const flippedOppResize = (e) => {
    [handElement, oppHandElement].forEach(adjustAlignment);

    const oldSelfHeight = parseInt(selfContainer.offsetHeight);
    const oldOppHeight = parseInt(oppContainer.offsetHeight);

    const clientY = Math.max(1, Math.min(e.clientY, window.innerHeight - 1));
    let newOppHeight = ((window.innerHeight - clientY) / window.innerHeight) * 100;
    let newSelfHeight = 100 - newOppHeight;

    oppResizer.style.bottom = 100 + 1 - (clientY / window.innerHeight) * 100 + '%';
    selfContainer.style.height = newSelfHeight + '%';
    selfContainer.style.bottom = 100 - (clientY / window.innerHeight) * 100 + '%';
    newSelfHeight = parseInt(selfContainer.offsetHeight);
    const selfRatio = newSelfHeight / oldSelfHeight;
    adjustCards('self', 'bench', selfRatio);
    adjustCards('self', 'active', selfRatio);

    let selfResizerBottom = parseInt(
      window.getComputedStyle(selfResizer).getPropertyValue('bottom')
    );
    let oppResizerBottom = parseInt(
      window.getComputedStyle(oppResizer).getPropertyValue('bottom')
    );

    selfResizer.style.bottom = selfResizer.style.bottom
      ? selfResizer.style.bottom
      : '49%';
    
    if (selfResizerBottom + selfResizer.offsetHeight > oppResizerBottom) {
      oppContainer.style.height = newOppHeight + '%';
      selfResizer.style.bottom = 100 - 1 - (clientY / window.innerHeight) * 100 + '%';
      newOppHeight = parseInt(oppContainer.offsetHeight);
      const oppRatio = newOppHeight / oldOppHeight;
      adjustCards('opp', 'bench', oppRatio);
      adjustCards('opp', 'active', oppRatio);
    }
    
    stadiumElement.style.bottom =
      Math.min(
        84,
        (parseFloat(selfResizer.style.bottom) +
          parseFloat(oppResizer.style.bottom)) /
          2 -
          8
      ) + '%';
    
    boardButtonContainer.style.bottom =
      Math.min(
        90,
        (parseFloat(selfResizer.style.bottom) +
          parseFloat(oppResizer.style.bottom)) /
          2 -
          3
      ) + '%';
    
    oppResizer.style.height = '2%';
    if (parseFloat(oppResizer.style.bottom) > 100) {
      oppResizer.style.height = '5%';
    }
    
    selfResizer.style.height = '2%';
    if (parseFloat(selfResizer.style.bottom) < 0) {
      selfResizer.style.height = '6%';
    }
  };

  // Mouse down event handlers with corresponding stop functions
  const selfHandleMouseDown = (e) => {
    e.preventDefault();
    window.addEventListener('mousemove', selfResize);
    document.addEventListener('mouseup', stopSelfResize);
    document.body.appendChild(overlay);
    closeFullView(e);
    
    logger.info('Self resize started', { initiator: getInitiator() });
  };

  const oppHandleMouseDown = (e) => {
    e.preventDefault();
    window.addEventListener('mousemove', oppResize);
    document.addEventListener('mouseup', stopOppResize);
    document.body.appendChild(overlay);
    closeFullView(e);
    
    logger.info('Opponent resize started', { initiator: getInitiator() });
  };

  const flippedSelfHandleMouseDown = (e) => {
    e.preventDefault();
    window.addEventListener('mousemove', flippedSelfResize);
    document.addEventListener('mouseup', flippedStopSelfResize);
    document.body.appendChild(overlay);
    closeFullView(e);
    
    logger.info('Flipped self resize started', { initiator: getInitiator() });
  };

  const flippedOppHandleMouseDown = (e) => {
    e.preventDefault();
    window.addEventListener('mousemove', flippedOppResize);
    document.addEventListener('mouseup', flippedStopOppResize);
    document.body.appendChild(overlay);
    closeFullView(e);
    
    logger.info('Flipped opponent resize started', { initiator: getInitiator() });
  };

  // Stop resize handlers
  const stopSelfResize = () => {
    window.removeEventListener('mousemove', selfResize);
    document.removeEventListener('mouseup', stopSelfResize);
    document.body.removeChild(overlay);
    logger.info('Self resize completed');
  };

  const stopOppResize = () => {
    window.removeEventListener('mousemove', oppResize);
    document.removeEventListener('mouseup', stopOppResize);
    document.body.removeChild(overlay);
    logger.info('Opponent resize completed');
  };

  const flippedStopSelfResize = () => {
    window.removeEventListener('mousemove', flippedSelfResize);
    document.removeEventListener('mouseup', flippedStopSelfResize);
    document.body.removeChild(overlay);
    logger.info('Flipped self resize completed');
  };

  const flippedStopOppResize = () => {
    window.removeEventListener('mousemove', flippedOppResize);
    document.removeEventListener('mouseup', flippedStopOppResize);
    document.body.removeChild(overlay);
    logger.info('Flipped opponent resize completed');
  };

  // Return public API
  return {
    selfHandleMouseDown,
    oppHandleMouseDown,
    flippedSelfHandleMouseDown,
    flippedOppHandleMouseDown,
    
    // Function references for testing and debugging
    selfResize,
    oppResize,
    flippedSelfResize,
    flippedOppResize,
    stopSelfResize,
    stopOppResize,
    flippedStopSelfResize,
    flippedStopOppResize,
    adjustCards
  };
};

// Add global error handler for resize operations
window.addEventListener('error', (event) => {
  if (event.filename && event.filename.includes('resizer')) {
    logger.error('Unhandled resizer error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  }
});

// Export the main function
export default createResizer;