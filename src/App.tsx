import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './components/Login';
import { MainLayout } from './components/MainLayout';
import { CallProvider } from './providers/CallProvider';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let focusInterval: any;

    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (u) {
        setLoading(false);
        const updateStatus = async (isOnline: boolean) => {
          const profileRef = doc(db, 'users', u.uid);
          try {
            await setDoc(profileRef, {
              userId: u.uid,
              displayName: u.displayName || 'Anonymous',
              email: u.email || '',
              photoURL: u.photoURL || '',
              status: isOnline ? 'online' : 'offline',
              lastSeen: serverTimestamp()
            }, { merge: true });
          } catch(e) { }
        };

        const handleVisibility = () => {
          updateStatus(document.visibilityState === 'visible');
        };

        const handleBeforeUnload = () => {
          updateStatus(false);
        };

        await updateStatus(true); // set online on connect

        // Seed NIRM AI Bot
        const seedBot = async () => {
          const botRef = doc(db, 'users', 'nirm-ai');
          try {
            await setDoc(botRef, {
              userId: 'nirm-ai',
              displayName: 'NIRM AI ⚡',
              email: 'nirm-ai@nirmtalk.local',
              photoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
              status: 'online',
              lastSeen: serverTimestamp(),
              isBot: true,
              username: 'nirmaireply',
              settings: {
                privacy: {
                  whoCanMessage: 'everyone',
                  whoCanCall: 'nobody',
                  profilePhoto: 'everyone',
                  lastSeen: 'everyone'
                }
              }
            }, { merge: true });
          } catch(e) { }
        };
        seedBot();

        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', handleBeforeUnload);

        focusInterval = setInterval(() => {
           if (document.visibilityState === 'visible') {
              updateStatus(true);
           }
        }, 60000); // 1 min heartbeat

        return () => {
          document.removeEventListener('visibilitychange', handleVisibility);
          window.removeEventListener('beforeunload', handleBeforeUnload);
          clearInterval(focusInterval);
          updateStatus(false);
        };
      } else {
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (focusInterval) clearInterval(focusInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060813] flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Ambient atmospheric background glows */}
        <div className="absolute top-1/4 left-1/4 w-[180px] h-[180px] bg-blue-500/15 rounded-full blur-[60px] animate-pulse-slow pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[180px] h-[180px] bg-indigo-500/15 rounded-full blur-[60px] animate-pulse-slow pointer-events-none" />
        
        {/* Floating responsive assembly card */}
        <div className="relative z-10 p-8 rounded-[36px] bg-white/5 dark:bg-white/5 backdrop-blur-2xl border border-white/10 dark:border-white/5 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-[90%] text-center">
          {/* Pulsing app identity crown */}
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20 active:scale-95">
             <span className="font-extrabold text-[24px] uppercase tracking-tight antialiased animate-pulse">N</span>
          </div>
          
          <div className="space-y-2">
            <h1 className="font-display font-black text-2xl tracking-tight text-white leading-none">NirmTalk</h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Securing safe server handshake...</p>
          </div>
          
          {/* Glass progressive linear track representing luxury assembly */}
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
            <div className="absolute left-0 top-0 bottom-0 w-2/3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full premium-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return user ? (
    <CallProvider>
      <MainLayout />
    </CallProvider>
  ) : <Login />;
}

