/**
 * API routes for PTCG-Sim-Meta
 * Handles all API endpoints for game state management
 */
import express from 'express';
import { getGameState, storeGameState, deleteGameState } from '../services/game-state.js';

// Create router
const router = express.Router();

/**
 * GET /api/importData
 * Retrieves game state by key
 */
router.get('/importData', async (req, res) => {
  const key = req.query.key;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'Key parameter is missing'
    });
  }
  
  try {
    const result = await getGameState(key);
    
    if (result.success) {
      // Try to parse the JSON data
      try {
        const jsonData = JSON.parse(result.data);
        return res.json(jsonData);
      } catch (parseError) {
        console.error('Error parsing JSON data:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Error parsing game state data'
        });
      }
    } else {
      return res.status(404).json({
        success: false,
        error: result.error || 'Game state not found'
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/storeGameState
 * Stores game state and returns a key
 */
router.post('/storeGameState', express.json(), async (req, res) => {
  const { data, key } = req.body;
  
  if (!data) {
    return res.status(400).json({
      success: false,
      error: 'Game state data is missing'
    });
  }
  
  try {
    const result = await storeGameState(data, key);
    
    if (result.success) {
      return res.json({
        success: true,
        key: result.key
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to store game state'
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/deleteGameState
 * Deletes a game state by key
 */
router.delete('/deleteGameState', async (req, res) => {
  const key = req.query.key;
  
  if (!key) {
    return res.status(400).json({
      success: false,
      error: 'Key parameter is missing'
    });
  }
  
  try {
    const result = await deleteGameState(key);
    
    if (result.success) {
      return res.json({
        success: true
      });
    } else {
      return res.status(404).json({
        success: false,
        error: result.error || 'Game state not found'
      });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;