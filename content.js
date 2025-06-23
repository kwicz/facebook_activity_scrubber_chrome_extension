// Facebook Activity Scrubber Content Script
// Rewritten to use the same robust logic as the standalone script

// Inject CSS for permanent-tag styling
const style = document.createElement('style');
style.textContent = `
  .permanent-tag::after {
        content: "Untagged items cannot be removed";
        position: absolute;
        bottom: -25px;
        transform: translateX(-50%);
        background: #ff4444;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
        border: 1px solid #cc0000;
        pointer-events: none;
  }
`;
document.head.appendChild(style);

// Inject CSS styles for permanent profile change buttons
function injectStyles() {
  if (!document.getElementById('fb-cleaner-styles')) {
    const style = document.createElement('style');
    style.id = 'fb-cleaner-styles';
    style.textContent = `
      .permanent-profile-change::after {
        content: "Profile changes cannot be removed";
        position: absolute;
        bottom: -25px;
        transform: translateX(-50%);
        background: #ff4444;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(255, 68, 68, 0.3);
        border: 1px solid #cc0000;
        pointer-events: none;
      }
      
      .permanent-profile-change {
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize styles when script loads
injectStyles();

// --- Global State ---
let isRunning = false;
let isPaused = false;
let settings = {
  activityType: 'all',
  timeRange: 'all',
  batchSize: 10,
  pauseInterval: 1000,
  timing: {
    menuWait: 700,
    modalWait: 700,
    actionComplete: 1200,
    nextItem: 1000,
    pageLoad: 2500,
  },
  maxConsecutiveFailures: 5,
  maxPageRefreshes: 5,
  maxActionRetries: 2,
};

const stats = {
  deleted: 0,
  failed: 0,
  skipped: 0,
  total: 0,
  progress: 0,
  pageRefreshes: 0,
};

let consecutiveFailures = 0;
let pageRefreshes = 0;
const errorTypes = {}; // Track different types of errors

// --- Utility Functions ---
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isElementVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  );
}

// --- Activity Data Extraction ---
function extractActivityData(menuButton) {
  let activityDate = null;
  let activityType = null;
  let activityContent = null;
  let activityLink = null;

  try {
    // Find the parent activity log item that contains this menu button
    let activityItem = menuButton;

    // Traverse up to find the activity item container with aria-label="Activity Log Item"
    for (let i = 0; i < 15; i++) {
      activityItem = activityItem.parentElement;
      if (!activityItem) break;

      if (activityItem.getAttribute('aria-label') === 'Activity Log Item') {
        break;
      }
    }

    if (!activityItem) {
      log('Could not find Activity Log Item container', 'warn');
      return { activityDate, activityType, activityContent, activityLink };
    }

    // Get the activity date
    const dateElement = activityItem.querySelector('h2 span.html-span > span');
    if (dateElement) {
      activityDate = dateElement.textContent;
      log(`Found activity date: ${activityDate}`, 'info');
    }

    // Get the activity type using the specific CSS selector
    const activityTypeElement = activityItem.querySelector(
      'div:first-child > span[dir="auto"] > span.html-span > span.html-span > span > div'
    );
    if (activityTypeElement) {
      activityType = activityTypeElement.textContent;
      log(`Found activity type: ${activityType}`, 'info');
    }

    // Get the activity content using the specific CSS selector
    const activityContentElement = activityItem.querySelector(
      'div:nth-child(2) > span[dir="auto"] > span.html-span > span.html-span'
    );
    if (activityContentElement) {
      activityContent = activityContentElement.textContent;
      log(
        `Found activity content: ${activityContent.substring(0, 50)}${
          activityContent.length > 50 ? '...' : ''
        }`,
        'info'
      );
    }

    // Get the activity link using the View button
    const viewLinkElement = activityItem.querySelector('a[aria-label="View"]');
    if (viewLinkElement) {
      activityLink = viewLinkElement.getAttribute('href');
      log(`Found activity link: ${activityLink}`, 'info');
    }
  } catch (error) {
    log(`Error extracting activity data: ${error.message}`, 'error');
  }

  return { activityDate, activityType, activityContent, activityLink };
}

// --- Main Cleaning Logic ---
async function startActivityCleaning() {
  updateStatusMessage('Starting activity cleaning...');

  isRunning = true;
  isPaused = false;
  consecutiveFailures = 0;
  pageRefreshes = 0;

  // Reset stats
  stats.deleted = 0;
  stats.failed = 0;
  stats.skipped = 0;
  stats.total = 0;
  stats.progress = 0;
  stats.pageRefreshes = 0;

  // Clear error tracking
  Object.keys(errorTypes).forEach((key) => delete errorTypes[key]);

  processNextBatch();
}

async function processNextBatch() {
  if (!isRunning || isPaused) return;

  let noMoreItems = false;

  while (!noMoreItems && isRunning && !isPaused) {
    try {
      // Find all menu buttons
      const menuButtons = document.querySelectorAll(
        'div[aria-label="More options"]:not(.permanent-tag):not(.permanent-profile-change)'
      );

      await sleep(800);

      if (menuButtons.length === 0) {
        consecutiveFailures++;
        log(
          `No menu buttons found. Attempt ${consecutiveFailures}/${settings.maxConsecutiveFailures}`,
          'warn'
        );

        if (consecutiveFailures >= settings.maxConsecutiveFailures) {
          // Try refreshing the page if no menu buttons are found
          if (pageRefreshes < settings.maxPageRefreshes) {
            pageRefreshes++;
            stats.pageRefreshes = pageRefreshes;
            consecutiveFailures = 0;
            updateStatusMessage(
              `Refreshing page to find more items. Refresh attempt ${pageRefreshes}/${settings.maxPageRefreshes}`
            );
            window.location.reload();
            return;
          } else {
            updateStatusMessage(
              'Reached maximum page refreshes. No more items to delete.'
            );
            finishCleaning();
            return;
          }
        }

        // Try scrolling for more content before refreshing
        await scrollForMoreItems();
        await sleep(settings.timing.pageLoad);
        continue;
      }

      // Reset consecutive failures counter if we found items
      consecutiveFailures = 0;

      // Find the first visible menu button
      let visibleButton = null;

      for (const button of menuButtons) {
        if (isElementVisible(button)) {
          visibleButton = button;
          break;
        }
      }

      if (!visibleButton) {
        log('No visible menu buttons found, trying scrolling...', 'warn');
        await scrollForMoreItems();
        continue;
      }

      // Process this single item
      const result = await processSingleItem(visibleButton);

      // Wait before continuing to next item
      await sleep(settings.timing.nextItem);
    } catch (error) {
      log(`Error in main processing loop: ${error.message}`, 'error');
      stats.failed++;
      stats.total++;
      updateStats();

      // Track error types
      const errorType = error.name || 'UnknownError';
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;

      // Try to recover
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await sleep(800);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // Press twice
      } catch (escapeError) {
        // Ignore if Escape fails
      }

      await sleep(settings.timing.nextItem);
    }
  }

  finishCleaning();
}

async function processSingleItem(menuButton) {
  try {
    // Extract activity data before clicking
    const activityData = extractActivityData(menuButton);

    // Store element count before action for change detection
    const elementCountBefore = document.querySelectorAll(
      'div[aria-label="More options"]:not(.permanent-tag):not(.permanent-profile-change)'
    ).length;
    const urlBefore = window.location.href;

    // Ensure the button is visible in viewport before clicking
    menuButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);

    log('Clicking menu button...', 'info');
    menuButton.click();
    await sleep(settings.timing.menuWait);

    // Check for "was untagged in" posts
    try {
      const grandParent = menuButton.parentElement?.parentElement;
      if (grandParent) {
        const strongElements =
          grandParent.querySelectorAll('strong.html-strong');
        for (const strongElement of strongElements) {
          // Check if the next sibling is a text node containing " was untagged in "
          const nextSibling = strongElement.nextSibling;
          if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
            const textContent = nextSibling.textContent;
            if (textContent && textContent.includes(' was untagged in ')) {
              log('Found a WAS TAGGED IN post', 'error');
              // Close the menu and mark this button as permanent-tag
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
              );
              await sleep(800);

              // Add permanent-tag class to this menu button so it gets skipped in future
              menuButton.classList.add('permanent-tag');

              stats.skipped++;
              stats.total++;
              updateStats();
              return false;
            }
          }
        }
      }
    } catch (checkError) {
      log(`Error checking for untagged post: ${checkError.message}`, 'warn');
    }

    // Look for the menu items
    const menuItems = document.querySelectorAll('div[role="menuitem"]');

    // Wait a moment for the menu to fully appear
    await sleep(settings.timing.modalWait);

    if (menuItems.length > 0) {
      // Check for specific action buttons we want to click
      let menuItemToClick = null;
      let menuText = null;
      const targetActions = [
        'Remove Tag',
        'Unlike',
        'Delete',
        'Move to trash',
        'Remove Reaction',
      ];

      // Check if "Add to profile" is the only menu option (edge case)
      let hasOnlyAddToProfile = false;
      if (menuItems.length === 1) {
        const singleItemText = menuItems[0].textContent;
        if (singleItemText.includes('Add to profile')) {
          hasOnlyAddToProfile = true;
          log('Found menu with only "Add to profile" option', 'warn');

          // Mark the menu button with permanent-profile-change class
          menuButton.classList.add('permanent-profile-change');

          // Close the menu and skip this item
          document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape' })
          );
          await sleep(800);

          stats.skipped++;
          stats.total++;
          updateStats();
          return false;
        }
      }

      // Loop through all menu items to find the target actions
      for (const menuItem of menuItems) {
        const itemText = menuItem.textContent;

        if (targetActions.some((action) => itemText.includes(action))) {
          menuItemToClick = menuItem;
          menuText = itemText;
          log(`Found target action: "${menuText}"`, 'info');
          break;
        }
      }

      // If we didn't find any of our target actions
      if (!menuItemToClick) {
        log('No target action found, skipping this item', 'warn');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await sleep(800);
        stats.skipped++;
        stats.total++;
        updateStats();
        return false;
      }

      // Click the selected menu item
      menuItemToClick.click();
      await sleep(1000);

      log('Looking for confirmation modal...', 'info');

      // Wait for any modal dialog to appear
      await sleep(settings.timing.modalWait);

      // Check specifically for the modal types
      let confirmed = false;

      try {
        // Check for Delete? modal first
        const deleteModal = document.querySelector('div[aria-label="Delete?"]');
        const removeModal = document.querySelector('div[aria-label="Remove?"]');
        const removeTagsModal = document.querySelector(
          'div[aria-label="Remove tags?"]'
        );
        const moveToTrashModal = document.querySelector(
          'div[aria-label="Move to Trash?"]'
        );

        if (deleteModal) {
          log('Delete? modal found', 'info');
          const deleteButton = deleteModal.querySelector(
            'div[aria-label="Delete"]'
          );
          if (deleteButton) {
            log('Clicking Delete button...', 'info');
            deleteButton.click();
            confirmed = true;
          }
        } else if (removeModal) {
          log('Remove? modal found', 'info');
          const removeButton = removeModal.querySelector(
            'div[aria-label="Remove"]'
          );
          if (removeButton) {
            log('Clicking Remove button...', 'info');
            removeButton.click();
            confirmed = true;
          }
        } else if (removeTagsModal) {
          log('Remove tags? modal found', 'info');
          const removeTagsButton = removeTagsModal.querySelector(
            'div[aria-label="Remove"]'
          );
          if (removeTagsButton) {
            log('Clicking Remove button in Remove tags modal...', 'info');
            removeTagsButton.click();
            confirmed = true;
          }
        } else if (moveToTrashModal) {
          log('Move to Trash? modal found', 'info');
          const moveToTrashButton = moveToTrashModal.querySelector(
            'div[aria-label="Move to Trash"]'
          );
          if (moveToTrashButton) {
            log('Clicking Move to Trash button...', 'info');
            moveToTrashButton.click();
            confirmed = true;
          }
        } else {
          // No modal found - check if the page content changed indicating a successful deletion
          await sleep(1000);
          const elementCountAfter = document.querySelectorAll(
            'div[aria-label="More options"]:not(.permanent-tag):not(.permanent-profile-change)'
          ).length;
          const urlAfter = window.location.href;

          // If we observe a change (fewer elements or URL change), consider it a success
          if (
            elementCountAfter < elementCountBefore ||
            urlAfter !== urlBefore
          ) {
            log(
              'No modal appeared, but item appears to have been deleted',
              'info'
            );
            confirmed = true;
          }
        }

        if (confirmed) {
          // Wait for modal to disappear or action to complete
          await sleep(settings.timing.actionComplete);
          stats.deleted++;
          stats.total++;
          updateStats();

          log(
            `Successfully deleted item. Total deleted: ${stats.deleted}`,
            'success'
          );
          return true;
        } else {
          log(
            'Could not find expected buttons in the modal or confirm deletion',
            'warn'
          );

          // Add retry logic for failed confirmations
          let retrySuccess = false;

          for (
            let retryCount = 0;
            retryCount < settings.maxActionRetries && !retrySuccess;
            retryCount++
          ) {
            log(
              `Retry attempt ${retryCount + 1}/${
                settings.maxActionRetries
              } for confirmation...`,
              'info'
            );

            // Try pressing Escape to close the dialog first
            document.dispatchEvent(
              new KeyboardEvent('keydown', { key: 'Escape' })
            );
            await sleep(500);

            // Try clicking the menu button again
            try {
              menuButton.click();
              await sleep(settings.timing.menuWait);

              // Try clicking the menu item again
              if (menuItemToClick) {
                menuItemToClick.click();
                await sleep(settings.timing.modalWait);

                // Check for confirmation dialog again
                const anyModal = document.querySelector(
                  'div[aria-label="Delete?"], div[aria-label="Remove?"], div[aria-label="Remove tags?"], div[aria-label="Move to Trash?"]'
                );
                if (anyModal) {
                  const actionButton = anyModal.querySelector(
                    'div[aria-label="Delete"], div[aria-label="Remove"], div[aria-label="Move to Trash"]'
                  );
                  if (actionButton) {
                    actionButton.click();
                    log('Retry succeeded!', 'success');
                    retrySuccess = true;
                    confirmed = true;

                    stats.deleted++;
                    stats.total++;
                    updateStats();
                  }
                }
              }
            } catch (retryError) {
              log(
                `Retry attempt ${retryCount + 1} failed: ${retryError.message}`,
                'error'
              );
            }

            // If still not successful, try pressing Escape to close any dialogs
            if (!retrySuccess) {
              document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
              );
              await sleep(500);
            }
          }

          if (!retrySuccess) {
            // If all retries failed, increment the failure count
            stats.failed++;
            stats.total++;
            updateStats();
          }
        }
      } catch (modalError) {
        log(`Error handling modal: ${modalError.message}`, 'error');
        // Try Escape to close any open dialogs
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        await sleep(800);
        stats.failed++;
        stats.total++;
        updateStats();
      }
    } else {
      log('No menu items found, closing menu...', 'warn');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(800);
      stats.failed++;
      stats.total++;
      updateStats();
    }

    return false;
  } catch (error) {
    log(`Error processing single item: ${error.message}`, 'error');
    stats.failed++;
    stats.total++;
    updateStats();
    return false;
  }
}

async function scrollForMoreItems() {
  const previousHeight = document.body.scrollHeight;

  // Try scrolling a couple of times
  for (let i = 0; i < 2; i++) {
    window.scrollBy(0, 500);
    log(`Scroll attempt ${i + 1}/2 completed`, 'info');
    await sleep(1000);

    if (document.body.scrollHeight > previousHeight) {
      log('New content loaded after scrolling', 'info');
      return true;
    }
  }

  log('No new content found after scrolling', 'warn');
  return false;
}

function updateStatusMessage(message) {
  try {
    chrome.runtime.sendMessage({ action: 'updateStatus', status: message });
  } catch (e) {
    // Ignore errors if popup is closed
  }
}

function updateStats() {
  stats.progress = stats.total > 0 ? (stats.deleted / stats.total) * 100 : 0;
  stats.pageRefreshes = pageRefreshes;
  try {
    chrome.runtime.sendMessage({ action: 'updateStats', stats });
  } catch (e) {}
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [FB Cleaner] ${message}`);
}

