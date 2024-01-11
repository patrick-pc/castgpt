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
const Store = require("electron-store");
const fs = require("fs");
const path = require("path");
// const { updateElectronApp } = require("update-electron-app");
const { autoUpdater } = require("electron-updater");

const isDev = require("electron-is-dev");
const packageJsonPath = path.join(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const server = "https://hazel-sable-six.vercel.app";
const url = `${server}/update/${process.platform}/${packageJson.version}`;

// updateElectronApp();

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
let chatGptBrowserView;

// Application Ready
app.on("ready", async () => {
  await createMainWindow();
  createTray();

  if (isDev) {
    console.log("Running in development");
  } else {
    console.log("Running in production");

    // Auto Updater
    // autoUpdater.setFeedURL({ url });

    const updateCheckInterval = 10 * 60 * 1000; // 10 mins
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, updateCheckInterval);
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
  chatGptBrowserView = new BrowserView({
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.setBrowserView(chatGptBrowserView);
  chatGptBrowserView.setBounds({
    x: 0,
    y: 50,
    width: size.width,
    height: size.height - 50,
  });
  chatGptBrowserView.webContents.loadURL("https://chat.openai.com/");
  chatGptBrowserView.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://chat.openai.com/g/")) {
      chatGptBrowserView.webContents.loadURL(url);
    } else {
      shell.openExternal(url);
    }

    return { action: "deny" };
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
    if (chatGptBrowserView) {
      chatGptBrowserView.setBounds({
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
  chatGptBrowserView.webContents.goBack();
});

ipcMain.on("forward", (event, arg) => {
  chatGptBrowserView.webContents.goForward();
});

ipcMain.on("refresh", () => {
  chatGptBrowserView.webContents.reload();
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
    chatGptBrowserView.webContents.reload();
  });

  globalShortcut.register("Cmd+Shift+R", () => {
    chatGptBrowserView.webContents.reload();
  });

  globalShortcut.register("F5", () => {
    chatGptBrowserView.webContents.reload();
  });
});

app.on("browser-window-blur", () => {
  globalShortcut.unregister("Cmd+W");
  globalShortcut.unregister("Cmd+R");
  globalShortcut.unregister("Cmd+Shift+R");
  globalShortcut.unregister("F5");
});

autoUpdater.on("update-available", (_event, releaseNotes, releaseName) => {
  const dialogOpts = {
    type: "info",
    buttons: ["Ok"],
    title: "Update Available",
    message: process.platform === "win32" ? releaseNotes : releaseName,
    detail:
      "A new version download started. The app will be restarted to install the update.",
  };
  dialog.showMessageBox(dialogOpts);

  updateInterval = null;
});

autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
  const dialogOpts = {
    type: "info",
    buttons: ["Restart"],
    title: "Application Update",
    message: process.platform === "win32" ? releaseNotes : releaseName,
    detail:
      "A new version has been downloaded. Restart the application to apply the updates.",
  };
  dialog.showMessageBox(dialogOpts).then((returnValue) => {
    if (returnValue.response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on("error", (message) => {
  console.error("There was a problem updating the application");
  console.error(message);
});
