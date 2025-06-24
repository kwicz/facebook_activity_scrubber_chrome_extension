// Facebook Activity Scrubber - Debug Panel
// Standalone debug module for monitoring and logging

class FBCleanerDebugger {
  constructor() {
    this.debugPanel = null;
    this.originalLog = null;
    this.isInitialized = false;
  }

  // Initialize the debug tools
  init() {
    if (this.isInitialized) {
      this.show();
      return;
    }

    this.createDebugPanel();
    this.setupEventListeners();
    this.interceptLogging();
    this.isInitialized = true;
    this.log('Debug panel initialized', 'info');
  }

  // Create the debug panel UI
  createDebugPanel() {
    // Remove existing debug panel if it exists
    const existingPanel = document.getElementById('fb-cleaner-debug');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Create debug panel
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'fb-cleaner-debug';
    this.debugPanel.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      width: 350px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border: 1px solid #333;
    `;

    this.debugPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 10px; color: #4CAF50;">
        Debugger Panel
      </div>
      <div style="margin-bottom: 10px;">
        <button id="debug-scan" style="background: #2196F3; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">
          🔍 Scan Page
        </button>
        <button id="debug-clear-log" style="background: #FF9800; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">
          🗑️ Clear Log
        </button>
        <button id="debug-close" style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
          ✕ Close
        </button>
      </div>
      <div id="debug-scan-results" style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #333;">
        Click "Scan Page" to analyze current page
      </div>
      <div style="font-weight: bold; margin-bottom: 5px; color: #4CAF50;">📝 Running Log:</div>
      <div id="debug-log" style="height: 200px; overflow-y: auto; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 4px; font-size: 11px; line-height: 1.3;">
        Debug log will appear here...
      </div>
    `;

    document.body.appendChild(this.debugPanel);
  }

