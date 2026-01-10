import React, { useState, useEffect, useRef, useCallback, createContext } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'peerjs';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import { 
  Users, MessageSquare, Check, X, Settings, Mic, MicOff, 
  Monitor, Send, Phone, PhoneOff, Video, VideoOff, Plus, 
  Menu, Camera, Smile, Reply, Hash, LogOut, Minus, Square, 
  Trash, LogOut as LeaveIcon, Link as LinkIcon, Maximize, Minimize, 
  AlertCircle, ChevronDown, Paperclip, Edit2, Volume2, Search, Crown, 
  UserMinus, DownloadCloud, Bell
} from 'lucide-react';

// --- IPC СВЯЗЬ С ELECTRON ---
const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

// --- КОНФИГУРАЦИЯ ---
const SERVER_URL = "https://talkspace-7fwq.onrender.com"; 
const socket = io(SERVER_URL);
const PEER_CONFIG = { host: '0.peerjs.com', port: 443, secure: true };

// ЗВУКИ
const msgSound = new Audio("./sounds/message.mp3");
const callSound = new Audio("./sounds/call.mp3");
callSound.loop = true;

const ThemeContext = createContext();

// ФАКТЫ ЗАГРУЗКИ
const LOADING_FACTS = [
    "Используйте **жирный текст** для акцента.",
    "Вы можете создать свой сервер и пригласить друзей.",
    "Нажмите на скрепку для отправки фото.",
    "В настройках можно включить шумоподавление.",
    "TalkSpace поддерживает демонстрацию экрана в HD."
];

// --- КОМПОНЕНТЫ ---

// 1. ЗАГОЛОВОК ОКНА
function TitleBar() {
  if (!ipcRenderer) return null;
  return (
    <div className="h-8 bg-[#0B0B0C] flex items-center justify-between select-none w-full border-b border-white/5 z-[9999] fixed top-0 left-0 right-0 drag-region backdrop-blur-md">
       <div className="flex items-center gap-2 px-3 no-drag">
           <div className="w-3 h-3 bg-[var(--primary)] rounded-full flex items-center justify-center font-black text-[6px] text-white">T</div>
           <span className="text-[10px] font-black text-gray-400 tracking-[0.2em] uppercase">TalkSpace</span>
       </div>
       <div className="flex h-full no-drag">
           <button onClick={() => ipcRenderer.send('app-minimize')} className="h-full w-10 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"><Minus size={14} /></button>
           <button onClick={() => ipcRenderer.send('app-maximize')} className="h-full w-10 flex items-center justify-center text-gray-400 hover:bg-white/10 hover:text-white transition-colors"><Square size={12} /></button>
           <button onClick={() => ipcRenderer.send('app-close')} className="h-full w-10 flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white transition-colors"><X size={14} /></button>
       </div>
       <style>{`.drag-region { -webkit-app-region: drag; } .no-drag { -webkit-app-region: no-drag; }`}</style>
    </div>
  );
}

// 2. ЭКРАН ЗАГРУЗКИ
function LoadingScreen() {
    const [fact] = useState(LOADING_FACTS[Math.floor(Math.random() * LOADING_FACTS.length)]);
    return (
        <div className="fixed inset-0 bg-[#0B0B0C] z-[9999] flex flex-col items-center justify-center text-center p-4">
            <motion.div 
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 bg-[var(--primary)] rounded-[24px] mb-8 flex items-center justify-center shadow-[0_0_50px_rgba(88,101,242,0.5)]"
            >
                <div className="text-white font-black text-3xl">T</div>
            </motion.div>
            <h2 className="text-white font-bold text-lg mb-2 uppercase tracking-widest">Загрузка...</h2>
            <p className="text-gray-500 text-sm max-w-md animate-pulse">{fact}</p>
        </div>
    )
}

// 3. БАННЕР ОБНОВЛЕНИЯ
function UpdateBanner() {
    const [show, setShow] = useState(false);
    useEffect(() => {
        if (ipcRenderer) ipcRenderer.on('update_downloaded', () => setShow(true));
    }, []);
    const restartApp = () => { if (ipcRenderer) ipcRenderer.send('restart_app'); };
    if (!show) return null;
    return (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-green-600 text-white p-3 px-6 rounded-full shadow-2xl z-[1000] flex items-center gap-4 animate-bounce">
            <DownloadCloud size={20} />
            <span className="font-bold text-sm">Доступно обновление!</span>
            <button onClick={restartApp} className="bg-white text-green-700 px-3 py-1 rounded-full text-xs font-black uppercase hover:bg-gray-100 transition-colors">Перезапустить</button>
            <button onClick={() => setShow(false)} className="hover:text-black transition-colors"><X size={16}/></button>
        </div>
    );
}

// 4. ФОНОВЫЙ ЭФФЕКТ
function BackgroundEffect() {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0B0B0C]">
          <motion.div animate={{ x: [0, 100, 0], y: [0, -50, 0], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 15, repeat: Infinity }} className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-purple-900/10 rounded-full blur-[150px]" />
          <motion.div animate={{ x: [0, -100, 0], y: [0, 50, 0], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 18, repeat: Infinity }} className="absolute bottom-0 right-0 w-[70vw] h-[70vw] bg-blue-900/10 rounded-full blur-[150px]" />
      </div>
    );
}

