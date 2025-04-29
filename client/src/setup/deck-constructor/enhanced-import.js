// filename: client/src/setup/deck-constructor/enhanced-import.js
/**
 * Enhanced Import Module
 * Purpose: Provide additional deck import functionality with multiple format support
 * @author: [Your Name]
 * @created: April 28, 2025
 * @updated: Added support for custom image URL format
 */

import { reset } from '../../actions/general/reset.js';
import { systemState } from '../../front-end.js';
import { appendMessage } from '../chatbox/append-message.js';
import { determineUsername } from '../general/determine-username.js';
import { processAction } from '../general/process-action.js';
import { show } from '../home-header/header-toggle.js';
import { getCardType } from './find-type.js';
import { showPopup } from '../general/pop-up-message.js';

// Different format parsers
const formatParsers = {
  // Standard PTCG Simulator format (existing implementation)
  standard: (decklistText) => {
    // Your existing parsing logic from importDecklist function
    const regexWithOldSet = /(\d+) (.+?)(?= \w*-\w*\d*$) (\w*-\w*\d*)/;
    const regexWithSet = /(\d+) (.+?) (\w{2,3}[1-9]?|WBSP|NBSP|FRLG|FUT20) (\d+[a-zA-Z]?)/;
    const regexWithPRSet = /(\d+) (.+?) (PR-\w{2,3}) ((?:DP|HGSS|BW|XY|SM|SWSH)?)(\d+)/;
    const regexWithSpecialSet = /(\d+) (.+?) ((?:\w{2,3}[a-zA-Z]\d*|\w{2,3}(?:\s+[a-zA-Z\d]+)*)(?:\s+(\w{2,3}\s*[a-zA-Z\d]+)\s*)*)$/;
    const regexWithoutSet = /(\d+) (.+?)(?=\s\d|$|(\s\d+))/;

    // Initialize an array to store the results
    const decklistArray = [];

    // Split the decklist into lines
    const lines = decklistText.split('\n');

    // Process each line
    lines.forEach((line) => {
      line = line.replace(/[[\]()]/g, '');
      //ptcglive conversion for GG/TG cards (the alt art bs) (don't apply to promo sets)
      line = line.replace(/(?!PR-)(\w{2,3})-(\w{2,3}) (\d+)/g, '$1 $2$3');
      //special case for double crisis set
      line = line.replace(/xy5-5 /g, 'DCR ');
      //special case for DPP
      line = line.replace(/ DPP /g, ' PR-DPP ');

      let matchWithOldSet = line.match(regexWithOldSet);
      let matchWithSet = line.match(regexWithSet);
      let matchWithPRSet = line.match(regexWithPRSet);
      let matchWithSpecialSet = line.match(regexWithSpecialSet);
      let matchWithoutSet = line.match(regexWithoutSet);

      if (matchWithOldSet) {
        const [, quantity, name, id] = matchWithOldSet;
        decklistArray.push([
          parseInt(quantity),
          name,
          null,
          null,
          id,
          null,
          undefined,
        ]);
      } else if (matchWithSet) {
        const [, quantity, name, set, setNumber] = matchWithSet;
        decklistArray.push([
          parseInt(quantity),
          name,
          set,
          setNumber,
          null,
          null,
          undefined,
        ]);
      } else if (matchWithPRSet) {
        const [, quantity, name, prSet, , setNumber] = matchWithPRSet;
        decklistArray.push([
          parseInt(quantity),
          name,
          prSet,
          setNumber,
          null,
          null,
          undefined,
        ]);
      } else if (matchWithSpecialSet) {
        const [, quantity, name, setAll] = matchWithSpecialSet;
        const [set, setNumber] = setAll.trim().split(/(?<=\S)\s/);
        decklistArray.push([
          parseInt(quantity),
          name,
          set,
          setNumber,
          null,
          null,
          undefined,
        ]);
      } else if (matchWithoutSet) {
        const [, quantity, name] = matchWithoutSet;
        decklistArray.push([
          parseInt(quantity),
          name,
          null,
          null,
          null,
          null,
          undefined,
        ]);
      }
    });

    return decklistArray;
  },
  
  // JSON format
  json: (jsonText) => {
    try {
      const data = JSON.parse(jsonText);
      const decklistArray = [];
      
      // Handle different JSON structures
      if (Array.isArray(data)) {
        // Array format: [{quantity, name, set, setNumber, ...}, ...]
        data.forEach(card => {
          decklistArray.push([
            parseInt(card.quantity || 1),
            card.name,
            card.set || null,
            card.setNumber || null,
            card.id || null,
            card.imageURL || card.imageUrl || null,
            card.type || undefined
          ]);
        });
      } else if (data.cards && Array.isArray(data.cards)) {
        // Object with cards array
        data.cards.forEach(card => {
          decklistArray.push([
            parseInt(card.quantity || 1),
            card.name,
            card.set || null,
            card.setNumber || null,
            card.id || null,
            card.imageURL || card.imageUrl || null,
            card.type || undefined
          ]);
        });
      } else if (data.deck && Array.isArray(data.deck)) {
        // PTCGO export format
        data.deck.forEach(card => {
          decklistArray.push([
            parseInt(card.count || 1),
            card.name,
            card.set || null,
            card.number || null,
            null,
            card.imageURL || card.imageUrl || null,
            card.supertype || undefined
          ]);
        });
      } else {
        throw new Error("Unsupported JSON structure");
      }
      
      return decklistArray;
    } catch (error) {
      console.error("JSON parsing error:", error);
      throw error;
    }
  },
  
  // LackeyCCG deck format (.dek files)
  lackey: (deckText) => {
    try {
      const decklistArray = [];
      
      // Parse the XML content
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(deckText, "text/xml");
      
      // Process each card element
      const cardElements = xmlDoc.querySelectorAll("card");
      
      cardElements.forEach(cardElement => {
        const nameElement = cardElement.querySelector("name");
        if (!nameElement) return;
        
        const name = nameElement.textContent;
        const id = nameElement.getAttribute("id") || null;
        const set = cardElement.querySelector("set")?.textContent || null;
        
        // Default to 1 card if not specified
        const quantity = 1;
        
        decklistArray.push([
          quantity,
          name,
          set,
          null, // setNumber
          id,
          null, // imageURL
          undefined // type
        ]);
      });
      
      return decklistArray;
    } catch (error) {
      console.error("LackeyCCG parsing error:", error);
      throw error;
    }
  },
  
  // PTCGO / PTCGL export format
  ptcgo: (deckText) => {
    const decklistArray = [];
    
    // Split the decklist into lines
    const lines = deckText.split('\n');
    
    // Process each line
    lines.forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('***') || line.startsWith('##')) return;
      
      // Parse PTCGO format: "* 1 Pikachu SUM 20"
      const regex = /\* (\d+) ([^(]+)(?:\(([^)]+)\))? ?([A-Z]+) ?(\d+a?)/;
      const match = line.match(regex);
      
      if (match) {
        const [, quantity, name, , set, setNumber] = match;
        decklistArray.push([
          parseInt(quantity),
          name.trim(),
          set,
          setNumber,
          null,
          null,
          undefined
        ]);
      }
    });
    
    return decklistArray;
  },
  
  // Custom URL format
  customUrl: (deckText) => {
    try {
      const lines = deckText.trim().split('\n');
      const decklistArray = [];
      
      lines.forEach(line => {
        const parts = line.trim().split('|');
        
        // Expected format: Quantity|Name|Type|ImageURL
        if (parts.length >= 4) {
          const quantity = parseInt(parts[0]) || 1;
          const name = parts[1].trim();
          const type = parts[2].trim();
          const imageUrl = parts[3].trim();
          
          decklistArray.push([
            quantity,
            name,
            null, // set
            null, // setNumber
            null, // id
            imageUrl,
            type
          ]);
        }
      });
      
      return decklistArray;
    } catch (error) {
      console.error("Custom URL import error:", error);
      throw error;
    }
  }
};

