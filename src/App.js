import React, { useState, useEffect, useRef, useCallback, createContext } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, Navigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'peerjs';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import EmojiPicker from 'emoji-picker-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Virtuoso } from 'react-virtuoso';
import imageCompression from 'browser-image-compression';
import { 
  Users, MessageSquare, Check, X, Settings, Mic, MicOff, 
  Monitor, Send, Phone, PhoneOff, Video, VideoOff, Plus, 
  Menu, Camera, Smile, Reply, Hash, LogOut, Minus, Square, 
  Trash, LogOut as LeaveIcon, Link as LinkIcon, Maximize, Minimize, 
  AlertCircle, ChevronDown, ChevronUp, Paperclip, Edit2, Volume2, Crown, 
  DownloadCloud, RefreshCw, Power, Pin, Music, Keyboard, Search, File, Play, Pause, StopCircle, Copy, MoreVertical,
  ArrowUpCircle, Loader2, Headphones, VolumeX, Shield, Wifi, WifiOff
} from 'lucide-react';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const SERVER_URL = "https://talkspace-7fwq.onrender.com"; 
const socket = io(SERVER_URL);
const PEER_CONFIG = { host: '0.peerjs.com', port: 443, secure: true };

const msgSound = new Audio("./sounds/message.mp3");
const callSound = new Audio("./sounds/call.mp3");
callSound.loop = true;

const SOUNDS = ['bruh', 'airhorn', 'vine-boom', 'cricket', 'anime-wow'];
const ThemeContext = createContext();

const LOADING_FACTS = [
    "Используйте **жирный текст** для акцента.",
    "Зажмите микрофон для голосового сообщения.",
    "Перетащите файл в окно чата для отправки.",
    "Блоки кода ```js code ``` подсвечиваются.",
    "Нажмите правой кнопкой на сообщение для действий."
];

