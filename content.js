// Facebook Activity Scrubber Content Script
// Rewritten to use the same robust logic as the standalone script
// Now enhanced with performance utilities (constants, cache, throttle, modal handler)

// Inject CSS for permanent-tag styling using constants
const style = document.createElement('style');
style.textContent = typeof STYLES !== 'undefined' ? STYLES.PERMANENT_TAG : `
  .fas-permanent::after {
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

  .fas-permanent-tag::after {
        content: "Untagged items cannot be removed";
  }

  .fas-permanent-profile-change {
        position: relative;
  }

  .fas-permanent-profile-change::after {
        content: "Profile changes cannot be removed";
  }
`;
document.head.appendChild(style);

// --- Global State ---
let isRunning = false;
let isPaused = false;
let wasRunningBeforeRefresh = false;

// Use DEFAULT_SETTINGS from constants.js if available, otherwise fallback
let settings = typeof DEFAULT_SETTINGS !== 'undefined'
  ? { ...DEFAULT_SETTINGS }
  : {
      activityType: 'all',
      timeRange: 'all',
      batchSize: 10,
      pauseInterval: 1000,
      timing: {
        menuWait: 500,
        modalWait: 500,
        actionComplete: 800,
        nextItem: 600,
        pageLoad: 2000,
        noModalWait: 300,
      },
      maxConsecutiveFailures: 5,
      maxPageRefreshes: 5,
      maxActionRetries: 2,
    };

