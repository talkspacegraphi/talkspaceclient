const { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');
const log = require('electron-log');

// Настройка логирования
log.transports.file.level = 'info';
autoUpdater.logger = log;

if (require('electron-squirrel-startup')) return app.quit();

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
        setTimeout(() => autoUpdater.checkForUpdates(), 3000);
        setInterval(() => autoUpdater.checkForUpdates(), 1000 * 60 * 10); 
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
    { label: 'TalkSpace', enabled: false }, 
    { type: 'separator' },
    { label: 'Check for updates', click: () => { 
        if(app.isPackaged) autoUpdater.checkForUpdates();
        if(mainWindow) mainWindow.show(); 
    }},
    { label: 'Quit TalkSpace', click: () => { isQuitting = true; app.quit(); }}
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

ipcMain.on('check-for-updates-manual', () => {
    if(app.isPackaged) {
        autoUpdater.checkForUpdates();
    }
});

ipcMain.on('get-auto-launch-status', (event) => { const settings = app.getLoginItemSettings(); event.reply('auto-launch-status', settings.openAtLogin); });
ipcMain.on('toggle-auto-launch', (event, enable) => { app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath }); });

function sendStatusToSplash(text) { if (splashWindow) splashWindow.webContents.send('message', text); }

autoUpdater.on('checking-for-update', () => {
    sendStatusToSplash('Checking...');
    log.info('Checking for update...');
    if(mainWindow) mainWindow.webContents.send('update_status', {status: 'checking'});
});
autoUpdater.on('update-available', (info) => {
    sendStatusToSplash('Update found...');
    log.info('Update available:', info);
    if(mainWindow) mainWindow.webContents.send('update_available_info', info.version);
    if(mainWindow) mainWindow.webContents.send('update_status', {status: 'available', version: info.version});
});
autoUpdater.on('update-not-available', () => {
    sendStatusToSplash('Starting...');
    log.info('Update not available.');
    if(mainWindow) mainWindow.webContents.send('update_status', {status: 'latest'});
    if(!mainWindow) setTimeout(createMainWindow, 1000);
});
autoUpdater.on('error', (err) => {
    sendStatusToSplash('Ready');
    log.error('Update error:', err);
    if(mainWindow) mainWindow.webContents.send('update_status', {status: 'error'});
    if(!mainWindow) setTimeout(createMainWindow, 1000);
});
autoUpdater.on('download-progress', (p) => {
    sendStatusToSplash(`DL: ${Math.round(p.percent)}%`);
});
autoUpdater.on('update-downloaded', () => {
    sendStatusToSplash('Ready');
    log.info('Update downloaded');
    if(mainWindow) mainWindow.webContents.send('update_downloaded');
});

app.on('window-all-closed', () => {});