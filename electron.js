const { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');

// Логирование обновлений (опционально, но полезно)
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

let mainWindow;
let splashWindow;
let tray = null;
let isQuitting = false;

function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'favicon.ico');
  }
  return path.join(__dirname, 'public/favicon.ico');
}

// --- СОЗДАНИЕ SPLASH SCREEN (ЗАГРУЗКА) ---
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

  const splashUrl = url.format({
    pathname: path.join(__dirname, app.isPackaged ? 'resources/splash.html' : 'public/splash.html'),
    protocol: 'file:',
    slashes: true
  });

  // Если в продакшене путь кривой, используем прямой путь (хак для билда)
  const loadPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'splash.html') 
      : path.join(__dirname, 'public/splash.html');

  splashWindow.loadFile(loadPath).catch(() => {
      // Fallback если файл не найден
      splashWindow.loadURL(`data:text/html;charset=utf-8,<html><body style="background:#2b2d31;color:white;display:flex;justify-content:center;align-items:center;"><h1>TalkSpace Loading...</h1></body></html>`);
  });

  splashWindow.center();
}

// --- СОЗДАНИЕ ОСНОВНОГО ОКНА ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    backgroundColor: '#0B0B0C',
    frame: false, // Безрамочное
    icon: getIconPath(),
    show: false, // Скрыто пока не прогрузится
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

// --- ОБРАБОТЧИКИ IPC ---
ipcMain.on('app-minimize', () => mainWindow?.minimize());
ipcMain.on('app-maximize', () => mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('app-close', () => mainWindow?.close());
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
  setTimeout(createMainWindow, 1000); // Задержка для красоты
});
autoUpdater.on('error', (err) => {
  sendStatusToSplash('Error checking updates.');
  setTimeout(createMainWindow, 1000); // Все равно запускаем, даже если ошибка обновления
});
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = 'Downloaded ' + Math.round(progressObj.percent) + '%';
  sendStatusToSplash(log_message);
});
autoUpdater.on('update-downloaded', () => {
  sendStatusToSplash('Update downloaded');
  // Если окно уже открыто - шлем туда, если нет - создаем и шлем
  if(mainWindow) {
      mainWindow.webContents.send('update_downloaded');
  } else {
      createMainWindow();
      // Подождем пока загрузится и пошлем сигнал
      setTimeout(() => mainWindow.webContents.send('update_downloaded'), 3000);
  }
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionCheckHandler(() => true);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(true));
  
  createSplashWindow();
  
  if (app.isPackaged) {
      // Проверяем обновления только в собранном приложении
      autoUpdater.checkForUpdates(); 
  } else {
      // В разработке сразу запускаем мейн через 2 сек
      setTimeout(createMainWindow, 1500);
  }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') { /* Keep running in tray */ } });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createSplashWindow(); });