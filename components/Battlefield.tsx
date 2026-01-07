import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerStats, SlimeUnit, SlimeType, Projectile } from '../types';
import { SLIME_CONFIGS, getThemeForLevel } from '../constants';
import { Sword, Undo2, Users, ShieldPlus, Gem, ChevronUp, Shield, Target, Castle, Skull, Swords } from 'lucide-react';
import { getBattleStrategy } from '../services/geminiService';

interface BattlefieldProps {
  level: number;
  playerStats: PlayerStats;
  onWin: () => void;
  onLose: () => void;
}

const LAYOUT = {
  ASPECT_RATIO: '16/9',
  WORLD_WIDTH: 400, // The world is 4x wider than the viewport (0 to 400)
  // VIEWPORT_WIDTH removed in favor of dynamic state
  TOWER_LEFT: 8,     // Positioned at start of world (with visual buffer)
  TOWER_RIGHT: 392,  // Positioned at end of world (with visual buffer)
  ROCK_OFFSET: 22,   // Distance from tower to rock (reachable in ~1.5s)
  LANE_BOTTOM: 28,   // Raised to 28% to keep action above the bottom UI
};

const ZOOM_LIMITS = {
  MIN_WIDTH: 40,  // Max zoom in
  MAX_WIDTH: 150, // Max zoom out (prevents seeing whole map of 400)
};

const GRAVITY = 0.02;
const MAX_POP = 30;

const TOWER_UPGRADES = [
  { cost: 0, hpBonus: 0, label: "LVL 1" },
  { cost: 500, hpBonus: 1000, label: "LVL 2" },
  { cost: 1000, hpBonus: 2000, label: "MAX LVL" },
];

const MINER_CAPACITY = 20;
const MINER_HIT_INTERVAL = 1200;

type CommandType = 'attack' | 'defend' | 'retreat';
type CameraMode = 'player' | 'combat' | 'enemy' | 'manual';

interface ExtendedSlimeUnit extends SlimeUnit {
  carriedGold?: number;
  lastMineTime?: number;
  target?: 'rock' | 'tower';
}

