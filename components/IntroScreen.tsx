
import React, { useState, useEffect } from 'react';
import { TIPS } from '../constants';
import { Sparkles } from 'lucide-react';

interface IntroScreenProps {
  onComplete: () => void;
}

const IntroScreen: React.FC<IntroScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 800);
          return 100;
        }
        return prev + 1.5; // Slightly faster loading
      });
    }, 40);

    const tipTimer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TIPS.length);
    }, 4000);

    return () => {
      clearInterval(timer);
      clearInterval(tipTimer);
    };
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#020617] overflow-hidden px-4 relative safe-area-inset">
      {/* Background Magic Particles */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-sky-600 rounded-full blur-[100px] md:blur-[150px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-indigo-600 rounded-full blur-[100px] md:blur-[150px] opacity-20 animate-pulse"></div>

      {/* Floating Sparkles Decor */}
      <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
              <div 
                key={i} 
                className="absolute animate-float opacity-40" 
                style={{ 
                    top: `${Math.random() * 80 + 10}%`, 
                    left: `${Math.random() * 80 + 10}%`,
                    animationDelay: `${i * 0.7}s` 
                }}
              >
                  <Sparkles size={window.innerWidth < 768 ? 16 : 24} className="text-sky-300" />
              </div>
          ))}
      </div>

      {/* Main Content Container - Flexible Scaling */}
      <div className="flex flex-col items-center justify-center z-10 w-full max-w-lg">
        
        {/* Heroic Anime Slime Logo - Scaled for Mobile */}
        <div className="relative mb-8 md:mb-16 animate-float flex flex-col items-center">
          <div className="relative">
              {/* Magic Circle Background for Logo */}
              <div className="absolute inset-[-20px] md:inset-[-40px] border-2 md:border-4 border-dashed border-sky-400/20 rounded-full animate-magic-rotate"></div>
              
              {/* The Slime Hero - Scaled Down on Mobile */}
              <div className="w-32 h-24 md:w-48 md:h-36 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-t-[80px] md:rounded-t-[120px] rounded-b-[30px] md:rounded-b-[45px] relative flex items-center justify-center shadow-[0_10px_40px_rgba(56,189,248,0.4)] border-2 md:border-4 border-white transform hover:scale-105 transition-transform duration-500">
                  {/* Gloss/Reflections */}
                  <div className="absolute top-2 left-4 md:top-4 md:left-8 w-8 h-4 md:w-12 md:h-6 bg-white/40 rounded-full rotate-[-20deg]"></div>
                  <div className="absolute bottom-2 right-6 md:bottom-4 md:right-10 w-2 h-2 md:w-4 md:h-4 bg-white/20 rounded-full"></div>
                  
                  {/* Expressive Anime Eyes */}
                  <div className="flex space-x-6 md:space-x-10">
                      <div className="w-5 h-5 md:w-7 md:h-7 bg-slate-900 rounded-full relative shadow-lg">
                          <div className="absolute top-1 left-1 w-2 h-2 md:top-1.5 md:left-1.5 md:w-3 md:h-3 bg-white rounded-full"></div>
                      </div>
                      <div className="w-5 h-5 md:w-7 md:h-7 bg-slate-900 rounded-full relative shadow-lg">
                          <div className="absolute top-1 left-1 w-2 h-2 md:top-1.5 md:left-1.5 md:w-3 md:h-3 bg-white rounded-full"></div>
                      </div>
                  </div>
                  
                  {/* Cute Blush */}
                  <div className="absolute bottom-6 left-4 md:bottom-10 md:left-6 w-6 h-3 md:w-8 md:h-4 bg-rose-300/60 blur-[2px] md:blur-[3px] rounded-full"></div>
                  <div className="absolute bottom-6 right-4 md:bottom-10 md:right-6 w-6 h-3 md:w-8 md:h-4 bg-rose-300/60 blur-[2px] md:blur-[3px] rounded-full"></div>
                  
                  {/* Tiny Crown */}
                  <div className="absolute -top-6 md:-top-10 left-1/2 -translate-x-1/2 text-3xl md:text-5xl">👑</div>
              </div>
          </div>
          
          <div className="mt-8 md:mt-14 text-center">
              <h1 className="text-3xl md:text-6xl font-black tracking-tighter text-white header-font uppercase italic drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                  SLIME WAR <span className="text-sky-400 block text-lg md:text-3xl tracking-[0.4em] md:tracking-[0.5em] mt-1 md:mt-2 ml-2 md:ml-4">SAGA</span>
              </h1>
              <div className="h-1 w-20 md:h-1.5 md:w-32 bg-gradient-to-r from-transparent via-sky-400 to-transparent mx-auto mt-4 md:mt-6 rounded-full"></div>
          </div>
        </div>

        {/* Crystal Core Loading Bar - Adapted for mobile width */}
        <div className="w-full px-6 flex flex-col items-center">
            <div className="w-full bg-slate-900 h-4 md:h-6 rounded-full p-1 relative overflow-hidden shadow-2xl border border-white/10 mb-3 md:mb-4">
              <div 
                className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-sky-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(56,189,248,0.6)]"
                style={{ width: `${progress}%` }}
              >
                  {/* Moving Shine Effect */}
                  <div className="w-full h-full relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-30deg] animate-[pulse_2s_infinite]"></div>
                  </div>
              </div>
            </div>
            <span className="text-[8px] md:text-[10px] font-black text-sky-400/60 uppercase tracking-[0.3em] md:tracking-[0.5em]">Synchronizing Cores... {Math.round(progress)}%</span>
        </div>

        {/* Tip Box - Compact on mobile */}
        <div className="mt-6 md:mt-12 text-center w-full px-6 py-3 md:py-4 bg-white/5 backdrop-blur-md border border-white/5 rounded-2xl md:rounded-3xl">
          <p className="text-slate-300 text-[10px] md:text-sm font-bold italic leading-relaxed transition-opacity duration-500">
            <span className="text-sky-400 text-base md:text-lg mr-1 md:mr-2">“</span>
            {TIPS[tipIndex]}
            <span className="text-sky-400 text-base md:text-lg ml-1 md:ml-2">”</span>
          </p>
        </div>
      </div>

      {/* Floating Mini Slimes Background - Optimized spacing */}
      <div className="absolute bottom-6 md:bottom-12 flex space-x-12 md:space-x-20 opacity-10">
        <div className="w-8 h-6 md:w-12 md:h-10 bg-emerald-400 rounded-t-full animate-squish"></div>
        <div className="w-8 h-6 md:w-12 md:h-10 bg-rose-400 rounded-t-full animate-squish" style={{ animationDelay: '0.4s' }}></div>
        <div className="w-8 h-6 md:w-12 md:h-10 bg-violet-400 rounded-t-full animate-squish" style={{ animationDelay: '0.8s' }}></div>
      </div>
      
      <style>{`
        @keyframes magic-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-magic-rotate {
          animation: magic-rotate 12s linear infinite;
        }
        .safe-area-inset {
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
        }
      `}</style>
    </div>
  );
};

export default IntroScreen;
