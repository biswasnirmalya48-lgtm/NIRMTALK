import { useState, useEffect, useMemo } from 'react';

interface SceneryTheme {
  skyGradient: string;
  sunMoonGradient: string;
  sunMoonGlow: string;
  isDay: boolean;
  fogColor: string;
  fogOpacity: number;
  starsOpacity: number;
  mountainBack: string;
  mountainBackHighlight: string;
  mountainMid: string;
  mountainFront: string;
  firefliesVisible: boolean;
  nebulaOpacity: number;
  cloudColor: string;
  cloudOpacity: number;
  sunGlareOpacity: number;
}

export function DynamicScenery() {
  const [hour, setHour] = useState(() => {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    return isDark ? 22 : 12;
  });
  const [minute, setMinute] = useState(30);

  useEffect(() => {
    const updateSceneryFromDOM = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setHour(isDark ? 22 : 12);
    };

    updateSceneryFromDOM();

    // Create a MutationObserver to watch class changes on documentElement
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateSceneryFromDOM();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const totalMinutes = hour * 60 + minute; // 0 to 1440

  // Calculate sun/moon parabolic position based on the progress of 12-hour cycles
  // Day-cycle (06:00 to 18:00) / Night-cycle (18:00 to 06:00)
  const isCurrentlyDay = hour >= 6 && hour < 18;
  const cycleMinutes = isCurrentlyDay 
    ? totalMinutes - 360 // Minutes since 06:00
    : (totalMinutes >= 1080 ? totalMinutes - 1080 : totalMinutes + 360); // Minutes since 18:00

  const progress = cycleMinutes / 720; // 0 to 1

  // Parabolic projection for perfect circular arc fitting portrait phones and desktop screens
  const sunX = 5 + progress * 90; // Stay between 5% and 95% horizontally
  // Y position forms a beautiful arc higher up for realistic sky depth
  const sunY = 55 - Math.sin(progress * Math.PI) * 45; 

  // Compute scenery theme parameters
  const theme: SceneryTheme = useMemo(() => {
    // 1. Dawn / Sunrise (05:00 - 07:59)
    if (hour >= 5 && hour < 8) {
      return {
        skyGradient: 'linear-gradient(to bottom, #111e38 0%, #1c355e 25%, #3c547a 50%, #d46363 75%, #f9a066 90%, #ffe094 100%)',
        sunMoonGradient: 'radial-gradient(circle, #ffeed1 0%, #ffa502 60%, #ff5252 100%)',
        sunMoonGlow: '0 0 70px 25px rgba(255, 122, 0, 0.45), 0 0 120px 50px rgba(255, 224, 150, 0.25)',
        isDay: true,
        fogColor: '#f9a066',
        fogOpacity: 0.45,
        starsOpacity: 0.15,
        mountainBack: '#30213b',
        mountainBackHighlight: '#ff9070',
        mountainMid: '#24142c',
        mountainFront: '#16091e',
        firefliesVisible: false,
        nebulaOpacity: 0.05,
        cloudColor: 'rgba(255, 210, 180, 0.55)',
        cloudOpacity: 0.7,
        sunGlareOpacity: 0.35,
      };
    }
    
    // 2. High-Fidelity Vibrant Day (08:00 - 16:29)
    if (hour >= 8 && hour < 16) {
      return {
        skyGradient: 'linear-gradient(to bottom, #1562a3 0%, #298dcd 30%, #5baee2 60%, #90d3f2 85%, #d1f0ff 100%)',
        sunMoonGradient: 'radial-gradient(circle, #ffffff 10%, #fffbe3 35%, #ffd438 75%, #ff8000 100%)',
        sunMoonGlow: '0 0 90px 30px rgba(255, 230, 100, 0.65), 0 0 160px 70px rgba(255, 160, 0, 0.3)',
        isDay: true,
        fogColor: '#e0f5ff',
        fogOpacity: 0.2,
        starsOpacity: 0,
        mountainBack: '#254e6b',
        mountainBackHighlight: '#80c8f5',
        mountainMid: '#1a3a52',
        mountainFront: '#102638',
        firefliesVisible: false,
        nebulaOpacity: 0,
        cloudColor: 'rgba(255, 255, 255, 0.88)',
        cloudOpacity: 0.85,
        sunGlareOpacity: 0.7,
      };
    }

    // 3. Cinematic Sunset / Dusk (16:30 - 19:29)
    if (hour >= 16 && hour < 20) {
      return {
        skyGradient: 'linear-gradient(to bottom, #060d1d 0%, #141f3d 20%, #30264a 45%, #8c3a5c 70%, #de5448 85%, #fca858 100%)',
        sunMoonGradient: 'radial-gradient(circle, #ffeedb 0%, #ff6b35 50%, #d81b60 100%)',
        sunMoonGlow: '0 0 100px 35px rgba(255, 60, 50, 0.55), 0 0 180px 75px rgba(253, 168, 88, 0.3)',
        isDay: true,
        fogColor: '#de5448',
        fogOpacity: 0.4,
        starsOpacity: 0.05,
        mountainBack: '#23102d',
        mountainBackHighlight: '#ff8660',
        mountainMid: '#180721',
        mountainFront: '#0d0115',
        firefliesVisible: true,
        nebulaOpacity: 0.08,
        cloudColor: 'rgba(255, 140, 110, 0.45)',
        cloudOpacity: 0.75,
        sunGlareOpacity: 0.5,
      };
    }

    // 4. Stellar Celestial Night (20:00 - 04:59)
    return {
      skyGradient: 'linear-gradient(to bottom, #010103 0%, #03040e 25%, #080824 60%, #100f35 100%)',
      sunMoonGradient: 'radial-gradient(circle, #ffffff 20%, #e8ecf5 55%, #c0c6d4 85%, #9aa0b0 100%)',
      sunMoonGlow: '0 0 55px 15px rgba(220, 230, 255, 0.35), 0 0 110px 45px rgba(160, 180, 240, 0.15)',
      isDay: false,
      fogColor: '#0a0928',
      fogOpacity: 0.25,
      starsOpacity: 1,
      mountainBack: '#04050b',
      mountainBackHighlight: '#3c475d',
      mountainMid: '#020206',
      mountainFront: '#000000',
      firefliesVisible: true,
      nebulaOpacity: 0.28,
      cloudColor: 'rgba(80, 95, 160, 0.18)',
      cloudOpacity: 0.5,
      sunGlareOpacity: 0,
    };
  }, [hour]);

  // Generate highly realistic twinkling starfield (static positions mapped via deterministic logic to avoid frame flashing)
  const stars = useMemo(() => {
    const starList = [];
    let state = 88.55;
    const lcg = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    for (let i = 0; i < 75; i++) {
      starList.push({
        id: i,
        x: lcg() * 100,
        y: lcg() * 75, // Lowered a bit to interact beautifully with phone portrait scrolling
        size: lcg() > 0.85 ? 2.5 : lcg() > 0.45 ? 1.5 : 1,
        delay: lcg() * 6,
        duration: 1.8 + lcg() * 4,
        type: lcg() > 0.85 ? 'pulse' : lcg() > 0.4 ? 'shimmer' : 'normal',
      });
    }
    return starList;
  }, []);

  // Generate fireflies dancing gracefully near forest floors during twilight/night
  const fireflies = useMemo(() => {
    const bugs = [];
    let state = 999.314;
    const lcg = () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
    for (let i = 0; i < 14; i++) {
      bugs.push({
        id: i,
        x: lcg() * 100,
        y: 65 + lcg() * 28, // Near mountain silhouette levels
        size: 1.5 + lcg() * 2.5,
        delay: lcg() * 5,
        duration: 3.5 + lcg() * 4.5,
        driftX: -20 + lcg() * 40,
        driftY: -15 + lcg() * 30,
      });
    }
    return bugs;
  }, []);

  // Volumetric clouds configuration drifting at multi-altitudes and multi-speeds
  const cloudBases = [
    { id: 'cloud-s1', top: '10%', speed: '190s', scale: 0.85, opacity: 0.4 },
    { id: 'cloud-m2', top: '22%', speed: '120s', scale: 1.15, opacity: 0.55 },
    { id: 'cloud-f3', top: '6%', speed: '80s', scale: 0.6, opacity: 0.3 },
    { id: 'cloud-vs4', top: '35%', speed: '250s', scale: 1.4, opacity: 0.25 },
  ];

  return (
    <div 
      className="absolute inset-0 overflow-hidden pointer-events-none z-0 select-none" 
      style={{ 
        background: theme.skyGradient,
        transition: 'background 4s cubic-bezier(0.4, 0, 0.2, 1)' 
      }}
    >
      {/* Inline styles for precise CSS Keyframes and Custom animations */}
      <style>{`
        @keyframes starry-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.25); }
        }
        @keyframes starry-shimmer {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.85; filter: drop-shadow(0 0 4px #fff); }
        }
        @keyframes solar-rot {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes firefly-dance {
          0%, 100% { transform: translate(0px, 0px); opacity: 0; }
          20% { opacity: 0.7; }
          50% { transform: translate(var(--dx), var(--dy)); opacity: 0.9; }
          80% { opacity: 0.4; }
        }
        @keyframes cloud-slide {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(150%); }
        }
        @keyframes shooting-streak {
          0% { transform: translate(0, 0) rotate(-40deg) scale(0); opacity: 0; }
          12% { opacity: 1; transform: translate(-140px, 120px) rotate(-40deg) scale(1); }
          25% { transform: translate(-300px, 250px) rotate(-40deg) scale(0); opacity: 0; }
          100% { transform: translate(-330px, 270px) rotate(-40deg) scale(0); opacity: 0; }
        }
        @keyframes ambient-fog {
          0%, 100% { transform: translateY(0px) scaleY(1); }
          50% { transform: translateY(-8px) scaleY(1.08); }
        }
        .animate-cloud {
          animation: cloud-slide var(--speed) linear infinite;
        }
        .animate-twinkle {
          animation: starry-twinkle var(--duration) ease-in-out infinite;
        }
        .animate-shimmer {
          animation: starry-shimmer var(--duration) ease-in-out infinite;
        }
        .animate-shooting {
          animation: shooting-streak 14s cubic-bezier(0.1, 0.8, 0.2, 1) infinite;
        }
        .animate-firefly {
          animation: firefly-dance var(--duration) ease-in-out infinite;
        }
      `}</style>

      {/* 2. Detailed Milky Way / Nebula Background glow during deep night / evening */}
      {theme.nebulaOpacity > 0 && (
        <div 
          className="absolute inset-0 transition-opacity duration-1000 mix-blend-color-dodge pointer-events-none"
          style={{
            opacity: theme.nebulaOpacity,
            background: `radial-gradient(circle at 65% 25%, rgba(139, 92, 246, 0.18) 0%, rgba(236, 72, 153, 0.08) 40%, rgba(59, 130, 246, 0.04) 70%, transparent 100%)`
          }}
        />
      )}

      {/* 3. Twinkling customizable starfield (Night, sunset or sunrise/dawn) */}
      {theme.starsOpacity > 0 && (
        <div 
          className="absolute inset-0 pointer-events-none transition-opacity duration-[3s] px-1 md:px-0"
          style={{ opacity: theme.starsOpacity }}
        >
          {stars.map((star) => (
            <div
              key={star.id}
              className={`absolute rounded-full bg-white ${
                star.type === 'pulse' ? 'animate-twinkle' : star.type === 'shimmer' ? 'animate-shimmer' : 'opacity-40'
              }`}
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                boxShadow: star.size > 2 ? '0 0 6px 1px #fff' : 'none',
                '--duration': `${star.duration}s`,
                '--delay': `${star.delay}s`,
                animationDelay: `${star.delay}s`
              } as any}
            />
          ))}

          {/* Shooting Star effect */}
          <div 
            className="absolute rounded-full animate-shooting bg-gradient-to-r from-transparent via-white/90 to-white shadow-[0_0_8px_white]"
            style={{
              top: '15%',
              right: '18%',
              width: '80px',
              height: '1.5px',
              animationDelay: '3s'
            }}
          />
          <div 
            className="absolute rounded-full animate-shooting bg-gradient-to-r from-transparent via-cyan-200/90 to-white shadow-[0_0_8px_cyan]"
            style={{
              top: '40%',
              right: '5%',
              width: '100px',
              height: '1px',
              animationDelay: '9s'
            }}
          />
        </div>
      )}

      {/* 4. Realistic Sun with glare reflection spikes OR Moon with actual lunar details */}
      <div 
        className="absolute rounded-full transition-all duration-[3000ms] ease-out z-10" 
        style={{
          left: `${sunX}%`,
          top: `${sunY}%`,
          width: '64px',
          height: '64px',
          marginLeft: '-32px',
          marginTop: '-32px',
          background: theme.sunMoonGradient,
          boxShadow: theme.sunMoonGlow,
        }}
      >
        {/* Real Sun Glare & Flare effect (Spikes rotator) */}
        {theme.isDay && theme.sunGlareOpacity > 0 && (
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-1000"
            style={{ 
              opacity: theme.sunGlareOpacity,
              animation: 'solar-rot 45s linear infinite'
            }}
          >
            {/* Outer solar bloom aura */}
            <div className="absolute w-[180px] h-[180px] rounded-full bg-amber-300/10 blur-xl scale-125" />
            <div className="absolute w-[90px] h-[90px] rounded-full bg-white/20 blur-md" />
            
            {/* Soft geometric flare spikes */}
            <svg className="absolute w-[220px] h-[220px] text-amber-200/20" viewBox="0 0 100 100">
              <line x1="50" y1="5" x2="50" y2="95" stroke="currentColor" strokeWidth="1" strokeDasharray="2,6" />
              <line x1="5" x2="95" y1="50" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="2,6" />
              <line x1="18" y1="18" x2="82" y2="82" stroke="currentColor" strokeWidth="0.8" />
              <line x1="18" y1="82" x2="82" y2="18" stroke="currentColor" strokeWidth="0.8" />
            </svg>
          </div>
        )}

        {/* Real Moon Crater Overlays for hyper-realistic moon at night */}
        {!theme.isDay && (
          <div className="absolute inset-0 rounded-full overflow-hidden opacity-95">
            {/* Soft dark shaded gradient for 3D sphere illusion */}
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-400/20 via-transparent to-white/10" />
            
            {/* Sea of Tranquility crater shadow */}
            <div className="absolute top-[20%] left-[15%] w-5 h-4 rounded-full bg-slate-300/40 blur-[1px]" />
            <div className="absolute top-[35%] left-[45%] w-6 h-5 rounded-full bg-slate-300/40 blur-[1.5px]" />
            <div className="absolute top-[18%] left-[55%] w-3 h-3 rounded-full bg-slate-300/35 blur-[0.5px]" />
            
            {/* High-contrast craters with highlights */}
            <div className="absolute bottom-[22%] right-[25%] w-2.5 h-2.5 rounded-full bg-slate-400/50 border-r border-t border-slate-200/50" />
            <div className="absolute top-[55%] left-[20%] w-3.5 h-3.5 rounded-full bg-slate-400/45 border-r border-t border-slate-200/50" />
            <div className="absolute bottom-[35%] left-[40%] w-2 h-2 rounded-full bg-slate-400/50" />
            
            {/* Tycho Crater Ray system */}
            <div className="absolute bottom-[14%] left-[45%] w-4 h-4 rounded-full bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.7)]">
              <div className="absolute w-[1.5px] h-12 bg-white/15 -left-1 -top-8 rotate-[25deg]" />
              <div className="absolute w-[1.5px] h-12 bg-white/15 -left-4 -top-6 rotate-[-45deg]" />
              <div className="absolute w-[1.5px] h-12 bg-white/15 left-2 -top-12 rotate-[70deg]" />
            </div>
          </div>
        )}
      </div>

      {/* 5. Parallax moving atmospheric and responsive clouds */}
      <div 
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{ opacity: theme.cloudOpacity }}
      >
        {cloudBases.map((cb) => (
          <div
            key={cb.id}
            className="absolute left-0 w-[350px] md:w-[450px] animate-cloud mix-blend-screen opacity-90"
            style={{
              top: cb.top,
              '--speed': cb.speed,
              transform: `scale(${cb.scale})`,
              transition: 'all 3s ease-out'
            } as any}
          >
            {/* Cloud Shape Layer in vector SVG */}
            <svg 
              viewBox="0 0 100 40" 
              width="100%" 
              height="100%" 
              style={{ fill: theme.cloudColor, transition: 'fill 4s ease-in-out' }}
            >
              {/* Complex volumetric cloud drawing */}
              <path d="M 12 30 
                       A 10 10 0 0 1 20 12 
                       A 13 13 0 0 1 45 6 
                       A 15 15 0 0 1 72 10 
                       A 11 11 0 0 1 88 18 
                       A 9 9 0 0 1 85 30 
                       Z" 
                    className="opacity-75" 
              />
              <path d="M 22 30 
                       A 8 8 0 0 1 28 16 
                       A 11 11 0 0 1 48 10 
                       A 12 12 0 0 1 70 14 
                       A 8 8 0 0 1 81 30 
                       Z" 
                    className="opacity-95" 
              />
            </svg>
          </div>
        ))}
      </div>

      {/* 6. Realistic 3D Mountains Silhouettes with Edge Light Overlays (Highly responsive for Phones/Tablets) */}
      
      {/* LAYER 1: Distant Mountains Silhouette (Back Layer) */}
      <div className="absolute bottom-0 left-0 right-0 h-[48%] md:h-[40%] transition-colors duration-[4s]">
        <svg 
          preserveAspectRatio="none" 
          viewBox="0 0 100 100" 
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 -2px 5px rgba(0,0,0,0.03))' }}
        >
          {/* Edge glowing backlight gradient simulation mapped to sun/moon */}
          <defs>
            <linearGradient id="backlight" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor={theme.mountainBack} />
              <stop offset="100%" stopColor={theme.mountainBackHighlight} stopOpacity="0.85" />
            </linearGradient>
          </defs>
          
          {/* Alpine mountains path - beautiful staggered peaks perfect for vertical framing on phones */}
          <path 
            d="M 0,100 
               L 0,62
               L 12,41
               L 25,56
               L 38,34
               L 52,51
               L 68,28
               L 80,48
               L 91,38
               L 100,52
               L 100,100 
               Z" 
            fill="url(#backlight)" 
            style={{ transition: 'all 4s ease-in-out' }}
          />
        </svg>
      </div>

      {/* 7. Scenic Ambient mist/fog filling valley between Mountain Layers */}
      {theme.fogOpacity > 0 && (
        <div 
          className="absolute bottom-[22%] md:bottom-[16%] left-0 right-0 h-[10%] pointer-events-none mix-blend-screen transition-all duration-[4s]"
          style={{
            background: `linear-gradient(to bottom, transparent, ${theme.fogColor}, transparent)`,
            opacity: theme.fogOpacity,
            animation: 'ambient-fog 8s ease-in-out infinite'
          }}
        />
      )}

      {/* LAYER 2: Rolling Mountain & Forest Ridge (Middle Layer) */}
      <div className="absolute bottom-0 left-0 right-0 h-[34%] md:h-[28%]">
        <svg 
          preserveAspectRatio="none" 
          viewBox="0 0 100 100" 
          className="w-full h-full"
        >
          {/* Jagged slate mountains overlapping back layer */}
          <path 
            d="M 0,100 
               L 0,74 
               Q 14,56 28,71 
               T 56,64 
               T 84,72 
               Q 92,62 100,75 
               L 100,100 
               Z" 
            fill={theme.mountainMid} 
            style={{ transition: 'fill 4s ease-in-out' }}
          />
        </svg>
      </div>

      {/* FIREFLIES Layer dancing over the foreground hills (Enabled in Night/Sunset) */}
      {theme.firefliesVisible && (
        <div className="absolute bottom-[3%] left-0 right-0 h-[30%] pointer-events-none z-20">
          {fireflies.map((fly) => (
            <div
              key={fly.id}
              className="absolute rounded-full bg-[#ccff33] animate-firefly"
              style={{
                left: `${fly.x}%`,
                top: `${fly.y - 45}%`,
                width: `${fly.size}px`,
                height: `${fly.size}px`,
                boxShadow: '0 0 10px 3px rgba(204, 255, 51, 0.65)',
                filter: 'blur(0.2px)',
                '--dx': `${fly.driftX}px`,
                '--dy': `${fly.driftY}px`,
                '--duration': `${fly.duration}s`,
                '--delay': `${fly.delay}s`,
                animationDelay: `${fly.delay}s`
              } as any}
            />
          ))}
        </div>
      )}

      {/* LAYER 3: Cozy Hills & Tall Pine Forest (Front Layer - Highest Detail) */}
      <div className="absolute bottom-0 left-0 right-0 h-[22%] md:h-[18%]">
        <svg 
          preserveAspectRatio="none" 
          viewBox="0 0 100 100" 
          className="w-full h-full"
        >
          {/* Beautiful organic ground slope with cozy silhouetted pine tree clusters */}
          <path 
            d="M 0,100 
               L 0,86 
               Q 18,72 38,82
               T 72,78
               Q 86,70 100,81
               L 100,100 
               Z" 
            fill={theme.mountainFront} 
            style={{ transition: 'fill 4s ease-in-out' }}
          />

          {/* Individual high-fidelity silhouetted Pine Trees sticking up into the sky */}
          {/* Left Spruce Tree Cluster */}
          <polygon points="5,82 8,72 11,82" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="6,74 8,66 10,74" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="7,68 8,61 9,68" fill={theme.mountainFront} className="transition-all duration-1000" />

          <polygon points="12,85 15,77 18,85" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="13,79 15,72 17,79" fill={theme.mountainFront} className="transition-all duration-1000" />
          
          {/* Center Pine Tree */}
          <polygon points="44,83 48,68 52,83" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="45,71 48,59 51,71" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="46,62 48,52 50,62" fill={theme.mountainFront} className="transition-all duration-1000" />

          {/* Right Pine Group */}
          <polygon points="79,81 83,65 87,81" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="80,69 83,56 86,69" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="81,59 83,49 85,59" fill={theme.mountainFront} className="transition-all duration-1000" />

          <polygon points="86,82 89,74 92,82" fill={theme.mountainFront} className="transition-all duration-1000" />
          <polygon points="87,76 89,68 91,76" fill={theme.mountainFront} className="transition-all duration-1000" />
        </svg>
      </div>

      {/* Gentle overlay to prevent content from having low contrast against scenery */}
      <div className="absolute inset-0 bg-white/[0.02] dark:bg-black/[0.04] pointer-events-none" />
    </div>
  );
}
