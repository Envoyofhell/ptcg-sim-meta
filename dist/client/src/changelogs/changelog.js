// changelog.js - Main script to handle changelog functionality

document.addEventListener('DOMContentLoaded', function () {
  // --------------------------------------------------------------------------
  // 1. Get references to DOM elements
  // --------------------------------------------------------------------------

  const changelogLink = document.getElementById('changelogLink');
  const metaChangelogLink = document.getElementById('metaChangelogLink');
  const changelogDiv = document.getElementById('changelog');

  // --------------------------------------------------------------------------
  // 2. Initial setup
  // --------------------------------------------------------------------------

  // Initially hide the changelog div
  changelogDiv.style.display = 'none';

  // --------------------------------------------------------------------------
  // 3. Function to toggle changelog visibility with specific content
  // --------------------------------------------------------------------------

  function toggleChangelog(content) {
    if (changelogDiv.style.display === 'none') {
      console.log('Setting changelog content:', content);
      changelogDiv.innerHTML = content;
      console.log('Setting changelog display: block');
      changelogDiv.style.display = 'block';
      console.log('changelogDiv display style:', changelogDiv.style.display);
    } else {
      console.log('Setting changelog display: none');
      changelogDiv.style.display = 'none';
    }
  }

  // --------------------------------------------------------------------------
  // 4. Function to close the changelog
  // --------------------------------------------------------------------------

  function closeChangelog() {
    console.log('Closing changelog');
    changelogDiv.style.display = 'none';
    unhighlightLinks(); // Unhighlight links when closing
  }

  // --------------------------------------------------------------------------
  // 5. Event listener for the main changelog link
  // --------------------------------------------------------------------------

  if (changelogLink) {
    changelogLink.addEventListener('click', function (event) {
      console.log('Main changelog link clicked');
      console.log('Main Changelog Content:', window.mainChangelogContent);
      event.stopPropagation();

      if (
        changelogDiv.style.display === 'block' &&
        changelogDiv.innerHTML === window.mainChangelogContent
      ) {
        // If the changelog is open and showing the main changelog, close it
        closeChangelog();
      } else {
        // Otherwise, close any open changelog and open the main changelog
        if (changelogDiv.style.display === 'block') {
          closeChangelog();
        }
        toggleChangelog(window.mainChangelogContent);
      }
    });
  } else {
    console.warn('Main changelog link element not found.');
  }

  // --------------------------------------------------------------------------
  // 6. Event listener for the meta changelog link
  // --------------------------------------------------------------------------

  if (metaChangelogLink) {
    metaChangelogLink.addEventListener('click', function (event) {
      console.log('Meta changelog link clicked');
      console.log('Meta Changelog Content:', window.metaChangelogContent);
      event.stopPropagation();

      if (
        changelogDiv.style.display === 'block' &&
        changelogDiv.innerHTML === window.metaChangelogContent
      ) {
        // If the changelog is open and showing the meta changelog, close it
        closeChangelog();
      } else {
        // Otherwise, close any open changelog and open the meta changelog
        if (changelogDiv.style.display === 'block') {
          closeChangelog();
        }
        toggleChangelog(window.metaChangelogContent);
      }
    });
  } else {
    console.warn('Meta changelog link element not found.');
  }

  // --------------------------------------------------------------------------
  // 7. Close changelog when clicking outside of it
  // --------------------------------------------------------------------------

  document.addEventListener('click', function (event) {
    if (
      changelogDiv.style.display === 'block' &&
      !changelogDiv.contains(event.target) &&
      event.target !== changelogLink &&
      event.target !== metaChangelogLink
    ) {
      closeChangelog();
    }
  });

  // --------------------------------------------------------------------------
  // 8. Feature: Close changelog on Escape key press
  // --------------------------------------------------------------------------

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && changelogDiv.style.display === 'block') {
      closeChangelog();
    }
  });

  // --------------------------------------------------------------------------
  // 9. Feature: Add a close button inside the changelog div
  // --------------------------------------------------------------------------

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '10px';
  closeButton.style.right = '10px';
  closeButton.style.cursor = 'pointer';

  closeButton.addEventListener('click', function () {
    closeChangelog();
  });

  changelogDiv.appendChild(closeButton);

  // --------------------------------------------------------------------------
  // 10. Feature: Highlight clicked changelog link
  // --------------------------------------------------------------------------

  function highlightLink(link) {
    if (link) {
      link.style.fontWeight = 'bold';
      link.style.textDecoration = 'underline';
    }
  }

  function unhighlightLinks() {
    if (changelogLink) {
      changelogLink.style.fontWeight = 'normal';
      changelogLink.style.textDecoration = 'none';
    }
    if (metaChangelogLink) {
      metaChangelogLink.style.fontWeight = 'normal';
      metaChangelogLink.style.textDecoration = 'none';
    }
  }

  if (changelogLink) {
    changelogLink.addEventListener('click', function () {
      unhighlightLinks();
      highlightLink(changelogLink);
    });
  }

  if (metaChangelogLink) {
    metaChangelogLink.addEventListener('click', function () {
      unhighlightLinks();
      highlightLink(metaChangelogLink);
    });
  }
});
