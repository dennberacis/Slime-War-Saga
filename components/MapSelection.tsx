
import React, { useState } from 'react';
import { PlayerStats, MapLevel } from '../types';
import { ArrowLeft, Lock, Star, Crown, ChevronRight, Sparkles } from 'lucide-react';

interface MapSelectionProps {
  stats: PlayerStats;
  onBack: () => void;
  onStartLevel: (levelId: number) => void;
}

const MapSelection: React.FC<MapSelectionProps> = ({ stats, onBack, onStartLevel }) => {
  const [region, setRegion] = useState(0); // 0 = Forest Frontier

  const levels: MapLevel[] = Array.from({ length: 10 }, (_, i) => {
    const id = region * 10 + i + 1;
    return {
      id,
      name: id % 10 === 0 ? `BOSS` : `Level ${id}`,
      isBoss: id % 10 === 0,
      difficulty: region + 1,
      unlocked: id <= stats.currentLevel,
      completed: id < stats.currentLevel
    };
  });

  // Level nodes 1-10 with Level 10 moved down to 25% Y to avoid top clipping
  const forestNodes = [
    { id: 1, pos: { x: 15, y: 88 } },
    { id: 2, pos: { x: 38, y: 80 } },
    { id: 3, pos: { x: 62, y: 75 } },
    { id: 4, pos: { x: 82, y: 62 } },
    { id: 5, pos: { x: 55, y: 55 } },
    { id: 6, pos: { x: 28, y: 48 } },
    { id: 7, pos: { x: 22, y: 32 } },
    { id: 8, pos: { x: 48, y: 28 } },
    { id: 9, pos: { x: 72, y: 34 } },
    { id: 10, pos: { x: 88, y: 25 }, isBoss: true }, // The Boss Node
  ];

  // Updated path leading to the new Y position of node 10
  const pathD = "M 15 88 Q 25 88 38 80 T 62 75 Q 78 72 82 62 T 55 55 T 28 48 Q 18 42 22 32 T 48 28 T 72 34 Q 82 32 88 25";

  return (
    <div className="h-full w-full bg-[#064e3b] flex flex-col overflow-hidden select-none relative font-sans landscape:flex">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-emerald-950 opacity-80"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2000')] bg-cover bg-center opacity-25 mix-blend-overlay"></div>
        
        {/* Distant Glows */}
        <div className="absolute top-[10%] right-[10%] w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
      </div>

      {/* Top HUD */}
      <div className="relative z-50 pt-4 px-6 flex justify-between items-center">
        <button 
          onClick={onBack}
          className="p-3 bg-amber-900/90 backdrop-blur-md rounded-2xl border-2 border-amber-600/50 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="relative bg-[#5b3921] border-x-[10px] border-[#3e2616] px-8 md:px-16 py-2.5 md:py-3 rounded-lg shadow-[0_8px_0_#2a1a0f] flex items-center justify-center">
            <h1 className="text-lg md:text-3xl font-black header-font text-[#ffedcc] italic tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase">
              {region === 0 ? "Forest Frontier" : "Crystal Peaks"}
            </h1>
        </div>

        <div className="w-12 h-12"></div> {/* Spacer */}
      </div>

      {/* Map Content */}
      <div className="flex-1 relative mt-2 md:mt-4 overflow-hidden">
        {/* Progression Path */}
        <svg 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none" 
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        >
          <path 
            d={pathD} 
            fill="none" 
            stroke="#fde047" 
            strokeWidth="0.4" 
            strokeLinecap="round" 
            strokeDasharray="2, 3"
            className="animate-path-dash opacity-50"
          />
        </svg>

        {/* Level Nodes */}
        {forestNodes.map((node) => {
          const actualLevel = levels.find(l => l.id === node.id);
          if (!actualLevel) return null;
          
          return (
            <div 
              key={node.id}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 z-20 ${node.id === 10 ? 'z-30' : ''}`}
              style={{ left: `${node.pos.x}%`, top: `${node.pos.y}%` }}
            >
              {/* Attached World Tree - Layered behind node 10 */}
              {node.id === 10 && (
                <div className="absolute -top-10 md:-top-16 left-1/2 -translate-x-1/2 pointer-events-none z-0">
                  <div className="relative flex flex-col items-center">
                    {/* Small Tree Visual */}
                    <span className="text-4xl md:text-7xl drop-shadow-[0_0_15px_rgba(168,85,247,0.7)] animate-float">🌳</span>
                    {/* Subtle Pulse Aura */}
                    <div className="absolute top-[40%] w-10 h-10 md:w-20 md:h-20 bg-purple-500/20 blur-[20px] rounded-full animate-pulse"></div>
                    <Sparkles size={20} className="absolute -top-4 text-purple-300 animate-sparkle" />
                  </div>
                </div>
              )}

              <SagaNode 
                id={node.id} 
                isBoss={node.isBoss} 
                unlocked={actualLevel.unlocked} 
                completed={actualLevel.completed}
                onClick={() => onStartLevel(actualLevel.id)}
              />
            </div>
          );
        })}
      </div>

      {/* Footer Area Stats */}
      <div className="relative z-50 py-3 bg-black/60 backdrop-blur-2xl border-t border-white/5 flex justify-center">
         <div className="flex space-x-2 items-center">
            {[0, 1, 2].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${region === i ? 'w-10 bg-sky-400' : 'w-2 bg-white/20'}`}></div>
            ))}
         </div>
      </div>

      <style>{`
        @keyframes path-dash {
          to { stroke-dashoffset: -20; }
        }
        .animate-path-dash {
          animation: path-dash 25s linear infinite;
        }
        .saga-banner {
          clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%);
        }
        .saga-shield {
          clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%);
        }
      `}</style>
    </div>
  );
};

interface SagaNodeProps {
  id: number;
  isBoss?: boolean;
  unlocked: boolean;
  completed: boolean;
  onClick: () => void;
}

const SagaNode: React.FC<SagaNodeProps> = ({ id, isBoss, unlocked, completed, onClick }) => {
  return (
    <div className="flex flex-col items-center group relative z-10">
      {/* Label Tag */}
      <div className={`relative px-2 py-0.5 z-20 saga-banner font-black text-white header-font text-[8px] md:text-[10px] transition-all
        ${!unlocked ? 'bg-slate-700 opacity-60' : (isBoss ? 'bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.5)]' : 'bg-[#4b6a1d]')}
      `}>
        {id}
      </div>
      
      {/* Shield Button */}
      <button 
        onClick={onClick}
        disabled={!unlocked}
        className={`w-7 h-9 md:w-11 md:h-14 mt-[-3px] saga-shield border-b-[2px] md:border-b-4 flex items-center justify-center transition-all
          ${!unlocked ? 'bg-slate-800 border-slate-950 opacity-40 cursor-not-allowed' : 
            (isBoss ? 'bg-gradient-to-b from-rose-500 to-rose-900 border-rose-950 animate-pulse' : 'bg-gradient-to-b from-amber-200 to-amber-500 border-amber-900 group-hover:scale-110 shadow-lg')}
        `}
      >
        {!unlocked ? (
          <Lock size={9} className="text-white/20" />
        ) : isBoss ? (
          <Crown size={12} className="text-white md:size-5" />
        ) : (
          <div className="relative">
             <div className="w-4 h-4 md:w-5 md:h-5 bg-[#8b5e3c] rounded-full flex items-center justify-center border border-[#5b3921]">
                <div className="w-0.5 h-1.5 md:w-1 md:h-2 bg-white/20 rounded-full rotate-[-45deg] blur-[0.5px]"></div>
             </div>
             {completed && (
                <Star size={10} className="absolute -top-3 -right-3 text-yellow-400 fill-yellow-400 animate-sparkle" />
             )}
          </div>
        )}
      </button>
    </div>
  );
};

export default MapSelection;
