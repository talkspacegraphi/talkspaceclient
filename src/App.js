import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'peerjs';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, MessageSquare, Check, X, Settings, Mic, MicOff, 
  Monitor, Send, Phone, PhoneOff, Video, VideoOff, Plus, 
  Menu, Camera, Smile, Reply, Hash, LogOut, Minus, Square, 
  Trash, LogOut as LeaveIcon, Link as LinkIcon, Maximize, Minimize, AlertCircle, ChevronDown, User, Key
} from 'lucide-react';

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null };

const SERVER_URL = "https://talkspace-7fwq.onrender.com"; 
const socket = io(SERVER_URL);
const PEER_CONFIG = { host: '0.peerjs.com', port: 443, secure: true };

// SOUNDS
const msgSound = new Audio("./sounds/message.mp3");
const callSound = new Audio("./sounds/call.mp3");
callSound.loop = true;

// LOADING FACTS
const LOADING_FACTS = [
    "Знаете ли вы? Используйте CTRL + / для списка горячих клавиш.",
    "TalkSpace был создан, чтобы объединять людей.",
    "Вы можете настроить шумоподавление в настройках.",
    "ПКМ по серверу открывает дополнительные опции.",
    "Мы любим темную тему так же, как и вы."
];

// --- COMPONENTS ---

