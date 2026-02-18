const { app, BrowserWindow, ipcMain, protocol, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const ptp = require("pdf-to-printer");

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
  const protocol = "http://";
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
  // In development, always use default domain (skip settings)
  if (!app.isPackaged) {
    console.log("🔧 Development mode: using default domain");
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
    mainWindow.setTitle(`Promo Media v${appVersion}`);

    // Load the URL
    mainWindow.loadURL(url);

    // Open DevTools (optional - remove this line if you don't want DevTools)
    // mainWindow.webContents.openDevTools();

    // Add keyboard shortcut to show About dialog (F1 or Ctrl+I)
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F1') {
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
    return;
  }

  // Production mode: Check if domain is configured
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
  mainWindow.setTitle(`Promo Media v${appVersion}`);

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
      console.log('🔍 Manual update check triggered');
      autoUpdater.checkForUpdates().catch(err => {
        console.error('❌ Manual update check failed:', err);
        const errorMessage = err.message || err.toString();
        dialog.showMessageBox(mainWindow || null, {
          type: 'error',
          title: 'Update Check Failed',
          message: 'Unable to check for updates',
          detail: `Error: ${errorMessage}\n\n` +
                  `Check the console (F12) for more details.\n` +
                  `Common issues:\n` +
                  `• GitHub API access\n` +
                  `• Network connectivity\n` +
                  `• Firewall blocking`,
          buttons: ['OK'],
        });
      });
    }
  });
}

// Configure auto-updater - FULLY AUTOMATIC
autoUpdater.autoDownload = true; // Automatically download updates
autoUpdater.autoInstallOnAppQuit = true; // Auto-install on app quit

