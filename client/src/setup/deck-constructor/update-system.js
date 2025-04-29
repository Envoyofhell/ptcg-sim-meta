// filename: client/src/setup/deck-constructor/update-system.js
/**
 * Update System Module
 * Purpose: Implement a LackeyCCG-style update system for cards and decks
 * @author: [Your Name]
 * @created: April 28, 2025
 */

import { showPopup } from '../general/pop-up-message.js';
import { systemState } from '../../front-end.js';

// Check for updates
export const checkForUpdates = async () => {
  try {
    const currentVersion = localStorage.getItem('cardDataVersion') || '0';
    const response = await fetch(`/api/updates?version=${currentVersion}`);
    
    if (!response.ok) {
      throw new Error('Failed to check for updates');
    }
    
    const updateInfo = await response.json();
    
    if (updateInfo.updates_available) {
      return {
        hasUpdates: true,
        currentVersion: updateInfo.current_version,
        latestVersion: updateInfo.latest_version,
        updateListUrl: updateInfo.update_list_url
      };
    }
    
    return { hasUpdates: false };
  } catch (error) {
    console.error('Error checking for updates:', error);
    return { hasUpdates: false, error: error.message };
  }
};

// Parse update list (similar to LackeyCCG format)
export const parseUpdateList = async (updateListUrl) => {
  try {
    const response = await fetch(updateListUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch update list');
    }
    
    const updateListText = await response.text();
    const updates = [];
    
    // Parse the update list format
    const lines = updateListText.split('\n');
    let currentDate = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // First line typically contains plugin name and date
      if (i === 0) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          currentDate = parts[1];
        }
        continue;
      }
      
      // Typical line format: path/to/file.ext URL checksum
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const filePath = parts[0].trim();
        const fileUrl = parts[1].trim();
        const checksum = parts.length >= 3 ? parts[2].trim() : '';
        
        updates.push({
          filePath,
          fileUrl,
          checksum
        });
      }
    }
    
    return {
      date: currentDate,
      files: updates
    };
  } catch (error) {
    console.error('Error parsing update list:', error);
    throw error;
  }
};

// Apply updates
export const applyUpdates = async (updateInfo) => {
  try {
    showPopup(`Downloading updates... (0/${updateInfo.files.length})`);
    
    const downloadResults = [];
    const totalFiles = updateInfo.files.length;
    let completedFiles = 0;
    
    // Process updates in batches to avoid overwhelming browser
    const batchSize = 5;
    
    for (let i = 0; i < totalFiles; i += batchSize) {
      const batch = updateInfo.files.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (file) => {
        try {
          const response = await fetch(file.fileUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to download ${file.filePath}`);
          }
          
          // Handle different file types
          if (file.filePath.endsWith('.txt')) {
            // For text files like carddata.txt, formats.txt, etc.
            const text = await response.text();
            
            // Store in IndexedDB or localStorage depending on size
            if (text.length > 500000) {
              // Large files go to IndexedDB
              await storeFileInIndexedDB(file.filePath, text);
            } else {
              // Smaller files can go to localStorage
              localStorage.setItem(getStorageKey(file.filePath), text);
            }
            
          } else if (file.filePath.endsWith('.dek')) {
            // For deck files
            const text = await response.text();
            await storeFileInIndexedDB(`decks/${getFilenameFromPath(file.filePath)}`, text);
            
          } else if (/\.(jpg|png|gif)$/i.test(file.filePath)) {
            // For image files
            const blob = await response.blob();
            await storeFileInIndexedDB(`images/${getFilenameFromPath(file.filePath)}`, blob);
          }
          
          completedFiles++;
          showPopup(`Downloading updates... (${completedFiles}/${totalFiles})`);
          
          return { file, success: true };
        } catch (error) {
          console.error(`Error downloading ${file.filePath}:`, error);
          return { file, success: false, error: error.message };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      downloadResults.push(...batchResults);
    }
    
    // Count successful and failed downloads
    const successful = downloadResults.filter(r => r.success).length;
    const failed = downloadResults.filter(r => !r.success).length;
    
    // Update version in localStorage
    localStorage.setItem('cardDataVersion', updateInfo.date || new Date().toISOString().split('T')[0]);
    
    showPopup(`Update complete. ${successful} files updated, ${failed} failed.`);
    
    return {
      success: true,
      stats: {
        total: totalFiles,
        successful,
        failed
      }
    };
  } catch (error) {
    console.error('Error applying updates:', error);
    showPopup(`Update failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
};

// Helper functions
const getFilenameFromPath = (path) => {
  return path.split('/').pop();
};

const getStorageKey = (path) => {
  return `ptcg_file_${path.replace(/\//g, '_')}`;
};

// IndexedDB operations for large files
const dbName = 'PTCGSimDB';
const objectStoreName = 'files';

const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(objectStoreName)) {
        db.createObjectStore(objectStoreName);
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

const storeFileInIndexedDB = async (key, data) => {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([objectStoreName], 'readwrite');
    const store = transaction.objectStore(objectStoreName);
    const request = store.put(data, key);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

const getFileFromIndexedDB = async (key) => {
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([objectStoreName], 'readonly');
    const store = transaction.objectStore(objectStoreName);
    const request = store.get(key);
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};