function TitleBar() {
  if (!ipcRenderer) return null;
  return (
    <div className="h-8 bg-[#0B0B0C] flex items-center justify-between select-none w-full border-b border-white/5 z-[9999] fixed top-0 left-0 right-0 drag-region backdrop-blur-md">
       <div className="flex items-center gap-2 px-3 no-drag">
           <div className="w-3 h-3 bg-[#5865F2] rounded-full flex items-center justify-center font-black text-[6px] text-white">T</div>
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

function LoadingScreen() {
    const [fact, setFact] = useState(LOADING_FACTS[0]);
    useEffect(() => { setFact(LOADING_FACTS[Math.floor(Math.random() * LOADING_FACTS.length)]); }, []);

    return (
        <div className="fixed inset-0 bg-[#0B0B0C] z-[9999] flex flex-col items-center justify-center text-center p-4">
            <motion.div 
                animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 bg-[#5865F2] rounded-[24px] mb-8 flex items-center justify-center shadow-[0_0_50px_rgba(88,101,242,0.5)]"
            >
                <div className="text-white font-black text-3xl">T</div>
            </motion.div>
            <h2 className="text-white font-bold text-lg mb-2 uppercase tracking-widest">Загрузка...</h2>
            <p className="text-gray-500 text-sm max-w-md animate-pulse">{fact}</p>
        </div>
    )
}

function BackgroundEffect() {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0B0B0C]">
          <motion.div animate={{ x: [0, 100, 0], y: [0, -50, 0], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 15, repeat: Infinity }} className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-purple-900/10 rounded-full blur-[150px]" />
          <motion.div animate={{ x: [0, -100, 0], y: [0, 50, 0], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 18, repeat: Infinity }} className="absolute bottom-0 right-0 w-[70vw] h-[70vw] bg-blue-900/10 rounded-full blur-[150px]" />
      </div>
    );
}

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [token]);

  const handleAuth = (data) => {
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    setLoading(true); // Trigger loading screen after auth
    setTimeout(() => setLoading(false), 2000);
  };

  const logout = () => { localStorage.clear(); setToken(null); setUser(null); };

  if (loading) return <LoadingScreen />;

  return (
    <Router>
      <div className="bg-[#0B0B0C] text-white font-sans h-screen flex flex-col pt-8 selection:bg-[#5865F2] selection:text-white overflow-hidden">
        <BackgroundEffect />
        <TitleBar />
        <div className="flex-1 overflow-hidden relative z-10">
            <Routes>
                <Route path="/login" element={!token ? <Auth onAuth={handleAuth} /> : <Navigate to="/friends" />} />
                <Route path="/*" element={token && user ? <MainLayout user={user} setUser={setUser} onLogout={logout} /> : <Navigate to="/login" />} />
            </Routes>
        </div>
      </div>
    </Router>
  );
}

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
        if(!window.location.hash.includes('/chat') || document.hidden) {
            msgSound.play().catch(()=>{});
            if(ipcRenderer) ipcRenderer.send('flash-frame');
            // Нативное уведомление
            if(Notification.permission === "granted") {
                new Notification(`TalkSpace: ${msg.senderName}`, { body: msg.text, icon: msg.avatar, silent: true });
            } else { Notification.requestPermission(); }
        }
    });

    return () => { socket.off('refresh'); socket.off('new_msg'); socket.off('refresh_user'); };
  }, [user?._id, refresh]);

  const updateStatus = async (status, activity = "") => {
    try {
        const res = await axios.post(`${SERVER_URL}/api/update-profile`, { userId: user._id, status, activity });
        setUser(res.data); setStatusMenu(false);
    } catch(e) {}
  };

  const StatusDot = ({ status, size = "w-3 h-3" }) => {
    const color = status === 'online' ? 'bg-green-500' : status === 'dnd' ? 'bg-red-500' : 'bg-yellow-500';
    return <div className={`${size} rounded-full ${color} border-[2px] border-[#0B0B0C] absolute -bottom-0.5 -right-0.5`} />;
  };

  // SERVER CONTEXT MENU
  const handleContextMenu = (e, s) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, serverId: s._id, ownerId: s.owner, name: s.name }); };
  const deleteServer = async () => {
      if(!window.confirm(`Удалить ${contextMenu.name}?`)) return;
      await axios.post(`${SERVER_URL}/api/delete-server`, { serverId: contextMenu.serverId });
      refresh(); setContextMenu(null); navigate('/friends');
  };
  const leaveServer = async () => {
      if(!window.confirm(`Выйти из ${contextMenu.name}?`)) return;
      await axios.post(`${SERVER_URL}/api/leave-server`, { serverId: contextMenu.serverId, userId: user._id });
      refresh(); setContextMenu(null); navigate('/friends');
  };
  const inviteServer = () => {
      navigator.clipboard.writeText("INVITE-" + contextMenu.serverId.slice(-6).toUpperCase());
      alert("Код скопирован"); setContextMenu(null);
  };

  return (
    <div className="relative flex h-full z-10 overflow-hidden" onClick={()=>setContextMenu(null)}>
      {/* 1. SERVER LIST */}
      <div className="w-[72px] flex flex-col items-center py-3 gap-3 bg-[#0B0B0C] border-r border-white/5 shrink-0 z-20 overflow-y-auto no-scrollbar">
        <div onClick={() => navigate('/friends')} className="relative w-12 h-12 bg-[#313338] hover:bg-[#5865F2] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 group shadow-md">
          <MessageSquare size={24} className="text-gray-300 group-hover:text-white" />
          {user?.requests?.length > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-[#0B0B0C] text-[10px] font-bold text-white shadow-lg">{user.requests.length}</div>}
        </div>
        <div className="w-8 h-[2px] bg-white/10 rounded-full" />
        {user?.servers?.map(s => (
            <div key={s._id} onClick={() => navigate(`/server/${s._id}`)} onContextMenu={(e) => handleContextMenu(e, s)} className="w-12 h-12 bg-[#313338] hover:bg-[#5865F2] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 text-white font-bold uppercase shadow-md relative select-none text-xs overflow-hidden border border-white/5">
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
          <Route path="/server/:serverId" element={<ServerView user={user} />} />
          <Route path="*" element={<Navigate to="/friends" />} />
        </Routes>
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div style={{ top: contextMenu.y, left: contextMenu.x }} className="fixed bg-[#111] border border-white/10 rounded-xl shadow-2xl z-[300] py-1 w-48 font-bold">
              <button onClick={inviteServer} className="w-full text-left px-3 py-2 text-indigo-400 hover:bg-[#5865F2] hover:text-white text-xs flex items-center gap-2"><LinkIcon size={14}/> Пригласить</button>
              <div className="h-[1px] bg-white/10 my-1"/>
              {contextMenu.ownerId === user._id ? (
                  <button onClick={deleteServer} className="w-full text-left px-3 py-2 text-red-500 hover:bg-red-500 hover:text-white text-xs flex items-center gap-2"><Trash size={14}/> Удалить</button>
              ) : (
                  <button onClick={leaveServer} className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500 hover:text-white text-xs flex items-center gap-2"><LeaveIcon size={14}/> Покинуть</button>
              )}
          </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showSettings && <SettingsModal user={user} setUser={setUser} onClose={() => setShowSettings(false)} onLogout={onLogout} noise={noiseSuppression} setNoise={setNoiseSuppression} />}
        {createSeverModal && <CreateServerModal user={user} onClose={() => setCreateServerModal(false)} refresh={refresh} />}
      </AnimatePresence>
    </div>
  );
}

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
            <div className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:bg-[#1E1F22] rounded-lg cursor-pointer transition-colors"><Hash size={18}/><span className="font-bold text-sm">general</span></div>
            <div className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:bg-[#1E1F22] rounded-lg cursor-pointer transition-colors"><Hash size={18}/><span className="font-bold text-sm">voice</span></div>
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

// --- CALL HEADER (FIXED) ---
function CallHeader({ callActive, incoming, onAccept, onReject, onHangup, localStream, remoteStream, toggleMic, toggleCam, shareScreen, isMicOn, isCamOn, isScreenOn, friend }) {
    if (!callActive && !incoming) return null;
    const [fullScreen, setFullScreen] = useState(false);

    const PulseAvatar = ({ src }) => (
        <div className="relative flex items-center justify-center w-full h-full">
            <span className="absolute inline-flex h-32 w-32 rounded-full bg-green-500 opacity-20 animate-ping"></span>
            <img src={src} className="w-24 h-24 rounded-full border-4 border-[#1E1F22] relative z-10 object-cover shadow-2xl" alt="av"/>
        </div>
    );

    return (
        <div className={`bg-black border-b border-white/5 shrink-0 relative flex flex-col transition-all duration-300 ${fullScreen ? 'fixed inset-0 z-[100] h-screen border-none p-6' : 'p-3'}`}>
            {fullScreen && <div className="absolute top-4 right-4 z-50"><button onClick={()=>setFullScreen(false)} className="bg-black/50 p-2 rounded-xl hover:bg-black/80 text-white"><Minimize size={20}/></button></div>}

            {/* INCOMING */}
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

            {/* ACTIVE */}
            {callActive && (
                <div className={`flex flex-col gap-3 ${fullScreen ? 'h-full' : ''}`}>
                    <div className={`flex gap-3 w-full ${fullScreen ? 'flex-1' : 'h-64'}`}>
                        {/* REMOTE STREAM */}
                        <div className="flex-1 bg-[#111] rounded-2xl overflow-hidden relative flex items-center justify-center group border border-white/5 shadow-inner">
                            {remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled ? (
                                <video ref={v => {if(v) v.srcObject = remoteStream}} autoPlay className="w-full h-full object-cover" />
                            ) : (
                                <PulseAvatar src={friend?.avatar || 'https://via.placeholder.com/100'} />
                            )}
                            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-lg text-xs font-bold text-white backdrop-blur-sm">{friend?.displayName}</div>
                            {!fullScreen && <button onClick={()=>setFullScreen(true)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 bg-black/60 p-2 rounded-lg text-white transition-all hover:bg-black"><Maximize size={16}/></button>}
                        </div>
                        
                        {/* LOCAL STREAM (PiP) */}
                        <div className="w-48 bg-[#111] rounded-2xl overflow-hidden relative shadow-2xl border border-white/10 group">
                             {isCamOn || isScreenOn ? (
                                <video ref={v => {if(v) v.srcObject = localStream}} autoPlay muted className={`w-full h-full object-cover ${!isScreenOn ? 'mirror' : ''}`} />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[#18191C]"><img src={user?.avatar} className="w-16 h-16 rounded-full opacity-50" alt="me"/></div>
                             )}
                             <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-md text-[10px] font-bold text-white">Вы</div>
                        </div>
                    </div>
                    
                    {/* CONTROLS */}
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

function ChatView({ user, noiseSuppression }) {
  const { friendId } = useParams();
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [isIncoming, setIsIncoming] = useState(null);
  const [peerCall, setPeerCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(false);
  const [isScreenOn, setIsScreenOn] = useState(false);
  
  const peerInstance = useRef(null);
  const scrollRef = useRef();
  
  const friend = activeChat?.members?.find(m => m._id !== user._id);

  useEffect(() => {
    const peer = new Peer(user._id, PEER_CONFIG);
    peerInstance.current = peer;

    peer.on('call', (call) => { 
        callSound.play(); setPeerCall(call); setIsIncoming({ from: "Входящий звонок" }); 
        call.on('stream', (rs) => setRemoteStream(rs));
    });

    axios.post(`${SERVER_URL}/api/start-chat`, { myId: user._id, friendId }).then(res => {
        setActiveChat(res.data); setMessages(res.data.messages || []); socket.emit('join_chat', res.data._id);
    });

    socket.on('new_msg', (m) => setMessages(prev => [...prev, m]));
    socket.on('incoming_call_signal', (d) => { callSound.play(); setIsIncoming(d); });
    socket.on('call_ended', endCall);

    return () => { 
        socket.off('new_msg'); socket.off('incoming_call_signal'); socket.off('call_ended'); 
        peer.destroy(); endCall();
    };
  }, [user._id, friendId]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = () => {
    if (!msgText.trim()) return;
    socket.emit('send_msg', { chatId: activeChat._id, text: msgText, senderId: user._id, senderName: user.displayName, avatar: user.avatar, replyTo });
    setMsgText(""); setReplyTo(null);
  };

  const getMediaConstraints = (video) => ({
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: { echoCancellation: true, noiseSuppression: noiseSuppression, autoGainControl: true }
  });

  const startCall = async (withVideo) => {
    try {
        const s = await navigator.mediaDevices.getUserMedia(getMediaConstraints(withVideo));
        setLocalStream(s); setCallActive(true); setIsCamOn(withVideo); setIsMicOn(true);
        const call = peerInstance.current.call(friendId, s);
        call.on('stream', (rs) => setRemoteStream(rs));
        socket.emit('call_user', { userToCall: friendId, from: user.displayName, fromId: user._id });
    } catch(e) { alert("Ошибка доступа к устройствам."); }
  };

  const answerCall = async () => {
      callSound.pause(); callSound.currentTime = 0;
      const s = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false)); 
      setLocalStream(s); setCallActive(true); setIsIncoming(null); setIsCamOn(false);
      peerCall.answer(s);
      peerCall.on('stream', (rs) => setRemoteStream(rs));
  };

  const endCall = () => {
      if(localStream) localStream.getTracks().forEach(t=>t.stop());
      callSound.pause(); callSound.currentTime = 0;
      setCallActive(false); setLocalStream(null); setRemoteStream(null); setIsIncoming(null); setIsScreenOn(false);
  };

  const toggleMic = () => {
      if(localStream) {
          const track = localStream.getAudioTracks()[0];
          if(track) { track.enabled = !track.enabled; setIsMicOn(track.enabled); }
      }
  };

  const toggleCam = async () => {
      if (isCamOn) {
          localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); });
          setIsCamOn(false);
      } else {
          try {
             const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280 } });
             const videoTrack = videoStream.getVideoTracks()[0];
             localStream.addTrack(videoTrack);
             const sender = peerCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
             if (sender) sender.replaceTrack(videoTrack);
             else peerCall.peerConnection.addTrack(videoTrack, localStream);
             setIsCamOn(true);
          } catch(e) { alert("Камера не найдена"); }
      }
  };

  const shareScreen = async () => {
      if(!isScreenOn) {
         try {
             const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080, frameRate: 60 }, audio: true });
             const screenTrack = screenStream.getVideoTracks()[0];
             const sender = peerCall.peerConnection.getSenders().find(s => s.track.kind === 'video' || s.track.kind === 'screen');
             if(sender) sender.replaceTrack(screenTrack);
             else peerCall.peerConnection.addTrack(screenTrack, localStream);
             const oldTracks = localStream.getVideoTracks();
             oldTracks.forEach(t => { t.enabled = false; });
             localStream.addTrack(screenTrack);
             screenTrack.onended = () => {
                 screenTrack.stop();
                 if(isCamOn && oldTracks.length > 0) { oldTracks[0].enabled = true; sender.replaceTrack(oldTracks[0]); }
                 setIsScreenOn(false);
             };
             setIsScreenOn(true);
         } catch(e) { console.error(e); }
      } else {
          const screenTrack = localStream.getVideoTracks().find(t => t.label.includes('screen') || t.label.includes('window'));
          if(screenTrack) screenTrack.stop();
          setIsScreenOn(false);
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

      <CallHeader 
          callActive={callActive} incoming={isIncoming}
          onAccept={answerCall} onReject={() => {callSound.pause(); callSound.currentTime=0; setIsIncoming(null)}} onHangup={() => {socket.emit('hangup', {to: friendId}); endCall();}}
          localStream={localStream} remoteStream={remoteStream}
          toggleMic={toggleMic} toggleCam={toggleCam} shareScreen={shareScreen}
          isMicOn={isMicOn} isCamOn={isCamOn} isScreenOn={isScreenOn}
          friend={friend}
      />

      <div className="flex-1 p-6 overflow-y-auto space-y-6 flex flex-col">
          {messages.map((m, i) => {
            const isMe = m.senderId === user._id;
            return (
                <div key={i} className={`flex gap-4 group ${isMe ? 'flex-row-reverse' : ''}`}>
                    <img src={m.avatar || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full shrink-0 bg-zinc-800 object-cover mt-1" alt="m" />
                    <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-baseline gap-2 mb-1"><span className="text-sm font-bold text-white">{m.senderName}</span><span className="text-[10px] text-gray-400 font-medium">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                        {m.replyTo && <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 opacity-70 italic border-l-2 border-gray-500 pl-2"><Reply size={10}/> {m.replyTo.text}</div>}
                        <div className="relative group">
                            <p className={`text-[15px] px-4 py-2.5 rounded-2xl shadow-sm leading-relaxed ${isMe ? 'bg-[#5865F2] text-white rounded-tr-none' : 'bg-[#2B2D31] text-gray-100 rounded-tl-none'}`}>{m.text}</p>
                            <div className={`absolute -top-4 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 bg-[#111] p-1.5 rounded-lg border border-white/10 flex gap-1 shadow-xl transition-all`}><button onClick={()=>setReplyTo(m)} className="hover:text-[#5865F2]"><Reply size={14}/></button></div>
                        </div>
                    </div>
                </div>
            )
          })}
          <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-[#1E1F22] shrink-0 z-20">
          {replyTo && <div className="flex justify-between bg-[#2B2D31] p-2 px-4 rounded-t-xl text-xs text-gray-300 border-b border-black/10 items-center"><span>Ответ для: <span className="font-bold">{replyTo.senderName}</span></span><button onClick={()=>setReplyTo(null)}><X size={14}/></button></div>}
          <div className={`flex items-center gap-3 bg-[#383A40] p-2.5 px-4 ${replyTo ? 'rounded-b-2xl' : 'rounded-[24px]'} transition-all`}>
              <Plus size={22} className="text-gray-400 hover:text-white cursor-pointer bg-[#2B2D31] rounded-full p-1"/>
              <input value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=> {if(e.key === 'Enter') send();}} className="flex-1 bg-transparent outline-none text-gray-200 text-sm py-1 placeholder:text-gray-500" placeholder={`Написать @${friend?.displayName}`} />
              <button onClick={send} className="text-gray-400 hover:text-[#5865F2] transition-colors"><Send size={22} /></button>
          </div>
      </div>
    </div>
  );
}

function ServerView({ user }) {
    const { serverId } = useParams();
    const server = user?.servers?.find(s => s._id === serverId);
    if(!server) return <div className="flex-1 flex items-center justify-center text-gray-500 font-bold">Сервер не найден</div>;
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Hash size={64} className="mb-4 opacity-20"/>
            <h2 className="text-2xl font-bold text-white mb-2">Добро пожаловать в {server.name}</h2>
            <p className="text-sm">Начало истории этого сервера.</p>
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
      <div className="flex flex-col h-full bg-[#1E1F22]">
        <div className="h-12 flex items-center px-6 border-b border-white/5 gap-6 shadow-sm">
          <div className="flex items-center gap-2 text-white font-bold"><Users size={20} /><span>Друзья</span></div>
          <div className="h-4 w-[1px] bg-white/10"/>
          <div className="flex gap-2">
              {['all', 'pending', 'add'].map(t => (
              <button key={t} onClick={() => {setTab(t); setError(""); setSuccess("");}} className={`px-3 py-0.5 rounded-lg text-sm font-bold transition-colors ${tab === t ? (t==='add'?'text-green-500 bg-transparent':'bg-[#3F4147] text-white') : (t==='add'?'bg-green-600 text-white px-3':'text-gray-400 hover:bg-[#35373C] hover:text-gray-200')}`}>
                  {t === 'all' ? 'Все' : t === 'pending' ? `Ожидание ${user?.requests?.length ? `(${user.requests.length})` : ''}` : 'Добавить друга'}
              </button>
              ))}
          </div>
        </div>
        <div className="p-8 overflow-y-auto">
          {tab === 'all' && (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Все друзья — {user?.friends?.length || 0}</p>
                {user?.friends?.map(f => (
                    <div key={f._id} onClick={() => navigate(`/chat/${f._id}`)} className="flex items-center justify-between p-3 hover:bg-[#35373C] rounded-2xl cursor-pointer group border-t border-white/5">
                        <div className="flex items-center gap-3"><img src={f.avatar} className="w-9 h-9 rounded-full object-cover" alt="av" /><div><p className="font-bold text-white text-sm">{f.displayName} <span className="hidden group-hover:inline text-gray-400 text-xs font-normal">@{f.username}</span></p><p className="text-[11px] text-gray-400 font-bold uppercase">{f.status}</p></div></div>
                        <div className="p-2.5 bg-[#2B2D31] rounded-full text-gray-400 group-hover:text-gray-200"><MessageSquare size={18} /></div>
                    </div>
                ))}
              </>
          )}
          {tab === 'add' && (
            <div className="w-full max-w-2xl">
              <h3 className="text-white font-bold text-base mb-2 uppercase">Добавить друга</h3>
              <p className="text-gray-400 text-xs mb-4">Вы можете добавить друзей по имени пользователя (например: graphi). Регистр важен!</p>
              <div className={`bg-[#1E1F22] p-2.5 rounded-xl border-2 flex items-center transition-all ${borderClass}`}><input value={friendInput} onChange={handleInput} className="bg-transparent flex-1 p-1 outline-none text-white text-sm placeholder:text-gray-500" placeholder="Имя пользователя" /><button onClick={sendRequest} disabled={!friendInput} className={`px-6 py-2 rounded-lg text-xs font-bold text-white transition-colors ${friendInput ? 'bg-[#5865F2] hover:bg-[#4752c4]' : 'bg-[#3B405A] cursor-not-allowed opacity-50'}`}>Отправить запрос</button></div>
              {success && <p className="text-green-500 text-xs mt-2 font-bold">{success}</p>}
              {error && <p className="text-red-500 text-xs mt-2 font-bold">{error}</p>}
            </div>
          )}
          {tab === 'pending' && user?.requests?.map(r => (
              <div key={r.from} className="flex items-center justify-between p-4 hover:bg-[#35373C] rounded-2xl border-t border-white/5"><div className="flex items-center gap-3"><img src={r.avatar} className="w-10 h-10 rounded-full" alt="av"/><div><p className="font-bold text-white text-sm">{r.displayName}</p><p className="text-xs text-gray-400 font-bold">@{r.username}</p></div></div><div className="flex gap-2"><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'accept' }); refresh(); }} className="p-2.5 bg-[#2B2D31] hover:text-green-500 rounded-full"><Check size={18}/></button><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'decline' }); refresh(); }} className="p-2.5 bg-[#2B2D31] hover:text-red-500 rounded-full"><X size={18}/></button></div></div>
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
    const [activeTab, setActiveTab] = useState('account'); // account, profile
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

