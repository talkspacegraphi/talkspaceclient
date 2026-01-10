const { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');

// Логирование обновлений
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

// Автоматическое скачивание
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;
let splashWindow;
let tray = null;
let isQuitting = false;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionCheckHandler(() => true);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
    
    createSplashWindow();
    
    if (app.isPackaged) {
        autoUpdater.checkForUpdates();
        // Проверка обновлений каждые 5 минут для "Real-time" эффекта
        setInterval(() => {
           autoUpdater.checkForUpdates();
        }, 1000 * 60 * 5); 
    } else {
        setTimeout(createMainWindow, 1500);
    }
  });
}

function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'favicon.ico');
  }
  return path.join(__dirname, 'public/favicon.ico');
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 300,
    height: 350,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const loadPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'splash.html') 
      : path.join(__dirname, 'public/splash.html');

  splashWindow.loadFile(loadPath).catch(() => {
      splashWindow.loadURL(`data:text/html;charset=utf-8,<html><body style="background:#000;color:white;display:flex;justify-content:center;align-items:center;font-family:sans-serif;"><h1>TalkSpace</h1></body></html>`);
  });

  splashWindow.center();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    backgroundColor: '#0B0B0C',
    frame: false, 
    icon: getIconPath(),
    show: false, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: false 
    },
  });

  const startUrl = app.isPackaged 
    ? url.format({
        pathname: path.join(__dirname, 'build/index.html'), 
        protocol: 'file:',
        slashes: true
      })
    : 'http://localhost:3000';

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
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
  tray.on('click', () => { 
      if (mainWindow) mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show(); 
  });
}

ipcMain.on('app-minimize', () => mainWindow?.minimize());
ipcMain.on('app-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('app-close', () => mainWindow?.close());
ipcMain.on('flash-frame', () => { if(mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true); });

ipcMain.on('restart_app', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

// --- UPDATER EVENTS ---
function sendStatusToSplash(text) {
  if (splashWindow) splashWindow.webContents.send('message', text);
}

autoUpdater.on('checking-for-update', () => sendStatusToSplash('Checking for updates...'));
autoUpdater.on('update-available', () => sendStatusToSplash('Update found. Downloading...'));
autoUpdater.on('update-not-available', () => {
  sendStatusToSplash('Starting...');
  setTimeout(createMainWindow, 1000);
});
autoUpdater.on('error', (err) => {
  sendStatusToSplash('Ready');
  setTimeout(createMainWindow, 1000);
});
autoUpdater.on('download-progress', (progressObj) => {
  sendStatusToSplash(`Downloading: ${Math.round(progressObj.percent)}%`);
});
autoUpdater.on('update-downloaded', () => {
  sendStatusToSplash('Update Ready');
  if(mainWindow) {
      // Отправляем событие в React, чтобы показать баннер
      mainWindow.webContents.send('update_downloaded');
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { } });