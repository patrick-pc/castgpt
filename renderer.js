const { ipcRenderer } = require("electron");

let recording = false;
let hotkeyTest = "";

// Initialize UI elements
const recordButton = document.getElementById("recordButton");
const hotkeyDisplay = document.getElementById("hotkeyDisplay");
const refreshButton = document.getElementById("refreshButton");
const backButton = document.getElementById("backButton");
const forwardButton = document.getElementById("forwardButton");
const sizeSelect = document.getElementById("sizeSelect");
const hotkeyRecorder = document.getElementById("hotkeyRecorder");
const appVersion = document.getElementById("appVersion");

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  refreshButton.addEventListener("click", () => ipcRenderer.send("refresh"));
  backButton.addEventListener("click", () => ipcRenderer.send("back"));
  forwardButton.addEventListener("click", () => ipcRenderer.send("forward"));
  sizeSelect.addEventListener("change", handleSizeChange);
  recordButton.addEventListener("click", toggleRecording);
  document.addEventListener("click", cancelRecordingOnClick);
});

document.addEventListener("keydown", handleKeydown);

// Event Handlers
function handleSizeChange(event) {
  ipcRenderer.send("set_window_size", event.target.value);
  event.target.blur();
}

function toggleRecording() {
  recording = !recording;
  updateRecordingUI();
}

function handleKeydown(event) {
  if (recording && !event.repeat) {
    event.preventDefault();
    processKeydownEvent(event);
  }
}

function cancelRecordingOnClick(event) {
  if (recording && !recordButton.contains(event.target)) {
    cancelRecording();
  }
}

// Helper Functions
function processKeydownEvent(event) {
  const modifierKeys = getModifierKeys(event);
  let keyName = getKeyName(event);

  if (shouldRecordKey(modifierKeys, keyName)) {
    const hotkey = convertToElectronShortcut([...modifierKeys, keyName]);
    const displayHotkey = convertToDisplayShortcut([...modifierKeys, keyName]);

    ipcRenderer.send("set_hotkey", hotkey);
    hotkeyDisplay.value = displayHotkey;
    hotkeyTest = displayHotkey;
    cancelRecording();
  }
}

function getModifierKeys(event) {
  const modifierKeys = [];
  if (event.ctrlKey) modifierKeys.push("Ctrl");
  if (event.shiftKey) modifierKeys.push("Shift");
  if (event.altKey) modifierKeys.push("Alt");
  if (event.metaKey) modifierKeys.push("Meta");
  return modifierKeys;
}

function getKeyName(event) {
  if (event.key === " ") return "Space";

  return event.key;
}

function shouldRecordKey(modifierKeys, keyName) {
  return (
    modifierKeys.length > 0 &&
    keyName &&
    !["Control", "Shift", "Alt", "Meta"].includes(keyName)
  );
}

function updateRecordingUI() {
  if (recording) {
    hotkeyDisplay.value = "Press Shortcut";
    recordButton.textContent = "Stop Recording";
    hotkeyRecorder.style.borderColor = "#19c37d";
  } else {
    hotkeyDisplay.value = hotkeyTest;
    recordButton.textContent = "Toggle Global";
    hotkeyRecorder.style.borderColor = "#373738";
  }
}

function cancelRecording() {
  recording = false;
  updateRecordingUI();
}

// Conversion Functions
function convertToElectronShortcut(keys) {
  return keys
    .map((key) => {
      switch (key) {
        case "Ctrl":
          return "Control";
        case "Shift":
          return "Shift";
        case "Alt":
          return "Alt";
        case "Meta":
          return process.platform === "darwin" ? "Command" : "Super";
        default:
          return key.toUpperCase();
      }
    })
    .join("+");
}

function convertToDisplayShortcut(keys) {
  return keys
    .map((key) => {
      switch (key) {
        case "Ctrl":
          return "^";
        case "Shift":
          return "⇧";
        case "Alt":
          return "⌥";
        case "Meta":
          return "⌘";
        default:
          return key;
      }
    })
    .join(" ");
}

function convertElectronShortcutToDisplay(shortcut) {
  return shortcut
    .split("+")
    .map((key) => {
      switch (key) {
        case "Control":
          return "^";
        case "Shift":
          return "⇧";
        case "Alt":
          return "⌥";
        case "Command":
        case "Super":
          return "⌘";
        default:
          return key;
      }
    })
    .join(" ");
}

// IPC Renderer Event
ipcRenderer.on("config", (event, config) => {
  hotkeyDisplay.value = convertElectronShortcutToDisplay(config.hotkey);
  hotkeyTest = convertElectronShortcutToDisplay(config.hotkey);
  sizeSelect.value = config.sizeKey;
  appVersion.textContent = `v${config.appVersion}`;
});
