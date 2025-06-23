# Facebook Activity Scrubber - Logic Analysis

## Button Action Options

The extension identifies and handles the following **target actions** when processing Facebook activity items:

### Primary Target Actions

- **`Remove Tag`** - Removes tags from posts
- **`Unlike`** - Unlikes previously liked content
- **`Delete`** - Deletes posts/content
- **`Move to trash`** - Moves content to trash
- **`Remove Reaction`** - Removes reactions from posts

### Special Case Action

- **`Hide from profile`** - When this is the only available option in a menu, the extension will click it as a fallback action

## CSS Selectors Used

### Primary Element Selectors

#### Menu Button Selector

- **`div[aria-label="More options"]`** - Primary selector for finding the "More options" menu buttons on activity items

#### Menu Item Selectors

- **`div[role="menuitem"]`** - Selector for menu items that appear after clicking "More options"

#### Activity Item Container Selectors (Priority Order)

1. **`div[aria-label="Activity Log Item"]`** - Official Facebook activity log item container
2. **`div[role="article"]`** - Article role containers for activity items
3. **`div[role="listitem"]`** - List item containers for activity items
4. **`div[data-pagelet*="activity"]`** - Data-pagelet based activity containers
5. **Fallback**: 4-5 levels up from menu button if specific containers not found

### Date Extraction Selectors (Priority Order)

1. **`h2 span.html-span > span`** - Most specific date selector
2. **`span[role="text"] a`** - Span with text role containing links
3. **`[data-testid*="timestamp"]`** - Timestamp test ID elements
4. **`abbr`** - Abbreviation elements (often used for timestamps)
5. **`h2 span`** - General header span elements
6. **`a[href*="story_fbid"]`** - Story Facebook ID links
7. **`span.timestampContent`** - Timestamp content spans

### Activity Type Extraction Selectors

1. **`div:first-child > span[dir="auto"] > span.html-span > span.html-span > span > div`** - Specific activity type selector
2. **Fallback**: Text content analysis for keywords (liked, comment, post, tag, etc.)

### Content Extraction Selectors (Priority Order)

1. **`div:nth-child(2) > span[dir="auto"] > span.html-span > span.html-span`** - Specific content selector
2. **`div[dir="auto"]`** - Auto-direction divs
3. **`span[dir="auto"]`** - Auto-direction spans
4. **`div.userContent`** - User content divs
5. **`div[data-ad-preview="message"]`** - Ad preview message divs
6. **`span.userContent`** - User content spans

### Link Extraction Selectors

- **`a[aria-label="View"]`** - View button links
- **`a[href*="story_fbid"]`** - Story Facebook ID links
- **`a[href*="posts"]`** - Posts links

### Confirmation Modal Selectors

#### Modal Container Selectors

- **`div[aria-label="Delete?"]`** - Delete confirmation modal
- **`div[aria-label="Remove?"]`** - Remove confirmation modal
- **`div[aria-label="Remove tags?"]`** - Remove tags confirmation modal
- **`div[aria-label="Move to Trash?"]`** - Move to trash confirmation modal

#### Confirmation Button Selectors

- **`div[aria-label="Delete"]`** - Delete confirmation button
- **`div[aria-label="Remove"]`** - Remove confirmation button
- **`div[aria-label="Move to Trash"]`** - Move to trash confirmation button

### Debug and Scanning Selectors

- **`div[role="listitem"]`** - List items for page structure scanning
- **`div[role="article"]`** - Articles for page structure scanning

### Timestamp Selectors for Fingerprinting

- **`abbr`** - Abbreviation elements for timestamps
- **`[data-testid*="timestamp"]`** - Timestamp test ID elements
- **`data-utime`** - Unix timestamp attribute

## Clicking Configuration Options

### Timing Settings

All timing values are configurable and specified in milliseconds:

