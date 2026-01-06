
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerStats, SlimeUnit, SlimeType, Projectile } from '../types';
import { SLIME_CONFIGS, getThemeForLevel } from '../constants';
import { Sword, Undo2, Users } from 'lucide-react';

interface BattlefieldProps {
  level: number;
  playerStats: PlayerStats;
  onWin: () => void;
  onLose: () => void;
}

// --- LAYOUT CONFIGURATION (Relative to 16:9 Container) ---
const LAYOUT = {
  ASPECT_RATIO: '16/9',
  TOWER_LEFT: 10,   // Player Base %
  TOWER_RIGHT: 90,  // Enemy Base %
  LANE_BOTTOM: 22,  // Ground Line % (Raised to clear bottom UI)
};

const GRAVITY = 0.02;
const MAX_POP = 30;

const Battlefield: React.FC<BattlefieldProps> = ({ level, playerStats, onWin, onLose }) => {
  // Game State
  const [playerGold, setPlayerGold] = useState(250);
  const [enemyGold, setEnemyGold] = useState(200);
  const [playerHP, setPlayerHP] = useState(2000);
  const [enemyHP, setEnemyHP] = useState(2000 + (level * 200));
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);
  
  // Entities
  const [units, setUnits] = useState<SlimeUnit[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [spawnQueue, setSpawnQueue] = useState<{type: string, team: 'player'|'enemy'}[]>([]);
  
  // Controls
  const [isRetreating, setIsRetreating] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  
  // Refs
  const gameLoopRef = useRef<number>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  const projectilesRef = useRef<Projectile[]>([]);
  const theme = getThemeForLevel(level);

  // --- LOGIC: Spawning & Economy ---
  useEffect(() => {
    const queueInterval = setInterval(() => {
      if (spawnQueue.length > 0) {
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
          position: next.team === 'player' ? LAYOUT.TOWER_LEFT : LAYOUT.TOWER_RIGHT, // Player Left, Enemy Right
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
  }, [spawnQueue]);

  const requestSpawn = (type: SlimeType | 'big_slime', team: 'player' | 'enemy', isSummon = false) => {
    if (gameResult) return;
    const teamPop = units.filter(u => u.team === team).length + spawnQueue.filter(q => q.team === team).length;
    if (teamPop >= MAX_POP) return;

    const config = SLIME_CONFIGS[type as SlimeType] || SLIME_CONFIGS.big_slime;
    if (!isSummon) {
      if (team === 'player') {
        if (playerGold < config.cost || (cooldowns[type] || 0) > 0) return;
        setPlayerGold(p => p - config.cost);
        setCooldowns(prev => ({ ...prev, [type]: 3000 }));
      } else {
        if (enemyGold < config.cost) return;
        setEnemyGold(p => p - config.cost);
      }
    }
    setSpawnQueue(prev => [...prev, { type, team }]);
  };

  // Economy Tick
  useEffect(() => {
    if (gameResult) return;
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
  }, [gameResult, enemyGold, units]);

  // --- LOGIC: Game Loop ---
  const update = useCallback((time: number) => {
    if (gameResult) return;
    const dt = Math.min(32, time - lastUpdateRef.current);
    lastUpdateRef.current = time;

    // 1. Projectiles
    setProjectiles(prev => {
      const next: Projectile[] = [];
      prev.forEach(p => {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.vy -= GRAVITY * (dt / 16);

        let hit = false;
        // Player shoots Right -> Target Enemy Tower (Right)
        // Enemy shoots Left -> Target Player Tower (Left)
        const targetTowerX = p.team === 'player' ? LAYOUT.TOWER_RIGHT : LAYOUT.TOWER_LEFT;
        
        if (Math.abs(p.x - targetTowerX) < 4 && p.y <= 5) {
          if (p.team === 'player') setEnemyHP(h => Math.max(0, h - p.damage));
          else setPlayerHP(h => Math.max(0, h - p.damage));
          hit = true;
        }

        if (!hit) {
          setUnits(uPrev => {
            uPrev.forEach(u => {
              // Hitbox logic
              if (u.team !== p.team && !u.isDead && Math.abs(u.position - p.x) < 3 && p.y <= 5) {
                 // Spawn Protection: 
                 // Player (Left 10) safe if < 12
                 // Enemy (Right 90) safe if > 88
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

    // 2. Units
    setUnits(prev => {
      const next = prev.map(u => ({ ...u }));
      const toRemove = new Set<string>();

      next.forEach(u => {
        // Defines
        const myTower = u.team === 'player' ? LAYOUT.TOWER_LEFT : LAYOUT.TOWER_RIGHT;
        const enTower = u.team === 'player' ? LAYOUT.TOWER_RIGHT : LAYOUT.TOWER_LEFT;
        const rockPos = u.team === 'player' ? LAYOUT.TOWER_LEFT + 10 : LAYOUT.TOWER_RIGHT - 10;
        const isRetreat = (u.team === 'player' && isRetreating) || u.isRetreating;

        // Retreat
        if (isRetreat) {
          if (Math.abs(u.position - myTower) < 2) { toRemove.add(u.id); return; }
          // Player (Left) moves Left (-), Enemy (Right) moves Right (+)
          const dir = u.team === 'player' ? -1 : 1;
          u.position += dir * u.speed * 2 * (dt / 16);
          return;
        }

        // Mining
        if (u.type === 'miner') {
           if (Math.abs(u.position - rockPos) < 1) u.isMining = true;
           else {
             u.isMining = false;
             // Move towards rock
             const dir = u.position < rockPos ? 1 : -1;
             u.position += dir * u.speed * (dt / 16);
           }
           return;
        }

        // Combat
        // Enemy units are valid targets if they have left their spawn safe zone
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
                    // Knockback: Player hits (Left->Right), knocks Enemy Right (+). Enemy hits (Right->Left), knocks Player Left (-).
                    if (u.isBigSlime) target.position += (u.team === 'player' ? 5 : -5);
                 } else {
                    if (u.team === 'player') setEnemyHP(h => Math.max(0, h - u.attack));
                    else setPlayerHP(h => Math.max(0, h - u.attack));
                 }
              }
              u.lastAttackTime = time;
           }
        } else {
           // Move Forward: Player (+), Enemy (-)
           const dir = u.team === 'player' ? 1 : -1;
           u.position += dir * u.speed * (dt / 16);
        }

        if (u.type === 'mage' && time - (u.lastSummonTime || 0) > 8000) {
           requestSpawn('warrior', u.team, true);
           u.lastSummonTime = time;
        }
      });

      if (projectilesRef.current.length > 0) {
         setProjectiles(p => [...p, ...projectilesRef.current]);
         projectilesRef.current = [];
      }

      return next.filter(u => u.health > 0 && !toRemove.has(u.id));
    });

    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameResult, isRetreating]);

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
    // OUTER LETTERBOX WRAPPER - Forces 16:9 centering on any screen
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      
      {/* 16:9 GAME CONTAINER - LOCKED ASPECT RATIO */}
      {/* This div represents the "Phone Screen" */}
      <div className="relative w-full h-auto aspect-video max-h-screen bg-slate-900 overflow-hidden shadow-2xl border-y-2 border-slate-800">
        
        {/* ====================
            LAYER 0: BACKGROUND
           ==================== */}
        <div className="absolute inset-0 z-0 bg-[#0f172a]">
           
           {/* Sky Gradient - Soft Fantasy Twilight */}
           <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-[#701a75]"></div>
           <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
           
           {/* Static Stars/Dust */}
           <div className="absolute inset-0 opacity-30" 
                style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>

           {/* Layer 1: Far Mountains (Lightest/Atmospheric) */}
           <div className="absolute bottom-[21%] left-0 right-0 h-[45%] text-indigo-300/20 pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 300">
                 <path d="M0,200 C300,100 600,250 1200,120 L1200,300 L0,300 Z" fill="currentColor"/>
              </svg>
           </div>

           {/* Layer 2: Mid Hills (Darker) */}
           <div className="absolute bottom-[21%] left-0 right-0 h-[30%] text-indigo-900/40 pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 300">
                 <path d="M0,250 C200,180 500,280 800,200 C1000,160 1200,240 1200,240 L1200,300 L0,300 Z" fill="currentColor"/>
              </svg>
           </div>

           {/* Layer 3: Foreground Silhouette (Darkest) */}
           <div className="absolute bottom-[21%] left-0 right-0 h-[25%] text-slate-900 pointer-events-none">
              {/* Ground Shapes */}
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 200">
                 <path d="M0,180 C150,150 300,190 600,160 C900,130 1050,170 1200,150 L1200,200 L0,200 Z" fill="currentColor"/>
              </svg>

              {/* Static Tree Elements */}
              <div className="absolute bottom-0 left-[5%] w-[4vw] h-[10vw] flex flex-col items-center opacity-90">
                 <div className="w-[60%] h-full bg-slate-900 rounded-t-full"></div>
                 <div className="absolute top-[10%] w-[100%] h-[40%] bg-slate-900 rounded-full"></div>
              </div>
              <div className="absolute bottom-0 right-[8%] w-[5vw] h-[12vw] flex flex-col items-center opacity-90">
                 <div className="w-[50%] h-full bg-slate-900 rounded-t-full"></div>
                 <div className="absolute top-[15%] w-[100%] h-[35%] bg-slate-900 rounded-full"></div>
              </div>
           </div>

           {/* Lane Ground - Calm Dark Gradient */}
           <div className="absolute left-0 right-0 shadow-[0_-5px_30px_rgba(0,0,0,0.6)] z-10" 
                style={{ bottom: 0, height: `${LAYOUT.LANE_BOTTOM}%` }}>
                <div className="w-full h-full bg-gradient-to-b from-[#1e293b] to-[#020617] border-t border-white/5 relative overflow-hidden">
                   {/* Subtle Texture */}
                   <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                </div>
           </div>
        </div>

        {/* ====================
            LAYER 1: GAMEPLAY
           ==================== */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          
          {/* --- TOWERS --- */}
          {/* Player Tower (LEFT 10%) */}
          <div className="absolute transition-transform duration-100" 
               style={{ left: `${LAYOUT.TOWER_LEFT}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="player" hp={playerHP} maxHp={2000} />
          </div>

          {/* Enemy Tower (RIGHT 90%) */}
          <div className="absolute transition-transform duration-100" 
               style={{ left: `${LAYOUT.TOWER_RIGHT}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="enemy" hp={enemyHP} maxHp={2000 + level*200} />
          </div>

          {/* --- MINING ROCKS --- */}
          {/* Player Rock (Left + 10) */}
          <div className="absolute" style={{ left: `${LAYOUT.TOWER_LEFT + 10}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
            <div className="text-[3vw] animate-bounce">💎</div>
          </div>
          {/* Enemy Rock (Right - 10) */}
          <div className="absolute" style={{ left: `${LAYOUT.TOWER_RIGHT - 10}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
            <div className="text-[3vw] animate-bounce">💎</div>
          </div>

          {/* --- UNITS --- */}
          {units.map(u => (
            <div 
              key={u.id}
              className="absolute transition-all duration-100 ease-linear"
              style={{ 
                left: `${u.position}%`, 
                bottom: `${LAYOUT.LANE_BOTTOM}%`, 
                transform: 'translateX(-50%)' 
              }}
            >
               {/* 
                  Orientation:
                  Player (Left) -> Standard Scale (Face Right)
                  Enemy (Right) -> Flipped Scale (Face Left)
               */}
               <div className={`flex flex-col items-center justify-end ${u.team === 'player' ? '' : 'scale-x-[-1]'}`}>
                  {/* HP Bar - Counter-flip for enemy to keep LTR visual */}
                  <div className={`w-[4vw] h-[0.5vw] bg-black/50 rounded-full mb-[0.2vw] overflow-hidden ${u.team === 'enemy' ? 'scale-x-[-1]' : ''}`}>
                     <div className={`h-full ${u.team === 'player' ? 'bg-sky-400' : 'bg-rose-500'}`} style={{ width: `${(u.health/u.maxHealth)*100}%` }}></div>
                  </div>
                  {/* Unit Sprite */}
                  <div className={`
                     ${u.isBigSlime ? 'w-[7vw] h-[7vw] text-[3.5vw]' : 'w-[4vw] h-[4vw] text-[2vw]'} 
                     ${SLIME_CONFIGS[u.type].color} 
                     rounded-t-[40%] rounded-b-[20%] 
                     border-2 border-white/20 shadow-lg 
                     flex items-center justify-center
                     ${u.isMining ? 'animate-bounce' : 'animate-squish'}
                  `}>
                     <span className="transform scale-x-[-1] drop-shadow-md">
                       {SLIME_CONFIGS[u.type].icon}
                     </span>
                  </div>
               </div>
            </div>
          ))}

          {/* --- PROJECTILES --- */}
          {projectiles.map(p => (
             <div 
               key={p.id}
               className="absolute w-[0.8vw] h-[0.8vw] bg-white rounded-full shadow-[0_0_8px_white]"
               style={{ 
                  left: `${p.x}%`, 
                  bottom: `${LAYOUT.LANE_BOTTOM + p.y}%` // % based Y offset 
               }}
             />
          ))}

        </div>

        {/* ====================
            LAYER 2: UI OVERLAY
            (Strictly Padded from Edges, No Lane Overlap)
           ==================== */}
        <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between">
           
           {/* TOP HUD ZONE (0% - 15% Height) - REDUCED HEIGHT & PADDING */}
           <div className="w-full h-[15%] px-6 pt-2 flex justify-between items-start pointer-events-auto">
              
              {/* Left: Player Badge */}
              <div className="bg-slate-900/80 backdrop-blur rounded-full px-4 py-2 border border-white/10 flex items-center space-x-3 shadow-lg scale-90 origin-top-left">
                 <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/20">PI</div>
                 <span className="text-xs font-bold text-white tracking-widest">CMDR</span>
              </div>

              {/* Center: Unit Spawner - REDUCED SIZE */}
              <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl p-1 border border-white/10 flex space-x-1 shadow-2xl">
                 {(['miner', 'warrior', 'tank', 'archer', 'mage', 'big_slime'] as any[]).map(type => {
                    const cfg = SLIME_CONFIGS[type as SlimeType] || SLIME_CONFIGS.big_slime;
                    const cd = cooldowns[type] || 0;
                    const canAfford = playerGold >= cfg.cost;
                    return (
                       <button
                          key={type}
                          onClick={() => requestSpawn(type, 'player')}
                          disabled={!canAfford || cd > 0}
                          className={`
                             relative w-[4vw] h-[4.5vw] max-w-[48px] max-h-[54px] rounded-lg flex flex-col items-center justify-center
                             transition-all active:scale-95 border
                             ${canAfford ? 'bg-slate-800 hover:bg-slate-700 border-white/10' : 'bg-slate-900 opacity-60 grayscale border-transparent'}
                          `}
                       >
                          <span className="text-[1.5vw] max-text-[20px] drop-shadow-md mb-[2px]">{cfg.icon}</span>
                          <div className="absolute bottom-0 w-full bg-black/50 text-[0.8vw] max-text-[9px] text-center text-white font-bold py-[1px] rounded-b-lg leading-none">
                             {cfg.cost}
                          </div>
                          {cd > 0 && (
                             <div className="absolute inset-0 bg-black/70 rounded-lg flex items-center justify-center">
                                <span className="text-[1.2vw] font-bold text-white">{(cd/1000).toFixed(0)}</span>
                             </div>
                          )}
                       </button>
                    );
                 })}
              </div>

              {/* Right: Resources */}
              <div className="bg-slate-900/80 backdrop-blur rounded-full px-4 py-2 border border-white/10 flex items-center space-x-4 shadow-lg scale-90 origin-top-right">
                 <span className="text-sm font-black text-amber-400 header-font">🪨 {playerGold}</span>
                 <div className="w-px h-4 bg-white/20"></div>
                 <div className="flex items-center space-x-1.5">
                    <Users size={14} className="text-white/60" />
                    <span className="text-sm font-bold text-white header-font">{currentPop}/{MAX_POP}</span>
                 </div>
              </div>
           </div>

           {/* MIDDLE SPACER (Allows Lane Visibility) */}
           <div className="flex-1 pointer-events-none"></div>

           {/* BOTTOM CONTROLS ZONE (Strictly confined to bottom 18%) */}
           <div className="w-full h-[18%] px-6 pb-2 flex justify-end items-end pointer-events-auto">
              <div className="flex flex-col gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-xl">
                <button
                   onClick={() => setIsRetreating(false)}
                   className={`w-[4vw] h-[4vw] max-w-[48px] max-h-[48px] rounded-xl flex items-center justify-center shadow-lg border-2 border-white/20 transition-all active:scale-90 ${!isRetreating ? 'bg-rose-500 border-white' : 'bg-slate-800 text-white/50'}`}
                >
                   <Sword className="w-[2vw] h-[2vw] max-w-[24px] max-h-[24px] text-white" />
                </button>
                <button
                   onClick={() => setIsRetreating(true)}
                   className={`w-[4vw] h-[4vw] max-w-[48px] max-h-[48px] rounded-xl flex items-center justify-center shadow-lg border-2 border-white/20 transition-all active:scale-90 ${isRetreating ? 'bg-emerald-500 border-white' : 'bg-slate-800 text-white/50'}`}
                >
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

   // Detect damage for wobble animation
   useEffect(() => {
     if (hp < prevHp.current) {
       setIsHit(true);
       const t = setTimeout(() => setIsHit(false), 400);
       return () => clearTimeout(t);
     }
     prevHp.current = hp;
   }, [hp]);
   
   // Theme configuration
   const theme = isPlayer 
     ? { 
         gradient: 'from-emerald-400 to-emerald-700', 
         border: 'border-emerald-300/50', 
         glow: 'shadow-[0_0_30px_rgba(52,211,153,0.4)]',
         swirl: 'text-emerald-300',
         hpBar: 'bg-emerald-500',
         hpBg: 'bg-emerald-950',
         bubble: 'bg-emerald-200'
       } 
     : { 
         gradient: 'from-rose-400 to-rose-700', 
         border: 'border-rose-300/50',
         glow: 'shadow-[0_0_30px_rgba(251,113,133,0.4)]',
         swirl: 'text-rose-300',
         hpBar: 'bg-rose-500',
         hpBg: 'bg-rose-950',
         bubble: 'bg-rose-200'
       };

   return (
      <div className="flex flex-col items-center w-[8vw] relative group">
         <style>{`
            @keyframes soft-bounce {
               0%, 100% { transform: scale(1); }
               50% { transform: scale(1.02, 0.98); }
            }
            @keyframes breathe {
               0%, 100% { transform: scale(1); opacity: 0.95; }
               50% { transform: scale(1.03); opacity: 1; }
            }
            @keyframes liquid-spin {
               from { transform: rotate(0deg); }
               to { transform: rotate(360deg); }
            }
            @keyframes gentle-bubble {
               0% { transform: translateY(20px) scale(0.5); opacity: 0; }
               50% { opacity: 0.6; }
               100% { transform: translateY(-20px) scale(1); opacity: 0; }
            }
            @keyframes hit-wobble {
               0% { transform: scale(1) rotate(0deg); }
               20% { transform: scale(1.2) rotate(-5deg); }
               40% { transform: scale(1.1) rotate(5deg); }
               60% { transform: scale(1.05) rotate(-3deg); }
               80% { transform: scale(1.02) rotate(2deg); }
               100% { transform: scale(1) rotate(0deg); }
            }
            .animate-hit-wobble {
               animation: hit-wobble 0.4s ease-out;
            }
         `}</style>

         {/* REDESIGNED: Slime-shaped HP Bar with Breathing Effect */}
         <div className={`
            relative z-30 mb-[1vw]
            w-[120%] h-[1.6vw]
            bg-slate-900/80 backdrop-blur-md
            rounded-[0.8vw] /* Pill shape for liquid tube */
            border-[0.2vw] ${theme.border}
            shadow-lg overflow-hidden
            transition-all duration-200
            ${isHit ? 'animate-hit-wobble border-white/60 shadow-[0_0_20px_rgba(255,255,255,0.4)]' : ''}
         `}
         style={{ animation: isHit ? 'hit-wobble 0.4s ease-out' : 'breathe 5s ease-in-out infinite' }}
         >
             {/* Background Dark Liquid */}
             <div className={`absolute inset-0 opacity-40 ${theme.hpBg}`}></div>

             {/* Foreground Health Liquid */}
             <div 
                className={`h-full ${theme.hpBar} relative transition-all duration-500 ease-out flex items-center`}
                style={{ width: `${Math.max(0, (hp/maxHp)*100)}%` }}
             >
                {/* Surface Gloss on Fluid */}
                <div className="absolute top-0 inset-x-0 h-[40%] bg-white/40 blur-[1px] rounded-b-full opacity-80"></div>
                
                {/* Meniscus / Leading Edge Highlight */}
                <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-white/60 blur-[1px] shadow-[0_0_5px_white]"></div>
             </div>

             {/* Tube Glass Reflections (Static Overlay) */}
             <div className="absolute top-[15%] left-[5%] w-[90%] h-[20%] bg-gradient-to-b from-white/30 to-transparent rounded-full blur-[0.5px] pointer-events-none"></div>
             <div className="absolute bottom-[15%] left-[10%] w-[80%] h-[15%] bg-gradient-to-t from-white/10 to-transparent rounded-full blur-[1px] pointer-events-none"></div>
         </div>

         {/* Slime Tower Body - Slower Pulse */}
         <div className={`
            w-full h-[16vw] 
            rounded-t-[45%] rounded-b-[25%] 
            bg-gradient-to-b ${theme.gradient}
            border-[0.25vw] ${theme.border}
            ${theme.glow}
            flex items-end justify-center pb-[2.5vw]
            relative overflow-hidden
            transition-transform duration-500
         `}
         style={{ animation: 'soft-bounce 6s ease-in-out infinite' }}
         >
            {/* 1. Glossy Highlights (The "Wet" Look) */}
            <div className="absolute top-[8%] left-[20%] w-[30%] h-[15%] bg-white/40 rounded-full blur-[2px] rotate-[-15deg]"></div>
            <div className="absolute top-[12%] right-[15%] w-[10%] h-[8%] bg-white/30 rounded-full blur-[1px] rotate-[10deg]"></div>
            
            {/* 2. Inner Translucent Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 opacity-60"></div>

            {/* 3. Enhanced Swirling Portal Core - Slower Spin */}
            <div className={`
                relative w-[6vw] h-[7vw] 
                rounded-full 
                bg-slate-950/40 
                border-[0.15vw] ${isPlayer ? 'border-emerald-200/20' : 'border-rose-200/20'} 
                overflow-hidden 
                shadow-[inset_0_0_20px_rgba(0,0,0,0.6)] 
                flex items-center justify-center 
                backdrop-blur-sm
            `}>
               
               {/* Layer A: Slow Outer Swirl - Slowed down to 20s */}
               <div className={`absolute w-[200%] h-[200%] opacity-30 ${theme.swirl} mix-blend-overlay`} 
                    style={{ 
                       background: 'conic-gradient(from 0deg, transparent 0%, currentColor 40%, transparent 80%)',
                       animation: 'liquid-spin 20s linear infinite'
                    }} 
               />
               
               {/* Layer B: Reverse Inner Swirl - Slowed down to 15s */}
               <div className={`absolute w-[180%] h-[180%] opacity-20 ${theme.swirl}`} 
                    style={{ 
                       background: 'conic-gradient(from 180deg, transparent 0%, currentColor 30%, transparent 60%)',
                       animation: 'liquid-spin 15s linear infinite reverse'
                    }} 
               />

               {/* Layer C: Gentle Particles/Bubbles */}
               <div className={`absolute bottom-2 left-[40%] w-[0.4vw] h-[0.4vw] rounded-full ${theme.bubble} blur-[0.5px]`}
                    style={{ animation: 'gentle-bubble 4s ease-in-out infinite' }}></div>
               <div className={`absolute bottom-1 left-[60%] w-[0.3vw] h-[0.3vw] rounded-full ${theme.bubble} blur-[0.5px]`}
                    style={{ animation: 'gentle-bubble 5s ease-in-out infinite 2s' }}></div>

               {/* Deep Core (Calm Glow) */}
               <div className="relative w-[55%] h-[55%] bg-slate-900/80 rounded-full shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] flex items-center justify-center">
                  <div className={`w-[40%] h-[40%] rounded-full ${theme.hpBar} blur-md opacity-70 animate-pulse`}
                       style={{ animationDuration: '4s' }}></div>
               </div>
               
               {/* Surface Glint */}
               <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none rounded-full"></div>
            </div>

            {/* 4. Base Drips / Accents */}
            <div className="absolute bottom-0 w-full h-[10%] bg-gradient-to-t from-black/20 to-transparent"></div>
         </div>
      </div>
   );
};

export default Battlefield;