// Function to detect format based on content
const detectFormat = (content) => {
  // Check if it's JSON
  try {
    JSON.parse(content);
    return 'json';
  } catch (e) {
    // Not JSON
  }
  
  // Check if it's Lackey CCG format (.dek)
  if (content.includes('<deck version') && content.includes('<superzone')) {
    return 'lackey';
  }
  
  // Check if it's PTCGO format
  if (content.includes('***') && /\* \d+ /.test(content)) {
    return 'ptcgo';
  }
  
  // Check if it contains the custom URL format pattern
  if (content.includes('|') && /\d+\|.+\|.+\|https?:\/\//.test(content)) {
    return 'customUrl';
  }
  
  // Default to standard format
  return 'standard';
};

// Function to get update URL from config
const getUpdateUrl = async () => {
  try {
    const response = await fetch('/api/config?key=lackey_update_url');
    
    if (!response.ok) {
      throw new Error('Failed to fetch update URL');
    }
    
    const data = await response.json();
    return data.value;
  } catch (error) {
    console.error('Error fetching update URL:', error);
    // Fallback to default URL
    return 'https://ptcgcustomplugin.s3.us-east-2.amazonaws.com/updatelist.txt';
  }
};

export const enhancedImportDecklist = (user, customFormat = null) => {
  const mainDeckImportInput = document.getElementById('mainDeckImportInput');
  const altDeckImportInput = document.getElementById('altDeckImportInput');
  const failedText = document.getElementById('failedText');
  const invalidText = document.getElementById('invalidText');
  const loadingText = document.getElementById('loadingText');
  const importButton = document.getElementById('importButton');
  const decklistTable = document.getElementById('decklistTable');
  
  failedText.style.display = 'none';
  invalidText.style.display = 'none';
  loadingText.style.display = 'block';
  importButton.disabled = true;
  
  const decklist = user === 'self' ? mainDeckImportInput.value : altDeckImportInput.value;
  
  try {
    // Detect format if not specified
    const format = customFormat || detectFormat(decklist);
    
    // Parse decklist using the appropriate format parser
    const decklistArray = formatParsers[format](decklist);
    
    if (decklistArray.length < 1) {
      failedText.style.display = 'block';
      loadingText.style.display = 'none';
      importButton.disabled = false;
      return;
    }
    
    // Process the deck list (fetch images, etc.)
    processDecklistArray(user, decklistArray);
  } catch (error) {
    console.error("Import error:", error);
    failedText.style.display = 'block';
    loadingText.style.display = 'none';
    importButton.disabled = false;
  }
};