const ResourceCrystal: React.FC<{ x: number; active: boolean }> = ({ x, active }) => (
  <div 
    className="absolute z-0 flex flex-col items-center origin-bottom"
    style={{ left: `${x / 4}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}
  >
     <div className={`relative transition-all duration-300 ${active ? 'scale-110 drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]' : 'scale-100 grayscale-[0.5]'}`}>
        <div className="w-[8vw] h-[8vw] bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 clip-crystal animate-pulse-slow relative z-10">
            <div className="absolute inset-0 bg-white/10 opacity-30 mix-blend-overlay"></div>
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/40 to-transparent"></div>
        </div>
        <div className="absolute -bottom-1 -left-2 w-[10vw] h-[3vw] bg-slate-900/50 rounded-full z-0 blur-[2px]"></div>
        {active && (
           <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 text-amber-300 font-black text-[1.2vw] animate-float-fast shadow-black drop-shadow-md">+5</div>
           </div>
        )}
     </div>
     <style>{`
        .clip-crystal { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
        .animate-float-fast { animation: float-up 0.8s ease-out infinite; }
        @keyframes float-up { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-2vw); opacity: 0; } }
     `}</style>
  </div>
);

const TowerVisual: React.FC<{ team: 'player' | 'enemy'; hp: number; maxHp: number; towerLevel: number }> = ({ team, hp, maxHp, towerLevel }) => {
  const isPlayer = team === 'player';
  const scale = 1 + (towerLevel - 1) * 0.1;

  return (
    <div className="flex flex-col items-center relative" style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}>
       <div className="absolute -top-[4vw] w-[12vw] h-[1.2vw] bg-black/60 backdrop-blur-sm rounded-full border border-white/10 overflow-hidden shadow-lg">
          <div 
            className={`h-full transition-all duration-300 ease-out ${isPlayer ? 'bg-gradient-to-r from-sky-500 to-indigo-500' : 'bg-gradient-to-r from-red-500 to-rose-700'}`} 
            style={{ width: `${Math.max(0, (hp/maxHp)*100)}%` }}
          ></div>
       </div>

       <div className={`relative w-[14vw] h-[22vw] flex flex-col items-center justify-end transition-all duration-500`}>
          <div className={`w-full h-[85%] ${isPlayer ? 'bg-slate-800' : 'bg-[#2a1a1a]'} rounded-t-3xl relative overflow-hidden border-x-2 ${isPlayer ? 'border-slate-600' : 'border-red-900/50'} shadow-2xl`}>
              <div className="absolute inset-0 opacity-20 bg-gradient-to-b from-white/10 to-transparent"></div>
              <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[4vw] h-[4vw] bg-black rounded-full border-2 border-white/10 shadow-inner flex items-center justify-center">
                  <div className={`w-[2vw] h-[2vw] rounded-full ${isPlayer ? 'bg-sky-400' : 'bg-red-500'} blur-sm animate-pulse`}></div>
              </div>
              {towerLevel >= 2 && <div className="absolute top-[50%] w-full h-[2px] bg-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.5)]"></div>}
          </div>

          <div className={`absolute top-0 w-[16vw] h-[6vw] ${isPlayer ? 'bg-indigo-900' : 'bg-red-950'} rounded-t-full flex items-center justify-center border-b-4 border-black/30 shadow-lg z-10`}>
               <div className={`w-[1.5vw] h-[1.5vw] rounded-full ${isPlayer ? 'bg-sky-300' : 'bg-red-400'} shadow-[0_0_15px_currentColor]`}></div>
          </div>
          
          {towerLevel >= 3 && <div className={`absolute -inset-4 rounded-full opacity-20 blur-xl ${isPlayer ? 'bg-sky-400' : 'bg-red-500'} animate-pulse`}></div>}
          <div className="absolute bottom-0 w-[5vw] h-[7vw] bg-black rounded-t-full border-4 border-slate-700 shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)]"></div>
       </div>
    </div>
  );
};

const UnitRenderer: React.FC<{ unit: ExtendedSlimeUnit; towerLevel: number; command: string }> = ({ unit, towerLevel, command }) => {
    const config = SLIME_CONFIGS[unit.type as SlimeType] || SLIME_CONFIGS.big_slime;
    const isMining = unit.isMining;
    const isAttacking = unit.lastAttackTime > 0 && (performance.now() - unit.lastAttackTime < 500);
    const isMoving = !isMining && !isAttacking;
    const mainColor = unit.team === 'player' ? config.color : 'bg-red-800';
    const faceColor = unit.team === 'player' ? 'bg-white' : 'bg-yellow-300';
    
    return (
        <div className={`relative flex flex-col items-center ${unit.isBigSlime ? 'scale-[1.8]' : ''} ${unit.isMini ? 'scale-[0.6]' : ''}`}>
             <div 
               className={`w-[6vw] h-[5vw] ${mainColor} rounded-t-[50%] rounded-b-[20%] relative shadow-[inset_-0.5vw_-0.5vw_1vw_rgba(0,0,0,0.3)] transition-transform duration-200
               ${isMining ? 'animate-mining origin-bottom' : ''} 
               ${isAttacking ? 'animate-lung' : ''}
               ${isMoving ? 'animate-bounce-run' : ''}
               `}
             >
                 <div className="absolute top-[35%] left-1/2 -translate-x-1/2 flex space-x-[1vw]">
                     <div className={`w-[0.8vw] h-[0.8vw] ${faceColor} rounded-full shadow-sm`}></div>
                     <div className={`w-[0.8vw] h-[0.8vw] ${faceColor} rounded-full shadow-sm`}></div>
                 </div>
                 
                 <div className="absolute -right-[1vw] top-[0vw] text-[2vw] drop-shadow-md transform rotate-12">
                    {config.icon}
                 </div>

                 {unit.type === 'miner' && unit.carriedGold && unit.carriedGold > 0 && (
                     <div className="absolute -top-[2vw] left-1/2 -translate-x-1/2 bg-yellow-400 border border-yellow-600 px-1.5 py-0.5 rounded-full flex items-center shadow-lg z-20 animate-bounce">
                        <span className="text-[1vw] mr-0.5">💎</span>
                        <span className="text-[1vw] font-black text-amber-900 leading-none">{unit.carriedGold}</span>
                     </div>
                 )}
             </div>

             <div className="w-[5vw] h-[1vw] bg-black/30 rounded-full blur-[2px] mt-[-0.5vw] transition-all duration-200" style={{ transform: isMoving ? 'scale(0.8)' : 'scale(1)' }}></div>
             
             <style>{`
                 @keyframes mining { 0% { transform: rotate(0deg) scaleY(1); } 50% { transform: rotate(-15deg) scaleY(0.9); } 100% { transform: rotate(0deg) scaleY(1); } }
                 @keyframes lung { 0% { transform: translateX(0); } 30% { transform: translateX(1vw) scaleX(1.1); } 100% { transform: translateX(0); } }
                 @keyframes bounce-run { 0%, 100% { transform: translateY(0) scale(1,1); } 50% { transform: translateY(-0.5vw) scale(0.95, 1.05); } }
                 .animate-mining { animation: mining 0.8s infinite; }
                 .animate-lung { animation: lung 0.4s ease-out; }
                 .animate-bounce-run { animation: bounce-run 0.6s infinite; }
             `}</style>
        </div>
    );
};

const Battlefield: React.FC<BattlefieldProps> = ({ level, playerStats, onWin, onLose }) => {
  const [playerGold, setPlayerGold] = useState(250);
  const [enemyGold, setEnemyGold] = useState(200);
  const [playerHP, setPlayerHP] = useState(2000);
  const [playerMaxHP, setPlayerMaxHP] = useState(2000);
  const [playerTowerLevel, setPlayerTowerLevel] = useState(1);
  const [enemyHP, setEnemyHP] = useState(2000 + (level * 200));
  const [gameResult, setGameResult] = useState<'win' | 'lose' | null>(null);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [floatingTexts, setFloatingTexts] = useState<{id: string, x: number, y: number, text: string}[]>([]);
  const [cameraX, setCameraX] = useState(LAYOUT.TOWER_LEFT); // Start at player tower
  const [viewportWidth, setViewportWidth] = useState(60); // Starts zoomed in (60 units wide vs 100 max)
  const [cameraMode, setCameraMode] = useState<CameraMode>('combat');
  
  const [units, setUnits] = useState<ExtendedSlimeUnit[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [spawnQueue, setSpawnQueue] = useState<{type: string, team: 'player'|'enemy', position?: number}[]>([]);
  const [playerCommand, setPlayerCommand] = useState<CommandType>('defend');
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  
  const gameLoopRef = useRef<number>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  const projectilesRef = useRef<Projectile[]>([]);
  
  // Interaction Refs
  const dragRef = useRef({ isDown: false, startX: 0, lastX: 0 });
  const cameraTargetRef = useRef(LAYOUT.TOWER_LEFT);
  const lastInteractionRef = useRef(performance.now()); // For camera snap-back

  const gameStateRef = useRef({
    units,
    enemyGold,
    playerGold,
    gameResult,
    isStarting,
    spawnQueue,
    playerTowerLevel,
    cameraX,
    playerCommand,
    lastPlayerTowerAttack: 0,
    lastEnemyTowerAttack: 0,
    cameraMode,
    viewportWidth
  });

  useEffect(() => {
    // Sync ref with state
    gameStateRef.current.units = units;
    gameStateRef.current.enemyGold = enemyGold;
    gameStateRef.current.playerGold = playerGold;
    gameStateRef.current.gameResult = gameResult;
    gameStateRef.current.isStarting = isStarting;
    gameStateRef.current.spawnQueue = spawnQueue;
    gameStateRef.current.playerTowerLevel = playerTowerLevel;
    gameStateRef.current.cameraX = cameraX;
    gameStateRef.current.playerCommand = playerCommand;
    gameStateRef.current.cameraMode = cameraMode;
    gameStateRef.current.viewportWidth = viewportWidth;
  }, [units, enemyGold, playerGold, gameResult, isStarting, spawnQueue, playerTowerLevel, cameraX, playerCommand, cameraMode, viewportWidth]);

  useEffect(() => {
    let mounted = true;
    const loadingTimer = setTimeout(() => { if (mounted) setIsStarting(false); }, 7000);
    const fetchStrategy = async () => {
      try {
        const tip = await getBattleStrategy(level, playerStats.selectedDeck);
        if (mounted) setAiTip(tip);
      } catch (e) {}
    };
    fetchStrategy();
    return () => { mounted = false; clearTimeout(loadingTimer); };
  }, [level, playerStats.selectedDeck]);

  // Initial Enemy Scout Logic to define Combat Zone (30-50%)
  useEffect(() => {
    if (!isStarting) {
      setTimeout(() => {
        setSpawnQueue(prev => [...prev, { type: 'warrior', team: 'enemy', position: 250 }]);
      }, 500);
    }
  }, [isStarting]);

  useEffect(() => {
    const queueInterval = setInterval(() => {
      const { isStarting, gameResult, spawnQueue: currentQueue } = gameStateRef.current;
      if (currentQueue.length > 0 && !isStarting && !gameResult) {
        const next = currentQueue[0];
        setSpawnQueue(prev => prev.slice(1));
        const config = SLIME_CONFIGS[next.type as SlimeType] || SLIME_CONFIGS.big_slime;
        const newUnit: ExtendedSlimeUnit = {
          id: Math.random().toString(36).substr(2, 9),
          type: next.type === 'big_slime' ? 'tank' : (next.type as SlimeType),
          isBigSlime: next.type === 'big_slime',
          health: next.type === 'miner' ? 450 : config.hp,
          maxHealth: next.type === 'miner' ? 450 : config.hp,
          attack: config.atk,
          speed: next.type === 'miner' ? 0.25 : (next.type === 'tank' ? 0.15 : 0.22),
          range: next.type === 'archer' ? 38 : (next.type === 'mage' ? 48 : 8),
          cost: config.cost,
          position: next.position ?? (next.team === 'player' ? LAYOUT.TOWER_LEFT : LAYOUT.TOWER_RIGHT),
          team: next.team,
          lastAttackTime: 0,
          lastSummonTime: performance.now(),
          isDead: false,
          isMining: false,
          isRetreating: false,
          stuckArrows: 0,
          isMini: false,
          carriedGold: 0,
          target: 'rock'
        };
        setUnits(prev => [...prev, newUnit]);
      }
    }, 1000); 
    return () => clearInterval(queueInterval);
  }, []);

  // UI Interaction Helper to reset idle timer
  const handleUiInteraction = () => {
    lastInteractionRef.current = performance.now();
  };

  const requestSpawn = (type: SlimeType | 'big_slime', team: 'player' | 'enemy', isSummon = false) => {
    if (team === 'player') handleUiInteraction();
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

  const handleTowerUpgrade = () => {
    handleUiInteraction();
    if (playerTowerLevel >= 3 || isStarting || gameResult) return;
    const nextLevelIndex = playerTowerLevel;
    const upgrade = TOWER_UPGRADES[nextLevelIndex];
    if (playerGold >= upgrade.cost) {
      setPlayerGold(prev => prev - upgrade.cost);
      setPlayerTowerLevel(prev => prev + 1);
      setPlayerMaxHP(prev => prev + upgrade.hpBonus);
      setPlayerHP(prev => prev + upgrade.hpBonus);
    }
  };

  const handleCommand = (cmd: CommandType) => {
    handleUiInteraction();
    setPlayerCommand(cmd);
  }

  // --- Camera Interaction Handlers ---
  const handlePointerDown = (e: React.PointerEvent) => {
    // Safety Rule: Prevent UI clicks from triggering camera drag
    if ((e.target as HTMLElement).closest('button')) return;
    
    dragRef.current = { isDown: true, startX: e.clientX, lastX: e.clientX };
    lastInteractionRef.current = performance.now();
    setCameraMode('manual');
    gameStateRef.current.cameraMode = 'manual';
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDown) return;
    lastInteractionRef.current = performance.now();
    const deltaPixel = dragRef.current.lastX - e.clientX;
    dragRef.current.lastX = e.clientX;
    
    // Convert pixels to world units
    // Screen width (px) = viewportWidth (units)
    const sensitivity = gameStateRef.current.viewportWidth / window.innerWidth;
    const deltaWorld = deltaPixel * sensitivity;
    
    cameraTargetRef.current += deltaWorld;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current.isDown = false;
    lastInteractionRef.current = performance.now();
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (gameStateRef.current.cameraMode !== 'manual') {
        setCameraMode('manual');
        gameStateRef.current.cameraMode = 'manual';
    }
    lastInteractionRef.current = performance.now();
    
    setViewportWidth(prev => {
        const zoomAmount = e.deltaY * 0.05;
        const newWidth = prev + zoomAmount;
        return Math.max(ZOOM_LIMITS.MIN_WIDTH, Math.min(ZOOM_LIMITS.MAX_WIDTH, newWidth));
    });
  };

  const handleCameraJump = (target: CameraMode) => {
    handleUiInteraction();
    setCameraMode(target);
    // Directly update ref for immediate response in game loop
    gameStateRef.current.cameraMode = target;
  };
  // ------------------------------------

  useEffect(() => {
    const logicInterval = setInterval(() => {
      const { units, enemyGold, gameResult, isStarting, spawnQueue } = gameStateRef.current;
      if (gameResult || isStarting) return;
      setPlayerGold(g => g + 1);
      setEnemyGold(g => g + 1);
      
      const enemyUnits = units.filter(u => u.team === 'enemy');
      const playerUnits = units.filter(u => u.team === 'player');
      const enemyPop = enemyUnits.length + spawnQueue.filter(q => q.team === 'enemy').length;
      if (enemyPop >= MAX_POP) return;

      const enemyMiners = enemyUnits.filter(u => u.type === 'miner').length;
      const dangerClose = playerUnits.some(u => u.position > (LAYOUT.TOWER_RIGHT - 100));
      
      const spawnEnemy = (type: SlimeType | 'big_slime') => {
        const config = SLIME_CONFIGS[type as SlimeType] || SLIME_CONFIGS.big_slime;
        if (enemyGold >= config.cost) {
            setEnemyGold(prev => prev - config.cost);
            setSpawnQueue(prev => [...prev, { type, team: 'enemy' }]);
        }
      };

      if (dangerClose) {
         if (enemyGold >= SLIME_CONFIGS.tank.cost && Math.random() > 0.4) spawnEnemy('tank');
         else if (enemyGold >= SLIME_CONFIGS.warrior.cost) spawnEnemy('warrior');
      } else if (enemyMiners < 3 && enemyGold >= SLIME_CONFIGS.miner.cost && Math.random() > 0.3) {
         spawnEnemy('miner');
      } else if (enemyGold > 100) {
         const roll = Math.random();
         if (roll < 0.15 && enemyGold >= SLIME_CONFIGS.big_slime.cost) spawnEnemy('big_slime');
         else if (roll < 0.4 && enemyGold >= SLIME_CONFIGS.mage.cost) spawnEnemy('mage');
         else if (roll < 0.7 && enemyGold >= SLIME_CONFIGS.archer.cost) spawnEnemy('archer');
         else if (enemyGold >= SLIME_CONFIGS.warrior.cost) spawnEnemy('warrior');
      }
    }, 1000);
    return () => clearInterval(logicInterval);
  }, []);

  const update = useCallback((time: number) => {
    if (gameResult || isStarting) return;
    const dt = Math.min(32, time - lastUpdateRef.current);
    lastUpdateRef.current = time;

    // --- TOWER ATTACK LOGIC ---
    const TOWER_RANGE = 140; 
    const TOWER_COOLDOWN = 1500;

    if (time - gameStateRef.current.lastPlayerTowerAttack > TOWER_COOLDOWN) {
        const target = gameStateRef.current.units.find(u => 
            u.team === 'enemy' && !u.isDead && u.position < (LAYOUT.TOWER_LEFT + TOWER_RANGE)
        );
        if (target) {
            gameStateRef.current.lastPlayerTowerAttack = time;
            const flightTime = Math.abs(target.position - LAYOUT.TOWER_LEFT) * 2 + 20;
            projectilesRef.current.push({
                id: `pt-${Math.random()}`,
                type: 'magic',
                team: 'player',
                x: LAYOUT.TOWER_LEFT,
                y: 8,
                targetX: target.position,
                targetId: target.id,
                damage: 40 + (gameStateRef.current.playerTowerLevel * 20),
                speed: 1,
                vx: (target.position - LAYOUT.TOWER_LEFT) / flightTime,
                vy: 0.5 * GRAVITY * flightTime,
                isDone: false
            });
        }
    }

    if (time - gameStateRef.current.lastEnemyTowerAttack > TOWER_COOLDOWN) {
        const target = gameStateRef.current.units.find(u => 
            u.team === 'player' && !u.isDead && u.position > (LAYOUT.TOWER_RIGHT - TOWER_RANGE)
        );
        if (target) {
            gameStateRef.current.lastEnemyTowerAttack = time;
            const flightTime = Math.abs(target.position - LAYOUT.TOWER_RIGHT) * 2 + 20;
            projectilesRef.current.push({
                id: `et-${Math.random()}`,
                type: 'magic',
                team: 'enemy',
                x: LAYOUT.TOWER_RIGHT,
                y: 8,
                targetX: target.position,
                targetId: target.id,
                damage: 40,
                speed: 1,
                vx: (target.position - LAYOUT.TOWER_RIGHT) / flightTime,
                vy: 0.5 * GRAVITY * flightTime,
                isDone: false
            });
        }
    }

    setUnits(prev => {
      const next = prev.map(u => ({ ...u }));
      const toRemove = new Set<string>();
      const newSummons: ExtendedSlimeUnit[] = [];

      // --- CAMERA MODE LOGIC ---
      const { cameraMode, viewportWidth } = gameStateRef.current;

      if (cameraMode === 'player') {
         cameraTargetRef.current = LAYOUT.TOWER_LEFT;
      } else if (cameraMode === 'enemy') {
         cameraTargetRef.current = LAYOUT.TOWER_RIGHT - viewportWidth;
      } else if (cameraMode === 'combat') {
         const playerUnits = next.filter(u => u.team === 'player' && !u.isDead);
         const enemyUnits = next.filter(u => u.team === 'enemy' && !u.isDead);
         
         if (playerUnits.length > 0 || enemyUnits.length > 0) {
            const pMax = playerUnits.length > 0 ? Math.max(...playerUnits.map(u => u.position)) : LAYOUT.TOWER_LEFT;
            const eMin = enemyUnits.length > 0 ? Math.min(...enemyUnits.map(u => u.position)) : LAYOUT.TOWER_RIGHT;
            // Center of action
            const center = (pMax + eMin) / 2;
            cameraTargetRef.current = center - (viewportWidth / 2);
         } else {
            // Default to midway if no units
            cameraTargetRef.current = (LAYOUT.WORLD_WIDTH / 2) - (viewportWidth / 2);
         }
      }
      
      // Auto-Zoom in Combat Mode
      if (cameraMode === 'combat') {
        const activeCount = next.filter(u => !u.isDead).length;
        const targetZoom = 60 + Math.min(activeCount, 20) / 20 * 40;
        
        setViewportWidth(prevW => {
             const newW = prevW + (targetZoom - prevW) * 0.05;
             return newW;
        });
      }

      // Clamp Camera Target
      const minCamX = LAYOUT.TOWER_LEFT;
      const maxCamX = LAYOUT.TOWER_RIGHT - gameStateRef.current.viewportWidth;
      
      cameraTargetRef.current = Math.max(minCamX, Math.min(maxCamX, cameraTargetRef.current));

      // LERP Camera (Smooth Pan: 0.15 factor gives ~0.3-0.5s convergence)
      setCameraX(prevX => prevX + (cameraTargetRef.current - prevX) * 0.15);

      // --- SNAP BACK TO MANUAL TIMEOUT (Optional) ---
      // If we want auto-return behavior after manual interaction, we can add it here. 
      // Current requirement implies buttons control mode directly, so removing auto-lock timeout.

      next.forEach(u => {
        // Mage Summon Logic
        if (u.type === 'mage' && !u.isDead && (time - (u.lastSummonTime || 0) > 10000)) {
           u.lastSummonTime = time;
           newSummons.push({
               id: Math.random().toString(36).substr(2, 9),
               type: 'mage',
               isMini: true,
               health: 150,
               maxHealth: 150,
               attack: 20,
               speed: 0.25,
               range: 8,
               cost: 0,
               position: u.position + (u.team === 'player' ? 2 : -2),
               team: u.team,
               lastAttackTime: 0,
               isDead: false,
               stuckArrows: 0
           });
        }

        const myTower = u.team === 'player' ? LAYOUT.TOWER_LEFT : LAYOUT.TOWER_RIGHT;
        const enTower = u.team === 'player' ? LAYOUT.TOWER_RIGHT : LAYOUT.TOWER_LEFT;
        const rockPos = u.team === 'player' ? LAYOUT.TOWER_LEFT + LAYOUT.ROCK_OFFSET : LAYOUT.TOWER_RIGHT - LAYOUT.ROCK_OFFSET;
        
        const command = u.team === 'player' ? gameStateRef.current.playerCommand : 'attack'; 

        if (command === 'retreat') {
           u.isRetreating = true;
           u.target = undefined;
           if (Math.abs(u.position - myTower) < 3) { 
              toRemove.add(u.id);
              return; 
           }
           const dir = u.position < myTower ? 1 : -1;
           u.position += dir * u.speed * (dt / 16);
           return;
        } else {
           u.isRetreating = false;
        }

        if (u.type === 'miner') {
           const speedMultiplier = u.team === 'player' ? (gameStateRef.current.playerTowerLevel === 2 ? 1.15 : (gameStateRef.current.playerTowerLevel === 3 ? 1.3 : 1)) : 1;
           const currentHitInterval = MINER_HIT_INTERVAL / speedMultiplier;

           if (u.target === 'rock') {
              if (Math.abs(u.position - rockPos) < 1) {
                u.isMining = true;
                if (time - (u.lastMineTime || 0) >= currentHitInterval) {
                   u.carriedGold = (u.carriedGold || 0) + 5;
                   u.lastMineTime = time;
                   if (u.carriedGold >= MINER_CAPACITY) {
                      u.target = 'tower';
                      u.isMining = false;
                   }
                }
              } else {
                u.isMining = false;
                const dir = u.position < rockPos ? 1 : -1;
                u.position += dir * u.speed * speedMultiplier * (dt / 16);
              }
           } else {
              if (Math.abs(u.position - myTower) < 1) {
                if (u.carriedGold && u.carriedGold > 0) {
                   if (u.team === 'player') setPlayerGold(g => g + (u.carriedGold || 0));
                   else setEnemyGold(g => g + (u.carriedGold || 0));
                   const tid = Math.random().toString();
                   setFloatingTexts(prev => [...prev, {id: tid, x: u.position, y: 15, text: `+${u.carriedGold} Gold Rock`}]);
                   setTimeout(() => setFloatingTexts(prev => prev.filter(ft => ft.id !== tid)), 1500);
                }
                u.carriedGold = 0;
                u.target = 'rock';
              } else {
                const dir = u.position < myTower ? 1 : -1;
                u.position += dir * u.speed * speedMultiplier * (dt / 16);
              }
           }
           return;
        }

        const boundaryP = LAYOUT.TOWER_LEFT + 2; 
        const boundaryE = LAYOUT.TOWER_RIGHT - 2;
        const enemies = next.filter(e => e.team !== u.team && !e.isDead && (e.team === 'player' ? e.position <= boundaryE : e.position >= boundaryP));
        let target: ExtendedSlimeUnit | null = null;
        let minDist = 1000;
        
        enemies.forEach(e => {
          const d = Math.abs(u.position - e.position);
          if (d < minDist) { minDist = d; target = e; }
        });

        const towerDist = Math.abs(u.position - enTower);
        const isTargetingTower = !target && towerDist <= u.range; 
        const inRange = (target && minDist <= u.range) || isTargetingTower;

        if (command === 'defend') {
            if (inRange) {
               if (time - u.lastAttackTime > 1200) {
                  performAttack(u, target, enTower, time, projectilesRef);
               }
            }
        } else {
            if (inRange) {
               if (time - u.lastAttackTime > 1200) {
                  performAttack(u, target, enTower, time, projectilesRef);
               }
            } else {
               const dir = u.team === 'player' ? 1 : -1;
               u.position += dir * u.speed * (dt / 16);
            }
        }
      });
      
      if (projectilesRef.current.length > 0) {
         setProjectiles(p => [...p, ...projectilesRef.current]);
         projectilesRef.current = [];
      }
      return [...next, ...newSummons].filter(u => u.health > 0 && !toRemove.has(u.id));
    });

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
                      const isRetreatingUnit = u.team === 'player' && gameStateRef.current.playerCommand === 'retreat';
                      if (isRetreatingUnit) {
                          u.health = Math.max(1, u.health - p.damage);
                      } else {
                          u.health -= p.damage; 
                      }
                      if (p.type === 'arrow') u.stuckArrows = (u.stuckArrows || 0) + 1; 
                      hit = true; 
                   }
                }
              });
              return uPrev;
            });
          }
          if (!hit && p.y > -10 && p.x > 0 && p.x < LAYOUT.WORLD_WIDTH) next.push(p);
        });
        return next;
    });

    gameLoopRef.current = requestAnimationFrame(update);
  }, [gameResult, isStarting]); // Removed viewportWidth dep

  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(update);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [update]);

  useEffect(() => {
    if (gameResult) return;
    if (enemyHP <= 0) { setGameResult('win'); setTimeout(onWin, 4000); }
    if (playerHP <= 0) { setGameResult('lose'); setTimeout(onLose, 4000); }
  }, [enemyHP, playerHP, gameResult, onWin, onLose]);

  const performAttack = (u: ExtendedSlimeUnit, target: ExtendedSlimeUnit | null, enTower: number, time: number, projRef: any) => {
      if (u.type === 'archer' || (u.type === 'mage' && !u.isMini)) {
         const tX = target ? target.position : enTower;
         const travelDistance = Math.abs(tX - u.position);
         const travelTime = travelDistance * 2 + 10;
         const vx = (tX - u.position) / travelTime;
         const vy = 0.5 * GRAVITY * travelTime;
         projRef.current.push({
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
  };

  const currentPop = units.filter(u => u.team === 'player').length + spawnQueue.filter(q => q.team === 'player').length;
  const isPlayerMining = units.some(u => u.team === 'player' && u.type === 'miner' && u.isMining);
  const isEnemyMining = units.some(u => u.team === 'enemy' && u.type === 'miner' && u.isMining);

  const upgradeAvailable = playerTowerLevel < 3;
  const nextUpgrade = upgradeAvailable ? TOWER_UPGRADES[playerTowerLevel] : null;

  // Derived Zoom Scale for styles
  const zoomScale = 100 / viewportWidth; 

  // Helper for camera button styles
  const getCameraBtnStyle = (mode: CameraMode, activeColor: string, activeBg: string) => {
    const isActive = cameraMode === mode;
    return `w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all active:scale-95 touch-manipulation ${
      isActive 
      ? `${activeBg} ${activeColor} shadow-[0_0_15px_currentColor] border-white/50 scale-110` 
      : `${activeColor.replace('text-', 'text-opacity-60 text-')} border-white/10 bg-slate-800/50 hover:bg-slate-700`
    } border`;
  };

  return (
    <div 
      className="w-full h-full bg-black flex items-center justify-center overflow-hidden"
      style={{ touchAction: 'none' }} // Prevent scrolling on mobile
      onWheel={handleWheel}
    >
      <div 
        className={`relative w-full h-auto aspect-video max-h-screen bg-slate-900 overflow-hidden shadow-2xl border-y-2 border-slate-800 ${cameraMode === 'manual' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        
        {/* Parallax Background Layers - Scaled by Zoom */}
        <div className="absolute inset-0 z-0 bg-[#0f172a] pointer-events-none">
           <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-[#701a75]"></div>
           <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
           
           <div className="absolute bottom-[21%] left-0 h-[45%] text-indigo-300/10 pointer-events-none transition-transform duration-100 ease-linear"
                style={{ width: `${800 * zoomScale}%`, transform: `translateX(${-cameraX * 0.2}%)` }}>
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 4800 300">
                 <path d="M0,200 C600,100 1200,250 2400,120 C3600,250 4200,100 4800,200 L4800,300 L0,300 Z" fill="currentColor"/>
              </svg>
           </div>
           
           <div className="absolute bottom-[21%] left-0 h-[25%] text-slate-900 pointer-events-none transition-transform duration-100 ease-linear"
                style={{ width: `${600 * zoomScale}%`, transform: `translateX(${-cameraX * 0.5}%)` }}>
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 3600 200">
                 <path d="M0,180 C450,150 900,190 1800,160 C2700,130 3150,170 3600,180 L3600,200 L0,200 Z" fill="currentColor"/>
              </svg>
           </div>
        </div>

        {/* Scrolling World Container - Width dynamically adjusts with zoom */}
        <div className="absolute inset-0 z-10 pointer-events-none transition-transform duration-100 ease-linear"
             style={{ transform: `translateX(${-cameraX / 4}%)`, width: `${LAYOUT.WORLD_WIDTH * zoomScale}%` }}>
           
           <div className="absolute left-0 right-0 shadow-[0_-5px_30px_rgba(0,0,0,0.6)] z-0" style={{ bottom: 0, height: `${LAYOUT.LANE_BOTTOM}%` }}>
                <div className="w-full h-full bg-gradient-to-b from-[#1e293b] to-[#020617] border-t border-white/5 relative overflow-hidden">
                   <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                </div>
           </div>

           <ResourceCrystal x={LAYOUT.TOWER_LEFT + LAYOUT.ROCK_OFFSET} active={isPlayerMining} />
           <ResourceCrystal x={LAYOUT.TOWER_RIGHT - LAYOUT.ROCK_OFFSET} active={isEnemyMining} />

           <div className="absolute" style={{ left: `${LAYOUT.TOWER_LEFT / 4}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
              <TowerVisual team="player" hp={playerHP} maxHp={playerMaxHP} towerLevel={playerTowerLevel} />
           </div>
           <div className="absolute" style={{ left: `${LAYOUT.TOWER_RIGHT / 4}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
              <TowerVisual team="enemy" hp={enemyHP} maxHp={2000 + level*200} towerLevel={1 + Math.floor(level/10)} />
           </div>

           {units.map(u => (
             <div key={u.id} className="absolute transition-all duration-100 ease-linear" style={{ left: `${u.position / 4}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
                <div className={`flex flex-col items-center justify-end transition-transform duration-300 ${
                    (u.team === 'player' && gameStateRef.current.playerCommand !== 'retreat') || (u.team === 'enemy') 
                    ? '' 
                    : 'scale-x-[-1]'
                }`}>
                   <div className={`w-[4vw] h-[0.5vw] bg-black/50 rounded-full mb-[0.5vw] overflow-hidden ${u.team === 'enemy' ? 'scale-x-[-1]' : ''} ${u.isBigSlime ? 'w-[7vw] mb-[1vw]' : ''} ${u.isMini ? 'w-[2.5vw]' : ''}`}>
                      <div className={`h-full ${u.team === 'player' ? 'bg-sky-400' : 'bg-rose-500'}`} style={{ width: `${(u.health/u.maxHealth)*100}%` }}></div>
                   </div>
                   <UnitRenderer unit={u} towerLevel={u.team === 'player' ? playerTowerLevel : 1} command={u.team === 'player' ? playerCommand : 'attack'} />
                </div>
             </div>
           ))}

           {projectiles.map(p => (
              <div key={p.id} className="absolute transition-all duration-100 ease-linear" style={{ left: `${p.x / 4}%`, bottom: `${LAYOUT.LANE_BOTTOM + p.y}%` }}>
                 {p.type === 'arrow' ? (
                    <div className={`w-[1.5vw] h-[0.3vw] bg-white rounded-full shadow-sm origin-center ${p.vx > 0 ? 'rotate-[-10deg]' : 'rotate-[10deg]'}`}>
                       <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[0.4vw] h-[0.4vw] bg-slate-300 rotate-45"></div>
                    </div>
                 ) : (
                    <div className="w-[0.8vw] h-[0.8vw] bg-purple-400 rounded-full shadow-[0_0_10px_#a855f7] animate-pulse"></div>
                 )}
              </div>
           ))}

           {floatingTexts.map(ft => (
              <div key={ft.id} className="absolute text-[0.8vw] font-black text-amber-400 animate-float" style={{ left: `${ft.x / 4}%`, bottom: `${LAYOUT.LANE_BOTTOM + ft.y}%` }}>
                 <div className="flex items-center space-x-1">
                    <Gem size={12} />
                    <span>{ft.text}</span>
                 </div>
              </div>
           ))}
        </div>

        {/* HUD Overlay */}
        <div className="absolute inset-0 z-50 pointer-events-none flex flex-col justify-between safe-area-inset p-2 md:p-4">
           
           {/* TOP ROW */}
           <div className="flex justify-between items-start w-full">
              {/* Top Left: Resources */}
              <div className="pointer-events-auto flex flex-col items-start gap-2">
                  <div className="bg-slate-900/90 backdrop-blur rounded-full px-3 py-1.5 border border-white/10 flex items-center gap-3 shadow-lg">
                      <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold text-white border border-white/20 shadow-inner">PI</div>
                      <div className="flex flex-col leading-none">
                        <span className="text-[10px] text-white/60 font-bold tracking-wider">COMMANDER</span>
                        <span className="text-xs font-black text-white">{playerStats.username || "PLAYER"}</span>
                      </div>
                  </div>
                  <div className="bg-slate-900/90 backdrop-blur rounded-2xl px-3 py-2 border border-white/10 flex items-center gap-4 shadow-lg">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">🪨</span>
                        <span className="text-sm font-black text-amber-400 header-font tracking-wide">{playerGold}</span>
                      </div>
                      <div className="w-px h-4 bg-white/20"></div>
                      <div className="flex items-center gap-1.5">
                          <Users size={14} className="text-white/60" />
                          <span className={`text-sm font-bold header-font ${currentPop >= MAX_POP ? 'text-rose-400' : 'text-white'}`}>{currentPop}/{MAX_POP}</span>
                      </div>
                  </div>
              </div>

              {/* Top Right: Camera */}
              <div className="pointer-events-auto flex gap-2">
                  <div className="bg-slate-900/90 backdrop-blur rounded-full p-1.5 border border-white/10 flex items-center gap-1.5 shadow-lg">
                      <button onClick={() => handleCameraJump('player')} className={getCameraBtnStyle('player', 'text-sky-300', 'bg-sky-500/20')}>
                          <Castle size={14} />
                      </button>
                      <button onClick={() => handleCameraJump('combat')} className={getCameraBtnStyle('combat', 'text-amber-300', 'bg-amber-500/20')}>
                          <Swords size={14} />
                      </button>
                      <button onClick={() => handleCameraJump('enemy')} className={getCameraBtnStyle('enemy', 'text-rose-300', 'bg-rose-500/20')}>
                          <Skull size={14} />
                      </button>
                  </div>
              </div>
           </div>

           {/* BOTTOM ROW */}
           <div className="flex justify-between items-end w-full">
              {/* Bottom Left: Commands */}
              <div className="pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-xl flex gap-4">
                 <button onClick={() => setPlayerCommand('attack')} className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border-2 transition-all active:scale-95 touch-manipulation ${playerCommand === 'attack' ? 'bg-rose-600 border-white shadow-rose-500/50' : 'bg-slate-800 border-white/10 text-white/30'}`}>
                    <Sword size={24} className={playerCommand === 'attack' ? 'text-white animate-pulse' : ''} />
                 </button>
                 <button onClick={() => setPlayerCommand('defend')} className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border-2 transition-all active:scale-95 touch-manipulation ${playerCommand === 'defend' ? 'bg-blue-600 border-white shadow-blue-500/50' : 'bg-slate-800 border-white/10 text-white/30'}`}>
                    <Shield size={24} className={playerCommand === 'defend' ? 'text-white' : ''} />
                 </button>
                 <button onClick={() => setPlayerCommand('retreat')} className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg border-2 transition-all active:scale-95 touch-manipulation ${playerCommand === 'retreat' ? 'bg-emerald-600 border-white shadow-emerald-500/50' : 'bg-slate-800 border-white/10 text-white/30'}`}>
                    <Undo2 size={24} className={playerCommand === 'retreat' ? 'text-white' : ''} />
                 </button>
              </div>

              {/* Bottom Right: Units Deck */}
              <div className="pointer-events-auto flex items-end gap-2">
                 <div className="bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-xl flex gap-2 overflow-x-auto max-w-[50vw] no-scrollbar">
                    {/* Units */}
                    {(['miner', 'warrior', 'tank', 'archer', 'mage', 'big_slime'] as any[]).map(type => {
                        const cfg = SLIME_CONFIGS[type as SlimeType] || SLIME_CONFIGS.big_slime;
                        const cd = cooldowns[type] || 0;
                        const canAfford = playerGold >= cfg.cost;
                        
                        return (
                           <button
                              key={type}
                              onClick={() => requestSpawn(type, 'player')}
                              disabled={!canAfford || cd > 0 || isStarting}
                              className={`relative w-12 h-14 md:w-14 md:h-16 flex-shrink-0 rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 border touch-manipulation ${canAfford ? 'bg-slate-800 hover:bg-slate-700 border-white/20' : 'bg-slate-900 opacity-60 grayscale border-transparent'}`}
                           >
                              <span className="text-xl md:text-2xl drop-shadow-md mb-1">{cfg.icon}</span>
                              <div className="absolute bottom-0 w-full bg-black/60 text-[9px] md:text-[10px] text-center text-white font-bold py-0.5 rounded-b-lg">{cfg.cost}</div>
                              {cd > 0 && <div className="absolute inset-0 bg-black/70 rounded-lg flex items-center justify-center z-10"><span className="text-xs font-bold text-white">{(cd/1000).toFixed(0)}</span></div>}
                           </button>
                        );
                    })}
                 </div>

                 {/* Tower Upgrade Separate Button for Prominence */}
                 <button
                    onClick={handleTowerUpgrade}
                    disabled={!upgradeAvailable || (nextUpgrade && playerGold < nextUpgrade.cost) || isStarting}
                    className={`relative w-14 h-14 md:w-16 md:h-16 rounded-2xl flex flex-col items-center justify-center transition-all active:scale-95 border-2 shadow-xl touch-manipulation ${upgradeAvailable && nextUpgrade && playerGold >= nextUpgrade.cost ? 'bg-amber-600 border-amber-300 shadow-amber-500/40 animate-pulse-slow' : 'bg-slate-900 border-white/10 opacity-80 grayscale'}`}
                 >
                     <ShieldPlus size={20} className="text-white mb-0.5" />
                     <span className="text-[9px] font-black text-white uppercase leading-none">{upgradeAvailable ? 'UPGR' : 'MAX'}</span>
                     {upgradeAvailable && nextUpgrade && (
                        <div className="absolute -top-2 -right-2 bg-black/80 text-amber-400 text-[9px] px-1.5 py-0.5 rounded-full border border-amber-500/50 font-bold">
                            {nextUpgrade.cost}
                        </div>
                     )}
                 </button>
              </div>
           </div>

        </div>

        {/* Loading Overlay */}
        {isStarting && (
          <div className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center">
             <div className="text-white text-3xl font-black italic tracking-widest header-font mb-4">PREPARING FOR BATTLE...</div>
             <div className="text-slate-400 text-sm max-w-md text-center">"{aiTip || "Scouting enemy lines..."}"</div>
          </div>
        )}
      </div>

      <style>{`
          @keyframes rainbow-move { 
            0% { background-position: 0% 50%; }
            100% { background-position: 200% 50%; }
          }
          @keyframes shimmer-slide {
            0% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateX(200%) rotate(45deg); opacity: 0; }
          }
          @keyframes tower-idle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02, 0.98); } }
          @keyframes rainbow-rock-pulse {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 16px rgba(168, 85, 247, 0.8)); transform: scale(1.02); }
          }
          @keyframes high-shimmer {
            0%, 100% { filter: hue-rotate(0deg) brightness(1); }
            50% { filter: hue-rotate(90deg) brightness(1.5); }
          }
          @keyframes rainbow-shard-pop {
            0% { transform: translate(0,0) rotate(0deg) scale(0); opacity: 1; }
            100% { transform: translate(var(--tx), var(--ty)) rotate(var(--r)) scale(0); opacity: 0; }
          }
          @keyframes mining-swing {
             0% { transform: rotate(15deg) translateX(0); }
             50% { transform: rotate(-70deg) translateX(-0.3vw); }
             100% { transform: rotate(15deg) translateX(0); }
          }
          @keyframes slash {
             0% { transform: rotate(0deg) translate(0,0); }
             25% { transform: rotate(45deg) translate(20%, -20%); }
             50% { transform: rotate(-45deg) translate(-20%, 20%); }
             100% { transform: rotate(0deg) translate(0,0); }
          }
          .safe-area-inset {
             padding-top: max(1rem, env(safe-area-inset-top));
             padding-bottom: max(1rem, env(safe-area-inset-bottom));
             padding-left: max(1rem, env(safe-area-inset-left));
             padding-right: max(1rem, env(safe-area-inset-right));
          }
      `}</style>
    </div>
  );
};

export default Battlefield;