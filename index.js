const {
  app,
  BrowserView,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  screen,
  shell,
  Tray,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const Store = require("electron-store");
const fs = require("fs");
const path = require("path");
const log = require("electron-log");
const isDev = require("electron-is-dev");

log.transports.file.level = "debug";
log.transports.console.level = "debug";

const packageJsonPath = path.join(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

const server = "https://hazel-sable-six.vercel.app";
const url = `${server}/update/${process.platform}/${packageJson.version}`;

let updateInterval = null;

// Constants
const schema = {
  defaultKeyCombination: {
    type: "string",
    default: "Cmd+E",
  },
};
const store = new Store({ schema });
const windowSizes = {
  small: { width: 1000, height: 600 },
  medium: { width: 1250, height: 750 },
  large: { width: 1500, height: 900 },
};

// Application State
let mainWindow;
let browserView;

// Application Ready
app.on("ready", async () => {
  await createMainWindow();
  createTray();

  if (isDev) {
    console.log("Running in dev");
  } else {
    console.log("Running in prod");

    updateInterval = setInterval(() => {
      autoUpdater.checkForUpdates();
      log.info("@@@ checkForUpdates");
      log.info("@@@ updateInterval", updateInterval);
    }, 10 * 60 * 1000);
  }
});

// Create Main Window
async function createMainWindow() {
  const storedSize = store.get("windowSize", windowSizes.medium);
  mainWindow = new BrowserWindow(getWindowConfig(storedSize));

  mainWindow.loadFile("./index.html");
  setConfig(mainWindow);
  setupBrowserView(storedSize);

  mainWindow.on("blur", () => hideWindow());
  setupGlobalShortcuts();
  if (process.platform === "darwin") app.dock.hide();
  else mainWindow.setSkipTaskbar(true);

  toggleWindow();
}

// Window Configuration
function getWindowConfig(size) {
  return {
    width: size.width,
    height: size.height,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  };
}

// Setup Browser View
function setupBrowserView(size) {
  browserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });
  mainWindow.setBrowserView(browserView);
  browserView.setBounds({
    x: 0,
    y: 50,
    width: size.width,
    height: size.height - 50,
  });
  browserView.webContents.loadURL("https://claude.ai/");
  browserView.webContents.on("dom-ready", (event) => {
    log.debug("DOM is ready");
    browserView.webContents
      .executeJavaScript(
        `
        (function() {
          let alertShown = false;


          function showAlert() {
            if (!alertShown) {
              alert('Please sign in with email instead.');

              alertShown = true;
              setTimeout(() => {
                alertShown = false;
              }, 500);
            }
          }
  
          function setupListeners() {
            console.log('Setting up listeners');
            
            document.body.addEventListener('click', (event) => {
              console.log('Body click event:', event.target);
              if (event.target.matches('button[data-testid="login-with-google"]')) {
                console.log('Google login button clicked (from body listener)');
                showAlert();
              }
            }, true);
          }
  
          setupListeners();
        })();
      `
      )
      .catch((err) => {
        log.error("Error executing JavaScript:", err);
      });
  });

  browserView.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      log.debug(`Console message from webContents (${level}): ${message}`);
    }
  );

  browserView.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith("https://accounts.google.com/") ||
      url.includes("google.com/signin/") ||
      url.includes("accounts.google.com/o/oauth2/")
    ) {
      // browserView.webContents.loadURL(url);
      return { action: "deny" };
    } else {
      shell.openExternal(url);
      return { action: "deny" };
    }
  });
}

function setConfig(mainWindow) {
  mainWindow.webContents.on("did-finish-load", () => {
    // Send the current hotkey and window size to the renderer process
    const currentHotkey = store.get("defaultKeyCombination");
    const currentSize = store.get("windowSize", { width: 1250, height: 750 });

    // Determine the size key based on the received size
    const sizeKey =
      Object.keys(windowSizes).find((key) => {
        return (
          windowSizes[key].width === currentSize.width &&
          windowSizes[key].height === currentSize.height
        );
      }) || "medium"; // Default to 'medium' if no match is found

    mainWindow.webContents.send("config", {
      hotkey: currentHotkey,
      sizeKey: sizeKey,
      appVersion: packageJson.version,
    });
  });
}

