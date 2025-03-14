/**
 * Front-end Initialization Module for PTCG Simulator
 * Manages application initialization, event listeners, and core setup
 * 
 * @module FrontEnd
 * @description Handles application bootstrap and core initialization
 */

// Enhanced logging utility
const logger = {
  error: (message, details = {}) => {
    console.error(`[Front-end Error] ${message}`, details);
    // Optional: Add more advanced error tracking or reporting
  },
  warn: (message, details = {}) => {
    console.warn(`[Front-end Warning] ${message}`, details);
  },
  info: (message, details = {}) => {
    console.info(`[Front-end Info] ${message}`, details);
  }
};

// Import initialization scripts with error handling
const safeImport = async (importPath, moduleName) => {
  try {
    const module = await import(importPath);
    logger.info(`Successfully imported ${moduleName}`);
    return module;
  } catch (error) {
    logger.error(`Failed to import ${moduleName}`, { error });
    throw error;
  }
};

// Centralized initialization manager
const initializationManager = {
  async importModules() {
    try {
      return {
        initializeDOMEventListeners: (await safeImport('./initialization/document-event-listeners/initialize-document-event-listeners.js', 'DOM Event Listeners')).initializeDOMEventListeners,
        loadImportData: (await safeImport('./initialization/load-import-data/load-import-data.js', 'Import Data')).loadImportData,
        initializeMutationObservers: (await safeImport('./initialization/mutation-observers/initialize-mutation-observers.js', 'Mutation Observers')).initializeMutationObservers,
        initializeSocketEventListeners: (await safeImport('./initialization/socket-event-listeners/socket-event-listeners.js', 'Socket Event Listeners')).initializeSocketEventListeners
      };
    } catch (error) {
      logger.error('Failed to import initialization modules', { error });
      throw error;
    }
  },

  async initializeApp() {
    try {
      const modules = await this.importModules();
      
      // Sequential initialization with error handling
      await modules.initializeSocketEventListeners();
      await modules.initializeDOMEventListeners();
      await modules.initializeMutationObservers();
      await modules.loadImportData();

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Application initialization failed', { error });
    }
  }
};

// Import global variables and state with enhanced error handling
const importGlobalVariables = async () => {
  try {
    const globalVariables = await safeImport('./initialization/global-variables/global-variables.js', 'Global Variables');
    return {
      socket: globalVariables.socket,
      systemState: globalVariables.systemState,
      mouseClick: globalVariables.mouseClick,
      version: globalVariables.version
    };
  } catch (error) {
    logger.error('Failed to import global variables', { error });
    return {};
  }
};

// Resizer import with fallback
const importResizer = async () => {
  try {
    const resizerModule = await safeImport('../setup/sizing/resizer.js', 'Resizer');
    return resizerModule.createResizer ? resizerModule : null;
  } catch (error) {
    logger.error('Failed to import resizer module', { error });
    return null;
  }
};

// Container reference utility with error handling
const safeGetContainerReference = (id) => {
  const element = document.getElementById(id);
  if (!element) {
    logger.warn(`Container with ID ${id} not found`);
    return null;
  }
  return element;
};

// Main initialization function
const initializeFrontEnd = async () => {
  try {
    // Parallel initialization of dependencies
    const [
      globalVars, 
      resizerModule
    ] = await Promise.all([
      importGlobalVariables(),
      importResizer()
    ]);

    // Container references with error handling
    const selfContainerDocument = safeGetContainerReference('selfContainer');
    const oppContainerDocument = safeGetContainerReference('oppContainer');

    if (!selfContainerDocument || !oppContainerDocument) {
      throw new Error('Failed to retrieve container references');
    }

    // Resizer setup with dependency injection
    const resizerParams = {
      selfContainer: selfContainerDocument,
      oppContainer: oppContainerDocument,
      selfContainerDocument,
      oppContainerDocument,
      getInitiator: () => globalVars.systemState.initiator
    };

    const resizer = resizerModule ? resizerModule(resizerParams) : null;

    // Initialize application
    await initializationManager.initializeApp();

    // Export essential modules and references
    return {
      // Global variables
      ...globalVars,
      
      // Container documents
      selfContainerDocument,
      oppContainerDocument,
      
      // Backwards compatibility aliases
      oppContainer: oppContainerDocument,
      selfContainer: selfContainerDocument,

      // Resizer functions with fallback
      selfHandleMouseDown: resizer?.selfHandleMouseDown,
      oppHandleMouseDown: resizer?.oppHandleMouseDown,
      flippedSelfHandleMouseDown: resizer?.flippedSelfHandleMouseDown,
      flippedOppHandleMouseDown: resizer?.flippedOppHandleMouseDown
    };
  } catch (error) {
    logger.error('Front-end initialization failed', { error });
    return null;
  }
};

// Execute initialization
initializeFrontEnd()
  .then(frontEndModules => {
    if (frontEndModules) {
      // Export modules globally or use as needed
      Object.entries(frontEndModules).forEach(([key, value]) => {
        window[key] = value;
      });
    }
  })
  .catch(error => {
    logger.error('Failed to initialize front-end modules', { error });
  });

// Optional global error handler
window.addEventListener('error', (event) => {
  logger.error('Unhandled front-end error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

export default initializeFrontEnd;