import decklistsByYear from './ClassicDeckList/classic-decklists-by-year.js';

const altDeckImportInput = document.getElementById('altDeckImportInput');
const deckImport = document.getElementById('deckImport');
const decklistsButton = document.getElementById('decklistsButton');
const decklistsContextMenu = document.getElementById('decklistsContextMenu');
const mainDeckImportInput = document.getElementById('mainDeckImportInput');

export const getRandomDeckList = () => {
  const years = Object.keys(decklistsByYear);
  const randomYear = years[Math.floor(Math.random() * years.length)];
  const decks = Object.keys(decklistsByYear[randomYear]);
  const randomDeck = decks[Math.floor(Math.random() * decks.length)];
  return decklistsByYear[randomYear][randomDeck];
};

export const showDecklistsContextMenu = () => {
  decklistsContextMenu.innerHTML = '';

  const classicDeckListFolder = document.createElement('div');
  classicDeckListFolder.classList.add('decklists-context-menu-item');
  classicDeckListFolder.textContent = 'Classic Deck List';

  const years = Object.keys(decklistsByYear).reverse(); // Reverse the years

  for (const year of years) {
    const yearItem = document.createElement('div');
    yearItem.classList.add('decklists-context-menu-item');
    yearItem.textContent = year;

    const deckSubMenu = document.createElement('div');
    deckSubMenu.classList.add('decklists-context-menu-sub-menu');

    const decks = Object.keys(decklistsByYear[year]).reverse(); // Reverse the decks

    for (const deck of decks) {
      const deckItem = document.createElement('div');
      deckItem.classList.add('decklists-context-menu-item');
      deckItem.textContent = deck;
      deckItem.addEventListener('click', () => {
        const input =
          mainDeckImportInput.style.display !== 'none'
            ? mainDeckImportInput
            : altDeckImportInput;
        input.value = '';
        input.value = decklistsByYear[year][deck];
        decklistsContextMenu.style.display = 'none';
      });

      deckSubMenu.appendChild(deckItem);

      // Add event listener for mouseover to highlight/bold the item
      deckItem.addEventListener('mouseover', () => {
        deckItem.classList.add('decklist-highlight');
      });

      // Add event listener for mouseout to remove the highlight/bold
      deckItem.addEventListener('mouseout', () => {
        deckItem.classList.remove('decklist-highlight');
      });
    }

    yearItem.appendChild(deckSubMenu);
    classicDeckListFolder.appendChild(yearItem);

    // Add event listener for mouseover to show the submenu
    yearItem.addEventListener('mouseover', () => {
      deckSubMenu.style.display = 'block';
      yearItem.style.fontWeight = 'bold';
    });

    // Add event listener for mouseout to hide the submenu
    yearItem.addEventListener('mouseout', () => {
      deckSubMenu.style.display = 'none';
      yearItem.style.fontWeight = 'normal';
    });
  }

  decklistsContextMenu.appendChild(classicDeckListFolder);

  // Add event listener for mouseover to show the submenu
  classicDeckListFolder.addEventListener('mouseover', () => {
    classicDeckListFolder.style.fontWeight = 'bold';
  });

  // Add event listener for mouseout to hide the submenu
  classicDeckListFolder.addEventListener('mouseout', () => {
    classicDeckListFolder.style.fontWeight = 'normal';
  });

  const adjustment = deckImport.offsetHeight - decklistsButton.offsetTop;
  decklistsContextMenu.style.bottom = `${adjustment}px`;

  decklistsContextMenu.style.display = 'block';
  // Use mousedown event to hide the menu when clicking outside
  document.addEventListener('mousedown', hidedecklistsContextMenu);
};

// Function to hide the context menu
const hidedecklistsContextMenu = (event) => {
  if (!decklistsContextMenu.contains(event.target)) {
    decklistsContextMenu.style.display = 'none';
    document.removeEventListener('mousedown', hidedecklistsContextMenu);
  }
};