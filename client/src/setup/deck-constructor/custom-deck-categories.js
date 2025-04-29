// filename: client/src/setup/deck-constructor/custom-deck-categories.js
/**
 * Custom Deck Categories
 * Purpose: Enhanced deck selection UI with custom categories
 * @author: [Your Name]
 * @created: April 28, 2025
 */

import { showPopup } from '../general/pop-up-message.js';
import { loadFromCloudflare } from './enhanced-import.js';
import { importDecklist } from './import.js';

// Deck categories configuration
const deckCategories = [
  {
    id: 'official',
    name: 'Official Decks',
    subcategories: [
      { id: 'standard', name: 'Standard Format' },
      { id: 'expanded', name: 'Expanded Format' },
      { id: 'legacy', name: 'Legacy Format' },
      { id: 'historical', name: 'Historical Decks' }
    ]
  },
  {
    id: 'custom',
    name: 'Custom Sets',
    subcategories: [
      { id: 'delta_species', name: 'Delta Species' },
      { id: 'ancient_echoes', name: 'Ancient Echoes' },
      { id: 'custom_other', name: 'Other Custom Sets' }
    ]
  },
  {
    id: 'community',
    name: 'Community Decks',
    subcategories: [
      { id: 'tournament', name: 'Tournament Winners' },
      { id: 'fun', name: 'Fun & Theme Decks' },
      { id: 'budget', name: 'Budget Decks' }
    ]
  },
  {
    id: 'my_decks',
    name: 'My Saved Decks',
    subcategories: []  // Will be populated dynamically
  }
];

// Create and display the enhanced deck selection UI
export const showEnhancedDeckSelection = (user) => {
  // Create modal container
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'deck-selection-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'deck-selection-modal';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'deck-selection-header';
  
  const title = document.createElement('h2');
  title.textContent = 'Select a Deck';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.className = 'deck-selection-close';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create categories sidebar
  const sidebarContainer = document.createElement('div');
  sidebarContainer.className = 'deck-selection-sidebar';
  
  // Create deck list container
  const deckListContainer = document.createElement('div');
  deckListContainer.className = 'deck-list-container';
  
  // Create deck details panel
  const deckDetailsPanel = document.createElement('div');
  deckDetailsPanel.className = 'deck-details-panel';
  deckDetailsPanel.innerHTML = '<div class="deck-details-placeholder">Select a deck to view details</div>';
  
  // Populate sidebar with categories
  populateCategorySidebar(sidebarContainer, deckListContainer, deckDetailsPanel);
  
  // Add action buttons
  const actionButtons = document.createElement('div');
  actionButtons.className = 'deck-selection-actions';
  
  const selectButton = document.createElement('button');
  selectButton.textContent = 'Select Deck';
  selectButton.className = 'deck-select-button';
  selectButton.disabled = true;
  
  const importButton = document.createElement('button');
  importButton.textContent = 'Import New Deck';
  importButton.className = 'deck-import-button';
  
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh';
  refreshButton.className = 'deck-refresh-button';
  
  actionButtons.appendChild(selectButton);
  actionButtons.appendChild(importButton);
  actionButtons.appendChild(refreshButton);
  
  // Add click handlers for buttons
  selectButton.addEventListener('click', () => {
    const selectedDeckId = selectButton.dataset.deckId;
    if (selectedDeckId) {
      loadSelectedDeck(selectedDeckId, user);
      document.body.removeChild(modalOverlay);
    }
  });
  
  importButton.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
    showImportOptions(user);
  });
  
  refreshButton.addEventListener('click', () => {
    refreshDeckList(deckListContainer);
  });
  
  // Assemble modal
  modalContent.appendChild(header);
  
  const contentContainer = document.createElement('div');
  contentContainer.className = 'deck-selection-content';
  contentContainer.appendChild(sidebarContainer);
  contentContainer.appendChild(deckListContainer);
  contentContainer.appendChild(deckDetailsPanel);
  
  modalContent.appendChild(contentContainer);
  modalContent.appendChild(actionButtons);
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  // Load default category
  loadDecksForCategory('official', 'standard', deckListContainer, deckDetailsPanel, selectButton);
};