// Create Tray
function createTray() {
  const tray = new Tray(path.join(__dirname, "images/logo@2x.png"));
  tray.on("click", toggleWindow);
}

// Toggle Window
function toggleWindow() {
  if (mainWindow.isVisible()) hideWindow();
  else showWindow();
}

// Show Window
function showWindow() {
  const activeDisplay = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  );
  const [currentWidth, currentHeight] = mainWindow.getSize();
  const windowX = Math.round(
    activeDisplay.bounds.x + (activeDisplay.bounds.width - currentWidth) / 2
  );
  const windowY = Math.round(
    activeDisplay.bounds.y + (activeDisplay.bounds.height - currentHeight) / 2
  );

  mainWindow.setPosition(windowX, windowY);
  mainWindow.show();
}

// Hide Window
function hideWindow() {
  if (process.platform === "darwin") app.hide();
  else mainWindow.minimize();
  mainWindow.hide();
}

// Global Shortcuts
function setupGlobalShortcuts() {
  globalShortcut.register(store.get("defaultKeyCombination"), toggleWindow);
}

// IPC Handlers
ipcMain.on("set_hotkey", (event, arg) => {
  globalShortcut.unregister(store.get("defaultKeyCombination"));
  store.set("defaultKeyCombination", arg);
  globalShortcut.register(store.get("defaultKeyCombination"), toggleWindow);
});

ipcMain.on("set_window_size", (event, sizeKey) => {
  const size = windowSizes[sizeKey];
  if (size) {
    mainWindow.setSize(size.width, size.height, true);
    store.set("windowSize", size);
    if (browserView) {
      browserView.setBounds({
        x: 0,
        y: 50,
        width: size.width,
        height: size.height - 50,
      });
    }
    showWindow();
  }
});

ipcMain.on("back", (event, arg) => {
  browserView.webContents.goBack();
});

ipcMain.on("forward", (event, arg) => {
  browserView.webContents.goForward();
});

ipcMain.on("refresh", () => {
  browserView.webContents.reload();
});

ipcMain.on("quit", () => {
  app.quit();
});

// Event Listeners
app.on("browser-window-focus", () => {
  globalShortcut.register("Cmd+W", () => {
    // Unregister close window shortcut
  });

  globalShortcut.register("Cmd+R", () => {
    browserView.webContents.reload();
  });

  globalShortcut.register("Cmd+Shift+R", () => {
    browserView.webContents.reload();
  });

  globalShortcut.register("F5", () => {
    browserView.webContents.reload();
  });
});

app.on("browser-window-blur", () => {
  globalShortcut.unregister("Cmd+W");
  globalShortcut.unregister("Cmd+R");
  globalShortcut.unregister("Cmd+Shift+R");
  globalShortcut.unregister("F5");
});

autoUpdater.on("update-available", (event) => {
  log.info("@@@ update-available");

  const dialogOpts = {
    type: "info",
    buttons: ["Ok"],
    title: "Update Available",
    detail:
      "A new version download started. The app will be restarted to install the update.",
  };
  dialog.showMessageBox(dialogOpts);

  updateInterval = null;
});

autoUpdater.on("update-downloaded", (event) => {
  log.info("@@@ update-downloaded");

  const dialogOpts = {
    type: "info",
    buttons: ["Restart", "Later"],
    title: "Application Update",
    detail:
      "A new version has been downloaded. Restart the application to apply the updates.",
  };

  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on("error", (message) => {
  log.error("@@@ error", message);
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught exception:", error);
  dialog.showErrorBox(
    "Uncaught Exception",
    `An unexpected error occurred: ${error.message}`
  );
});
