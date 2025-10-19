/**
 * Facebook Activity Scrubber - Modal Handler
 * Handles detection and interaction with Facebook confirmation modals
 */

/**
 * Modal Handler class for managing Facebook confirmation dialogs
 * @class
 */
class ModalHandler {
  /**
   * @param {Object} options - Configuration options
   * @param {number} options.waitTime - Time to wait for modal to appear (ms)
   * @param {number} options.actionCompleteTime - Time to wait after action (ms)
   * @param {Function} options.logFn - Logging function
   */
  constructor(options = {}) {
    this.waitTime = options.waitTime || 500;
    this.actionCompleteTime = options.actionCompleteTime || 800;
    this.logFn = options.logFn || console.log;
    this.modalConfigs = typeof MODAL_CONFIGS !== 'undefined' ? MODAL_CONFIGS : this.getDefaultConfigs();
  }

  /**
   * Get default modal configurations if MODAL_CONFIGS is not available
   * @private
   * @returns {Array}
   */
  getDefaultConfigs() {
    return [
      {
        label: 'Delete?',
        ariaLabel: 'div[aria-label="Delete?"]',
        buttonLabel: 'Delete',
        buttonSelector: 'div[aria-label="Delete"]',
        action: 'delete'
      },
      {
        label: 'Remove?',
        ariaLabel: 'div[aria-label="Remove?"]',
        buttonLabel: 'Remove',
        buttonSelector: 'div[aria-label="Remove"]',
        action: 'remove'
      },
      {
        label: 'Remove tags?',
        ariaLabel: 'div[aria-label="Remove tags?"]',
        buttonLabel: 'Remove',
        buttonSelector: 'div[aria-label="Remove"]',
        action: 'removeTags'
      },
      {
        label: 'Move to Trash?',
        ariaLabel: 'div[aria-label="Move to Trash?"]',
        buttonLabel: 'Move to Trash',
        buttonSelector: 'div[aria-label="Move to Trash"]',
        action: 'moveToTrash'
      }
    ];
  }

  /**
   * Wait for a modal to appear and return it
   * @param {number} timeout - Maximum time to wait (ms)
   * @returns {Promise<{modal: Element, config: Object}|null>}
   */
  async waitForModal(timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      for (const config of this.modalConfigs) {
        const modal = document.querySelector(config.ariaLabel);
        if (modal) {
          this.logFn(`${config.action} modal found`, 'info');
          return { modal, config };
        }
      }

      await this.sleep(100);
    }

