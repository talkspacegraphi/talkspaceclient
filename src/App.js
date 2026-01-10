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
  AlertCircle, ChevronDown, ChevronUp, Paperclip, Edit2, Volume2, Crown, 
  DownloadCloud
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

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ UI (ВЫНЕСЕНЫ НАРУЖУ) ---

// 1. Поле ввода (Исправлен баг с фокусом)
const Input = ({ label, value, onChange, type="text", required=false, errorMsg }) => (
    <div className="mb-4">
        <label className={`block text-[11px] font-bold uppercase mb-1.5 tracking-wide ${errorMsg ? 'text-red-400' : 'text-[#B5BAC1]'}`}>
            {label} {required && <span className="text-red-400">*</span>} 
            {errorMsg && <span className="italic normal-case ml-1 font-medium">- {errorMsg}</span>}
        </label>
        <input 
            type={type} 
            value={value} 
            onChange={onChange} 
            className="w-full bg-[#1E1F22] p-2.5 rounded-[3px] text-white outline-none text-sm h-10 transition-all focus:bg-[#1E1F22] focus:ring-0 font-medium" 
        />
    </div>
);

// 2. Кастомный Селект (Для даты рождения)
const CustomSelect = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative w-full" ref={ref}>
            <div 
                onClick={() => setIsOpen(!isOpen)} 
                className={`w-full bg-[#1E1F22] p-2.5 rounded-[3px] text-white text-sm h-10 flex items-center justify-between cursor-pointer border border-transparent hover:border-[#0B0B0C] transition-colors ${isOpen ? 'rounded-b-none' : ''}`}
            >
                <span className={`${!value ? 'text-[#949BA4]' : 'text-white'}`}>{value || placeholder}</span>
                {isOpen ? <ChevronUp size={16} className="text-[#949BA4]"/> : <ChevronDown size={16} className="text-[#949BA4]"/>}
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 bg-[#2B2D31] border border-[#1E1F22] border-t-0 max-h-48 overflow-y-auto z-50 rounded-b-[3px] shadow-xl custom-scrollbar">
                    {options.map((opt, i) => (
                        <div 
                            key={i} 
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                            className="p-2 text-sm text-[#DBDEE1] hover:bg-[#404249] hover:text-white cursor-pointer transition-colors"
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- ОСНОВНЫЕ КОМПОНЕНТЫ ---

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

function BackgroundEffect() {
    return (
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#0B0B0C]">
          {/* Статичный фон паттерн */}
          <div className="absolute inset-0 bg-[url('https://discord.com/assets/843b08e5830058e3789a24d9c79e6079.svg')] bg-cover opacity-5"></div>
          {/* Анимированные пятна */}
          <motion.div animate={{ x: [0, 100, 0], y: [0, -50, 0], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 15, repeat: Infinity }} className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-purple-900 rounded-full blur-[150px]" />
          <motion.div animate={{ x: [0, -100, 0], y: [0, 50, 0], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 18, repeat: Infinity }} className="absolute bottom-0 right-0 w-[70vw] h-[70vw] bg-blue-900 rounded-full blur-[150px]" />
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

// --- АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ---
function Auth({ onAuth }) {
  const [isLogin, setIsLogin] = useState(true);
  
  const [loginData, setLoginData] = useState({ login: '', password: '' });
  const [regData, setRegData] = useState({ email: '', displayName: '', username: '', password: '', day: '', month: '', year: '' });
  const [usernameStatus, setUsernameStatus] = useState(null); 
  const [error, setError] = useState("");

  // Проверка имени пользователя
  useEffect(() => {
      if(isLogin || !regData.username) return;
      const timeout = setTimeout(async () => {
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
      } catch(e) { setError(e.response?.data?.error || "Неверный логин или пароль"); }
  };

  const handleRegister = async () => {
      try {
          if(usernameStatus !== 'free') return setError("Имя пользователя занято");
          if(!regData.day || !regData.month || !regData.year) return setError("Укажите дату рождения");
          
          const res = await axios.post(`${SERVER_URL}/api/register`, { ...regData, dob: { day: regData.day, month: regData.month, year: regData.year } });
          onAuth(res.data);
      } catch(e) { setError(e.response?.data?.error || "Ошибка регистрации"); }
  };

  return (
    <div className="h-screen flex items-center justify-center relative bg-[#0B0B0C] overflow-hidden">
      <BackgroundEffect />
      
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#313338] p-8 rounded-[5px] shadow-2xl w-full max-w-[480px] z-10 relative border border-white/5">
        {isLogin ? (
            <>
                <h2 className="text-2xl font-bold text-white text-center mb-2">С возвращением!</h2>
                <p className="text-[#B5BAC1] text-center text-[15px] mb-6">Мы так рады видеть вас снова!</p>
                
                <Input label="Адрес электронной почты или имя пользователя" required value={loginData.login} onChange={e=>setLoginData({...loginData, login:e.target.value})}/>
                <Input label="Пароль" type="password" required value={loginData.password} onChange={e=>setLoginData({...loginData, password:e.target.value})}/>
                
                <div className="text-[#00A8FC] text-xs font-medium cursor-pointer mb-6 hover:underline">Забыли пароль?</div>
                <button onClick={handleLogin} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-2.5 rounded-[3px] transition-all mb-2 text-sm">Вход</button>
                <div className="text-xs text-[#949BA4] mt-2">Нужна учетная запись? <span onClick={()=>{setIsLogin(false); setError("")}} className="text-[#00A8FC] cursor-pointer hover:underline ml-1">Зарегистрироваться</span></div>
            </>
        ) : (
            <div className="max-h-[85vh] overflow-y-auto no-scrollbar pr-1">
                <h2 className="text-2xl font-bold text-white text-center mb-6">Создать учетную запись</h2>
                
                <Input label="E-mail" required value={regData.email} onChange={e=>setRegData({...regData, email:e.target.value})}/>
                <Input label="Отображаемое имя" value={regData.displayName} onChange={e=>setRegData({...regData, displayName:e.target.value})}/>
                
                <div className="mb-4">
                    <label className={`block text-[11px] font-bold uppercase mb-1.5 ${usernameStatus==='taken'?'text-red-400':'text-[#B5BAC1]'}`}>Имя пользователя <span className="text-red-400">*</span></label>
                    <input value={regData.username} onChange={e=>setRegData({...regData, username:e.target.value})} className="w-full bg-[#1E1F22] p-2.5 rounded-[3px] text-white outline-none text-sm h-10 transition-all font-medium" />
                    {usernameStatus === 'free' && <p className="text-green-400 text-xs mt-1 font-medium">Супер! Это имя свободно.</p>}
                    {usernameStatus === 'taken' && <p className="text-red-400 text-xs mt-1 font-medium">Имя занято.</p>}
                </div>

                <Input label="Пароль" type="password" required value={regData.password} onChange={e=>setRegData({...regData, password:e.target.value})}/>
                
                <div className="mb-6">
                    <label className="block text-[11px] font-bold uppercase text-[#B5BAC1] mb-1.5">Дата рождения <span className="text-red-400">*</span></label>
                    <div className="flex gap-3">
                        <div className="w-[30%]"><CustomSelect placeholder="День" value={regData.day} options={[...Array(31)].map((_,i)=>i+1)} onChange={v=>setRegData({...regData, day:v})} /></div>
                        <div className="w-[40%]"><CustomSelect placeholder="Месяц" value={regData.month} options={["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]} onChange={v=>setRegData({...regData, month:v})} /></div>
                        <div className="w-[30%]"><CustomSelect placeholder="Год" value={regData.year} options={[...Array(100)].map((_,i)=>2024-i)} onChange={v=>setRegData({...regData, year:v})} /></div>
                    </div>
                </div>

                <button onClick={handleRegister} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-2.5 rounded-[3px] transition-all text-sm">Продолжить</button>
                <div className="text-xs text-[#00A8FC] mt-4 cursor-pointer hover:underline font-medium text-left" onClick={()=>{setIsLogin(true); setError("")}}>Уже зарегистрированы? Войти</div>
            </div>
        )}
        {error && <div className="mt-4 bg-[#F23F43] text-white p-2 rounded text-xs font-medium text-center">{error}</div>}
      </motion.div>
    </div>
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
    return <div className={`${size} rounded-full ${color} border-[3px] border-[#232428] absolute -bottom-0.5 -right-0.5`} />;
  };

  const handleContextMenu = (e, s) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, serverId: s._id, ownerId: s.owner, name: s.name }); };
  const deleteServer = async () => { if(window.confirm(`Удалить ${contextMenu.name}?`)) { await axios.post(`${SERVER_URL}/api/delete-server`, { serverId: contextMenu.serverId }); refresh(); setContextMenu(null); navigate('/friends'); }};
  const leaveServer = async () => { if(window.confirm(`Выйти из ${contextMenu.name}?`)) { await axios.post(`${SERVER_URL}/api/leave-server`, { serverId: contextMenu.serverId, userId: user._id }); refresh(); setContextMenu(null); navigate('/friends'); }};
  const inviteServer = () => { navigator.clipboard.writeText("INVITE-" + contextMenu.serverId.slice(-6).toUpperCase()); alert("Код скопирован"); setContextMenu(null); };

  return (
    <div className="relative flex h-full z-10 overflow-hidden" onClick={()=>setContextMenu(null)}>
      {/* 1. SERVER LIST */}
      <div className="w-[72px] flex flex-col items-center py-3 gap-3 bg-[#1E1F22] border-r border-black/10 shrink-0 z-20 overflow-y-auto no-scrollbar">
        <div onClick={() => navigate('/friends')} className="relative w-12 h-12 bg-[#313338] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 group shadow-md text-gray-200">
          <MessageSquare size={24} className="group-hover:text-white" />
          {user?.requests?.length > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-[3px] border-[#1E1F22] text-[10px] font-bold text-white shadow-lg">{user.requests.length}</div>}
        </div>
        <div className="w-8 h-[2px] bg-[#35363C] rounded-full" />
        {user?.servers?.map(s => (
            <div key={s._id} onClick={() => navigate(`/server/${s._id}`)} onContextMenu={(e) => handleContextMenu(e, s)} className="w-12 h-12 bg-[#313338] hover:bg-[var(--primary)] rounded-[24px] hover:rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-300 text-white font-bold uppercase shadow-md relative select-none text-xs overflow-hidden border-none group">
                {s.name.substring(0, 2)}
            </div>
        ))}
        <button onClick={() => setCreateServerModal(true)} className="w-12 h-12 bg-[#313338] text-green-500 hover:bg-green-500 hover:text-white rounded-[24px] hover:rounded-[16px] transition-all flex items-center justify-center shadow-md group"><Plus size={24} /></button>
      </div>

      {/* 2. SIDEBAR */}
      <div className="w-60 bg-[#2B2D31] flex flex-col shrink-0 z-20">
         <Routes>
             <Route path="/friends" element={<DMSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
             <Route path="/chat/*" element={<DMSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
             <Route path="/server/:serverId" element={<ServerSidebar user={user} navigate={navigate} StatusDot={StatusDot} setShowSettings={setShowSettings} statusMenu={statusMenu} setStatusMenu={setStatusMenu} updateStatus={updateStatus}/>} />
         </Routes>
      </div>

      {/* 3. MAIN CONTENT */}
      <div className="flex-1 flex flex-col bg-[#313338] relative min-w-0 z-10">
        <Routes>
          <Route path="/friends" element={<FriendsView user={user} refresh={refresh} />} />
          <Route path="/chat/:friendId" element={<ChatView user={user} noiseSuppression={noiseSuppression} />} />
          <Route path="/server/:serverId" element={<ServerView user={user} noiseSuppression={noiseSuppression} />} />
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
        {showSettings && <SettingsModal user={user} setUser={setUser} onClose={() => setShowSettings(false)} onLogout={onLogout} noise={noiseSuppression} setNoise={setNoiseSuppression} />}
        {createSeverModal && <CreateServerModal user={user} onClose={() => setCreateServerModal(false)} refresh={refresh} />}
      </AnimatePresence>
    </div>
  );
}

const DMSidebar = ({ user, navigate, StatusDot, setShowSettings, statusMenu, setStatusMenu, updateStatus }) => (
    <>
        <div className="h-12 flex items-center px-4 font-bold text-white border-b border-[#1F2023] shadow-sm select-none bg-[#2B2D31] text-sm">Поиск...</div>
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          <button onClick={() => navigate('/friends')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-[4px] transition-all ${window.location.hash.includes('/friends') ? 'bg-[#404249] text-white' : 'text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]'}`}>
            <Users size={20} /> <span className="text-[15px] font-medium">Друзья</span>
          </button>
          <div className="mt-4 mb-1 px-3 text-[11px] font-bold text-[#949BA4] uppercase tracking-wide flex items-center justify-between select-none hover:text-[#DBDEE1]"><span>Личные сообщения</span> <Plus size={14} className="cursor-pointer"/></div>
          {user?.chats?.map(c => {
            const f = c.members.find(m => m._id !== user._id);
            if (!f) return null;
            return (
              <div key={c._id} onClick={() => navigate(`/chat/${f._id}`)} className={`flex items-center gap-3 px-2 py-2 rounded-[4px] cursor-pointer transition-all group ${window.location.hash.includes(f._id) ? 'bg-[#404249] text-white' : 'hover:bg-[#35373C] text-[#949BA4]'}`}>
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
        <div className="h-12 flex items-center px-4 font-bold text-white border-b border-[#1F2023] shadow-sm truncate select-none text-[15px]">{activeServer?.name || "Server"}</div>
        <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {activeServer?.channels?.map(ch => (
                <div key={ch._id} onClick={() => navigate(`/server/${serverId}?channel=${ch._id}`)} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] cursor-pointer transition-colors ${window.location.search.includes(ch._id) ? 'bg-[#404249] text-white' : 'text-[#949BA4] hover:bg-[#35373C] hover:text-[#DBDEE1]'}`}>
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
    <div className="bg-[#232428] p-1.5 relative select-none flex items-center gap-1">
       <AnimatePresence>
        {statusMenu && (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: -10, opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-full left-2 w-56 bg-[#111] border border-white/10 rounded-lg p-2 shadow-2xl z-50 mb-2">
             <button onClick={() => updateStatus('online')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-green-500 rounded-full"/> В сети</button>
             <button onClick={() => updateStatus('dnd')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-red-500 rounded-full"/> Не беспокоить</button>
             <button onClick={() => updateStatus('idle', 'Спит')} className="w-full text-left p-2 hover:bg-white/10 rounded flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white"><div className="w-2.5 h-2.5 bg-yellow-500 rounded-full"/> Спит</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2 p-1 rounded hover:bg-[#3F4147] cursor-pointer transition-colors flex-1" onClick={(e) => {if(!e.target.closest('.icons')) setStatusMenu(!statusMenu)}}>
          <div className="relative"><img src={user?.avatar} className="w-8 h-8 rounded-full object-cover bg-zinc-800" alt="me" /><StatusDot status={user.status} /></div>
          <div className="flex-1 overflow-hidden leading-tight"><p className="text-xs font-bold text-white truncate">{user?.displayName}</p><p className="text-[11px] text-[#DBDEE1]">@{user?.username}</p></div>
      </div>
      <div className="flex gap-0 icons">
        <button className="p-2 hover:bg-[#3F4147] rounded text-gray-200" onClick={()=>setShowSettings(true)}><Settings size={18}/></button>
      </div>
    </div>
);

// --- CALL HEADER ---
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

            {incoming && !callActive && (
                 <motion.div initial={{y:-20, opacity:0}} animate={{y:0, opacity:1}} className="w-full flex items-center justify-between bg-[#111] p-3 rounded-lg border border-green-600 shadow-xl">
                     <div className="flex items-center gap-3">
                         <img src="https://via.placeholder.com/50" className="w-10 h-10 rounded-full animate-bounce" alt="av"/>
                         <div><p className="text-[10px] text-green-500 font-bold uppercase">Входящий звонок</p><p className="text-white font-bold">{incoming.from}</p></div>
                     </div>
                     <div className="flex gap-3">
                         <button onClick={onAccept} className="p-2 bg-green-500 rounded-full text-white hover:bg-green-400"><Phone size={20}/></button>
                         <button onClick={onReject} className="p-2 bg-red-500 rounded-full text-white hover:bg-red-400"><PhoneOff size={20}/></button>
                     </div>
                 </motion.div>
            )}

            {callActive && (
                <div className={`flex flex-col gap-3 ${fullScreen ? 'h-full' : ''}`}>
                    <div className={`flex gap-3 w-full ${fullScreen ? 'flex-1' : 'h-64'}`}>
                        <div className="flex-1 bg-[#111] rounded-lg overflow-hidden relative flex items-center justify-center group border border-white/5 shadow-inner">
                            {remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks()[0].enabled ? (
                                <video ref={v => {if(v) v.srcObject = remoteStream}} autoPlay className="w-full h-full object-cover" />
                            ) : (
                                <PulseAvatar src={friend?.avatar || 'https://via.placeholder.com/100'} />
                            )}
                            <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 rounded text-xs font-bold text-white">{friend?.displayName}</div>
                            {!fullScreen && <button onClick={()=>setFullScreen(true)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/60 p-1 rounded text-white"><Maximize size={16}/></button>}
                        </div>
                        <div className="w-48 bg-[#111] rounded-lg overflow-hidden relative shadow-2xl border border-white/10 group">
                             {isCamOn || isScreenOn ? (
                                <video ref={v => {if(v) v.srcObject = localStream}} autoPlay muted className={`w-full h-full object-cover ${!isScreenOn ? 'mirror' : ''}`} />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center bg-[#18191C]"><img src={user?.avatar} className="w-16 h-16 rounded-full opacity-50" alt="me"/></div>
                             )}
                             <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-md text-[10px] font-bold text-white">Вы</div>
                        </div>
                    </div>
                    <div className={`flex justify-center gap-4 ${fullScreen ? 'pb-8 pt-4' : ''}`}>
                        <button onClick={toggleMic} className={`p-3 rounded-full transition-all ${isMicOn ? 'bg-white text-black' : 'bg-red-500 text-white'}`}>{isMicOn ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                        <button onClick={toggleCam} className={`p-3 rounded-full transition-all ${isCamOn ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>{isCamOn ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                        <button onClick={shareScreen} className={`p-3 rounded-full transition-all ${isScreenOn ? 'bg-green-500 text-white' : 'bg-white/10 text-white'}`}><Monitor size={20}/></button>
                        <button onClick={onHangup} className="p-3 px-6 bg-red-600 rounded-full text-white hover:bg-red-500 shadow-xl active:scale-95 transition-all"><PhoneOff size={24}/></button>
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
        <div className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col">
            {messages.map((m, i) => {
                const isMe = m.senderId === user._id;
                return (
                    <div key={i} className={`flex gap-4 group ${isMe ? 'flex-row-reverse' : ''} relative`}>
                        <img src={m.senderAvatar} className="w-10 h-10 rounded-full shrink-0 bg-zinc-800 object-cover mt-1" alt="m" />
                        <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-[15px] font-medium text-white">{m.senderName}</span>
                                <span className="text-[11px] text-[#949BA4]">{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="relative group/msg">
                                <div className={`px-4 py-2.5 rounded shadow-sm text-[15px] leading-relaxed text-[#DBDEE1] ${isMe ? 'bg-[#5865F2] text-white rounded-tr-none' : 'bg-[#2B2D31] rounded-tl-none'}`}>
                                    {m.type === 'image' ? (
                                        <img src={m.fileUrl} className="max-w-full rounded cursor-pointer" onClick={()=>window.open(m.fileUrl)} alt="att"/>
                                    ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="markdown">{m.text}</ReactMarkdown>
                                    )}
                                    {m.isEdited && <span className="text-[10px] opacity-60 ml-1">(изм.)</span>}
                                </div>
                                {m.reactions?.length > 0 && (
                                    <div className="flex gap-1 mt-1 flex-wrap">
                                        {m.reactions.map((r, ri) => (
                                            <div key={ri} onClick={()=>onReact(m._id, r.emoji)} className="bg-[#2B2D31] px-1.5 py-0.5 rounded text-[11px] border border-transparent cursor-pointer hover:border-[#5865F2] flex items-center gap-1">
                                                <span>{r.emoji}</span> <span className="font-bold">{r.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className={`absolute -top-3 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover/msg:opacity-100 bg-[#313338] p-1 rounded-lg border border-[#26272D] flex gap-1 shadow-sm transition-all z-10`}>
                                    <button onClick={()=>onReact(m._id, '👍')} className="hover:bg-[#404249] p-1 rounded text-lg">👍</button>
                                    <button onClick={()=>onReact(m._id, '🔥')} className="hover:bg-[#404249] p-1 rounded text-lg">🔥</button>
                                    {isMe && <button onClick={()=>onEdit(m)} className="hover:text-blue-400 p-1"><Edit2 size={14}/></button>}
                                    {isMe && <button onClick={()=>onDelete(m._id)} className="hover:text-red-400 p-1"><Trash size={14}/></button>}
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
        <div className="p-4 bg-[#313338] shrink-0 z-20 relative px-4 pb-6">
            {showEmoji && <div className="absolute bottom-20 right-4 z-50"><EmojiPicker theme="dark" onEmojiClick={(e)=>setText(prev=>prev+e.emoji)}/></div>}
            <div className="flex items-center gap-3 bg-[#383A40] p-2.5 px-4 rounded-lg">
                <label className="cursor-pointer text-[#B5BAC1] hover:text-[#DBDEE1] p-1"><Plus size={20} className="bg-[#2B2D31] rounded-full p-0.5"/><input type="file" hidden onChange={handleFile}/></label>
                <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') send()}} className="flex-1 bg-transparent outline-none text-[#DBDEE1] text-[15px] py-1 placeholder:text-[#949BA4]" placeholder={placeholder} />
                <button onClick={()=>setShowEmoji(!showEmoji)} className="text-[#B5BAC1] hover:text-[#E0C259] transition-colors"><Smile size={24}/></button>
                <button onClick={send} className="text-[#B5BAC1] hover:text-[var(--primary)] transition-colors"><Send size={24}/></button>
            </div>
        </div>
    )
}

function ChatView({ user, noiseSuppression }) {
  const { friendId } = useParams();
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
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
  };

  const endCall = () => {
      if(localStream) localStream.getTracks().forEach(t=>t.stop());
      callSound.pause(); callSound.currentTime = 0;
      setCallActive(false); setLocalStream(null); setRemoteStream(null); setIsIncoming(null); setIsScreenOn(false);
  };

  const toggleMic = () => {
      if(localStream) { const track = localStream.getAudioTracks()[0]; if(track) { track.enabled = !track.enabled; setIsMicOn(track.enabled); } }
  };

  const toggleCam = async () => {
      if (isCamOn) { localStream.getVideoTracks().forEach(t => { t.stop(); localStream.removeTrack(t); }); setIsCamOn(false); } 
      else {
          try {
             const videoStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280 } });
             const videoTrack = videoStream.getVideoTracks()[0];
             localStream.addTrack(videoTrack);
             const sender = peerRef.current.peerConnection.getSenders().find(s => s.track.kind === 'video');
             if (sender) sender.replaceTrack(videoTrack); else peerRef.current.peerConnection.addTrack(videoTrack, localStream);
             setIsCamOn(true);
          } catch(e) { alert("Камера не найдена"); }
      }
  };

  const shareScreen = async () => {
      if(!isScreenOn) {
         try {
             const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080, frameRate: 60 }, audio: true });
             const screenTrack = screenStream.getVideoTracks()[0];
             const sender = peerRef.current.peerConnection.getSenders().find(s => s.track.kind === 'video' || s.track.kind === 'screen');
             if(sender) sender.replaceTrack(screenTrack); else peerRef.current.peerConnection.addTrack(screenTrack, localStream);
             screenTrack.onended = () => { setIsScreenOn(false); }; setIsScreenOn(true);
         } catch(e) {}
      }
  };

  if (!activeChat) return <div className="flex-1 flex items-center justify-center text-gray-500 font-bold animate-pulse">Загрузка...</div>;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#313338]">
      <div className="h-12 flex items-center justify-between px-4 border-b border-[#26272D] bg-[#313338] shadow-sm z-20">
          <div className="flex items-center gap-3"><div className="relative"><img src={friend?.avatar} className="w-8 h-8 rounded-full" alt="f" /><StatusDot status={friend?.status}/></div><div><p className="font-bold text-white text-[15px]">{friend?.displayName}</p><p className="text-[12px] text-[#949BA4]">@{friend?.username}</p></div></div>
          <div className="flex gap-4 text-[#B5BAC1]"><Phone size={24} className="hover:text-green-400 cursor-pointer transition-colors" onClick={() => startCall(false)} /><Video size={24} className="hover:text-white cursor-pointer transition-colors" onClick={() => startCall(true)} /></div>
      </div>
      <CallHeader callActive={callActive} incoming={isIncoming} onAccept={answerCall} onReject={()=>{callSound.pause();setIsIncoming(null)}} onHangup={()=>{socket.emit('hangup', {to: friendId}); endCall()}} localStream={localStream} remoteStream={remoteStream} toggleMic={toggleMic} toggleCam={toggleCam} shareScreen={shareScreen} isMicOn={isMicOn} isCamOn={isCamOn} isScreenOn={isScreenOn} friend={friend}/>
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

    useEffect(() => { socket.emit('join_server_room', serverId); setMessages(channel?.messages || []); }, [channelId, serverId, channel]);
    socket.on('new_server_msg', (m) => { if(m.channelId === channelId) setMessages(p => [...p, m]); });
    socket.on('new_server_msg_update', (d) => { if(d.channelId === channelId) setMessages(p => p.map(m => m._id === d.msg._id ? d.msg : m)); });
    socket.on('new_server_msg_delete', (d) => { if(d.channelId === channelId) setMessages(p => p.filter(m => m._id !== d.msgId)); });

    const handleSend = (text) => socket.emit('send_msg', { serverId, channelId, text, senderId: user._id, senderName: user.displayName, avatar: user.avatar, type: 'text' });
    const handleReact = (msgId, emoji) => axios.post(`${SERVER_URL}/api/message/react`, { serverId, channelId, msgId, emoji, userId: user._id });
    const handleEdit = (m) => { const t = prompt("Edit:", m.text); if(t) axios.post(`${SERVER_URL}/api/message/edit`, { serverId, channelId, msgId: m._id, newText: t }); };
    const handleDelete = (msgId) => axios.post(`${SERVER_URL}/api/message/delete`, { serverId, channelId, msgId });
    const kickMember = async (id) => { if(server.owner === user._id) await axios.post(`${SERVER_URL}/api/kick-member`, { serverId, userId: id }); };

    return (
        <div className="flex h-full bg-[#313338]">
            <div className="flex-1 flex flex-col">
                {channel?.type === 'text' ? (
                    <>
                        <div className="h-12 border-b border-[#26272D] flex items-center px-4 font-bold text-white shadow-sm"><Hash size={24} className="mr-2 text-[#949BA4]"/> {channel.name}</div>
                        <MessageList messages={messages} user={user} onReact={handleReact} onEdit={handleEdit} onDelete={handleDelete} />
                        <ChatInput onSend={handleSend} onUpload={()=>{}} placeholder={`Написать в #${channel.name}`} />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center flex-col text-center"><Volume2 size={64} className="text-[#404249] mb-6"/><h2 className="text-2xl font-bold mb-4 text-white">Голосовой канал: {channel?.name}</h2>{!inVoice ? (<button onClick={()=>setInVoice(true)} className="bg-[#5865F2] px-8 py-2.5 rounded text-white font-bold hover:bg-[#4752C4] transition-all">Подключиться</button>) : (<div className="text-center"><p className="text-green-400 mb-4 font-bold">Вы подключены</p><button onClick={()=>setInVoice(false)} className="bg-[#F23F43] px-8 py-2.5 rounded text-white font-bold hover:bg-[#D9363A] transition-all">Отключиться</button></div>)}</div>
                )}
            </div>
            <div className="w-60 bg-[#2B2D31] p-4 overflow-y-auto border-l border-white/5">
                <h3 className="text-xs font-bold text-[#949BA4] uppercase mb-4 tracking-widest">Участники — {server?.members?.length}</h3>
                {server?.members?.map(m => (
                    <div key={m._id} onContextMenu={(e)=>{e.preventDefault(); if(server.owner===user._id && m._id!==user._id) if(window.confirm("Кикнуть?")) kickMember(m._id)}} className="flex items-center gap-2 mb-2 p-1.5 hover:bg-[#35373C] rounded-lg cursor-pointer opacity-90 hover:opacity-100 transition-all">
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
    const borderClass = error ? 'border-red-500' : success ? 'border-green-500' : 'border-[#1E1F22] focus-within:border-[#00A8FC]';
    return (
      <div className="flex flex-col h-full bg-[#313338]">
        <div className="h-12 flex items-center px-6 border-b border-[#1F2023] gap-6 shadow-sm"><div className="flex items-center gap-2 text-white font-bold"><Users size={20} /><span>Друзья</span></div><div className="h-6 w-[1px] bg-[#3F4147]"/><div className="flex gap-2">{['all', 'pending', 'add'].map(t => (<button key={t} onClick={() => {setTab(t); setError(""); setSuccess("");}} className={`px-2 py-0.5 rounded text-[15px] font-medium transition-colors ${tab === t ? (t==='add'?'text-[#23A559] bg-transparent':'bg-[#404249] text-white') : (t==='add'?'bg-[#23A559] text-white px-3':'text-[#B5BAC1] hover:bg-[#35373C] hover:text-[#DBDEE1]')}`}>{t === 'all' ? 'Все' : t === 'pending' ? `Ожидание (${user?.requests?.length || 0})` : 'Добавить друга'}</button>))}</div></div>
        <div className="p-8 overflow-y-auto">
          {tab === 'all' && ( <>{user?.friends?.map(f => (<div key={f._id} onClick={() => navigate(`/chat/${f._id}`)} className="flex items-center justify-between p-2.5 hover:bg-[#35373C] rounded-lg cursor-pointer group border-t border-[#3F4147] border-opacity-50"><div className="flex items-center gap-3"><img src={f.avatar} className="w-8 h-8 rounded-full object-cover" alt="av" /><div><p className="font-bold text-white text-[15px]">{f.displayName} <span className="hidden group-hover:inline text-[#949BA4] text-xs font-medium">@{f.username}</span></p><p className="text-[11px] text-[#949BA4] font-bold">{f.status}</p></div></div><div className="p-2 bg-[#2B2D31] rounded-full text-[#B5BAC1] group-hover:text-[#DBDEE1]"><MessageSquare size={18} /></div></div>))}</>)}
          {tab === 'add' && (<div className="w-full max-w-2xl"><h3 className="text-white font-bold text-base mb-2 uppercase">Добавить друга</h3><p className="text-[#B5BAC1] text-sm mb-4">Вы можете добавить друзей по имени пользователя.</p><div className={`bg-[#1E1F22] p-2.5 rounded-xl border-2 flex items-center transition-all ${borderClass}`}><input value={friendInput} onChange={handleInput} className="bg-transparent flex-1 p-1 outline-none text-white text-sm placeholder:text-gray-500" placeholder="Имя пользователя" /><button onClick={sendRequest} disabled={!friendInput} className={`px-6 py-2 rounded-lg text-xs font-bold text-white transition-colors ${friendInput ? 'bg-[#5865F2] hover:bg-[#4752c4]' : 'bg-[#3B405A] cursor-not-allowed opacity-50'}`}>Отправить запрос</button></div>{success && <p className="text-[#23A559] text-sm mt-2 font-medium">{success}</p>}{error && <p className="text-[#F23F43] text-sm mt-2 font-medium">{error}</p>}</div>)}
          {tab === 'pending' && user?.requests?.map(r => (<div key={r.from} className="flex items-center justify-between p-3 hover:bg-[#35373C] rounded-lg border-t border-[#3F4147]"><div className="flex items-center gap-3"><img src={r.avatar} className="w-8 h-8 rounded-full" alt="av"/><div><p className="font-bold text-white text-sm">{r.displayName}</p><p className="text-xs text-[#949BA4]">Входящий запрос</p></div></div><div className="flex gap-2"><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'accept' }); refresh(); }} className="p-2 bg-[#2B2D31] hover:text-[#23A559] rounded-full"><Check size={18}/></button><button onClick={async () => { await axios.post(`${SERVER_URL}/api/handle-request`, { userId: user._id, fromId: r.from, action: 'decline' }); refresh(); }} className="p-2 bg-[#2B2D31] hover:text-[#F23F43] rounded-full"><X size={18}/></button></div></div>))}
        </div>
      </div>
    );
}

function CreateServerModal({ user, onClose, refresh }) {
    const [name, setName] = useState("");
    const create = async () => { if(!name) return; await axios.post(`${SERVER_URL}/api/create-server`, { name, owner: user._id }); refresh(); onClose(); };
    return (<div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[500]"><motion.div initial={{scale:0.9, opacity:0}} animate={{scale:1, opacity:1}} className="bg-[#313338] p-6 rounded-3xl text-center w-full max-w-sm shadow-2xl border border-white/10"><h2 className="text-2xl font-black text-white mb-2">Создать сервер</h2><p className="text-gray-400 text-xs mb-6 px-4">Сервер — это место, где вы можете общаться с друзьями.</p><div className="uppercase text-[10px] font-black text-gray-400 mb-2 text-left tracking-widest">Название сервера</div><input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none mb-6 text-sm" /><div className="flex justify-between items-center"><button onClick={onClose} className="text-gray-300 hover:underline text-sm font-bold">Назад</button><button onClick={create} className="bg-[#5865F2] hover:bg-[#4752c4] px-8 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg">Создать</button></div></motion.div></div>)
}

function SettingsModal({ user, setUser, onClose, onLogout, noise, setNoise }) {
    const [activeTab, setActiveTab] = useState('account'); 
    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [banner, setBanner] = useState(user?.bannerColor || "#000000");
    const [file, setFile] = useState(null);
    const [email, setEmail] = useState(user?.email || "");
    const [newPass, setNewPass] = useState("");
    const [currPass, setCurrPass] = useState("");
    const saveProfile = async () => { const fd = new FormData(); fd.append('userId', user._id); fd.append('displayName', displayName); fd.append('bio', bio); fd.append('bannerColor', banner); if(file) fd.append('avatar', file); try { const res = await axios.post(`${SERVER_URL}/api/update-profile`, fd); setUser(res.data); localStorage.setItem('user', JSON.stringify(res.data)); localStorage.setItem('noiseSuppression', noise); onClose(); } catch(e) { alert("Ошибка"); } };
    const saveAccount = async () => { try { await axios.post(`${SERVER_URL}/api/update-account`, { userId: user._id, email, newPassword: newPass, currentPassword: currPass }); alert("Аккаунт обновлен!"); onClose(); } catch(e) { alert(e.response?.data?.error || "Ошибка"); } };
    return (<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-8"><motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-[#313338] w-full max-w-4xl h-[80vh] rounded-[30px] flex overflow-hidden shadow-2xl border border-white/5"><div className="w-64 bg-[#2B2D31] p-6 pt-10"><p className="uppercase text-[10px] font-black text-gray-400 px-2 mb-2 tracking-widest">Настройки пользователя</p><div onClick={()=>setActiveTab('account')} className={`px-3 py-2 rounded-lg text-sm font-bold mb-1 cursor-pointer ${activeTab==='account' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C]'}`}>Моя учетная запись</div><div onClick={()=>setActiveTab('profile')} className={`px-3 py-2 rounded-lg text-sm font-bold mb-1 cursor-pointer ${activeTab==='profile' ? 'bg-[#404249] text-white' : 'text-gray-400 hover:bg-[#35373C]'}`}>Профиль</div><div className="h-[1px] bg-white/10 my-4 mx-2"/><div onClick={onLogout} className="text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg text-sm font-bold cursor-pointer flex items-center justify-between transition-colors">Выйти <LogOut size={16}/></div></div><div className="flex-1 p-10 overflow-y-auto relative bg-[#313338]"><div onClick={onClose} className="absolute top-6 right-6 p-2 border-2 border-gray-500 rounded-full text-gray-500 hover:text-white hover:border-white cursor-pointer transition-all opacity-70 hover:opacity-100"><X size={20}/></div>{activeTab === 'account' && (<><h2 className="text-xl font-black text-white mb-6">Моя учетная запись</h2><div className="bg-[#1E1F22] rounded-2xl p-6 mb-8 flex items-center gap-6 border border-white/5"><div className="relative"><img src={user?.avatar} className="w-20 h-20 rounded-full bg-[#111]" alt="av"/><div className="absolute -bottom-1 -right-1 p-1 bg-[#1E1F22] rounded-full"><div className="w-4 h-4 bg-green-500 rounded-full border-2 border-[#1E1F22]"/></div></div><div><h3 className="text-2xl font-black text-white">{user?.displayName}</h3><p className="text-sm font-bold text-gray-400">@{user?.username}</p></div><button onClick={()=>setActiveTab('profile')} className="ml-auto bg-[#5865F2] px-6 py-2 rounded-xl text-white font-bold text-sm hover:bg-[#4752c4]">Редактировать профиль</button></div><div className="bg-[#1E1F22] rounded-2xl p-6 border border-white/5 space-y-6"><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Email</label><input value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Новый пароль</label><input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Текущий пароль (для подтверждения)</label><input type="password" value={currPass} onChange={e=>setCurrPass(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div></div></div><div className="mt-6 flex justify-end"><button onClick={saveAccount} className="bg-green-600 px-8 py-2.5 rounded-xl font-bold text-white shadow-lg hover:bg-green-500 transition-all">Сохранить изменения</button></div></>)}{activeTab === 'profile' && (<><h2 className="text-xl font-black text-white mb-6">Профиль</h2><div className="bg-[#1E1F22] rounded-2xl overflow-hidden mb-8 border border-white/5"><div style={{ backgroundColor: banner }} className="h-32 w-full relative group"><div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><input type="color" className="cursor-pointer w-8 h-8 opacity-0 absolute" onChange={e=>setBanner(e.target.value)}/><div className="bg-black/50 p-1.5 rounded-lg backdrop-blur-sm"><Settings size={16} className="text-white"/></div></div></div><div className="px-6 pb-6 flex justify-between items-end -mt-10"><div className="flex items-end gap-4"><div className="relative group"><img src={file ? URL.createObjectURL(file) : user?.avatar} className="w-24 h-24 rounded-full border-[6px] border-[#1E1F22] bg-[#1E1F22] object-cover" alt="av" /><label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer border-[6px] border-transparent transition-all"><Camera size={24} className="text-white"/><input type="file" hidden onChange={e=>setFile(e.target.files[0])}/></label></div></div></div><div className="p-6 pt-0 grid grid-cols-2 gap-6"><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Отображаемое имя</label><input value={displayName} onChange={e=>setDisplayName(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none" /></div><div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">О себе</label><textarea value={bio} onChange={e=>setBio(e.target.value)} className="w-full bg-[#111] p-3 rounded-xl text-white text-sm outline-none h-[46px] resize-none" /></div></div></div><h2 className="text-xl font-black text-white mb-4">Голос и видео</h2><div className="bg-[#1E1F22] p-6 rounded-2xl mb-8 border border-white/5"><div className="flex items-center justify-between"><div><h4 className="font-bold text-gray-200">Шумоподавление</h4><p className="text-xs text-gray-400 mt-1">Убирает фоновый шум из вашего микрофона.</p></div><div onClick={()=>setNoise(!noise)} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${noise ? 'bg-green-500' : 'bg-gray-500'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${noise ? 'translate-x-6' : 'translate-x-0'}`}/></div></div></div><div className="flex justify-end gap-4"><button onClick={onClose} className="text-gray-400 hover:text-white font-bold text-sm">Отмена</button><button onClick={saveProfile} className="bg-[#5865F2] px-8 py-2.5 rounded-xl font-bold text-white shadow-lg hover:bg-[#4752c4] transition-all">Сохранить</button></div></>)}</div></motion.div></div>);
}

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
    <div className="h-screen flex items-center justify-center relative bg-[#0B0B0C] overflow-hidden">
      <BackgroundEffect />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#313338] p-8 rounded-3xl shadow-2xl w-full max-w-[480px] z-10 relative border border-white/5">
        {isLogin ? (
            <>
                <h2 className="text-2xl font-black text-white text-center mb-2">С возвращением!</h2>
                <p className="text-gray-400 text-center text-xs mb-8 font-bold">Мы так рады видеть вас снова!</p>
                <Input label="Адрес электронной почты или имя пользователя" required value={loginData.login} onChange={e=>setLoginData({...loginData, login:e.target.value})}/>
                <Input label="Пароль" type="password" required value={loginData.password} onChange={e=>setLoginData({...loginData, password:e.target.value})}/>
                <div className="text-[#00A8FC] text-xs font-bold cursor-pointer mt-2 hover:underline">Забыли пароль?</div>
                <button onClick={handleLogin} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 rounded-xl transition-all mb-4 mt-6 shadow-lg shadow-indigo-500/20">Вход</button>
                <div className="text-xs text-gray-400 mt-2 font-medium">Нужна учетная запись? <span onClick={()=>setIsLogin(false)} className="text-[#00A8FC] cursor-pointer hover:underline font-bold">Зарегистрироваться</span></div>
            </>
        ) : (
            <div className="max-h-[85vh] overflow-y-auto no-scrollbar pr-1">
                <h2 className="text-2xl font-black text-white text-center mb-6">Создать учетную запись</h2>
                <Input label="E-mail" required value={regData.email} onChange={e=>setRegData({...regData, email:e.target.value})}/>
                <Input label="Отображаемое имя" value={regData.displayName} onChange={e=>setRegData({...regData, displayName:e.target.value})}/>
                <div className="mb-4">
                    <label className={`block text-[10px] font-black uppercase mb-2 ${usernameStatus==='taken'?'text-red-400':'text-gray-400'}`}>Имя пользователя <span className="text-red-400">*</span></label>
                    <input value={regData.username} onChange={e=>setRegData({...regData, username:e.target.value})} className="w-full bg-[#1E1F22] p-3 rounded-xl text-white outline-none text-sm transition-all font-medium" />
                    {usernameStatus === 'free' && <p className="text-green-400 text-xs mt-1 font-bold">Супер! Это имя свободно.</p>}
                    {usernameStatus === 'taken' && <p className="text-red-400 text-xs mt-1 font-bold">Имя занято.</p>}
                </div>
                <Input label="Пароль" type="password" required value={regData.password} onChange={e=>setRegData({...regData, password:e.target.value})}/>
                <div className="mb-6">
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-2">Дата рождения <span className="text-red-400">*</span></label>
                    <div className="flex gap-3">
                        <div className="w-[30%]"><CustomSelect placeholder="День" value={regData.day} options={[...Array(31)].map((_,i)=>i+1)} onChange={v=>setRegData({...regData, day:v})} /></div>
                        <div className="w-[40%]"><CustomSelect placeholder="Месяц" value={regData.month} options={["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"]} onChange={v=>setRegData({...regData, month:v})} /></div>
                        <div className="w-[30%]"><CustomSelect placeholder="Год" value={regData.year} options={[...Array(100)].map((_,i)=>2024-i)} onChange={v=>setRegData({...regData, year:v})} /></div>
                    </div>
                </div>
                <button onClick={handleRegister} className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3 rounded-xl transition-all mt-6 shadow-lg shadow-indigo-500/20">Продолжить</button>
                <div className="text-xs text-[#00A8FC] mt-4 cursor-pointer hover:underline font-bold text-center" onClick={()=>{setIsLogin(true); setError("")}}>Уже зарегистрированы? Войти</div>
            </div>
        )}
        {error && <div className="mt-4 bg-red-500/10 border border-red-500 text-white p-3 rounded-xl text-xs text-center font-bold flex items-center justify-center gap-2"><AlertCircle size={16}/> {error}</div>}
      </motion.div>
    </div>
  );
}