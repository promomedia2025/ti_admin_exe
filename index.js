const { app, BrowserWindow, ipcMain, protocol, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

// Get app version
const appVersion = app.getVersion();

// Configure command line switches to allow autoplay and audio without user gesture
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("enable-features", "AutoplayIgnoreWebAudio");

let mainWindow;

// Function to get the saved domain from userData
function getSavedDomain() {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'app-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.domain && config.domain.trim() !== '') {
        return config.domain.trim();
      }
    }
  } catch (error) {
    console.warn("⚠️ Failed to read saved domain:", error.message);
  }
  
  return null;
}

// Function to save domain to userData
function saveDomain(domain) {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'app-config.json');
    
    // Clean up domain: remove protocol and path if included
    let cleanedDomain = domain.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/admin\/?$/i, '')
      .trim();
    
    const config = {
      domain: cleanedDomain,
      savedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log("✅ Domain saved:", cleanedDomain);
    return cleanedDomain;
  } catch (error) {
    console.error("❌ Failed to save domain:", error.message);
    throw error;
  }
}

// Function to delete saved domain (for uninstall)
function deleteSavedDomain() {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'app-config.json');
    
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log("✅ Saved domain deleted");
    }
  } catch (error) {
    console.warn("⚠️ Failed to delete saved domain:", error.message);
  }
}

// Function to get the configured URL
function getConfiguredURL() {
  const defaultDomain = "localhost:3000";
  const protocol = "https://";
  const urlPath = "/admin";
  
  const savedDomain = getSavedDomain();
  const domain = savedDomain || defaultDomain;
  
  // Construct full URL: https://[domain]/admin
  const fullURL = `${protocol}${domain}${urlPath}`;
  console.log("🌐 Full URL:", fullURL);
  return fullURL;
}

let settingsWindow = null;

function createSettingsWindow() {
  // Check if settings window already exists
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    resizable: false,
    center: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load settings page - works in both development and production
  const settingsPath = path.join(__dirname, 'settings.html');
  settingsWindow.loadFile(settingsPath);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function createWindow() {
  // Check if domain is configured
  const savedDomain = getSavedDomain();
  
  if (!savedDomain) {
    // No domain configured, show settings page
    console.log("📝 No domain configured, showing settings page");
    createSettingsWindow();
    return;
  }

  // Domain is configured, load the main application
  const url = getConfiguredURL();

  // Create the browser window in fullscreen mode
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
      // Allow autoplay in media elements
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  // Set window title with version
  mainWindow.setTitle(`SpitikoExe v${appVersion}`);

  // Load the URL
  mainWindow.loadURL(url);

  // Open DevTools (optional - remove this line if you don't want DevTools)
  // mainWindow.webContents.openDevTools();

  // Add keyboard shortcut to show About dialog (F1 or Ctrl+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F1' || (input.control && input.key.toLowerCase() === 'i')) {
      event.preventDefault();
      showAboutDialog();
    }
  });

  // Send autofill data to renderer
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.webContents.send("autofill-data", {
      username: "savedUsername",
      password: "savedPassword",
    });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function focusWindow() {
  if (!mainWindow) {
    return;
  }

  // Check if window is minimized
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  // Check if window is not focused
  if (!mainWindow.isFocused()) {
    mainWindow.focus();
  }

  // Bring window to front
  mainWindow.show();
}

// Function to show About/Version dialog
function showAboutDialog() {
  const productName = app.getName();
  const version = app.getVersion();
  const electronVersion = process.versions.electron;
  const chromeVersion = process.versions.chrome;
  const nodeVersion = process.versions.node;
  
  dialog.showMessageBox(mainWindow || null, {
    type: 'info',
    title: 'About',
    message: `${productName}`,
    detail: `Version: ${version}\n\n` +
            `Electron: ${electronVersion}\n` +
            `Chrome: ${chromeVersion}\n` +
            `Node.js: ${nodeVersion}\n\n` +
            `To check for updates, the app automatically checks on startup and every 4 hours.`,
    buttons: ['Check for Updates', 'OK'],
    defaultId: 1,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      // User clicked "Check for Updates"
      autoUpdater.checkForUpdates().catch(err => {
        dialog.showErrorBox('Update Check Failed', 
          'Unable to check for updates. Please check your internet connection.');
      });
    }
  });
}

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, let user choose
autoUpdater.autoInstallOnAppQuit = true; // Auto-install on app quit

