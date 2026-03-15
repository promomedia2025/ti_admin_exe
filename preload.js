const { contextBridge, ipcRenderer } = require("electron");

// Used when user has selected a specific output device: play in renderer with setSinkId
let notificationAudioWithDevice = null;

function registerNotificationDeviceListeners() {
  ipcRenderer.on("play-notification-with-device", async (event, { deviceId, src }) => {
    console.log("[notification-sound] preload: play-with-device received", { deviceId, src });
    if (notificationAudioWithDevice) {
      notificationAudioWithDevice.pause();
      notificationAudioWithDevice = null;
    }
    const audioUrl = src || "app://phone-ringtone-normal-444775.mp3";
    const audio = new Audio();
    notificationAudioWithDevice = audio;
    audio.loop = true;
    try {
      if (deviceId) {
        const supported = typeof audio.getSupportedSinkIds === "function" ? await audio.getSupportedSinkIds() : [];
        console.log("[notification-sound] preload: setSinkId(", deviceId, "), supported count:", supported?.length ?? 0, supported?.length ? "ids:" : "", supported?.slice(0, 3) ?? "");
        await audio.setSinkId(deviceId);
        console.log("[notification-sound] preload: setSinkId ok");
      } else {
        console.log("[notification-sound] preload: no deviceId, using default output");
      }
      audio.src = audioUrl;
      await audio.play();
      console.log("[notification-sound] preload: play() started");
    } catch (e) {
      console.warn("[notification-sound] preload: setSinkId/play failed", e?.message ?? e);
      audio.src = audioUrl;
      audio.play().catch(() => {});
    }
  });
  ipcRenderer.on("stop-notification", () => {
    if (notificationAudioWithDevice) {
      notificationAudioWithDevice.pause();
      notificationAudioWithDevice.currentTime = 0;
      notificationAudioWithDevice = null;
    }
  });
}
registerNotificationDeviceListeners();

contextBridge.exposeInMainWorld("electron", {
  print: (options) => {
    ipcRenderer.send("print-invoice", options);
  },
  // Listen for autofill data
  onAutofillData: (callback) => {
    ipcRenderer.on("autofill-data", (event, data) => {
      callback(data);
    });
  },
  // Focus window
  focusWindow: () => {
    return ipcRenderer.invoke("focus-window");
  },

  // Configure toggle schedules behavior (URL + locationId) from the renderer
  setToggleConfig: async (url, locationId) => {
    return ipcRenderer.invoke("set-toggle-config", { url, locationId });
  },

  // Get list of available printers
  getPrinters: async () => {
    return ipcRenderer.invoke("get-printers");
  },

  // Notification sound output device (for test/configuration)
  getAudioOutputDevices: async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "audiooutput");
  },
  setNotificationOutputDevice: async (deviceId) => {
    return ipcRenderer.invoke("set-notification-output-device", deviceId);
  },
  getNotificationOutputDevice: async () => {
    return ipcRenderer.invoke("get-notification-output-device");
  },
  /** Play the notification sound once on the given device (for Test button). Requires user gesture in some environments. */
  playTestNotificationSound: async (deviceId) => {
    try {
      console.log("[notification-sound] playTestNotificationSound deviceId:", deviceId ?? "(default)");
      const audio = new Audio();
      audio.loop = false;
      if (deviceId) {
        const supported = typeof audio.getSupportedSinkIds === "function" ? await audio.getSupportedSinkIds() : [];
        console.log("[notification-sound] test: setSinkId(", deviceId, "), supported:", supported?.length ?? 0, supported?.includes(deviceId) ? "deviceId in list" : "deviceId NOT in supported list");
        await audio.setSinkId(deviceId);
        console.log("[notification-sound] test: setSinkId ok");
      }
      audio.src = "app://phone-ringtone-normal-444775.mp3";
      await audio.play();
      console.log("[notification-sound] test: play() started");
      return new Promise((resolve) => {
        audio.onended = () => resolve({ success: true });
        audio.onerror = (e) =>
          resolve({ success: false, error: (e && e.message) || String(e) });
      });
    } catch (err) {
      console.warn("[notification-sound] playTestNotificationSound error", err?.message ?? err);
      return {
        success: false,
        error: err && err.message ? err.message : String(err),
      };
    }
  },

  // Native notification sound via main process (avoids browser autoplay)
  playNotificationSound: async (src) => {
    try {
      const file =
        src && typeof src === "string" && src.trim().length > 0
          ? src.trim()
          : "phone-ringtone-normal-444775.mp3";
      return await ipcRenderer.invoke("play-notification-sound", file);
    } catch (err) {
      return {
        success: false,
        error: err && err.message ? err.message : String(err),
      };
    }
  },

  /**
   * Stop the currently playing notification sound.
   * Currently a no-op for native playback; kept for API compatibility.
   */
  stopNotificationSound: async () => {
    try {
      return await ipcRenderer.invoke("stop-notification-sound");
    } catch (err) {
      return {
        success: false,
        error: err && err.message ? err.message : String(err),
      };
    }
  },

  // IPC Renderer methods - CRITICAL for PDF printing
  ipcRenderer: {
    // Send a message to the main process (fire and forget)
    send: (channel, ...args) => {
      // Whitelist channels for security
      const validChannels = ["window-focus", "print-pdf", "print-invoice"];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      } else {
        console.warn(`[PRELOAD] Blocked IPC channel: ${channel}`);
      }
    },

    // Invoke a method in the main process and wait for response
    invoke: (channel, ...args) => {
      // Whitelist channels for security
      const validChannels = [
        "window-focus",
        "focus-window",
        "check-for-updates",
        "download-update",
        "install-update",
        "get-printers",
        "get-app-version",
        "show-about",
        "set-toggle-config",
        "play-notification-sound",
        "stop-notification-sound",
        "set-notification-output-device",
        "get-notification-output-device",
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },

    // Listen for messages from main process
    on: (channel, func) => {
      const validChannels = [
        "window-focus-response",
        "autofill-data",
        "update-available",
        "update-not-available",
        "update-error",
        "download-progress",
        "update-downloaded",
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },

    // Remove listener
    removeListener: (channel, func) => {
      ipcRenderer.removeListener(channel, func);
    },
  },

  // Auto-updater methods
  updater: {
    // Check for updates
    checkForUpdates: () => {
      return ipcRenderer.invoke("check-for-updates");
    },

    // Download update
    downloadUpdate: () => {
      return ipcRenderer.invoke("download-update");
    },

    // Install update (will restart app)
    installUpdate: () => {
      return ipcRenderer.invoke("install-update");
    },

    // Listen for update events
    onUpdateAvailable: (callback) => {
      ipcRenderer.on("update-available", (event, info) => callback(info));
    },

    onUpdateNotAvailable: (callback) => {
      ipcRenderer.on("update-not-available", () => callback());
    },

    onUpdateError: (callback) => {
      ipcRenderer.on("update-error", (event, error) => callback(error));
    },

    onDownloadProgress: (callback) => {
      ipcRenderer.on("download-progress", (event, progress) =>
        callback(progress),
      );
    },

    onUpdateDownloaded: (callback) => {
      ipcRenderer.on("update-downloaded", (event, info) => callback(info));
    },
  },

  // Get app version information
  getAppVersion: async () => {
    return ipcRenderer.invoke("get-app-version");
  },

  // Show About dialog
  showAbout: async () => {
    return ipcRenderer.invoke("show-about");
  },

  toggleSchedules: async (status, url, locationId) => {
    return ipcRenderer.invoke("toggle-schedules", { status, url, locationId });
  },
});