  // Setup event listeners for debug panel buttons
  setupEventListeners() {
    document
      .getElementById('debug-scan')
      .addEventListener('click', () => this.performScan());
    document
      .getElementById('debug-clear-log')
      .addEventListener('click', () => this.clearLog());
    document
      .getElementById('debug-close')
      .addEventListener('click', () => this.hide());

    // Add keyboard shortcut (Ctrl+Shift+D)
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        this.toggle();
      }
    });
  }

  // Intercept the main script's log function
  interceptLogging() {
    // Store original log function if it exists
    if (window.log && typeof window.log === 'function') {
      this.originalLog = window.log;
    }

    // Override the global log function
    window.log = (message, type = 'info') => {
      // Call original log function if it exists
      if (this.originalLog) {
        this.originalLog(message, type);
      } else {
        console.log(`[FB Cleaner] ${message}`);
      }

      // Add to debug panel
      this.log(message, type);
    };
  }

  // Add log entry to debug panel
  log(message, type = 'info') {
    const logDiv = document.getElementById('debug-log');
    if (!logDiv) return;

    const timestamp = new Date().toLocaleTimeString();
    let color = '#FFFFFF';
    let icon = 'ℹ️';

    switch (type) {
      case 'success':
        color = '#4CAF50';
        icon = '✅';
        break;
      case 'warn':
      case 'warning':
        color = '#FF9800';
        icon = '⚠️';
        break;
      case 'error':
        color = '#f44336';
        icon = '❌';
        break;
      case 'info':
      default:
        color = '#2196F3';
        icon = 'ℹ️';
        break;
    }

    const logEntry = document.createElement('div');
    logEntry.style.cssText = `
      margin-bottom: 2px;
      color: ${color};
      word-wrap: break-word;
    `;
    logEntry.innerHTML = `<span style="color: #888; font-size: 10px;">[${timestamp}]</span> ${icon} ${message}`;

    // Clear initial message if it's still there
    if (logDiv.textContent.includes('Debug log will appear here...')) {
      logDiv.innerHTML = '';
    }

    logDiv.appendChild(logEntry);

    // Auto-scroll to bottom
    logDiv.scrollTop = logDiv.scrollHeight;

    // Keep only last 100 log entries to prevent memory issues
    while (logDiv.children.length > 100) {
      logDiv.removeChild(logDiv.firstChild);
    }
  }

  // Perform page scan
  performScan() {
    const resultsDiv = document.getElementById('debug-scan-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML =
      '<div style="color: #FFC107;">🔍 Scanning page...</div>';

    setTimeout(() => {
      try {
        // Find all buttons
        const allButtons = document.querySelectorAll(
          'div[aria-label="More options"]'
        );

        // Count processed vs unprocessed
        let processedButtons = 0;
        let unprocessedButtons = 0;
        let visibleButtons = 0;
        let hiddenButtons = 0;

        // Get global variables
        const processedItems = window.processedItems || new Set();
        const stuckItems = window.stuckItems || new Map();
        const getItemIdentifier = window.getItemIdentifier;
        const isElementVisible = window.isElementVisible;
        const isItemStuck = window.isItemStuck;

        for (const button of allButtons) {
          const isVisible = isElementVisible ? isElementVisible(button) : true;

          if (isVisible) {
            visibleButtons++;
          } else {
            hiddenButtons++;
          }

          if (getItemIdentifier && (isItemStuck || processedItems.size > 0)) {
            const itemId = getItemIdentifier(button);
            const stuck = isItemStuck ? isItemStuck(itemId) : false;

            if (processedItems.has(itemId) || stuck) {
              processedButtons++;
            } else {
              unprocessedButtons++;
            }
          } else {
            unprocessedButtons++;
          }
        }

        // Get stuck items info
        const stuckItemsCount = stuckItems.size || 0;
        const totalStuckSkips =
          stuckItems.size > 0
            ? Array.from(stuckItems.values()).reduce(
                (sum, count) => sum + count,
                0
              )
            : 0;

        // Get stats
        const stats = window.stats || {};

        resultsDiv.innerHTML = `
          <div style="font-weight: bold; color: #4CAF50; margin-bottom: 8px;">📊 Page Scan Results:</div>
          <div style="margin-bottom: 5px;">🎯 Total buttons found: <span style="color: #2196F3;">${
            allButtons.length
          }</span></div>
          <div style="margin-bottom: 5px;">👁️ Visible buttons: <span style="color: #4CAF50;">${visibleButtons}</span></div>
          <div style="margin-bottom: 5px;">🙈 Hidden buttons: <span style="color: #607D8B;">${hiddenButtons}</span></div>
          <div style="margin-bottom: 5px;">✅ Processed buttons: <span style="color: #4CAF50;">${processedButtons}</span></div>
          <div style="margin-bottom: 5px;">⏳ Unprocessed buttons: <span style="color: #FF9800;">${unprocessedButtons}</span></div>
          <div style="margin-bottom: 5px;">⚠️ Stuck items tracked: <span style="color: #f44336;">${stuckItemsCount}</span></div>
          <div style="margin-bottom: 5px;">🔄 Total stuck skips: <span style="color: #f44336;">${totalStuckSkips}</span></div>
          <div style="margin-bottom: 8px; padding-top: 5px; border-top: 1px solid #444;">
            <div style="color: #4CAF50;">Session Stats:</div>
            <div>• Deleted: ${stats.deleted || 0} | Failed: ${
          stats.failed || 0
        }</div>
            <div>• Skipped: ${stats.skipped || 0} | Total: ${
          stats.total || 0
        }</div>
            <div>• Page refreshes: ${stats.pageRefreshes || 0}</div>
          </div>
        `;

        // Scan completed successfully
        this.log('Page scan completed', 'info');
      } catch (error) {
        resultsDiv.innerHTML = `<div style="color: #f44336;">❌ Scan error: ${error.message}</div>`;
        this.log(`Debug scan error: ${error.message}`, 'error');
      }
    }, 100);
  }

  // Clear the debug log
  clearLog() {
    const logDiv = document.getElementById('debug-log');
    if (logDiv) {
      logDiv.innerHTML = 'Debug log will appear here...';
    }
  }

  // Show debug panel
  show() {
    if (this.debugPanel) {
      this.debugPanel.style.display = 'block';
      this.log('Debug panel opened', 'info');
    }
  }

  // Hide debug panel
  hide() {
    if (this.debugPanel) {
      this.debugPanel.style.display = 'none';
    }
  }

  // Toggle debug panel visibility
  toggle() {
    if (!this.isInitialized) {
      this.init();
    } else if (this.debugPanel) {
      if (this.debugPanel.style.display === 'none') {
        this.show();
      } else {
        this.hide();
      }
    }
  }

  // Remove debug panel completely
  destroy() {
    if (this.debugPanel) {
      this.debugPanel.remove();
      this.debugPanel = null;
    }

    // Restore original log function
    if (this.originalLog) {
      window.log = this.originalLog;
    }

    this.isInitialized = false;
  }
}

// Create global debugger instance (but don't auto-initialize)
window.fbCleanerDebugger = new FBCleanerDebugger();

// DEBUG PANEL CONTROL FUNCTION
// Uncomment the line below in your code when you want to enable the debug panel:
// enableDebugPanel();

function enableDebugPanel() {
  if (!window.fbCleanerDebugger.isInitialized) {
    window.fbCleanerDebugger.init();
    console.log(
      '🔧 Debug panel enabled. Press Ctrl+Shift+D to toggle visibility.'
    );
  } else {
    window.fbCleanerDebugger.show();
  }
}

// Make enableDebugPanel available globally for easy access
window.enableDebugPanel = enableDebugPanel;
