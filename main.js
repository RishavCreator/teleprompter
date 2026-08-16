const { app, BrowserWindow } = require("electron");
const path = require("path");
const net = require("net");

let mainWindow;

function getAvailablePort(startPort, cb) {
  const server = net.createServer();
  server.listen(startPort, () => {
    const port = server.address().port;
    server.close(() => {
      cb(port);
    });
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      getAvailablePort(0, cb); // Fallback to random available port
    } else {
      cb(startPort);
    }
  });
}

function createWindow(port) {
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
    mainWindow.loadURL(`http://localhost:${port}/controller.html`);
  }, 500);

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

app.on("ready", () => {
  getAvailablePort(8080, (port) => {
    process.env.PORT = port;
    // Start the existing server on the available port
    require("./server.js");
    createWindow(port);
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  if (mainWindow === null) {
    getAvailablePort(8080, (port) => {
      createWindow(port);
    });
  }
});
