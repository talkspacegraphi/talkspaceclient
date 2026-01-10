const { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');

// Логирование обновлений
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

let mainWindow;
let splashWindow;
let tray = null;
let isQuitting = false;

// --- ЗАПРЕТ НА ЗАПУСК ВТОРОГО ОКНА ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Если кто-то пытается запустить вторую копию, фокусируемся на главном окне
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Разрешения на медиа (камера/микрофон)
    session.defaultSession.setPermissionCheckHandler(() => true);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
    
    createSplashWindow();
    
    if (app.isPackaged) {
        autoUpdater.checkForUpdates(); 
    } else {
        // В разработке задержка для имитации загрузки
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

// --- SPLASH SCREEN ---
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 300,
    height: 350,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#2b2d31',
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
      splashWindow.loadURL(`data:text/html;charset=utf-8,<html><body style="background:#2b2d31;color:white;display:flex;justify-content:center;align-items:center;"><h1>TalkSpace Loading...</h1></body></html>`);
  });

  splashWindow.center();
}

// --- MAIN WINDOW ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    backgroundColor: '#0B0B0C',
    frame: false, // Безрамочное окно
    icon: getIconPath(),
    show: false, // Скрыто до полной загрузки
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

// --- IPC HANDLERS ---
ipcMain.on('app-minimize', () => mainWindow?.minimize());
ipcMain.on('app-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('app-close', () => mainWindow?.close()); // Это вызовет событие 'close' выше
ipcMain.on('flash-frame', () => { if(mainWindow && !mainWindow.isFocused()) mainWindow.flashFrame(true); });

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

// --- UPDATER EVENTS ---
function sendStatusToSplash(text) {
  if (splashWindow) splashWindow.webContents.send('message', text);
}

autoUpdater.on('checking-for-update', () => sendStatusToSplash('Checking for updates...'));
autoUpdater.on('update-available', () => sendStatusToSplash('Update found. Downloading...'));
autoUpdater.on('update-not-available', () => {
  sendStatusToSplash('Update not available. Starting...');
  setTimeout(createMainWindow, 1000);
});
autoUpdater.on('error', (err) => {
  sendStatusToSplash('Error checking updates.');
  setTimeout(createMainWindow, 1000);
});
autoUpdater.on('download-progress', (progressObj) => {
  sendStatusToSplash('Downloaded ' + Math.round(progressObj.percent) + '%');
});
autoUpdater.on('update-downloaded', () => {
  sendStatusToSplash('Update downloaded');
  if(mainWindow) {
      mainWindow.webContents.send('update_downloaded');
  } else {
      createMainWindow();
      setTimeout(() => mainWindow.webContents.send('update_downloaded'), 3000);
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { /* Keep running in tray */ } });