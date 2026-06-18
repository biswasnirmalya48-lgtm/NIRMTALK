import { useState, useEffect } from 'react';

export function DynamicScenery() {
  const [hour, setHour] = useState(new Date().getHours());
  const [minute, setMinute] = useState(new Date().getMinutes());

  useEffect(() => {
    const interval = setInterval(() => {
      setHour(new Date().getHours());
      setMinute(new Date().getMinutes());
    }, 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  const totalMinutes = hour * 60 + minute; // 0 to 1440
  
  // Calculate sun/moon position
  const isDay = hour >= 6 && hour < 18;
  const cycleMinutes = isDay ? totalMinutes - 360 : (totalMinutes >= 1080 ? totalMinutes - 1080 : totalMinutes + 360);
  const progress = cycleMinutes / 720;

  const sunX = progress * 100;
  const sunY = 90 - Math.sin(progress * Math.PI) * 70;

  const getSkyGradient = () => {
    if (hour >= 5 && hour < 8) return 'linear-gradient(to bottom, #87CEEB, #f4a460)'; // Dawn
    if (hour >= 8 && hour < 16) return 'linear-gradient(to bottom, #4CA1AF, #87CEFA)'; // Day
    if (hour >= 16 && hour < 19) return 'linear-gradient(to bottom, #FF7E5F, #FEB47B)'; // Dusk
    return 'linear-gradient(to bottom, #0f2027, #203a43, #2c5364)'; // Night
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" style={{ background: getSkyGradient() }}>
      {/* Stars for night */}
      {!isDay && (
        <div className="absolute inset-0 opacity-50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDIiIGhlaWdodD0iNDAyIj48ZyBmaWxsPSIjRkZGIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMSIvPjxjaXJjbGUgY3g9IjIwMCIgY3k9IjMwMCIgcj0iMSIvPjxjaXJjbGUgY3g9IjMwMCIgY3k9IjE1MCIgcj0iMiIvPjwvZz48L3N2Zz4=')]"></div>
      )}

      {/* Sun/Moon */}
      <div 
        className="absolute rounded-full transition-all duration-1000 ease-linear shadow-lg" 
        style={{
          left: `${Math.max(5, Math.min(95, sunX))}%`,
          top: `${Math.max(5, Math.min(100, sunY))}%`,
          width: '60px',
          height: '60px',
          marginLeft: '-30px',
          marginTop: '-30px',
          background: isDay ? 'radial-gradient(circle, #FDB813, #FF8C00)' : 'radial-gradient(circle, #E6E6FA, #DCDCDC)',
          boxShadow: isDay ? '0 0 50px 20px rgba(253, 184, 19, 0.4)' : '0 0 30px 10px rgba(230, 230, 250, 0.1)',
        }}
      />

      {/* Clouds for Day */}
      {isDay && (
        <div className="absolute inset-0 opacity-30">
           <svg width="100%" height="30%" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M 10 30 Q 20 20 30 30 Q 40 20 50 30 Q 60 40 40 40 Q 20 40 10 30 Z" fill="#ffffff" />
             <path d="M 60 50 Q 70 40 80 50 Q 90 40 100 50 Q 110 60 80 60 Q 50 60 60 50 Z" fill="#ffffff" />
           </svg>
        </div>
      )}

      {/* Scenery Silhouette (Mountains/Hills) */}
      <div className="absolute bottom-0 left-0 right-0 h-[35%] opacity-90">
        <svg preserveAspectRatio="none" viewBox="0 0 100 100" width="100%" height="100%">
          <path d="M0,100 L0,60 Q15,40 30,55 T60,50 T100,60 L100,100 Z" fill={isDay ? "#1e4d2b" : "#0f172a"} />
          <path d="M0,100 L0,75 Q20,60 40,85 T80,70 T100,85 L100,100 Z" fill={isDay ? "#14361e" : "#020617"} />
        </svg>
      </div>
    </div>
  );
}
