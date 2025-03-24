// File: client/src/setup/general/determine-username.js
/**
 * Username Determination Utility
 *
 * Determines the username for a given user with enhanced error handling
 * for better compatibility with offline mode and system state changes.
 */
import { systemState } from '../../front-end.js';

/**
 * Determines the username for a given user
 *
 * @param {string} user - 'self' or 'opp'
 * @returns {string} The username for the specified user
 */
export const determineUsername = (user) => {
  try {
    // For two-player games
    if (systemState.isTwoPlayer) {
      if (user === 'self') {
        return systemState.p2SelfUsername || 'You';
      } else {
        return systemState.p2OppUsername || 'Opponent';
      }
    }

    // For single-player games, use the p1 username function
    if (typeof systemState.usernames.p1 === 'function') {
      return systemState.usernames.p1(user);
    }

    // Fallback names if p1 is not a function
    return user === 'self' ? 'Blue' : 'Red';
  } catch (error) {
    console.error(`Error determining username: ${error.message}`);
    // Always provide a fallback value
    return user === 'self' ? 'Blue' : 'Red';
  }
};
