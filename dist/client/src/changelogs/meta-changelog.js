// meta-changelog.js - Contains changelog content for the Meta-PTCG fork

const metaChangelogContent = `
<h2>Meta-PTCG v0.1.0 - Initial Fork Release (03/16/25)</h2>
<p>Welcome to the first release of Meta-PTCG, a fork of the original PTCG-sim with added features for custom meta formats!</p>

<p><strong>NEW FEATURES</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Meta Format Support: </strong>Added support for custom meta formats with specialized rulesets.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Enhanced Card Database: </strong>Expanded card database to better support custom formats and banned/restricted lists.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Custom Format Selector: </strong>New dropdown menu to select between different meta formats when setting up games.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Forte Button and Misc Game Markers:</strong> Added and optimized game mechanics to include the "Forte" button and miscellaneous game markers, enhancing gameplay for meta formats with diverse card types, tokens, and markers.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Neon Glow CSS:</strong> Added vibrant coloring and neon glow effects to the game board for both self and opponent elements, improving visual appeal.</li>
</ul>

<p><strong>IMPROVEMENTS</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Cloudflare Optimization:</strong> Optimized the website to run efficiently on Cloudflare.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Changelog and Index Script Enhancements:</strong> Modified changelog and index scripts for better version control and enhanced functionality.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Game Board CSS Enhancements:</strong> Enhanced the CSS in the game board for both self and opponent elements for more vibrant coloring and neon glow effects.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Code Optimization:</strong> Optimized parts of the code for this fork, maintaining loose compatibility with the main branch.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>DarkMode Script Optimization:</strong> optimized the scripts for darkmode.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Background Changes:</strong> Changed the background.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>New Game Logic:</strong> Added new game logic for additional future customization.</li>
</ul>

<p><strong>COMING SOON</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
    <li style="font-size: 16px; margin-bottom: 10px;">More custom features for custom meta.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">Add custom meta based decks and potentially change the logic used for importing and exporting decks.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">Further visual rework of the script.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">Enhanced chat features and expansions.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">Organization of other css, game modules and variables and js scripts to allow better faster expansion and itteration for more modular functionality.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">Automatic format validation for decklists.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">Format-specific game rule enforcement.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">In-game tournament bracket system for Meta format events.</li>
    <li style="font-size: 16px; margin-bottom: 10px;">Enhanced spectator features for tournament streaming.</li>
</ul>

<p><strong>RECOMMENDATIONS FOR CODE CLEANUP AND IMPROVEMENT</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Modularize CSS:</strong> Break down large CSS files into smaller, more manageable modules based on functionality (e.g., game board, UI elements, animations).</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Refactor JavaScript Functions:</strong> Identify and refactor large, complex JavaScript functions into smaller, more focused functions for better readability and maintainability.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Centralize Configuration:</strong> Move hardcoded values and configuration settings into a centralized configuration file or object for easier updates and management.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Implement a State Management System:</strong> Consider using a state management library or pattern to manage the application's state, especially as it grows in complexity.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Improve Code Documentation:</strong> Add more comments and documentation to the code to explain its functionality and purpose, making it easier for others (and yourself) to understand.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Standardize Naming Conventions:</strong> Adopt consistent naming conventions for variables, functions, and classes to improve code readability and maintainability.</li>
    <li style="font-size: 16px; margin-bottom: 10px;"><strong>Optimize Event Handling:</strong> Ensure event listeners are properly managed and removed when no longer needed to prevent memory leaks and improve performance.</li>
</ul>

<p>Thanks for checking out Meta-PTCG! This project aims to provide a dedicated platform for custom meta formats while maintaining compatibility with the original PTCG-sim.</p>
<strong>- Meta-PTCG Team</strong>
`;

// Export the content so it can be used in other scripts
if (typeof module !== 'undefined') {
  module.exports = { metaChangelogContent };
} else {
  // For browser environment
  window.metaChangelogContent = metaChangelogContent;
  console.log('Meta Changelog Content Assigned:', window.metaChangelogContent);
}
