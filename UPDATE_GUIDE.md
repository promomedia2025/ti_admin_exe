# How to Push Updates to Users

This guide explains how to publish updates to users who have installed your .exe application.

## Prerequisites

1. **GitHub Personal Access Token**: You need a GitHub token with `repo` permissions
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate a new token with `repo` scope
   - Save it securely (you'll need it for publishing)

2. **Set Environment Variable**:
   ```bash
   # Windows PowerShell
   $env:GH_TOKEN="your_github_token_here"
   
   # Windows CMD
   set GH_TOKEN=your_github_token_here
   
   # Or add it permanently to your system environment variables
   ```

## Quick Start (Easiest Method)

### Option 1: Using PowerShell Script (Recommended)
```powershell
# Set your GitHub token (one time)
$env:GH_TOKEN="your_github_token_here"

# Publish update with version
.\publish-update.ps1 1.0.1
```

### Option 2: Using Batch Script
```cmd
REM Set your GitHub token (one time)
set GH_TOKEN=your_github_token_here

REM Publish update
publish-update.bat 1.0.1
```

### Option 3: Manual Method
1. Edit `package.json` and update version: `"version": "1.0.1"`
2. Set GitHub token: `$env:GH_TOKEN="your_token"`
3. Run: `npm run publish`

## Step-by-Step Process

### 1. Update Version Number

Edit `package.json` and increment the version:
```json
{
  "version": "1.0.1"  // Change from 1.0.0 to 1.0.1 (or higher)
}
```

**Important**: Version numbers must follow semantic versioning (e.g., 1.0.1, 1.1.0, 2.0.0)
- Each new version must be **higher** than the previous one
- Users won't receive updates if the version is the same or lower

### 2. Build and Publish

Run the publish command:
```bash
npm run publish
```

This will:
- Build the Windows installer (.exe)
- Create a GitHub release with the version tag
- Upload the installer and update files (`app-update.yml`, `.exe`, etc.)
- Make the update available to all users

### 3. Verify Release

Check your GitHub repository:
- Go to: `https://github.com/promomedia2025/ti_admin_exe/releases`
- Verify the new release was created
- Check that these files are present:
  - `SpitikoExe-Setup-x.x.x.exe` (installer)
  - `latest.yml` (update manifest)
  - Other update files

### 4. Users Will Receive Updates

- **Automatic checks**: Users' apps check for updates:
  - On app startup (5 seconds after launch)
  - Every 4 hours while running
- **Update notification**: When an update is available, users will see a notification
- **Download**: Users can choose to download the update
- **Installation**: The update installs automatically when they quit the app

## Update Flow for Users

1. User opens the app
2. App checks GitHub for new version (after 5 seconds)
3. If update found → User sees notification
4. User clicks "Download Update"
5. Update downloads in background
6. When download completes → User can install
7. Update installs when app quits

## Manual Update Check

Users can also manually check for updates if you expose a menu option or button that calls:
```javascript
// In your renderer process
const result = await window.electron.checkForUpdates();
```

## Testing Updates

Before publishing to all users, test the update process:

1. **Build without publishing** (dry run):
   ```bash
   npm run publish:dry-run
   ```

2. **Test locally**:
   - Install version 1.0.0
   - Publish version 1.0.1
   - Open the installed app
   - Verify it detects and downloads the update

## Troubleshooting

### If publishing fails:

1. **Check GitHub token**:
   ```bash
   echo $env:GH_TOKEN  # PowerShell
   echo %GH_TOKEN%     # CMD
   ```

2. **Verify repository**:
   - Repository exists: `promomedia2025/ti_admin_exe`
   - You have write access
   - Repository is accessible (not deleted/archived)

3. **Check version number**:
   - Must be higher than previous release
   - Follows semantic versioning format

4. **Check network/firewall**:
   - GitHub API is accessible
   - No corporate firewall blocking

### If users don't receive updates:

1. **Verify GitHub release**:
   - Check: `https://github.com/promomedia2025/ti_admin_exe/releases`
   - Ensure `latest.yml` file exists in release assets
   - Check release is not marked as "draft" or "pre-release"

2. **Check app logs**:
   - Look for update check messages in console
   - Check for network errors
   - Verify GitHub API responses

3. **User-side checks**:
   - Internet connectivity
   - Firewall/antivirus blocking
   - App has proper permissions

4. **Version comparison**:
   - Ensure new version is actually higher
   - Check `package.json` version matches release tag

## Version Numbering Best Practices

- **Patch updates** (1.0.0 → 1.0.1): Bug fixes, small improvements
- **Minor updates** (1.0.0 → 1.1.0): New features, backward compatible
- **Major updates** (1.0.0 → 2.0.0): Breaking changes, major features

## Security Notes

- Keep your GitHub token secure
- Never commit tokens to git
- Use environment variables or secure credential storage
- Consider using GitHub Actions for automated publishing