// --- AUTH (FIXED INPUT FOCUS) ---
function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // States
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [regPass, setRegPass] = useState("");
  const [day, setDay] = useState("День");
  const [month, setMonth] = useState("Месяц");
  const [year, setYear] = useState("Год");

  const [usernameStatus, setUsernameStatus] = useState(null);
  const [error, setError] = useState("");

  // Debounce check
  useEffect(() => {
      if(isLogin || !username) return;
      const timeout = setTimeout(async () => {
          try {
             const res = await axios.post(`${SERVER_URL}/api/check-username`, { username });
             setUsernameStatus(res.data.available ? 'free' : 'taken');
          } catch(e) {}
      }, 500);
      return () => clearTimeout(timeout);
  }, [username, isLogin]);

  const handleLogin = async () => {
      try {
          const res = await axios.post(`${SERVER_URL}/api/login`, { login, password });
          onAuth(res.data);
      } catch(e) { setError(e.response?.data?.error || "Ошибка входа"); }
  };

  const handleRegister = async () => {
      try {
          if(usernameStatus !== 'free') return setError("Имя пользователя занято");
          if(day === "День" || month === "Месяц" || year === "Год") return setError("Введите дату рождения");
          
          const res = await axios.post(`${SERVER_URL}/api/register`, { 
              email, displayName, username, password: regPass, dob: { day, month, year } 
          });
          onAuth(res.data);
      } catch(e) { setError(e.response?.data?.error || "Ошибка регистрации"); }
  };

  return (
    <div className="h-screen flex items-center justify-center relative bg-[#0B0B0C] overflow-hidden">
      <BackgroundEffect />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#313338] p-8 rounded-3xl shadow-2xl w-full max-w-[480px] z-10 relative border border-white/5">
        {isLogin ? (
            <>
                <h2 className="text-2xl font-black text-white text-center mb-2">С возвращением!</h2>
                <p className="text-gray-400 text-center text-xs mb-8 font-bold">Мы так рады видеть вас снова!</p>
                <div className="mb-4">
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Email или Имя пользователя <span className="text-red-400">*</span></label>
                    <input value={login} onChange={e=>setLogin(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none text-sm transition-all focus:ring-1 focus:ring-[#5865F2]" />
                </div>
                <div className="mb-6">
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Пароль <span className="text-red-400">*</span></label>
                    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none text-sm transition-all focus:ring-1 focus:ring-[#5865F2]" />
                    <div className="text-[#00A8FC] text-xs font-bold cursor-pointer mt-2 hover:underline">Забыли пароль?</div>
                </div>
                <button onClick={handleLogin} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 rounded-xl transition-all mb-4 shadow-lg shadow-indigo-500/20">Вход</button>
                <div className="text-xs text-gray-400 mt-2 font-medium">Нужна учетная запись? <span onClick={()=>setIsLogin(false)} className="text-[#00A8FC] cursor-pointer hover:underline font-bold">Зарегистрироваться</span></div>
            </>
        ) : (
            <div className="max-h-[85vh] overflow-y-auto no-scrollbar pr-1">
                <h2 className="text-2xl font-black text-white text-center mb-6">Создать учетную запись</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">E-mail <span className="text-red-400">*</span></label>
                        <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Отображаемое имя</label>
                        <input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none text-sm" />
                    </div>
                    <div>
                        <label className={`block text-[10px] font-black uppercase mb-2 ${usernameStatus==='taken'?'text-red-400':'text-gray-400'}`}>Имя пользователя <span className="text-red-400">*</span></label>
                        <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none text-sm" />
                        {usernameStatus === 'free' && <p className="text-green-400 text-xs mt-1 font-bold">Супер! Это имя свободно.</p>}
                        {usernameStatus === 'taken' && <p className="text-red-400 text-xs mt-1 font-bold">Имя занято.</p>}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Пароль <span className="text-red-400">*</span></label>
                        <input type="password" value={regPass} onChange={e=>setRegPass(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none text-sm" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Дата рождения <span className="text-red-400">*</span></label>
                        <div className="flex gap-3">
                            <div className="relative w-1/3">
                                <select value={day} onChange={e=>setDay(e.target.value)} className="w-full bg-[#1E1F22] text-gray-300 p-3 rounded-xl outline-none text-sm appearance-none cursor-pointer"><option disabled>День</option>{[...Array(31)].map((_,i)=><option key={i}>{i+1}</option>)}</select>
                                <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none"/>
                            </div>
                            <div className="relative w-1/3">
                                <select value={month} onChange={e=>setMonth(e.target.value)} className="w-full bg-[#1E1F22] text-gray-300 p-3 rounded-xl outline-none text-sm appearance-none cursor-pointer"><option disabled>Месяц</option>{["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"].map(m=><option key={m}>{m}</option>)}</select>
                                <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none"/>
                            </div>
                            <div className="relative w-1/3">
                                <select value={year} onChange={e=>setYear(e.target.value)} className="w-full bg-[#1E1F22] text-gray-300 p-3 rounded-xl outline-none text-sm appearance-none cursor-pointer"><option disabled>Год</option>{[...Array(100)].map((_,i)=><option key={i}>{2024-i}</option>)}</select>
                                <ChevronDown size={14} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none"/>
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={handleRegister} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 rounded-xl transition-all mt-6 shadow-lg shadow-indigo-500/20">Продолжить</button>
                <div className="text-xs text-[#00A8FC] mt-4 cursor-pointer hover:underline font-bold text-center" onClick={()=>setIsLogin(true)}>Уже зарегистрированы? Войти</div>
            </div>
        )}
        {error && <div className="mt-4 bg-red-500/10 border border-red-500 text-white p-3 rounded-xl text-xs text-center font-bold flex items-center justify-center gap-2"><AlertCircle size={16}/> {error}</div>}
      </motion.div>
    </div>
  );
}