// main-changelog.js - Contains changelog content for the original PTCG-sim

const mainChangelogContent = `
<h2>v1.5.1 Update 02/12/25</h2>
<p>Super quick update here—there are only a few visual changes to the site, but the codebase had a HUGE cleanup (which makes me feel great lol).</p>

<p><strong>BUG FIXES</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
<li style="font-size: 16px; margin-bottom: 10px;">Fixed issue where the card types were lost when going from 2P to 1P mode.</li>
<li style="font-size: 16px; margin-bottom: 10px;">Fixed issue where the board wouldn't properly refresh if images failed to load.</li>
</ul>

<p><strong>SHOUTOUTS:</strong></p>
<p><strong>SoulSilver sponsors: </strong>Arielle Lok, Bertie Vos, Jack Shwartz, Morgan Gallant & Anonymous.<br>
<strong>HeartGold sponsors: </strong>Ciaran Farah!</p>

<p>Happy early Valentine's Day <3</p>
<strong>- XXL</strong>
<br><br>
<hr>

<h2>v1.5.0 Update 12/30/24</h2>
<p>HAPPY HOLIDAYS!!! I've missed you guys... I can't believe it's already been a year since PTCG-sim was launched — the past 365 days have brought incredible changes to my life, and it's all thanks to you guys <3</p>

<p><strong>NEW FEATURE</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
<li style="font-size: 16px; margin-bottom: 10px;"><strong>Replay Mode: </strong>You can now watch and analyze your games from start to finish! This feature is available in 1P mode and can be accessed through the "Options" button, in the same menu as Import/Export. Perfect for reviewing games, creating content, or sharing cool moments with friends.</li>
</ul>

<p><strong>OTHER ADDITIONS/CHANGES</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
<li style="font-size: 16px; margin-bottom: 10px;">Added full macOS keybind support - all keyboard shortcuts should now work properly on Apple devices.</li>
<li style="font-size: 16px; margin-bottom: 10px;">Version number is now included in exports to ensure proper tracking of updates and backwards compatibility.</li>
<li style="font-size: 16px; margin-bottom: 10px;">Fixed damage counter bug where manually typing numbers would cause display issues.</li>
<li style="font-size: 16px; margin-bottom: 10px;">Expanded card database compatibility with many new cards, type updates, and improved compatibility with Limitless cards.</li>
</ul>

<p><strong>COMING SOON</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
<li style="font-size: 16px; margin-bottom: 10px;">As many of you know, PTCG-sim was my first ever coding project. As such, the codebase has some very, VERY, questionable, gnarly, unfathomable, inexplicable code 😅. I've decided to completely revamp the simulator in the future - there's simply too much technical debt, but I'm incredibly proud of how far we've come!</li>
<li style="font-size: 16px; margin-bottom: 10px;">I'm also SUPER excited to dive deep into developing a game AI for the Pokemon TCG. If you're interested in collaborating on this, definitely reach out - I'd love to chat! :)</li>
</ul>

<p><strong>As always, a HUGE THANKS TO:</strong></p>
<p><strong>SoulSilver sponsors:</strong> Bertie Vos, Jack Shwartz, Morgan Gallant & Anonymous.<br>
<strong>HeartGold sponsors:</strong> Arielle Lok.</p>

<p>Enjoy the holidays everyone, and cheers to 2025! 🍻</p>
<strong>- XXL <3 :D</strong>
<br><br>
<hr>
<h2>v1.4.0 Update 05/08/24</h2>
<p>Yoyoyo! It's been a fat second guys — life has been busy, but I'm super happy to release this update :)</p>

<p><strong>NEW FEATURE</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
<li style="font-size: 16px; margin-bottom: 10px;"><strong>Importing/Exporting Game States (BETA): </strong>You can now export your game state as a JSON file or custom URL! 
    <li style="font-size: 14px; margin-bottom: 10px; margin-left: 20px"><strong>JSON file: </strong>This is great for saving/organizing games that you want to revisit in the future. JSON files supports importing in 2P, which means that it loads the game state for the opponent too. This is useful if a player has disconnected during a game* or players want to analyze a game together. 
    <br><br>
    <em>*The connected player MUST export the game BEFORE the other player rejoins, or else the game state will be reset and lost.</em></li>
    <li style="font-size: 14px; margin-bottom: 10px; margin-left: 20px"><strong>Custom URL: </strong>This is great for sharing cool games with friends on social media! The link directly loads the game state, making it super accessible. Only 1P is supported.</li></ul>
</li>
</ul>

<p><strong>OTHER ADDITIONS/CHANGES</strong></p>
<ul style="list-style-type: disc; padding-left: 20px; margin-top: 10px; margin-bottom: 20px;">
<li style="font-size: 16px; margin-bottom: 10px;">Hovering over the board buttons now explains its function (e.g., the refresh images and flip board buttons).</li>
<li style="font-size: 16px; margin-bottom: 10px;">"Change type" now supports changing type to Pokemon. Note that putting a card directly into play (i.e., putting it in an empty active or bench spot) still automatically changes the type of the card to Pokemon.</li>
<li style="font-size: 16px; margin-bottom: 10px;">"Refresh Images" button now refreshes the images of the deck and prizes in addition to all cards in play.</li>
<li style="font-size: 16px; margin-bottom: 10px;">Added a full screen button in the "Options" menu. Highly recommend playing in full screen!</li>
<li style="font-size: 16px; margin-bottom: 10px;">Added CubeKoga support for compatibility with SVE Basic Energies and Hidden Fates Shiny Vault.</li>
</ul>
`;

// Export the content so it can be used in other scripts
if (typeof module !== 'undefined') {
  module.exports = { mainChangelogContent };
} else {
  // For browser environment
  window.mainChangelogContent = mainChangelogContent;
  console.log('Main Changelog Content Assigned:', window.mainChangelogContent);
}