    return null;
  }

  /**
   * Find and click confirmation button in modal
   * @param {Element} modal - Modal element
   * @param {Object} config - Modal configuration
   * @returns {Promise<boolean>} - True if button was clicked
   */
  async clickConfirmButton(modal, config) {
    const button = modal.querySelector(config.buttonSelector);

    if (button) {
      this.logFn(`Clicking ${config.buttonLabel} button...`, 'info');
      button.click();
      await this.sleep(this.actionCompleteTime);
      return true;
    }

    this.logFn(`Could not find ${config.buttonLabel} button in modal`, 'warn');
    return false;
  }

  /**
   * Handle confirmation modal - wait for it and click confirm
   * @returns {Promise<{success: boolean, action: string|null}>}
   */
  async handleConfirmationModal() {
    // Wait for modal to appear
    await this.sleep(this.waitTime);

    const result = await this.waitForModal(5000);

    if (result) {
      const { modal, config } = result;
      const clicked = await this.clickConfirmButton(modal, config);

      return {
        success: clicked,
        action: config.action
      };
    }

    this.logFn('No confirmation modal found', 'info');
    return {
      success: false,
      action: null
    };
  }

  /**
   * Check if item was deleted without modal (by observing DOM changes)
   * @param {number} elementCountBefore - Count before action
   * @param {string} urlBefore - URL before action
   * @param {number} waitTime - Time to wait for changes (ms)
   * @returns {Promise<boolean>}
   */
  async checkNoModalDeletion(elementCountBefore, urlBefore, waitTime = 300) {
    await this.sleep(waitTime);

    const selector = typeof SELECTORS !== 'undefined'
      ? SELECTORS.MENU_BUTTONS
      : 'div[aria-label="More options"]:not(.fas-permanent-tag):not(.fas-permanent-profile-change)';

    const elementCountAfter = document.querySelectorAll(selector).length;
    const urlAfter = window.location.href;

    if (elementCountAfter < elementCountBefore || urlAfter !== urlBefore) {
      this.logFn('No modal appeared, but item appears to have been deleted', 'info');
      return true;
    }

    return false;
  }

  /**
   * Handle modal with retry logic
   * @param {number} maxRetries - Maximum number of retries
   * @param {Function} retryFn - Function to call for retry (should re-open menu)
   * @returns {Promise<{success: boolean, action: string|null, retries: number}>}
   */
  async handleWithRetry(maxRetries = 2, retryFn = null) {
    let retries = 0;

    while (retries <= maxRetries) {
      const result = await this.handleConfirmationModal();

      if (result.success) {
        return {
          ...result,
          retries
        };
      }

      if (retries < maxRetries && retryFn) {
        this.logFn(`Retry attempt ${retries + 1}/${maxRetries}...`, 'info');

        // Close any open dialogs
        this.pressEscape();
        await this.sleep(300);

        // Try again
        const retrySuccess = await retryFn();
        if (!retrySuccess) {
          break;
        }
      }

      retries++;
    }

    return {
      success: false,
      action: null,
      retries
    };
  }

  /**
   * Press Escape key to close modals
   */
  pressEscape() {
    try {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: typeof KEYBOARD_SHORTCUTS !== 'undefined' ? KEYBOARD_SHORTCUTS.ESCAPE : 'Escape'
      }));
    } catch (error) {
      this.logFn(`Error pressing Escape: ${error.message}`, 'warn');
    }
  }

  /**
   * Close any open modal by pressing Escape
   * @returns {Promise<void>}
   */
  async closeModal() {
    this.pressEscape();
    await this.sleep(500);
    this.pressEscape(); // Press twice to ensure closure
    await this.sleep(300);
  }

  /**
   * Check if a modal is currently open
   * @returns {boolean}
   */
  isModalOpen() {
    return this.modalConfigs.some(config => {
      return document.querySelector(config.ariaLabel) !== null;
    });
  }

  /**
   * Get the currently open modal
   * @returns {{modal: Element, config: Object}|null}
   */
  getCurrentModal() {
    for (const config of this.modalConfigs) {
      const modal = document.querySelector(config.ariaLabel);
      if (modal) {
        return { modal, config };
      }
    }
    return null;
  }

  /**
   * Sleep utility
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Set custom modal configurations
   * @param {Array} configs - Array of modal configuration objects
   */
  setModalConfigs(configs) {
    this.modalConfigs = configs;
  }

  /**
   * Add a custom modal configuration
   * @param {Object} config - Modal configuration object
   */
  addModalConfig(config) {
    this.modalConfigs.push(config);
  }
}

/**
 * Create a global modal handler instance
 */
let globalModalHandler = null;

/**
 * Get or create the global modal handler instance
 * @param {Object} options - Configuration options
 * @returns {ModalHandler}
 */
function getModalHandler(options = {}) {
  if (!globalModalHandler) {
    globalModalHandler = new ModalHandler(options);
  }
  return globalModalHandler;
}

/**
 * Quick helper to handle a confirmation modal
 * @param {Object} options - Configuration options
 * @returns {Promise<{success: boolean, action: string|null}>}
 */
async function handleConfirmationModal(options = {}) {
  const handler = getModalHandler(options);
  return handler.handleConfirmationModal();
}

/**
 * Quick helper to handle modal with retry
 * @param {number} maxRetries - Maximum retries
 * @param {Function} retryFn - Retry function
 * @param {Object} options - Configuration options
 * @returns {Promise<{success: boolean, action: string|null, retries: number}>}
 */
async function handleModalWithRetry(maxRetries, retryFn, options = {}) {
  const handler = getModalHandler(options);
  return handler.handleWithRetry(maxRetries, retryFn);
}

// Export to window for global access
if (typeof window !== 'undefined') {
  window.ModalHandler = ModalHandler;
  window.getModalHandler = getModalHandler;
  window.handleConfirmationModal = handleConfirmationModal;
  window.handleModalWithRetry = handleModalWithRetry;
}
