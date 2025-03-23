// File: client/src/initialization/document-event-listeners/sidebox/p2/room-buttons.js
/**
 * Room Buttons Initialization
 * 
 * Handles all functionality related to multiplayer room management including:
 * - Room ID generation and copying
 * - Joining and leaving rooms
 * - Username assignment
 * - Error handling and offline fallbacks
 */
import { reset } from '../../../../actions/general/reset.js';
import { socket, systemState, safeSocketEmit } from '../../../../front-end.js';
import { cleanActionData } from '../../../../setup/general/clean-action-data.js';
import { processAction } from '../../../../setup/general/process-action.js';
import { appendMessage } from '../../../../setup/chatbox/append-message.js';
import { handleSpectatorButtons } from '../../../../setup/spectator/handle-spectator-buttons.js';
import { removeSyncIntervals } from '../../../socket-event-listeners/socket-event-listeners.js';

export const initializeRoomButtons = () => {
  // Get DOM elements
  const roomIdInput = document.getElementById('roomIdInput');
  const copyButton = document.getElementById('copyButton');
  const roomHeaderCopyButton = document.getElementById('roomHeaderCopyButton');
  const generateIdButton = document.getElementById('generateIdButton');
  const joinRoomButton = document.getElementById('joinRoomButton');
  const leaveRoomButton = document.getElementById('leaveRoomButton');
  const nameInput = document.getElementById('nameInput');
  
  /**
   * Copy Room ID to clipboard
   * Provides visual feedback with a brief CSS animation
   */
  copyButton.addEventListener('click', () => {
    // Copy the value to clipboard
    navigator.clipboard.writeText(roomIdInput.value)
      .then(() => {
        // Visual feedback
        copyButton.classList.add('copied');
        setTimeout(() => {
          copyButton.classList.remove('copied');
        }, 1000);
      })
      .catch(error => {
        console.error('Failed to copy text: ', error);
        // Fallback for older browsers
        const tempInput = document.createElement('input');
        tempInput.value = roomIdInput.value;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        copyButton.classList.add('copied');
        setTimeout(() => {
          copyButton.classList.remove('copied');
        }, 1000);
      });
  });

  /**
   * Copy Room ID from the room header
   * Used when already in a room
   */
  roomHeaderCopyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(systemState.roomId || roomIdInput.value).then(() => {
      roomHeaderCopyButton.classList.add('copied');
      setTimeout(() => {
        roomHeaderCopyButton.classList.remove('copied');
      }, 1000);
    });
  });

  /**
   * Generate a unique Room ID
   * Uses socket ID with a fallback for offline mode
   */
  generateIdButton.addEventListener('click', () => {
    // Safe access to socket.id with fallback for offline mode
    let roomId;
    
    if (socket && socket.connected && socket.id) {
      // Use socket ID as the base for the room ID
      roomId = socket.id.toString() + '0';
    } else {
      // Fallback for offline mode: generate a random ID
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      roomId = `offline-${timestamp}-${random}`;
    }
    
    roomIdInput.value = roomId;
  });

  /**
   * Join a room with the specified ID and username
   * Handles both online and offline modes
   */
  joinRoomButton.addEventListener('click', () => {
    // Comprehensive list of Pokémon trainer names from across the games
    const trainerNames = [
      // Kanto
      'Red', 'Blue', 'Leaf', 'Oak', 'Misty', 'Brock', 'Lt. Surge', 'Erika', 
      'Koga', 'Sabrina', 'Blaine', 'Giovanni', 'Lorelei', 'Bruno', 'Agatha', 'Lance',
      
      // Johto
      'Gold', 'Silver', 'Crystal', 'Lyra', 'Ethan', 'Kris', 'Falkner', 'Bugsy',
      'Whitney', 'Morty', 'Jasmine', 'Chuck', 'Pryce', 'Clair', 'Will', 'Karen',
      
      // Hoenn
      'Brendan', 'May', 'Wally', 'Roxanne', 'Brawly', 'Wattson', 'Flannery',
      'Norman', 'Winona', 'Tate', 'Liza', 'Wallace', 'Steven', 'Sidney', 'Phoebe',
      'Drake', 'Glacia', 'Juan', 'Maxie', 'Archie',
      
      // Sinnoh
      'Dawn', 'Lucas', 'Barry', 'Roark', 'Gardenia', 'Fantina', 'Maylene', 
      'Crasher Wake', 'Byron', 'Candice', 'Volkner', 'Cynthia', 'Aaron', 'Bertha',
      'Flint', 'Lucian', 'Cyrus', 'Saturn', 'Mars', 'Jupiter',
      
      // Unova
      'Hilbert', 'Hilda', 'Nate', 'Rosa', 'Cheren', 'Bianca', 'Cilan', 'Chili',
      'Cress', 'Lenora', 'Burgh', 'Elesa', 'Clay', 'Skyla', 'Brycen', 'Drayden',
      'Iris', 'Shauntal', 'Marshal', 'Grimsley', 'Caitlin', 'Alder', 'N', 'Ghetsis',
      
      // Kalos
      'Serena', 'Calem', 'Shauna', 'Trevor', 'Tierno', 'Viola', 'Grant', 'Korrina',
      'Ramos', 'Clemont', 'Valerie', 'Olympia', 'Wulfric', 'Malva', 'Siebold',
      'Wikstrom', 'Drasna', 'Diantha', 'Lysandre', 'AZ',
      
      // Alola
      'Elio', 'Selene', 'Hau', 'Ilima', 'Lana', 'Kiawe', 'Mallow', 'Sophocles',
      'Acerola', 'Mina', 'Hala', 'Olivia', 'Nanu', 'Hapu', 'Molayne', 'Kahili',
      'Kukui', 'Hala', 'Lusamine', 'Guzma', 'Plumeria',
      
      // Galar
      'Victor', 'Gloria', 'Hop', 'Marnie', 'Bede', 'Milo', 'Nessa', 'Kabu',
      'Bea', 'Allister', 'Opal', 'Gordie', 'Melony', 'Piers', 'Raihan', 'Leon',
      'Rose', 'Sonia', 'Oleana',
      
      // Paldea
      'Florian', 'Juliana', 'Nemona', 'Penny', 'Arven', 'Katy', 'Kofu', 'Iono',
      'Larry', 'Brassius', 'Tulip', 'Grusha', 'Ryme', 'Geeta', 'Clavell', 'Turo',
      'Sada', 'Crispin', 'Dulce', 'Eri', 'Ortega', 'Giacomo', 'Hassel', 'Atticus',
      
      // Card Game Characters
      'Avery', 'Peonia', 'Thorton', 'Cyllene', 'Judge', 'Boss', 'Volo', 'Hex',
      'Irida', 'Juniper', 'Sycamore', 'Adaman', 'Palina', 'Klara', 'Avery',
      'Peony', 'Dexio', 'Sina', 'Colress', 'Xerosic', 'Bridgette'
    ];
    
    // Choose random name with fallback if input is empty
    const randomIndex = Math.floor(Math.random() * trainerNames.length);
    systemState.p2SelfUsername = 
      nameInput.value.trim() !== '' ? nameInput.value : trainerNames[randomIndex];
    
    // Store room ID
    systemState.roomId = roomIdInput.value;
    
    // Check if socket is connected before attempting to join
    if (socket && socket.connected) {
      // Online mode - use Socket.IO
      safeSocketEmit(
        'joinGame',
        systemState.roomId,
        systemState.p2SelfUsername,
        document.getElementById('spectatorModeCheckbox').checked
      );
    } else {
      // Offline mode - display message and simulate local response
      console.log('[Socket-Offline] Join room attempted in offline mode');
      
      // Show message in the chatbox
      const chatbox = document.getElementById('p2Chatbox') || document.getElementById('chatbox');
      if (chatbox) {
        chatbox.innerHTML += `
          <div style="background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px; margin: 10px 0;">
            <strong>Unable to Join Room</strong><br>
            Multiplayer is unavailable. You can still play in single-player mode.
          </div>
        `;
      }
      
      // Toggle back to P1 mode automatically
      const p1Button = document.getElementById('p1Button');
      if (p1Button && typeof p1Button.click === 'function') {
        p1Button.click();
      }
    }
  });

  /**
   * Leave the current room
   * Handles cleanup and state reset
   */
  leaveRoomButton.addEventListener('click', () => {
    if (window.confirm('Are you sure you want to leave the room? Current game state will be lost.')) {
      try {
        const isSpectator =
          systemState.isTwoPlayer &&
          document.getElementById('spectatorModeCheckbox').checked;
        
        const username = isSpectator
          ? systemState.spectatorUsername
          : systemState.p2SelfUsername;
        
        const data = {
          roomId: systemState.roomId,
          username: username,
          isSpectator:
            document.getElementById('spectatorModeCheckbox').checked &&
            systemState.isTwoPlayer,
        };
        
        // Safely emit leave room event
        safeSocketEmit('leaveRoom', data);
        
        // Update UI elements
        const connectedRoom = document.getElementById('connectedRoom');
        const lobby = document.getElementById('lobby');
        const p2ExplanationBox = document.getElementById('p2ExplanationBox');
        const p2Chatbox = document.getElementById('p2Chatbox');
        
        // Show/hide appropriate containers
        lobby.style.display = 'block';
        p2ExplanationBox.style.display = 'block';
        document.getElementById('importState').style.display = 'inline';
        document.getElementById('flipBoardButton').style.display = 'inline-block';
        connectedRoom.style.display = 'none';
        
        // Reset state
        systemState.isTwoPlayer = false;
        systemState.roomId = '';
        
        // Clean action data
        cleanActionData('self');
        cleanActionData('opp');
        reset('opp', true, true, false, true);

        // Preserve and restore deck data
        systemState.selfDeckData = '';
        let decklistTable = document.getElementById('selfCurrentDecklistTable');
        if (decklistTable) {
          try {
            let rows = decklistTable.rows;
            let deckData = [];
            
            for (let i = 1; i < rows.length; i++) {
              // Add safety checks before accessing properties
              if (rows[i] && rows[i].cells) {
                let cells = rows[i].cells;
                
                if (cells.length >= 4) {
                  let quantity = cells[0].innerText;
                  let name = cells[1].innerText;
                  
                  // Get type from select element with error handling
                  let typeElement = cells[2].querySelector('select');
                  let type = typeElement ? typeElement.value : 'Pokémon'; // Default to Pokémon if not found
                  
                  let url = cells[3].innerText;
                  
                  let cardData = [quantity, name, type, url];
                  deckData.push(cardData);
                }
              }
            }
            
            if (deckData.length > 0) {
              systemState.selfDeckData = deckData;
            }
          } catch (error) {
            console.error('Error processing deck data:', error);
          }
        }

        // Reset self player
        reset('self', true, true, false, true);
        
        // Clear chatbox
        if (p2Chatbox) {
          p2Chatbox.innerHTML = '';
        }
        
        // Reset game state
        systemState.coachingMode = false;
        handleSpectatorButtons();
        removeSyncIntervals();
        systemState.spectatorId = '';
        
        // Restore deck data to actiondata list
        if (systemState.selfDeckData) {
          processAction('self', true, 'loadDeckData', [systemState.selfDeckData]);
        }
        
        if (systemState.p1OppDeckData) {
          processAction('opp', true, 'loadDeckData', [systemState.p1OppDeckData]);
        }
        
        // Confirmation message
        appendMessage('', 'You left the room', 'announcement', false);
      } catch (error) {
        console.error('Error leaving room:', error);
        appendMessage('', 'Error leaving room. Please try again.', 'announcement', false);
      }
    }
  });
};