// Configure update server (GitHub)
if (app.isPackaged) {
  // electron-updater automatically detects GitHub provider from package.json
  // For private repos, it uses GitHub API which requires authentication
  console.log('📦 App is packaged, update server configured from package.json');
  try {
    const feedURL = autoUpdater.getFeedURL();
    console.log('📦 Update server URL:', feedURL);
  } catch (err) {
    console.log('📦 Update server will be auto-detected from GitHub');
  }
} else {
  console.log('⚠️ App is not packaged, update checks disabled in development');
}

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
  // Automatically download - no user prompt needed
  console.log('📥 Automatically downloading update...');
  
  // Update window title to show update is downloading (non-intrusive)
  if (mainWindow) {
    mainWindow.setTitle(`Promo Media v${appVersion} - Update available, downloading...`);
  }
  
  // Send to renderer if needed
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
  console.error('❌ Error details:', JSON.stringify(err, null, 2));
  
  // Don't show temp file errors to users - they're usually non-critical
  if (err.message && err.message.includes('temp') && err.message.includes('write')) {
    console.warn('⚠️ Temp file write error (non-critical):', err.message);
    return; // Silently ignore temp file write errors
  }
  
  // Show detailed error to user
  const errorMessage = err.message || err.toString();
  const errorDetails = err.stack || '';
  
  dialog.showMessageBox(mainWindow || null, {
    type: 'error',
    title: 'Update Check Failed',
    message: 'Unable to check for updates',
    detail: `Error: ${errorMessage}\n\n` +
            `This could be due to:\n` +
            `• Network connectivity issues\n` +
            `• Firewall blocking GitHub\n` +
            `• GitHub API rate limiting\n` +
            `• Repository access issues\n\n` +
            `Check the console for more details.`,
    buttons: ['OK'],
  });
  
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
    mainWindow.setTitle(`Promo Media - Downloading update ${percent}%`);
  }
  
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Update downloaded:', info.version);
  
  // Restore window title
  if (mainWindow) {
    mainWindow.setTitle(`Promo Media v${appVersion} - Update ready, will install on restart`);
  }
  
  // Show non-blocking notification (optional - can be removed for completely silent updates)
  // Update will install automatically when app quits (autoInstallOnAppQuit = true)
  console.log('✅ Update ready. Will install automatically when application closes.');
  
  // Optional: Show a brief notification (non-blocking)
  if (mainWindow) {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Update ${info.version} downloaded successfully!`,
      detail: 'The update will be installed automatically when you close the application.',
      buttons: ['OK'],
    }).catch(() => {
      // Ignore if window is closed
    });
  }
  
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

// Shared print function for both print-pdf and print-invoice
async function handlePrint(options) {
  const { pdfData, silent = true, printBackground, deviceName, paperSize } = options;
  
  try {
    console.log('🖨️ Print request received - Full options:', JSON.stringify(options, null, 2));
    console.log('🖨️ Extracted deviceName:', deviceName, '(type:', typeof deviceName, ')');
    console.log('🖨️ Extracted paperSize:', paperSize, '(type:', typeof paperSize, ')');
    
    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfData, 'base64');
    
    // Create temporary file
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, `invoice-${Date.now()}.pdf`);
    
    // Write PDF to temp file
    fs.writeFileSync(tempFilePath, pdfBuffer);
    console.log('📄 PDF saved to temp file:', tempFilePath);
    console.log('📄 PDF file size:', pdfBuffer.length, 'bytes');
    
    // Check PDF dimensions by reading the PDF header
    // PDF pages are defined in the PDF structure, but we can at least verify it's a valid PDF
    const pdfHeader = pdfBuffer.slice(0, 8).toString('ascii');
    console.log('📄 PDF header:', pdfHeader);
    
    // Try to extract page dimensions from PDF (basic check)
    // PDF uses points: 1 point = 1/72 inch
    // 80mm = 226.77 points = 3.15 inches
    // A4 = 595.28 × 842 points = 8.27 × 11.69 inches
    const pdfString = pdfBuffer.toString('latin1');
    const mediaBoxMatch = pdfString.match(/\/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/);
    if (mediaBoxMatch) {
      const width = parseFloat(mediaBoxMatch[3]) - parseFloat(mediaBoxMatch[1]);
      const height = parseFloat(mediaBoxMatch[4]) - parseFloat(mediaBoxMatch[2]);
      const widthInches = width / 72;
      const heightInches = height / 72;
      const widthMm = widthInches * 25.4;
      const heightMm = heightInches * 25.4;
      console.log('📄 PDF page dimensions detected:', {
        width: `${width.toFixed(2)} points (${widthInches.toFixed(2)} in / ${widthMm.toFixed(2)} mm)`,
        height: `${height.toFixed(2)} points (${heightInches.toFixed(2)} in / ${heightMm.toFixed(2)} mm)`,
        expectedFor80mm: '226.77 points (3.15 in / 80.00 mm)',
        isCorrectWidth: Math.abs(widthMm - 80) < 5 // Allow 5mm tolerance
      });
      
      if (paperSize && (paperSize.toLowerCase().includes('80mm') || paperSize.toLowerCase().includes('80'))) {
        if (Math.abs(widthMm - 80) >= 5) {
          console.warn('⚠️ WARNING: PDF width is NOT 80mm! PDF appears to be wrong size.');
          console.warn('⚠️ This will cause printing issues. PDF should be 80mm (226.77 points) wide.');
        }
      }
    } else {
      console.warn('⚠️ Could not extract PDF page dimensions from MediaBox');
    }
    
    // Prepare print options for pdf-to-printer
    const printOptions = {
      silent: silent !== false, // Use silent mode (default true)
    };
    
    // Only add printer name if it's provided, not empty, and not a placeholder string
    const trimmedDeviceName = deviceName && typeof deviceName === 'string' ? deviceName.trim() : '';
    const isPlaceholder = trimmedDeviceName.toLowerCase() === 'default printer' || 
                         trimmedDeviceName.toLowerCase() === 'default' ||
                         trimmedDeviceName === '';
    
    if (trimmedDeviceName && !isPlaceholder) {
      printOptions.printer = trimmedDeviceName;
      console.log('🖨️ Using specific printer:', printOptions.printer);
    } else {
      console.log('🖨️ Using default printer (deviceName was:', deviceName, ')');
    }
    
    // Add paper size and thermal printer specific options
    if (paperSize) {
      const paperSizeLower = paperSize.toLowerCase();
      if (paperSizeLower.includes('80mm') || paperSizeLower.includes('80')) {
        printOptions.paper = '80mm';
        printOptions.orientation = 'portrait';
        printOptions.margins = {
          marginType: 'none' 
        };
        console.log('📄 Thermal printer configured: 80mm paper, no scaling, no margins');
      } else if (paperSizeLower.includes('a4')) {
        printOptions.paper = 'A4';
      } else if (paperSizeLower.includes('letter')) {
        printOptions.paper = 'Letter';
      }
      console.log('📄 Paper size configured:', printOptions.paper);
    }
    
    console.log('🖨️ Print options:', JSON.stringify(printOptions, null, 2));
    
    // Print using pdf-to-printer library (direct PDF printing, more reliable)
    try {
      await ptp.print(tempFilePath, printOptions);
      console.log('✅ PDF printed successfully to:', printOptions.printer || 'default printer');
      
      // Wait before deleting temp file to ensure print job completes
      setTimeout(() => {
        try {
          if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
            console.log('🗑️ Temp file deleted after print completion:', tempFilePath);
          }
        } catch (err) {
          console.warn('⚠️ Failed to delete temp file:', err.message);
          // File might still be in use, that's okay - OS will clean it up eventually
        }
      }, 10000); // Wait 10 seconds after print job is sent
      
    } catch (printError) {
      console.error('❌ Print job failed:', printError);
      console.error('   Printer:', printOptions.printer || 'default');
      throw printError; // Re-throw to be caught by outer try-catch
    }
    
  } catch (error) {
    console.error('❌ Error printing PDF:', error);
  }
}

// Handler for printing PDFs silently (print-pdf channel)
ipcMain.on('print-pdf', async (event, options) => {
  await handlePrint(options);
});

// Handler for printing invoices (print-invoice channel)
ipcMain.on('print-invoice', async (event, options) => {
  await handlePrint(options);
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
