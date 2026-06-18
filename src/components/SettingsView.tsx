import { useState, useRef } from 'react';
import { Camera, LogOut, ChevronLeft, Moon, Sun, Monitor, Type, Palette, Lock, Eye, Bell, Shield, Smartphone, Globe, Upload, UserCircle, Settings } from 'lucide-react';
import { logout } from '../firebase';
import { updateUserProfile } from '../hooks/useFirestore';
import { UserProfile } from '../types';

interface Props {
  profile: UserProfile;
  initialPhoto: string;
  onClose: () => void;
}

export function SettingsView({ profile, initialPhoto, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'main' | 'account' | 'appearance' | 'privacy' | 'preferences'>('main');
  
  // Account state
  const [editName, setEditName] = useState(profile.displayName || '');
  const [editUsername, setEditUsername] = useState(profile.username || '');
  const [editBio, setEditBio] = useState(profile.bio || '');
  const [editPhone, setEditPhone] = useState(profile.phoneNumber || '');
  const [editPhoto, setEditPhoto] = useState(initialPhoto);
  
  // Settings state (with defaults)
  const settings = profile.settings || {};
  const [theme, setTheme] = useState(settings.theme || 'auto');
  const [accentColor, setAccentColor] = useState(settings.accentColor || 'blue');
  const [fontSize, setFontSize] = useState(settings.fontSize || 'medium');
  const [bubbleStyle, setBubbleStyle] = useState(settings.chatBubbleStyle || 'rounded');
  const [chatWallpaper, setChatWallpaper] = useState(settings.chatWallpaper || '');
  const [hapticsEnabled, setHapticsEnabled] = useState(settings.hapticsEnabled ?? true);
  const [autoDownloadMedia, setAutoDownloadMedia] = useState(settings.autoDownloadMedia ?? true);
  const [language, setLanguage] = useState(settings.language || 'en');
  
  const privacy = settings.privacy || {};
  const [lastSeen, setLastSeen] = useState(privacy.lastSeen || 'everyone');
  const [profilePhoto, setProfilePhoto] = useState(privacy.profilePhoto || 'everyone');
  const [whoCanMessage, setWhoCanMessage] = useState(privacy.whoCanMessage || 'everyone');
  const [whoCanCall, setWhoCanCall] = useState(privacy.whoCanCall || 'everyone');
  const [readReceipts, setReadReceipts] = useState(privacy.readReceipts ?? true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > 256) { height *= 256 / width; width = 256; }
          } else {
            if (height > 256) { width *= 256 / height; height = 256; }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (e: any) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const resized = await resizeImage(file);
        setEditPhoto(resized);
        await handleSave({ photoURL: resized });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSave = async (updates: Partial<UserProfile>) => {
    await updateUserProfile(updates);
  };

  const saveAll = async () => {
    await handleSave({
      displayName: editName.trim() || 'Anonymous',
      username: editUsername.trim(),
      bio: editBio.trim(),
      phoneNumber: editPhone.trim(),
      settings: {
        theme: theme as any,
        accentColor,
        fontSize: fontSize as any,
        chatBubbleStyle: bubbleStyle as any,
        chatWallpaper,
        hapticsEnabled,
        autoDownloadMedia,
        language,
        privacy: {
          lastSeen: lastSeen as any,
          profilePhoto: profilePhoto as any,
          whoCanMessage: whoCanMessage as any,
          whoCanCall: whoCanCall as any,
          readReceipts
        }
      }
    });
  };

  const Header = ({ title, showBack = true }: { title: string, showBack?: boolean }) => (
    <div className="flex items-center gap-3 mb-6">
      {showBack && (
        <button onClick={() => setActiveTab('main')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
      {showBack && (
         <button onClick={() => { saveAll(); setActiveTab('main'); }} className="ml-auto text-sm font-medium text-blue-500 hover:text-blue-600">Save</button>
      )}
    </div>
  );

  const renderTabMain = () => (
    <div className="animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Settings</h2>
        <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Profile Summary Card */}
      <div className="flex items-center gap-4 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm p-4 rounded-2xl mb-6">
        <div className="relative cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
           {editPhoto ? (
             <img src={editPhoto} alt="Me" className="w-16 h-16 rounded-full object-cover" />
           ) : (
             <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center font-semibold text-2xl">
               {editName.charAt(0).toUpperCase()}
             </div>
           )}
           <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
              <Camera className="w-6 h-6" />
           </div>
        </div>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{editName}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{editUsername ? `@${editUsername}` : profile.email}</p>
        </div>
      </div>

      <div className="space-y-1">
        <button onClick={() => setActiveTab('account')} className="w-full flex items-center gap-4 p-3 hover:bg-white/40 dark:hover:bg-white/5 rounded-xl transition-colors">
          <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300"><UserCircle className="w-5 h-5" /></div>
          <div className="flex-1 text-left"><div className="font-medium text-slate-900 dark:text-white">Account</div><div className="text-[13px] text-slate-500">Profile, username, bio</div></div>
        </button>
        <button onClick={() => setActiveTab('appearance')} className="w-full flex items-center gap-4 p-3 hover:bg-white/40 dark:hover:bg-white/5 rounded-xl transition-colors">
          <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300"><Palette className="w-5 h-5" /></div>
          <div className="flex-1 text-left"><div className="font-medium text-slate-900 dark:text-white">Appearance</div><div className="text-[13px] text-slate-500">Theme, colors, font size</div></div>
        </button>
        <button onClick={() => setActiveTab('privacy')} className="w-full flex items-center gap-4 p-3 hover:bg-white/40 dark:hover:bg-white/5 rounded-xl transition-colors">
          <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300"><Lock className="w-5 h-5" /></div>
          <div className="flex-1 text-left"><div className="font-medium text-slate-900 dark:text-white">Privacy and Safety</div><div className="text-[13px] text-slate-500">Last seen, blocked users</div></div>
        </button>
        <button onClick={() => setActiveTab('preferences')} className="w-full flex items-center gap-4 p-3 hover:bg-white/40 dark:hover:bg-white/5 rounded-xl transition-colors">
          <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300"><Settings className="w-5 h-5" /></div>
          <div className="flex-1 text-left"><div className="font-medium text-slate-900 dark:text-white">Preferences</div><div className="text-[13px] text-slate-500">Language, haptics, media</div></div>
        </button>
      </div>

      <div className="h-px bg-slate-200 dark:bg-white/10 my-4"></div>
      
      <button onClick={() => logout()} className="w-full flex items-center gap-4 p-3 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-xl transition-colors">
        <div className="w-10 h-10 rounded-full flex items-center justify-center"><LogOut className="w-5 h-5" /></div>
        <div className="text-left font-medium">Log Out</div>
      </button>
    </div>
  );

  const renderTabAccount = () => (
    <div className="animate-in slide-in-from-right-4 fade-in duration-200">
      <Header title="Account" />
      <div className="space-y-4">
        <div>
          <label className="text-[13px] font-semibold text-slate-500 ml-1">Name</label>
          <input type="text" value={editName} onChange={e=>setEditName(e.target.value)} className="w-full mt-1 bg-white/50 dark:bg-white/5 backdrop-blur-md px-4 py-3 rounded-xl border border-transparent dark:border-white/10 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-slate-500 ml-1">Username</label>
          <div className="relative mt-1">
            <span className="absolute left-4 top-3 text-slate-400">@</span>
            <input type="text" value={editUsername} onChange={e=>setEditUsername(e.target.value)} className="w-full bg-white/50 dark:bg-white/5 backdrop-blur-md pl-8 pr-4 py-3 rounded-xl border border-transparent dark:border-white/10 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" />
          </div>
        </div>
        <div>
          <label className="text-[13px] font-semibold text-slate-500 ml-1">Bio</label>
          <textarea value={editBio} onChange={e=>setEditBio(e.target.value)} rows={3} className="w-full mt-1 bg-white/50 dark:bg-white/5 backdrop-blur-md px-4 py-3 rounded-xl border border-transparent dark:border-white/10 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none text-slate-900 dark:text-white" placeholder="A few words about you..." />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-slate-500 ml-1">Phone Number</label>
          <input type="tel" value={editPhone} onChange={e=>setEditPhone(e.target.value)} className="w-full mt-1 bg-white/50 dark:bg-white/5 backdrop-blur-md px-4 py-3 rounded-xl border border-transparent dark:border-white/10 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white" placeholder="+1 ..." />
        </div>
        <div>
          <label className="text-[13px] font-semibold text-slate-500 ml-1">Email</label>
          <input type="email" value={profile.email} disabled className="w-full mt-1 bg-slate-100 dark:bg-white/5 opacity-70 px-4 py-3 rounded-xl outline-none cursor-not-allowed text-slate-900 dark:text-white" />
        </div>
      </div>
    </div>
  );

  const renderTabAppearance = () => (
    <div className="animate-in slide-in-from-right-4 fade-in duration-200">
      <Header title="Appearance" />
      <div className="space-y-6">
        <div>
          <label className="text-[13px] font-semibold text-slate-500 mb-2 block ml-1">Color Theme</label>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setTheme('light')} className={`py-4 flex flex-col items-center gap-2 rounded-xl border-2 transition-all ${theme === 'light' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-transparent bg-white/40 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>
              <Sun className="w-6 h-6" /><span className="text-sm font-medium">Light</span>
            </button>
            <button onClick={() => setTheme('dark')} className={`py-4 flex flex-col items-center gap-2 rounded-xl border-2 transition-all ${theme === 'dark' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-transparent bg-white/40 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>
              <Moon className="w-6 h-6" /><span className="text-sm font-medium">Dark</span>
            </button>
            <button onClick={() => setTheme('auto')} className={`py-4 flex flex-col items-center gap-2 rounded-xl border-2 transition-all ${theme === 'auto' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-transparent bg-white/40 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}>
              <Monitor className="w-6 h-6" /><span className="text-sm font-medium">System</span>
            </button>
          </div>
        </div>
        
        <div>
           <label className="text-[13px] font-semibold text-slate-500 mb-2 block ml-1">Text Size</label>
           <div className="flex bg-white/40 dark:bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/40 dark:border-white/10">
             {['small', 'medium', 'large'].map(s => (
               <button key={s} onClick={() => setFontSize(s as any)} className={`flex-1 py-2 text-sm capitalize font-medium rounded-lg transition-colors ${fontSize === s ? 'bg-white shadow-sm text-slate-900 dark:bg-white/10 dark:text-white dark:shadow-none' : 'text-slate-500 dark:text-slate-400'}`}>
                 {s}
               </button>
             ))}
           </div>
        </div>

        <div>
           <label className="text-[13px] font-semibold text-slate-500 mb-2 block ml-1">Message Corners</label>
           <div className="flex bg-white/40 dark:bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/40 dark:border-white/10">
             <button onClick={() => setBubbleStyle('rounded')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${bubbleStyle === 'rounded' ? 'bg-white shadow-sm text-slate-900 dark:bg-white/10 dark:text-white dark:shadow-none' : 'text-slate-500 dark:text-slate-400'}`}>
               Rounded
             </button>
             <button onClick={() => setBubbleStyle('square')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${bubbleStyle === 'square' ? 'bg-white shadow-sm text-slate-900 dark:bg-white/10 dark:text-white dark:shadow-none' : 'text-slate-500 dark:text-slate-400'}`}>
               Square
             </button>
           </div>
        </div>

        <div>
           <label className="text-[13px] font-semibold text-slate-500 mb-2 block ml-1">Chat Wallpaper URL</label>
           <div className="flex bg-white/40 dark:bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/40 dark:border-white/10">
              <input type="url" value={chatWallpaper} onChange={e=>setChatWallpaper(e.target.value)} className="w-full bg-transparent px-3 py-2 outline-none text-slate-900 dark:text-white text-[14px]" placeholder="https://example.com/bg.jpg" />
           </div>
        </div>
      </div>
    </div>
  );

  const renderTabPrivacy = () => (
    <div className="animate-in slide-in-from-right-4 fade-in duration-200">
      <Header title="Privacy" />
      <div className="space-y-4">
        {[
          { label: 'Last seen & online', value: lastSeen, set: setLastSeen, opts: ['everyone', 'contacts', 'nobody'] },
          { label: 'Profile Photo', value: profilePhoto, set: setProfilePhoto, opts: ['everyone', 'contacts', 'nobody'] },
          { label: 'Who can message me', value: whoCanMessage, set: setWhoCanMessage, opts: ['everyone', 'contacts'] },
          { label: 'Who can call me', value: whoCanCall, set: setWhoCanCall, opts: ['everyone', 'contacts', 'nobody'] }
        ].map((item, idx) => (
          <div key={idx} className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/40 dark:border-white/10">
            <label className="text-[14px] font-semibold text-slate-900 dark:text-white mb-3 block">{item.label}</label>
            <div className="flex gap-2 bg-white/40 dark:bg-white/5 backdrop-blur-md p-1 rounded-lg">
               {item.opts.map(opt => (
                 <button key={opt} onClick={() => item.set(opt)} className={`flex-1 py-1.5 text-[13px] capitalize font-medium rounded-md transition-colors ${item.value === opt ? 'bg-white shadow-sm text-slate-900 dark:bg-white/10 dark:text-white dark:shadow-none' : 'text-slate-500 dark:text-slate-400'}`}>
                   {opt}
                 </button>
               ))}
            </div>
          </div>
        ))}
        
        <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/40 dark:border-white/10 flex items-center justify-between cursor-pointer" onClick={() => setReadReceipts(!readReceipts)}>
           <div>
             <div className="text-[14px] font-semibold text-slate-900 dark:text-white">Read Receipts</div>
             <div className="text-[12px] text-slate-500 mt-0.5">Show others when you've read their messages</div>
           </div>
           <div className={`w-11 h-6 rounded-full transition-colors relative ${readReceipts ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
             <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${readReceipts ? 'left-6' : 'left-1'}`}></div>
           </div>
        </div>
      </div>
    </div>
  );

  const renderTabPreferences = () => (
    <div className="animate-in slide-in-from-right-4 fade-in duration-200">
      <Header title="Preferences" />
      <div className="space-y-4">
        <label className="text-[13px] font-semibold text-slate-500 block ml-1 mb-2">General</label>
        
        <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/40 dark:border-white/10 flex items-center justify-between cursor-pointer" onClick={() => setHapticsEnabled(!hapticsEnabled)}>
           <div>
             <div className="text-[14px] font-semibold text-slate-900 dark:text-white">Haptic Feedback</div>
             <div className="text-[12px] text-slate-500 mt-0.5">Vibrate on message actions</div>
           </div>
           <div className={`w-11 h-6 rounded-full transition-colors relative ${hapticsEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
             <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${hapticsEnabled ? 'left-6' : 'left-1'}`}></div>
           </div>
        </div>

        <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/40 dark:border-white/10 flex items-center justify-between cursor-pointer" onClick={() => setAutoDownloadMedia(!autoDownloadMedia)}>
           <div>
             <div className="text-[14px] font-semibold text-slate-900 dark:text-white">Auto-Download Media</div>
             <div className="text-[12px] text-slate-500 mt-0.5">Automatically download photos and media</div>
           </div>
           <div className={`w-11 h-6 rounded-full transition-colors relative ${autoDownloadMedia ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
             <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoDownloadMedia ? 'left-6' : 'left-1'}`}></div>
           </div>
        </div>

        <div>
           <label className="text-[13px] font-semibold text-slate-500 mb-2 mt-4 block ml-1">App Language</label>
           <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/40 dark:border-white/10">
              <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-transparent px-3 py-3 outline-none text-[15px] font-medium text-slate-900 dark:text-white cursor-pointer">
                <option value="en">English (US)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="hi">हिन्दी</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
              </select>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="absolute inset-0 bg-transparent z-50 flex flex-col md:relative md:w-full md:border-none">
       <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
         {activeTab === 'main' && renderTabMain()}
         {activeTab === 'account' && renderTabAccount()}
         {activeTab === 'appearance' && renderTabAppearance()}
         {activeTab === 'privacy' && renderTabPrivacy()}
         {activeTab === 'preferences' && renderTabPreferences()}
       </div>
    </div>
  );
}
