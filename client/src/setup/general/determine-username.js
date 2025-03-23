// File: client/src/setup/general/determine-username.js
/**
 * Determines the username for a given user
 * 
 * @param {string} user - 'self' or 'opp'
 * @returns {string} The username for the specified user
 */
import { systemState } from '../../front-end.js';

export const determineUsername = (user) => {
  // For two-player games
  if (systemState.isTwoPlayer) {
    if (user === 'self') {
      return systemState.p2SelfUsername || 'You';
    } else {
      return systemState.p2OppUsername || 'Opponent';
    }
  } 
  
  // For single-player games, use the p1 username function
  // This fixes the "systemState.p1Username is not a function" error
  if (typeof systemState.usernames.p1 === 'function') {
    return systemState.usernames.p1(user);
  }
  
  // Fallback names if p1 is not a function
  return user === 'self' ? 'Blue' : 'Red';
};