// Set cache directory to user data directory to avoid temp file permission issues
if (app.isPackaged) {
  try {
    const userDataPath = app.getPath('userData');
    const cacheDir = path.join(userDataPath, 'update-cache');
    // Ensure cache directory exists
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    // electron-updater will use this automatically, but we can set it explicitly if needed
  } catch (error) {
    console.warn('⚠️ Failed to set up update cache directory:', error.message);
  }
}

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  console.log('✅ Update available:', info.version);
  // Show native dialog to user
  dialog.showMessageBox(mainWindow || null, {
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available!`,
    detail: 'Would you like to download and install it now?',
    buttons: ['Download Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      // User clicked "Download Now"
      console.log('📥 User chose to download update');
      autoUpdater.downloadUpdate();
    } else {
      console.log('⏸️ User chose to download later');
    }
  });
  
  // Also send to renderer if needed
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('ℹ️ Update not available. Current version is latest.');
  if (mainWindow) {
    mainWindow.webContents.send('update-not-available');
  }
});

autoUpdater.on('error', (err) => {
  console.error('❌ Error in auto-updater:', err);
  // Don't show temp file errors to users - they're usually non-critical
  if (err.message && err.message.includes('temp') && err.message.includes('write')) {
    console.warn('⚠️ Temp file write error (non-critical):', err.message);
    return; // Silently ignore temp file write errors
  }
  if (mainWindow) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
  console.log('📥 Download progress:', message);
  
  // Update window title with progress (non-intrusive)
  if (mainWindow) {
    const percent = Math.round(progressObj.percent);
    mainWindow.setTitle(`SpitikoExe - Downloading update ${percent}%`);
  }
  
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update downloaded:', info.version);
  
  // Restore window title
  if (mainWindow) {
    mainWindow.setTitle(`SpitikoExe v${appVersion}`);
  }
  
  // Show dialog asking user to restart
  dialog.showMessageBox(mainWindow || null, {
    type: 'info',
    title: 'Update Ready',
    message: `Update ${info.version} has been downloaded!`,
    detail: 'The update will be installed when you restart the application. Would you like to restart now?',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      // User clicked "Restart Now"
      console.log('🔄 User chose to restart and install update');
      autoUpdater.quitAndInstall(false, true);
    } else {
      console.log('⏸️ User chose to install later');
      // Update will be installed automatically when app quits
    }
  });
  
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// IPC handlers for update control
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    // Silently handle temp file write errors - they're non-critical
    if (error.message && error.message.includes('temp') && error.message.includes('write')) {
      console.warn('⚠️ Update check failed due to temp file issue (non-critical)');
      return { success: false, error: 'Temp file access issue - updates may not be available' };
    }
    console.error('Error checking for updates:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    // Silently handle temp file write errors
    if (error.message && error.message.includes('temp') && error.message.includes('write')) {
      console.warn('⚠️ Update download failed due to temp file issue');
      return { success: false, error: 'Temp file access issue - cannot download update' };
    }
    console.error('Error downloading update:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
  return { success: true };
});

// IPC handlers for settings page
ipcMain.handle('save-domain', async (event, domain) => {
  try {
    const cleanedDomain = saveDomain(domain);
    return { success: true, domain: cleanedDomain };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-saved-domain', async () => {
  return getSavedDomain();
});

ipcMain.handle('get-app-version', async () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  };
});

ipcMain.handle('show-about', async () => {
  showAboutDialog();
  return { success: true };
});

ipcMain.on('settings-saved', () => {
  // Close settings window and create main window
  if (settingsWindow) {
    settingsWindow.close();
    settingsWindow = null;
  }
  
  // Create main window with the saved domain
  if (!mainWindow) {
    createWindow();
  } else {
    // Reload main window with new domain
    const url = getConfiguredURL();
    mainWindow.loadURL(url);
    mainWindow.focus();
  }
});

ipcMain.on('settings-cancelled', () => {
  // If no domain is configured and user cancels, quit the app
  const savedDomain = getSavedDomain();
  if (!savedDomain) {
    console.log("📝 No domain configured and user cancelled, quitting app");
    app.quit();
  } else {
    // Just close settings window
    if (settingsWindow) {
      settingsWindow.close();
      settingsWindow = null;
    }
  }
});

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Register custom protocol for local files - must be done before creating windows
  protocol.registerFileProtocol("app", (request, callback) => {
    const filePath = request.url.replace("app://", "");
    const normalizedPath = path.normalize(path.join(__dirname, filePath));

    // Check if file exists
    fs.access(normalizedPath, fs.constants.F_OK, (err) => {
      if (err) {
        callback({ error: -6 }); // FILE_NOT_FOUND
      } else {
        callback({ path: normalizedPath });
      }
    });
  });

  createWindow();

  // Check for updates on app start (only in production, not in development)
  if (!app.isPackaged) {
    console.log('⚠️ Auto-updater disabled in development mode');
  } else {
    // Check for updates 5 seconds after app starts (with error handling)
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        // Silently handle temp file errors
        if (err.message && err.message.includes('temp') && err.message.includes('write')) {
          console.warn('⚠️ Update check failed due to temp file issue (non-critical)');
          return;
        }
        console.error('❌ Failed to check for updates:', err.message);
      });
    }, 5000);
    
    // Check for updates every 4 hours (with error handling)
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(err => {
        // Silently handle temp file errors
        if (err.message && err.message.includes('temp') && err.message.includes('write')) {
          console.warn('⚠️ Update check failed due to temp file issue (non-critical)');
          return;
        }
        console.error('❌ Failed to check for updates:', err.message);
      });
    }, 4 * 60 * 60 * 1000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handler for printing PDFs silently
ipcMain.on('print-pdf', async (event, { pdfData, silent, printBackground, deviceName, paperSize }) => {
  try {
    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfData, 'base64');
    
    // Create temporary file
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, `invoice-${Date.now()}.pdf`);
    
    // Write PDF to temp file
    fs.writeFileSync(tempFilePath, pdfBuffer);
    
    // Create a hidden BrowserWindow
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        plugins: true,
      },
    });
    
    // Load PDF using data URL
    const dataUrl = `data:application/pdf;base64,${pdfData}`;
    await printWindow.loadURL(dataUrl);
    
    // Wait for PDF to load
    await new Promise((resolve) => {
      printWindow.webContents.once('did-finish-load', resolve);
      setTimeout(resolve, 3000); // Fallback timeout
    });
    
    // Print silently
    printWindow.webContents.print({
      silent: true, // CRITICAL: Force silent
      printBackground: printBackground !== false,
      deviceName: deviceName || undefined,
    }, (success, failureReason) => {
      if (success) {
        console.log('✅ PDF printed successfully');
      } else {
        console.error('❌ PDF print failed:', failureReason);
      }
      
      // Clean up
      printWindow.close();
      setTimeout(() => {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (err) {
          console.warn('Failed to delete temp file:', err);
        }
      }, 1000);
    });
    
  } catch (error) {
    console.error('❌ Error printing PDF:', error);
  }
});

// Focus window handler
ipcMain.handle("focus-window", () => {
  focusWindow();
  return { success: true };
});

// Get printers handler
ipcMain.handle("get-printers", async (event) => {
  try {
    let printers = [];
    let methodUsed = '';
    
    // Use PowerShell command as primary method on Windows
    if (process.platform === 'win32') {
      console.log('✅ Using PowerShell command to get printers');
      methodUsed = 'PowerShell Get-Printer';
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        // Get default printer name first
        const { stdout: defaultStdout } = await execAsync('powershell -Command "$default = Get-Printer | Where-Object {$_.Default -eq $true}; if ($default) { $default.Name } else { \\\"\\\" }"');
        const defaultPrinterName = defaultStdout.trim();
        
        // Get all printers with Name and PrinterStatus only
        const { stdout } = await execAsync('powershell -Command "Get-Printer | Select-Object Name, PrinterStatus | ConvertTo-Json"');
        const printerData = JSON.parse(stdout);
        
        printers = Array.isArray(printerData) 
          ? printerData.map(p => ({
              name: p.Name,
              displayName: p.Name,
              description: p.PrinterStatus || '',
              printerStatus: p.PrinterStatus,
              isDefault: p.Name === defaultPrinterName,
            }))
          : [{
              name: printerData.Name,
              displayName: printerData.Name,
              description: printerData.PrinterStatus || '',
              printerStatus: printerData.PrinterStatus,
              isDefault: printerData.Name === defaultPrinterName,
            }];
      } catch (cmdError) {
        console.error('❌ Error getting printers via PowerShell:', cmdError);
        printers = [];
      }
    }
    // Fallback to Electron API for non-Windows platforms
    else {
      const sender = event.sender;
      
      // Try using mainWindow.webContents.getPrintersAsync() first
      if (mainWindow && mainWindow.webContents && typeof mainWindow.webContents.getPrintersAsync === 'function') {
        console.log('✅ Using mainWindow.webContents.getPrintersAsync()');
        methodUsed = 'mainWindow.webContents.getPrintersAsync()';
        printers = await mainWindow.webContents.getPrintersAsync();
      }
      // Fallback to sender.getPrintersAsync() if mainWindow is not available
      else if (sender && typeof sender.getPrintersAsync === 'function') {
        console.log('✅ Using sender.getPrintersAsync()');
        methodUsed = 'sender.getPrintersAsync()';
        printers = await sender.getPrintersAsync();
      } 
      // Fallback to app.getPrinters() if webContents method is not available
      else if (typeof app.getPrinters === 'function') {
        console.log('✅ Using app.getPrinters() (fallback)');
        methodUsed = 'app.getPrinters()';
        printers = app.getPrinters();
      }
    }
    
    // Log which method was used and all printers with their properties for debugging
    console.log(`\n🔍 Method used to get printers: ${methodUsed}`);
    console.log('📋 All printers found:', printers.length);
    printers.forEach((printer, index) => {
      console.log(`\nPrinter ${index + 1}:`, {
        name: printer.name,
        displayName: printer.displayName,
        description: printer.description,
        isDefault: printer.isDefault,
        options: printer.options,
        printerStatus: printer.printerStatus,
        printerState: printer.printerState || 'N/A (PowerShell only provides PrinterStatus)',
        fullPrinterObject: JSON.stringify(printer, null, 2)
      });
    });
    
    // Filter to only show active printers (online and accepting jobs)
    const activePrinters = printers.filter((printer) => {
      let shouldInclude = true;
      let filterReason = '';
      
      // Check if printer is accepting jobs (most reliable indicator)
      if (printer.options && printer.options['printer-is-accepting-jobs'] === false) {
        shouldInclude = false;
        filterReason = 'Not accepting jobs';
      }
      
      // Check printer state - filter out offline/error states
      if (shouldInclude && printer.options && printer.options['printer-state']) {
        const state = printer.options['printer-state'];
        // State 3 = idle/ready (active), state 5 = offline
        // On Windows: 0 = Ready, 1 = Paused, 2 = Error, 3 = Pending deletion, 4 = Paper jam, etc.
        // On Linux/CUPS: 3 = idle, 4 = processing, 5 = stopped
        // We want to include states that indicate the printer is operational
        if (typeof state === 'string') {
          // String states like "idle", "processing" are good
          const lowerState = state.toLowerCase();
          if (lowerState.includes('offline') || lowerState.includes('error') || 
              lowerState.includes('stopped') || lowerState.includes('paused')) {
            shouldInclude = false;
            filterReason = `State: ${state} (contains offline/error/stopped/paused)`;
          }
        } else if (typeof state === 'number') {
          // Numeric states: 3 = idle (good), 4 = processing (good), 5 = stopped (bad)
          if (state === 5) {
            shouldInclude = false;
            filterReason = `State: ${state} (stopped/offline)`;
          }
        }
      }
      
      // For PowerShell, check PrinterStatus - only include status 0 (ready to print)
      // Status 0 = ready to print, all other statuses (including undefined/null) should be excluded
      if (shouldInclude) {
        const status = printer.printerStatus;
        // Only include if status is exactly 0 (as number or string "0")
        if (status !== 0 && status !== "0") {
          shouldInclude = false;
          filterReason = `PrinterStatus: ${printer.printerStatus} (only status 0 is ready to print)`;
        }
      }
      
      // Check PrinterState if available (for Electron API printers)
      if (shouldInclude && printer.printerState !== undefined && printer.printerState !== null) {
        const state = printer.printerState;
        // Only include printers with state 0 (Idle) - active and ready
        // Exclude: 1 (Paused), 2 (Error), 3 (Pending deletion), 4 (Paper jam), etc.
        if (state !== 0) {
          shouldInclude = false;
          filterReason = `PrinterState: ${state} (0=Idle is active, ${state} is not active)`;
        }
      }
      
      // Fallback: check description string if no specific status fields
      if (shouldInclude && !printer.options && printer.description) {
        const status = printer.description.toLowerCase();
        if (status.includes('offline') || status.includes('error') || 
            status.includes('paused') || status.includes('stopped')) {
          shouldInclude = false;
          filterReason = `Description contains offline/error/paused/stopped: ${printer.description}`;
        }
      }
      
      // Log filtering decision
      if (!shouldInclude) {
        console.log(`❌ Filtered out printer "${printer.name}": ${filterReason}`);
      } else {
        console.log(`✅ Including printer "${printer.name}"`);
      }
      
      return shouldInclude; // Include printer if it passes all checks
    });
    
    console.log(`\n📊 Filtered results: ${activePrinters.length} active printer(s) out of ${printers.length} total`);
    
    // Format printer list for the renderer process
    const printerList = activePrinters.map((printer) => ({
      name: printer.name,                    // Device name (used for printing)
      displayName: printer.displayName || printer.name,  // Display name
      description: printer.description || '',  // Optional description
      status: printer.isDefault ? 'Default' : '',  // Status indicator
      isDefault: printer.isDefault || false,  // Whether it's the default printer
    }));
    
    console.log('📤 Returning printer list:', JSON.stringify(printerList, null, 2));
    
    // Return empty array on error - the UI will show a default option
    return printerList;
  } catch (error) {
    console.error('❌ Error getting printers:', error);
    // Return empty array on error - the UI will show a default option
    return [];
  }
});
