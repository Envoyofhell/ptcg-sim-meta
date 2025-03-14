import { initializeHeaderButtons } from './header-buttons.js';
import { initializeImport } from './import-deck.js';
import { initializeP1Page } from './p1/initialize-p1-page.js';
import { initializeP2Page } from './p2/initialize-p2-page.js';
import { initializeSettings } from './settings.js';

export const initializeSidebox = () => {
  console.log('Initializing sidebox...');

  // Create an array of initialization functions and their corresponding log messages
  const initializers = [
    { fn: initializeHeaderButtons, name: 'Header buttons' },
    { fn: initializeP1Page, name: 'P1 Page' },
    { fn: initializeP2Page, name: 'P2 Page' },
    { fn: initializeSettings, name: 'Settings' },
    { fn: initializeImport, name: 'Import functionality' },
  ];

  // Loop through each initializer and execute it
  initializers.forEach(({ fn, name }) => {
    try {
      fn();
      console.log(`${name} initialized successfully.`);
    } catch (error) {
      console.error(`Failed to initialize ${name}:`, error);
    }
  });
};