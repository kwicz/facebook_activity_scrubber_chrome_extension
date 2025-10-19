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
  const landingScreen = document.getElementById('landingScreen');
  const featureContainer = document.getElementById('featureContainer');
  const btnDemonetize = document.getElementById('btnDemonetize');
  const btnScrub = document.getElementById('btnScrub');
  const startButton = document.getElementById('startButton');
  const viewActivityLogButton = document.getElementById('viewActivityLog');
  const statusElement = document.getElementById('status');
  const step2 = document.querySelector('.step:nth-child(2)');
  const step3 = document.querySelector('.step:nth-child(3)');
  const debugToggle = document.getElementById('debugToggle');
  const demonetizeContainer = document.getElementById('demonetizeContainer');
  const demonetizeStatus = document.getElementById('demonetizeStatus');
  const startDemonetize = document.getElementById('startDemonetize');
  const demonetizeRetry = document.getElementById('demonetizeRetry');
  const confettiCanvas = document.getElementById('confettiCanvas');
  const demonetizeDone = document.getElementById('demonetizeDone');

  if (landingScreen && featureContainer && demonetizeContainer) {
    landingScreen.style.display = 'flex';
    featureContainer.style.display = 'none';
    demonetizeContainer.style.display = 'none';
  }

  if (btnDemonetize) {
    btnDemonetize.addEventListener('click', function () {
      landingScreen.style.display = 'none';
      featureContainer.style.display = 'none';
      demonetizeContainer.style.display = 'flex';
      if (demonetizeStatus) demonetizeStatus.style.display = 'none';
    });
  }

  if (btnScrub) {
    btnScrub.addEventListener('click', function () {
      landingScreen.style.display = 'none';
      featureContainer.style.display = 'block';
      demonetizeContainer.style.display = 'none';
      if (demonetizeStatus) demonetizeStatus.style.display = 'none';
    });
  }

  function showRetryButton() {
    if (demonetizeRetry) demonetizeRetry.style.display = 'block';
  }
  function hideRetryButton() {
    if (demonetizeRetry) demonetizeRetry.style.display = 'none';
  }

  if (demonetizeRetry) {
    demonetizeRetry.addEventListener('click', function () {
      hideRetryButton();
      if (startDemonetize) startDemonetize.click();
    });
  }

  function showConfetti() {
    if (!confettiCanvas) return;
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiCanvas.style.display = 'block';
    const ctx = confettiCanvas.getContext('2d');
    const confettiCount = 120;
    const confetti = [];
    for (let i = 0; i < confettiCount; i++) {
      confetti.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height,
        r: Math.random() * 6 + 4,
        d: Math.random() * confettiCount,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`,
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      });
    }
    let angle = 0;
    let animationFrame;
    function drawConfetti() {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      angle += 0.01;
      for (let i = 0; i < confetti.length; i++) {
        let c = confetti[i];
        c.y += (Math.cos(angle + c.d) + 3 + c.r / 2) * 0.7;
        c.x += Math.sin(angle);
        c.tiltAngle += c.tiltAngleIncremental;
        c.tilt = Math.sin(c.tiltAngle) * 15;
        ctx.beginPath();
        ctx.lineWidth = c.r;
        ctx.strokeStyle = c.color;
        ctx.moveTo(c.x + c.tilt + c.r / 3, c.y);
        ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r);
        ctx.stroke();
      }
      animationFrame = requestAnimationFrame(drawConfetti);
    }
    drawConfetti();
    setTimeout(() => {
      cancelAnimationFrame(animationFrame);
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiCanvas.style.display = 'none';
    }, 2500);
  }

  function showDoneButton() {
    if (demonetizeDone) demonetizeDone.style.display = 'block';
  }
  function hideDoneButton() {
    if (demonetizeDone) demonetizeDone.style.display = 'none';
  }
  if (demonetizeDone) {
    demonetizeDone.addEventListener('click', function () {
      hideDoneButton();
      if (confettiCanvas) confettiCanvas.style.display = 'none';
      // Return to landing screen
      if (landingScreen && demonetizeContainer) {
        landingScreen.style.display = 'flex';
        demonetizeContainer.style.display = 'none';
      }
    });
  }

  function updateDemonetizeProgress(step, status) {
    const icons = {
      pending: '⏳',
      inprogress: '🔄',
      done: '✅',
      error: '❌',
    };
    for (let i = 1; i <= 3; i++) {
      const iconEl = document.getElementById(`demonetizeStep${i}Icon`);
      if (iconEl) {
        if (i < step) {
          iconEl.textContent = icons.done;
        } else if (i === step) {
          iconEl.textContent = icons[status] || icons.inprogress;
        } else {
          iconEl.textContent = icons.pending;
        }
      }
    }
    // Inline status message
    if (demonetizeStatus) {
      if (status === 'inprogress') {
        demonetizeStatus.textContent = `Setting ${step} of 3 updated`;
        demonetizeStatus.style.display = 'block';
      }
    }
  }

  if (startDemonetize && demonetizeStatus) {
    startDemonetize.addEventListener('click', function () {
      demonetizeStatus.textContent = 'Starting demonetization process...';
      demonetizeStatus.style.display = 'block';
      hideRetryButton();
      hideDoneButton();
      updateDemonetizeProgress(1, 'inprogress');
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const activeTab = tabs[0];
        if (
          activeTab &&
          activeTab.url &&
          activeTab.url.includes('facebook.com')
        ) {
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: 'startDemonetize' },
            function (response) {
              if (chrome.runtime.lastError) {
                demonetizeStatus.textContent =
                  'Could not communicate with Facebook tab. Please make sure you are on Facebook.';
                updateDemonetizeProgress(1, 'error');
                showRetryButton();
              } else if (response && response.status) {
                demonetizeStatus.textContent = response.status;
                // Update progress based on response
                if (
                  response.status.includes(
                    'Ad partner activity preference updated'
                  )
                ) {
                  updateDemonetizeProgress(2, 'inprogress');
                } else if (
                  response.status.includes(
                    'Ads from ad partners opt-out complete'
                  )
                ) {
                  updateDemonetizeProgress(3, 'inprogress');
                } else if (
                  response.status.includes('Future activity disconnected')
                ) {
                  updateDemonetizeProgress(3, 'done');
                  showConfetti();
                  showDoneButton();
                } else if (response.status.includes('Error')) {
                  // Try to infer which step failed
                  if (response.status.includes('ad partner')) {
                    updateDemonetizeProgress(1, 'error');
                  } else if (response.status.includes('ads from ad partners')) {
                    updateDemonetizeProgress(2, 'error');
                  } else if (response.status.includes('future activity')) {
                    updateDemonetizeProgress(3, 'error');
                  }
                  showRetryButton();
                }
              } else {
                demonetizeStatus.textContent =
                  'Demonetization process started.';
              }
            }
          );
        } else {
          demonetizeStatus.textContent =
            'Please open Facebook in a tab and try again.';
          updateDemonetizeProgress(1, 'error');
          showRetryButton();
        }
      });
    });
  }

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

  // Debug toggle functionality
  let debugEnabled = false;

  // Load debug state from storage
  chrome.storage.local.get(['debugEnabled'], function (result) {
    debugEnabled = !!result.debugEnabled;
    updateDebugToggleUI();
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

  // Debug toggle button handler
  if (debugToggle) {
    debugToggle.addEventListener('click', function () {
      debugEnabled = !debugEnabled;
      chrome.storage.local.set({ debugEnabled: debugEnabled });
      updateDebugToggleUI();
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: 'toggleDebug',
              enabled: debugEnabled,
            },
            function (response) {
              // Optionally handle response
            }
          );
        }
      });
    });
  }

  // Update debug toggle button appearance
  function updateDebugToggleUI() {
    if (debugToggle) {
      if (debugEnabled) {
        debugToggle.classList.add('active');
        debugToggle.textContent = 'Debug ON';
        debugToggle.title = 'Click to disable debug panel';
      } else {
        debugToggle.classList.remove('active');
        debugToggle.textContent = 'Debug OFF';
        debugToggle.title = 'Click to enable debug panel';
      }
    }
  }
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
        console.log('Content script not detected, injecting it now...');

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
              console.log('Content scripts injected successfully');

              // Wait a moment for the scripts to initialize then verify it's working
              setTimeout(function () {
                verifyContentScriptActive(tabId, callback);
              }, 1000);
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
