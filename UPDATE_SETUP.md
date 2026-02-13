# Auto-Update Setup Guide

This guide explains how to set up automatic updates for your Electron app.

## Prerequisites

1. A GitHub repository to host your releases
2. GitHub Personal Access Token with `repo` permissions

## Setup Steps

### 1. Install Dependencies

```bash
npm install electron-updater
```

### 2. Configure package.json

Update the `publish` section in `package.json` with the repository details:

```json
"publish": {
  "provider": "github",
  "owner": "REPO_OWNER_USERNAME",  // The owner of the repo (even if you're a collaborator)
  "repo": "REPO_NAME"
}
```

**Note**: Use the repository owner's username, not your own (unless you're the owner).

### 3. Set Up GitHub Releases

**As a Collaborator:**

1. You need a GitHub Personal Access Token with the following scopes:
   - `repo` (full control of private repositories) - This includes creating releases
   - Or `public_repo` if the repository is public

2. Create a token:
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Click "Generate new token (classic)"
   - Select the `repo` scope (or `public_repo` for public repos)
   - Generate and copy the token

3. Set the token as an environment variable:
   - Windows: `set GH_TOKEN=your_token_here`
   - macOS/Linux: `export GH_TOKEN=your_token_here`
   
   **Important**: Make sure you have write access to the repository. If you can't create releases, ask the owner to grant you "Write" or "Maintain" permissions.

4. Verify you can create releases:
   - Try creating a release manually on GitHub to confirm you have permissions

### 4. Build and Publish

When you're ready to release an update:

1. **Update the version** in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. **Build the app**:
   ```bash
   npm run build
   ```

3. **Publish to GitHub** (electron-builder will create a release automatically):
   ```bash
   npm run build -- --publish always
   ```

   Or publish manually:
   ```bash
   npm run build -- --publish onTagOrDraft
   ```

### 5. How It Works

- **Automatic Check**: The app checks for updates 5 seconds after startup and every 4 hours
- **Update Detection**: When a new version is found, it notifies the user
- **Download**: User can choose to download the update
- **Installation**: Update is installed automatically when the app quits

### 6. Using Updates in Your Frontend

In your React/HTML frontend, you can listen for update events:

```javascript
// Check for updates manually
window.electron.updater.checkForUpdates().then(result => {
  if (result.success && result.updateInfo) {
    console.log('Update available:', result.updateInfo.version);
  }
});

// Listen for update events
window.electron.updater.onUpdateAvailable((info) => {
  console.log('Update available:', info.version);
  // Show notification to user
});

window.electron.updater.onDownloadProgress((progress) => {
  console.log('Download progress:', progress.percent);
  // Update progress bar
});

window.electron.updater.onUpdateDownloaded((info) => {
  console.log('Update downloaded, will install on restart');
  // Show message to user
});

// Download and install update
window.electron.updater.downloadUpdate().then(() => {
  // Update downloaded, will install on next app restart
  window.electron.updater.installUpdate(); // Restarts app immediately
});
```

### 7. Alternative: Custom Update Server

If you don't want to use GitHub, you can host updates on your own server:

1. Update `package.json`:
   ```json
   "publish": {
     "provider": "generic",
     "url": "https://your-server.com/updates/"
   }
   ```

2. Host the update files on your server with this structure:
   ```
   updates/
   ├── latest.yml (or latest-mac.yml, latest-win.yml)
   ├── YourApp-1.0.1.exe
   └── YourApp-1.0.1.exe.blockmap
   ```

## Testing Updates

1. Build version 1.0.0 and install it
2. Update version to 1.0.1 in package.json
3. Build and publish the new version
4. Launch the installed app - it should detect the update

## Notes

- Updates only work in **packaged** apps (not in development mode)
- The app must be code-signed for Windows auto-updates to work properly
- GitHub releases are public by default - use a private repo if needed