- **`menuWait: 700`** - Wait time after clicking the "More options" menu button
- **`modalWait: 700`** - Wait time for confirmation modal to appear
- **`actionComplete: 1200`** - Wait time for the action to complete after confirmation
- **`nextItem: 1000`** - Wait time before proceeding to the next item
- **`pageLoad: 2500`** - Wait time after page reload

### Activity Type Filtering

Controls which types of Facebook activities are processed:

- **`activityType: 'all'`** - Process all types of activities (default)
- **`activityType: 'likes'`** - Process only liked content
- **`activityType: 'posts'`** - Process only posts
- **`activityType: 'comments'`** - Process only comments

### Processing Configuration

- **`batchSize: 10`** - Number of items to process in each batch
- **`pauseInterval: 1000`** - Pause duration between batches (milliseconds)
- **`timeRange: 'all'`** - Time range for content to process

## Skipping Logic

### ItemTracker System

The extension now uses a robust content-based fingerprinting system instead of DOM-based tracking:

#### Fingerprint Components

- **Date**: Activity date extracted from the item
- **Type**: Activity type (like, post, comment, etc.)
- **Content**: First 50 characters of activity content
- **Timestamp**: Unix timestamp or text content from timestamp elements
- **Story ID**: Facebook story ID extracted from links

#### Skipping Behavior

1. **Content-Based Tracking** - Items are tracked using unique fingerprints created from their content
2. **Retry Logic** - Failed items are retried up to 3 times before being permanently skipped
3. **Permanent Skipping** - Items with no target actions are immediately marked as permanently skipped
4. **Memory Management** - Periodic cleanup prevents memory leaks from accumulated tracking data

### Failure Handling & Retry Options

- **`maxConsecutiveFailures: 5`** - Maximum number of consecutive failures before triggering page refresh
- **`maxPageRefreshes: 5`** - Maximum number of page refreshes to attempt when looking for more content
- **`maxActionRetries: 2`** - Maximum retry attempts for failed individual actions
- **`maxAttempts: 3`** - Maximum attempts per item in ItemTracker system

## Confirmation Modal Handling

The extension automatically detects and handles Facebook's confirmation dialogs:

### Supported Confirmation Modals

- **`Delete?`** modal → Clicks the "Delete" button
- **`Remove?`** modal → Clicks the "Remove" button
- **`Remove tags?`** modal → Clicks the "Remove" button
- **`Move to Trash?`** modal → Clicks the "Move to Trash" button

### Modal Detection Strategy

The extension uses aria-label selectors to identify confirmation dialogs and their corresponding action buttons, ensuring reliable interaction across Facebook's UI changes.

## Smart Behavior & Recovery

### Automatic Page Management

- **Page Refresh Logic** - Refreshes the page when all visible buttons have been processed and handled
- **Content Loading** - Automatically scrolls to load more content when no unprocessed buttons are found
- **Completion Detection** - Stops processing when maximum page refreshes are reached, indicating no more content is available

### Error Recovery Mechanisms

- **Action Retry System** - Failed actions are retried up to the configured maximum with full menu re-opening
- **Menu Cleanup** - Uses Escape key to close stuck menus or modal dialogs
- **Error Classification** - Tracks different error types (ConfirmationFailed, ModalError, UnknownError) for debugging and reporting
- **ItemTracker Recovery** - Failed attempts are tracked and retried intelligently

### Processing Flow

1. Find all "More options" buttons on the page using `div[aria-label="More options"]`
2. Filter out already processed items using ItemTracker fingerprinting
3. Identify visible buttons in viewport
4. Extract activity metadata (date, type, content) using multiple fallback selectors
5. Click menu button and create item fingerprint
6. Scan menu items for target actions using `div[role="menuitem"]`
7. Execute action and handle confirmation modal using aria-label selectors
8. Record success/failure in ItemTracker system
9. Wait for completion and move to next item
10. Refresh page when all items processed or max attempts reached

This comprehensive system ensures reliable, efficient processing of Facebook activity while maintaining robustness against UI changes and network issues through multiple fallback selectors and intelligent retry mechanisms.
