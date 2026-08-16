const { app, BrowserWindow } = require("electron");
const path = require("path");

// Use a specific port for the desktop app
const PORT = 8080;
process.env.PORT = PORT;

// Start the existing server
require("./server.js");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Use the existing icon if available
    icon: path.join(__dirname, "teleprompter icon.png"),
  });

  // Give the server a brief moment to start up before loading the page
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${PORT}/controller.html`);
  }, 500);

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});