// --- STYLES ---
const GlobalStyles = () => (
    <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #111; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #444; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .code-block { font-family: 'Consolas', monospace; font-size: 13px; }
        .mention { background: rgba(88, 101, 242, 0.3); color: #dee0fc; padding: 0 2px; border-radius: 3px; font-weight: 500; cursor: pointer; }
        .hover-tooltip:hover::after {
            content: attr(data-tooltip);
            position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
            background: #000; color: #fff; padding: 4px 8px; font-size: 10px; border-radius: 4px;
            white-space: nowrap; margin-bottom: 8px; z-index: 100; pointer-events: none;
        }
        .highlight-msg { background-color: rgba(250, 166, 26, 0.1) !important; border-left: 2px solid #FAA61A; }
        @keyframes move-twink-back { from {background-position:0 0;} to {background-position:-10000px 5000px;} }
        .stars, .twinkling { position:absolute; top:0; left:0; right:0; bottom:0; width:100%; height:100%; display:block; }
        .stars { background:#000 url(http://www.script-tutorials.com/demos/360/images/stars.png) repeat top center; z-index:0; }
        .twinkling{ background:transparent url(http://www.script-tutorials.com/demos/360/images/twinkling.png) repeat top center; z-index:1; animation:move-twink-back 200s linear infinite; opacity: 0.3; }
    `}</style>
);

const StatusDot = ({ status, size = "w-3 h-3" }) => {
    const color = status === 'online' ? 'bg-green-500' : status === 'dnd' ? 'bg-red-500' : status === 'idle' ? 'bg-yellow-500' : 'bg-gray-500';
    return <div className={`${size} rounded-full ${color} border-[2px] border-[#000] absolute -bottom-0.5 -right-0.5`} />;
};

const BackgroundEffect = () => (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none bg-black">
        <div className="stars"></div>
        <div className="twinkling"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/90 z-10"/>
    </div>
);

function TitleBar() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
      const setTrue = () => setOnline(true); const setFalse = () => setOnline(false);
      window.addEventListener('online', setTrue); window.addEventListener('offline', setFalse);
      return () => { window.removeEventListener('online', setTrue); window.removeEventListener('offline', setFalse); };
  }, []);
  if (!ipcRenderer) return null;
  return (
    <div className="h-8 bg-black/80 backdrop-blur-md flex items-center justify-between select-none w-full border-b border-white/10 z-[9999] fixed top-0 left-0 right-0 drag-region">
       <div className="flex items-center gap-2 px-3 no-drag">
           <div className="w-3 h-3 bg-[var(--primary)] rounded-full flex items-center justify-center font-black text-[6px] text-white shadow-[0_0_10px_var(--primary)]">T</div>
           <span className="text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase">TalkSpace</span>
           <div className="h-3 w-[1px] bg-white/10 mx-1"/>
           {online ? <Wifi size={10} className="text-green-500"/> : <WifiOff size={10} className="text-red-500"/>}
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

const Input = ({ label, value, onChange, type="text", required=false, errorMsg, className }) => (
    <div className={`mb-4 ${className}`}>
        <label className={`block text-[11px] font-bold uppercase mb-1.5 tracking-wide ${errorMsg ? 'text-red-400' : 'text-gray-400'}`}>
            {label} {required && <span className="text-red-400">*</span>} 
            {errorMsg && <span className="italic normal-case ml-1 font-medium">- {errorMsg}</span>}
        </label>
        <input type={type} value={value} onChange={onChange} className="w-full bg-[#111] border border-white/10 focus:border-[var(--primary)] p-2.5 rounded-[3px] text-white outline-none text-sm h-10 transition-all font-medium" />
    </div>
);

const CustomSelect = ({ options, value, onChange, placeholder, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    return (
        <div className={`relative w-full ${className}`} ref={ref}>
            <div onClick={() => setIsOpen(!isOpen)} className={`w-full bg-[#111] border border-white/10 p-2.5 rounded-[3px] text-white text-sm h-10 flex items-center justify-between cursor-pointer hover:border-[var(--primary)] transition-colors ${isOpen ? 'rounded-b-none border-b-0' : ''}`}>
                <span className={`${!value ? 'text-gray-500' : 'text-white'} truncate`}>{value || placeholder}</span>
                {isOpen ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 bg-[#050505] border border-white/10 border-t-0 max-h-48 overflow-y-auto z-50 rounded-b-[3px] shadow-xl custom-scrollbar">
                    {options.map((opt, i) => {
                         const val = typeof opt === 'object' ? opt.value : opt;
                         const label = typeof opt === 'object' ? opt.label : opt;
                         return (
                            <div key={i} onClick={() => { onChange(val); setIsOpen(false); }} className="p-2 text-sm text-gray-300 hover:bg-[var(--primary)] hover:text-white cursor-pointer transition-colors flex items-center justify-between">
                                <span>{label}</span>
                                {value === val && <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><Check size={10} className="text-black font-bold"/></div>}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

const Lightbox = ({ src, onClose }) => {
    if (!src) return null;
    return (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center" onClick={onClose}>
            <img src={src} className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl rounded-lg" onClick={e => e.stopPropagation()} alt="full"/>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300"><X size={32}/></button>
        </div>
    )
}

function LoadingScreen() {
    const [fact, setFact] = useState(LOADING_FACTS[0]);
    useEffect(() => { setFact(LOADING_FACTS[Math.floor(Math.random() * LOADING_FACTS.length)]); }, []);
    return (
        <div className="fixed inset-0 bg-[#000] z-[9999] flex flex-col items-center justify-center text-center p-4">
            <GlobalStyles />
            <motion.div animate={{ rotate: 360, scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="w-20 h-20 bg-[var(--primary)] rounded-full mb-8 flex items-center justify-center shadow-[0_0_50px_rgba(88,101,242,0.8)]"><div className="text-white font-black text-3xl">T</div></motion.div>
            <h2 className="text-white font-bold text-lg mb-2 uppercase tracking-widest">TalkSpace</h2>
            <p className="text-gray-500 text-xs tracking-widest animate-pulse mb-6">ESTABLISHING CONNECTION</p>
            <p className="text-gray-600 text-xs mt-8 max-w-md">💡 {fact}</p>
        </div>
    )
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('accentColor') || '#5865F2');
  
  // Update states
  const [updateInfo, setUpdateInfo] = useState({ status: 'latest', version: '' });
  const [downloadedVersion, setDownloadedVersion] = useState(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(localStorage.getItem('autoUpdate') !== 'false');
  const [newBadge, setNewBadge] = useState(null); 

  useEffect(() => {
      document.documentElement.style.setProperty('--primary', primaryColor);
      
      if (ipcRenderer) {
          // Listen for update status
          ipcRenderer.on('update_status', (event, data) => setUpdateInfo(data));
          ipcRenderer.on('update_downloaded', (event, version) => setDownloadedVersion(version));
          
          // Apply initial auto-download setting
          ipcRenderer.send('set-auto-download', autoUpdateEnabled);
      }
      
      socket.on('profile_updated', (data) => { if(user && data.userId === user._id) setUser(data.user); });
      socket.on('sound_played', (sound) => { new Audio(`./sounds/${sound}.mp3`).play().catch(e => console.log(e)); });
      
      const checkAuth = async () => {
          if (!token) { setLoading(false); return; }
          try {
              const res = await axios.get(`${SERVER_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
              setUser(res.data.user);
              if(res.data.newBadge) setNewBadge(res.data.newBadge);
              setTimeout(() => setLoading(false), 1000); 
          } catch (e) { localStorage.clear(); setToken(null); setUser(null); setLoading(false); }
      };
      checkAuth();
      return () => { socket.off('sound_played'); socket.off('profile_updated'); };
  }, [token, primaryColor, autoUpdateEnabled, user?._id]);

  const handleAuth = (data) => {
    localStorage.setItem('token', data.token); setToken(data.token); setUser(data.user); setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };
  const logout = () => { localStorage.clear(); setToken(null); setUser(null); };

  if (loading) return <LoadingScreen />;

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor }}>
        <GlobalStyles />
        <Router>
        <div className="bg-[#0B0B0C] text-white font-sans h-screen flex flex-col pt-8 selection:bg-[var(--primary)] selection:text-white overflow-hidden relative">
            <BackgroundEffect />
            <TitleBar />
            
            {newBadge && <BadgeModal badge={newBadge} onClose={()=>setNewBadge(null)} />}
            
            {/* ВСПЛЫВАЮЩЕЕ УВЕДОМЛЕНИЕ ОБ ОБНОВЛЕНИИ */}
            <AnimatePresence>
                {downloadedVersion && (
                    <motion.div initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -100, opacity: 0 }} className="fixed bottom-6 left-6 z-[9999] bg-[#23a559] p-4 rounded-xl shadow-2xl border border-white/20 w-72">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-white/20 rounded-lg"><DownloadCloud size={20} className="text-white"/></div>
                            <div>
                                <h4 className="font-bold text-white text-sm">Обновление готово!</h4>
                                <p className="text-[11px] text-white opacity-80 mb-3">Версия {downloadedVersion} скачана и ждет установки.</p>
                                <button onClick={() => ipcRenderer.send('restart_app')} className="bg-white text-[#23a559] w-full py-2 rounded-lg text-[10px] font-black uppercase hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                                    <RefreshCw size={12}/> Перезагрузить сейчас
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 overflow-hidden relative z-10">
                <Routes>
                    <Route path="/login" element={!token ? <Auth onAuth={handleAuth} /> : <Navigate to="/friends" />} />
                    <Route path="/*" element={token && user ? <MainLayout user={user} setUser={setUser} onLogout={logout} updateInfo={updateInfo} autoUpdateEnabled={autoUpdateEnabled} setAutoUpdateEnabled={setAutoUpdateEnabled} /> : <Navigate to="/login" />} />
                </Routes>
            </div>
        </div>
        </Router>
    </ThemeContext.Provider>
  );
}

function MainLayout({ user, setUser, onLogout, updateInfo, autoUpdateEnabled, setAutoUpdateEnabled }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSettings, setShowSettings] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const [createSeverModal, setCreateServerModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); 
  const [noiseSuppression, setNoiseSuppression] = useState(localStorage.getItem('noiseSuppression') === 'true');
  const [pttKey, setPttKey] = useState(localStorage.getItem('pttKey') || 'Space');
  const [pttEnabled, setPttEnabled] = useState(localStorage.getItem('pttEnabled') === 'true');
  const [selectedMic, setSelectedMic] = useState(localStorage.getItem('selectedMic') || '');
  const [selectedCam, setSelectedCam] = useState(localStorage.getItem('selectedCam') || '');
  
  const [micMuted, setMicMuted] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/api/me`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setUser(res.data.user);
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

  const getHeader = () => {
      if(location.pathname.includes('/friends')) return 'Друзья';
      if(location.pathname.includes('/chat')) return 'Личные сообщения';
      if(location.pathname.includes('/server')) {
          const sId = location.pathname.split('/')[2];
          const s = user?.servers?.find(serv => serv._id === sId);
          return s ? s.name : 'Сервер';
      }
      return 'TalkSpace';
  };

  return (
    <div className="relative flex h-full z-10 overflow-hidden" onClick={()=>setContextMenu(null)}>
      {/* SERVER LIST */}
      <div className="w-[72px] flex flex-col items-center py-3 gap-3 bg-[#050505] border-r border-white/5 shrink-0 z-20 overflow-y-auto no-scrollbar">
        <div onClick={() => navigate('/friends')} className="relative w-12 h-12 bg-[#111] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 group shadow-md text-gray-200">
          <MessageSquare size={24} className="group-hover:text-white" />
          {user?.requests?.length > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center border-[2px] border-[#000] text-[10px] font-black text-white shadow-lg scale-100 animate-bounce">{user.requests.length}</div>}
        </div>
        <div className="w-8 h-[2px] bg-white/10 rounded-full" />
        {user?.servers?.map(s => (
            <div key={s._id} onClick={() => navigate(`/server/${s._id}`)} onContextMenu={(e) => {e.preventDefault(); setContextMenu({x: e.clientX, y: e.clientY, type: 'server', data: s})}} className="w-12 h-12 bg-[#111] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 text-white font-bold uppercase shadow-md relative select-none text-xs overflow-hidden border-none group">
                {s.icon ? <img src={s.icon} alt="s" className="w-full h-full object-cover"/> : s.name.substring(0, 2)}
            </div>
        ))}
        <button onClick={() => setCreateServerModal(true)} className="w-12 h-12 bg-[#111] text-green-500 hover:bg-green-600 hover:text-white rounded-[24px] hover:rounded-[16px] transition-all flex items-center justify-center shadow-md group"><Plus size={24} /></button>
      </div>

      {/* SIDEBAR */}
      <div className="w-60 bg-[#111] flex flex-col shrink-0 z-20 border-r border-white/5">
         <div className="h-12 flex items-center px-4 font-black text-white border-b border-white/5 shadow-sm select-none bg-[#111] text-sm truncate uppercase tracking-wide">
            {getHeader()}
         </div>
         <Routes>
             <Route path="/friends" element={<DMSidebar user={user} navigate={navigate} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} micMuted={micMuted} setMicMuted={setMicMuted} soundMuted={soundMuted} setSoundMuted={setSoundMuted}/>} />
             <Route path="/chat/*" element={<DMSidebar user={user} navigate={navigate} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} micMuted={micMuted} setMicMuted={setMicMuted} soundMuted={soundMuted} setSoundMuted={setSoundMuted}/>} />
             <Route path="/server/:serverId" element={<ServerSidebar user={user} navigate={navigate} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} micMuted={micMuted} setMicMuted={setMicMuted} soundMuted={soundMuted} setSoundMuted={setSoundMuted} setViewProfile={setViewProfile}/>} />
         </Routes>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col bg-[#0B0B0C] relative min-w-0 z-10">
        <Routes>
          <Route path="/friends" element={<FriendsView user={user} refresh={refresh} />} />
          <Route path="/chat/:friendId" element={<ChatView user={user} noiseSuppression={noiseSuppression} selectedMic={selectedMic} selectedCam={selectedCam} />} />
          <Route path="/server/:serverId" element={<ServerView user={user} noiseSuppression={noiseSuppression} pttEnabled={pttEnabled} pttKey={pttKey} selectedMic={selectedMic} setViewProfile={setViewProfile} />} />
          <Route path="*" element={<Navigate to="/friends" />} />
        </Routes>
      </div>

      {contextMenu && <GlobalContextMenu menu={contextMenu} user={user} refresh={refresh} navigate={navigate} close={()=>setContextMenu(null)} />}
      {viewProfile && <UserProfileModal user={viewProfile} onClose={()=>setViewProfile(null)} />}

      <AnimatePresence>
        {showSettings && <SettingsModal user={user} setUser={setUser} onClose={() => setShowSettings(false)} onLogout={onLogout} noise={noiseSuppression} setNoise={setNoiseSuppression} ptt={pttEnabled} setPtt={setPttEnabled} pttKey={pttKey} setPttKey={setPttKey} selectedMic={selectedMic} setSelectedMic={setSelectedMic} selectedCam={selectedCam} setSelectedCam={setSelectedCam} updateInfo={updateInfo} autoUpdateEnabled={autoUpdateEnabled} setAutoUpdateEnabled={setAutoUpdateEnabled} />}
        {createSeverModal && <CreateServerModal user={user} onClose={() => setCreateServerModal(false)} refresh={refresh} />}
      </AnimatePresence>
    </div>
  );
}

// --- SIDEBAR & PANELS ---
const UserPanel = ({ user, setShowSettings, statusMenu, setStatusMenu, updateStatus, micMuted, setMicMuted, soundMuted, setSoundMuted }) => (
    <div className="bg-[#0B0C0E] p-1.5 relative select-none flex items-center gap-1 border-t border-white/5">
       <AnimatePresence>
        {statusMenu && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: -10, opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-full left-2 w-56 bg-[#111] border border-white/10 rounded-lg p-2 shadow-2xl z-50 mb-2">
             <button onClick={() => updateStatus('online')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-green-500 rounded-full"/> В сети</button>
             <button onClick={() => updateStatus('dnd')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-red-500 rounded-full"/> Не беспокоить</button>
             <button onClick={() => updateStatus('idle')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"/> Спит</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2 p-1 rounded hover:bg-[#222] cursor-pointer transition-colors flex-1 group" onClick={(e) => {if(!e.target.closest('.icons')) setStatusMenu(!statusMenu)}}>
          <div className="relative"><img src={user?.avatar} className="w-8 h-8 rounded-full object-cover bg-zinc-800" alt="me" /><StatusDot status={user.status} /></div>
          <div className="flex-1 overflow-hidden leading-tight relative h-8">
              <div className="absolute top-0 left-0 transition-all duration-300 group-hover:-top-8">
                  <p className="text-xs font-bold text-white truncate">{user?.displayName}</p>
                  <p className="text-[11px] text-[#DBDEE1]">{user?.status}</p>
              </div>
              <div className="absolute top-8 left-0 transition-all duration-300 group-hover:top-1.5">
                  <p className="text-xs font-bold text-white">@{user?.username}</p>
              </div>
          </div>
      </div>
      <div className="flex gap-1 icons">
        <button className={`p-1.5 hover:bg-[#222] rounded relative group ${micMuted ? 'text-red-500' : 'text-gray-200'}`} onClick={()=>setMicMuted(!micMuted)}>
            {micMuted ? <MicOff size={18}/> : <Mic size={18}/>}
        </button>
        <button className={`p-1.5 hover:bg-[#222] rounded relative group ${soundMuted ? 'text-red-500' : 'text-gray-200'}`} onClick={()=>setSoundMuted(!soundMuted)}>
            {soundMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
        </button>
        <button className="p-1.5 hover:bg-[#222] rounded text-gray-200 relative group" onClick={()=>setShowSettings(true)}>
            <Settings size={18}/>
        </button>
      </div>
    </div>
);

const DMSidebar = ({ user, navigate, setShowSettings, statusMenu, setStatusMenu, updateStatus, micMuted, setMicMuted, soundMuted, setSoundMuted }) => (
    <>
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto custom-scrollbar">
          <button onClick={() => navigate('/friends')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] transition-all ${window.location.hash.includes('/friends') ? 'bg-[#333] text-white' : 'text-[#949BA4] hover:bg-[#222] hover:text-[#DBDEE1]'}`}>
            <Users size={20} /> <span className="text-[15px] font-medium">Друзья</span>
          </button>
          <div className="mt-4 mb-1 px-3 text-[11px] font-bold text-[#949BA4] uppercase tracking-wide flex items-center justify-between select-none"><span>Личные сообщения</span> <Plus size={14} className="cursor-pointer"/></div>
          {user?.chats?.map(c => {
            const f = c.members.find(m => m._id !== user._id); if (!f) return null;
            return (
              <div key={c._id} onClick={() => navigate(`/chat/${f._id}`)} className={`flex items-center gap-3 px-2 py-2 rounded-[4px] cursor-pointer transition-all group ${window.location.hash.includes(f._id) ? 'bg-[#333] text-white' : 'hover:bg-[#222] text-[#949BA4]'}`}>
                <div className="relative"><img src={f.avatar} className="w-8 h-8 rounded-full object-cover" alt="av" /><StatusDot status={f.status} /></div>
                <div className="flex-1 overflow-hidden leading-tight"><p className="truncate text-[15px] font-medium group-hover:text-[#DBDEE1] transition-colors">{f.displayName}</p></div>
              </div>
            );
          })}
        </div>
        <UserPanel user={user} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} micMuted={micMuted} setMicMuted={setMicMuted} soundMuted={soundMuted} setSoundMuted={setSoundMuted}/>
    </>
);

const ServerSidebar = ({ user, navigate, setShowSettings, statusMenu, setStatusMenu, updateStatus, micMuted, setMicMuted, soundMuted, setSoundMuted, setViewProfile }) => {
    const { serverId } = useParams(); const activeServer = user?.servers?.find(s => s._id === serverId); const members = activeServer?.members || [];
    return (
    <>
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="mb-4">
                {activeServer?.channels?.map(ch => (
                    <div key={ch._id} onClick={() => navigate(`/server/${serverId}?channel=${ch._id}`)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] cursor-pointer transition-colors ${window.location.search.includes(ch._id) ? 'bg-[#333] text-white' : 'text-[#949BA4] hover:bg-[#222] hover:text-[#DBDEE1]'}`}>
                        {ch.type === 'voice' ? <Volume2 size={18}/> : <Hash size={18}/>}
                        <span className="font-medium text-[15px]">{ch.name}</span>
                    </div>
                ))}
            </div>
            <div className="h-[1px] bg-white/5 my-2"/><div className="px-2 pb-2 text-[11px] font-bold text-gray-500 uppercase">Участники — {members.length}</div>
            {members.map(m => (
                 <div key={m._id} onClick={() => setViewProfile(m)} className="flex items-center gap-2 px-2 py-1.5 rounded-[4px] hover:bg-[#222] cursor-pointer group opacity-90 hover:opacity-100 transition-all">
                    <div className="relative"><img src={m.avatar} className="w-8 h-8 rounded-full object-cover" alt="av"/><StatusDot status={m.status}/></div>
                    <div className="flex-1 overflow-hidden leading-tight">
                        <p className={`text-sm font-medium truncate ${m._id === activeServer.owner ? 'text-yellow-400' : 'text-gray-300'}`}>{m.displayName} {m._id === activeServer.owner && <Crown size={10} className="inline"/>}</p>
                    </div>
                 </div>
            ))}
        </div>
        <UserPanel user={user} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} micMuted={micMuted} setMicMuted={setMicMuted} soundMuted={soundMuted} setSoundMuted={setSoundMuted}/>
    </>
    );
};

// --- SETTINGS MODAL WITH UPDATES ---
function SettingsModal({ user, setUser, onClose, onLogout, noise, setNoise, ptt, setPtt, pttKey, setPttKey, selectedMic, setSelectedMic, selectedCam, setSelectedCam, updateInfo, autoUpdateEnabled, setAutoUpdateEnabled }) {
    const [activeTab, setActiveTab] = useState('account'); 
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [username, setUsername] = useState(user?.username || "");
    const [email, setEmail] = useState(user?.email || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [banner, setBanner] = useState(user?.bannerColor || "#000000");
    const [file, setFile] = useState(null);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [keyWait, setKeyWait] = useState(false);
    const [audioDevices, setAudioDevices] = useState([]);
    const [videoDevices, setVideoDevices] = useState([]);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(devices => {
            setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
            setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        });
        if(keyWait) {
            const h = (e) => { e.preventDefault(); setPttKey(e.code); setKeyWait(false); localStorage.setItem('pttKey', e.code); }
            window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
        }
    }, [keyWait, setPttKey]);

    const saveChanges = async () => {
        const fd = new FormData();
        fd.append('userId', user._id); fd.append('displayName', displayName);
        fd.append('username', username); fd.append('email', email);
        fd.append('bio', bio); fd.append('bannerColor', banner);
        if (file) fd.append('avatar', file);
        if (newPassword) fd.append('password', newPassword);
        if (email !== user.email || username !== user.username || newPassword) {
            if(!currentPassword) return alert("Нужен текущий пароль!"); fd.append('currentPassword', currentPassword);
        }
        try {
            const res = await axios.post(`${SERVER_URL}/api/update-profile`, fd);
            setUser(res.data); alert("Сохранено!");
        } catch(e) { alert(e.response?.data?.error || "Ошибка"); }
    };

    const toggleAutoUpdate = () => {
        const newVal = !autoUpdateEnabled;
        setAutoUpdateEnabled(newVal);
        localStorage.setItem('autoUpdate', newVal);
        if(ipcRenderer) ipcRenderer.send('set-auto-download', newVal);
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose}/>
            <motion.div initial={{scale:0.95, opacity: 0}} animate={{scale:1, opacity: 1}} className="bg-black/80 backdrop-blur-xl w-full max-w-4xl h-[85vh] rounded-[20px] flex overflow-hidden shadow-2xl border border-white/10 z-50 relative">
                <div className="w-64 bg-[#111]/50 border-r border-white/5 p-6 pt-10">
                    <p className="uppercase text-[10px] font-bold text-gray-500 px-2 mb-4 tracking-widest">Настройки</p>
                    <div onClick={()=>setActiveTab('account')} className={`px-3 py-2 rounded-lg text-sm font-medium mb-1 cursor-pointer transition-all ${activeTab==='account' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>Аккаунт</div>
                    <div onClick={()=>setActiveTab('profile')} className={`px-3 py-2 rounded-lg text-sm font-medium mb-1 cursor-pointer transition-all ${activeTab==='profile' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>Профиль</div>
                    <div onClick={()=>setActiveTab('voice')} className={`px-3 py-2 rounded-lg text-sm font-medium mb-1 cursor-pointer transition-all ${activeTab==='voice' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>Голос и Видео</div>
                    <div onClick={()=>setActiveTab('updates')} className={`px-3 py-2 rounded-lg text-sm font-medium mb-1 cursor-pointer transition-all flex items-center justify-between ${activeTab==='updates' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}>Обновления {updateInfo.status === 'available' && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/>}</div>
                    <div className="h-[1px] bg-white/10 my-4 mx-2"/><div onClick={onLogout} className="text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between">Выйти <LogOut size={16}/></div>
                </div>

                <div className="flex-1 p-10 overflow-y-auto relative custom-scrollbar">
                    <div onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"><X size={24}/></div>

                    {activeTab === 'account' && (
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-6">Моя учетная запись</h2>
                            <div className="bg-[#111] rounded-xl p-6 border border-white/5 mb-6 relative overflow-hidden flex items-center gap-6">
                                <div className="relative"><img src={user?.avatar} className="w-20 h-20 rounded-full bg-[#222] object-cover border-4 border-[#111]" alt="av"/><StatusDot status={user.status} size="w-5 h-5"/></div>
                                <div><h3 className="text-xl font-bold text-white">{user?.displayName}</h3><p className="text-sm text-gray-400">@{user?.username}</p></div>
                                <button onClick={()=>setActiveTab('profile')} className="ml-auto bg-[var(--primary)] px-6 py-2 rounded text-white font-bold text-sm hover:opacity-80">Изменить профиль</button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className="max-w-xl">
                            <h2 className="text-2xl font-bold text-white mb-6">Профиль</h2>
                            <div className="bg-[#111] rounded-xl overflow-hidden mb-8 border border-white/5">
                                <div style={{ backgroundColor: banner }} className="h-24 w-full relative">
                                    <input type="color" className="cursor-pointer w-8 h-8 opacity-0 absolute top-2 right-2" onChange={e=>setBanner(e.target.value)}/>
                                    <div className="absolute top-2 right-2 bg-black/50 p-1 rounded pointer-events-none"><Edit2 size={14} className="text-white"/></div>
                                </div>
                                <div className="p-6 pt-2 space-y-4">
                                    <Input label="Отображаемое имя" value={displayName} onChange={e=>setDisplayName(e.target.value)}/>
                                    <textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-[#050505] border border-white/10 p-2.5 rounded text-white text-sm outline-none h-24 resize-none" placeholder="О себе..."/>
                                    <div className="h-[1px] bg-white/5 my-4"/><Input label="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
                                    <Input label="Новый пароль" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}/>
                                    <Input label="Текущий пароль (Для подтверждения)" type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/>
                                </div>
                            </div>
                            <button onClick={saveChanges} className="bg-green-600 px-6 py-2 rounded text-white font-bold text-sm hover:opacity-80 float-right">Сохранить</button>
                        </div>
                    )}

                    {activeTab === 'voice' && (
                        <div className="max-w-xl">
                            <h2 className="text-2xl font-bold text-white mb-6">Голос и Видео</h2>
                            <div className="space-y-6">
                                <div><label className="block text-[11px] font-bold uppercase mb-1.5 text-gray-400">Микрофон</label><CustomSelect value={audioDevices.find(d => d.deviceId === selectedMic)?.label || "По умолчанию"} options={audioDevices.map(d => ({ label: d.label, value: d.deviceId }))} onChange={(v)=>{setSelectedMic(v); localStorage.setItem('selectedMic', v)}} /></div>
                                <div className="flex items-center justify-between"><div><h4 className="font-bold text-gray-200">Шумоподавление</h4><p className="text-xs text-gray-400">Убирает фоновый шум.</p></div><div onClick={()=>setNoise(!noise)} className={`w-12 h-6 rounded-full p-1 cursor-pointer ${noise ? 'bg-green-500' : 'bg-gray-500'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform ${noise ? 'translate-x-6' : 'translate-x-0'}`}/></div></div>
                                <div className="flex items-center justify-between"><div><h4 className="font-bold text-gray-200">Push-to-Talk</h4><p className="text-xs text-gray-400">Микрофон по клавише.</p></div><div onClick={()=>{setPtt(!ptt); localStorage.setItem('pttEnabled', !ptt)}} className={`w-12 h-6 rounded-full p-1 cursor-pointer ${ptt ? 'bg-green-500' : 'bg-gray-500'}`}><div className={`w-4 h-4 bg-white rounded-full transition-transform ${ptt ? 'translate-x-6' : 'translate-x-0'}`}/></div></div>
                                {ptt && <div className="flex items-center gap-4 bg-black/30 p-2 rounded"><span className="text-sm font-bold text-gray-400">Клавиша:</span><button onClick={()=>setKeyWait(true)} className="bg-[#404249] px-4 py-1 rounded text-white font-mono text-sm">{keyWait ? 'Нажмите...' : pttKey}</button></div>}
                            </div>
                        </div>
                    )}

                    {activeTab === 'updates' && (
                        <div className="max-w-xl">
                            <h2 className="text-2xl font-bold text-white mb-6">Обновления</h2>
                            <div className="bg-[#111] rounded-xl p-6 border border-white/5 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-white mb-1">Автоматическое обновление</h4>
                                        <p className="text-xs text-gray-500">Приложение будет само загружать новые версии в фоне.</p>
                                    </div>
                                    <div onClick={toggleAutoUpdate} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${autoUpdateEnabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${autoUpdateEnabled ? 'translate-x-6' : 'translate-x-0'}`}/>
                                    </div>
                                </div>
                                <div className="h-[1px] bg-white/5"/>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-white mb-1">Проверить наличие обновлений</h4>
                                        <p className="text-xs text-gray-400">Текущая версия: 1.1.4</p>
                                    </div>
                                    <button onClick={() => ipcRenderer.send('check-for-updates-manual')} className="bg-[var(--primary)] px-5 py-2 rounded font-bold text-sm hover:opacity-80 flex items-center gap-2">
                                        <RefreshCw size={16} className={updateInfo.status === 'checking' ? 'animate-spin' : ''}/> Проверить
                                    </button>
                                </div>

                                {updateInfo.status === 'available' && (
                                    <div className="bg-blue-600/20 border border-blue-500/50 p-4 rounded-lg flex items-center gap-4">
                                        <DownloadCloud className="text-blue-400"/>
                                        <div>
                                            <p className="text-sm font-bold text-blue-100">Найдена версия {updateInfo.version}</p>
                                            <p className="text-xs text-blue-200 opacity-70">Загрузка начнется автоматически.</p>
                                        </div>
                                    </div>
                                )}
                                {updateInfo.status === 'latest' && (
                                    <div className="text-center py-4">
                                        <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3"><Check className="text-green-500"/></div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">У вас установлена последняя версия</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

// --- BADGE & OTHER MODALS (OMITTED FOR BREVITY, BUT KEPT IN FULL FILE) ---
function BadgeModal({ badge, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{scale:0.8, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#111] p-8 rounded-2xl text-center border border-[var(--primary)] shadow-lg max-w-sm w-full" onClick={e=>e.stopPropagation()}>
                <div className="text-6xl mb-4">{badge.icon}</div><h2 className="text-2xl font-black text-white mb-2">Поздравляем!</h2>
                <p className="text-gray-400 text-sm mb-6">Вы получили значок: <span className="text-white font-bold">{badge.name}</span></p>
                <button onClick={onClose} className="bg-white text-black px-8 py-2 rounded-full font-bold">Круто!</button>
            </motion.div>
        </div>
    )
}

function UserProfileModal({ user, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4" onClick={onClose}>
            <motion.div initial={{scale:0.95, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#111] rounded-2xl w-full max-w-sm overflow-hidden border border-white/10 shadow-2xl relative" onClick={e=>e.stopPropagation()}>
                <div style={{ backgroundColor: user.bannerColor }} className="h-24 w-full"/>
                <div className="px-6 pb-6 -mt-10 relative">
                    <img src={user.avatar} className="w-20 h-20 rounded-full border-[6px] border-[#111] object-cover bg-[#111]" alt="av"/><StatusDot status={user.status} size="w-5 h-5"/>
                    <div className="mt-2"><h3 className="text-xl font-bold text-white">{user.displayName}</h3><p className="text-sm font-medium text-gray-400">@{user.username}</p></div>
                    {user.badges?.length > 0 && <div className="flex gap-2 mt-3 bg-[#000] p-2 rounded-lg border border-white/5">{user.badges.map((b, i) => <div key={i} className="text-lg">{b.icon}</div>)}</div>}
                    <div className="mt-4 bg-[#1E1F22] p-3 rounded-lg border border-white/5"><p className="text-sm text-gray-300">{user.bio || "Нет описания"}</p></div>
                </div>
            </motion.div>
        </div>
    )
}

function GlobalContextMenu({ menu, user, refresh, navigate, close }) {
    const { x, y, type, data, extra } = menu;
    const deleteS = async () => { if(window.confirm(`Удалить ${data.name}?`)) { await axios.post(`${SERVER_URL}/api/delete-server`, { serverId: data._id }); refresh(); close(); navigate('/friends'); }};
    const copyId = () => { if(navigator.clipboard) navigator.clipboard.writeText(data._id); close(); };
    return (
        <div style={{ top: y, left: x }} className="fixed bg-[#111] border border-black/50 rounded shadow-xl z-[9999] py-1.5 w-56 font-medium text-xs text-gray-300" onMouseLeave={close}>
            {type === 'server' && (
                <>
                    <button onClick={() => {navigator.clipboard.writeText(data._id); close()}} className="w-full text-left px-2 py-1.5 hover:bg-[#5865F2] hover:text-white">Пригласить</button>
                    {data.owner === user._id && <button onClick={deleteS} className="w-full text-left px-2 py-1.5 text-red-400 hover:bg-red-500 hover:text-white">Удалить сервер</button>}
                </>
            )}
            {type === 'message' && (
                <>
                    <button onClick={() => {extra.onReply(data); close()}} className="w-full text-left px-2 py-1.5 hover:bg-[#5865F2] hover:text-white">Ответить</button>
                    {data.senderId === user._id && <button onClick={() => {extra.onDelete(data._id); close()}} className="w-full text-left px-2 py-1.5 text-red-400 hover:bg-red-500">Удалить</button>}
                    <button onClick={copyId} className="w-full text-left px-2 py-1.5 hover:bg-[#5865F2] hover:text-white">Копировать ID</button>
                </>
            )}
        </div>
    )
}

// --- CHAT COMPONENTS ---
function ChatView({ user, noiseSuppression, selectedMic, selectedCam }) {
  const { friendId } = useParams(); const [activeChat, setActiveChat] = useState(null); const [messages, setMessages] = useState([]); const [typing, setTyping] = useState([]); const [replyTo, setReplyTo] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const friend = activeChat?.members?.find(m => m._id !== user._id);
  useEffect(() => {
    axios.post(`${SERVER_URL}/api/start-chat`, { myId: user._id, friendId }).then(res => { setActiveChat(res.data); setMessages(res.data.messages || []); socket.emit('join_chat', res.data._id); });
    socket.on('new_msg', (m) => { if(m.chatId === activeChat?._id) setMessages(p => [...p, m]); });
    socket.on('message_delete', (d) => setMessages(p => p.filter(m => m._id !== d.msgId)));
    return () => { socket.off('new_msg'); socket.off('message_delete'); };
  }, [user._id, friendId, activeChat?._id]);

  const handleSend = (text) => { socket.emit('send_msg', { chatId: activeChat._id, text, senderId: user._id, senderName: user.displayName, avatar: user.avatar, type: 'text', replyTo: replyTo ? { text: replyTo.text, senderName: replyTo.senderName } : null }); setReplyTo(null); };
  const handleDelete = (msgId) => axios.post(`${SERVER_URL}/api/message/delete`, { chatId: activeChat._id, msgId });
  const handleReact = (msgId, emoji) => axios.post(`${SERVER_URL}/api/message/react`, { chatId: activeChat._id, msgId, emoji, userId: user._id });

  if (!activeChat) return <div className="flex-1 flex items-center justify-center text-gray-500 animate-pulse">Загрузка...</div>;
  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0B0C]" onClick={()=>setCtxMenu(null)}>
      <div className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-[#111] z-20"><div className="flex items-center gap-3"><img src={friend?.avatar} className="w-8 h-8 rounded-full" alt="f" /><p className="font-bold text-white">{friend?.displayName}</p></div></div>
      <MessageList messages={messages} user={user} onReact={handleReact} onReply={setReplyTo} onContextMenu={(e, m) => setCtxMenu({x: e.clientX, y: e.clientY, type: 'message', data: m, extra: {onDelete: handleDelete, onReply: setReplyTo}})} />
      {replyTo && <div className="mx-4 bg-[#2B2D31] p-2 rounded-t flex justify-between items-center text-xs text-gray-300 border-l-4 border-[var(--primary)]"><span>Ответ {replyTo.senderName}</span><X size={14} className="cursor-pointer" onClick={()=>setReplyTo(null)}/></div>}
      <ChatInput onSend={handleSend} placeholder={`Написать @${friend?.displayName}`} />
      {ctxMenu && <GlobalContextMenu menu={ctxMenu} user={user} close={()=>setCtxMenu(null)} refresh={()=>{}} navigate={()=>{}} />}
    </div>
  );
}

function ServerView({ user, noiseSuppression, pttEnabled, pttKey, selectedMic, selectedCam, setViewProfile }) {
    const { serverId } = useParams(); const query = new URLSearchParams(window.location.search);
    const channelId = query.get('channel') || user?.servers?.find(s=>s._id===serverId)?.channels?.[0]?._id;
    const server = user?.servers?.find(s => s._id === serverId); const channel = server?.channels?.find(c => c._id === channelId);
    const [messages, setMessages] = useState([]); const [replyTo, setReplyTo] = useState(null); const [ctxMenu, setCtxMenu] = useState(null);

    useEffect(() => {
        if(serverId) axios.get(`${SERVER_URL}/api/server/${serverId}`).then(res => { const c = res.data.channels.find(ch => ch._id === channelId); if(c) setMessages(c.messages); });
        socket.emit('join_server_room', serverId);
        socket.on('new_server_msg', (m) => { if(m.channelId === channelId) setMessages(p => [...p, m]); });
        return () => { socket.off('new_server_msg'); };
    }, [serverId, channelId]);

    const handleSend = (text) => { socket.emit('send_msg', { serverId, channelId, text, senderId: user._id, senderName: user.displayName, avatar: user.avatar, replyTo: replyTo ? { text: replyTo.text, senderName: replyTo.senderName } : null }); setReplyTo(null); };
    const handleReact = (msgId, emoji) => axios.post(`${SERVER_URL}/api/message/react`, { serverId, channelId, msgId, emoji, userId: user._id });

    return (
        <div className="flex h-full bg-[#0B0B0C]" onClick={()=>setCtxMenu(null)}>
            <div className="flex-1 flex flex-col relative">
                <div className="h-12 border-b border-white/5 flex items-center px-4 font-bold text-white shadow-sm"><Hash size={20} className="mr-2 text-gray-500"/> {channel?.name}</div>
                <MessageList messages={messages} user={user} onReact={handleReact} onReply={setReplyTo} onContextMenu={(e, m) => setCtxMenu({x: e.clientX, y: e.clientY, type: 'message', data: m, extra: {onReply: setReplyTo}})} />
                {replyTo && <div className="mx-4 bg-[#2B2D31] p-2 rounded-t flex justify-between items-center text-xs text-gray-300 border-l-4 border-[var(--primary)]"><span>Ответ {replyTo.senderName}</span><X size={14} className="cursor-pointer" onClick={()=>setReplyTo(null)}/></div>}
                <ChatInput onSend={handleSend} placeholder={`Написать в #${channel?.name}`} />
            </div>
            {ctxMenu && <GlobalContextMenu menu={ctxMenu} user={user} close={()=>setCtxMenu(null)} refresh={()=>{}} navigate={()=>{}} />}
        </div>
    )
}

function FriendsView({ user, refresh }) {
    const [tab, setTab] = useState('all'); const [friendInput, setFriendInput] = useState(""); const navigate = useNavigate();
    const sendRequest = async () => { try { await axios.post(`${SERVER_URL}/api/friend-request`, { fromId: user._id, targetUsername: friendInput }); setFriendInput(""); alert("Запрос отправлен!"); } catch (e) { alert("Ошибка!"); } };
    return (
      <div className="flex flex-col h-full bg-[#0B0B0C]">
        <div className="h-12 flex items-center px-6 border-b border-white/5 gap-6"><div className="flex items-center gap-2 text-white font-bold"><Users size={20} /><span>Друзья</span></div><div className="h-6 w-[1px] bg-white/10"/>
        <div className="flex gap-2">
            <button onClick={() => setTab('all')} className={`px-2 py-0.5 rounded text-sm ${tab === 'all' ? 'bg-[#333] text-white' : 'text-[#B5BAC1] hover:bg-[#222]'}`}>Все ({user.friends?.length || 0})</button>
            <button onClick={() => setTab('pending')} className={`px-2 py-0.5 rounded text-sm ${tab === 'pending' ? 'bg-[#333] text-white' : 'text-[#B5BAC1] hover:bg-[#222]'}`}>Ожидание ({user.requests?.length || 0})</button>
            <button onClick={() => setTab('add')} className={`px-3 py-0.5 rounded text-sm bg-[#23A559] text-white`}>Добавить друга</button>
        </div></div>
        <div className="p-8">
          {tab === 'all' && user.friends?.map(f => <div key={f._id} onClick={() => navigate(`/chat/${f._id}`)} className="flex items-center gap-3 p-2 hover:bg-[#111] rounded cursor-pointer border-t border-white/5"><img src={f.avatar} className="w-8 h-8 rounded-full" alt="f"/><p className="font-bold text-white">{f.displayName}</p></div>)}
          {tab === 'add' && <div className="max-w-xl"><h3 className="text-white font-bold uppercase mb-2">Добавить друга</h3><div className="flex gap-2"><input value={friendInput} onChange={e=>setFriendInput(e.target.value)} className="flex-1 bg-[#111] p-2 rounded border border-white/10 outline-none" placeholder="Имя пользователя"/><button onClick={sendRequest} className="bg-[#5865F2] px-6 py-2 rounded font-bold">Отправить</button></div></div>}
          {tab === 'pending' && user.requests?.map(r => <div key={r.from} className="flex items-center justify-between p-3 bg-[#111] rounded mb-2"><div className="flex items-center gap-3"><img src={r.avatar} className="w-8 h-8 rounded-full" alt="r"/><p className="font-bold text-white">{r.displayName}</p></div><div className="flex gap-2"><button onClick={async () => {await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'accept' }); refresh();}} className="bg-green-600 p-1.5 rounded"><Check size={16}/></button></div></div>)}
        </div>
      </div>
    );
}

// --- SUB-COMPONENTS ---
function MessageList({ messages, user, onReact, onContextMenu, onReply }) {
    const bottomRef = useRef(); useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);
    return (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {messages.map((m, i) => (
                <div key={m._id || i} onContextMenu={e => onContextMenu(e, m)} className="group flex items-start gap-4 mb-4 hover:bg-black/20 p-1 rounded transition-all">
                    <img src={m.senderAvatar} className="w-10 h-10 rounded-full object-cover" alt="av"/>
                    <div className="flex-1">
                        <div className="flex items-center gap-2"><span className="font-bold text-white">{m.senderName}</span><span className="text-[10px] text-gray-500">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
                        {m.replyTo && <div className="text-[11px] text-gray-500 italic mb-1 border-l-2 border-gray-700 pl-2">Ответ @{m.replyTo.senderName}: {m.replyTo.text}</div>}
                        <div className="text-gray-300 text-sm whitespace-pre-wrap"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown></div>
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    )
}

function ChatInput({ onSend, placeholder }) {
    const [text, setText] = useState("");
    const handleSend = () => { if(text.trim()) { onSend(text); setText(""); } };
    return (
        <div className="p-4 bg-[#0B0B0C] flex gap-2 items-center">
            <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSend()} className="flex-1 bg-[#111] border border-white/5 p-2.5 rounded text-white outline-none" placeholder={placeholder} />
            <button onClick={handleSend} className="bg-[#5865F2] p-2.5 rounded text-white"><Send size={20}/></button>
        </div>
    )
}

// --- AUTH COMPONENT ---
function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true); const [data, setData] = useState({ login: '', password: '', email: '', displayName: '', username: '' });
  const handle = async () => {
    try {
        const url = isLogin ? '/api/login' : '/api/register';
        const res = await axios.post(`${SERVER_URL}${url}`, isLogin ? { login: data.login, password: data.password } : data);
        onAuth(res.data);
    } catch(e) { alert("Ошибка!"); }
  };
  return (
    <div className="h-screen flex items-center justify-center bg-black">
        <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-[#111] p-8 rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl">
            <h2 className="text-2xl font-black text-center mb-8 text-white tracking-widest">TALKSPACE</h2>
            {isLogin ? (
                <>
                    <Input label="Логин" value={data.login} onChange={e=>setData({...data, login:e.target.value})}/>
                    <Input label="Пароль" type="password" value={data.password} onChange={e=>setData({...data, password:e.target.value})}/>
                </>
            ) : (
                <>
                    <Input label="Email" value={data.email} onChange={e=>setData({...data, email:e.target.value})}/>
                    <Input label="Никнейм" value={data.displayName} onChange={e=>setData({...data, displayName:e.target.value})}/>
                    <Input label="ID Пользователя" value={data.username} onChange={e=>setData({...data, username:e.target.value})}/>
                    <Input label="Пароль" type="password" value={data.password} onChange={e=>setData({...data, password:e.target.value})}/>
                </>
            )}
            <button onClick={handle} className="w-full bg-white text-black font-bold py-3 rounded mt-4 mb-4 uppercase text-xs">{isLogin ? 'Войти' : 'Регистрация'}</button>
            <p className="text-center text-xs text-gray-500 cursor-pointer hover:underline" onClick={()=>setIsLogin(!isLogin)}>{isLogin ? 'Нет аккаунта? Создать' : 'Есть аккаунт? Войти'}</p>
        </motion.div>
    </div>
  );
}