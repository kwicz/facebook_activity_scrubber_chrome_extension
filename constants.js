/**
 * Facebook Activity Scrubber - Constants
 * Central location for all selectors, configuration, and magic numbers
 */

// ==================== DOM SELECTORS ====================

const SELECTORS = {
  // Menu and Actions
  MORE_OPTIONS: 'div[aria-label="More options"]',
  PERMANENT_TAG: '.fas-permanent-tag',
  PERMANENT_PROFILE: '.fas-permanent-profile-change',
  PERMANENT: '.fas-permanent',
  MENU_ITEM: 'div[role="menuitem"]',

  // Activity Log
  ACTIVITY_LOG_ITEM: 'Activity Log Item',
  VIEW_LINK: 'a[aria-label="View"]',

  // Date and Content
  DATE_ELEMENT: 'h2 span.html-span > span',
  ACTIVITY_TYPE: 'div:first-child > span[dir="auto"] > span.html-span > span.html-span > span > div',
  ACTIVITY_CONTENT: 'div:nth-child(2) > span[dir="auto"] > span.html-span > span.html-span',

  // Special Elements
  STRONG_ELEMENT: 'strong.html-strong',

  // Computed Selectors
  get MENU_BUTTONS() {
    return `${this.MORE_OPTIONS}:not(${this.PERMANENT_TAG}):not(${this.PERMANENT_PROFILE})`;
  },

  get PERMANENT_BUTTONS() {
    return `${this.MORE_OPTIONS}${this.PERMANENT_TAG}, ${this.MORE_OPTIONS}${this.PERMANENT_PROFILE}`;
  }
};

// ==================== MODAL CONFIGURATIONS ====================

const MODAL_CONFIGS = [
  {
    label: 'Delete?',
    ariaLabel: 'div[aria-label="Delete?"]',
    buttonLabel: 'Delete',
    buttonSelector: 'div[aria-label="Delete"]',
    action: 'delete',
    type: 'confirmation'
  },
  {
    label: 'Remove?',
    ariaLabel: 'div[aria-label="Remove?"]',
    buttonLabel: 'Remove',
    buttonSelector: 'div[aria-label="Remove"]',
    action: 'remove',
    type: 'confirmation'
  },
  {
    label: 'Remove tags?',
    ariaLabel: 'div[aria-label="Remove tags?"]',
    buttonLabel: 'Remove',
    buttonSelector: 'div[aria-label="Remove"]',
    action: 'removeTags',
    type: 'confirmation'
  },
  {
    label: 'Move to Trash?',
    ariaLabel: 'div[aria-label="Move to Trash?"]',
    buttonLabel: 'Move to Trash',
    buttonSelector: 'div[aria-label="Move to Trash"]',
    action: 'moveToTrash',
    type: 'confirmation'
  }
];

// ==================== TARGET ACTIONS ====================

const TARGET_ACTIONS = [
  'Remove Tag',
  'Unlike',
  'Delete',
  'Move to trash',
  'Remove Reaction'
];

// ==================== SPECIAL POST PATTERNS ====================

const SPECIAL_POST_PATTERNS = {
  UNTAGGED: ' was untagged in ',
  ADD_TO_PROFILE: 'Add to profile',
  HIDE_FROM_PROFILE: 'Hide from profile'
};

// ==================== DEFAULT SETTINGS ====================

const DEFAULT_SETTINGS = {
  activityType: 'all',
  timeRange: 'all',
  batchSize: 10,
  pauseInterval: 1000,
  timing: {
    menuWait: 300,         // Reduced from 500ms - wait after clicking menu button
    modalWait: 300,        // Reduced from 500ms - wait for modal to appear
    actionComplete: 500,   // Reduced from 800ms - wait after action completes
    nextItem: 300,         // Reduced from 600ms - wait before next item
    pageLoad: 2000,        // Keep same - page load wait
    noModalWait: 200,      // Reduced from 300ms - wait when no modal appears
    scrollWait: 1500,      // Keep same - scroll wait
    elementScroll: 200,    // Reduced from 300ms - element scroll wait
    retryWait: 200,        // Reduced from 300ms - retry wait
    hideFromProfileCheck: 100  // Reduced from 200ms - hide from profile check
  },
  maxConsecutiveFailures: 5,
  maxPageRefreshes: 5,
  maxActionRetries: 2
};

