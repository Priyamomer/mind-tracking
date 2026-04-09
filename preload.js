// Preload runs in a privileged context — keep it minimal.
// All persistence is handled via localStorage in the renderer.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
