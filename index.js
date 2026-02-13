const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

// Configure command line switches to allow autoplay and audio without user gesture
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

// Compatibility flags for better CSS and color rendering with older Chromium
app.commandLine.appendSwitch("enable-color-correct-rendering");
app.commandLine.appendSwitch("force-color-profile", "srgb");
app.commandLine.appendSwitch("enable-features", "AutoplayIgnoreWebAudio,CSSColorSchemeUARendering");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");

// Force modern CSS features for better compatibility
app.commandLine.appendSwitch("enable-experimental-web-platform-features");
app.commandLine.appendSwitch("enable-blink-features", "CSSGridLayout,CSSContainerQueries");

let mainWindow;

function createWindow() {
  const url = "http://localhost:3000/admin";

  // Create the browser window in fullscreen mode
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#ffffff', // Set background color to prevent flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.js"),
      // Allow autoplay in media elements
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  // Set user agent to match newer Chromium to avoid layout differences
  // This helps web apps render consistently
  mainWindow.webContents.setUserAgent(
    mainWindow.webContents.getUserAgent().replace(
      /Electron\/[\d.]+/,
      'Electron/33.0.0'
    )
  );

  // Load the URL
  mainWindow.loadURL(url);

  // Open DevTools (optional - remove this line if you don't want DevTools)
  // mainWindow.webContents.openDevTools();

  // Inject CSS to ensure consistent rendering across Chromium versions
  mainWindow.webContents.once("did-finish-load", () => {
    // Inject CSS to fix layout issues
    mainWindow.webContents.insertCSS(`
      @media (min-width: 768px) {
      /* Force desktop layout for screens >= 768px */
      body {
        min-width: 1024px !important;
      }
    }
    
    /* Ensure viewport is detected correctly */
    html {
      width: 100%;
      height: 100%;
    }
    
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `).catch(err => console.error('Failed to inject CSS:', err));

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

const ptp = require('pdf-to-printer');

ipcMain.on('print-pdf', async (event, { pdfData, silent, printBackground, deviceName, paperSize }) => {
  try {
    console.log('🖨️ [ELECTRON] Received print-pdf request');
    
    const pdfBuffer = Buffer.from(pdfData, 'base64');
    const tempDir = app.getPath('temp');
    const tempFilePath = path.join(tempDir, `invoice-${Date.now()}.pdf`);
    
    fs.writeFileSync(tempFilePath, pdfBuffer);
    console.log('📄 [ELECTRON] PDF saved to:', tempFilePath);
    
    const printOptions = {
      printer: deviceName || undefined,
      pages: 'all',
      orientation: 'portrait',
      scale: 'fit',
      silent: true,
      printDialog: false,
    };
    
    await ptp.print(tempFilePath, printOptions);
    console.log('✅ [ELECTRON] PDF printed successfully');
    
    // Clean up
    setTimeout(() => {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️ [ELECTRON] Temp file deleted');
      } catch (err) {
        console.warn('⚠️ [ELECTRON] Failed to delete temp file:', err);
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ [ELECTRON] Error printing PDF:', error);
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
