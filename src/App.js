import React, { useState, useEffect, useRef, useCallback, createContext } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'peerjs';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EmojiPicker from 'emoji-picker-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { 
  Users, MessageSquare, Check, X, Settings, Mic, MicOff, 
  Monitor, Send, Phone, PhoneOff, Video, VideoOff, Plus, 
  Menu, Camera, Smile, Reply, Hash, LogOut, Minus, Square, 
  Trash, LogOut as LeaveIcon, Link as LinkIcon, Maximize, Minimize, 
  AlertCircle, ChevronDown, ChevronUp, Paperclip, Edit2, Volume2, Crown, 
  DownloadCloud, RefreshCw, Power, Pin, Music, Keyboard, Search, File, Play, Pause, StopCircle
} from 'lucide-react';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const SERVER_URL = "https://talkspace-7fwq.onrender.com"; 
const socket = io(SERVER_URL);
const PEER_CONFIG = { host: '0.peerjs.com', port: 443, secure: true };

// Sounds
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

// --- GLOBAL STYLES ---
const GlobalStyles = () => (
    <style>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #111; border-radius: 4px; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #444; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #1E1F22; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 3px; }

        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px #111 inset !important;
            -webkit-text-fill-color: white !important;
            transition: background-color 5000s ease-in-out 0s;
        }
        .code-block { font-family: 'Consolas', monospace; font-size: 13px; }
        .drag-overlay { background: rgba(88, 101, 242, 0.2); border: 2px dashed #5865F2; backdrop-filter: blur(2px); }
    `}</style>
);

// --- HELPER COMPONENTS ---

const Input = ({ label, value, onChange, type="text", required=false, errorMsg, className }) => (
    <div className={`mb-4 ${className}`}>
        <label className={`block text-[11px] font-bold uppercase mb-1.5 tracking-wide ${errorMsg ? 'text-red-400' : 'text-gray-400'}`}>
            {label} {required && <span className="text-red-400">*</span>} 
            {errorMsg && <span className="italic normal-case ml-1 font-medium">- {errorMsg}</span>}
        </label>
        <input 
            type={type} 
            value={value} 
            onChange={onChange} 
            className="w-full bg-[#111] border border-white/10 focus:border-[var(--primary)] p-2.5 rounded-[3px] text-white outline-none text-sm h-10 transition-all font-medium placeholder:text-gray-600" 
        />
    </div>
);

const CustomSelect = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => { if (ref.current && !ref.current.contains(event.target)) setIsOpen(false); };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
    return (
        <div className="relative w-full" ref={ref}>
            <div onClick={() => setIsOpen(!isOpen)} className={`w-full bg-[#111] border border-white/10 p-2.5 rounded-[3px] text-white text-sm h-10 flex items-center justify-between cursor-pointer hover:border-[var(--primary)] transition-colors ${isOpen ? 'rounded-b-none border-b-0' : ''}`}>
                <span className={`${!value ? 'text-gray-500' : 'text-white'}`}>{value || placeholder}</span>
                {isOpen ? <ChevronUp size={16} className="text-gray-500"/> : <ChevronDown size={16} className="text-gray-500"/>}
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 bg-[#050505] border border-white/10 border-t-0 max-h-48 overflow-y-auto z-50 rounded-b-[3px] shadow-xl custom-scrollbar">
                    {options.map((opt, i) => (
                        <div key={i} onClick={() => { onChange(opt); setIsOpen(false); }} className="p-2 text-sm text-gray-300 hover:bg-[var(--primary)] hover:text-white cursor-pointer transition-colors flex items-center justify-between">
                            <span>{opt}</span>
                            {value === opt && <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center"><Check size={10} className="text-black font-bold"/></div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- MAIN UI COMPONENTS ---

function TitleBar() {
  if (!ipcRenderer) return null;
  return (
    <div className="h-8 bg-[#000] flex items-center justify-between select-none w-full border-b border-white/10 z-[9999] fixed top-0 left-0 right-0 drag-region">
       <div className="flex items-center gap-2 px-3 no-drag">
           <div className="w-3 h-3 bg-[var(--primary)] rounded-full flex items-center justify-center font-black text-[6px] text-white">T</div>
           <span className="text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase">TalkSpace</span>
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

function UpdateNotification({ onRestart }) {
    return (
        <motion.div initial={{y: 50, opacity: 0}} animate={{y: 0, opacity: 1}} className="absolute bottom-6 left-20 z-[9999] bg-green-600/90 backdrop-blur-md p-3 rounded-xl shadow-2xl border border-green-400 w-64">
            <div className="flex items-start gap-3">
                <div className="p-2 bg-white/20 rounded-full"><DownloadCloud size={20} className="text-white"/></div>
                <div>
                    <h4 className="font-bold text-white text-sm">Обновление готово!</h4>
                    <p className="text-[11px] text-green-100 leading-tight my-1">Новая версия загружена.</p>
                    <button onClick={onRestart} className="mt-2 bg-white text-green-700 w-full py-1.5 rounded-lg text-xs font-black uppercase hover:bg-green-50 transition-colors flex items-center justify-center gap-2"><RefreshCw size={12}/> Перезапустить</button>
                </div>
            </div>
        </motion.div>
    );
}

// --- APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [primaryColor, setPrimaryColor] = useState(localStorage.getItem('accentColor') || '#5865F2');
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
      document.documentElement.style.setProperty('--primary', primaryColor);
      if (ipcRenderer) {
          ipcRenderer.on('update_downloaded', () => setUpdateReady(true));
          ipcRenderer.on('deep-link', (event, url) => { console.log("Deep link:", url); });
      }
      socket.on('sound_played', (sound) => {
          new Audio(`./sounds/${sound}.mp3`).play().catch(e => console.log("Sound error", e));
      });
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
      return () => socket.off('sound_played');
  }, [token, primaryColor]);

  const handleAuth = (data) => {
    localStorage.setItem('token', data.token); setToken(data.token); setUser(data.user); setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };
  const logout = () => { localStorage.clear(); setToken(null); setUser(null); };
  const restartApp = () => { if (ipcRenderer) ipcRenderer.send('restart_app'); };

  if (loading) return <LoadingScreen />;

  return (
    <ThemeContext.Provider value={{ primaryColor, setPrimaryColor }}>
        <GlobalStyles />
        <Router>
        <div className="bg-[#0B0B0C] text-white font-sans h-screen flex flex-col pt-8 selection:bg-[var(--primary)] selection:text-white overflow-hidden relative">
            <BackgroundEffect />
            <TitleBar />
            {updateReady && <UpdateNotification onRestart={restartApp} />}
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

function MainLayout({ user, setUser, onLogout }) {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [statusMenu, setStatusMenu] = useState(false);
  const [createSeverModal, setCreateServerModal] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); 
  const [noiseSuppression, setNoiseSuppression] = useState(localStorage.getItem('noiseSuppression') === 'true');
  const [pttKey, setPttKey] = useState(localStorage.getItem('pttKey') || 'Space');
  const [pttEnabled, setPttEnabled] = useState(localStorage.getItem('pttEnabled') === 'true');

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
    return <div className={`${size} rounded-full ${color} border-[2px] border-[#000] absolute -bottom-0.5 -right-0.5`} />;
  };

  const handleContextMenu = (e, s) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, serverId: s._id, ownerId: s.owner, name: s.name }); };
  const deleteServer = async () => { if(window.confirm(`Удалить ${contextMenu.name}?`)) { await axios.post(`${SERVER_URL}/api/delete-server`, { serverId: contextMenu.serverId }); refresh(); setContextMenu(null); navigate('/friends'); }};
  const leaveServer = async () => { if(window.confirm(`Выйти из ${contextMenu.name}?`)) { await axios.post(`${SERVER_URL}/api/leave-server`, { serverId: contextMenu.serverId, userId: user._id }); refresh(); setContextMenu(null); navigate('/friends'); }};
  const inviteServer = () => { navigator.clipboard.writeText("INVITE-" + contextMenu.serverId.slice(-6).toUpperCase()); alert("Код скопирован"); setContextMenu(null); };

  return (
    <div className="relative flex h-full z-10 overflow-hidden" onClick={()=>setContextMenu(null)}>
      {/* 1. SERVER LIST */}
      <div className="w-[72px] flex flex-col items-center py-3 gap-3 bg-[#050505] border-r border-white/5 shrink-0 z-20 overflow-y-auto no-scrollbar">
        <div onClick={() => navigate('/friends')} className="relative w-12 h-12 bg-[#111] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 group shadow-md text-gray-200">
          <MessageSquare size={24} className="group-hover:text-white" />
          {user?.requests?.length > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center border-[2px] border-[#000] text-[10px] font-black text-white shadow-lg scale-100 animate-bounce">{user.requests.length}</div>}
        </div>
        <div className="w-8 h-[2px] bg-white/10 rounded-full" />
        {user?.servers?.map(s => (
            <div key={s._id} onClick={() => navigate(`/server/${s._id}`)} onContextMenu={(e) => handleContextMenu(e, s)} className="w-12 h-12 bg-[#111] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 text-white font-bold uppercase shadow-md relative select-none text-xs overflow-hidden border-none group">
                {s.name.substring(0, 2)}
            </div>
        ))}
        <button onClick={() => setCreateServerModal(true)} className="w-12 h-12 bg-[#111] text-green-500 hover:bg-green-600 hover:text-white rounded-[24px] hover:rounded-[16px] transition-all flex items-center justify-center shadow-md group"><Plus size={24} /></button>
      </div>

      {/* 2. SIDEBAR */}
      <div className="w-60 bg-[#111] flex flex-col shrink-0 z-20 border-r border-white/5">
         <Routes>
             <Route path="/friends" element={<DMSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
             <Route path="/chat/*" element={<DMSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
             <Route path="/server/:serverId" element={<ServerSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
         </Routes>
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 flex flex-col bg-[#0B0B0C] relative min-w-0 z-10">
        <Routes>
          <Route path="/friends" element={<FriendsView user={user} refresh={refresh} />} />
          <Route path="/chat/:friendId" element={<ChatView user={user} noiseSuppression={noiseSuppression} />} />
          <Route path="/server/:serverId" element={<ServerView user={user} noiseSuppression={noiseSuppression} pttEnabled={pttEnabled} pttKey={pttKey} />} />
          <Route path="*" element={<Navigate to="/friends" />} />
        </Routes>
      </div>

      {contextMenu && (
          <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed bg-[#111] border border-white/10 rounded-[4px] shadow-2xl z-[300] py-1 w-48 font-medium">
              <button onClick={inviteServer} className="w-full text-left px-2 py-1.5 text-[#B5BAC1] hover:bg-[#5865F2] hover:text-white text-xs flex items-center gap-2 transition-colors"><LinkIcon size={14}/> Пригласить</button>
              <div className="h-[1px] bg-white/10 my-1"/>
              {contextMenu.ownerId === user._id ? (
                  <button onClick={deleteServer} className="w-full text-left px-2 py-1.5 text-red-400 hover:bg-red-500 hover:text-white text-xs flex items-center gap-2 transition-colors"><Trash size={14}/> Удалить</button>
              ) : (
                  <button onClick={leaveServer} className="w-full text-left px-2 py-1.5 text-red-400 hover:bg-red-500 hover:text-white text-xs flex items-center gap-2 transition-colors"><LeaveIcon size={14}/> Покинуть</button>
              )}
          </div>
      )}

      <AnimatePresence>
        {showSettings && <SettingsModal user={user} setUser={setUser} onClose={() => setShowSettings(false)} onLogout={onLogout} noise={noiseSuppression} setNoise={setNoiseSuppression} ptt={pttEnabled} setPtt={setPttEnabled} pttKey={pttKey} setPttKey={setPttKey} />}
        {createSeverModal && <CreateServerModal user={user} onClose={() => setCreateServerModal(false)} refresh={refresh} />}
      </AnimatePresence>
    </div>
  );
}

const DMSidebar = ({ user, navigate, StatusDot, setShowSettings, statusMenu, setStatusMenu, updateStatus }) => (
    <>
        <div className="h-12 flex items-center px-4 font-black text-white border-b border-white/5 shadow-sm select-none bg-[#111] text-sm">Поиск...</div>
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <button onClick={() => navigate('/friends')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] transition-all ${window.location.hash.includes('/friends') ? 'bg-[#333] text-white' : 'text-[#949BA4] hover:bg-[#222] hover:text-[#DBDEE1]'}`}>
            <Users size={20} /> <div className="flex-1 flex justify-between items-center"><span className="text-[15px] font-medium">Друзья</span> 
            {user?.requests?.length > 0 && <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 rounded-full min-w-[18px] text-center">{user.requests.length}</span>}
            </div>
          </button>
          <div className="mt-4 mb-1 px-3 text-[11px] font-bold text-[#949BA4] uppercase tracking-wide flex items-center justify-between select-none hover:text-[#DBDEE1]"><span>Личные сообщения</span> <Plus size={14} className="cursor-pointer"/></div>
          {user?.chats?.map(c => {
            const f = c.members.find(m => m._id !== user._id);
            if (!f) return null;
            return (
              <div key={c._id} onClick={() => navigate(`/chat/${f._id}`)} className={`flex items-center gap-3 px-2 py-2 rounded-[4px] cursor-pointer transition-all group ${window.location.hash.includes(f._id) ? 'bg-[#333] text-white' : 'hover:bg-[#222] text-[#949BA4]'}`}>
                <div className="relative"><img src={f.avatar} className="w-8 h-8 rounded-full bg-zinc-800 object-cover" alt="av" /><StatusDot status={f.status} /></div>
                <div className="flex-1 overflow-hidden leading-tight"><p className="truncate text-[15px] font-medium group-hover:text-[#DBDEE1] transition-colors">{f.displayName || f.username}</p><p className="text-[12px] opacity-70 truncate">{f.status}</p></div>
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
        <div className="h-12 flex items-center px-4 font-bold text-white border-b border-white/5 shadow-sm truncate select-none text-[15px]">{activeServer?.name || "Server"}</div>
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {activeServer?.channels?.map(ch => (
                <div key={ch._id} onClick={() => navigate(`/server/${serverId}?channel=${ch._id}`)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] cursor-pointer transition-colors ${window.location.search.includes(ch._id) ? 'bg-[#333] text-white' : 'text-[#949BA4] hover:bg-[#222] hover:text-[#DBDEE1]'}`}>
                    {ch.type === 'voice' ? <Volume2 size={18}/> : <Hash size={18}/>}
                    <span className="font-medium text-[15px]">{ch.name}</span>
                </div>
            ))}
        </div>
        <UserPanel user={user} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus} StatusDot={StatusDot}/>
    </>
    );
};

const UserPanel = ({ user, setShowSettings, statusMenu, setStatusMenu, updateStatus, StatusDot }) => (
    <div className="bg-[#050505] p-1.5 relative select-none flex items-center gap-1 border-t border-white/5">
       <AnimatePresence>
        {statusMenu && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: -10, opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-full left-2 w-56 bg-[#111] border border-white/10 rounded-lg p-2 shadow-2xl z-50 mb-2">
             <button onClick={() => updateStatus('online')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-green-500 rounded-full"/> В сети</button>
             <button onClick={() => updateStatus('dnd')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-red-500 rounded-full"/> Не беспокоить</button>
             <button onClick={() => updateStatus('idle', 'Спит')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"/> Спит</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2 p-1 rounded hover:bg-[#222] cursor-pointer transition-colors flex-1" onClick={(e) => {if(!e.target.closest('.icons')) setStatusMenu(!statusMenu)}}>
          <div className="relative"><img src={user?.avatar} className="w-8 h-8 rounded-full object-cover bg-zinc-800" alt="me" /><StatusDot status={user.status} /></div>
          <div className="flex-1 overflow-hidden leading-tight"><p className="text-xs font-bold text-white truncate">{user?.displayName}</p><p className="text-[11px] text-[#DBDEE1]">@{user?.username}</p></div>
      </div>
      <div className="flex gap-0 icons">
        <button className="p-2 hover:bg-[#222] rounded text-gray-200" onClick={()=>setShowSettings(true)}><Settings size={18}/></button>
      </div>
    </div>
);

// --- CHAT COMPONENTS ---

function EditMessageModal({ isOpen, onClose, initialText, onSave }) {
    const [text, setText] = useState(initialText);
    useEffect(() => setText(initialText), [initialText]);
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200]">
            <motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#313338] p-6 rounded-xl w-full max-w-lg border border-white/10 shadow-2xl">
                <h3 className="text-white font-bold text-lg mb-4">Редактировать сообщение</h3>
                <textarea className="w-full bg-[#1E1F22] text-white p-3 rounded-lg outline-none h-32 resize-none" value={text} onChange={e=>setText(e.target.value)} />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:underline text-sm font-medium">Отмена</button>
                    <button onClick={()=>{onSave(text); onClose()}} className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90">Сохранить</button>
                </div>
            </motion.div>
        </div>
    )
}

function ChatInput({ onSend, onUpload, placeholder, members = [], roomId, onType }) {
    const [text, setText] = useState("");
    const [showEmoji, setShowEmoji] = useState(false);
    const [mentionSearch, setMentionSearch] = useState(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);
    const audioChunks = useRef([]);

    const handleKeyDown = (e) => {
        if (mentionSearch !== null) {
            const filtered = members.filter(m => m.username.toLowerCase().includes(mentionSearch.toLowerCase()));
            if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(prev => (prev + 1) % filtered.length); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(prev => (prev - 1 + filtered.length) % filtered.length); }
            else if (e.key === 'Enter') { e.preventDefault(); insertMention(filtered[mentionIndex]); }
            else if (e.key === 'Escape') { setMentionSearch(null); }
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(text); setText(""); }
    };

    const handleChange = (e) => {
        const val = e.target.value;
        setText(val);
        onType && onType();
        
        const lastWord = val.split(" ").pop();
        if (lastWord.startsWith("@")) {
            setMentionSearch(lastWord.slice(1));
            setMentionIndex(0);
        } else {
            setMentionSearch(null);
        }
    };

    const insertMention = (user) => {
        const words = text.split(" "); words.pop();
        setText(words.join(" ") + (words.length > 0 ? " " : "") + `@${user.username} `);
        setMentionSearch(null);
    };

    const handleFile = async (e) => {
        if(e.target.files[0]) {
            const fd = new FormData(); fd.append('file', e.target.files[0]);
            const res = await axios.post(`${SERVER_URL}/api/upload`, fd);
            onUpload(res.data.url, 'image');
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream);
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = (event) => audioChunks.current.push(event.data);
            mediaRecorder.current.onstop = async () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                const fd = new FormData();
                fd.append('file', audioBlob, 'voice.webm');
                const res = await axios.post(`${SERVER_URL}/api/upload`, fd);
                onUpload(res.data.url, 'audio');
            };
            mediaRecorder.current.start();
            setIsRecording(true);
        } catch (e) {
            console.error(e);
            alert("Mic error");
        }
    };

    const stopRecording = () => {
        if(mediaRecorder.current) {
            mediaRecorder.current.stop();
            setIsRecording(false);
        }
    };

    return (
        <div className="p-4 bg-[#0B0B0C] shrink-0 z-20 relative px-4 pb-6">
            {showEmoji && <div className="absolute bottom-20 right-4 z-50"><EmojiPicker theme="dark" onEmojiClick={(e)=>setText(prev=>prev+e.emoji)}/></div>}
            
            {mentionSearch !== null && (
                <div className="absolute bottom-20 left-4 bg-[#111] border border-white/10 rounded-lg shadow-2xl w-64 max-h-48 overflow-y-auto custom-scrollbar z-50">
                    {members.filter(m => m.username.toLowerCase().includes(mentionSearch.toLowerCase())).map((m, i) => (
                        <div key={m._id} onClick={() => insertMention(m)} className={`p-2 flex items-center gap-2 cursor-pointer hover:bg-[var(--primary)] ${i === mentionIndex ? 'bg-[#222]' : ''}`}>
                            <img src={m.avatar} className="w-6 h-6 rounded-full" alt="av"/>
                            <div><p className="text-white text-xs font-bold">{m.displayName}</p><p className="text-gray-400 text-[10px]">@{m.username}</p></div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-3 bg-[#111] p-2.5 px-4 rounded-lg border border-white/5 focus-within:border-white/20 transition-colors">
                <label className="cursor-pointer text-[#B5BAC1] hover:text-[#DBDEE1] p-1"><Plus size={20} className="bg-[#2B2D31] rounded-full p-0.5"/><input type="file" hidden onChange={handleFile}/></label>
                <input value={text} onChange={handleChange} onKeyDown={handleKeyDown} className="flex-1 bg-transparent outline-none text-[#DBDEE1] text-[15px] py-1 placeholder:text-[#555]" placeholder={placeholder} />
                <button onClick={isRecording ? stopRecording : startRecording} className={`${isRecording ? 'text-red-500 animate-pulse' : 'text-[#B5BAC1]'} hover:text-white transition-colors`}><Mic size={24}/></button>
                <button onClick={()=>setShowEmoji(!showEmoji)} className="text-[#B5BAC1] hover:text-[#E0C259] transition-colors"><Smile size={24}/></button>
                <button onClick={()=>{onSend(text); setText("")}} className="text-[#B5BAC1] hover:text-[var(--primary)] transition-colors"><Send size={24}/></button>
            </div>
        </div>
    )
}

function MessageList({ messages, user, onReact, onEdit, onDelete, onPin, onReply, setEditMsg }) {
    const bottomRef = useRef();
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const Message = ({ m }) => {
        const isMe = m.senderId === user._id;
        const [context, setContext] = useState(null);
        // New Message Separator (Dummy logic for now, assumes anything < 5 mins ago is new)
        const isNew = (new Date() - new Date(m.createdAt)) < 5 * 60 * 1000 && !isMe;

        return (
            <>
            {isNew && <div className="flex items-center my-2"><div className="h-[1px] bg-red-500 flex-1"/><span className="text-[10px] text-red-500 font-bold px-2 uppercase">New</span><div className="h-[1px] bg-red-500 flex-1"/></div>}
            <div className={`group flex gap-4 px-4 py-2 hover:bg-[#111]/50 relative ${m.isPinned ? 'bg-yellow-900/10' : ''}`} onContextMenu={e=>{e.preventDefault(); setContext({x:e.clientX,y:e.clientY})}} onMouseLeave={()=>setContext(null)}>
                {m.replyTo && (
                    <div className="absolute -top-3 left-14 flex items-center gap-1 opacity-60 text-xs">
                        <div className="w-8 h-2 border-t-2 border-l-2 border-gray-500 rounded-tl-md mt-2"/>
                        <span className="font-bold text-gray-400">@{m.replyTo.senderName}</span>
                        <span className="text-gray-500 truncate max-w-[200px]">{m.replyTo.text}</span>
                    </div>
                )}
                <img src={m.senderAvatar} className="w-10 h-10 rounded-full bg-zinc-800 object-cover mt-1 cursor-pointer hover:opacity-80" alt="av" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white cursor-pointer hover:underline">{m.senderName}</span>
                        <span className="text-[11px] text-[#949BA4]">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        {m.isPinned && <Pin size={12} className="text-red-400 rotate-45" />}
                    </div>
                    {m.type === 'image' ? (
                        <img src={m.fileUrl} className="max-w-[400px] max-h-[300px] rounded-lg shadow-lg border border-white/5" alt="attachment"/>
                    ) : m.type === 'audio' ? (
                        <div className="bg-[#2B2D31] p-2 rounded flex items-center gap-3 w-64 border border-white/10">
                            <div className="p-2 bg-[var(--primary)] rounded-full"><Play size={16} className="text-white"/></div>
                            <audio controls src={m.fileUrl} className="w-full h-8"/>
                        </div>
                    ) : (
                        <div className="text-[#DBDEE1] text-[15px] leading-relaxed break-words markdown-body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                code({node, inline, className, children, ...props}) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return !inline && match ? (
                                    <SyntaxHighlighter style={dracula} language={match[1]} PreTag="div" {...props}>{String(children).replace(/\n$/, '')}</SyntaxHighlighter>
                                    ) : (<code className="bg-[#2B2D31] px-1 py-0.5 rounded text-sm text-gray-200 font-mono" {...props}>{children}</code>)
                                }
                            }}>{m.text}</ReactMarkdown>
                            {m.isEdited && <span className="text-[10px] text-gray-500 ml-1">(изм.)</span>}
                        </div>
                    )}
                    
                    {/* Link Preview */}
                    {m.ogData && (
                        <div className="mt-2 border-l-4 border-[var(--primary)] bg-[#1E1F22] rounded p-2 max-w-md">
                            <h4 className="font-bold text-[#00A8FC] hover:underline cursor-pointer" onClick={()=>window.open(m.ogData.url, '_blank')}>{m.ogData.title}</h4>
                            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{m.ogData.description}</p>
                            {m.ogData.image && <img src={m.ogData.image} className="mt-2 rounded max-h-40 object-cover w-full" alt="preview"/>}
                        </div>
                    )}

                    {/* Reactions */}
                    {m.reactions?.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                            {m.reactions.map((r, i) => (
                                <div key={i} onClick={()=>onReact(m._id, r.emoji)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] cursor-pointer border ${r.users.includes(user._id) ? 'bg-[#3b405a] border-[var(--primary)]' : 'bg-[#2B2D31] border-transparent hover:border-gray-500'}`}>
                                    <span className="text-sm">{r.emoji}</span><span className="text-xs font-bold text-[#B5BAC1]">{r.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Hover Actions */}
                <div className="absolute -top-2 right-4 bg-[#313338] shadow-sm p-1 rounded border border-white/10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={()=>onReact(m._id, '👍')} className="p-1 hover:bg-[#404249] rounded">👍</button>
                    <button onClick={()=>onReact(m._id, '🔥')} className="p-1 hover:bg-[#404249] rounded">🔥</button>
                    <button onClick={()=>onReply(m)} className="p-1 hover:bg-[#404249] rounded text-gray-400 hover:text-white"><Reply size={16}/></button>
                    {isMe && <button onClick={()=>setEditMsg(m)} className="p-1 hover:bg-[#404249] rounded text-gray-400 hover:text-white"><Edit2 size={16}/></button>}
                    {isMe && <button onClick={()=>onDelete(m._id)} className="p-1 hover:bg-[#404249] rounded text-red-400 hover:text-red-500"><Trash size={16}/></button>}
                </div>

                {context && (
                    <div style={{top:context.y, left:context.x}} className="fixed bg-[#111] border border-white/10 rounded p-1 w-40 z-50 shadow-xl" onMouseLeave={()=>setContext(null)}>
                        <button onClick={()=>{onPin(m._id, !m.isPinned); setContext(null)}} className="w-full text-left p-2 hover:bg-[var(--primary)] text-xs text-white rounded flex gap-2"><Pin size={14}/> {m.isPinned?'Открепить':'Закрепить'}</button>
                    </div>
                )}
            </div>
            </>
        );
    }
    return <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pb-4">{messages.map(m => <Message key={m._id} m={m} />)}<div ref={bottomRef}/></div>
}

function ChatView({ user, noiseSuppression }) {
  const { friendId } = useParams();
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  // Call states
  const [callActive, setCallActive] = useState(false);
  const [isIncoming, setIsIncoming] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenOn, setIsScreenOn] = useState(false);
  const peerRef = useRef();
  
  // Fixes: Edit Modal & DragDrop
  const [editMsg, setEditMsg] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
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
    
    // Typing
    socket.on('user_typing', (u) => setTyping(p => [...new Set([...p, u])]));
    socket.on('user_stop_typing', (u) => setTyping(p => p.filter(n => n !== u)));

    socket.on('incoming_call_signal', (d) => { callSound.play(); setIsIncoming(d); });
    socket.on('call_ended', endCall);

    return () => { socket.off('new_msg'); socket.off('user_typing'); socket.off('user_stop_typing'); socket.off('incoming_call_signal'); socket.off('call_ended'); socket.off('message_update'); socket.off('message_delete'); peer.destroy(); endCall(); };
  }, [user._id, friendId, activeChat?._id]);

  const handleSend = (text) => {
    socket.emit('send_msg', { chatId: activeChat._id, text, senderId: user._id, senderName: user.displayName, avatar: user.avatar, type: 'text', replyTo: replyTo ? { id: replyTo._id, text: replyTo.text, senderName: replyTo.senderName } : null });
    setReplyTo(null);
  }
  const handleUpload = (url, type='image') => socket.emit('send_msg', { chatId: activeChat._id, text: "", senderId: user._id, senderName: user.displayName, avatar: user.avatar, type, fileUrl: url });
  const handleReact = (msgId, emoji) => axios.post(`${SERVER_URL}/api/message/react`, { chatId: activeChat._id, msgId, emoji, userId: user._id });
  const handleEdit = (text) => { axios.post(`${SERVER_URL}/api/message/edit`, { chatId: activeChat._id, msgId: editMsg._id, newText: text }); setEditMsg(null); };
  const handleDelete = (msgId) => axios.post(`${SERVER_URL}/api/message/delete`, { chatId: activeChat._id, msgId });
  const handlePin = (msgId, isPinned) => axios.post(`${SERVER_URL}/api/message/pin`, { chatId: activeChat._id, msgId, isPinned });

  const typingTimeout = useRef();
  const handleType = () => {
      socket.emit('typing', { room: activeChat._id, user: user.displayName });
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => socket.emit('stop_typing', { room: activeChat._id, user: user.displayName }), 2000);
  };

  const startCall = async (withVideo) => {
    try {
        const s = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: { echoCancellation: true, noiseSuppression } });
        setLocalStream(s); setCallActive(true); setIsCamOn(withVideo); setIsMicOn(true);
        const call = peerRef.current.call(friendId, s);
        call.on('stream', (rs) => setRemoteStream(rs));
        socket.emit('call_user', { userToCall: friendId, from: user.displayName, fromId: user._id });
    } catch(e) { alert("Ошибка доступа к устройствам."); }
  };
  const answerCall = async () => {
      callSound.pause(); callSound.currentTime = 0;
      const s = await navigator.mediaDevices.getUserMedia({ video: false, audio: { noiseSuppression } }); 
      setLocalStream(s); setCallActive(true); setIsIncoming(null); setIsCamOn(false);
      if(isIncoming.call) { isIncoming.call.answer(s); isIncoming.call.on('stream', rs => setRemoteStream(rs)); }
  };
  const endCall = () => {
      if(localStream) localStream.getTracks().forEach(t=>t.stop());
      callSound.pause(); callSound.currentTime = 0;
      setCallActive(false); setLocalStream(null); setRemoteStream(null); setIsIncoming(null); setIsScreenOn(false);
  };
  const toggleMic = () => { if(localStream) { const track = localStream.getAudioTracks()[0]; if(track) { track.enabled = !track.enabled; setIsMicOn(track.enabled); } } };
  const toggleCam = async () => { if (isCamOn) { localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); }); setIsCamOn(false); } else { try { const vs = await navigator.mediaDevices.getUserMedia({ video: true }); const vt = vs.getVideoTracks()[0]; localStream.addTrack(vt); const sender = peerRef.current.peerConnection.getSenders().find(s => s.track.kind === 'video'); if (sender) sender.replaceTrack(vt); else peerRef.current.peerConnection.addTrack(vt, localStream); setIsCamOn(true); } catch(e) { alert("Камера не найдена"); } } };
  const shareScreen = async () => { if(!isScreenOn) { try { const ss = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); const st = ss.getVideoTracks()[0]; const sender = peerRef.current.peerConnection.getSenders().find(s => s.track.kind === 'video' || s.track.kind === 'screen'); if(sender) sender.replaceTrack(st); else peerRef.current.peerConnection.addTrack(st, localStream); st.onended = () => { setIsScreenOn(false); }; setIsScreenOn(true); } catch(e) {} } };

  // Drag & Drop
  const onDrop = async (e) => {
      e.preventDefault(); setIsDragging(false);
      if(e.dataTransfer.files[0]) {
          const fd = new FormData(); fd.append('file', e.dataTransfer.files[0]);
          const res = await axios.post(`${SERVER_URL}/api/upload`, fd);
          handleUpload(res.data.url);
      }
  };

  if (!activeChat) return <div className="flex-1 flex items-center justify-center text-gray-500 font-bold animate-pulse">Загрузка...</div>;

  return (
    <div 
        className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#0B0B0C]"
        onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}}
        onDragLeave={()=>setIsDragging(false)}
        onDrop={onDrop}
    >
      {isDragging && <div className="absolute inset-0 z-50 bg-[#5865F2]/20 border-4 border-dashed border-[#5865F2] flex items-center justify-center pointer-events-none"><h2 className="text-2xl font-bold text-white">Перетащите файлы сюда</h2></div>}
      
      <div className="h-12 flex items-center justify-between px-4 border-b border-white/5 bg-[#111] shadow-sm z-20">
          <div className="flex items-center gap-3"><div className="relative"><img src={friend?.avatar} className="w-8 h-8 rounded-full" alt="f" /><StatusDot status={friend?.status}/></div><div><p className="font-bold text-white text-[15px]">{friend?.displayName}</p><p className="text-[12px] text-[#949BA4]">@{friend?.username}</p></div></div>
          <div className="flex items-center gap-4 text-[#B5BAC1]">
              <Search size={20} className="hover:text-white cursor-pointer"/>
              <div className="h-4 w-[1px] bg-white/10"/>
              <Phone size={24} className="hover:text-green-400 cursor-pointer transition-colors" onClick={() => startCall(false)} />
              <Video size={24} className="hover:text-white cursor-pointer transition-colors" onClick={() => startCall(true)} />
          </div>
      </div>
      
      <CallHeader callActive={callActive} incoming={isIncoming} onAccept={answerCall} onReject={()=>{callSound.pause();setIsIncoming(null)}} onHangup={()=>{socket.emit('hangup', {to: friendId}); endCall()}} localStream={localStream} remoteStream={remoteStream} toggleMic={toggleMic} toggleCam={toggleCam} shareScreen={shareScreen} isMicOn={isMicOn} isCamOn={isCamOn} isScreenOn={isScreenOn} friend={friend}/>
      
      <MessageList messages={messages} user={user} onReact={handleReact} setEditMsg={setEditMsg} onDelete={handleDelete} onPin={handlePin} onReply={setReplyTo} />
      
      {typing.length > 0 && <div className="px-4 text-[10px] font-bold text-gray-400 animate-pulse">{typing.join(', ')} печатает...</div>}
      
      {replyTo && <div className="mx-4 mb-0 bg-[#2B2D31] p-2 rounded-t flex justify-between items-center text-xs text-gray-300 border-l-4 border-[var(--primary)]"><span>Ответ <b>{replyTo.senderName}</b>: {replyTo.text.substring(0,50)}...</span><X size={14} className="cursor-pointer" onClick={()=>setReplyTo(null)}/></div>}
      
      <ChatInput onSend={handleSend} onUpload={handleUpload} onType={handleType} placeholder={`Написать @${friend?.displayName}`} members={activeChat.members} />
      
      {editMsg && <EditMessageModal isOpen={true} onClose={()=>setEditMsg(null)} initialText={editMsg.text} onSave={handleEdit}/>}
    </div>
  );
}

function ServerView({ user, noiseSuppression, pttEnabled, pttKey }) {
    const { serverId } = useParams();
    const query = new URLSearchParams(window.location.search);
    const channelId = query.get('channel') || user?.servers?.find(s=>s._id===serverId)?.channels?.[0]?._id;
    const server = user?.servers?.find(s => s._id === serverId);
    const channel = server?.channels?.find(c => c._id === channelId);
    const [messages, setMessages] = useState(channel?.messages || []);
    const [inVoice, setInVoice] = useState(false);
    const [localVoiceStream, setLocalVoiceStream] = useState(null);
    const [typing, setTyping] = useState([]);
    const [replyTo, setReplyTo] = useState(null);
    const [speaking, setSpeaking] = useState(false); // Visual indicator
    const [showSoundboard, setShowSoundboard] = useState(false);
    
    // Fixes
    const [editMsg, setEditMsg] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => { 
        socket.emit('join_server_room', serverId); 
        setMessages(channel?.messages || []); 
    }, [channelId, serverId, channel]);

    useEffect(() => {
        const onMsg = (m) => { if(m.channelId === channelId) setMessages(p => [...p, m]); };
        const onUpdate = (d) => { if(d.channelId === channelId) setMessages(p => p.map(m => m._id === d.msg._id ? d.msg : m)); };
        const onDelete = (d) => { if(d.channelId === channelId) setMessages(p => p.filter(m => m._id !== d.msgId)); };

        socket.on('new_server_msg', onMsg);
        socket.on('new_server_msg_update', onUpdate);
        socket.on('new_server_msg_delete', onDelete);
        socket.on('user_typing', (u) => setTyping(p => [...new Set([...p, u])]));
        socket.on('user_stop_typing', (u) => setTyping(p => p.filter(n => n !== u)));

        return () => {
            socket.off('new_server_msg', onMsg);
            socket.off('new_server_msg_update', onUpdate);
            socket.off('new_server_msg_delete', onDelete);
            socket.off('user_typing'); socket.off('user_stop_typing');
        };
    }, [channelId]);

    const handleSend = (text) => {
        socket.emit('send_msg', { serverId, channelId, text, senderId: user._id, senderName: user.displayName, avatar: user.avatar, type: 'text', replyTo: replyTo ? { id: replyTo._id, text: replyTo.text, senderName: replyTo.senderName } : null });
        setReplyTo(null);
    }
    const handleReact = (msgId, emoji) => axios.post(`${SERVER_URL}/api/message/react`, { serverId, channelId, msgId, emoji, userId: user._id });
    const handleEdit = (text) => { axios.post(`${SERVER_URL}/api/message/edit`, { serverId, channelId, msgId: editMsg._id, newText: text }); setEditMsg(null); };
    const handleDelete = (msgId) => axios.post(`${SERVER_URL}/api/message/delete`, { serverId, channelId, msgId });
    const handlePin = (msgId, isPinned) => axios.post(`${SERVER_URL}/api/message/pin`, { serverId, channelId, msgId, isPinned });
    const kickMember = async (id) => { if(server.owner === user._id) await axios.post(`${SERVER_URL}/api/kick-member`, { serverId, userId: id }); };
    const handleUpload = (url, type='image') => socket.emit('send_msg', { serverId, channelId, text: "", senderId: user._id, senderName: user.displayName, avatar: user.avatar, type, fileUrl: url });

    const typingTimeout = useRef();
    const handleType = () => {
        socket.emit('typing', { room: serverId, user: user.displayName });
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => socket.emit('stop_typing', { room: serverId, user: user.displayName }), 2000);
    };

    // --- VOICE & PTT LOGIC ---
    const toggleVoice = async () => {
        if (inVoice) {
            setInVoice(false);
            if(localVoiceStream) { localVoiceStream.getTracks().forEach(t => t.stop()); setLocalVoiceStream(null); }
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression, echoCancellation: true } });
                setLocalVoiceStream(stream);
                setInVoice(true);
                
                // Visualizer & PTT
                const audioCtx = new AudioContext();
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                source.connect(analyser);
                analyser.fftSize = 256;
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                const checkVolume = () => {
                    if(!inVoice) return;
                    analyser.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a,b)=>a+b) / bufferLength;
                    setSpeaking(avg > 10);
                    requestAnimationFrame(checkVolume);
                }
                checkVolume();

            } catch (e) { alert("Ошибка доступа к микрофону"); }
        }
    };

    // PTT Handler
    useEffect(() => {
        if(!inVoice || !localVoiceStream || !pttEnabled) return;
        const track = localVoiceStream.getAudioTracks()[0];
        track.enabled = false; // Start muted

        const down = (e) => { if(e.code === pttKey) track.enabled = true; };
        const up = (e) => { if(e.code === pttKey) track.enabled = false; };
        
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); track.enabled = true; };
    }, [inVoice, localVoiceStream, pttEnabled, pttKey]);

    const playSound = (sound) => socket.emit('play_sound', { room: serverId, sound });

    const onDrop = async (e) => {
        e.preventDefault(); setIsDragging(false);
        if(e.dataTransfer.files[0]) {
            const fd = new FormData(); fd.append('file', e.dataTransfer.files[0]);
            const res = await axios.post(`${SERVER_URL}/api/upload`, fd);
            handleUpload(res.data.url);
        }
    };

    return (
        <div className="flex h-full bg-[#0B0B0C]">
            <div 
                className="flex-1 flex flex-col relative"
                onDragOver={(e)=>{e.preventDefault(); setIsDragging(true)}}
                onDragLeave={()=>setIsDragging(false)}
                onDrop={onDrop}
            >
                {isDragging && <div className="absolute inset-0 z-50 bg-[#5865F2]/20 border-4 border-dashed border-[#5865F2] flex items-center justify-center pointer-events-none"><h2 className="text-2xl font-bold text-white">Перетащите файлы сюда</h2></div>}

                {channel?.type === 'text' ? (
                    <>
                        <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 font-bold text-white shadow-sm">
                            <div className="flex items-center"><Hash size={24} className="mr-2 text-gray-500"/> {channel.name}</div>
                            <div className="flex items-center gap-2">
                                <Search size={20} className="text-gray-400 hover:text-white cursor-pointer mr-2"/>
                                <button onClick={()=>setShowSoundboard(!showSoundboard)} className={`p-2 rounded hover:bg-[#333] transition-colors ${showSoundboard ? 'text-[var(--primary)]' : 'text-gray-400'}`}><Music size={20}/></button>
                            </div>
                        </div>
                        
                        {/* Soundboard Panel */}
                        <AnimatePresence>
                        {showSoundboard && (
                            <motion.div initial={{height:0}} animate={{height:80}} exit={{height:0}} className="bg-[#111] border-b border-white/5 overflow-hidden flex items-center gap-2 px-4">
                                {SOUNDS.map(s => (
                                    <button key={s} onClick={()=>playSound(s)} className="bg-[#2B2D31] hover:bg-[var(--primary)] text-white px-3 py-1 rounded text-xs font-bold uppercase transition-colors">{s}</button>
                                ))}
                            </motion.div>
                        )}
                        </AnimatePresence>

                        <MessageList messages={messages} user={user} onReact={handleReact} setEditMsg={setEditMsg} onDelete={handleDelete} onPin={handlePin} onReply={setReplyTo} />
                        {typing.length > 0 && <div className="px-4 text-[10px] font-bold text-gray-400 animate-pulse">{typing.join(', ')} печатает...</div>}
                        {replyTo && <div className="mx-4 mb-0 bg-[#2B2D31] p-2 rounded-t flex justify-between items-center text-xs text-gray-300 border-l-4 border-[var(--primary)]"><span>Ответ <b>{replyTo.senderName}</b>: {replyTo.text.substring(0,50)}...</span><X size={14} className="cursor-pointer" onClick={()=>setReplyTo(null)}/></div>}
                        <ChatInput onSend={handleSend} onUpload={handleUpload} onType={handleType} placeholder={`Написать в #${channel.name}`} members={server?.members || []} roomId={serverId} />
                        
                        {editMsg && <EditMessageModal isOpen={true} onClose={()=>setEditMsg(null)} initialText={editMsg.text} onSave={handleEdit}/>}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col text-center">
                        <div className={`p-6 rounded-full transition-all duration-100 ${speaking ? 'bg-green-500/20 scale-110 border-green-500' : 'bg-transparent border-transparent'} border-2`}>
                             <Volume2 size={64} className="text-[#404249]"/>
                        </div>
                        <h2 className="text-2xl font-bold mb-4 mt-6 text-white">Голосовой канал: {channel?.name}</h2>
                        {!inVoice ? (
                            <button onClick={toggleVoice} className="bg-[#5865F2] px-8 py-2.5 rounded text-white font-bold hover:bg-[#4752C4] transition-all">Подключиться</button>
                        ) : (
                            <div className="text-center">
                                <p className="text-green-400 mb-4 font-bold">Вы подключены {pttEnabled && '(PTT)'}</p>
                                <button onClick={toggleVoice} className="bg-[#F23F43] px-8 py-2.5 rounded text-white font-bold hover:bg-[#D9363A] transition-all">Отключиться</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="w-60 bg-[#111] p-4 overflow-y-auto border-l border-white/5">
                <h3 className="text-xs font-bold text-[#949BA4] uppercase mb-4 tracking-widest">Участники — {server?.members?.length}</h3>
                {server?.members?.map(m => (
                    <div key={m._id} onContextMenu={(e)=>{e.preventDefault(); if(server.owner===user._id && m._id!==user._id) if(window.confirm("Кикнуть?")) kickMember(m._id)}} className="flex items-center gap-2 mb-2 p-1.5 hover:bg-[#222] rounded-lg cursor-pointer opacity-90 hover:opacity-100 transition-all">
                        <img src={m.avatar} className="w-8 h-8 rounded-full bg-zinc-800 object-cover" alt="av"/>
                        <div><p className={`font-bold text-sm ${server.owner===m._id ? 'text-[#F0B232]' : 'text-[#DBDEE1]'}`}>{m.displayName} {server.owner===m._id && <Crown size={12} className="inline ml-1"/>}</p><p className="text-[10px] text-[#949BA4] font-medium">{m.status}</p></div>
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
    const sendRequest = async () => { setError(""); setSuccess(""); try { if(!friendInput) return; await axios.post(`${SERVER_URL}/api/friend-request`, { fromId: user._id, targetUsername: friendInput }); setSuccess(`Запрос отправлен ${friendInput}!`); setFriendInput(""); } catch (e) { setError(e.response?.data?.error || "Пользователь не найден"); } };
    const handleInput = (e) => { setFriendInput(e.target.value); setError(""); setSuccess(""); };
    const borderClass = error ? 'border-red-500' : success ? 'border-green-500' : 'border-[#333] focus-within:border-[var(--primary)]';
    
    // BADGE LOGIC
    const pendingCount = user?.requests?.length || 0;

    return (
      <div className="flex flex-col h-full bg-[#0B0B0C]">
        <div className="h-12 flex items-center px-6 border-b border-white/5 gap-6 shadow-sm"><div className="flex items-center gap-2 text-white font-bold"><Users size={20} /><span>Друзья</span></div><div className="h-6 w-[1px] bg-white/10"/>
        <div className="flex gap-2">
            <button onClick={() => {setTab('all'); setError(""); setSuccess("");}} className={`px-2 py-0.5 rounded text-[15px] font-medium transition-colors ${tab === 'all' ? 'bg-[#333] text-white' : 'text-[#B5BAC1] hover:bg-[#222] hover:text-[#DBDEE1]'}`}>Все</button>
            <button onClick={() => {setTab('pending'); setError(""); setSuccess("");}} className={`px-2 py-0.5 rounded text-[15px] font-medium transition-colors flex items-center gap-2 ${tab === 'pending' ? 'bg-[#333] text-white' : 'text-[#B5BAC1] hover:bg-[#222] hover:text-[#DBDEE1]'}`}>
                Ожидание 
                {pendingCount > 0 && <span className="bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{pendingCount}</span>}
            </button>
            <button onClick={() => {setTab('add'); setError(""); setSuccess("");}} className={`px-2 py-0.5 rounded text-[15px] font-medium transition-colors ${tab === 'add' ? 'text-[#23A559] bg-transparent' : 'bg-[#23A559] text-white px-3'}`}>Добавить друга</button>
        </div></div>
        <div className="p-8 overflow-y-auto">
          {tab === 'all' && ( <>{user?.friends?.map(f => (<div key={f._id} onClick={() => navigate(`/chat/${f._id}`)} className="flex items-center justify-between p-2.5 hover:bg-[#111] rounded-lg cursor-pointer group border-t border-white/5 border-opacity-50"><div className="flex items-center gap-3"><img src={f.avatar} className="w-8 h-8 rounded-full object-cover" alt="av" /><div><p className="font-bold text-white text-[15px]">{f.displayName} <span className="hidden group-hover:inline text-[#949BA4] text-xs font-medium">@{f.username}</span></p><p className="text-[11px] text-[#949BA4] font-bold">{f.status}</p></div></div><div className="p-2 bg-[#222] rounded-full text-[#B5BAC1] group-hover:text-[#DBDEE1]"><MessageSquare size={18} /></div></div>))}</>)}
          {tab === 'add' && (<div className="w-full max-w-2xl"><h3 className="text-white font-bold text-base mb-2 uppercase">Добавить друга</h3><p className="text-[#B5BAC1] text-sm mb-4">Вы можете добавить друзей по имени пользователя.</p><div className={`bg-[#111] p-2.5 rounded-xl border flex items-center transition-all ${borderClass}`}><input value={friendInput} onChange={handleInput} className="bg-transparent flex-1 p-1 outline-none text-white text-sm placeholder:text-gray-500" placeholder="Имя пользователя" /><button onClick={sendRequest} disabled={!friendInput} className={`px-6 py-2 rounded-lg text-xs font-bold text-white transition-colors ${friendInput ? 'bg-[#5865F2] hover:bg-[#4752c4]' : 'bg-[#222] cursor-not-allowed opacity-50'}`}>Отправить запрос</button></div>{success && <p className="text-[#23A559] text-sm mt-2 font-medium">{success}</p>}{error && <p className="text-[#F23F43] text-sm mt-2 font-medium">{error}</p>}</div>)}
          {tab === 'pending' && user?.requests?.map(r => (<div key={r.from} className="flex items-center justify-between p-3 hover:bg-[#111] rounded-lg border-t border-white/5"><div className="flex items-center gap-3"><img src={r.avatar} className="w-8 h-8 rounded-full" alt="av"/><div><p className="font-bold text-white text-sm">{r.displayName}</p><p className="text-xs text-[#949BA4]">Входящий запрос</p></div></div><div className="flex gap-2"><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'accept' }); refresh(); }} className="p-2 bg-[#222] hover:text-[#23A559] rounded-full"><Check size={18}/></button><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'decline' }); refresh(); }} className="p-2 bg-[#222] hover:text-[#F23F43] rounded-full"><X size={18}/></button></div></div>))}
        </div>
      </div>
    );
}

function CreateServerModal({ user, onClose, refresh }) {
    const [name, setName] = useState("");
    const create = async () => { if(!name) return; await axios.post(`${SERVER_URL}/api/create-server`, { name, owner: user._id }); refresh(); onClose(); };
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[500]"><motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#313338] p-6 rounded-3xl text-center w-full max-w-sm shadow-2xl border border-white/10"><h2 className="text-2xl font-black text-white mb-2">Создать сервер</h2><p className="text-gray-400 text-xs mb-6 px-4">Сервер — это место, где вы можете общаться с друзьями.</p><div className="uppercase text-[10px] font-black text-gray-400 mb-2 text-left tracking-widest">Название сервера</div><input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none mb-6 text-sm" /><div className="flex justify-between items-center"><button onClick={onClose} className="text-gray-300 hover:underline text-sm font-bold">Назад</button><button onClick={create} className="bg-[#5865F2] hover:bg-[#4752c4] px-8 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg">Создать</button></div></motion.div></div>)
}

function SettingsModal({ user, setUser, onClose, onLogout, noise, setNoise, ptt, setPtt, pttKey, setPttKey }) {
    const [activeTab, setActiveTab] = useState('account'); 
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [banner, setBanner] = useState(user?.bannerColor || "#000000");
    const [file, setFile] = useState(null);
    const [email, setEmail] = useState(user?.email || "");
    const [newPass, setNewPass] = useState("");
    const [currPass, setCurrPass] = useState("");
    const [keyWait, setKeyWait] = useState(false);
    
    // Auto launch state
    const [autoLaunch, setAutoLaunch] = useState(false);

    useEffect(() => {
        if (ipcRenderer) {
            ipcRenderer.send('get-auto-launch-status');
            ipcRenderer.on('auto-launch-status', (e, isEnabled) => setAutoLaunch(isEnabled));
        }
        if(keyWait) {
            const h = (e) => { e.preventDefault(); setPttKey(e.code); setKeyWait(false); localStorage.setItem('pttKey', e.code); }
            window.addEventListener('keydown', h);
            return () => window.removeEventListener('keydown', h);
        }
    }, [keyWait]);

    const toggleAutoLaunch = () => {
        const newState = !autoLaunch;
        setAutoLaunch(newState);
        if (ipcRenderer) ipcRenderer.send('toggle-auto-launch', newState);
    };

    const saveProfile = async () => { const fd = new FormData(); fd.append('userId', user._id); fd.append('displayName', displayName); fd.append('bio', bio); fd.append('bannerColor', banner); if(file) fd.append('avatar', file); try { const res = await axios.post(`${SERVER_URL}/api/update-profile`, fd); setUser(res.data); localStorage.setItem('user', JSON.stringify(res.data)); localStorage.setItem('noiseSuppression', noise); localStorage.setItem('pttEnabled', ptt); onClose(); } catch(e) { alert("Ошибка"); } };
    const saveAccount = async () => { try { await axios.post(`${SERVER_URL}/api/update-account`, { userId: user._id, email, newPassword: newPass, currentPassword: currPass }); alert("Аккаунт обновлен!"); onClose(); } catch(e) { alert(e.response?.data?.error || "Ошибка"); } };
    
    return (<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-8"><motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-[#313338] w-full max-w-4xl h-[80vh] rounded-[30px] flex overflow-hidden shadow-2xl border border-white/5"><div className="w-64 bg-[#2B2D31] p-6 pt-10"><p className="uppercase text-[10px] font-black text-gray-400 px-2 mb-2 tracking-widest">Настройки пользователя</p><div onClick={()=>setActiveTab('account')} className={`px-3 py-2 rounded-lg text-sm font-bold mb-1 cursor-pointer ${activeTab==='account' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C]'}`}>Моя учетная запись</div><div onClick={()=>setActiveTab('profile')} className={`px-3 py-2 rounded-lg text-sm font-bold mb-1 cursor-pointer ${activeTab==='profile' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C]'}`}>Профиль</div><div className="h-[1px] bg-white/10 my-4 mx-2"/><div onClick={onLogout} className="text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between transition-colors">Выйти <LogOut size={16}/></div></div><div className="flex-1 p-10 overflow-y-auto relative bg-[#313338]"><div onClick={onClose} className="absolute top-6 right-6 p-2 border-2 border-gray-500 rounded-full text-gray-500 hover:text-white hover:border-white cursor-pointer transition-all opacity-70 hover:opacity-100"><X size={20}/></div>{activeTab === 'account' && (<><h2 className="text-xl font-black text-white mb-6">Моя учетная запись</h2><div className="bg-[#1E1F22] rounded-2xl p-6 mb-8 flex items-center gap-6 border border-white/5"><div className="relative"><img src={user?.avatar} className="w-20 h-20 rounded-full bg-[#111]" alt="av"/><div className="absolute -bottom-1 -right-1 p-1 bg-[#1E1F22] rounded-full"><div className="w-4 h-4 bg-green-500 rounded-full border-2 border-[#1E1F22]"/></div></div><div><h3 className="text-2xl font-black text-white">{user?.displayName}</h3><p className="text-sm font-bold text-gray-400">@{user?.username}</p></div><button onClick={()=>setActiveTab('profile')} className="ml-auto bg-[#5865F2] px-6 py-2 rounded-xl text-white font-bold text-sm hover:bg-[#4752c4]">Редактировать профиль</button></div><div className="bg-[#1E1F22] rounded-2xl p-6 border border-white/5 space-y-6"><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Email</label><input value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Новый пароль</label><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Текущий пароль (для подтверждения)</label><input type="password" value={currPass} onChange={e=>setCurrPass(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div></div></div><div className="mt-6 flex justify-end"><button onClick={saveAccount} className="bg-green-600 px-8 py-2.5 rounded-xl font-bold text-white shadow-lg hover:bg-green-500 transition-all">Сохранить изменения</button></div></>)}{activeTab === 'profile' && (<><h2 className="text-xl font-black text-white mb-6">Профиль</h2><div className="bg-[#1E1F22] rounded-2xl overflow-hidden mb-8 border border-white/5"><div style={{ backgroundColor: banner }} className="h-32 w-full relative group"><div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><input type="color" className="cursor-pointer w-8 h-8 opacity-0 absolute" onChange={e=>setBanner(e.target.value)}/><div className="bg-black/50 p-1.5 rounded-lg backdrop-blur-sm"><Settings size={16} className="text-white"/></div></div></div><div className="px-6 pb-6 flex justify-between items-end -mt-10"><div className="flex items-end gap-4"><div className="relative group"><img src={file ? URL.createObjectURL(file) : user?.avatar} className="w-24 h-24 rounded-full border-[6px] border-[#1E1F22] bg-[#1E1F22] object-cover" alt="av" /><label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer border-[6px] border-transparent transition-all"><Camera size={24} className="text-white"/><input type="file" hidden onChange={e=>setFile(e.target.files[0])}/></label></div></div></div><div className="p-6 pt-0 grid grid-cols-2 gap-6"><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Отображаемое имя</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">О себе</label><textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none h-[46px] resize-none" /></div></div></div><h2 className="text-xl font-black text-white mb-4">Настройки приложения</h2><div className="bg-[#1E1F22] p-6 rounded-2xl mb-8 border border-white/5 space-y-6"><div className="flex items-center justify-between"><div><h4 className="font-bold text-gray-200">Шумоподавление</h4><p className="text-xs text-gray-400 mt-1">Убирает фоновый шум из вашего микрофона.</p></div><div onClick={()=>setNoise(!noise)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${noise ? 'bg-green-500' : 'bg-gray-500'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${noise ? 'translate-x-6' : 'translate-x-0'}`}/></div></div><div className="h-[1px] bg-white/5"/><div className="flex items-center justify-between"><div><h4 className="font-bold text-gray-200">Push-to-Talk</h4><p className="text-xs text-gray-400 mt-1">Микрофон работает только при удержании клавиши.</p></div><div onClick={()=>setPtt(!ptt)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${ptt ? 'bg-green-500' : 'bg-gray-500'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${ptt ? 'translate-x-6' : 'translate-x-0'}`}/></div></div>{ptt && <div className="flex items-center gap-4 bg-black/30 p-2 rounded"><span className="text-sm font-bold text-gray-400">Клавиша:</span><button onClick={()=>setKeyWait(true)} className="bg-[#404249] px-4 py-1 rounded text-white font-mono text-sm border border-white/10 hover:border-white/50">{keyWait ? 'Нажмите клавишу...' : pttKey}</button></div>}<div className="h-[1px] bg-white/5"/><div className="flex items-center justify-between"><div><h4 className="font-bold text-gray-200">Запускать вместе с Windows</h4><p className="text-xs text-gray-400 mt-1">Автоматически открывать TalkSpace при входе в систему.</p></div><div onClick={toggleAutoLaunch} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${autoLaunch ? 'bg-green-500' : 'bg-gray-500'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${autoLaunch ? 'translate-x-6' : 'translate-x-0'}`}/></div></div></div><div className="flex justify-end gap-4"><button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-sm">Отмена</button><button onClick={saveProfile} className="bg-[#5865F2] px-8 py-2.5 rounded-xl font-bold text-white shadow-lg hover:bg-[#4752c4] transition-all">Сохранить</button></div></>)}</div></motion.div></div>);
}

// --- CALL HEADER COMPONENT ---
function CallHeader({ callActive, incoming, onAccept, onReject, onHangup, localStream, remoteStream, toggleMic, toggleCam, shareScreen, isMicOn, isCamOn, isScreenOn, friend }) {
    if(!callActive && !incoming) return null;
    return (
        <div className="bg-[#000] p-4 border-b border-white/5 flex flex-col items-center justify-center relative min-h-[200px] z-30">
            {incoming ? (
                <div className="text-center animate-bounce">
                    <img src={friend?.avatar} className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.5)]" alt="caller"/>
                    <h3 className="text-xl font-bold text-white mb-6">Входящий звонок от {friend?.displayName}...</h3>
                    <div className="flex gap-8 justify-center">
                        <button onClick={onAccept} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><Phone size={32} className="text-white"/></button>
                        <button onClick={onReject} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><PhoneOff size={32} className="text-white"/></button>
                    </div>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col">
                    <div className="flex-1 flex items-center justify-center gap-4 relative overflow-hidden rounded-xl bg-[#111] mb-4 min-h-[300px]">
                        {/* Remote Stream */}
                        {remoteStream && remoteStream.getVideoTracks().length > 0 ? (
                            <video autoPlay ref={v => v && (v.srcObject = remoteStream)} className="w-full h-full object-contain" />
                        ) : (
                            <div className="flex flex-col items-center"><img src={friend?.avatar} className="w-24 h-24 rounded-full mb-4 animate-pulse" alt="friend"/><p className="text-gray-400 font-bold">Звонок идет...</p></div>
                        )}
                        {/* Local Stream PIP */}
                        <div className="absolute bottom-4 right-4 w-48 h-36 bg-black rounded-lg border border-white/10 overflow-hidden shadow-2xl">
                             {localStream && isCamOn ? <video autoPlay muted ref={v => v && (v.srcObject = localStream)} className="w-full h-full object-cover -scale-x-100" /> : <div className="w-full h-full flex items-center justify-center bg-[#222]"><Users size={24} className="text-gray-500"/></div>}
                        </div>
                    </div>
                    <div className="flex justify-center gap-4">
                        <button onClick={toggleMic} className={`p-4 rounded-full ${isMicOn ? 'bg-[#2B2D31] hover:bg-[#404249]' : 'bg-red-500 text-white'} transition-colors`}>{isMicOn ? <Mic size={24}/> : <MicOff size={24}/>}</button>
                        <button onClick={toggleCam} className={`p-4 rounded-full ${isCamOn ? 'bg-[#2B2D31] hover:bg-[#404249]' : 'bg-red-500 text-white'} transition-colors`}>{isCamOn ? <Video size={24}/> : <VideoOff size={24}/>}</button>
                        <button onClick={shareScreen} className={`p-4 rounded-full ${isScreenOn ? 'bg-green-500 text-white' : 'bg-[#2B2D31] hover:bg-[#404249]'} transition-colors`}><Monitor size={24}/></button>
                        <button onClick={onHangup} className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors shadow-lg"><PhoneOff size={24} className="text-white"/></button>
                    </div>
                </div>
            )}
        </div>
    )
}

const BackgroundEffect = () => (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-[spin_100s_linear_infinite]"/>
        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[var(--primary)]/10 to-transparent"/>
    </div>
);

// --- AUTH COMPONENT (SAME AS BEFORE) ---
function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loginData, setLoginData] = useState({ login: '', password: '' });
  const [regData, setRegData] = useState({ email: '', displayName: '', username: '', password: '', day: '', month: '', year: '' });
  const [usernameStatus, setUsernameStatus] = useState(null); 
  const [error, setError] = useState("");

  useEffect(() => { if(isLogin || !regData.username) return; const timeout = setTimeout(async () => { try { const res = await axios.post(`${SERVER_URL}/api/check-username`, { username: regData.username }); setUsernameStatus(res.data.available ? 'free' : 'taken'); } catch(e) {} }, 500); return () => clearTimeout(timeout); }, [regData.username, isLogin]);
  const handleLogin = async () => { try { const res = await axios.post(`${SERVER_URL}/api/login`, loginData); onAuth(res.data); } catch(e) { setError(e.response?.data?.error || "Неверный логин или пароль"); } };
  const handleRegister = async () => { try { if(usernameStatus !== 'free') return setError("Имя пользователя занято"); if(!regData.day || !regData.month || !regData.year) return setError("Укажите дату рождения"); const res = await axios.post(`${SERVER_URL}/api/register`, { ...regData, dob: { day: regData.day, month: regData.month, year: regData.year } }); onAuth(res.data); } catch(e) { setError(e.response?.data?.error || "Ошибка регистрации"); } };

  return (
    <div className="h-screen flex items-center justify-center relative bg-[#000] overflow-hidden drag-region">
      <div className="absolute inset-0 bg-black">
          <div className="absolute top-[-20%] left-[-20%] w-[50vw] h-[50vw] bg-blue-900/20 rounded-full blur-[120px]"/>
          <div className="absolute bottom-[-20%] right-[-20%] w-[50vw] h-[50vw] bg-purple-900/20 rounded-full blur-[120px]"/>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#050505]/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-[420px] z-10 relative border border-white/10 no-drag">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white tracking-tight">TALKSPACE</h1>
            <p className="text-gray-500 text-xs tracking-[0.2em] mt-1 font-bold">SECURE COMMUNICATION UPLINK</p>
        </div>

        {isLogin ? (
            <>
                <Input label="Логин" required value={loginData.login} onChange={e=>setLoginData({...loginData, login:e.target.value})} className="mb-6"/>
                <Input label="Пароль" type="password" required value={loginData.password} onChange={e=>setLoginData({...loginData, password:e.target.value})}/>
                <button onClick={handleLogin} className="w-full bg-white hover:bg-gray-200 text-black font-black py-3 rounded-[4px] transition-all mb-4 mt-6 uppercase tracking-wider text-xs">Войти в систему</button>
                <div className="text-xs text-center text-gray-500">Нет аккаунта? <span onClick={()=>setIsLogin(false)} className="text-white cursor-pointer hover:underline font-bold">Создать ID</span></div>
            </>
        ) : (
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                <Input label="E-mail" required value={regData.email} onChange={e=>setRegData({...regData, email:e.target.value})}/>
                <Input label="Никнейм" value={regData.displayName} onChange={e=>setRegData({...regData, displayName:e.target.value})}/>
                
                <div className="mb-4">
                    <label className={`block text-[11px] font-bold uppercase mb-1.5 tracking-wide ${usernameStatus==='taken'?'text-red-400':'text-gray-400'}`}>ID (Логин) *</label>
                    <input value={regData.username} onChange={e=>setRegData({...regData, username:e.target.value})} className={`w-full bg-[#111] border ${usernameStatus === 'free' ? 'border-green-500/50' : 'border-white/10'} p-2.5 rounded-[3px] text-white outline-none text-sm transition-all`} />
                </div>
                
                <Input label="Пароль" type="password" required value={regData.password} onChange={e=>setRegData({...regData, password:e.target.value})}/>
                
                <div className="mb-6">
                    <label className="block text-[11px] font-bold uppercase text-gray-400 mb-2">Дата рождения</label>
                    <div className="flex gap-2">
                        <div className="w-[30%]"><CustomSelect placeholder="ДД" value={regData.day} options={[...Array(31)].map((_,i)=>i+1)} onChange={v=>setRegData({...regData, day:v})} /></div>
                        <div className="w-[40%]"><CustomSelect placeholder="ММ" value={regData.month} options={["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]} onChange={v=>setRegData({...regData, month:v})} /></div>
                        <div className="w-[30%]"><CustomSelect placeholder="ГГГГ" value={regData.year} options={[...Array(100)].map((_,i)=>2024-i)} onChange={v=>setRegData({...regData, year:v})} /></div>
                    </div>
                </div>
                <button onClick={handleRegister} className="w-full bg-white hover:bg-gray-200 text-black font-black py-3 rounded-[4px] transition-all mt-4 uppercase tracking-wider text-xs">Инициализация</button>
                <div className="text-xs text-gray-500 mt-4 cursor-pointer hover:underline font-bold text-center" onClick={()=>{setIsLogin(true); setError("")}}>Вернуться к входу</div>
            </div>
        )}
        {error && <div className="mt-4 bg-red-900/20 border border-red-500/50 text-red-200 p-3 rounded text-xs text-center font-bold flex items-center justify-center gap-2"><AlertCircle size={16}/> {error}</div>}
      </motion.div>
    </div>
  );
}