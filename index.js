const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

// Configure command line switches to allow autoplay and audio without user gesture
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("enable-features", "AutoplayIgnoreWebAudio");

let mainWindow;

function createWindow() {
  const url = "http://localhost:3000/admin";

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

  // Load the URL
  mainWindow.loadURL(url);

  // Open DevTools (optional - remove this line if you don't want DevTools)
  // mainWindow.webContents.openDevTools();

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