// Use INITIAL_STATS from constants.js if available, otherwise fallback
const stats = typeof INITIAL_STATS !== 'undefined'
  ? { ...INITIAL_STATS }
  : {
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

// Check if we were running before a refresh and resume if needed
window.addEventListener('load', async () => {
  // Wait a moment for the page to fully load
  const POST_REFRESH_WAIT = typeof TIMING !== 'undefined' ? TIMING.POST_REFRESH_WAIT : 2000;
  await sleep(POST_REFRESH_WAIT);

  try {
    // Check if cleaning was in progress before refresh
    // Use STORAGE_KEYS if available
    const storageKeys = typeof STORAGE_KEYS !== 'undefined'
      ? [
          STORAGE_KEYS.IS_RUNNING,
          STORAGE_KEYS.CLEANER_SETTINGS,
          STORAGE_KEYS.CLEANER_STATS,
          STORAGE_KEYS.PAGE_REFRESHES,
          STORAGE_KEYS.CONSECUTIVE_FAILURES,
          STORAGE_KEYS.REFRESH_TIMESTAMP,
        ]
      : [
          'isRunning',
          'cleanerSettings',
          'cleanerStats',
          'pageRefreshes',
          'consecutiveFailures',
          'refreshTimestamp',
        ];

    const result = await chrome.storage.local.get(storageKeys);

    if (result.isRunning && result.cleanerSettings) {
      // Check if the refresh was recent (within last 30 seconds) to avoid false positives
      const REFRESH_CHECK_WINDOW = typeof TIMING !== 'undefined' ? TIMING.REFRESH_CHECK_WINDOW : 30000;
      const timeSinceRefresh = Date.now() - (result.refreshTimestamp || 0);
      if (timeSinceRefresh < REFRESH_CHECK_WINDOW) {
        log(
          'Detected page refresh during cleaning process. Resuming...',
          'info'
        );
        wasRunningBeforeRefresh = true;

        // Restore settings and stats
        settings = { ...settings, ...result.cleanerSettings };
        if (result.cleanerStats) {
          Object.assign(stats, result.cleanerStats);
        }

        // Restore additional state variables
        if (typeof result.pageRefreshes === 'number') {
          pageRefreshes = result.pageRefreshes;
        }
        if (typeof result.consecutiveFailures === 'number') {
          consecutiveFailures = result.consecutiveFailures;
        }

        // Notify user that cleaning is resuming
        updateStatusMessage('Resuming cleaning after page refresh...');

        // Show a notification to indicate the process is continuing
        showResumeNotification();

        // Resume cleaning after a short delay
        setTimeout(() => {
          isRunning = true;
          isPaused = false;

          // Update badge to show cleaning is active
          updateExtensionBadge();

          processNextBatch();
        }, 3000);
      } else {
        // Old refresh timestamp, clear the running state
        await chrome.storage.local.set({ isRunning: false });
      }
    }
  } catch (error) {
    log(`Error checking post-refresh state: ${error.message}`, 'error');
  }
});

// Function to show a visual notification that cleaning has resumed
function showResumeNotification() {
  // Create a notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 350px;
    border-left: 4px solid #45a049;
  `;

  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="font-size: 18px;">🔄</div>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">Facebook Activity Scrubber</div>
        <div style="opacity: 0.9; font-size: 13px;">Cleaning resumed after page refresh</div>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 5000);
}

/**
 * Store state before page refresh - using throttled writer if available
 */
async function storeStateBeforeRefresh() {
  try {
    // Update stats with current progress
    stats.pageRefreshes = pageRefreshes;

    // Prepare state data
    const stateData = {
      isRunning: true,
      cleanerSettings: settings,
      cleanerStats: stats,
      pageRefreshes: pageRefreshes,
      consecutiveFailures: consecutiveFailures,
      refreshTimestamp: Date.now(),
    };

    // Store current state in Chrome storage
    // Use throttled writer if available, but flush immediately since we're refreshing
    if (typeof window.storageWriter !== 'undefined') {
      window.storageWriter.writeMultiple(stateData);
      await window.storageWriter.flush(); // Force immediate write before refresh
    } else {
      // Fallback to direct storage
      await chrome.storage.local.set(stateData);
    }

    log('State stored before page refresh', 'info');
  } catch (error) {
    log(`Error storing state before refresh: ${error.message}`, 'error');
  }
}

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
  updateStatusMessage('🧼 Scrub a dub dub 🧼');

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
      // Find all menu buttons (excluding permanent ones) - using cache if available
      const menuButtons = typeof window.menuCache !== 'undefined'
        ? window.menuCache.getMenuButtons()
        : document.querySelectorAll(
            'div[aria-label="More options"]:not(.fas-permanent-tag):not(.fas-permanent-profile-change)'
          );

      // Also check if there are any permanent posts to distinguish between "no posts at all" vs "only permanent posts"
      const permanentButtons = typeof window.menuCache !== 'undefined'
        ? window.menuCache.getPermanentButtons()
        : document.querySelectorAll(
            'div[aria-label="More options"].fas-permanent-tag, div[aria-label="More options"].fas-permanent-profile-change'
          );

      await sleep(600);

      if (menuButtons.length === 0) {
        // Check if we have permanent posts - if so, we know there are posts but they're all permanent
        if (permanentButtons.length > 0) {
          log(
            `Found ${permanentButtons.length} permanent posts but no processable posts. Trying to scroll for more content...`,
            'info'
          );

          // Try scrolling first to see if we can load more content
          const scrollSuccess = await scrollForMoreItems();

          if (scrollSuccess) {
            // If scrolling loaded new content, continue the loop to check for new posts
            await sleep(settings.timing.pageLoad);
            continue;
          } else {
            // Scrolling didn't work, try refreshing the page immediately (only 1 attempt for permanent posts)
            log(
              'No new content from scrolling with permanent posts present. Refreshing page...',
              'warn'
            );

            if (pageRefreshes < settings.maxPageRefreshes) {
              pageRefreshes++;
              stats.pageRefreshes = pageRefreshes;
              consecutiveFailures = 0; // Reset since we're refreshing
              updateStatusMessage(
                `Only permanent posts found. Refreshing page to find more items. Refresh attempt ${pageRefreshes}/${settings.maxPageRefreshes}`
              );

              // Store state before refresh so we can resume after
              await storeStateBeforeRefresh();
              window.location.reload();
              return;
            } else {
              updateStatusMessage(
                'Reached maximum page refreshes. Only permanent posts remain.'
              );
              finishCleaning();
              return;
            }
          }
        } else {
          // No posts at all (neither regular nor permanent) - allow 3 scroll attempts
          consecutiveFailures++;
          log(
            `No menu buttons found at all. Attempt ${consecutiveFailures}/3`,
            'warn'
          );

          if (consecutiveFailures >= 3) {
            // Try refreshing the page if no menu buttons are found after 3 attempts
            if (pageRefreshes < settings.maxPageRefreshes) {
              pageRefreshes++;
              stats.pageRefreshes = pageRefreshes;
              consecutiveFailures = 0;
              updateStatusMessage(
                `Refreshing page to find more items. Refresh attempt ${pageRefreshes}/${settings.maxPageRefreshes}`
              );

              // Store state before refresh so we can resume after
              await storeStateBeforeRefresh();
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
        await sleep(500);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
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
    const elementCountBefore = typeof window.menuCache !== 'undefined'
      ? window.menuCache.getMenuButtons().length
      : document.querySelectorAll(
          'div[aria-label="More options"]:not(.fas-permanent-tag):not(.fas-permanent-profile-change)'
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
              // Close the menu by clicking the button again
              menuButton.click();
              await sleep(300);

              // Add permanent-tag class to this menu button so it gets skipped in future
              menuButton.classList.add('fas-permanent-tag');
              menuButton.classList.add('fas-permanent');

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

    // Look for the menu items - using cache if available
    const menuItems = typeof window.menuCache !== 'undefined'
      ? window.menuCache.getMenuItems()
      : document.querySelectorAll('div[role="menuitem"]');

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

      // Check if "Add to profile" or "Hide from profile" is the only menu option (edge case)
      let hasOnlyAddToProfile = false;
      if (menuItems.length === 1) {
        const singleItemText = menuItems[0].textContent;
        if (singleItemText.includes('Add to profile')) {
          hasOnlyAddToProfile = true;
          log('Found menu with only "Add to profile" option', 'warn');

          // Close the menu by clicking the button again
          menuButton.click();
          await sleep(300);

          // Mark the menu button with permanent-profile-change class
          menuButton.classList.add('fas-permanent-profile-change');
          menuButton.classList.add('fas-permanent');

          stats.skipped++;
          stats.total++;
          updateStats();
          return false;
        } else if (singleItemText.includes('Hide from profile')) {
          log('Found menu with only "Hide from profile" option', 'warn');
          // Try a robust click
          menuItems[0].dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true })
          );
          menuItems[0].dispatchEvent(
            new MouseEvent('mouseup', { bubbles: true })
          );
          menuItems[0].dispatchEvent(
            new MouseEvent('click', { bubbles: true })
          );
          log('Clicked "Hide from profile" menu item', 'info');
          // Wait for the menu to close or the item to be hidden
          let menuClosed = false;
          for (let i = 0; i < 10; i++) {
            // up to 2 seconds
            await sleep(200);
            const stillOpen = document.querySelectorAll(
              'div[role="menuitem"]'
            ).length;
            if (stillOpen === 0) {
              menuClosed = true;
              break;
            }
          }
          if (menuClosed) {
            // Add a custom permanent tag after confirming action
            menuButton.classList.add('fas-permanent-profile-change');
            menuButton.classList.add('fas-permanent');
            // Set a custom tag message
            menuButton.setAttribute(
              'data-fas-permanent-message',
              'Profile update has been hidden, but cannot be removed'
            );
            stats.deleted++;
            stats.total++;
            updateStats();
            log('Hide from profile action confirmed and tagged.', 'success');
            return true;
          } else {
            log(
              'Hide from profile action did not succeed (menu did not close). Not tagging.',
              'warn'
            );
            stats.skipped++;
            stats.total++;
            updateStats();
            return false;
          }
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
        await sleep(500);
        stats.skipped++;
        stats.total++;
        updateStats();
        return false;
      }

      // Click the selected menu item
      menuItemToClick.click();
      await sleep(800);

      log('Looking for confirmation modal...', 'info');

      // Use modal handler if available, otherwise fallback to original logic
      let confirmed = false;

      if (typeof window.handleConfirmationModal !== 'undefined') {
        // Use new modal handler (from modalHandler.js)
        const modalResult = await window.handleConfirmationModal({
          waitTime: settings.timing.modalWait,
          actionCompleteTime: settings.timing.actionComplete,
          logFn: log
        });

        confirmed = modalResult.success;

        // If no modal appeared, check for DOM changes
        if (!confirmed) {
          const modalHandler = window.getModalHandler({ logFn: log });
          confirmed = await modalHandler.checkNoModalDeletion(
            elementCountBefore,
            urlBefore,
            settings.timing.noModalWait
          );
        }
      } else {
        // Fallback to original modal handling logic
        await sleep(settings.timing.modalWait);

        try {
          const deleteModal = document.querySelector('div[aria-label="Delete?"]');
          const removeModal = document.querySelector('div[aria-label="Remove?"]');
          const removeTagsModal = document.querySelector('div[aria-label="Remove tags?"]');
          const moveToTrashModal = document.querySelector('div[aria-label="Move to Trash?"]');

          if (deleteModal) {
            log('Delete? modal found', 'info');
            const deleteButton = deleteModal.querySelector('div[aria-label="Delete"]');
            if (deleteButton) {
              log('Clicking Delete button...', 'info');
              deleteButton.click();
              confirmed = true;
            }
          } else if (removeModal) {
            log('Remove? modal found', 'info');
            const removeButton = removeModal.querySelector('div[aria-label="Remove"]');
            if (removeButton) {
              log('Clicking Remove button...', 'info');
              removeButton.click();
              confirmed = true;
            }
          } else if (removeTagsModal) {
            log('Remove tags? modal found', 'info');
            const removeTagsButton = removeTagsModal.querySelector('div[aria-label="Remove"]');
            if (removeTagsButton) {
              log('Clicking Remove button in Remove tags modal...', 'info');
              removeTagsButton.click();
              confirmed = true;
            }
          } else if (moveToTrashModal) {
            log('Move to Trash? modal found', 'info');
            const moveToTrashButton = moveToTrashModal.querySelector('div[aria-label="Move to Trash"]');
            if (moveToTrashButton) {
              log('Clicking Move to Trash button...', 'info');
              moveToTrashButton.click();
              confirmed = true;
            }
          } else {
            // No modal found - check if the page content changed
            await sleep(settings.timing.noModalWait);
            const elementCountAfter = typeof window.menuCache !== 'undefined'
              ? window.menuCache.getMenuButtons().length
              : document.querySelectorAll(
                  'div[aria-label="More options"]:not(.fas-permanent-tag):not(.fas-permanent-profile-change)'
                ).length;
            const urlAfter = window.location.href;

            if (elementCountAfter < elementCountBefore || urlAfter !== urlBefore) {
              log('No modal appeared, but item appears to have been deleted', 'info');
              confirmed = true;
            }
          }
        } catch (modalError) {
          log(`Error handling modal: ${modalError.message}`, 'error');
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
          await sleep(300);

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
            await sleep(300);
          }
        }

        if (!retrySuccess) {
          // If all retries failed, increment the failure count
          stats.failed++;
          stats.total++;
          updateStats();
        }
      }
    } else {
      log('No menu items found, closing menu...', 'warn');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await sleep(500);
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
  const previousMenuButtonCount = document.querySelectorAll(
    'div[aria-label="More options"]:not(.fas-permanent-tag):not(.fas-permanent-profile-change)'
  ).length;

  log('Attempting to scroll for more content...', 'info');

  // Try scrolling to the bottom to trigger infinite scroll
  window.scrollTo(0, document.body.scrollHeight);
  await sleep(1500); // Wait for potential lazy loading

  // Check if new content was loaded
  const newHeight = document.body.scrollHeight;
  const newMenuButtonCount = document.querySelectorAll(
    'div[aria-label="More options"]:not(.fas-permanent-tag):not(.fas-permanent-profile-change)'
  ).length;

  if (
    newHeight > previousHeight ||
    newMenuButtonCount > previousMenuButtonCount
  ) {
    log(
      `New content loaded after scrolling. Height: ${previousHeight} -> ${newHeight}, Menu buttons: ${previousMenuButtonCount} -> ${newMenuButtonCount}`,
      'info'
    );
    return true;
  }

  log('No new content found after scrolling', 'warn');
  return false;
}

/**
 * Update status message - using throttled sender if available
 * @param {string} message - Status message to send
 */
function updateStatusMessage(message) {
  // Use throttled message sender if available (from throttle.js)
  if (typeof window.statusMessageSender !== 'undefined') {
    window.statusMessageSender.send({ status: message });
  } else {
    // Fallback to direct message
    try {
      chrome.runtime.sendMessage({ action: 'updateStatus', status: message });
    } catch (e) {
      // Ignore errors if popup is closed
    }
  }
}

/**
 * Update statistics - using throttled sender if available
 */
function updateStats() {
  stats.progress = stats.total > 0 ? (stats.deleted / stats.total) * 100 : 0;
  stats.pageRefreshes = pageRefreshes;

  // Use throttled message sender if available (from throttle.js)
  if (typeof window.statsMessageSender !== 'undefined') {
    window.statsMessageSender.send({ stats });
  } else {
    // Fallback to direct message
    try {
      chrome.runtime.sendMessage({ action: 'updateStats', stats });
    } catch (e) {
      // Ignore errors if popup is closed
    }
  }
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] [FB Cleaner] ${message}`);
}
window.log = log;