async function finishCleaning() {
  isRunning = false;

  const finalMessage = `Cleaning completed: ${stats.deleted} deleted, ${stats.failed} failed, ${stats.skipped} skipped`;
  updateStatusMessage(finalMessage);

  log('===== FACEBOOK ACTIVITY DELETION COMPLETED =====', 'success');
  log(`Items deleted: ${stats.deleted}`, 'success');
  log(`Items failed: ${stats.failed}`, 'warn');
  log(`Items skipped: ${stats.skipped}`, 'info');
  log(`Total processed: ${stats.total}`, 'info');
  log(
    `Success rate: ${
      stats.total > 0
        ? ((stats.deleted / stats.total) * 100).toFixed(2) + '%'
        : '0%'
    }`,
    'info'
  );
  log(
    `Page refreshes used: ${pageRefreshes}/${settings.maxPageRefreshes}`,
    'info'
  );

  // Show error breakdown if any errors occurred
  if (Object.keys(errorTypes).length > 0) {
    log('Error breakdown:', 'info');
    Object.entries(errorTypes).forEach(([type, count]) => {
      log(`  ${type}: ${count}`, 'info');
    });
  }

  log('===============================================', 'success');

  try {
    chrome.runtime.sendMessage({
      action: 'cleaningCompleted',
      stats: { ...stats, errorTypes },
    });
  } catch (e) {}
}

// --- Message Listener for Popup/Background ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startCleaning') {
    if (!isRunning) {
      settings = { ...settings, ...message.settings };
      isRunning = true;
      isPaused = false;
      startActivityCleaning();
      sendResponse({ success: true, message: 'Cleaning started' });
    } else {
      sendResponse({ success: false, message: 'Already running' });
    }
    return true;
  } else if (message.action === 'stopCleaning') {
    isRunning = false;
    updateStatusMessage('Cleaning stopped');
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'pauseCleaning') {
    isPaused = true;
    updateStatusMessage('Cleaning paused');
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'resumeCleaning') {
    isPaused = false;
    updateStatusMessage('Cleaning resumed');
    setTimeout(() => {
      if (isRunning && !isPaused) processNextBatch();
    }, 500);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }
});
