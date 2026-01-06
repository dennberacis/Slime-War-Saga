
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerStats, SlimeUnit, SlimeType, Projectile } from '../types';
import { SLIME_CONFIGS, getThemeForLevel } from '../constants';
import { Sword, Undo2, Users } from 'lucide-react';
import { getBattleStrategy } from '../services/geminiService';

interface BattlefieldProps {
  level: number;
  playerStats: PlayerStats;
  onWin: () => void;
  onLose: () => void;
}

const LAYOUT = {
  ASPECT_RATIO: '16/9',
  TOWER_LEFT: 10,
  TOWER_RIGHT: 90,
  LANE_BOTTOM: 22,
};

const GRAVITY = 0.02;
const MAX_POP = 30;

const Battlefield: React.FC<BattlefieldProps> = ({ level, playerStats, onWin, onLose }) => {
  const [playerGold, setPlayerGold] = useState(250);
  const [enemyGold, setEnemyGold] = useState(200);
  const [playerHP, setPlayerHP] = useState(2000);
  const [enemyHP, setEnemyHP] = useState(2000 + (level * 200));
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  
  const [units, setUnits] = useState<SlimeUnit[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [spawnQueue, setSpawnQueue] = useState<{type: string, team: 'player'|'enemy'}[]>([]);
  const [isRetreating, setIsRetreating] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  
  const gameLoopRef = useRef<number>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  const projectilesRef = useRef<Projectile[]>([]);
  const theme = getThemeForLevel(level);

  // Fetch AI Strategy Tip on Start
  useEffect(() => {
    let mounted = true;

    // Force game start after 7 seconds regardless of API status
    const loadingTimer = setTimeout(() => {
      if (mounted) setIsStarting(false);
    }, 7000);

    const fetchStrategy = async () => {
      try {
        const tip = await getBattleStrategy(level, playerStats.selectedDeck);
        if (mounted) {
          setAiTip(tip);
        }
      } catch (e) {
        // Silently fail to default tip
      }
    };
    
    fetchStrategy();

    return () => { 
      mounted = false;
      clearTimeout(loadingTimer);
    };
  }, [level, playerStats.selectedDeck]);

  useEffect(() => {
    const queueInterval = setInterval(() => {
      if (spawnQueue.length > 0 && !isStarting && !gameResult) {
        const next = spawnQueue[0];
        setSpawnQueue(prev => prev.slice(1));
        const config = SLIME_CONFIGS[next.type as SlimeType] || SLIME_CONFIGS.big_slime;
        const newUnit: SlimeUnit = {
          id: Math.random().toString(36).substr(2, 9),
          type: next.type === 'big_slime' ? 'tank' : (next.type as SlimeType),
          isBigSlime: next.type === 'big_slime',
          health: config.hp,
          maxHealth: config.hp,
          attack: config.atk,
          speed: next.type === 'miner' ? 0.35 : (next.type === 'tank' ? 0.15 : 0.22),
          range: next.type === 'archer' ? 38 : (next.type === 'mage' ? 48 : 8),
          cost: config.cost,
          position: next.team === 'player' ? LAYOUT.TOWER_LEFT : LAYOUT.TOWER_RIGHT,
          team: next.team,
          lastAttackTime: 0,
          lastSummonTime: performance.now(),
          isDead: false,
          isMining: false,
          isRetreating: false,
          stuckArrows: 0
        };
        setUnits(prev => [...prev, newUnit]);
      }
    }, 1000); 
    return () => clearInterval(queueInterval);
  }, [spawnQueue, isStarting, gameResult]);

  const requestSpawn = (type: SlimeType | 'big_slime', team: 'player' | 'enemy', isSummon = false) => {
    if (gameResult || isStarting) return;
    const teamPop = units.filter(u => u.team === team).length + spawnQueue.filter(q => q.team === team).length;
    if (teamPop >= MAX_POP) return;

    const config = SLIME_CONFIGS[type as SlimeType] || SLIME_CONFIGS.big_slime;
    if (!isSummon) {
      if (team === 'player') {
        if (playerGold < config.cost || (cooldowns[type] || 0) > 0) return;
        setPlayerGold(p => p - config.cost);
        setCooldowns(prev => ({ ...prev, [type]: 3000 }));
        setTimeout(() => {
          setCooldowns(c => {
            const next = { ...c };
            delete next[type];
            return next;
          });
        }, 3000);
      } else {
        if (enemyGold < config.cost) return;
        setEnemyGold(p => p - config.cost);
      }
    }
    setSpawnQueue(prev => [...prev, { type, team }]);
  };

  useEffect(() => {
    if (gameResult || isStarting) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.7 && enemyGold >= 50) {
         const types: SlimeType[] = ['warrior', 'archer', 'tank', 'mage'];
         requestSpawn(types[Math.floor(Math.random() * types.length)], 'enemy');
      }
      setPlayerGold(g => g + 5);
      setEnemyGold(g => g + 5);
      
      setUnits(prev => {
        let pB = 0; let eB = 0;
        prev.forEach(u => {
          if (u.type === 'miner' && u.isMining && !u.isRetreating) {
             if (u.team === 'player') pB += 10; else eB += 10;
          }
        });
        setPlayerGold(g => g + pB);
        setEnemyGold(g => g + eB);
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameResult, enemyGold, units, isStarting]);

  const update = useCallback((time: number) => {
    if (gameResult || isStarting) return;
    const dt = Math.min(32, time - lastUpdateRef.current);
    lastUpdateRef.current = time;

    setProjectiles(prev => {
      const next: Projectile[] = [];
      prev.forEach(p => {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.vy -= GRAVITY * (dt / 16);
        let hit = false;
        const targetTowerX = p.team === 'player' ? LAYOUT.TOWER_RIGHT : LAYOUT.TOWER_LEFT;
        
        if (Math.abs(p.x - targetTowerX) < 4 && p.y <= 5) {
          if (p.team === 'player') setEnemyHP(h => Math.max(0, h - p.damage));
          else setPlayerHP(h => Math.max(0, h - p.damage));
          hit = true;
        }

        if (!hit) {
          setUnits(uPrev => {
            uPrev.forEach(u => {
              if (u.team !== p.team && !u.isDead && Math.abs(u.position - p.x) < 3 && p.y <= 5) {
                 const isSafe = u.team === 'player' ? u.position < (LAYOUT.TOWER_LEFT + 2) : u.position > (LAYOUT.TOWER_RIGHT - 2);
                 if (!isSafe) {
                    u.health -= p.damage;
                    if (p.type === 'arrow') u.stuckArrows = (u.stuckArrows || 0) + 1;
                    hit = true;
                 }
              }
            });
            return uPrev;
          });
        }
        if (!hit && p.y > -5 && p.x > 0 && p.x < 100) next.push(p);
      });
      return next;
    });

    setUnits(prev => {
      const next = prev.map(u => ({ ...u }));
      const toRemove = new Set<string>();
      next.forEach(u => {
        const myTower = u.team === 'player' ? LAYOUT.TOWER_LEFT : LAYOUT.TOWER_RIGHT;
        const enTower = u.team === 'player' ? LAYOUT.TOWER_RIGHT : LAYOUT.TOWER_LEFT;
        const rockPos = u.team === 'player' ? LAYOUT.TOWER_LEFT + 10 : LAYOUT.TOWER_RIGHT - 10;
        const isRetreat = (u.team === 'player' && isRetreating) || u.isRetreating;

        if (isRetreat) {
          if (Math.abs(u.position - myTower) < 2) { toRemove.add(u.id); return; }
          const dir = u.team === 'player' ? -1 : 1;
          u.position += dir * u.speed * 2 * (dt / 16);
          return;
        }

        if (u.type === 'miner') {
           if (Math.abs(u.position - rockPos) < 1) u.isMining = true;
           else {
             u.isMining = false;
             const dir = u.position < rockPos ? 1 : -1;
             u.position += dir * u.speed * (dt / 16);
           }
           return;
        }

        const boundaryP = LAYOUT.TOWER_LEFT + 2; 
        const boundaryE = LAYOUT.TOWER_RIGHT - 2;
        const enemies = next.filter(e => e.team !== u.team && !e.isDead && (e.team === 'player' ? e.position <= boundaryE : e.position >= boundaryP));
        
        let target: SlimeUnit | null = null;
        let minDist = 100;
        enemies.forEach(e => {
          const d = Math.abs(u.position - e.position);
          if (d < minDist) { minDist = d; target = e; }
        });

        const towerDist = Math.abs(u.position - enTower);
        const inRange = (target && minDist <= u.range) || towerDist <= u.range;

        if (inRange) {
           if (time - u.lastAttackTime > 1200) {
              if (u.type === 'archer' || u.type === 'mage') {
                 const tX = target ? target.position : enTower;
                 const travelTime = 60;
                 const vx = (tX - u.position) / travelTime;
                 const vy = 0.5 * GRAVITY * travelTime;
                 projectilesRef.current.push({
                   id: Math.random().toString(),
                   type: u.type === 'mage' ? 'magic' : 'arrow',
                   team: u.team,
                   x: u.position,
                   y: 5,
                   targetX: tX,
                   targetId: target ? target.id : 'tower',
                   damage: u.attack,
                   speed: 1,
                   vx, vy,
                   isDone: false
                 });
              } else {
                 if (target) {
                    target.health -= u.attack;
                    if (u.isBigSlime) target.position += (u.team === 'player' ? 5 : -5);
                 } else {
                    if (u.team === 'player') setEnemyHP(h => Math.max(0, h - u.attack));
                    else setPlayerHP(h => Math.max(0, h - u.attack));
                 }
              }
              u.lastAttackTime = time;
           }
        } else {
           const dir = u.team === 'player' ? 1 : -1;
           u.position += dir * u.speed * (dt / 16);
        }
      });
      if (projectilesRef.current.length > 0) {
         setProjectiles(p => [...p, ...projectilesRef.current]);
         projectilesRef.current = [];
      }
      return next.filter(u => u.health > 0 && !toRemove.has(u.id));
    });

    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameResult, isRetreating, isStarting]);

  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(update);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [update]);

  useEffect(() => {
    if (gameResult) return;
    if (enemyHP <= 0) { setGameResult('win'); setTimeout(onWin, 4000); }
    if (playerHP <= 0) { setGameResult('lose'); setTimeout(onLose, 4000); }
  }, [enemyHP, playerHP, gameResult, onWin, onLose]);

  const currentPop = units.filter(u => u.team === 'player').length + spawnQueue.filter(q => q.team === 'player').length;

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <div className="relative w-full h-auto aspect-video max-h-screen bg-slate-900 overflow-hidden shadow-2xl border-y-2 border-slate-800">
        
        {/* Background Layers */}
        <div className="absolute inset-0 z-0 bg-[#0f172a]">
           <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-[#701a75]"></div>
           <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
           <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
           <div className="absolute bottom-[21%] left-0 right-0 h-[45%] text-indigo-300/20 pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 300">
                 <path d="M0,200 C300,100 600,250 1200,120 L1200,300 L0,300 Z" fill="currentColor"/>
              </svg>
           </div>
           <div className="absolute bottom-[21%] left-0 right-0 h-[30%] text-indigo-900/40 pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 300">
                 <path d="M0,250 C200,180 500,280 800,200 C1000,160 1200,240 1200,240 L1200,300 L0,300 Z" fill="currentColor"/>
              </svg>
           </div>
           <div className="absolute bottom-[21%] left-0 right-0 h-[25%] text-slate-900 pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 200">
                 <path d="M0,180 C150,150 300,190 600,160 C900,130 1050,170 1200,150 L1200,200 L0,200 Z" fill="currentColor"/>
              </svg>
           </div>
           <div className="absolute left-0 right-0 shadow-[0_-5px_30px_rgba(0,0,0,0.6)] z-10" style={{ bottom: 0, height: `${LAYOUT.LANE_BOTTOM}%` }}>
                <div className="w-full h-full bg-gradient-to-b from-[#1e293b] to-[#020617] border-t border-white/5 relative overflow-hidden">
                   <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                </div>
           </div>
        </div>

        {/* Gameplay Area */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute" style={{ left: `${LAYOUT.TOWER_LEFT}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="player" hp={playerHP} maxHp={2000} />
          </div>
          <div className="absolute" style={{ left: `${LAYOUT.TOWER_RIGHT}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="enemy" hp={enemyHP} maxHp={2000 + level*200} />
          </div>
          {units.map(u => (
            <div key={u.id} className="absolute transition-all duration-100 ease-linear" style={{ left: `${u.position}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
               <div className={`flex flex-col items-center justify-end ${u.team === 'player' ? '' : 'scale-x-[-1]'}`}>
                  <div className={`w-[4vw] h-[0.5vw] bg-black/50 rounded-full mb-[0.2vw] overflow-hidden ${u.team === 'enemy' ? 'scale-x-[-1]' : ''}`}>
                     <div className={`h-full ${u.team === 'player' ? 'bg-sky-400' : 'bg-rose-500'}`} style={{ width: `${(u.health/u.maxHealth)*100}%` }}></div>
                  </div>
                  <div className={`${u.isBigSlime ? 'w-[7vw] h-[7vw] text-[3.5vw]' : 'w-[4vw] h-[4vw] text-[2vw]'} ${SLIME_CONFIGS[u.type].color} rounded-t-[40%] rounded-b-[20%] border-2 border-white/20 shadow-lg flex items-center justify-center ${u.isMining ? 'animate-bounce' : 'animate-squish'}`}>
                     <span className="transform scale-x-[-1] drop-shadow-md">{SLIME_CONFIGS[u.type].icon}</span>
                  </div>
               </div>
            </div>
          ))}
          {projectiles.map(p => (
             <div key={p.id} className="absolute w-[0.8vw] h-[0.8vw] bg-white rounded-full shadow-[0_0_8px_white]" style={{ left: `${p.x}%`, bottom: `${LAYOUT.LANE_BOTTOM + p.y}%` }} />
          ))}
        </div>

        {/* Loading Screen Overlay with Dancing Slime */}
        {isStarting && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl transition-opacity duration-500">
             <style>{`
                @keyframes dance-bounce {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-15px) scale(1.05, 0.95); }
                }
                @keyframes tongue-wag {
                    0% { transform: translateX(-50%) rotate(-5deg); }
                    100% { transform: translateX(-50%) rotate(5deg); }
                }
                @keyframes loading-bar {
                    0% { width: 0%; transform: translateX(-100%); }
                    50% { width: 100%; transform: translateX(0%); }
                    100% { width: 0%; transform: translateX(200%); }
                }
             `}</style>

             {/* The Dancing Slime */}
             <div className="relative mb-8" style={{ animation: 'dance-bounce 0.6s infinite cubic-bezier(0.25, 1, 0.5, 1)' }}>
                {/* Body */}
                <div className="w-32 h-28 bg-emerald-400 rounded-t-[50%] rounded-b-[20%] shadow-[0_0_50px_rgba(52,211,153,0.4)] border-4 border-emerald-300 relative overflow-visible">
                    {/* Highlight */}
                    <div className="absolute top-5 left-6 w-10 h-5 bg-white/40 rounded-full rotate-[-15deg]"></div>
                    
                    {/* Eyes (Happy Curves) */}
                    <div className="absolute top-10 left-7 w-5 h-3 border-t-[3px] border-slate-900 rounded-full"></div>
                    <div className="absolute top-10 right-7 w-5 h-3 border-t-[3px] border-slate-900 rounded-full"></div>

                    {/* Cheeks */}
                    <div className="absolute top-12 left-4 w-4 h-2 bg-rose-400/50 rounded-full blur-[2px]"></div>
                    <div className="absolute top-12 right-4 w-4 h-2 bg-rose-400/50 rounded-full blur-[2px]"></div>

                    {/* Mouth Open */}
                    <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-8 h-5 bg-slate-900 rounded-b-full overflow-hidden"></div>
                    
                    {/* Tongue Hanging Out */}
                    <div className="absolute bottom-4 left-1/2 w-4 h-5 bg-rose-500 rounded-b-full border-t border-rose-700/20 shadow-sm"
                         style={{ animation: 'tongue-wag 0.2s infinite alternate' }}></div>
                </div>
             </div>

             {/* Loading Text */}
             <div className="text-center mb-6">
                <h3 className="header-font text-3xl font-black text-white italic tracking-widest animate-pulse">
                    Loading...
                </h3>
             </div>

             {/* Tip Card */}
             <div className="max-w-md px-6 py-4 bg-white/5 border border-white/10 rounded-xl relative mx-4 animate-float">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-3 py-1 border border-white/10 rounded-full">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Tactical Tip</span>
                </div>
                <p className="text-center text-slate-300 font-medium italic text-sm md:text-base leading-relaxed mt-2">
                   "{aiTip || "Scouting enemy defenses..."}"
                </p>
             </div>

             {/* Progress Bar */}
             <div className="mt-8 w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-[loading-bar_1.5s_ease-in-out_infinite]"></div>
             </div>
          </div>
        )}

        {/* UI HUD */}
        <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between">
           <div className="w-full h-[15%] px-6 pt-2 flex justify-between items-start pointer-events-auto">
              <div className="bg-slate-900/80 backdrop-blur rounded-full px-4 py-2 border border-white/10 flex items-center space-x-3 shadow-lg scale-90 origin-top-left">
                 <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/20">PI</div>
                 <span className="text-xs font-bold text-white tracking-widest header-font uppercase">COMMANDER</span>
              </div>
              <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl p-1 border border-white/10 flex space-x-1 shadow-2xl">
                 {(['miner', 'warrior', 'tank', 'archer', 'mage', 'big_slime'] as any[]).map(type => {
                    const cfg = SLIME_CONFIGS[type as SlimeType] || SLIME_CONFIGS.big_slime;
                    const cd = cooldowns[type] || 0;
                    const canAfford = playerGold >= cfg.cost;
                    return (
                       <button
                          key={type}
                          onClick={() => requestSpawn(type, 'player')}
                          disabled={!canAfford || cd > 0 || isStarting}
                          className={`relative w-[4vw] h-[4.5vw] max-w-[48px] max-h-[54px] rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 border ${canAfford ? 'bg-slate-800 hover:bg-slate-700 border-white/10' : 'bg-slate-900 opacity-60 grayscale border-transparent'}`}
                       >
                          <span className="text-[1.5vw] max-text-[20px] drop-shadow-md mb-[2px]">{cfg.icon}</span>
                          <div className="absolute bottom-0 w-full bg-black/50 text-[0.8vw] max-text-[9px] text-center text-white font-bold py-[1px] rounded-b-lg leading-none">{cfg.cost}</div>
                          {cd > 0 && <div className="absolute inset-0 bg-black/70 rounded-lg flex items-center justify-center"><span className="text-[1.2vw] font-bold text-white">{(cd/1000).toFixed(0)}</span></div>}
                       </button>
                    );
                 })}
              </div>
              <div className="bg-slate-900/80 backdrop-blur rounded-full px-4 py-2 border border-white/10 flex items-center space-x-4 shadow-lg scale-90 origin-top-right">
                 <span className="text-sm font-black text-amber-400 header-font tracking-wide">🪨 {playerGold}</span>
                 <div className="w-px h-4 bg-white/20"></div>
                 <div className="flex items-center space-x-1.5">
                    <Users size={14} className="text-white/60" />
                    <span className="text-sm font-bold text-white header-font">{currentPop}/{MAX_POP}</span>
                 </div>
              </div>
           </div>

           <div className="w-full h-[18%] px-6 pb-2 flex justify-end items-end pointer-events-auto">
              <div className="flex flex-col gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-xl">
                <button onClick={() => setIsRetreating(false)} className={`w-[4vw] h-[4vw] max-w-[48px] max-h-[48px] rounded-xl flex items-center justify-center shadow-lg border-2 border-white/20 transition-all active:scale-90 ${!isRetreating ? 'bg-rose-500 border-white' : 'bg-slate-800 text-white/50'}`}>
                   <Sword className="w-[2vw] h-[2vw] max-w-[24px] max-h-[24px] text-white" />
                </button>
                <button onClick={() => setIsRetreating(true)} className={`w-[4vw] h-[4vw] max-w-[48px] max-h-[48px] rounded-xl flex items-center justify-center shadow-lg border-2 border-white/20 transition-all active:scale-90 ${isRetreating ? 'bg-emerald-500 border-white' : 'bg-slate-800 text-white/50'}`}>
                   <Undo2 className="w-[2vw] h-[2vw] max-w-[24px] max-h-[24px] text-white" />
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const TowerVisual: React.FC<{ team: 'player'|'enemy'; hp: number; maxHp: number }> = ({ team, hp, maxHp }) => {
   const isPlayer = team === 'player';
   const [isHit, setIsHit] = useState(false);
   const prevHp = useRef(hp);

   useEffect(() => {
     if (hp < prevHp.current) {
       setIsHit(true);
       const t = setTimeout(() => setIsHit(false), 400);
       return () => clearTimeout(t);
     }
     prevHp.current = hp;
   }, [hp]);
   
   const theme = isPlayer 
     ? { 
         main: 'bg-sky-400', 
         gradient: 'from-sky-300 via-sky-400 to-sky-600', 
         border: 'border-sky-200', 
         face: 'text-slate-900',
         blush: 'bg-rose-400/40',
         crown: 'text-amber-300'
       } 
     : { 
         main: 'bg-rose-500', 
         gradient: 'from-rose-400 via-rose-500 to-rose-700', 
         border: 'border-rose-200', 
         face: 'text-slate-900',
         blush: 'bg-rose-300/40',
         crown: 'text-slate-300'
       };

   return (
      <div className="relative flex flex-col items-center justify-end w-[10vw] h-[12vw] pointer-events-none">
         <style>{`
            @keyframes tower-idle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02, 0.98); } }
            @keyframes tower-hit { 
              0% { transform: scale(1) translate(0, 0); } 
              25% { transform: scale(1.1, 0.9) translate(-2px, 2px); } 
              50% { transform: scale(0.9, 1.1) translate(2px, -2px); } 
              75% { transform: scale(1.05, 0.95) translate(-1px, 1px); } 
              100% { transform: scale(1) translate(0, 0); } 
            }
            @keyframes crown-float { 0%, 100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-5px) rotate(3deg); } }
         `}</style>
         
         {/* HP Bar - Floating above */}
         <div className="absolute -top-[20%] w-[120%] flex flex-col items-center z-20">
            <div className="w-full h-[0.8vw] bg-black/50 backdrop-blur-sm rounded-full border border-white/20 p-[1px] shadow-sm">
                <div className={`h-full rounded-full transition-all duration-200 ease-out ${isPlayer ? 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]'}`} 
                     style={{ width: `${Math.max(0, (hp/maxHp)*100)}%` }}></div>
            </div>
            <span className="text-[0.8vw] font-black text-white drop-shadow-md mt-[0.2vw]">{Math.ceil(hp)}/{maxHp}</span>
         </div>

         {/* The Slime Tower Body */}
         <div className={`relative w-full h-full ${isHit ? 'animate-[tower-hit_0.4s_ease-out]' : 'animate-[tower-idle_3s_ease-in-out_infinite]'}`}>
            
            {/* Crown */}
            <div className={`absolute -top-[30%] left-1/2 -translate-x-1/2 text-[4vw] drop-shadow-xl z-10 ${theme.crown}`} style={{ animation: 'crown-float 4s ease-in-out infinite' }}>
               {isPlayer ? '👑' : '🏰'}
            </div>

            {/* Slime Body Shape */}
            <div className={`w-full h-full rounded-t-[45%] rounded-b-[20%] bg-gradient-to-b ${theme.gradient} border-[0.3vw] ${theme.border} shadow-2xl relative overflow-hidden flex flex-col items-center pt-[20%]`}>
               
               {/* Glossy Reflection */}
               <div className="absolute top-[10%] left-[10%] w-[30%] h-[15%] bg-white/50 rounded-full rotate-[-20deg] blur-[1px]"></div>
               <div className="absolute top-[15%] right-[20%] w-[10%] h-[5%] bg-white/30 rounded-full blur-[1px]"></div>

               {/* Face Container */}
               <div className="relative z-10 flex flex-col items-center">
                  {/* Eyes */}
                  <div className="flex space-x-[1.5vw]">
                     {/* Left Eye */}
                     <div className="w-[2vw] h-[2vw] bg-slate-900 rounded-full relative overflow-hidden">
                        <div className="absolute top-[15%] right-[15%] w-[0.8vw] h-[0.8vw] bg-white rounded-full"></div>
                        {isHit && <div className="absolute inset-0 bg-red-500/50 animate-pulse"></div>}
                     </div>
                     {/* Right Eye */}
                     <div className="w-[2vw] h-[2vw] bg-slate-900 rounded-full relative overflow-hidden">
                        <div className="absolute top-[15%] right-[15%] w-[0.8vw] h-[0.8vw] bg-white rounded-full"></div>
                        {isHit && <div className="absolute inset-0 bg-red-500/50 animate-pulse"></div>}
                     </div>
                  </div>

                  {/* Cheeks */}
                  <div className="w-full flex justify-between px-[-1vw] mt-[0.2vw]">
                     <div className={`w-[1.2vw] h-[0.6vw] ${theme.blush} rounded-full blur-[1px]`}></div>
                     <div className={`w-[1.2vw] h-[0.6vw] ${theme.blush} rounded-full blur-[1px]`}></div>
                  </div>

                  {/* Mouth */}
                  <div className={`mt-[0.2vw] w-[1vw] h-[0.5vw] bg-slate-900/80 rounded-b-full transition-all duration-200 ${isHit ? 'h-[1.2vw] w-[1.2vw] rounded-full bg-slate-900' : ''}`}></div>
               </div>

               {/* Bubbles inside */}
               <div className="absolute bottom-2 left-4 w-[1vw] h-[1vw] bg-white/20 rounded-full animate-bounce" style={{ animationDuration: '3s' }}></div>
               <div className="absolute bottom-6 right-3 w-[0.5vw] h-[0.5vw] bg-white/20 rounded-full animate-bounce" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></div>
            </div>

            {/* Puddle at base */}
            <div className={`absolute -bottom-[5%] left-[5%] right-[5%] h-[15%] ${theme.main} opacity-50 rounded-[50%] blur-sm -z-10`}></div>
         </div>
      </div>
   );
};

export default Battlefield;