async function finishCleaning() {
  isRunning = false;

  const finalMessage = `Cleaning completed: ${stats.deleted} deleted, ${stats.failed} failed, ${stats.skipped} skipped`;
  updateStatusMessage(finalMessage);

  // Clear the badge when cleaning is finished
  try {
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      text: '',
      color: '#4CAF50',
    });
  } catch (error) {
    // Ignore if background script is not available
  }

  // Clear the running state from storage
  try {
    await chrome.storage.local.set({
      isRunning: false,
      refreshTimestamp: null,
    });
  } catch (error) {
    log(`Error clearing running state: ${error.message}`, 'error');
  }

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
  } else if (message.action === 'toggleDebug') {
    // Handle debug panel toggle
    if (message.enabled) {
      // Enable debug panel
      if (
        window.enableDebugPanel &&
        typeof window.enableDebugPanel === 'function'
      ) {
        window.enableDebugPanel();
        sendResponse({ success: true, message: 'Debug panel enabled' });
      } else {
        sendResponse({ success: false, message: 'Debug panel not available' });
      }
    } else {
      // Disable debug panel
      if (window.fbCleanerDebugger && window.fbCleanerDebugger.isInitialized) {
        window.fbCleanerDebugger.hide();
        sendResponse({ success: true, message: 'Debug panel disabled' });
      } else {
        sendResponse({
          success: true,
          message: 'Debug panel already disabled',
        });
      }
    }
    return true;
  }
});

// Function to update extension badge
function updateExtensionBadge() {
  try {
    chrome.runtime.sendMessage({
      action: 'updateBadge',
      text: '🔄',
      color: '#4CAF50',
    });
  } catch (error) {
    // Ignore if popup/background is not available
  }
}

// Initialize debug panel state on page load
(function initializeDebugState() {
  try {
    chrome.storage.local.get(['debugEnabled'], function (result) {
      if (
        result.debugEnabled &&
        window.enableDebugPanel &&
        typeof window.enableDebugPanel === 'function'
      ) {
        // Initialize but do not show the debug panel by default
        setTimeout(() => {
          window.enableDebugPanel();
          // Panel will remain hidden because we modified enableDebugPanel() not to show it by default
        }, 1500);
      }
    });
  } catch (error) {
    // Ignore if storage is not available
  }
})();
