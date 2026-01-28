const { app, BrowserWindow, ipcMain, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

// Configure command line switches to allow autoplay and audio without user gesture
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("enable-features", "AutoplayIgnoreWebAudio");

let mainWindow;

function createWindow() {
  const url = "https://www.e-spitiko.gr";

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

// Silent printing handler
ipcMain.on("print-invoice", (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (win) {
    win.webContents.print({
      silent: options.silent !== undefined ? options.silent : true,
      printBackground:
        options.printBackground !== undefined ? options.printBackground : true,
      deviceName: options.deviceName || "",
    });
  }
});

// Focus window handler
ipcMain.handle("focus-window", () => {
  focusWindow();
  return { success: true };
});
