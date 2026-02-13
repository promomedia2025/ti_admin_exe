# How Users Can Check Their Version

Users have **3 easy ways** to check which version of the app they're running:

## Method 1: Window Title (Always Visible) ⭐

The version is displayed in the **window title bar** at the top of the app:
```
SpitikoExe v1.0.1
```

This is always visible, so users can see their version at a glance.

---

## Method 2: Keyboard Shortcut (Quick Access)

Press **`F1`** or **`Ctrl+I`** to open the About dialog.

The About dialog shows:
- **App Name**: SpitikoExe
- **Version**: 1.0.1
- **Electron Version**: (technical info)
- **Chrome Version**: (technical info)
- **Node.js Version**: (technical info)
- **Update Info**: Explains that updates check automatically

The dialog also has a **"Check for Updates"** button to manually check for new versions.

---

## Method 3: About Dialog (Programmatic)

If your web app needs to show version info, it can call:
```javascript
// In your web app's JavaScript
const versionInfo = await window.electron.getAppVersion();
console.log(versionInfo.version); // "1.0.1"
```

Or trigger the About dialog:
```javascript
await window.electron.showAbout();
```

---

## Summary

| Method | How to Access | What It Shows |
|--------|--------------|---------------|
| **Window Title** | Look at top of window | Version number |
| **F1 or Ctrl+I** | Press keyboard shortcut | Full About dialog with version + update check |
| **Programmatic** | Call from web app | Version info as JSON |

---

## For Developers

The version number comes from `package.json`:
```json
{
  "version": "1.0.1"
}
```

When you publish a new version, update this number and the window title will automatically show the new version.
