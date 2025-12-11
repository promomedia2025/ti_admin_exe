const { contextBridge, ipcRenderer } = require("electron");

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
});
