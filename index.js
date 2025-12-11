const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let mainWindow;

function createWindow() {
  const url = "https://cocofino.gr/admin";

  // Create the browser window in fullscreen mode
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
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
