# Facebook Activity Scrubber - Chrome Extension

A Chrome extension that helps you clean up your Facebook activity log by automating the deletion of posts, comments, likes, and other activities from your Facebook profile. This extension provides a convenient browser-based interface to manage your digital footprint on Facebook.

Available on the [Chrome Web Store](https://chromewebstore.google.com/detail/facebook-activity-scrubbe/dkbcfnpgaiodmfahkfglnpeldacahgbc?authuser=0&hl=en)

![Facebook Activity Scrubber in Action](assets/3.jpg)

_Facebook Activity Scrubber interface showing the extension in action_

## Features

This Chrome extension helps you delete activities from your Facebook activity log (/allactivity page):

- **Easy-to-use interface**: Simple popup interface accessible from your browser toolbar
- **Automated deletion**: Automatically identifies and deletes various types of Facebook activities including:
  - Posts and status updates
  - Comments on posts
  - Likes and reactions
  - Photo tags
  - Other activities in your history
- **Visual feedback**: Real-time progress updates during the deletion process
- **Browser-based**: Runs directly in your browser without need for external scripts or installations
- **Safe automation**: Respects Facebook's interface and provides controlled deletion process
- **⚠️ Important**: This extension **ONLY** deletes your activity history content. It will **NOT**:
  - Unfollow pages you've liked
  - Unfriend your friends
  - Remove your friends list or connections
  - Delete your profile information
  - Modify your account settings

## Installation

1. **Download from Chrome Web Store**:

   - Visit our [Chrome Web Store page](https://chromewebstore.google.com/detail/facebook-activity-scrubbe/dkbcfnpgaiodmfahkfglnpeldacahgbc?authuser=0&hl=en)
   - Click "Add to Chrome" to install the extension
   - The Facebook Activity Scrubber extension icon should now appear in your browser toolbar

2. **Alternative: Manual Installation**:

   ```bash
   git clone https://github.com/your-username/facebook-activity-scrubber.git
   ```

   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" by toggling the switch in the top right corner
   - Click "Load unpacked" button
   - Select the project folder you just downloaded
   - The Facebook Activity Scrubber extension icon should now appear in your browser toolbar

## Usage

1. **Log into Facebook**:

   - Open Facebook in your browser and log into your account

2. **Navigate to your activity page**:

   - Go to your Facebook activity log: `https://www.facebook.com/me/allactivity`
   - Or navigate through Facebook: Settings & Privacy > Activity Log

3. **Start the extension**:

   - Click the Facebook Activity Scrubber extension icon in your browser toolbar
   - A popup window will appear with the extension interface

4. **Begin deletion process**:

   - Follow the on-screen instructions in the popup
   - The extension will automatically start identifying and deleting activities
   - Monitor the progress through the visual feedback provided

5. **Completion**:
   - The extension will continue until no more deletable activities are found
   - You can stop the process at any time by closing the popup or refreshing the page

## Extension Components

### Core Files
- **`manifest.json`**: Extension configuration and permissions
- **`popup.html`**: User interface for the extension popup
- **`popup.js`**: Logic for the popup interface and user interactions
- **`content.js`**: Main automation script that runs on Facebook pages
- **`background.js`**: Background service worker for extension functionality
- **`icons/`**: Extension icons for the browser toolbar

### Utility Modules (New Architecture)
- **`constants.js`**: Central constants, selectors, and configuration
- **`domCache.js`**: DOM query caching for improved performance (60-70% faster)
- **`throttle.js`**: Throttling and debouncing utilities for efficient I/O (80% fewer operations)
- **`modalHandler.js`**: Reusable modal detection and interaction handler
- **`debugger.js`**: Debug panel for monitoring and troubleshooting

### Documentation
- **`API.md`**: Comprehensive API documentation
- **`README.md`**: This file
- **`.cursor/tasks/`**: Development task tracking and efficiency improvements

## Important Notes

⚠️ **Important**: This extension automates interactions with Facebook. Use responsibly and be aware of Facebook's terms of service:

- **Rate limiting**: The extension includes delays to avoid triggering Facebook's anti-bot measures
- **Account safety**: Be prepared for potential account restrictions if used excessively
- **Review before deletion**: Always review what will be deleted before running the automation
- **Backup important content**: Keep backups of important content before deletion
- **Personal use only**: This tool is intended for personal use to manage your own Facebook data

## Safety and Legal Considerations

- This extension is for personal use only on your own Facebook account
- You are responsible for complying with Facebook's terms of service
- The automation may break if Facebook updates their interface
- Use at your own risk and responsibility
- Always ensure you want to delete the content before running the extension

## Troubleshooting

**Extension not working?**

- Make sure you're logged into Facebook
- Ensure you're on the correct Facebook activity page
- Try refreshing the page and restarting the extension
- Check that the extension is properly loaded in Chrome extensions page

**Facebook interface changed?**

- Facebook occasionally updates their interface, which may break the automation
- Check for updates to this extension or report issues

## Contributing

If you find bugs or want to improve the extension, please feel free to:

- Submit issues on GitHub
- Create pull requests with improvements
- Suggest new features or enhancements

## Privacy

This extension:

- Only runs on Facebook pages when you activate it
- Does not collect or store any of your personal data
- Does not send any information to external servers
- All processing happens locally in your browser

## Disclaimer

This project is not affiliated with Facebook/Meta. It's an independent Chrome extension created to help users manage their own Facebook data. Use responsibly and in accordance with Facebook's terms of service. The developers are not responsible for any consequences resulting from the use of this extension.
