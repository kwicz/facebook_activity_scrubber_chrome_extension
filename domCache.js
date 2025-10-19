/**
 * Facebook Activity Scrubber - DOM Query Cache
 * Implements efficient caching for DOM queries to reduce repeated querySelector calls
 */

/**
 * DOM Query Cache with TTL (Time To Live)
 * @class
 */
class DOMCache {
  /**
   * @param {number} ttl - Time to live in milliseconds (default: 1000ms)
   */
  constructor(ttl = 1000) {
    this.cache = new Map();
    this.timestamps = new Map();
    this.ttl = ttl;
  }

  /**
   * Get cached query result or execute new query
   * @param {string} selector - CSS selector
   * @param {boolean} multiple - Whether to use querySelectorAll (default: false)
   * @param {Element} context - Context element to query within (default: document)
   * @returns {Element|NodeList|null}
   */
  query(selector, multiple = false, context = document) {
    const cacheKey = `${selector}:${multiple}`;
    const now = Date.now();
    const timestamp = this.timestamps.get(cacheKey);

    // Check if cache is valid
    if (timestamp && (now - timestamp) < this.ttl) {
      const cached = this.cache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Execute query and cache result
    const result = multiple
      ? context.querySelectorAll(selector)
      : context.querySelector(selector);

    this.cache.set(cacheKey, result);
    this.timestamps.set(cacheKey, now);

    return result;
  }

  /**
   * Get single element (querySelector)
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (optional)
   * @returns {Element|null}
   */
  querySelector(selector, context = document) {
    return this.query(selector, false, context);
  }

  /**
   * Get multiple elements (querySelectorAll)
   * @param {string} selector - CSS selector
   * @param {Element} context - Context element (optional)
   * @returns {NodeList}
   */
  querySelectorAll(selector, context = document) {
    return this.query(selector, true, context);
  }

  /**
   * Invalidate specific cache entry
   * @param {string} selector - CSS selector to invalidate
   * @param {boolean} multiple - Whether it was a querySelectorAll
   */
  invalidate(selector, multiple = false) {
    const cacheKey = `${selector}:${multiple}`;
    this.cache.delete(cacheKey);
    this.timestamps.delete(cacheKey);
  }

  /**
   * Invalidate all cache entries matching a pattern
   * @param {RegExp|string} pattern - Pattern to match selectors
   */
  invalidatePattern(pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const [key] of this.cache) {
      const selector = key.split(':')[0];
      if (regex.test(selector)) {
        this.cache.delete(key);
        this.timestamps.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
      ttl: this.ttl
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, timestamp] of this.timestamps) {
      if ((now - timestamp) >= this.ttl) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.timestamps.delete(key);
    });

    return expiredKeys.length;
  }
}

/**
 * Specialized cache for menu buttons with additional helpers
 * @class
 * @extends DOMCache
 */
class MenuButtonCache extends DOMCache {
  constructor(ttl = 1000) {
    super(ttl);
  }

  /**
   * Get all menu buttons (excluding permanent ones)
   * @returns {NodeList}
   */
  getMenuButtons() {
    if (typeof SELECTORS !== 'undefined') {
      return this.querySelectorAll(SELECTORS.MENU_BUTTONS);
    }
    // Fallback if constants not loaded
    return this.querySelectorAll(
      'div[aria-label="More options"]:not(.fas-permanent-tag):not(.fas-permanent-profile-change)'
    );
  }

  /**
   * Get permanent menu buttons
   * @returns {NodeList}
   */
  getPermanentButtons() {
    if (typeof SELECTORS !== 'undefined') {
      return this.querySelectorAll(SELECTORS.PERMANENT_BUTTONS);
    }
    // Fallback if constants not loaded
    return this.querySelectorAll(
      'div[aria-label="More options"].fas-permanent-tag, div[aria-label="More options"].fas-permanent-profile-change'
    );
  }

  /**
   * Get menu items from an open menu
   * @returns {NodeList}
   */
  getMenuItems() {
    // Menu items should not be cached long since menus open/close frequently
    const originalTTL = this.ttl;
    this.ttl = 100; // Very short cache for dynamic content

    const selector = typeof SELECTORS !== 'undefined'
      ? SELECTORS.MENU_ITEM
      : 'div[role="menuitem"]';

    const items = this.querySelectorAll(selector);
    this.ttl = originalTTL;

    return items;
  }

  /**
   * Count visible menu buttons efficiently
   * @param {Function} isVisibleFn - Function to check if element is visible
   * @returns {number}
   */
  countVisibleButtons(isVisibleFn) {
    const buttons = this.getMenuButtons();
    let count = 0;

    for (const button of buttons) {
      if (isVisibleFn(button)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Find first visible menu button
   * @param {Function} isVisibleFn - Function to check if element is visible
   * @returns {Element|null}
   */
  findFirstVisible(isVisibleFn) {
    const buttons = this.getMenuButtons();

    for (const button of buttons) {
      if (isVisibleFn(button)) {
        return button;
      }
    }

    return null;
  }

  /**
   * Invalidate button caches (call after DOM mutations)
   */
  invalidateButtons() {
    this.invalidatePattern(/More options/);
  }
}

// Create global cache instances
const domCache = new DOMCache(1000);
const menuCache = new MenuButtonCache(1000);

// Cleanup expired cache entries periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    domCache.cleanup();
    menuCache.cleanup();
  }, 5000); // Cleanup every 5 seconds
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.domCache = domCache;
  window.menuCache = menuCache;
  window.DOMCache = DOMCache;
  window.MenuButtonCache = MenuButtonCache;
}