// ==================== INITIAL STATS ====================

const INITIAL_STATS = {
  deleted: 0,
  failed: 0,
  skipped: 0,
  zombies: 0,  // Resurrected nodes (deleted 3+ times)
  total: 0,
  progress: 0,
  pageRefreshes: 0
};

// ==================== ERROR MESSAGES ====================

const ERROR_MESSAGES = {
  NO_ACTIVITY_LOG_ITEM: 'Could not find Activity Log Item container',
  NO_MENU_BUTTONS: 'No menu buttons found',
  NO_VISIBLE_BUTTONS: 'No visible menu buttons found, trying scrolling...',
  NO_TARGET_ACTION: 'No target action found, skipping this item',
  NO_MODAL_BUTTONS: 'Could not find expected buttons in the modal or confirm deletion',
  NO_MENU_ITEMS: 'No menu items found, closing menu...',
  MAX_REFRESHES: 'Reached maximum page refreshes. No more items to delete.',
  MAX_REFRESHES_PERMANENT: 'Reached maximum page refreshes. Only permanent posts remain.',
  CONTENT_SCRIPT_INJECT_FAILED: 'Error: Could not inject content script. Try reloading the page.',
  TAB_ACCESS_FAILED: 'Error: Could not access the current tab',
  NOT_FACEBOOK: 'Please navigate to Facebook first',
  UNTAGGED_POST: 'Found a WAS TAGGED IN post',
  ONLY_ADD_TO_PROFILE: 'Found menu with only "Add to profile" option',
  ONLY_HIDE_FROM_PROFILE: 'Found menu with only "Hide from profile" option'
};

// ==================== SUCCESS MESSAGES ====================

const SUCCESS_MESSAGES = {
  CLEANING_STARTED: 'Cleaning started',
  CLEANING_STOPPED: 'Cleaning stopped',
  CLEANING_PAUSED: 'Cleaning paused',
  CLEANING_RESUMED: 'Cleaning resumed',
  ITEM_DELETED: 'Successfully deleted item',
  HIDE_FROM_PROFILE_SUCCESS: 'Hide from profile action confirmed and tagged.',
  RESUME_AFTER_REFRESH: 'Resuming cleaning after page refresh...',
  DEBUG_ENABLED: 'Debug panel enabled',
  DEBUG_DISABLED: 'Debug panel disabled'
};

// ==================== STATUS MESSAGES ====================

const STATUS_MESSAGES = {
  SCRUBBING: '🧼 Scrub a dub dub 🧼',
  READY: 'Ready to clean your Facebook activity',
  INITIALIZING: 'Initializing...',
  STOPPING: 'Stopping cleaning process...',
  NAVIGATE_FIRST: 'Please navigate to your Facebook Activity Log first',
  GO_TO_ACTIVITY_PAGE: 'Please go to your Activity Log page first!',
  SCANNING: 'Scanning for more content...',
  REFRESHING: 'Refreshing page to find more items'
};

// ==================== LOG TYPES ====================

const LOG_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARN: 'warn',
  WARNING: 'warning',
  ERROR: 'error'
};

// ==================== CACHE CONFIGURATION ====================

const CACHE_CONFIG = {
  TTL: 1000, // Time to live in milliseconds
  MAX_AGE: 5000, // Maximum age before forced refresh
  ENABLED: true
};

// ==================== THROTTLE CONFIGURATION ====================

const THROTTLE_CONFIG = {
  STATS_UPDATE: 1000, // Throttle stats updates to once per second
  STATUS_UPDATE: 500, // Throttle status updates
  STORAGE_WRITE: 1000 // Throttle storage writes
};

// ==================== TRAVERSAL LIMITS ====================

const TRAVERSAL_LIMITS = {
  MAX_PARENT_TRAVERSAL: 15, // Maximum levels to traverse up the DOM tree
  MAX_SCROLL_ATTEMPTS: 3, // Maximum scroll attempts before refresh
  MAX_MODAL_WAIT_ITERATIONS: 10 // Maximum iterations to wait for modal
};

// ==================== STYLING ====================

const STYLES = {
  PERMANENT_TAG: `
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
  `
};

// ==================== KEYBOARD SHORTCUTS ====================

