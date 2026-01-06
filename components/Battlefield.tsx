import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerStats, SlimeUnit, SlimeType, Projectile } from '../types';
import { SLIME_CONFIGS, getThemeForLevel } from '../constants';
import { Sword, Undo2, Users, ShieldPlus, Gem, ChevronUp } from 'lucide-react';
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

const TOWER_UPGRADES = [
  { cost: 0, hpBonus: 0, label: "LVL 1" },
  { cost: 500, hpBonus: 1000, label: "LVL 2" },
  { cost: 1000, hpBonus: 2000, label: "MAX LVL" },
];

const MINER_CAPACITY = 20;
const MINER_HIT_INTERVAL = 1200;

interface ExtendedSlimeUnit extends SlimeUnit {
  carriedGold?: number;
  lastMineTime?: number;
  target?: 'rock' | 'tower';
}

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
  
  const [units, setUnits] = useState<ExtendedSlimeUnit[]>([]);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [spawnQueue, setSpawnQueue] = useState<{type: string, team: 'player'|'enemy'}[]>([]);
  const [isRetreating, setIsRetreating] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  
  const gameLoopRef = useRef<number>(null);
  const lastUpdateRef = useRef<number>(performance.now());
  const projectilesRef = useRef<Projectile[]>([]);

  const gameStateRef = useRef({
    units,
    enemyGold,
    playerGold,
    gameResult,
    isStarting,
    spawnQueue,
    playerTowerLevel
  });

  useEffect(() => {
    gameStateRef.current = { units, enemyGold, playerGold, gameResult, isStarting, spawnQueue, playerTowerLevel };
  }, [units, enemyGold, playerGold, gameResult, isStarting, spawnQueue, playerTowerLevel]);

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
          position: next.team === 'player' ? LAYOUT.TOWER_LEFT : LAYOUT.TOWER_RIGHT,
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

  const handleTowerUpgrade = () => {
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
      const dangerClose = playerUnits.some(u => u.position > 60);
      
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
      } else if (enemyMiners < 2 && enemyGold >= SLIME_CONFIGS.miner.cost && Math.random() > 0.3) {
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

    setUnits(prev => {
      const next = prev.map(u => ({ ...u }));
      const toRemove = new Set<string>();
      const newSummons: ExtendedSlimeUnit[] = [];

      next.forEach(u => {
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
        const rockPos = u.team === 'player' ? LAYOUT.TOWER_LEFT + 15 : LAYOUT.TOWER_RIGHT - 15;
        const isRetreat = (u.team === 'player' && isRetreating) || u.isRetreating;

        if (isRetreat) {
          if (Math.abs(u.position - myTower) < 2) { toRemove.add(u.id); return; }
          const dir = u.team === 'player' ? -1 : 1;
          u.position += dir * u.speed * 2 * (dt / 16);
          return;
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
        let minDist = 100;
        enemies.forEach(e => {
          const d = Math.abs(u.position - e.position);
          if (d < minDist) { minDist = d; target = e; }
        });

        const towerDist = Math.abs(u.position - enTower);
        const inRange = (target && minDist <= u.range) || towerDist <= u.range;

        if (inRange) {
           if (time - u.lastAttackTime > 1200) {
              if (u.type === 'archer' || (u.type === 'mage' && !u.isMini)) {
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
                   if (!isSafe) { u.health -= p.damage; if (p.type === 'arrow') u.stuckArrows = (u.stuckArrows || 0) + 1; hit = true; }
                }
              });
              return uPrev;
            });
          }
          if (!hit && p.y > -5 && p.x > 0 && p.x < 100) next.push(p);
        });
        return next;
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
  const isPlayerMining = units.some(u => u.team === 'player' && u.type === 'miner' && u.isMining);
  const isEnemyMining = units.some(u => u.team === 'enemy' && u.type === 'miner' && u.isMining);

  const upgradeAvailable = playerTowerLevel < 3;
  const nextUpgrade = upgradeAvailable ? TOWER_UPGRADES[playerTowerLevel] : null;

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <div className="relative w-full h-auto aspect-video max-h-screen bg-slate-900 overflow-hidden shadow-2xl border-y-2 border-slate-800">
        
        {/* Background Layers */}
        <div className="absolute inset-0 z-0 bg-[#0f172a]">
           <div className="absolute inset-0 bg-gradient-to-b from-[#1e1b4b] via-[#312e81] to-[#701a75]"></div>
           <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
           <div className="absolute bottom-[21%] left-0 right-0 h-[45%] text-indigo-300/20 pointer-events-none">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 300">
                 <path d="M0,200 C300,100 600,250 1200,120 L1200,300 L0,300 Z" fill="currentColor"/>
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
          <ResourceCrystal x={LAYOUT.TOWER_LEFT + 15} active={isPlayerMining} />
          <ResourceCrystal x={LAYOUT.TOWER_RIGHT - 15} active={isEnemyMining} />

          <div className="absolute" style={{ left: `${LAYOUT.TOWER_LEFT}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="player" hp={playerHP} maxHp={playerMaxHP} towerLevel={playerTowerLevel} />
          </div>
          <div className="absolute" style={{ left: `${LAYOUT.TOWER_RIGHT}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
             <TowerVisual team="enemy" hp={enemyHP} maxHp={2000 + level*200} towerLevel={1 + Math.floor(level/10)} />
          </div>

          {units.map(u => (
            <div key={u.id} className="absolute transition-all duration-100 ease-linear" style={{ left: `${u.position}%`, bottom: `${LAYOUT.LANE_BOTTOM}%`, transform: 'translateX(-50%)' }}>
               <div className={`flex flex-col items-center justify-end ${u.team === 'player' ? '' : 'scale-x-[-1]'}`}>
                  <div className={`w-[4vw] h-[0.5vw] bg-black/50 rounded-full mb-[0.5vw] overflow-hidden ${u.team === 'enemy' ? 'scale-x-[-1]' : ''} ${u.isBigSlime ? 'w-[7vw] mb-[1vw]' : ''} ${u.isMini ? 'w-[2.5vw]' : ''}`}>
                     <div className={`h-full ${u.team === 'player' ? 'bg-sky-400' : 'bg-rose-500'}`} style={{ width: `${(u.health/u.maxHealth)*100}%` }}></div>
                  </div>
                  <UnitRenderer unit={u} towerLevel={u.team === 'player' ? playerTowerLevel : 1} />
               </div>
            </div>
          ))}

          {projectiles.map(p => (
             <div key={p.id} className="absolute" style={{ left: `${p.x}%`, bottom: `${LAYOUT.LANE_BOTTOM + p.y}%` }}>
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
             <div key={ft.id} className="absolute text-[0.8vw] font-black text-amber-400 animate-float" style={{ left: `${ft.x}%`, bottom: `${LAYOUT.LANE_BOTTOM + ft.y}%` }}>
                <div className="flex items-center space-x-1">
                   <Gem size={12} />
                   <span>{ft.text}</span>
                </div>
             </div>
          ))}
        </div>

        {/* HUD */}
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
                 
                 <button
                    onClick={handleTowerUpgrade}
                    disabled={!upgradeAvailable || (nextUpgrade && playerGold < nextUpgrade.cost) || isStarting}
                    className={`relative w-[4vw] h-[4.5vw] max-w-[48px] max-h-[54px] rounded-lg flex flex-col items-center justify-center transition-all active:scale-95 border ${upgradeAvailable && nextUpgrade && playerGold >= nextUpgrade.cost ? 'bg-amber-900/60 hover:bg-amber-800 border-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'bg-slate-900 opacity-60 grayscale border-transparent'}`}
                 >
                    <div className="flex flex-col items-center -mt-1">
                      <ShieldPlus className={`w-[1.8vw] h-[1.8vw] max-w-[20px] max-h-[20px] mb-1 ${upgradeAvailable && nextUpgrade && playerGold >= nextUpgrade.cost ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                      <div className="flex space-x-[2px] mb-1">
                        {[1, 2, 3].map(lvl => (
                          <div key={lvl} className={`w-[0.8vw] max-w-[10px] h-[3px] rounded-full transition-all duration-500 ${playerTowerLevel >= lvl ? 'bg-amber-400' : 'bg-black/40'}`} />
                        ))}
                      </div>
                      <span className="text-[0.6vw] font-black text-white/80 tracking-tighter uppercase">{upgradeAvailable ? `LVL ${playerTowerLevel}` : 'MAX'}</span>
                    </div>
                    {upgradeAvailable && nextUpgrade && (
                      <div className="absolute bottom-0 w-full bg-black/50 text-[0.8vw] max-text-[9px] text-center text-white font-bold py-[1px] rounded-b-lg leading-none">{nextUpgrade.cost}</div>
                    )}
                 </button>
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

        {/* Loading Overlay */}
        {isStarting && (
          <div className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center">
             <div className="text-white text-3xl font-black italic tracking-widest header-font mb-4">PREPARING FOR BATTLE...</div>
             <div className="text-slate-400 text-sm max-w-md text-center">"{aiTip || "Scouting enemy lines..."}"</div>
          </div>
        )}
      </div>

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
          @keyframes tower-idle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02, 0.98); } }
          @keyframes tower-hit { 
            0% { transform: scale(1) translate(0, 0); } 
            25% { transform: scale(1.1, 0.9) translate(-2px, 2px); } 
            50% { transform: scale(0.9, 1.1) translate(2px, -2px); } 
            75% { transform: scale(1.05, 0.95) translate(-1px, 1px); } 
            100% { transform: scale(1) translate(0, 0); } 
          }
          @keyframes upgrade-aura {
            0% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.6); opacity: 1; transform: scale(0.8); }
            100% { box-shadow: 0 0 60px 40px rgba(251, 191, 36, 0); opacity: 0; transform: scale(1.5); }
          }
          @keyframes rainbow-rock-pulse {
            0%, 100% { filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 16px rgba(168, 85, 247, 0.8)); transform: scale(1.02); }
          }
          @keyframes high-shimmer {
            0%, 100% { filter: hue-rotate(0deg) brightness(1); }
            50% { filter: hue-rotate(90deg) brightness(1.5); }
          }
          @keyframes micro-sparkle {
            0%, 100% { opacity: 0; transform: scale(0); }
            50% { opacity: 1; transform: scale(1); }
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
      `}</style>
    </div>
  );
};

const ResourceCrystal: React.FC<{ x: number; active: boolean }> = ({ x, active }) => (
    <div 
      className="absolute bottom-[20%] z-0 pointer-events-none transition-all duration-300" 
      style={{ 
        left: `${x}%`, 
        transform: `translateX(-50%) scale(${active ? 1.15 : 1})`, 
        filter: active ? 'brightness(1.3) contrast(1.2)' : 'brightness(1)' 
      }}
    >
      {/* Glow Aura */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[12vw] h-[12vw] bg-gradient-radial from-purple-500/40 to-transparent blur-xl ${active ? 'opacity-100 scale-125' : 'opacity-50 scale-100'} transition-all duration-500`}></div>

      <div className="relative w-[8vw] h-[8vw] flex items-end justify-center">
         {/* Main Crystal Formation */}
         <div className={`relative w-full h-full ${active ? 'animate-[rainbow-rock-pulse_2s_infinite]' : ''}`}>
            
            {/* Back Shards (Darker) */}
            <div className="absolute bottom-0 left-[10%] w-[30%] h-[70%] bg-gradient-to-t from-indigo-900 via-purple-800 to-fuchsia-600 rotate-[-25deg] origin-bottom shadow-lg" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>
            <div className="absolute bottom-0 right-[15%] w-[25%] h-[60%] bg-gradient-to-t from-blue-900 via-indigo-700 to-cyan-500 rotate-[30deg] origin-bottom shadow-lg" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>

            {/* Central Main Spikes */}
            <div className="absolute bottom-0 left-[35%] w-[40%] h-[95%] bg-gradient-to-b from-white via-pink-400 to-purple-900 rotate-[-5deg] origin-bottom z-10 shadow-[0_0_15px_rgba(232,121,249,0.5)]" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}>
               <div className="absolute inset-0 bg-white/20" style={{ clipPath: 'polygon(50% 0, 50% 100%, 0 100%)' }}></div>
            </div>
            
            {/* Front Spikes (Lighter/Translucent) */}
            <div className="absolute bottom-0 left-[20%] w-[25%] h-[50%] bg-gradient-to-t from-emerald-600 via-teal-400 to-white/80 rotate-[-45deg] origin-bottom z-20 opacity-90" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>
            <div className="absolute bottom-0 right-[25%] w-[30%] h-[65%] bg-gradient-to-t from-orange-600 via-amber-400 to-yellow-200 rotate-[15deg] origin-bottom z-20 opacity-90" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }}></div>

            {/* Floating Particles / Sparkles */}
            <div className="absolute inset-0 overflow-visible">
                {[...Array(4)].map((_, i) => (
                    <div 
                        key={i} 
                        className="absolute w-[0.6vw] h-[0.6vw] bg-white rounded-full blur-[1px] animate-pulse" 
                        style={{ 
                            top: `${20 + Math.random() * 40}%`, 
                            left: `${10 + Math.random() * 80}%`, 
                            animationDelay: `${i * 0.5}s`,
                            opacity: 0.8 
                        }} 
                    />
                ))}
            </div>

            {/* Active Mining Effect sparks */}
            {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full">
                     <div className="absolute top-0 left-1/2 w-1 h-1 bg-white shadow-[0_0_5px_white] animate-[rainbow-shard-pop_0.8s_ease-out_infinite]" style={{ '--tx': '-2vw', '--ty': '-3vw', '--r': '-45deg' } as React.CSSProperties}></div>
                     <div className="absolute top-[20%] left-[40%] w-1 h-1 bg-yellow-300 shadow-[0_0_5px_yellow] animate-[rainbow-shard-pop_0.8s_ease-out_infinite]" style={{ '--tx': '2vw', '--ty': '-2vw', '--r': '30deg', animationDelay: '0.2s' } as React.CSSProperties}></div>
                </div>
            )}
         </div>
      </div>
    </div>
);

const UnitRenderer: React.FC<{ unit: ExtendedSlimeUnit, towerLevel: number }> = ({ unit, towerLevel }) => {
   const isPlayer = unit.team === 'player';
   const isMiner = unit.type === 'miner';
   const baseSize = unit.isBigSlime ? 'w-[7vw] h-[7vw]' : (unit.isMini ? 'w-[2.5vw] h-[2.5vw]' : 'w-[4vw] h-[4vw]');
   
   const colorClass = isMiner ? 'bg-emerald-500' : (isPlayer ? 'bg-sky-400' : 'bg-rose-500');

   return (
      <div className={`relative ${baseSize} ${colorClass} rounded-t-[45%] rounded-b-[20%] shadow-lg border-2 border-white/10 flex items-center justify-center ${unit.isMining ? 'animate-bounce' : 'animate-squish'} transition-all duration-300`}>
         
         {/* TOWER UPGRADE AURA SYSTEM FOR MINER */}
         {isMiner && towerLevel >= 2 && (
             <div className={`absolute inset-[-1vw] rounded-full bg-purple-500/20 blur-md animate-pulse border border-purple-400/30 ${towerLevel === 3 ? 'bg-purple-500/40' : ''}`}>
                {towerLevel === 3 && (
                    <div className="absolute inset-0 overflow-hidden">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="absolute text-[0.6vw] text-white animate-sparkle" style={{ left: `${Math.random()*100}%`, top: `${Math.random()*100}%`, animationDelay: `${i*0.2}s` }}>✦</div>
                        ))}
                    </div>
                )}
             </div>
         )}

         {/* MINER SPECIFIC VISUALS */}
         {isMiner && (
             <>
                 {/* 1. Yellow Safety Helmet */}
                 <div className="absolute -top-[12%] w-[85%] h-[35%] bg-yellow-400 rounded-t-full border-b-2 border-yellow-600 z-10 flex items-center justify-center shadow-md">
                     <div className="w-[30%] h-[50%] bg-slate-800 rounded-sm border border-slate-600 flex items-center justify-center relative overflow-hidden mt-0.5">
                         <div className={`w-[60%] h-[60%] rounded-full ${unit.isMining ? 'bg-white shadow-[0_0_10px_white]' : 'bg-white/40'}`}></div>
                     </div>
                 </div>

                 {/* 2. Mining Backpack - REPOSITIONED LOWER AND FURTHER BACK (Behind body) */}
                 <div className="absolute bottom-[2%] left-[-15%] w-[1.4vw] h-[2vw] bg-amber-900 rounded-md border-2 border-amber-950 z-[-1] rotate-[-8deg] shadow-lg">
                    {(unit.carriedGold || 0) > 0 && (
                        <div className="absolute -top-[0.5vw] left-1/2 -translate-x-1/2 w-[0.7vw] h-[0.7vw] bg-amber-400 rounded-sm border border-amber-600 shadow-sm animate-bounce flex items-center justify-center text-[0.4vw]">✨</div>
                    )}
                 </div>

                 {/* 3. Small Arm Nub & PICKAXE (Attached and Scaled down) */}
                 <div className={`absolute -right-[0.5vw] top-[45%] z-40 flex items-center transition-transform duration-200 ${unit.isMining ? 'animate-[mining-swing_0.5s_ease-in-out_infinite]' : 'rotate-[15deg]'}`}>
                    {/* Small Arm Nub */}
                    <div className="w-[0.9vw] h-[0.5vw] bg-emerald-600 rounded-full border border-white/10 shadow-sm"></div>
                    
                    {/* Resized Pickaxe (Attached to arm nub) */}
                    <div className="absolute left-[0.4vw] top-[-0.8vw] w-[1.8vw] h-[1.8vw] origin-bottom-left">
                        {/* Wooden Shaft */}
                        <div className="absolute bottom-0 left-[20%] w-[12%] h-[95%] bg-[#5d3a1a] rounded-full border border-black/40 shadow-sm"></div>
                        
                        {/* Curved Pick Head */}
                        <div className="absolute top-[5%] left-[-0.6vw] w-[1.6vw] h-[0.4vw] flex items-center justify-center">
                            <div className="absolute right-1/2 w-[0.9vw] h-[0.3vw] bg-slate-400 rounded-l-full rotate-[-25deg] origin-right border-t border-slate-200"></div>
                            <div className="absolute left-1/2 w-[0.9vw] h-[0.3vw] bg-slate-400 rounded-r-full rotate-[25deg] origin-left border-t border-slate-200"></div>
                            <div className="w-[0.4vw] h-[0.4vw] bg-slate-500 rounded-full z-10"></div>
                        </div>
                    </div>
                 </div>

                 {/* 4. Worker Details */}
                 <div className="absolute bottom-[10%] left-[10%] w-[0.5vw] h-[0.5vw] bg-black/20 rounded-full blur-[1px]"></div>
                 <div className="absolute bottom-[15%] right-[10%] w-[0.4vw] h-[0.4vw] bg-black/15 rounded-full blur-[1px]"></div>
             </>
         )}

         {/* Other Unit Visuals */}
         {!isMiner && (
             <>
                {unit.isBigSlime && <div className="absolute inset-2 bg-red-500/30 rounded-full blur-md animate-pulse"></div>}
                {unit.type === 'mage' && (
                    <>
                    <div className="absolute inset-[-4px] rounded-full border border-purple-400/50 opacity-50 animate-ping"></div>
                    <div className="absolute w-[40%] h-[40%] bg-purple-200 rotate-45 border border-white shadow-[0_0_10px_#d8b4fe]"></div>
                    </>
                )}
                {(unit.type === 'warrior' || unit.type === 'tank') && (
                    <div className="absolute bottom-0 w-full h-[40%] bg-slate-300 rounded-b-[18%] border-t-2 border-yellow-400/50 flex justify-center overflow-hidden">
                    <div className="w-[80%] h-full bg-slate-400/50 skew-x-12"></div>
                    </div>
                )}
             </>
         )}

         {/* Face - ALWAYS ON TOP OF HELMET/BODY */}
         <div className="relative z-20 flex flex-col items-center translate-y-[-10%]">
            <div className="flex space-x-[0.5vw]">
               <div className="w-[0.6vw] h-[0.6vw] bg-slate-900 rounded-full relative overflow-hidden">
                  <div className="absolute top-[20%] right-[20%] w-[35%] h-[35%] bg-white rounded-full"></div>
               </div>
               <div className="w-[0.6vw] h-[0.6vw] bg-slate-900 rounded-full relative overflow-hidden">
                  <div className="absolute top-[20%] right-[20%] w-[35%] h-[35%] bg-white rounded-full"></div>
               </div>
            </div>
            {isMiner && <div className="w-[0.4vw] h-[0.2vw] bg-slate-900/60 rounded-full mt-[0.2vw]"></div>}
         </div>
      </div>
   );
};

const TowerVisual: React.FC<{ team: 'player'|'enemy'; hp: number; maxHp: number; towerLevel: number }> = ({ team, hp, maxHp, towerLevel }) => {
   const isPlayer = team === 'player';
   const [isHit, setIsHit] = useState(false);
   const prevHp = useRef(hp);
   useEffect(() => {
     if (hp < prevHp.current) {
       setIsHit(true);
       setTimeout(() => setIsHit(false), 400);
     }
     prevHp.current = hp;
   }, [hp]);
   
   const theme = isPlayer 
     ? { 
         gradient: 'from-sky-300 via-sky-400 to-sky-600', 
         border: 'border-sky-200', 
         blush: 'bg-rose-400/40',
         crown: 'text-amber-300'
       } 
     : { 
         gradient: 'from-rose-400 via-rose-500 to-rose-700', 
         border: 'border-rose-200', 
         blush: 'bg-rose-300/40',
         crown: 'text-slate-300'
       };

   const scale = towerLevel === 1 ? 'scale-100' : (towerLevel === 2 ? 'scale-110' : 'scale-120');

   return (
      <div className={`relative flex flex-col items-center justify-end w-[10vw] h-[12vw] pointer-events-none transition-transform duration-500 ${scale}`}>
         <div className="absolute -top-[20%] w-[120%] flex flex-col items-center z-20">
            <div className="w-full h-[0.8vw] bg-black/50 backdrop-blur-sm rounded-full border border-white/20 p-[1px] shadow-sm">
                <div className={`h-full rounded-full transition-all duration-200 ease-out ${isPlayer ? 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]'}`} 
                     style={{ width: `${Math.max(0, (hp/maxHp)*100)}%` }}></div>
            </div>
            <span className="text-[0.8vw] font-black text-white drop-shadow-md mt-[0.2vw]">{Math.ceil(hp)}/{maxHp}</span>
         </div>

         <div className={`relative w-full h-full ${isHit ? 'animate-bounce' : 'animate-idle'}`}>
            <div className={`absolute -top-[24%] left-1/2 -translate-x-1/2 text-[4vw] drop-shadow-xl z-10 ${theme.crown}`}>
              {towerLevel >= 3 ? '⚔️👑⚔️' : (towerLevel === 2 ? '🛡️👑🛡️' : '👑')}
            </div>
            
            <div className={`w-full h-full rounded-t-[45%] rounded-b-[20%] bg-gradient-to-b ${theme.gradient} border-[0.3vw] ${theme.border} shadow-2xl relative overflow-hidden flex flex-col items-center pt-[20%]`}>
               {towerLevel >= 2 && (
                 <div className="absolute bottom-0 inset-x-0 h-1/3 bg-slate-900/30 backdrop-blur-sm border-t-2 border-amber-400/50"></div>
               )}
               <div className="absolute top-[10%] left-[10%] w-[30%] h-[15%] bg-white/50 rounded-full rotate-[-20deg] blur-[1px]"></div>
               <div className="relative z-10 flex flex-col items-center">
                  <div className="flex space-x-[1.5vw]">
                     <div className="w-[2vw] h-[2vw] bg-slate-900 rounded-full relative overflow-hidden">
                        <div className="absolute top-[15%] right-[15%] w-[0.8vw] h-[0.8vw] bg-white rounded-full"></div>
                        {isHit && <div className="absolute inset-0 bg-red-500/50 animate-pulse"></div>}
                     </div>
                     <div className="w-[2vw] h-[2vw] bg-slate-900 rounded-full relative overflow-hidden">
                        <div className="absolute top-[15%] right-[15%] w-[0.8vw] h-[0.8vw] bg-white rounded-full"></div>
                        {isHit && <div className="absolute inset-0 bg-red-500/50 animate-pulse"></div>}
                     </div>
                  </div>
                  <div className="w-full flex justify-between px-[-1vw] mt-[0.2vw]">
                     <div className={`w-[1.2vw] h-[0.6vw] ${theme.blush} rounded-full blur-[1px]`}></div>
                     <div className={`w-[1.2vw] h-[0.6vw] ${theme.blush} rounded-full blur-[1px]`}></div>
                  </div>
                  <div className={`mt-[0.2vw] w-[1vw] h-[0.5vw] bg-slate-900/80 rounded-b-full transition-all duration-200 ${isHit ? 'h-[1.2vw] w-[1.2vw] rounded-full bg-slate-900' : ''}`}></div>
               </div>
            </div>
         </div>
      </div>
   );
};

export default Battlefield;