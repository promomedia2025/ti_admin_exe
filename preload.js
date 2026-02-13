const { contextBridge, ipcRenderer } = require("electron");

let notificationAudio = null;
let notificationStopTimer = null;

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
  
  // Get list of available printers
  getPrinters: async () => {
    return ipcRenderer.invoke("get-printers");
  },

  /**
   * Play an MP3 notification sound and stop it after 6 seconds (default).
   * If no src is provided, uses the default phone-ringtone-normal-444775.mp3 file.
   *
   * @param {string} [src] - Path to MP3 file (defaults to phone-ringtone-normal-444775.mp3)
   * @param {number} [durationMs=6000] - Duration to play in milliseconds (default 6 seconds)
   * @param {number} [volume=1] - Volume level 0-1 (default 1.0)
   * @returns {Promise<{success: boolean, error?: string}>}
   *
   * Examples:
   * - window.electron.playNotificationSound() // Uses default phone ringtone
   * - window.electron.playNotificationSound("phone-ringtone-normal-444775.mp3")
   * - window.electron.playNotificationSound("https://example.com/notify.mp3", 3000, 0.8)
   */
  playNotificationSound: async (src, durationMs = 6000, volume = 1) => {
    try {
      if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) {
        durationMs = 6000;
      }
      durationMs = Math.max(0, durationMs);

      if (typeof volume !== "number" || !Number.isFinite(volume)) {
        volume = 1;
      }
      volume = Math.min(1, Math.max(0, volume));

      // Default to the phone ringtone if no src provided
      if (!src || (typeof src === "string" && src.trim().length === 0)) {
        src = "phone-ringtone-normal-444775.mp3";
      }

      // If src is a local filename (not a URL), use app:// protocol
      let audioSrc = src;
      if (
        !src.startsWith("http://") &&
        !src.startsWith("https://") &&
        !src.startsWith("file://") &&
        !src.startsWith("app://")
      ) {
        // Use app:// protocol to access local files
        audioSrc = `app://${src}`;
      }

      // Reuse a single Audio instance so repeated calls don't leak elements.
      if (!notificationAudio) {
        notificationAudio = new Audio();
        notificationAudio.preload = "auto";
      }

      // Stop any previous playback/timer.
      if (notificationStopTimer) {
        clearTimeout(notificationStopTimer);
        notificationStopTimer = null;
      }
      notificationAudio.pause();
      notificationAudio.currentTime = 0;

      notificationAudio.volume = volume;

      // Only change src if it's different to avoid unnecessary reloads
      if (notificationAudio.src !== audioSrc) {
        notificationAudio.src = audioSrc;
        // Load the audio first to avoid autoplay issues
        notificationAudio.load();
      }

      // Wait for audio to be ready before playing
      await new Promise((resolve) => {
        if (notificationAudio.readyState >= 2) {
          // HAVE_CURRENT_DATA or higher - enough data to play
          resolve();
        } else {
          notificationAudio.addEventListener("canplay", resolve, {
            once: true,
          });
        }
      });

      // Play the audio (autoplay is configured at the Electron level)
      await notificationAudio.play();

      notificationStopTimer = setTimeout(() => {
        try {
          notificationAudio.pause();
          notificationAudio.currentTime = 0;
        } catch (_) {
          // ignore
        } finally {
          notificationStopTimer = null;
        }
      }, durationMs);

      return { success: true };
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
      const validChannels = ['window-focus', 'print-pdf', 'print-invoice'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      } else {
        console.warn(`[PRELOAD] Blocked IPC channel: ${channel}`);
      }
    },

    // Invoke a method in the main process and wait for response
    invoke: (channel, ...args) => {
      // Whitelist channels for security
      const validChannels = ['window-focus', 'focus-window', 'check-for-updates', 'download-update', 'install-update', 'get-printers', 'get-app-version', 'show-about'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },

    // Listen for messages from main process
    on: (channel, func) => {
      const validChannels = ['window-focus-response', 'autofill-data', 'update-available', 'update-not-available', 'update-error', 'download-progress', 'update-downloaded'];
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
      return ipcRenderer.invoke('check-for-updates');
    },
    
    // Download update
    downloadUpdate: () => {
      return ipcRenderer.invoke('download-update');
    },
    
    // Install update (will restart app)
    installUpdate: () => {
      return ipcRenderer.invoke('install-update');
    },
    
    // Listen for update events
    onUpdateAvailable: (callback) => {
      ipcRenderer.on('update-available', (event, info) => callback(info));
    },
    
    onUpdateNotAvailable: (callback) => {
      ipcRenderer.on('update-not-available', () => callback());
    },
    
    onUpdateError: (callback) => {
      ipcRenderer.on('update-error', (event, error) => callback(error));
    },
    
    onDownloadProgress: (callback) => {
      ipcRenderer.on('download-progress', (event, progress) => callback(progress));
    },
    
    onUpdateDownloaded: (callback) => {
      ipcRenderer.on('update-downloaded', (event, info) => callback(info));
    },
  },

  // Get app version information
  getAppVersion: async () => {
    return ipcRenderer.invoke('get-app-version');
  },

  // Show About dialog
  showAbout: async () => {
    return ipcRenderer.invoke('show-about');
  },
});