const KEYBOARD_SHORTCUTS = {
  ESCAPE: 'Escape',
  DEBUG_TOGGLE: { ctrl: true, shift: true, key: 'D' }
};

// ==================== CHROME STORAGE KEYS ====================

const STORAGE_KEYS = {
  IS_RUNNING: 'isRunning',
  CLEANER_SETTINGS: 'cleanerSettings',
  CLEANER_STATS: 'cleanerStats',
  PAGE_REFRESHES: 'pageRefreshes',
  CONSECUTIVE_FAILURES: 'consecutiveFailures',
  REFRESH_TIMESTAMP: 'refreshTimestamp',
  DEBUG_ENABLED: 'debugEnabled',
  DELETED_ACTIVITIES: 'deletedActivities',
  LAST_COMMAND_TIME: 'lastCommandTime'
};

// ==================== MESSAGE ACTIONS ====================

const MESSAGE_ACTIONS = {
  START_CLEANING: 'startCleaning',
  STOP_CLEANING: 'stopCleaning',
  PAUSE_CLEANING: 'pauseCleaning',
  RESUME_CLEANING: 'resumeCleaning',
  UPDATE_STATS: 'updateStats',
  UPDATE_STATUS: 'updateStatus',
  CLEANING_STARTED: 'cleaningStarted',
  CLEANING_STOPPED: 'cleaningStopped',
  CLEANING_COMPLETED: 'cleaningCompleted',
  TOGGLE_DEBUG: 'toggleDebug',
  PING: 'ping',
  LOG_ACTIVITY: 'logActivity',
  GET_SETTINGS: 'getSettings',
  STATUS_UPDATE: 'statusUpdate',
  CREATE_BACKUP: 'createBackup',
  FORCE_RELOAD: 'forceReload',
  UPDATE_BADGE: 'updateBadge',
  START_DEMONETIZE: 'startDemonetize',
  UPDATE_PAGE_REFRESHES: 'updatePageRefreshes',
  SAVE_ERROR_TYPE: 'saveErrorType'
};

// ==================== URLS ====================

const URLS = {
  ACTIVITY_LOG: 'https://www.facebook.com/me/allactivity',
  FACEBOOK_BASE: 'https://www.facebook.com',
  ACCOUNTS_CENTER_ADS: 'https://accountscenter.facebook.com/ads',
  AD_PREFERENCES_PARTNER: 'https://www.facebook.com/adpreferences/ad_settings/partner_ads',
  OFF_FACEBOOK_ACTIVITY: 'https://www.facebook.com/off_facebook_activity/manage_future_activity/'
};

// ==================== ACTIVITY PAGE PATTERNS ====================

const ACTIVITY_PAGE_PATTERNS = [
  '/me/allactivity',
  '/allactivity',
  'allactivity',
  'activity_log'
];

// ==================== TIMING CONSTANTS ====================

const TIMING = {
  REFRESH_CHECK_WINDOW: 30000, // 30 seconds - window to check if refresh was recent
  RESUME_DELAY: 3000, // 3 seconds - delay before resuming after refresh
  POST_REFRESH_WAIT: 2000, // 2 seconds - wait after page loads
  NOTIFICATION_DURATION: 5000, // 5 seconds - how long to show notifications
  SCRIPT_INITIALIZATION_WAIT: 1000, // 1 second - wait for scripts to initialize
  CONFETTI_DURATION: 2500 // 2.5 seconds - confetti animation duration
};

// ==================== DEBUG CONFIGURATION ====================

const DEBUG_CONFIG = {
  PANEL_WIDTH: '350px',
  LOG_HEIGHT: '200px',
  MAX_LOG_ENTRIES: 100,
  SCAN_DELAY: 100
};

// ==================== BADGE CONFIGURATION ====================

const BADGE_CONFIG = {
  RUNNING_TEXT: '🔄',
  RUNNING_COLOR: '#4CAF50',
  ERROR_COLOR: '#f44336',
  DEFAULT_COLOR: '#2196F3'
};

// ==================== SCROLL CONFIGURATION ====================

const SCROLL_CONFIG = {
  BEHAVIOR: 'smooth',
  BLOCK: 'center',
  WAIT_AFTER_SCROLL: 1500
};

// ==================== RETRY CONFIGURATION ====================

const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  BASE_DELAY: 1000,
  EXPONENTIAL_BASE: 2
};