// --- ГЛАВНОЕ ПРИЛОЖЕНИЕ ---
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('accentColor') || '#5865F2');

  useEffect(() => {
      document.documentElement.style.setProperty('--primary', primaryColor);
      const checkAuth = async () => {
          if (!token) { setLoading(false); return; }
          try {
              const res = await axios.get(`${SERVER_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
              setUser(res.data);
              setTimeout(() => setLoading(false), 1500); 
          } catch (e) {
              localStorage.clear(); setToken(null); setUser(null); setLoading(false);
          }
      };
      checkAuth();
  }, [token, primaryColor]);

  const handleAuth = (data) => {
    localStorage.setItem('token', data.token); setToken(data.token); setUser(data.user); setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const logout = () => { localStorage.clear(); setToken(null); setUser(null); };

  if (loading) return <LoadingScreen />;

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor }}>
        <Router>
        <div className="bg-[#0B0B0C] text-white font-sans h-screen flex flex-col pt-8 selection:bg-[var(--primary)] selection:text-white overflow-hidden relative">
            <BackgroundEffect />
            <TitleBar />
            <UpdateBanner />
            <div className="flex-1 overflow-hidden relative z-10">
                <Routes>
                    <Route path="/login" element={!token ? <Auth onAuth={handleAuth} /> : <Navigate to="/friends" />} />
                    <Route path="/*" element={token && user ? <MainLayout user={user} setUser={setUser} onLogout={logout} /> : <Navigate to="/login" />} />
                </Routes>
            </div>
        </div>
        </Router>
    </ThemeContext.Provider>
  );
}

// --- ОСНОВНОЙ ЛЕЙАУТ ---
function MainLayout({ user, setUser, onLogout }) {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const [createSeverModal, setCreateServerModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); 
  const [noiseSuppression, setNoiseSuppression] = useState(localStorage.getItem('noiseSuppression') === 'true');

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setUser(res.data);
    } catch (e) { onLogout(); }
  }, [setUser, onLogout]);

  useEffect(() => {
    if (!user?._id) return;
    socket.emit('join_self', user._id);
    socket.on('refresh', refresh);
    socket.on('refresh_user', (id) => { if(id === user._id) refresh() });
    socket.on('new_msg', (msg) => { 
        if(!window.location.hash.includes(msg.chatId) || document.hidden) {
            msgSound.play().catch(()=>{});
            if(ipcRenderer) ipcRenderer.send('flash-frame');
            if(Notification.permission === "granted") new Notification(`TalkSpace: ${msg.senderName}`, { body: "Новое сообщение", silent: true });
        }
    });
    return () => { socket.off('refresh'); socket.off('new_msg'); socket.off('refresh_user'); };
  }, [user?._id, refresh]);

  const updateStatus = async (status, activity = "") => {
    try { await axios.post(`${SERVER_URL}/api/update-profile`, { userId: user._id, status, activity }); setUser({...user, status}); setStatusMenu(false); } catch(e) {}
  };

  const StatusDot = ({ status, size = "w-3 h-3" }) => {
    const color = status === 'online' ? 'bg-green-500' : status === 'dnd' ? 'bg-red-500' : 'bg-yellow-500';
    return <div className={`${size} rounded-full ${color} border-[2px] border-[#0B0B0C] absolute -bottom-0.5 -right-0.5`} />;
  };

  // Context Menu
  const handleContextMenu = (e, s) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, serverId: s._id, ownerId: s.owner, name: s.name }); };
  const deleteServer = async () => { if(window.confirm(`Удалить ${contextMenu.name}?`)) { await axios.post(`${SERVER_URL}/api/delete-server`, { serverId: contextMenu.serverId }); refresh(); setContextMenu(null); navigate('/friends'); }};
  const leaveServer = async () => { if(window.confirm(`Выйти из ${contextMenu.name}?`)) { await axios.post(`${SERVER_URL}/api/leave-server`, { serverId: contextMenu.serverId, userId: user._id }); refresh(); setContextMenu(null); navigate('/friends'); }};
  const inviteServer = () => { navigator.clipboard.writeText("INVITE-" + contextMenu.serverId.slice(-6).toUpperCase()); alert("Код скопирован"); setContextMenu(null); };

  return (
    <div className="relative flex h-full z-10 overflow-hidden" onClick={()=>setContextMenu(null)}>
      {/* 1. SERVER LIST */}
      <div className="w-[72px] flex flex-col items-center py-3 gap-3 bg-[#0B0B0C] border-r border-white/5 shrink-0 z-20 overflow-y-auto no-scrollbar">
        <div onClick={() => navigate('/friends')} className="relative w-12 h-12 bg-[#313338] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 group shadow-md">
          <MessageSquare size={24} className="text-gray-300 group-hover:text-white" />
          {user?.requests?.length > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-[#0B0B0C] text-[10px] font-bold text-white shadow-lg">{user.requests.length}</div>}
        </div>
        <div className="w-8 h-[2px] bg-white/10 rounded-full" />
        {user?.servers?.map(s => (
            <div key={s._id} onClick={() => navigate(`/server/${s._id}`)} onContextMenu={(e) => handleContextMenu(e, s)} className="w-12 h-12 bg-[#313338] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 text-white font-bold uppercase shadow-md relative select-none text-xs overflow-hidden border border-white/5">
                {s.name.substring(0, 2)}
            </div>
        ))}
        <button onClick={() => setCreateServerModal(true)} className="w-12 h-12 bg-[#313338] text-green-500 hover:bg-green-500 hover:text-white rounded-[24px] hover:rounded-[16px] transition-all flex items-center justify-center shadow-md group border border-white/5"><Plus size={24} /></button>
      </div>

      {/* 2. SIDEBAR */}
      <div className="w-64 bg-[#111214] flex flex-col shrink-0 z-20 border-r border-white/5">
         <Routes>
             <Route path="/friends" element={<DMSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
             <Route path="/chat/*" element={<DMSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
             <Route path="/server/:serverId" element={<ServerSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
         </Routes>
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 flex flex-col bg-[#1E1F22] relative min-w-0 z-10">
        <Routes>
          <Route path="/friends" element={<FriendsView user={user} refresh={refresh} />} />
          <Route path="/chat/:friendId" element={<ChatView user={user} noiseSuppression={noiseSuppression} />} />
          <Route path="/server/:serverId" element={<ServerView user={user} noiseSuppression={noiseSuppression} />} />
          <Route path="*" element={<Navigate to="/friends" />} />
        </Routes>
      </div>

      {contextMenu && (
          <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed bg-[#111] border border-white/10 rounded-xl shadow-2xl z-[300] py-1 w-48 font-bold">
              <button onClick={inviteServer} className="w-full text-left px-3 py-2 text-indigo-400 hover:bg-[var(--primary)] hover:text-white text-xs flex items-center gap-2 transition-colors"><LinkIcon size={14}/> Пригласить</button>
              <div className="h-[1px] bg-white/10 my-1"/>
              {contextMenu.ownerId === user._id ? (
                  <button onClick={deleteServer} className="w-full text-left px-3 py-2 text-red-500 hover:bg-red-500 hover:text-white text-xs flex items-center gap-2 transition-colors"><Trash size={14}/> Удалить</button>
              ) : (
                  <button onClick={leaveServer} className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500 hover:text-white text-xs flex items-center gap-2 transition-colors"><LeaveIcon size={14}/> Покинуть</button>
              )}
          </div>
      )}

      <AnimatePresence>
        {showSettings && <SettingsModal user={user} setUser={setUser} onClose={() => setShowSettings(false)} onLogout={onLogout} noise={noiseSuppression} setNoise={setNoiseSuppression} />}
        {createSeverModal && <CreateServerModal user={user} onClose={() => setCreateServerModal(false)} refresh={refresh} />}
      </AnimatePresence>
    </div>
  );
}

// --- SIDEBARS ---
const DMSidebar = ({ user, navigate, StatusDot, setShowSettings, statusMenu, setStatusMenu, updateStatus }) => (
    <>
        <div className="h-12 flex items-center px-4 font-black text-white border-b border-white/5 shadow-sm select-none uppercase tracking-widest text-[10px] text-gray-500">Личные сообщения</div>
        <div className="flex-1 p-2 space-y-1 overflow-y-auto">
          <button onClick={() => navigate('/friends')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${window.location.hash.includes('/friends') ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#1E1F22]'}`}>
            <Users size={20} /> <span className="text-sm font-bold">Друзья</span>
          </button>
          <div className="mt-4 mb-2 px-3 text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center justify-between select-none"><span>ЛС</span> <Plus size={12} className="cursor-pointer hover:text-white"/></div>
          {user?.chats?.map(c => {
            const f = c.members.find(m => m._id !== user._id);
            if (!f) return null;
            return (
              <div key={c._id} onClick={() => navigate(`/chat/${f._id}`)} className={`flex items-center gap-3 px-2 py-2 rounded-xl cursor-pointer transition-all group ${window.location.hash.includes(f._id) ? 'bg-[#3F4147] text-white shadow-md' : 'hover:bg-[#1E1F22] text-gray-400'}`}>
                <div className="relative"><img src={f.avatar} className="w-9 h-9 rounded-full bg-zinc-800 object-cover" alt="av" /><StatusDot status={f.status} /></div>
                <div className="flex-1 overflow-hidden leading-tight"><p className="truncate text-sm font-bold group-hover:text-white transition-colors">{f.displayName || f.username}</p><p className="text-[10px] text-gray-500 truncate group-hover:text-gray-400">{f.status}</p></div>
              </div>
            );
          })}
        </div>
        <UserPanel user={user} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} StatusDot={StatusDot}/>
    </>
);

const ServerSidebar = ({ user, navigate, StatusDot, setShowSettings, statusMenu, setStatusMenu, updateStatus }) => {
    const { serverId } = useParams();
    const activeServer = user?.servers?.find(s => s._id === serverId);
    return (
    <>
        <div className="h-12 flex items-center px-4 font-black text-white border-b border-white/5 shadow-sm truncate select-none uppercase tracking-wide text-xs">{activeServer?.name || "Server"}</div>
        <div className="flex-1 p-2 space-y-1 overflow-y-auto">
            {activeServer?.channels?.map(ch => (
                <div key={ch._id} onClick={() => navigate(`/server/${serverId}?channel=${ch._id}`)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${window.location.search.includes(ch._id) ? 'bg-[#3F4147] text-white' : 'text-gray-400 hover:bg-[#1E1F22]'}`}>
                    {ch.type === 'voice' ? <Volume2 size={18}/> : <Hash size={18}/>}
                    <span className="font-bold text-sm">{ch.name}</span>
                </div>
            ))}
        </div>
        <UserPanel user={user} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} StatusDot={StatusDot}/>
    </>
    );
};

const UserPanel = ({ user, setShowSettings, statusMenu, setStatusMenu, updateStatus, StatusDot }) => (
    <div className="bg-[#0B0B0C] border-t border-white/5 p-2 relative select-none flex items-center gap-2">
       <AnimatePresence>
        {statusMenu && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: -10, opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-full left-2 w-56 bg-[#111] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 mb-2">
             <button onClick={() => updateStatus('online')} className="w-full text-left p-2 hover:bg-white/10 rounded-xl flex items-center gap-3 text-xs font-bold text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_green]"/> В сети</button>
             <button onClick={() => updateStatus('dnd')} className="w-full text-left p-2 hover:bg-white/10 rounded-xl flex items-center gap-3 text-xs font-bold text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_8px_red]"/> Не беспокоить</button>
             <button onClick={() => updateStatus('idle', 'Спит')} className="w-full text-left p-2 hover:bg-white/10 rounded-xl flex items-center gap-3 text-xs font-bold text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-[0_0_8px_yellow]"/> Спит</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-colors flex-1" onClick={(e) => {if(!e.target.closest('.icons')) setStatusMenu(!statusMenu)}}>
          <div className="relative"><img src={user?.avatar} className="w-9 h-9 rounded-full object-cover bg-zinc-800" alt="me" /><StatusDot status={user.status} /></div>
          <div className="flex-1 overflow-hidden leading-tight"><p className="text-xs font-black text-white truncate">{user?.displayName}</p><p className="text-[9px] text-gray-400 font-bold">@{user?.username}</p></div>
      </div>
      <div className="flex gap-0 icons">
        <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" onClick={()=>setShowSettings(true)}><Settings size={18}/></button>
      </div>
    </div>
);

// --- CALL HEADER ---
function CallHeader({ callActive, incoming, onAccept, onReject, onHangup, localStream, remoteStream, toggleMic, toggleCam, shareScreen, isMicOn, isCamOn, isScreenOn, friend }) {
    if (!callActive && !incoming) return null;
    const [fullScreen, setFullScreen] = useState(false);

    // Анимация когда нет видео
    const PulseAvatar = ({ src }) => (
        <div className="relative flex items-center justify-center w-full h-full">
            <span className="absolute inline-flex h-32 w-32 rounded-full bg-green-500 opacity-20 animate-ping"></span>
            <img src={src} className="w-24 h-24 rounded-full border-4 border-[#1E1F22] relative z-10 object-cover shadow-2xl" alt="av"/>
        </div>
    );

    return (
        <div className={`bg-black border-b border-white/5 shrink-0 relative flex flex-col transition-all duration-300 ${fullScreen ? 'fixed inset-0 z-[100] h-screen border-none p-6' : 'p-3'}`}>
            {fullScreen && <div className="absolute top-4 right-4 z-50"><button onClick={()=>setFullScreen(false)} className="bg-black/50 p-2 rounded-xl hover:bg-black/80 text-white"><Minimize size={20}/></button></div>}

            {/* Входящий звонок */}
            {incoming && !callActive && (
                 <motion.div initial={{y:-20, opacity:0}} animate={{y:0, opacity:1}} className="w-full flex items-center justify-between bg-[#111] p-4 rounded-2xl border border-indigo-500/50 shadow-[0_0_30px_rgba(88,101,242,0.3)]">
                     <div className="flex items-center gap-4">
                         <img src="https://via.placeholder.com/50" className="w-12 h-12 rounded-full border-2 border-[#5865F2] animate-pulse" alt="av"/>
                         <div><p className="text-[10px] text-[#5865F2] font-black uppercase tracking-widest mb-1">Входящий звонок</p><p className="text-white font-bold text-lg">{incoming.from}</p></div>
                     </div>
                     <div className="flex gap-4">
                         <button onClick={onAccept} className="p-3 bg-green-500 rounded-full text-white hover:bg-green-400 shadow-lg active:scale-95 transition-all"><Phone size={20}/></button>
                         <button onClick={onReject} className="p-3 bg-red-500 rounded-full text-white hover:bg-red-400 shadow-lg active:scale-95 transition-all"><PhoneOff size={20}/></button>
                     </div>
                 </motion.div>
            )}

            {/* Активный звонок */}
            {callActive && (
                <div className={`flex flex-col gap-3 ${fullScreen ? 'h-full' : ''}`}>
                    <div className={`flex gap-3 w-full ${fullScreen ? 'flex-1' : 'h-64'}`}>
                        {/* Видео собеседника */}
                        <div className="flex-1 bg-[#111] rounded-2xl overflow-hidden relative flex items-center justify-center group border border-white/5 shadow-inner">
                            {remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled ? (
                                <video ref={v => {if(v) v.srcObject = remoteStream}} autoPlay className="w-full h-full object-cover" />
                            ) : (
                                <PulseAvatar src={friend?.avatar || 'https://via.placeholder.com/100'} />
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-xs font-bold text-white backdrop-blur-sm">{friend?.displayName}</div>
                            {!fullScreen && <button onClick={()=>setFullScreen(true)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-black/60 p-2 rounded-lg text-white transition-all hover:bg-black"><Maximize size={16}/></button>}
                        </div>
                        
                        {/* Мое видео (PiP) */}
                        <div className="w-48 bg-[#111] rounded-2xl overflow-hidden relative shadow-2xl border border-white/10 group">
                             {isCamOn || isScreenOn ? (
                                <video ref={v => {if(v) v.srcObject = localStream}} autoPlay muted className={`w-full h-full object-cover ${!isScreenOn ? 'mirror' : ''}`} />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[#18191C]"><img src={user?.avatar} className="w-16 h-16 rounded-full opacity-50" alt="me"/></div>
                             )}
                             <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-md text-[10px] font-bold text-white">Вы</div>
                        </div>
                    </div>
                    
                    {/* Кнопки управления */}
                    <div className={`flex justify-center gap-4 ${fullScreen ? 'pb-8 pt-4' : ''}`}>
                        <button onClick={toggleMic} className={`p-4 rounded-2xl transition-all ${isMicOn ? 'bg-[#2B2D31] hover:bg-white hover:text-black text-gray-200' : 'bg-red-500 text-white shadow-[0_0_15px_red]'}`}>{isMicOn ? <Mic size={22}/> : <MicOff size={22}/>}</button>
                        <button onClick={toggleCam} className={`p-4 rounded-2xl transition-all ${isCamOn ? 'bg-[#2B2D31] hover:bg-white hover:text-black text-gray-200' : 'bg-red-500 text-white shadow-[0_0_15px_red]'}`}>{isCamOn ? <Video size={22}/> : <VideoOff size={22}/>}</button>
                        <button onClick={shareScreen} className={`p-4 rounded-2xl transition-all ${isScreenOn ? 'bg-green-500 text-white shadow-[0_0_15px_green]' : 'bg-[#2B2D31] hover:bg-white hover:text-black text-gray-200'}`}><Monitor size={22}/></button>
                        <button onClick={onHangup} className="p-4 px-8 bg-red-600 rounded-2xl text-white hover:bg-red-500 shadow-xl active:scale-95 transition-all"><PhoneOff size={26}/></button>
                    </div>
                </div>
            )}
        </div>
    )
}

// --- MESSAGE LIST ---
function MessageList({ messages, user, onReact, onEdit, onDelete }) {
    const scrollRef = useRef();
    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    return (
        <div className="flex-1 p-6 overflow-y-auto space-y-6 flex flex-col">
            {messages.map((m, i) => {
                const isMe = m.senderId === user._id;
                return (
                    <div key={i} className={`flex gap-4 group ${isMe ? 'flex-row-reverse' : ''} relative`}>
                        <img src={m.senderAvatar} className="w-10 h-10 rounded-full shrink-0 bg-zinc-800 object-cover mt-1 border border-white/5" alt="m" />
                        <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-sm font-bold text-white">{m.senderName}</span>
                                <span className="text-[10px] text-gray-400 font-medium">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="relative group/msg">
                                <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed ${isMe ? 'bg-[var(--primary)] text-white rounded-tr-none' : 'bg-[#2B2D31] text-gray-100 rounded-tl-none'}`}>
                                    {m.type === 'image' ? (
                                        <img src={m.fileUrl} className="max-w-full rounded-lg cursor-pointer" onClick={()=>window.open(m.fileUrl)} alt="att"/>
                                    ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">{m.text}</ReactMarkdown>
                                    )}
                                    {m.isEdited && <span className="text-[9px] opacity-50 ml-1">(изменено)</span>}
                                </div>
                                {m.reactions?.length > 0 && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {m.reactions.map((r, ri) => (
                                            <div key={ri} onClick={()=>onReact(m._id, r.emoji)} className="bg-[#111] px-1.5 py-0.5 rounded text-[10px] border border-white/10 cursor-pointer hover:border-[var(--primary)] flex items-center gap-1">
                                                <span>{r.emoji}</span> <span className="font-bold">{r.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className={`absolute -top-4 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover/msg:opacity-100 bg-[#111] p-1 rounded-lg border border-white/10 flex gap-1 shadow-xl transition-all z-10`}>
                                    <button onClick={()=>onReact(m._id, '👍')} className="hover:bg-white/10 p-1 rounded">👍</button>
                                    <button onClick={()=>onReact(m._id, '❤️')} className="hover:bg-white/10 p-1 rounded">❤️</button>
                                    {isMe && <button onClick={()=>onEdit(m)} className="hover:text-blue-400 p-1"><Edit2 size={12}/></button>}
                                    {isMe && <button onClick={()=>onDelete(m._id)} className="hover:text-red-400 p-1"><Trash size={12}/></button>}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
            <div ref={scrollRef} />
        </div>
    )
}

function ChatInput({ onSend, onUpload, placeholder }) {
    const [text, setText] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    
    const send = () => { if(text.trim()) { onSend(text); setText(""); } };
    const handleFile = async (e) => {
        if(e.target.files[0]) {
            const fd = new FormData(); fd.append('file', e.target.files[0]);
            const res = await axios.post(`${SERVER_URL}/api/upload`, fd);
            onUpload(res.data.url);
        }
    };

    return (
        <div className="p-4 bg-[#1E1F22] shrink-0 z-20 relative">
            {showEmoji && <div className="absolute bottom-20 right-4 z-50"><EmojiPicker theme="dark" onEmojiClick={(e)=>setText(prev=>prev+e.emoji)}/></div>}
            <div className="flex items-center gap-3 bg-[#383A40] p-2.5 px-4 rounded-[24px] focus-within:ring-1 focus-within:ring-[var(--primary)] transition-all">
                <label className="cursor-pointer text-gray-400 hover:text-white p-1 hover:bg-[#2B2D31] rounded-full transition-colors"><Paperclip size={20}/><input type="file" hidden onChange={handleFile}/></label>
                <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') send()}} className="flex-1 bg-transparent outline-none text-gray-200 text-sm py-1 placeholder:text-gray-500 font-medium" placeholder={placeholder} />
                <button onClick={()=>setShowEmoji(!showEmoji)} className="text-gray-400 hover:text-yellow-400 transition-colors"><Smile size={20}/></button>
                <button onClick={send} className="text-gray-400 hover:text-[var(--primary)] transition-colors"><Send size={20}/></button>
            </div>
        </div>
    )
}

function ChatView({ user, noiseSuppression }) {
  const { friendId } = useParams();
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // Call State
  const [callActive, setCallActive] = useState(false);
  const [isIncoming, setIsIncoming] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenOn, setIsScreenOn] = useState(false);
  
  const peerRef = useRef();
  const friend = activeChat?.members?.find(m => m._id !== user._id);

  useEffect(() => {
    const peer = new Peer(user._id, PEER_CONFIG);
    peerRef.current = peer;
    peer.on('call', (call) => { callSound.play(); setIsIncoming({ call, from: "Входящий" }); call.on('stream', (rs) => setRemoteStream(rs)); });

    axios.post(`${SERVER_URL}/api/start-chat`, { myId: user._id, friendId }).then(res => {
        setActiveChat(res.data); setMessages(res.data.messages || []); socket.emit('join_chat', res.data._id);
    });

    socket.on('new_msg', (m) => { if(m.chatId === activeChat?._id) setMessages(p => [...p, m]); });
    socket.on('message_update', (d) => setMessages(p => p.map(m => m._id === d.msg._id ? d.msg : m)));
    socket.on('message_delete', (d) => setMessages(p => p.filter(m => m._id !== d.msgId)));
    socket.on('incoming_call_signal', (d) => { callSound.play(); setIsIncoming(d); });
    socket.on('call_ended', endCall);

    return () => { socket.off('new_msg'); socket.off('incoming_call_signal'); socket.off('call_ended'); socket.off('message_update'); socket.off('message_delete'); peer.destroy(); endCall(); };
  }, [user._id, friendId, activeChat?._id]);

  const handleSend = (text) => socket.emit('send_msg', { chatId: activeChat._id, text, senderId: user._id, senderName: user.displayName, avatar: user.avatar, type: 'text' });
  const handleUpload = (url) => socket.emit('send_msg', { chatId: activeChat._id, text: "", senderId: user._id, senderName: user.displayName, avatar: user.avatar, type: 'image', fileUrl: url });
  const handleReact = (msgId, emoji) => axios.post(`${SERVER_URL}/api/message/react`, { chatId: activeChat._id, msgId, emoji, userId: user._id });
  const handleEdit = (m) => { const t = prompt("Edit:", m.text); if(t) axios.post(`${SERVER_URL}/api/message/edit`, { chatId: activeChat._id, msgId: m._id, newText: t }); };
  const handleDelete = (msgId) => axios.post(`${SERVER_URL}/api/message/delete`, { chatId: activeChat._id, msgId });

  // Call Logic (WebRTC)
  const getMediaConstraints = (video) => ({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: { echoCancellation: true, noiseSuppression: noiseSuppression, autoGainControl: true }
  });

  const startCall = async (withVideo) => {
    try {
        const s = await navigator.mediaDevices.getUserMedia(getMediaConstraints(withVideo));
        setLocalStream(s); setCallActive(true); setIsCamOn(withVideo); setIsMicOn(true);
        const call = peerRef.current.call(friendId, s);
        call.on('stream', (rs) => setRemoteStream(rs));
        socket.emit('call_user', { userToCall: friendId, from: user.displayName, fromId: user._id });
    } catch(e) { alert("Ошибка доступа к устройствам."); }
  };

  const answerCall = async () => {
      callSound.pause(); callSound.currentTime = 0;
      const s = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false)); 
      setLocalStream(s); setCallActive(true); setIsIncoming(null); setIsCamOn(false);
      if(isIncoming.call) { isIncoming.call.answer(s); isIncoming.call.on('stream', rs => setRemoteStream(rs)); }
      else { /* Logic for peerjs bug fallback */ }
  };

  const endCall = () => {
      if(localStream) localStream.getTracks().forEach(t=>t.stop());
      callSound.pause(); callSound.currentTime = 0;
      setCallActive(false); setLocalStream(null); setRemoteStream(null); setIsIncoming(null); setIsScreenOn(false);
  };

  const shareScreen = async () => {
      if(!isScreenOn) {
         try {
             const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080, frameRate: 60 }, audio: true });
             const screenTrack = screenStream.getVideoTracks()[0];
             const sender = peerRef.current.peerConnection.getSenders().find(s => s.track.kind === 'video'); // Simplified
             // In PeerJS, replacing track is tricky without renegotiation, for simplicity we might need to recall.
             // But for now let's assume it replaces:
             if(sender) sender.replaceTrack(screenTrack);
             screenTrack.onended = () => { setIsScreenOn(false); };
             setIsScreenOn(true);
         } catch(e) {}
      }
  };

  if (!activeChat) return <div className="flex-1 flex items-center justify-center text-gray-500 font-bold animate-pulse">Загрузка чата...</div>;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="h-12 flex items-center justify-between px-6 border-b border-white/5 bg-[#1E1F22] shrink-0 z-20">
          <div className="flex items-center gap-3">
             <div className="relative"><img src={friend?.avatar} className="w-8 h-8 rounded-full" alt="f" /><div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-[#1E1F22] rounded-full ${friend?.status==='online'?'bg-green-500':friend?.status==='dnd'?'bg-red-500':'bg-yellow-500'}`} /></div>
             <div><p className="font-bold text-white text-sm">{friend?.displayName}</p><p className="text-[10px] text-gray-400 font-bold">@{friend?.username}</p></div>
          </div>
          <div className="flex gap-4 text-gray-400">
            <Phone size={22} className="hover:text-green-400 cursor-pointer transition-colors" onClick={() => startCall(false)} />
            <Video size={24} className="hover:text-gray-200 cursor-pointer transition-colors" onClick={() => startCall(true)} />
          </div>
      </div>
      <CallHeader callActive={callActive} incoming={isIncoming} onAccept={answerCall} onReject={()=>{callSound.pause();setIsIncoming(null)}} onHangup={()=>{socket.emit('hangup', {to: friendId}); endCall()}} localStream={localStream} remoteStream={remoteStream} toggleMic={()=>{}} toggleCam={()=>{}} shareScreen={shareScreen} isMicOn={isMicOn} isCamOn={isCamOn} isScreenOn={isScreenOn} friend={friend}/>
      <MessageList messages={messages} user={user} onReact={handleReact} onEdit={handleEdit} onDelete={handleDelete} />
      <ChatInput onSend={handleSend} onUpload={handleUpload} placeholder={`Написать @${friend?.displayName}`} />
    </div>
  );
}

function ServerView({ user, noiseSuppression }) {
    const { serverId } = useParams();
    const query = new URLSearchParams(window.location.search);
    const channelId = query.get('channel') || user?.servers?.find(s=>s._id===serverId)?.channels?.[0]?._id;
    const server = user?.servers?.find(s => s._id === serverId);
    const channel = server?.channels?.find(c => c._id === channelId);
    const [messages, setMessages] = useState(channel?.messages || []);
    const [inVoice, setInVoice] = useState(false);

    useEffect(() => {
        socket.emit('join_server_room', serverId);
        setMessages(channel?.messages || []);
    }, [channelId, serverId, channel]);

    socket.on('new_server_msg', (m) => { if(m.channelId === channelId) setMessages(p => [...p, m]); });

    const handleSend = (text) => socket.emit('send_msg', { serverId, channelId, text, senderId: user._id, senderName: user.displayName, avatar: user.avatar, type: 'text' });
    const kickMember = async (id) => { if(server.owner === user._id) await axios.post(`${SERVER_URL}/api/kick-member`, { serverId, userId: id }); };

    return (
        <div className="flex h-full">
            <div className="flex-1 flex flex-col">
                {channel?.type === 'text' ? (
                    <>
                        <div className="h-12 border-b border-white/5 flex items-center px-4 font-bold text-white"><Hash size={20} className="mr-2 text-gray-400"/> {channel.name}</div>
                        <MessageList messages={messages} user={user} onReact={()=>{}} onEdit={()=>{}} onDelete={()=>{}} />
                        <ChatInput onSend={handleSend} onUpload={()=>{}} placeholder={`Написать в #${channel.name}`} />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col">
                        <Volume2 size={64} className="text-gray-600 mb-4"/>
                        <h2 className="text-2xl font-bold mb-4 text-white">Голосовой канал: {channel?.name}</h2>
                        {!inVoice ? (
                            <button onClick={()=>setInVoice(true)} className="bg-green-500 px-8 py-2 rounded-xl font-bold text-white shadow-lg hover:bg-green-600 transition-all">Подключиться</button>
                        ) : (
                            <div className="text-center">
                                <p className="text-green-400 mb-4 font-bold">Вы подключены</p>
                                <button onClick={()=>setInVoice(false)} className="bg-red-500 px-8 py-2 rounded-xl font-bold text-white shadow-lg hover:bg-red-600 transition-all">Отключиться</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* RIGHT SIDEBAR MEMBERS */}
            <div className="w-60 bg-[#2B2D31] p-4 overflow-y-auto border-l border-white/5">
                <h3 className="text-xs font-black text-gray-400 uppercase mb-4 tracking-widest">Участники — {server?.members?.length}</h3>
                {server?.members?.map(m => (
                    <div key={m._id} onContextMenu={(e)=>{e.preventDefault(); if(server.owner===user._id && m._id!==user._id) if(window.confirm("Кикнуть?")) kickMember(m._id)}} className="flex items-center gap-2 mb-2 p-1.5 hover:bg-[#35373C] rounded-lg cursor-pointer opacity-90 hover:opacity-100 transition-all">
                        <img src={m.avatar} className="w-8 h-8 rounded-full bg-zinc-800 object-cover" alt="av"/>
                        <div>
                            <p className={`font-bold text-sm ${server.owner===m._id ? 'text-yellow-500' : 'text-gray-300'}`}>{m.displayName} {server.owner===m._id && <Crown size={12} className="inline ml-1"/>}</p>
                            <p className="text-[10px] text-gray-500 font-medium">{m.status}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function FriendsView({ user, refresh }) {
    const [tab, setTab] = useState('all');
    const [friendInput, setFriendInput] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(""); 
    const navigate = useNavigate();
  
    const sendRequest = async () => {
        setError(""); setSuccess("");
        try {
            if(!friendInput) return;
            await axios.post(`${SERVER_URL}/api/friend-request`, { fromId: user._id, targetUsername: friendInput });
            setSuccess(`Запрос отправлен ${friendInput}!`); setFriendInput("");
        } catch (e) { setError(e.response?.data?.error || "Пользователь не найден"); }
    };
    
    const handleInput = (e) => { setFriendInput(e.target.value); setError(""); setSuccess(""); };
    const borderClass = error ? 'border-red-500' : success ? 'border-green-500' : 'border-[#1E1F22] focus-within:border-[#00A8FC]';

    return (
      <div className="flex flex-col h-full bg-[#313338]">
        <div className="h-12 flex items-center px-6 border-b border-[#1f2023] gap-6 shadow-sm">
          <div className="flex items-center gap-2 text-white font-bold"><Users size={20} /><span>Друзья</span></div>
          <div className="h-4 w-[1px] bg-white/10"/>
          <div className="flex gap-2">
              {['all', 'pending', 'add'].map(t => (
              <button key={t} onClick={() => {setTab(t); setError(""); setSuccess("");}} className={`px-2 py-0.5 rounded text-sm font-medium transition-colors ${tab === t ? (t==='add'?'text-green-500 bg-transparent':'bg-[#404249] text-white') : (t==='add'?'bg-green-600 text-white px-3':'text-gray-400 hover:bg-[#35373C] hover:text-gray-200')}`}>
                  {t === 'all' ? 'Все' : t === 'pending' ? 'Ожидание' : 'Добавить друга'}
              </button>
              ))}
          </div>
        </div>
        <div className="p-8 overflow-y-auto">
          {tab === 'all' && (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-wide">Все друзья — {user?.friends?.length || 0}</p>
                {user?.friends?.map(f => (
                    <div key={f._id} onClick={() => navigate(`/chat/${f._id}`)} className="flex items-center justify-between p-2.5 hover:bg-[#35373C] rounded-lg cursor-pointer group border-t border-[#3f4147] border-opacity-50">
                        <div className="flex items-center gap-3"><img src={f.avatar} className="w-8 h-8 rounded-full object-cover" alt="av" /><div><p className="font-bold text-white text-sm">{f.displayName} <span className="hidden group-hover:inline text-gray-400 text-xs font-normal">{f.username}</span></p><p className="text-[11px] text-gray-400">{f.status}</p></div></div>
                        <div className="p-2 bg-[#2b2d31] rounded-full text-gray-400 group-hover:text-gray-200"><MessageSquare size={16} /></div>
                    </div>
                ))}
              </>
          )}
          {tab === 'add' && (
            <div className="w-full max-w-2xl">
              <h3 className="text-white font-bold text-base mb-2 uppercase">Добавить друга</h3>
              <p className="text-gray-400 text-xs mb-4">Вы можете добавить друзей по имени пользователя (например: graphi).</p>
              <div className={`bg-[#1e1f22] p-2 rounded-lg border flex items-center transition-all ${borderClass}`}><input value={friendInput} onChange={handleInput} className="bg-transparent flex-1 p-2 outline-none text-white text-sm placeholder:text-gray-500" placeholder="Имя пользователя" /><button onClick={sendRequest} disabled={!friendInput} className={`px-4 py-1.5 rounded text-sm font-medium text-white transition-colors ${friendInput ? 'bg-[#5865F2] hover:bg-[#4752c4]' : 'bg-[#3b405a] cursor-not-allowed opacity-50'}`}>Отправить запрос</button></div>
              {success && <p className="text-green-500 text-xs mt-2 font-medium">{success}</p>}
              {error && <p className="text-red-500 text-xs mt-2 font-medium">{error}</p>}
            </div>
          )}
          {tab === 'pending' && user?.requests?.map(r => (
              <div key={r.from} className="flex items-center justify-between p-3 hover:bg-[#35373C] rounded-lg border-t border-[#3f4147]"><div className="flex items-center gap-3"><img src={r.avatar} className="w-8 h-8 rounded-full" alt="av"/><div><p className="font-bold text-white text-sm">{r.displayName}</p><p className="text-xs text-gray-400">Входящий запрос</p></div></div><div className="flex gap-2"><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'accept' }); refresh(); }} className="p-2 bg-[#2b2d31] hover:text-green-500 rounded-full"><Check size={16}/></button><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'decline' }); refresh(); }} className="p-2 bg-[#2b2d31] hover:text-red-500 rounded-full"><X size={16}/></button></div></div>
          ))}
        </div>
      </div>
    );
}

function CreateServerModal({ user, onClose, refresh }) {
    const [name, setName] = useState("");
    const create = async () => {
        if(!name) return;
        await axios.post(`${SERVER_URL}/api/create-server`, { name, owner: user._id });
        refresh(); onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[500]">
            <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#313338] p-6 rounded-3xl text-center w-full max-w-sm shadow-2xl border border-white/10">
                <h2 className="text-2xl font-black text-white mb-2">Создать сервер</h2>
                <p className="text-gray-400 text-xs mb-6 px-4">Сервер — это место, где вы можете общаться с друзьями.</p>
                <div className="uppercase text-[10px] font-black text-gray-400 mb-2 text-left tracking-widest">Название сервера</div>
                <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none mb-6 text-sm" />
                <div className="flex justify-between items-center">
                    <button onClick={onClose} className="text-gray-300 hover:underline text-sm font-bold">Назад</button>
                    <button onClick={create} className="bg-[#5865F2] hover:bg-[#4752c4] px-8 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg">Создать</button>
                </div>
            </motion.div>
        </div>
    )
}

function SettingsModal({ user, setUser, onClose, onLogout, noise, setNoise }) {
    const [activeTab, setActiveTab] = useState('account'); 
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [banner, setBanner] = useState(user?.bannerColor || "#000000");
    const [file, setFile] = useState(null);
    
    // Account changes
    const [email, setEmail] = useState(user?.email || "");
    const [newPass, setNewPass] = useState("");
    const [currPass, setCurrPass] = useState("");

    const saveProfile = async () => {
        const fd = new FormData(); fd.append('userId', user._id); fd.append('displayName', displayName); fd.append('bio', bio); fd.append('bannerColor', banner);
        if(file) fd.append('avatar', file);
        try { const res = await axios.post(`${SERVER_URL}/api/update-profile`, fd); setUser(res.data); localStorage.setItem('user', JSON.stringify(res.data)); localStorage.setItem('noiseSuppression', noise); onClose(); } catch(e) { alert("Ошибка"); }
    };

    const saveAccount = async () => {
        try {
            await axios.post(`${SERVER_URL}/api/update-account`, { userId: user._id, email, newPassword: newPass, currentPassword: currPass });
            alert("Аккаунт обновлен!"); onClose();
        } catch(e) { alert(e.response?.data?.error || "Ошибка"); }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-8">
             <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-[#313338] w-full max-w-4xl h-[80vh] rounded-[30px] flex overflow-hidden shadow-2xl border border-white/5">
                 {/* SIDEBAR */}
                 <div className="w-64 bg-[#2B2D31] p-6 pt-10">
                     <p className="uppercase text-[10px] font-black text-gray-400 px-2 mb-2 tracking-widest">Настройки пользователя</p>
                     <div onClick={()=>setActiveTab('account')} className={`px-3 py-2 rounded-lg text-sm font-bold mb-1 cursor-pointer ${activeTab==='account' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C]'}`}>Моя учетная запись</div>
                     <div onClick={()=>setActiveTab('profile')} className={`px-3 py-2 rounded-lg text-sm font-bold mb-1 cursor-pointer ${activeTab==='profile' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C]'}`}>Профиль</div>
                     <div className="h-[1px] bg-white/10 my-4 mx-2"/>
                     <div onClick={onLogout} className="text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between transition-colors">Выйти <LogOut size={16}/></div>
                 </div>

                 {/* CONTENT */}
                 <div className="flex-1 p-10 overflow-y-auto relative bg-[#313338]">
                    <div onClick={onClose} className="absolute top-6 right-6 p-2 border-2 border-gray-500 rounded-full text-gray-500 hover:text-white hover:border-white cursor-pointer transition-all opacity-70 hover:opacity-100"><X size={20}/></div>
                    
                    {activeTab === 'account' && (
                        <>
                            <h2 className="text-xl font-black text-white mb-6">Моя учетная запись</h2>
                            <div className="bg-[#1E1F22] rounded-2xl p-6 mb-8 flex items-center gap-6 border border-white/5">
                                <div className="relative"><img src={user?.avatar} className="w-20 h-20 rounded-full bg-[#111]" alt="av"/><div className="absolute -bottom-1 -right-1 p-1 bg-[#1E1F22] rounded-full"><div className="w-4 h-4 bg-green-500 rounded-full border-2 border-[#1E1F22]"/></div></div>
                                <div>
                                    <h3 className="text-2xl font-black text-white">{user?.displayName}</h3>
                                    <p className="text-sm font-bold text-gray-400">@{user?.username}</p>
                                </div>
                                <button onClick={()=>setActiveTab('profile')} className="ml-auto bg-[#5865F2] px-6 py-2 rounded-xl text-white font-bold text-sm hover:bg-[#4752c4]">Редактировать профиль</button>
                            </div>

                            <div className="bg-[#1E1F22] rounded-2xl p-6 border border-white/5 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Email</label>
                                    <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Новый пароль</label>
                                        <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Текущий пароль (для подтверждения)</label>
                                        <input type="password" value={currPass} onChange={e=>setCurrPass(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button onClick={saveAccount} className="bg-green-600 px-8 py-2.5 rounded-xl font-bold text-white shadow-lg hover:bg-green-500 transition-all">Сохранить изменения</button>
                            </div>
                        </>
                    )}

                    {activeTab === 'profile' && (
                        <>
                            <h2 className="text-xl font-black text-white mb-6">Профиль</h2>
                            <div className="bg-[#1E1F22] rounded-2xl overflow-hidden mb-8 border border-white/5">
                                <div style={{ backgroundColor: banner }} className="h-32 w-full relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><input type="color" className="cursor-pointer w-8 h-8 opacity-0 absolute" onChange={e=>setBanner(e.target.value)}/><div className="bg-black/50 p-1.5 rounded-lg backdrop-blur-sm"><Settings size={16} className="text-white"/></div></div>
                                </div>
                                <div className="px-6 pb-6 flex justify-between items-end -mt-10">
                                    <div className="flex items-end gap-4">
                                        <div className="relative group">
                                            <img src={file ? URL.createObjectURL(file) : user?.avatar} className="w-24 h-24 rounded-full border-[6px] border-[#1E1F22] bg-[#1E1F22] object-cover" alt="av" />
                                            <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer border-[6px] border-transparent transition-all"><Camera size={24} className="text-white"/><input type="file" hidden onChange={e=>setFile(e.target.files[0])}/></label>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 pt-0 grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Отображаемое имя</label>
                                        <input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">О себе</label>
                                        <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none h-[46px] resize-none" />
                                    </div>
                                </div>
                            </div>
                            
                            <h2 className="text-xl font-black text-white mb-4">Голос и видео</h2>
                            <div className="bg-[#1E1F22] p-6 rounded-2xl mb-8 border border-white/5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-gray-200">Шумоподавление</h4>
                                        <p className="text-xs text-gray-400 mt-1">Убирает фоновый шум из вашего микрофона.</p>
                                    </div>
                                    <div onClick={()=>setNoise(!noise)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${noise ? 'bg-green-500' : 'bg-gray-500'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${noise ? 'translate-x-6' : 'translate-x-0'}`}/>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-4">
                                <button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-sm">Отмена</button>
                                <button onClick={saveProfile} className="bg-[#5865F2] px-8 py-2.5 rounded-xl font-bold text-white shadow-lg hover:bg-[#4752c4] transition-all">Сохранить</button>
                            </div>
                        </>
                    )}
                 </div>
             </motion.div>
        </div>
    );
}

function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Login State
  const [loginData, setLoginData] = useState({ login: '', password: '' });
  
  // Register State
  const [regData, setRegData] = useState({ email: '', displayName: '', username: '', password: '', day: '', month: '', year: '' });
  const [usernameStatus, setUsernameStatus] = useState(null); // 'checking', 'free', 'taken'
  
  const [error, setError] = useState("");

  // Debounce username check
  useEffect(() => {
      if(isLogin || !regData.username) return;
      const timeout = setTimeout(async () => {
          setUsernameStatus('checking');
          try {
             const res = await axios.post(`${SERVER_URL}/api/check-username`, { username: regData.username });
             setUsernameStatus(res.data.available ? 'free' : 'taken');
          } catch(e) {}
      }, 500);
      return () => clearTimeout(timeout);
  }, [regData.username, isLogin]);

  const handleLogin = async () => {
      try {
          const res = await axios.post(`${SERVER_URL}/api/login`, loginData);
          onAuth(res.data);
      } catch(e) { setError(e.response?.data?.error || "Ошибка входа"); }
  };

  const handleRegister = async () => {
      try {
          if(usernameStatus !== 'free') return setError("Имя пользователя занято");
          const res = await axios.post(`${SERVER_URL}/api/register`, { ...regData, dob: { day: regData.day, month: regData.month, year: regData.year } });
          onAuth(res.data);
      } catch(e) { setError(e.response?.data?.error || "Ошибка регистрации"); }
  };

  // Компоненты формы
  const Input = ({ label, value, onChange, type="text", required=false, errorMsg }) => (
      <div className="mb-4">
          <label className={`block text-xs font-bold uppercase mb-2 ${errorMsg ? 'text-red-400' : 'text-gray-400'}`}>{label} {required && <span className="text-red-400">*</span>} {errorMsg && <span className="italic normal-case ml-1">- {errorMsg}</span>}</label>
          <input type={type} value={value} onChange={onChange} className="w-full bg-[#1e1f22] p-2.5 rounded text-white outline-none focus:bg-[#1e1f22] text-sm h-10 transition-colors" />
      </div>
  );

  return (
    <div className="h-screen flex items-center justify-center relative bg-[#313338] overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://discord.com/assets/843b08e5830058e3789a24d9c79e6079.svg')] bg-cover opacity-100 z-0"></div>
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#313338] p-8 rounded-lg shadow-2xl w-full max-w-[480px] z-10 relative">
        {isLogin ? (
            // LOGIN FORM
            <>
                <h2 className="text-2xl font-bold text-white text-center mb-2">С возвращением!</h2>
                <p className="text-gray-400 text-center text-sm mb-6">Мы так рады видеть вас снова!</p>
                <Input label="Адрес электронной почты или имя пользователя" required value={loginData.login} onChange={e=>setLoginData({...loginData, login:e.target.value})}/>
                <Input label="Пароль" type="password" required value={loginData.password} onChange={e=>setLoginData({...loginData, password:e.target.value})}/>
                <div className="text-[#00A8FC] text-xs font-medium cursor-pointer mb-6 hover:underline">Забыли пароль?</div>
                <button onClick={handleLogin} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-2.5 rounded transition-colors mb-2">Вход</button>
                <div className="text-xs text-gray-400 mt-2">Нужна учетная запись? <span onClick={()=>setIsLogin(false)} className="text-[#00A8FC] cursor-pointer hover:underline">Зарегистрироваться</span></div>
            </>
        ) : (
            // REGISTER FORM
            <div className="max-h-[80vh] overflow-y-auto no-scrollbar pr-2">
                <h2 className="text-2xl font-bold text-white text-center mb-6">Создать учетную запись</h2>
                <Input label="E-mail" required value={regData.email} onChange={e=>setRegData({...regData, email:e.target.value})}/>
                <Input label="Отображаемое имя" value={regData.displayName} onChange={e=>setRegData({...regData, displayName:e.target.value})}/>
                
                <div className="mb-4">
                    <label className={`block text-xs font-bold uppercase mb-2 ${usernameStatus==='taken'?'text-red-400':'text-gray-400'}`}>Имя пользователя <span className="text-red-400">*</span></label>
                    <input value={regData.username} onChange={e=>setRegData({...regData, username:e.target.value})} className="w-full bg-[#1e1f22] p-2.5 rounded text-white outline-none text-sm h-10 border border-transparent focus:border-black/0" />
                    {usernameStatus === 'free' && <p className="text-green-400 text-xs mt-1">Супер! Это имя пользователя свободно.</p>}
                    {usernameStatus === 'taken' && <p className="text-red-400 text-xs mt-1">Имя занято.</p>}
                </div>

                <Input label="Пароль" type="password" required value={regData.password} onChange={e=>setRegData({...regData, password:e.target.value})}/>
                
                <div className="mb-6">
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Дата рождения <span className="text-red-400">*</span></label>
                    <div className="flex gap-3">
                        <select className="bg-[#1e1f22] text-gray-300 p-2 rounded w-1/3 outline-none text-sm" onChange={e=>setRegData({...regData, day:e.target.value})}><option>День</option>{[...Array(31)].map((_,i)=><option key={i}>{i+1}</option>)}</select>
                        <select className="bg-[#1e1f22] text-gray-300 p-2 rounded w-1/3 outline-none text-sm" onChange={e=>setRegData({...regData, month:e.target.value})}><option>Месяц</option>{["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"].map(m=><option key={m}>{m}</option>)}</select>
                        <select className="bg-[#1e1f22] text-gray-300 p-2 rounded w-1/3 outline-none text-sm" onChange={e=>setRegData({...regData, year:e.target.value})}><option>Год</option>{[...Array(50)].map((_,i)=><option key={i}>{2024-i}</option>)}</select>
                    </div>
                </div>

                <button onClick={handleRegister} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-2.5 rounded transition-colors">Продолжить</button>
                <div className="text-xs text-[#00A8FC] mt-4 cursor-pointer hover:underline" onClick={()=>setIsLogin(true)}>Уже зарегистрированы? Войти</div>
            </div>
        )}
        {error && <div className="mt-4 bg-red-500/10 border border-red-500 text-white p-2 rounded text-xs text-center font-bold flex items-center justify-center gap-2"><AlertCircle size={14}/> {error}</div>}
      </motion.div>
    </div>
  );
}