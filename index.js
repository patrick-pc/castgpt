const {
  app,
  BrowserView,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  shell,
  Tray,
} = require("electron");
const Store = require("electron-store");
const path = require("path");

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
    shell.openExternal(url);
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
    });
  });
}

// Create Tray
function createTray() {
  const tray = new Tray(path.join(__dirname, "..", "images/logo@2x.png"));
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

ipcMain.on("go", (event, gpt) => {
  chatGptBrowserView.webContents.loadURL(`https://chat.openai.com/g/${gpt}`);
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

  globalShortcut.register("F5", () => {
    chatGptBrowserView.webContents.reload();
  });
});

app.on("browser-window-blur", () => {
  globalShortcut.unregister("Cmd+W");
  globalShortcut.unregister("Cmd+R");
  globalShortcut.unregister("F5");
});