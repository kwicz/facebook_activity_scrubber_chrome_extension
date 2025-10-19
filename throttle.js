/**
 * Facebook Activity Scrubber - Throttle Utilities
 * Implements throttling and debouncing for efficient storage writes and message passing
 */

/**
 * Throttle class for limiting function execution frequency
 * @class
 */
class Throttle {
  /**
   * @param {Function} fn - Function to throttle
   * @param {number} delay - Minimum delay between executions in milliseconds
   */
  constructor(fn, delay) {
    this.fn = fn;
    this.delay = delay;
    this.lastCall = 0;
    this.timeout = null;
    this.pending = false;
    this.pendingArgs = null;
  }

  /**
   * Execute the throttled function
   * @param {...any} args - Arguments to pass to the function
   */
  execute(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;

    if (timeSinceLastCall >= this.delay) {
      // Execute immediately
      this.lastCall = now;
      this.pending = false;
      this.fn(...args);
    } else {
      // Schedule for later
      this.pending = true;
      this.pendingArgs = args;

      if (!this.timeout) {
        const remaining = this.delay - timeSinceLastCall;
        this.timeout = setTimeout(() => {
          this.lastCall = Date.now();
          this.timeout = null;

          if (this.pending && this.pendingArgs) {
            this.fn(...this.pendingArgs);
            this.pending = false;
            this.pendingArgs = null;
          }
        }, remaining);
      }
    }
  }

  /**
   * Force execute pending call immediately
   */
  flush() {
    if (this.pending && this.pendingArgs) {
      clearTimeout(this.timeout);
      this.timeout = null;
      this.lastCall = Date.now();
      this.fn(...this.pendingArgs);
      this.pending = false;
      this.pendingArgs = null;
    }
  }

  /**
   * Cancel pending execution
   */
  cancel() {
    clearTimeout(this.timeout);
    this.timeout = null;
    this.pending = false;
    this.pendingArgs = null;
  }
}

/**
 * Debounce class for delaying function execution until after a period of inactivity
 * @class
 */
class Debounce {
  /**
   * @param {Function} fn - Function to debounce
   * @param {number} delay - Delay in milliseconds
   */
  constructor(fn, delay) {
    this.fn = fn;
    this.delay = delay;
    this.timeout = null;
  }

  /**
   * Execute the debounced function
   * @param {...any} args - Arguments to pass to the function
   */
  execute(...args) {
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => {
      this.fn(...args);
    }, this.delay);
  }

  /**
   * Force execute immediately
   */
  flush() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  /**
   * Cancel pending execution
   */
  cancel() {
    clearTimeout(this.timeout);
    this.timeout = null;
  }
}

/**
 * Throttled storage writer for Chrome storage API
 * @class
 */
class ThrottledStorageWriter {
  /**
   * @param {number} delay - Throttle delay in milliseconds (default: 1000ms)
   */
  constructor(delay = 1000) {
    this.delay = delay;
    this.pendingWrites = new Map();
    this.writeThrottle = null;
    this.setupThrottle();
  }

  /**
   * Setup the throttle mechanism
   * @private
   */
  setupThrottle() {
    this.writeThrottle = new Throttle(() => {
      this.flushWrites();
    }, this.delay);
  }

  /**
   * Queue a storage write
   * @param {string} key - Storage key
   * @param {any} value - Value to write
   */
  write(key, value) {
    this.pendingWrites.set(key, value);
    this.writeThrottle.execute();
  }

  /**
   * Queue multiple storage writes
   * @param {Object} data - Key-value pairs to write
   */
  writeMultiple(data) {
    Object.entries(data).forEach(([key, value]) => {
      this.pendingWrites.set(key, value);
    });
    this.writeThrottle.execute();
  }

  /**
   * Flush all pending writes immediately
   * @private
   */
  async flushWrites() {
    if (this.pendingWrites.size === 0) return;

    const data = Object.fromEntries(this.pendingWrites);
    this.pendingWrites.clear();

    try {
      await chrome.storage.local.set(data);
    } catch (error) {
      console.error('Storage write error:', error);
    }
  }

  /**
   * Force flush all pending writes
   */
  async flush() {
    this.writeThrottle.flush();
    await this.flushWrites();
  }

  /**
   * Get pending write count
   * @returns {number}
   */
  getPendingCount() {
    return this.pendingWrites.size;
  }
}

/**
 * Throttled message sender for Chrome runtime messaging
 * @class
 */
class ThrottledMessageSender {
  /**
   * @param {string} action - Message action type
   * @param {number} delay - Throttle delay in milliseconds
   */
  constructor(action, delay = 500) {
    this.action = action;
    this.delay = delay;
    this.pendingMessage = null;
    this.sendThrottle = new Throttle(() => {
      this.sendMessage();
    }, delay);
  }

  /**
   * Queue a message to send
   * @param {Object} data - Message data
   */
  send(data) {
    this.pendingMessage = { action: this.action, ...data };
    this.sendThrottle.execute();
  }

  /**
   * Send the pending message
   * @private
   */
  sendMessage() {
    if (!this.pendingMessage) return;

    try {
      chrome.runtime.sendMessage(this.pendingMessage);
      this.pendingMessage = null;
    } catch (error) {
      // Ignore errors if popup/background is not available
    }
  }

  /**
   * Force send immediately
   */
  flush() {
    this.sendThrottle.flush();
    this.sendMessage();
  }
}

// Create global instances for common use cases
const storageWriter = new ThrottledStorageWriter(
  typeof THROTTLE_CONFIG !== 'undefined' ? THROTTLE_CONFIG.STORAGE_WRITE : 1000
);

const statsMessageSender = new ThrottledMessageSender(
  typeof MESSAGE_ACTIONS !== 'undefined' ? MESSAGE_ACTIONS.UPDATE_STATS : 'updateStats',
  typeof THROTTLE_CONFIG !== 'undefined' ? THROTTLE_CONFIG.STATS_UPDATE : 1000
);

const statusMessageSender = new ThrottledMessageSender(
  typeof MESSAGE_ACTIONS !== 'undefined' ? MESSAGE_ACTIONS.UPDATE_STATUS : 'updateStatus',
  typeof THROTTLE_CONFIG !== 'undefined' ? THROTTLE_CONFIG.STATUS_UPDATE : 500
);

// Export instances and classes
if (typeof window !== 'undefined') {
  window.Throttle = Throttle;
  window.Debounce = Debounce;
  window.ThrottledStorageWriter = ThrottledStorageWriter;
  window.ThrottledMessageSender = ThrottledMessageSender;
  window.storageWriter = storageWriter;
  window.statsMessageSender = statsMessageSender;
  window.statusMessageSender = statusMessageSender;
}

/**
 * Helper function to create a throttled function
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function}
 */
function throttle(fn, delay) {
  const throttler = new Throttle(fn, delay);
  const throttled = (...args) => throttler.execute(...args);
  throttled.flush = () => throttler.flush();
  throttled.cancel = () => throttler.cancel();
  return throttled;
}

/**
 * Helper function to create a debounced function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function}
 */
function debounce(fn, delay) {
  const debouncer = new Debounce(fn, delay);
  const debounced = (...args) => debouncer.execute(...args);
  debounced.flush = () => debouncer.flush();
  debounced.cancel = () => debouncer.cancel();
  return debounced;
}

if (typeof window !== 'undefined') {
  window.throttle = throttle;
  window.debounce = debounce;
}
