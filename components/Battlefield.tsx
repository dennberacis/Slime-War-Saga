
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
  GROUND_LEVEL: 15, // % from bottom
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
        <div className="absolute inset-0 z-0">
           {/* Sky */}
           <div className={`absolute inset-0 bg-gradient-to-b ${theme.bgColor}`}></div>
           
           {/* Mountains */}
           <div className="absolute bottom-[20%] left-0 right-0 h-[30%] opacity-30">
              <div className="absolute bottom-0 left-[10%] w-0 h-0 border-l-[4vw] border-r-[4vw] border-b-[10vw] border-l-transparent border-r-transparent border-b-slate-800"></div>
              <div className="absolute bottom-0 left-[40%] w-0 h-0 border-l-[8vw] border-r-[8vw] border-b-[16vw] border-l-transparent border-r-transparent border-b-slate-900"></div>
              <div className="absolute bottom-0 right-[15%] w-0 h-0 border-l-[6vw] border-r-[6vw] border-b-[12vw] border-l-transparent border-r-transparent border-b-slate-800"></div>
           </div>

           {/* Ground - Fixed Height relative to container */}
           <div className="absolute left-0 right-0 bg-emerald-800 border-t-4 border-emerald-950 shadow-2xl" 
                style={{ bottom: 0, height: `${LAYOUT.GROUND_LEVEL}%` }}></div>
        </div>

        {/* ====================
            LAYER 1: GAMEPLAY
           ==================== */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          
          {/* --- TOWERS --- */}
          {/* Player Tower (LEFT 10%) */}
          <div className="absolute transition-transform duration-100" 
               style={{ left: `${LAYOUT.TOWER_LEFT}%`, bottom: `${LAYOUT.GROUND_LEVEL}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="player" hp={playerHP} maxHp={2000} />
          </div>

          {/* Enemy Tower (RIGHT 90%) */}
          <div className="absolute transition-transform duration-100" 
               style={{ left: `${LAYOUT.TOWER_RIGHT}%`, bottom: `${LAYOUT.GROUND_LEVEL}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="enemy" hp={enemyHP} maxHp={2000 + level*200} />
          </div>

          {/* --- MINING ROCKS --- */}
          {/* Player Rock (Left + 10) */}
          <div className="absolute" style={{ left: `${LAYOUT.TOWER_LEFT + 10}%`, bottom: `${LAYOUT.GROUND_LEVEL}%`, transform: 'translateX(-50%)' }}>
            <div className="text-[3vw] animate-bounce">💎</div>
          </div>
          {/* Enemy Rock (Right - 10) */}
          <div className="absolute" style={{ left: `${LAYOUT.TOWER_RIGHT - 10}%`, bottom: `${LAYOUT.GROUND_LEVEL}%`, transform: 'translateX(-50%)' }}>
            <div className="text-[3vw] animate-bounce">💎</div>
          </div>

          {/* --- UNITS --- */}
          {units.map(u => (
            <div 
              key={u.id}
              className="absolute transition-all duration-100 ease-linear"
              style={{ 
                left: `${u.position}%`, 
                bottom: `${LAYOUT.GROUND_LEVEL}%`, 
                transform: 'translateX(-50%)' 
              }}
            >
               {/* 
                  Orientation:
                  Player (Left) -> Standard Scale (Face Right)
                  Enemy (Right) -> Flipped Scale (Face Left)
               */}
               <div className={`flex flex-col items-center justify-end ${u.team === 'player' ? '' : 'scale-x-[-1]'}`}>
                  {/* HP Bar */}
                  <div className="w-[4vw] h-[0.5vw] bg-black/50 rounded-full mb-[0.2vw] overflow-hidden">
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
                  bottom: `${LAYOUT.GROUND_LEVEL + p.y}%` // % based Y offset 
               }}
             />
          ))}

        </div>

        {/* ====================
            LAYER 2: UI OVERLAY
            (Strictly Padded from Edges)
           ==================== */}
        <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between p-6">
           
           {/* TOP HUD BAR */}
           <div className="w-full flex justify-between items-start">
              
              {/* Left: Player Badge */}
              <div className="pointer-events-auto bg-slate-900/80 backdrop-blur rounded-full px-4 py-2 border border-white/10 flex items-center space-x-3 shadow-lg">
                 <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/20">PI</div>
                 <span className="text-xs font-bold text-white tracking-widest">CMDR</span>
              </div>

              {/* Center: Unit Spawner */}
              <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 flex space-x-1 shadow-2xl">
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
                             relative w-[5vw] h-[6vw] max-w-[60px] max-h-[72px] rounded-xl flex flex-col items-center justify-center
                             transition-all active:scale-95 border
                             ${canAfford ? 'bg-slate-800 hover:bg-slate-700 border-white/10' : 'bg-slate-900 opacity-60 grayscale border-transparent'}
                          `}
                       >
                          <span className="text-[2vw] max-text-[24px] drop-shadow-md">{cfg.icon}</span>
                          <div className="absolute bottom-0 w-full bg-black/50 text-[1vw] max-text-[10px] text-center text-white font-bold py-[2px] rounded-b-xl leading-none">
                             {cfg.cost}
                          </div>
                          {cd > 0 && (
                             <div className="absolute inset-0 bg-black/70 rounded-xl flex items-center justify-center">
                                <span className="text-[1.5vw] font-bold text-white">{(cd/1000).toFixed(0)}</span>
                             </div>
                          )}
                       </button>
                    );
                 })}
              </div>

              {/* Right: Resources */}
              <div className="pointer-events-auto bg-slate-900/80 backdrop-blur rounded-full px-4 py-2 border border-white/10 flex items-center space-x-4 shadow-lg">
                 <span className="text-sm font-black text-amber-400 header-font">🪨 {playerGold}</span>
                 <div className="w-px h-4 bg-white/20"></div>
                 <div className="flex items-center space-x-1.5">
                    <Users size={14} className="text-white/60" />
                    <span className="text-sm font-bold text-white header-font">{currentPop}/{MAX_POP}</span>
                 </div>
              </div>
           </div>

           {/* BOTTOM RIGHT ACTIONS */}
           <div className="pointer-events-auto self-end flex flex-col gap-3 mt-auto">
              <button
                 onClick={() => setIsRetreating(false)}
                 className={`w-[5vw] h-[5vw] max-w-[64px] max-h-[64px] rounded-full flex items-center justify-center shadow-lg border-2 border-white/20 transition-all active:scale-90 ${!isRetreating ? 'bg-rose-500 scale-110 border-white' : 'bg-slate-800 text-white/50'}`}
              >
                 <Sword className="w-[2.5vw] h-[2.5vw] max-w-[32px] max-h-[32px] text-white" />
              </button>
              <button
                 onClick={() => setIsRetreating(true)}
                 className={`w-[5vw] h-[5vw] max-w-[64px] max-h-[64px] rounded-full flex items-center justify-center shadow-lg border-2 border-white/20 transition-all active:scale-90 ${isRetreating ? 'bg-emerald-500 scale-110 border-white' : 'bg-slate-800 text-white/50'}`}
              >
                 <Undo2 className="w-[2.5vw] h-[2.5vw] max-w-[32px] max-h-[32px] text-white" />
              </button>
           </div>

        </div>

      </div>
    </div>
  );
};

const TowerVisual: React.FC<{ team: 'player'|'enemy'; hp: number; maxHp: number }> = ({ team, hp, maxHp }) => {
   const isPlayer = team === 'player';
   const color = isPlayer ? 'bg-emerald-500' : 'bg-rose-500';
   
   return (
      <div className="flex flex-col items-center w-[8vw]">
         {/* Fixed HP Bar - 80% Width */}
         <div className="w-[80%] bg-slate-900/90 p-[0.15vw] rounded-full border border-white/20 shadow-md mb-[0.5vw] z-20 backdrop-blur-sm">
            <div className="w-full h-[0.6vw] bg-slate-800/80 rounded-full overflow-hidden">
               <div 
                  className={`h-full ${color} transition-all duration-300 ease-out`} 
                  style={{ width: `${Math.max(0, (hp/maxHp)*100)}%` }}
               ></div>
            </div>
         </div>

         {/* Tower Body - Matches parent width (8vw) */}
         <div className={`
            w-full h-[16vw] 
            rounded-t-full rounded-b-[1vw]
            bg-gradient-to-b from-slate-700 to-slate-900 
            border-[0.3vw] border-slate-950 shadow-2xl 
            flex items-end justify-center pb-[1vw]
            relative overflow-hidden
         `}>
            {/* Core Portal */}
            <div className={`w-[5vw] h-[7vw] rounded-t-full bg-black/60 border-[0.2vw] ${isPlayer ? 'border-emerald-500/50' : 'border-rose-500/50'} relative overflow-hidden`}>
               <div className={`absolute inset-0 opacity-50 blur-md animate-pulse ${color}`}></div>
            </div>
         </div>
      </div>
   );
};

export default Battlefield;