// Populate the category sidebar
const populateCategorySidebar = (sidebar, deckList, detailsPanel) => {
  deckCategories.forEach(category => {
    const categoryElement = document.createElement('div');
    categoryElement.className = 'deck-category';
    
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'deck-category-header';
    categoryHeader.textContent = category.name;
    
    // Make category expandable
    categoryHeader.addEventListener('click', () => {
      categoryElement.classList.toggle('expanded');
    });
    
    categoryElement.appendChild(categoryHeader);
    
    // Create subcategory list
    const subcategoryList = document.createElement('div');
    subcategoryList.className = 'deck-subcategories';
    
    category.subcategories.forEach(subcategory => {
      const subcategoryElement = document.createElement('div');
      subcategoryElement.className = 'deck-subcategory';
      subcategoryElement.textContent = subcategory.name;
      
      // Add click handler to load decks for this category
      subcategoryElement.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.deck-subcategory.active').forEach(el => {
          el.classList.remove('active');
        });
        subcategoryElement.classList.add('active');
        
        // Load decks for this category
        loadDecksForCategory(
          category.id, 
          subcategory.id, 
          deckList, 
          detailsPanel,
          document.querySelector('.deck-select-button')
        );
      });
      
      subcategoryList.appendChild(subcategoryElement);
    });
    
    categoryElement.appendChild(subcategoryList);
    sidebar.appendChild(categoryElement);
    
    // Expand first category by default
    if (category === deckCategories[0]) {
      categoryElement.classList.add('expanded');
      subcategoryList.children[0].classList.add('active');
    }
  });
};

