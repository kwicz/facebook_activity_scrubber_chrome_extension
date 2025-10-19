// Variables to track state
let isRunning = false;
let isOnActivityPage = false;
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
  const step2 = document.querySelector('.step:nth-child(2)');
  const step3 = document.querySelector('.step:nth-child(3)');

  // Page navigation elements
  const mainPage = document.getElementById('mainPage');
  const nextStepsPage = document.getElementById('nextStepsPage');
  const nextStepsLink = document.getElementById('nextStepsLink');
  const backLink = document.getElementById('backLink');
  const demonetizeLink = document.getElementById('demonetizeLink');
  const deleteLink = document.getElementById('deleteLink');

  // Check page status immediately
  checkPageStatus();

  // Check page status periodically
  setInterval(checkPageStatus, 2000);

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

  // Function to check if user is on the correct page
  function checkPageStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) {
        updatePageStatus(false, 'Could not access current tab');
        return;
      }

      const currentUrl = tabs[0].url;

      if (!currentUrl.includes('facebook.com')) {
        updatePageStatus(false, 'Not on Facebook');
        return;
      }

      // Check if on activity log page
      const activityPagePatterns = [
        '/me/allactivity',
        '/allactivity',
        'allactivity',
        'activity_log',
      ];

      const isOnCorrectPage = activityPagePatterns.some((pattern) =>
        currentUrl.includes(pattern)
      );

      if (isOnCorrectPage) {
        updatePageStatus(true, 'Ready to clean activity log');
      } else {
        updatePageStatus(false, 'Please go to your Activity Log page');
      }
    });
  }

  // Function to update page status UI
  function updatePageStatus(isCorrect, message) {
    isOnActivityPage = isCorrect;

    if (isCorrect) {
      viewActivityLogButton.classList.remove('bounce', 'btn-warning');
      viewActivityLogButton.classList.add('btn-secondary');

      // Update main status when on correct page
      if (!isRunning) {
        updateStatus('Ready to clean your Facebook activity');
      }
    } else {
      viewActivityLogButton.classList.remove('btn-secondary');
      viewActivityLogButton.classList.add('bounce', 'btn-warning');

      // Update main status when not on correct page
      if (!isRunning) {
        updateStatus('Please navigate to your Facebook Activity Log first');
      }
    }

    // Update start button state
    updateButtonState();
  }

  // Start/Stop button handler
  startButton.addEventListener('click', function () {
    // Prevent starting if not on activity page
    if (!isOnActivityPage && !isRunning) {
      // Shake the start button
      startButton.classList.add('shake');
      viewActivityLogButton.classList.add('bounce');

      updateStatus('Please go to your Activity Log page first!');

      // Remove shake animation after it completes
      setTimeout(() => {
        startButton.classList.remove('shake');
      }, 500);

      return;
    }

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

  // Page navigation handlers
  nextStepsLink.addEventListener('click', function (e) {
    e.preventDefault();
    mainPage.classList.remove('active');
    nextStepsPage.classList.add('active');
  });

  backLink.addEventListener('click', function (e) {
    e.preventDefault();
    nextStepsPage.classList.remove('active');
    mainPage.classList.add('active');
  });

  // External link handlers
  demonetizeLink.addEventListener('click', function (e) {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://johnoliverwantsyourraterotica.com/',
    });
  });

  deleteLink.addEventListener('click', function (e) {
    e.preventDefault();
    chrome.tabs.create({
      url: 'https://accountscenter.facebook.com/personal_info/',
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
    } else if (message.action === 'cleaningCompleted') {
      // Cleaning process has fully completed
      setRunningState(false);
      updateStatusWithLink(
        'All Clean! Next step: ',
        'Demonetize your account',
        'https://johnoliverwantsyourraterotica.com/'
      );

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

// Helper function to update status with a clickable link
function updateStatusWithLink(prefix, linkText, linkUrl) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    // Clear existing content
    statusElement.textContent = '';

    // Add prefix text
    statusElement.appendChild(document.createTextNode(prefix));

    // Create and add link
    const link = document.createElement('a');
    link.textContent = linkText;
    link.href = linkUrl;
    link.target = '_blank';
    link.style.color = '#1877f2';
    link.style.fontWeight = '600';
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';

    // Ensure link opens in new tab
    link.addEventListener('click', function(e) {
      e.preventDefault();
      chrome.tabs.create({ url: linkUrl });
    });

    statusElement.appendChild(link);
  }
}

// Helper function to update the button state
function updateButtonState() {
  const startButton = document.getElementById('startButton');
  if (startButton) {
    if (isRunning) {
      startButton.textContent = 'Stop Cleaning';
      startButton.className = 'btn running';
      startButton.disabled = false;
    } else if (!isOnActivityPage) {
      startButton.textContent = 'Go to Activity Page First';
      startButton.className = 'btn';
      startButton.disabled = true;
    } else {
      startButton.textContent = 'Start Cleaning Process';
      startButton.className = 'btn';
      startButton.disabled = false;
    }
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
        // Inject both scripts in the correct order (debugger.js first, then content.js)
        chrome.scripting.executeScript(
          {
            target: { tabId: tabId },
            files: ['debugger.js', 'content.js'],
          },
          function (results) {
            if (chrome.runtime.lastError) {
              console.error(
                'Error injecting content scripts:',
                chrome.runtime.lastError.message
              );
              callback(false);
            } else {
              // Wait a moment for the scripts to initialize then verify it's working
              setTimeout(function () {
                verifyContentScriptActive(tabId, callback);
              }, 1000);
            }
          }
        );
      } else {
        // Script already exists and responded to ping
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
      callback(true);
    }
  });
}

// Helper to inject content script
function injectContentScript(tabId, callback) {
  chrome.scripting.executeScript(
    {
      target: { tabId: tabId },
      files: ['debugger.js', 'content.js'],
    },
    function () {
      if (chrome.runtime.lastError) {
        console.error(
          'Error injecting content scripts:',
          chrome.runtime.lastError.message
        );
        callback(false);
      } else {
        // Wait for scripts to initialize before callback
        setTimeout(function () {
          verifyContentScriptActive(tabId, callback);
        }, 1000);
      }
    }
  );
}
