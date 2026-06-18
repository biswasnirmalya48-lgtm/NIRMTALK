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
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return user ? (
    <CallProvider>
      <MainLayout />
    </CallProvider>
  ) : <Login />;
}

