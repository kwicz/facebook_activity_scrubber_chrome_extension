/**
 * Simple Last-Deleted Tracking System
 * Tracks the last 2 deleted posts to detect resurrection loops
 * If the same post tries to delete again, hide it with an error badge
 *
 * STORAGE: Uses window.lastDeletedActivities (in-memory)
 * PERSISTENCE: Saved to Chrome localStorage during page refreshes
 */

// Store last 2 deleted activities IN MEMORY (window object)
if (!window.lastDeletedActivities) {
  window.lastDeletedActivities = [];
}

/**
 * Extracts a simple signature from an element (textContent + timestamp)
 * @param {HTMLElement} element - The DOM element (menu button or article)
 * @returns {Object|null} - Object with textContent and timestamp, or null if extraction fails
 */
function extractActivitySignature(element) {
  try {
    // The "More options" button structure:
    // - Menu button has aria-label="More options"
    // - Go up to find the activity container (common parent)

    // Find the activity container - it's a few levels up from the menu button
    // The structure is: container > left side (profile + content) + right side (menu button)
    const menuButton = element.closest('[aria-label="More options"]') || element;

    // Go up to the common parent that contains both the content and menu button
    // This is typically 2-3 levels up
    let container = menuButton.parentElement?.parentElement?.parentElement;
    if (!container) {
      console.warn('[RESURRECTION] Could not find activity container');
      return null;
    }

    // Get the activity description text (e.g., "Katy Lee liked Scottathan Vernard Lehman's post.")
    // This is in the left side, in a specific div structure
    const activityText = container.querySelector('[role="button"] span[dir="auto"]');
    let textContent = '';
    if (activityText) {
      textContent = activityText.textContent.trim().replace(/\s+/g, ' ');
    } else {
      // Fallback: get all text from the left side
      const leftSide = container.querySelector('[role="button"]');
      if (leftSide) {
        textContent = leftSide.textContent.trim().replace(/\s+/g, ' ').substring(0, 200);
      }
    }

    // Get the timestamp (e.g., "4:39 PM")
    const timeElement = container.querySelector('span.xdmh292');
    let timestamp = '';
    if (timeElement) {
      // Find the time text (usually the last span with timestamp styling)
      const timeSpans = container.querySelectorAll('span.xdmh292');
      for (let i = timeSpans.length - 1; i >= 0; i--) {
        const text = timeSpans[i].textContent.trim();
        // Check if it looks like a time (contains : or "ago" or "AM"/"PM")
        if (text.match(/:|ago|AM|PM|\d+\s*(hour|minute|second|day|week|month|year)/i)) {
          timestamp = text;
          break;
        }
      }
    }

    // Try to find a profile link for additional uniqueness
    const profileLinks = container.querySelectorAll('a[href*="/"]');
    let profileHref = '';
    for (const link of profileLinks) {
      const href = link.getAttribute('href');
      if (href && href.includes('facebook.com/')) {
        profileHref = href;
        break;
      }
    }

    const signature = {
      textContent,
      timestamp,
      profileHref,
      article: container  // Keep reference to container for later manipulation
    };

    return signature;
  } catch (error) {
    console.error('[RESURRECTION] Error extracting activity signature:', error);
    return null;
  }
}

/**
 * Checks if this activity was recently deleted (in last 2 deletions)
 * @param {Object} signature - Activity signature with textContent and timestamp
 * @returns {boolean} - True if this was recently deleted
 */
function wasRecentlyDeleted(signature) {
  if (!signature || !window.lastDeletedActivities) {
    return false;
  }

  // Check if this matches any of the last 2 deleted activities
  let matchFound = false;
  window.lastDeletedActivities.forEach((deleted, index) => {
    const textMatch = deleted.textContent === signature.textContent;
    const timestampMatch = deleted.timestamp === signature.timestamp;
    const profileMatch = deleted.profileHref === signature.profileHref;

    // Match if text matches AND (timestamp matches OR both are empty) AND (profile matches OR either is empty)
    const isMatch = textMatch &&
                    (timestampMatch || deleted.timestamp === '' || signature.timestamp === '') &&
                    (profileMatch || deleted.profileHref === '' || signature.profileHref === '');

    if (isMatch) matchFound = true;
  });

  return matchFound;
}

/**
 * Records a deletion in the last-deleted tracking
 * @param {Object} signature - Activity signature with textContent and timestamp
 */
function recordDeletion(signature) {
  if (!signature || !window.lastDeletedActivities) {
    return;
  }

  // Add to the front of the array
  const record = {
    textContent: signature.textContent,
    timestamp: signature.timestamp,
    profileHref: signature.profileHref || '',
    deletedAt: Date.now()
  };

  window.lastDeletedActivities.unshift(record);

  // Keep only last 2
  if (window.lastDeletedActivities.length > 2) {
    window.lastDeletedActivities = window.lastDeletedActivities.slice(0, 2);
  }
}

/**
 * Hides the article node and marks it with an error badge
 * @param {HTMLElement} article - The article element (the container we want to hide)
 */
function hideArticleWithErrorBadge(article) {
  if (!article) return;

  try {
    // Create a badge element with actual content (not ::after pseudo-element)
    const badge = document.createElement('span');
    badge.textContent = 'Activity cannot be removed - Hiding instead';
    badge.style.cssText = `
      display: inline-block !important;
      background: #ff4444 !important;
      color: white !important;
      padding: 4px 8px !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      white-space: nowrap !important;
      z-index: 10000 !important;
      box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3) !important;
      border: 1px solid #cc0000 !important;
      float: right !important;
    `;

    // Create a wrapper div to hold the badge
    const badgeWrapper = document.createElement('div');
    badgeWrapper.className = 'fas-resurrection-error';
    badgeWrapper.style.cssText = 'position: relative; min-height: 30px; margin: 8px 26px;';
    badgeWrapper.appendChild(badge);

    // Hide the article (the activity content)
    article.style.display = 'none';

    // Insert the badge wrapper right before the hidden article
    article.parentNode.insertBefore(badgeWrapper, article);
  } catch (error) {
    console.error('[RESURRECTION] Error hiding article with badge:', error);
  }
}
