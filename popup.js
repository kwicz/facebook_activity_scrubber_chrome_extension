// Variables to track state
let isRunning = false;
let stats = {
  deleted: 0,
  failed: 0,
  skipped: 0,
  total: 0,
};

// DOM elements
document.addEventListener('DOMContentLoaded', function () {
  const startButton = document.getElementById('startButton');
  const viewActivityLogButton = document.getElementById('viewActivityLog');
  const statusElement = document.getElementById('status');

  // Load any previous stats from storage
  chrome.storage.local.get(['cleanerStats'], function (result) {
    if (result.cleanerStats) {
      stats = result.cleanerStats;
      updateStatsDisplay();
    }
  });

  // Check if currently running - this needs to be reliable
  chrome.storage.local.get(['isRunning'], function (result) {
    isRunning = !!result.isRunning; // Convert to boolean
    updateButtonState();
  });

  // Start/Stop button handler
  startButton.addEventListener('click', function () {
    if (!isRunning) {
      // Starting the cleaning process

      // Immediately update UI to give feedback
      isRunning = true;
      updateButtonState();
      updateStatus('Initializing...');

      // Get settings (using default values)
      const settings = {
        activityType: 'all',
        timeRange: 'all',
        batchSize: 10,
        pauseInterval: 1000,
      };

      // Save settings
      chrome.storage.local.set({
        cleanerSettings: settings,
        isRunning: true,
      });

      // Send message to start cleaning
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (!tabs || !tabs[0]) {
          updateStatus('Error: Could not access the current tab');
          setRunningState(false);
          return;
        }

        if (!tabs[0].url.includes('facebook.com')) {
          updateStatus('Please navigate to Facebook first');
          setRunningState(false);
          return;
        }

        // First ensure content script is injected
        ensureContentScriptInjected(tabs[0].id, function (success) {
          if (!success) {
            updateStatus(
              'Error: Could not inject content script. Try reloading the page.'
            );
            setRunningState(false);
            return;
          }

          // Content script is ready, send the start command
          sendStartCommand(tabs[0].id, settings);
        });
      });
    } else {
      // Stopping the cleaning process
      setRunningState(false);
      updateStatus('Stopping cleaning process...');

      // Send message to stop cleaning
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0] && tabs[0].url.includes('facebook.com')) {
          sendStopCommand(tabs[0].id);
        }
      });
    }
  });

  // Send start command to content script
  function sendStartCommand(tabId, settings) {
    chrome.tabs.sendMessage(
      tabId,
      {
        action: 'startCleaning',
        settings: settings,
      },
      function (response) {
        // Don't check for lastError here as the port may close before response
        // Just rely on the storage and message listeners for state updates
      }
    );
  }

  // Send stop command to content script
  function sendStopCommand(tabId) {
    chrome.tabs.sendMessage(
      tabId,
      { action: 'stopCleaning' },
      function (response) {
        // We don't really care about the response here,
        // as we've already updated the UI
      }
    );
  }

  // View Activity Log button - now always goes to /me/allactivity
  viewActivityLogButton.addEventListener('click', function () {
    chrome.tabs.create({
      url: 'https://www.facebook.com/me/allactivity',
    });
  });

  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener(function (message) {
    if (message.action === 'updateStats') {
      stats = message.stats;
      updateStatsDisplay();

      // Save stats to storage
      chrome.storage.local.set({ cleanerStats: stats });
    } else if (message.action === 'updateStatus') {
      updateStatus(message.status);
    } else if (message.action === 'cleaningStarted') {
      // Content script confirms it started cleaning
      setRunningState(true);
      updateStatus('Cleaning in progress...');

      // Record the time of last command acknowledgment
      chrome.storage.local.set({ lastCommandTime: Date.now() });
    } else if (message.action === 'cleaningStopped') {
      // Content script confirms it stopped cleaning
      setRunningState(false);
      updateStatus('Cleaning stopped');

      // Record the time of last command acknowledgment
      chrome.storage.local.set({ lastCommandTime: Date.now() });
    }
  });
});

// Helper function to update the stats display
function updateStatsDisplay() {
  document.getElementById('deletedCount').textContent = stats.deleted;
  document.getElementById('failedCount').textContent =
    stats.skipped || stats.failed || 0;
}

// Helper function to update status text
function updateStatus(message) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// Helper function to update the button state
function updateButtonState() {
  const startButton = document.getElementById('startButton');
  if (startButton) {
    startButton.textContent = isRunning ? 'Stop Cleaning' : 'Start Cleaning';
    // Add visual indication of state while preserving the btn class
    startButton.className = isRunning ? 'btn running' : 'btn';
  }
}

// Helper to set the running state consistently
function setRunningState(running) {
  isRunning = running;
  updateButtonState();
  chrome.storage.local.set({ isRunning: running });
}

// Function to ensure the content script is injected before sending messages
function ensureContentScriptInjected(tabId, callback) {
  // First try to ping the existing content script
  try {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, function (response) {
      if (chrome.runtime.lastError) {
        console.log('Content script not detected, injecting it now...');

        // Inject the script
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            files: ['content.js'],
          },
          function (results) {
            if (chrome.runtime.lastError) {
              console.error(
                'Error injecting content script:',
                chrome.runtime.lastError.message
              );
              callback(false);
            } else {
              console.log('Content script injected successfully');

              // Wait a moment for the script to initialize then verify it's working
              setTimeout(function () {
                verifyContentScriptActive(tabId, callback);
              }, 500);
            }
          }
        );
      } else {
        // Script already exists and responded to ping
        console.log('Content script already active');
        callback(true);
      }
    });
  } catch (error) {
    console.error('Error checking content script:', error);

    // Try to inject anyway as a fallback
    injectContentScript(tabId, callback);
  }
}

// Helper to verify content script is active after injection
function verifyContentScriptActive(tabId, callback) {
  chrome.tabs.sendMessage(tabId, { action: 'ping' }, function (response) {
    if (chrome.runtime.lastError) {
      console.error(
        'Content script verification failed:',
        chrome.runtime.lastError.message
      );
      callback(false);
    } else {
      console.log('Content script verified active');
      callback(true);
    }
  });
}

// Helper to inject content script
function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      files: ['content.js'],
    },
    function () {
      if (chrome.runtime.lastError) {
        console.error(
          'Error injecting content script:',
          chrome.runtime.lastError.message
        );
        callback(false);
      } else {
        // Wait for script to initialize before callback
        setTimeout(function () {
          verifyContentScriptActive(tabId, callback);
        }, 500);
      }
    }
  );
}