// Process decklist array (existing functionality enhanced)
const processDecklistArray = (user, decklistArray) => {
  const loadingText = document.getElementById('loadingText');
  const importButton = document.getElementById('importButton');
  const decklistTable = document.getElementById('decklistTable');
  const failedText = document.getElementById('failedText');
  const changeLanguageButton = document.getElementById('changeLanguageButton');
  
  const languageText = changeLanguageButton.textContent;
  let language;
  switch (languageText) {
    case 'Language: English':
      language = 'EN';
      break;
    case 'Language: French':
      language = 'FR';
      break;
    case 'Language: German':
      language = 'DE';
      break;
    case 'Language: Italian':
      language = 'IT';
      break;
    case 'Language: Portuguese':
      language = 'PT';
      break;
    case 'Language: Spanish':
      language = 'ES';
      break;
    default:
      language = 'EN';
  }

  // Rest of your existing processing code...
  // [Most of the existing code from importDecklist]
  
  // Existing energy mappings and special cases
  const energies = {
    'Fire Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_R_R_${language}.png`,
    'Grass Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_G_R_${language}.png`,
    'Fairy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/TEU/TEU_Y_R_${language}.png`,
    'Darkness Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_D_R_${language}.png`,
    'Lightning Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_L_R_${language}.png`,
    'Fighting Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_F_R_${language}.png`,
    'Psychic Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_P_R_${language}.png`,
    'Metal Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_M_R_${language}.png`,
    'Water Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_W_R_${language}.png`,
    'Basic Fire Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_R_R_${language}.png`,
    'Basic Grass Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_G_R_${language}.png`,
    'Basic Fairy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/TEU/TEU_Y_R_${language}.png`,
    'Basic Darkness Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_D_R_${language}.png`,
    'Basic Lightning Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_L_R_${language}.png`,
    'Basic Fighting Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_F_R_${language}.png`,
    'Basic Psychic Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_P_R_${language}.png`,
    'Basic Metal Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_M_R_${language}.png`,
    'Basic Water Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_W_R_${language}.png`,
    'Basic {W} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_W_R_${language}.png`,
    'Basic {R} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_R_R_${language}.png`,
    'Basic {G} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_G_R_${language}.png`,
    'Basic {Y} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/TEU/TEU_Y_R_${language}.png`,
    'Basic {D} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_D_R_${language}.png`,
    'Basic {L} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_L_R_${language}.png`,
    'Basic {F} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_F_R_${language}.png`,
    'Basic {P} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_P_R_${language}.png`,
    'Basic {M} Energy Energy': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/BRS/BRS_M_R_${language}.png`,
    // cubekoga compatibility
    'Basic Fire Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_002_R_${language}.png`,
    'Basic Grass Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_001_R_${language}.png`,
    'Basic Darkness Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_007_R_${language}.png`,
    'Basic Lightning Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_004_R_${language}.png`,
    'Basic Fighting Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_006_R_${language}.png`,
    'Basic Psychic Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_005_R_${language}.png`,
    'Basic Metal Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_008_R_${language}.png`,
    'Basic Water Energy null': `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/SVE/SVE_003_R_${language}.png`,
  };

  const specialCases = {
    'PR-SV': 'SVP',
    'PR-SW': 'SP',
    'PR-SM': 'SMP',
    'PR-XY': 'XYP',
    'PR-BLW': 'BWP',
    'PR-HS': 'HSP',
    // cubekoga compatibility
    'sma': 'HIF',
  };

  const oldSetCode_to_id = {
    // the following are taken from pokemontcg.io (v2)'s ptcgoCode
    'BS': 'base1',
    'JU': 'base2',
    'PR': 'basep',
    'FO': 'base3',
    'B2': 'base4',
    'TR': 'base5',
    'G1': 'gym1',
    'G2': 'gym2',
    'N1': 'neo1',
    'N2': 'neo2',
    'N3': 'neo3',
    'N4': 'neo4',
    'LC': 'base6',
    'EX': 'ecard1',
    'BP': 'bp',
    'AQ': 'ecard2',
    'SK': 'ecard3',
    'RS': 'ex1',
    'SS': 'ex2',
    'DR': 'ex3',
    'PR-NP': 'np',
    'MA': 'ex4',
    'HL': 'ex5',
    'RG': 'ex6',
    'TRR': 'ex7',
    'DX': 'ex8',
    'EM': 'ex9',
    'UF': 'ex10',
    'DS': 'ex11',
    'LM': 'ex12',
    'HP': 'ex13',
    'CG': 'ex14',
    'DF': 'ex15',
    'PK': 'ex16',
    'DP': 'dp1',
    'MT': 'dp2',
    'SW': 'dp3',
    'GE': 'dp4',
    'MD': 'dp5',
    'LA': 'dp6',
    'SF': 'dp7',
    'PL': 'pl1',
    'RR': 'pl2',
    'SV': 'pl3',
    'AR': 'pl4',
    // the following were written by hand
    'POP1': 'pop1',
    'POP2': 'pop2',
    'POP3': 'pop3',
    'POP4': 'pop4',
    'POP5': 'pop5',
    'POP6': 'pop6',
    'POP7': 'pop7',
    'POP8': 'pop8',
    'POP9': 'pop9',
    'P1': 'pop1',
    'P2': 'pop2',
    'P3': 'pop3',
    'P4': 'pop4',
    'P5': 'pop5',
    'P6': 'pop6',
    'P7': 'pop7',
    'P8': 'pop8',
    'P9': 'pop9',
    'pop1': 'pop1',
    'pop2': 'pop2',
    'pop3': 'pop3',
    'pop4': 'pop4',
    'pop5': 'pop5',
    'pop6': 'pop6',
    'pop7': 'pop7',
    'pop8': 'pop8',
    'pop9': 'pop9',
    'SI': 'si1',
    'RM': 'ru1',
    'FUT20': 'fut20',
    // https://limitlesstcg.com/cards
    'BS2': 'base4',
    'EXP': 'ecard1',
    'AQP': 'ecard2',
    'SKR': 'ecard3',
    // the following were written by hand
    'BS2': 'base4',
    'EXP': 'ecard1',
    'AQP': 'ecard2',
    'SKR': 'ecard3',
    'E1': 'ecard1',
    'E2': 'ecard2',
    'E3': 'ecard3',
    'WBP': 'basep',
    'WBSP': 'basep',
    'NP': 'np',
    'NBSP': 'np',
    'FRLG': 'ex6',
    'BG': 'bp',
  };

  // the following cards have no image on limitless
  const noImg_to_id = {
    'BUS 112a': 'sm3-112a',
    'FLI 102a': 'sm6-102a',
    'UNM 191a': 'sm11-191a',
    'GRI 121a': 'sm2-121a',
    'UPR 119a': 'sm5-119a',
    'BUS 115a': 'sm3-115a',
    'UPR 125a': 'sm5-125a',
    'UPR 153a': 'sm5-153a',
    'UNB 182a': 'sm10-182a',
    'TEU 152a': 'sm9-152a',
    'LOT 188a': 'sm8-188a',
    'SLG 68a': 'sm35-68a',
    'UPR 135a': 'sm5-135a',
    'UNB 189a': 'sm10-189a',
  };

  // Process each card in the decklistArray
  let fetchPromises = decklistArray.map((entry) => {
    // If card already has an image URL (from custom URL format), no need to fetch
    if (entry[5]) {
      // Set type if not defined
      if (!entry[6]) {
        // Make a best guess based on name
        if (entry[1].includes('Energy')) {
          entry[6] = 'Energy';
        } else if (entry[1].includes('Trainer') || entry[1].includes('Stadium') || entry[1].includes('Tool')) {
          entry[6] = 'Trainer';
        } else {
          entry[6] = 'Pokémon';
        }
      }
      return Promise.resolve(true);
    }

    const [, name, set, setNumber] = entry;

    let [firstPart, secondPart] = [set, setNumber];
    const energyUrl = energies[name];

    if (firstPart && secondPart) {
      if (specialCases[firstPart]) {
        firstPart = specialCases[firstPart];
      }
      if (oldSetCode_to_id[firstPart]) {
        entry[4] = oldSetCode_to_id[firstPart] + '-' + secondPart;
      }
      if (noImg_to_id[firstPart + ' ' + secondPart]) {
        entry[4] = noImg_to_id[firstPart + ' ' + secondPart];
      }
      // special case for PR-DPP
      if (firstPart === 'PR-DPP') {
        const paddedSecondPart = secondPart.replace(/^(\d+)?$/, (_, digits) => {
          const paddedDigits =
            digits.length < 3 ? digits.padStart(2, '0') : digits;
          return 'dpp-DP' + paddedDigits;
        });
        entry[4] = paddedSecondPart;
      }
    }
    // If the card doesn't have an id but contains a set code and set number, we assume it's a limitless card
    if (firstPart && secondPart && !entry[4]) {
      const paddedSecondPart = secondPart.replace(
        /^(\d+)([a-zA-Z])?$/,
        (_, digits, letter) => {
          const paddedDigits =
            digits.length < 3 ? digits.padStart(3, '0') : digits;
          return letter ? paddedDigits + letter : paddedDigits;
        }
      );
      const url = `https://limitlesstcg.nyc3.digitaloceanspaces.com/tpci/${firstPart.replace(/ /g, '/')}/${firstPart.replace(/ /g, '_')}_${paddedSecondPart}_R_${language}.png`;

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          entry[5] = url;
          entry[6] = getCardType(firstPart, secondPart);
          resolve(true);
        };
        img.onerror = () => {
          const alternateUrl = `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpc/${firstPart}/${firstPart}_${paddedSecondPart}_R_JP_LG.png`;
          const altImg = new Image();
          altImg.onload = () => {
            entry[5] = alternateUrl;
            entry[6] = getCardType(firstPart, secondPart);
            resolve(true);
          };
          altImg.onerror = () => {
            // Try Cloudflare-hosted custom card images
            fetch(`/api/cards/image?set=${firstPart}&number=${secondPart}`)
              .then(response => {
                if (response.ok) return response.json();
                throw new Error('Card not found');
              })
              .then(data => {
                entry[5] = data.imageUrl;
                entry[6] = data.type;
                resolve(true);
              })
              .catch(() => resolve(false));
          };
          altImg.src = alternateUrl;
        };
        img.src = url;
      });
    } else if (energyUrl) {
      entry[5] = energyUrl;
      entry[6] = 'Energy';
      if (name.slice(-5) === ' null') {
        entry[1] = name.slice(0, -5);
      }
      return Promise.resolve(true);
      // If the card has an id, we fetch the card from the pokemontcg.io api
    } else if (entry[4]) {
      const ID = entry[4];
      return fetch('https://api.pokemontcg.io/v2/cards/' + ID, {
        method: 'GET',
        headers: {
          'X-Api-Key': 'cde33a60-5d8a-414e-ae04-b447090dd6ba',
        },
      })
        .then((response) => response.json())
        .then(({ data }) => {
          const index = decklistArray.findIndex((item) => item[4] === ID);
          if (index !== -1) {
            decklistArray[index][5] = data.images.large;
            decklistArray[index][6] = data.supertype;
          }
          return true;
        })
        .catch(() => {
          return false;
        });
    } else if (!entry[5] || !entry[6]) {
      // Try to look up by name in our custom database
      return fetch(`/api/cards/byName?name=${encodeURIComponent(name)}`)
        .then(response => {
          if (response.ok) return response.json();
          throw new Error('Card not found');
        })
        .then(data => {
          if (data && data.length > 0) {
            entry[5] = data[0].image_url;
            entry[6] = data[0].type;
            return true;
          }
          return false;
        })
        .catch(() => false);
    }
    return Promise.resolve(true);
  });

  // After processing all cards, update the UI
  Promise.all(fetchPromises)
    .then((results) => {
      let hasError = results.includes(false);

      let tableBody = decklistTable.getElementsByTagName('tbody')[0];
      decklistTable.style.display = 'block';
      
      // Clear existing rows
      while (tableBody.firstChild) {
        tableBody.removeChild(tableBody.firstChild);
      }
      
      // Populate the table with processed deck data
      decklistArray.forEach(([quantity, name, , , , url, type]) => {
        let newRow = tableBody.insertRow();

        let qtyCell = newRow.insertCell(0);
        let nameCell = newRow.insertCell(1);
        let typeCell = newRow.insertCell(2);
        let urlCell = newRow.insertCell(3);

        qtyCell.contentEditable = 'true';
        nameCell.contentEditable = 'true';
        urlCell.contentEditable = 'true';

        // Create dropdown for type cell
        let typeSelect = document.createElement('select');
        typeSelect.innerHTML = `
                <option value="">Select type...</option>
                <option value="Pokémon">Pokémon</option>
                <option value="Trainer">Trainer</option>
                <option value="Energy">Energy</option>
            `;

        // Set initial value if type exists
        if (type) {
          typeSelect.value = type;
        }

        typeCell.appendChild(typeSelect);

        qtyCell.innerHTML = quantity;
        nameCell.innerHTML = name;
        urlCell.innerHTML = url;

        // Add red outline for empty/undefined/null values
        if (!quantity || quantity === 'undefined' || quantity === 'null') {
          qtyCell.style.outline = '2px solid red';
        }
        if (!name || name === 'undefined' || name === 'null') {
          nameCell.style.outline = '2px solid red';
        }
        if (!url || url === 'undefined' || url === 'null') {
          urlCell.style.outline = '2px solid red';
        }
        if (
          !type ||
          type === 'undefined' ||
          type === 'null' ||
          type === 'Unknown'
        ) {
          typeCell.style.outline = '2px solid red';
        }
      });

      // Update UI elements
      const selfContainer = document.getElementById('selfContainer');
      const oppContainer = document.getElementById('oppContainer');
      const decklistsButton = document.getElementById('decklistsButton');
      const importButton = document.getElementById('importButton');
      const randomButton = document.getElementById('randomButton');
      const changeLanguageButton = document.getElementById('changeLanguageButton');
      const confirmButton = document.getElementById('confirmButton');
      const cancelButton = document.getElementById('cancelButton');
      const saveButton = document.getElementById('saveButton');
      
      importButton.disabled = false;
      selfContainer.style.zIndex = -1;
      oppContainer.style.zIndex = -1;
      loadingText.style.display = 'none';
      decklistsButton.style.display = 'none';
      importButton.style.display = 'none';
      randomButton.style.display = 'none';
      changeLanguageButton.style.display = 'none';
      confirmButton.style.display = 'block';
      cancelButton.style.display = 'block';
      saveButton.style.display = 'block';

      // Show error message if any failures occurred
      if (hasError) {
        failedText.style.display = 'block';
        loadingText.style.display = 'none';
      }
    })
    .catch(() => {
      failedText.style.display = 'block';
      loadingText.style.display = 'none';
    });
};

// Cloudflare integration for deck storage
export const saveToCloudflare = async (deckName, deckData, category = "Custom", format = "Standard") => {
  try {
    const response = await fetch('/api/decks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: deckName,
        category: category,
        format: format,
        content: JSON.stringify(deckData)
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to save deck');
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error saving deck:', error);
    throw error;
  }
};

// Load deck from Cloudflare
export const loadFromCloudflare = async (deckId) => {
  try {
    const response = await fetch(`/api/decks?id=${deckId}`);
    
    if (!response.ok) {
      throw new Error('Failed to load deck');
    }
    
    const deck = await response.json();
    return {
      deckName: deck.name,
      deckData: JSON.parse(deck.content)
    };
  } catch (error) {
    console.error('Error loading deck:', error);
    throw error;
  }
};