// Load decks for a specific category
const loadDecksForCategory = async (categoryId, subcategoryId, deckListContainer, detailsPanel, selectButton) => {
  deckListContainer.innerHTML = '<div class="deck-loading">Loading decks...</div>';
  
  try {
    // Load decks from appropriate source based on category
    let decks = [];
    
    if (categoryId === 'my_decks') {
      // Load from localStorage or IndexedDB
      decks = await loadMyDecks();
    } else {
      // Load from Cloudflare database
      const response = await fetch(`/api/decks?category=${categoryId}&subcategory=${subcategoryId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load decks');
      }
      
      decks = await response.json();
    }
    
    // Populate deck list
    deckListContainer.innerHTML = '';
    
    if (decks.length === 0) {
      deckListContainer.innerHTML = '<div class="no-decks-message">No decks found in this category</div>';
      return;
    }
    
    decks.forEach(deck => {
      const deckElement = document.createElement('div');
      deckElement.className = 'deck-item';
      deckElement.dataset.deckId = deck.id;
      
      const deckName = document.createElement('div');
      deckName.className = 'deck-name';
      deckName.textContent = deck.name;
      
      const deckMeta = document.createElement('div');
      deckMeta.className = 'deck-meta';
      deckMeta.textContent = `${deck.format} • ${new Date(deck.created_at).toLocaleDateString()}`;
      
      deckElement.appendChild(deckName);
      deckElement.appendChild(deckMeta);
      
      // Add click handler to show deck details
      deckElement.addEventListener('click', () => {
        // Update active state
        document.querySelectorAll('.deck-item.active').forEach(el => {
          el.classList.remove('active');
        });
        deckElement.classList.add('active');
        
        // Load and show deck details
        loadDeckDetails(deck.id, detailsPanel);
        
        // Enable select button
        selectButton.disabled = false;
        selectButton.dataset.deckId = deck.id;
      });
      
      deckListContainer.appendChild(deckElement);
    });
  } catch (error) {
    console.error('Error loading decks:', error);
    deckListContainer.innerHTML = `<div class="deck-error">Error loading decks: ${error.message}</div>`;
  }
};

// Load deck details
const loadDeckDetails = async (deckId, detailsPanel) => {
  detailsPanel.innerHTML = '<div class="deck-loading">Loading deck details...</div>';
  
  try {
    const response = await fetch(`/api/decks?id=${deckId}`);
    
    if (!response.ok) {
      throw new Error('Failed to load deck details');
    }
    
    const deck = await response.json();
    const deckContent = JSON.parse(deck.content);
    
    // Create deck details view
    detailsPanel.innerHTML = '';
    
    const deckHeader = document.createElement('div');
    deckHeader.className = 'deck-detail-header';
    
    const deckTitle = document.createElement('h3');
    deckTitle.textContent = deck.name;
    
    const deckDescription = document.createElement('p');
    deckDescription.className = 'deck-description';
    deckDescription.textContent = deck.description || 'No description available.';
    
    deckHeader.appendChild(deckTitle);
    deckHeader.appendChild(deckDescription);
    
    // Group cards by type
    const cardsByType = groupCardsByType(deckContent);
    
    // Create card list
    const cardList = document.createElement('div');
    cardList.className = 'deck-card-list';
    
    for (const [type, cards] of Object.entries(cardsByType)) {
      const typeSection = document.createElement('div');
      typeSection.className = 'card-type-section';
      
      const typeHeader = document.createElement('h4');
      typeHeader.textContent = `${type} (${cards.reduce((sum, card) => sum + card.quantity, 0)})`;
      
      const typeCards = document.createElement('div');
      typeCards.className = 'type-cards';
      
      cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'deck-card-item';
        cardElement.textContent = `${card.quantity}x ${card.name}`;
        
        // Add hover effect to show card image
        if (card.imageUrl) {
          cardElement.addEventListener('mouseover', () => {
            showCardPreview(card.imageUrl);
          });
          
          cardElement.addEventListener('mouseout', () => {
            hideCardPreview();
          });
        }
        
        typeCards.appendChild(cardElement);
      });
      
      typeSection.appendChild(typeHeader);
      typeSection.appendChild(typeCards);
      cardList.appendChild(typeSection);
    }
    
    detailsPanel.appendChild(deckHeader);
    detailsPanel.appendChild(cardList);
  } catch (error) {
    console.error('Error loading deck details:', error);
    detailsPanel.innerHTML = `<div class="deck-error">Error loading deck details: ${error.message}</div>`;
  }
};

// Helper to group cards by type
const groupCardsByType = (deckContent) => {
  const groups = {
    'Pokémon': [],
    'Trainer': [],
    'Energy': []
  };
  
  deckContent.forEach(card => {
    const type = card.type || 'Unknown';
    
    if (type === 'Pokémon' || type.includes('Pokemon')) {
      groups['Pokémon'].push(card);
    } else if (type === 'Trainer') {
      groups['Trainer'].push(card);
    } else if (type === 'Energy') {
      groups['Energy'].push(card);
    } else {
      // If we don't have the type info, make a best guess based on name
      if (card.name.includes('Energy')) {
        groups['Energy'].push(card);
      } else if (card.name.includes('Trainer') || card.name.includes('Stadium') || card.name.includes('Tool')) {
        groups['Trainer'].push(card);
      } else {
        groups['Pokémon'].push(card);
      }
    }
  });
  
  return groups;
};

// Load a selected deck
const loadSelectedDeck = async (deckId, user) => {
  try {
    const { deckData } = await loadFromCloudflare(deckId);
    
    // Convert to format expected by importDecklist
    const input = document.getElementById(user === 'self' ? 'mainDeckImportInput' : 'altDeckImportInput');
    
    // Generate formatted text from deck data
    let decklistText = '';
    
    deckData.forEach(card => {
      decklistText += `${card.quantity} ${card.name}`;
      
      if (card.set && card.setNumber) {
        decklistText += ` ${card.set} ${card.setNumber}`;
      }
      
      decklistText += '\n';
    });
    
    input.value = decklistText;
    
    // Import the deck
    importDecklist(user);
  } catch (error) {
    console.error('Error loading selected deck:', error);
    showPopup(`Error loading deck: ${error.message}`);
  }
};

// Show import options modal
const showImportOptions = (user) => {
  // Create modal container
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'import-options-overlay';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'import-options-modal';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'import-options-header';
  
  const title = document.createElement('h2');
  title.textContent = 'Import Deck';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = '×';
  closeButton.className = 'import-options-close';
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  header.appendChild(title);
  header.appendChild(closeButton);
  
  // Create format selection
  const formatSelector = document.createElement('div');
  formatSelector.className = 'format-selector';
  
  const formatLabel = document.createElement('div');
  formatLabel.textContent = 'Select Format:';
  formatLabel.className = 'format-label';
  
  const formatOptions = document.createElement('div');
  formatOptions.className = 'format-options';
  
  // Add format options
  const formats = [
    { id: 'standard', name: 'Standard Format (PTCG Simulator)', description: 'The standard text format used by this simulator' },
    { id: 'json', name: 'JSON Format', description: 'Import a deck in JSON format' },
    { id: 'ptcgo', name: 'PTCGO / PTCGL Export', description: 'Import a deck exported from Pokémon TCG Online or Live' },
    { id: 'lackey', name: 'LackeyCCG Format (.dek)', description: 'Import a deck from LackeyCCG' },
    { id: 'customUrl', name: 'Custom Card URLs', description: 'Import cards with custom image URLs (Quantity|Name|Type|ImageURL format)' }
  ];
  
  formats.forEach(format => {
    const formatOption = document.createElement('div');
    formatOption.className = 'format-option';
    formatOption.dataset.format = format.id;
    
    const formatTitle = document.createElement('div');
    formatTitle.className = 'format-title';
    formatTitle.textContent = format.name;
    
    const formatDesc = document.createElement('div');
    formatDesc.className = 'format-description';
    formatDesc.textContent = format.description;
    
    formatOption.appendChild(formatTitle);
    formatOption.appendChild(formatDesc);
    
    // Add click handler
    formatOption.addEventListener('click', () => {
      document.querySelectorAll('.format-option.selected').forEach(el => {
        el.classList.remove('selected');
      });
      formatOption.classList.add('selected');
      textArea.placeholder = getPlaceholderForFormat(format.id);
    });
    
    formatOptions.appendChild(formatOption);
  });
  
  formatSelector.appendChild(formatLabel);
  formatSelector.appendChild(formatOptions);
  
  // Create text area for input
  const textArea = document.createElement('textarea');
  textArea.className = 'deck-import-textarea';
  textArea.placeholder = getPlaceholderForFormat('standard');
  
  // Create file input option
  const fileInputContainer = document.createElement('div');
  fileInputContainer.className = 'file-input-container';
  
  const fileInputLabel = document.createElement('label');
  fileInputLabel.textContent = 'Or import from file:';
  fileInputLabel.className = 'file-input-label';
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.json,.dek,.ydk';
  fileInput.className = 'deck-file-input';
  
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      textArea.value = e.target.result;
      
      // Auto-detect format
      const format = detectFormatFromFile(file.name, e.target.result);
      document.querySelector(`.format-option[data-format="${format}"]`).click();
    };
    reader.readAsText(file);
  });
  
  fileInputContainer.appendChild(fileInputLabel);
  fileInputContainer.appendChild(fileInput);
  
  // Create action buttons
  const actionButtons = document.createElement('div');
  actionButtons.className = 'import-options-actions';
  
  const importButton = document.createElement('button');
  importButton.textContent = 'Import Deck';
  importButton.className = 'import-confirm-button';
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'import-cancel-button';
  
  actionButtons.appendChild(importButton);
  actionButtons.appendChild(cancelButton);
  
  // Add click handlers for buttons
  importButton.addEventListener('click', () => {
    const selectedFormat = document.querySelector('.format-option.selected')?.dataset.format || 'standard';
    const deckContent = textArea.value;
    
    if (!deckContent.trim()) {
      showPopup('Please enter deck content or select a file.');
      return;
    }
    
    // Set the deck content in the appropriate input element
    const input = document.getElementById(user === 'self' ? 'mainDeckImportInput' : 'altDeckImportInput');
    input.value = deckContent;
    
    // Import the deck with the selected format
    document.body.removeChild(modalOverlay);
    
    // Use enhanced import with selected format
    const enhancedImport = window.enhancedImportDecklist || importDecklist;
    enhancedImport(user, selectedFormat);
  });
  
  cancelButton.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  // Assemble modal
  modalContent.appendChild(header);
  modalContent.appendChild(formatSelector);
  modalContent.appendChild(textArea);
  modalContent.appendChild(fileInputContainer);
  modalContent.appendChild(actionButtons);
  
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  // Select first format by default
  document.querySelector('.format-option').click();
};

// Helper functions
const getPlaceholderForFormat = (formatId) => {
  switch (formatId) {
    case 'json':
      return '{\n  "cards": [\n    {"quantity": 4, "name": "Pikachu", "set": "BRS", "setNumber": "52", "type": "Pokémon"},\n    {"quantity": 2, "name": "Professor\'s Research", "set": "SSH", "setNumber": "178", "type": "Trainer"}\n  ]\n}';
    case 'ptcgo':
      return '****** Pokémon Trading Card Game Deck List ******\n\n##Pokémon - 10\n* 3 Pikachu SUM 20\n* 2 Raichu TEU 41\n\n##Trainer Cards - 10\n* 4 Professor\'s Research SSH 178\n* 4 Quick Ball SSH 179\n\n##Energy - 8\n* 8 Lightning Energy SUM 167\n\nTotal Cards - 28';
    case 'lackey':
      return '<deck version="0.8">\n  <meta>\n    <game>pokemon_custom</game>\n  </meta>\n  <superzone name="Deck">\n    <card><name id="BRS_052">Pikachu (BRS)</name><set>BRS</set></card>\n    <card><name id="SSH_178">Professor\'s Research (SSH)</name><set>SSH</set></card>\n  </superzone>\n</deck>';
    default:
      return '4 Pikachu BRS 52\n2 Professor\'s Research SSH 178\n4 Quick Ball SSH 179\n8 Lightning Energy 4';
  }
};

// Fix for the detectFormatFromFile function in custom-deck-categories.js

const detectFormatFromFile = (fileName, content) => {
    // Detect by file extension
    if (fileName.endsWith('.json')) {
      return 'json';
    } else if (fileName.endsWith('.dek')) {
      return 'lackey';
    } else if (fileName.endsWith('.txt') && content.includes('|') && /\d+\|.+\|.+\|https?:\/\//.test(content)) {
      return 'customUrl';
    }
    
    // Detect by content patterns
    if (content.trim().startsWith('{')) {
      try {
        JSON.parse(content);
        return 'json';
      } catch (e) {
        // Not valid JSON
      }
    }
    
    if (content.includes('<deck version') && content.includes('<superzone')) {
      return 'lackey';
    }
    
    if (content.includes('****** Pokémon Trading Card Game Deck List ******')) {
      return 'ptcgo';
    }
    
    if (content.includes('|') && /\d+\|.+\|.+\|https?:\/\//.test(content)) {
      return 'customUrl';
    }
    
    // Default to standard format
    return 'standard';
  };
  
  // Load user's saved decks
  const loadMyDecks = async () => {
    // Check local storage for saved decks
    const savedDecksJson = localStorage.getItem('savedDecks');
    
    if (!savedDecksJson) {
      return [];
    }
    
    try {
      return JSON.parse(savedDecksJson);
    } catch (error) {
      console.error('Error parsing saved decks:', error);
      return [];
    }
  };
  
  // Function to refresh deck list
  const refreshDeckList = (deckListContainer) => {
    const activeCategory = document.querySelector('.deck-subcategory.active');
    if (activeCategory) {
      const categoryId = activeCategory.closest('.deck-category').dataset.categoryId;
      const subcategoryId = activeCategory.dataset.subcategoryId;
      
      // Re-trigger category loading
      loadDecksForCategory(
        categoryId,
        subcategoryId,
        deckListContainer,
        document.querySelector('.deck-details-panel'),
        document.querySelector('.deck-select-button')
      );
    }
  };
  
  // Show card preview on hover
  const cardPreviewElement = document.createElement('div');
  cardPreviewElement.className = 'card-preview';
  cardPreviewElement.style.display = 'none';
  document.body.appendChild(cardPreviewElement);
  
  const showCardPreview = (imageUrl) => {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Card Preview';
    
    cardPreviewElement.innerHTML = '';
    cardPreviewElement.appendChild(img);
    cardPreviewElement.style.display = 'block';
    
    // Update position on mouse move
    document.addEventListener('mousemove', updateCardPreviewPosition);
  };
  
  const hideCardPreview = () => {
    cardPreviewElement.style.display = 'none';
    document.removeEventListener('mousemove', updateCardPreviewPosition);
  };
  
  const updateCardPreviewPosition = (event) => {
    const x = event.clientX + 20;
    const y = event.clientY + 20;
    
    // Adjust position to keep preview on screen
    const preview = cardPreviewElement;
    const rightEdge = x + preview.offsetWidth;
    const bottomEdge = y + preview.offsetHeight;
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const adjustedX = rightEdge > viewportWidth ? event.clientX - preview.offsetWidth - 20 : x;
    const adjustedY = bottomEdge > viewportHeight ? event.clientY - preview.offsetHeight - 20 : y;
    
    preview.style.left = `${adjustedX}px`;
    preview.style.top = `${adjustedY}px`;
  };