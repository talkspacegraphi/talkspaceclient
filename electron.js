const { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');

// --- SQUIRREL SETUP ---
if (require('electron-squirrel-startup')) return app.quit();

// Логирование
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let splashWindow;
let tray = null;
let isQuitting = false;

// SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log("Another instance is already running. Quitting...");
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Пользователь пытался запустить вторую копию
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      
      const deepLink = commandLine.find((arg) => arg.startsWith('talkspace://'));
      if (deepLink) mainWindow.webContents.send('deep-link', deepLink);
    }
  });

  app.whenReady().then(() => {
    if (process.defaultApp) {
      if (process.argv.length >= 2) app.setAsDefaultProtocolClient('talkspace', process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient('talkspace');
    }

    session.defaultSession.setPermissionCheckHandler(() => true);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(true));
    
    createSplashWindow();
    
    if (app.isPackaged) {
        autoUpdater.checkForUpdates();
        setInterval(() => autoUpdater.checkForUpdates(), 1000 * 60 * 5); 
    } else {
        setTimeout(createMainWindow, 1500);
    }
  });
}

function getIconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'favicon.ico');
  return path.join(__dirname, 'public/favicon.ico');
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 300, height: 350, transparent: false, frame: false, alwaysOnTop: true, backgroundColor: '#000000', icon: getIconPath(),
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  const loadPath = app.isPackaged ? path.join(process.resourcesPath, 'splash.html') : path.join(__dirname, 'public/splash.html');
  splashWindow.loadFile(loadPath).catch(() => splashWindow.loadURL(`data:text/html;charset=utf-8,<html><body style="background:#000;color:white;display:flex;justify-content:center;align-items:center;"><h1>TalkSpace</h1></body></html>`));
  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 720, minWidth: 940, minHeight: 500, backgroundColor: '#0B0B0C', frame: false, icon: getIconPath(), show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: true
    },
  });

  const startUrl = app.isPackaged 
    ? url.format({
        pathname: path.resolve(__dirname, 'build', 'index.html'), 
        protocol: 'file:',
        slashes: true
      })
    : 'http://localhost:3000';

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.close(); splashWindow = null; }
    mainWindow.show(); mainWindow.focus();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) { event.preventDefault(); mainWindow.hide(); return false; }
  });
  
  // Open links in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
  });

  createTray();
}

function createTray() {
  const image = nativeImage.createFromPath(getIconPath());
  tray = new Tray(image);
  tray.setToolTip('TalkSpace');
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Открыть TalkSpace', click: () => { if(mainWindow) mainWindow.show(); } },
    { type: 'separator' },
    { label: 'Выход', click: () => { isQuitting = true; app.quit(); }}
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => { if (mainWindow) mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); });
}

app.on('open-url', (event, url) => { event.preventDefault(); if (mainWindow) mainWindow.webContents.send('deep-link', url); });

ipcMain.on('app-minimize', () => mainWindow?.minimize());
ipcMain.on('app-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('app-close', () => mainWindow?.close());
ipcMain.on('flash-frame', () => { if(mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true); });
ipcMain.on('restart_app', () => { isQuitting = true; autoUpdater.quitAndInstall(); });

ipcMain.on('get-auto-launch-status', (event) => { const settings = app.getLoginItemSettings(); event.reply('auto-launch-status', settings.openAtLogin); });
ipcMain.on('toggle-auto-launch', (event, enable) => { app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath }); });

function sendStatusToSplash(text) { if (splashWindow) splashWindow.webContents.send('message', text); }
autoUpdater.on('checking-for-update', () => sendStatusToSplash('Checking...'));
autoUpdater.on('update-available', () => sendStatusToSplash('Update found...'));
autoUpdater.on('update-not-available', () => { sendStatusToSplash('Starting...'); setTimeout(createMainWindow, 1000); });
autoUpdater.on('error', (err) => { sendStatusToSplash('Ready'); setTimeout(createMainWindow, 1000); });
autoUpdater.on('download-progress', (p) => { sendStatusToSplash(`DL: ${Math.round(p.percent)}%`); });
autoUpdater.on('update-downloaded', () => { sendStatusToSplash('Ready'); if(mainWindow) mainWindow.webContents.send('update_downloaded'); });

app.on('window-all-closed', () => {});