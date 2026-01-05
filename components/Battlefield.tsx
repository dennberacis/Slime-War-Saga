
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlayerStats, SlimeUnit, SlimeType } from '../types';
import { SLIME_CONFIGS, getThemeForLevel } from '../constants';
import { Shield, Sword, User, Zap, Timer, Activity, Pickaxe, Sparkles, Undo2, LogIn, Flame, Waves, Wind } from 'lucide-react';

interface BattlefieldProps {
  level: number;
  playerStats: PlayerStats;
  onWin: () => void;
  onLose: () => void;
}

const ROCKS = [
  { team: 'player', position: 22 },
  { team: 'enemy', position: 78 }
];

const Battlefield: React.FC<BattlefieldProps> = ({ level, playerStats, onWin, onLose }) => {
  const [playerBlueCrystals, setPlayerBlueCrystals] = useState(250);
  const [enemyBlueCrystals, setEnemyBlueCrystals] = useState(200);
  const [playerTowerHP, setPlayerTowerHP] = useState(1500);
  const [enemyTowerHP, setEnemyTowerHP] = useState(1500 + (level * 200));
  const [units, setUnits] = useState<SlimeUnit[]>([]);
  const [isRetreating, setIsRetreating] = useState(false);
  const [flashBase, setFlashBase] = useState<'player' | 'enemy' | null>(null);
  
  const theme = getThemeForLevel(level);
  const isBossLevel = level % 10 === 0;

  const gameLoopRef = useRef<number>(null);
  const lastUpdateRef = useRef<number>(performance.now());

  // Economy & AI Spawner
  useEffect(() => {
    const aiInterval = setInterval(() => {
      const enemyMinerCount = units.filter(u => u.team === 'enemy' && u.type === 'miner').length;
      
      if (enemyMinerCount < (isBossLevel ? 3 : 2) && enemyBlueCrystals >= SLIME_CONFIGS.miner.cost) {
        spawnUnit('miner', 'enemy');
        return;
      }

      const combatTypes: SlimeType[] = ['warrior', 'archer', 'tank', 'mage'];
      const affordable = combatTypes.filter(t => enemyBlueCrystals >= SLIME_CONFIGS[t].cost);
      if (affordable.length > 0) {
        const type = affordable[Math.floor(Math.random() * affordable.length)];
        spawnUnit(type, 'enemy');
      }
    }, isBossLevel ? 1600 : 2200);

    const miningInterval = setInterval(() => {
      setUnits(prev => {
        let pBonus = 0;
        let eBonus = 0;
        prev.forEach(u => {
          if (u.type === 'miner' && u.isMining && !u.isRetreating) {
            if (u.team === 'player') pBonus += 8;
            else eBonus += 8;
          }
        });
        setPlayerBlueCrystals(c => c + 4 + pBonus);
        setEnemyBlueCrystals(c => c + 4 + eBonus);
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(aiInterval);
      clearInterval(miningInterval);
    };
  }, [units, enemyBlueCrystals, isBossLevel]);

  const spawnUnit = (type: SlimeType, team: 'player' | 'enemy') => {
    const config = SLIME_CONFIGS[type];
    if (team === 'player') {
      if (playerBlueCrystals < config.cost) return;
      setPlayerBlueCrystals(prev => prev - config.cost);
    } else {
      if (enemyBlueCrystals < config.cost) return;
      setEnemyBlueCrystals(prev => prev - config.cost);
    }

    const newUnit: SlimeUnit = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      health: config.hp,
      maxHealth: config.hp,
      attack: config.atk,
      speed: type === 'miner' ? 0.28 : (type === 'tank' ? 0.15 : 0.22),
      range: type === 'archer' ? 32 : (type === 'mage' ? 40 : 8),
      cost: config.cost,
      position: team === 'player' ? 6 : 94, 
      team,
      lastAttackTime: 0,
      isDead: false,
      isMining: false,
      isRetreating: false
    };

    setUnits(prev => [...prev, newUnit]);
  };

  const handleRetreatToggle = () => {
    setIsRetreating(prev => !prev);
    setUnits(prev => prev.map(u => {
      if (u.team === 'player') return { ...u, isRetreating: !isRetreating };
      return u;
    }));
  };

  const update = useCallback((time: number) => {
    const deltaTime = Math.min(32, time - lastUpdateRef.current);
    lastUpdateRef.current = time;

    setUnits(prevUnits => {
      const nextUnits = prevUnits.map(unit => ({ ...unit }));
      const toRemove = new Set<string>();
      
      nextUnits.forEach(unit => {
        const enemies = nextUnits.filter(u => u.team !== unit.team);
        let targetEnemy: SlimeUnit | null = null;
        let minDist = 100;

        enemies.forEach(enemy => {
          const dist = Math.abs(unit.position - enemy.position);
          if (dist < minDist) {
            minDist = dist;
            targetEnemy = enemy;
          }
        });

        const towerTargetPos = unit.team === 'player' ? 94 : 6;
        const distToTower = Math.abs(unit.position - towerTargetPos);
        const myTowerPos = unit.team === 'player' ? 6 : 94;

        if (unit.isRetreating) {
          const distToMyTower = Math.abs(unit.position - myTowerPos);
          if (distToMyTower < 2) {
            toRemove.add(unit.id);
            return;
          }
          const moveDir = unit.team === 'player' ? -1 : 1;
          unit.position += moveDir * unit.speed * 1.8 * (deltaTime / 16);
          return;
        }

        if (unit.type === 'miner') {
          const myRock = ROCKS.find(r => r.team === unit.team)!;
          const distToRock = Math.abs(unit.position - myRock.position);
          
          if (distToRock < 2) {
            unit.isMining = true;
            return;
          } else {
            unit.isMining = false;
            const dir = unit.position < myRock.position ? 1 : -1;
            unit.position += dir * unit.speed * (deltaTime / 16);
            return;
          }
        }

        if (minDist <= unit.range && targetEnemy) {
          if (time - unit.lastAttackTime > 1200) {
            targetEnemy.health -= unit.attack;
            unit.lastAttackTime = time;
          }
        } else if (distToTower <= unit.range) {
          if (time - unit.lastAttackTime > 1200) {
            if (unit.team === 'player') {
              setEnemyTowerHP(prev => Math.max(0, prev - unit.attack));
              setFlashBase('enemy');
              setTimeout(() => setFlashBase(null), 100);
            } else {
              setPlayerTowerHP(prev => Math.max(0, prev - unit.attack));
              setFlashBase('player');
              setTimeout(() => setFlashBase(null), 100);
            }
            unit.lastAttackTime = time;
          }
        } else {
          const moveDir = unit.team === 'player' ? 1 : -1;
          unit.position += moveDir * unit.speed * (deltaTime / 16);
          unit.position = Math.max(0, Math.min(100, unit.position));
        }
      });

      return nextUnits.filter(u => u.health > 0 && !toRemove.has(u.id));
    });

    gameLoopRef.current = requestAnimationFrame(update);
  }, [isRetreating]);

  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(update);
    return () => { if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current); };
  }, [update]);

  useEffect(() => {
    if (enemyTowerHP <= 0) onWin();
    if (playerTowerHP <= 0) onLose();
  }, [enemyTowerHP, playerTowerHP, onWin, onLose]);

  return (
    <div className={`h-full w-full flex flex-col relative overflow-hidden font-sans bg-gradient-to-b ${theme.bgColor}`}>
      {/* Anime Sky Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-10 left-[10%] w-[80%] h-1 bg-white/5 blur-3xl"></div>
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-white/10 to-transparent"></div>
          <div className="absolute top-10 right-[10%] animate-float">
             <Wind size={40} className="text-white/5 md:size-[64px]" />
          </div>
      </div>

      {/* Top HUD */}
      <div className="relative z-40 p-2 md:p-4 flex justify-between items-center bg-slate-950/80 backdrop-blur-xl border-b-2 border-indigo-500/30 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center space-x-2 md:space-x-6">
          <div className="flex flex-col">
            <div className="flex items-center space-x-1 md:space-x-3 bg-gradient-to-r from-sky-600/20 to-indigo-600/20 border border-sky-400/40 px-3 md:px-6 py-1 rounded-xl md:rounded-2xl shadow-[0_0_15px_rgba(56,189,248,0.3)]">
               <span className="text-xl md:text-3xl animate-bounce">💎</span>
               <div className="flex flex-col">
                 <span className="text-lg md:text-2xl font-black text-sky-300 header-font leading-none italic">{playerBlueCrystals}</span>
                 <span className="text-[7px] md:text-[10px] font-black text-sky-400 uppercase tracking-[0.2em]">Reserve</span>
               </div>
            </div>
          </div>
          <div className="hidden sm:flex flex-col">
             <div className="flex items-center space-x-2 md:space-x-3">
                <div className={`w-20 md:w-32 h-2 bg-slate-900 rounded-full overflow-hidden border border-sky-500/30 shadow-inner`}>
                    <div className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-500" style={{ width: `${(playerTowerHP/1500)*100}%` }}></div>
                </div>
             </div>
             <p className="text-[7px] md:text-[9px] font-black text-sky-400/60 mt-0.5 uppercase tracking-widest">Gate HP</p>
          </div>
        </div>

        <div className="text-center px-1">
          <div className="px-3 md:px-6 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full inline-block backdrop-blur-md">
             <span className="text-[8px] md:text-xs font-black text-white uppercase tracking-[0.15em] header-font">
               {theme.name.split(' ')[0]} • <span className="text-indigo-400">LV.{level}</span>
             </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-6">
           <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className={`w-20 md:w-32 h-2 bg-slate-900 rounded-full overflow-hidden border border-rose-500/30 shadow-inner`}>
                    <div className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-500" style={{ width: `${(enemyTowerHP/(1500 + level*200))*100}%` }}></div>
                </div>
             </div>
             <p className="text-[7px] md:text-[9px] font-black text-rose-400/60 mt-0.5 uppercase tracking-widest text-right">Chaos HP</p>
           </div>
           <div className="flex flex-col">
            <div className="flex items-center space-x-1 md:space-x-3 bg-gradient-to-l from-rose-600/20 to-orange-600/20 border border-rose-400/40 px-3 md:px-6 py-1 rounded-xl md:rounded-2xl shadow-[0_0_15px_rgba(244,63,94,0.3)]">
               <div className="flex flex-col items-end">
                 <span className="text-lg md:text-2xl font-black text-rose-300 header-font leading-none italic">{enemyBlueCrystals}</span>
                 <span className="text-[7px] md:text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] text-right">Enemy</span>
               </div>
               <span className="text-xl md:text-3xl opacity-50 grayscale">💎</span>
            </div>
          </div>
        </div>
      </div>

      {/* Battlefield Environment */}
      <div className="flex-1 relative overflow-hidden">
        {/* Parallax Particles */}
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
           <div className="absolute top-[10%] left-[20%] w-32 md:w-48 h-32 md:h-48 bg-indigo-500 rounded-full blur-[60px] animate-pulse"></div>
           <div className="absolute bottom-[10%] right-[20%] w-32 md:w-48 h-32 md:h-48 bg-rose-500 rounded-full blur-[60px] animate-pulse"></div>
        </div>
        
        {/* Crystal Rocks */}
        {ROCKS.map((rock, idx) => (
          <div key={idx} className="absolute bottom-20 md:bottom-28 flex flex-col items-center z-10" style={{ left: `${rock.position}%` }}>
            <div className="relative group">
               <div className="absolute inset-0 bg-sky-400 blur-lg opacity-40"></div>
               <div className="text-3xl md:text-4xl animate-float drop-shadow-[0_0_15px_rgba(56,189,248,1)]">💎</div>
               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 md:w-12 h-2 bg-sky-400/20 rounded-full blur-sm"></div>
            </div>
          </div>
        ))}

        {/* The Path - Narrower Lane */}
        <div className={`absolute bottom-0 left-0 right-0 h-24 md:h-32 ${theme.groundColor} border-t-2 border-white/10 z-0 shadow-[0_-5px_20px_rgba(0,0,0,0.4)]`}>
           <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/20"></div>
        </div>

        {/* Towers - Heroic Anime Gateways (Shortened) */}
        <Tower team="player" hp={playerTowerHP} maxHp={1500} flash={flashBase === 'player'} theme={theme} />
        <Tower team="enemy" hp={enemyTowerHP} maxHp={1500 + level*200} flash={flashBase === 'enemy'} theme={theme} />

        {/* Units - Adjusted positioning for vertical fit */}
        {units.map(unit => (
          <div 
            key={unit.id}
            className={`absolute bottom-16 md:bottom-22 transition-all duration-100 ease-linear z-30 ${unit.isRetreating ? 'scale-50 opacity-60' : ''}`}
            style={{ left: `${unit.position}%`, transform: `translateX(-50%)` }}
          >
            <div className={`flex flex-col items-center ${unit.team === 'enemy' ? 'scale-x-[-1]' : ''}`}>
              <div className="w-8 md:w-10 h-1 bg-black/60 rounded-full mb-1 overflow-hidden border border-white/20">
                <div 
                  className={`h-full transition-all duration-300 ${unit.team === 'player' ? 'bg-gradient-to-r from-sky-500 to-indigo-400' : 'bg-gradient-to-r from-rose-500 to-orange-400'}`}
                  style={{ width: `${(unit.health / unit.maxHealth) * 100}%` }}
                />
              </div>
              
              <div className={`w-10 h-8 md:w-12 md:h-10 ${unit.team === 'player' ? SLIME_CONFIGS[unit.type].color : theme.enemyColor} rounded-t-[40px] rounded-b-[20px] relative flex items-center justify-center border-2 border-white shadow-xl ${unit.isMining || unit.isRetreating ? 'animate-bounce' : 'animate-squish'}`}>
                {/* Eyes */}
                <div className="flex space-x-1 absolute top-2 md:top-3">
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full relative overflow-hidden">
                        <div className="absolute top-0.5 left-0.5 w-0.5 h-0.5 bg-white rounded-full"></div>
                    </div>
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full relative overflow-hidden">
                        <div className="absolute top-0.5 left-0.5 w-0.5 h-0.5 bg-white rounded-full"></div>
                    </div>
                </div>

                <div className={`mt-0.5 md:mt-1 transition-transform duration-300 ${unit.isRetreating ? 'rotate-180' : ''}`}>
                  <span className="text-sm md:text-xl drop-shadow-md">
                    {unit.team === 'player' ? SLIME_CONFIGS[unit.type].icon : (isBossLevel && unit.type === 'tank' ? '👹' : SLIME_CONFIGS[unit.type].icon)}
                  </span>
                </div>
                
                {performance.now() - unit.lastAttackTime < 400 && !unit.isRetreating && (
                   <div className="absolute -top-6 md:-top-8 animate-ping z-50">
                      <Zap size={16} className="text-yellow-400 fill-white" />
                   </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Control Panel - Compact Summoning */}
      <div className="relative z-50 p-2 md:p-4 bg-slate-950/90 backdrop-blur-2xl border-t-2 border-indigo-600/40 flex justify-center items-center space-x-3 md:space-x-6 shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        {/* Retreat Button */}
        <button 
          onClick={handleRetreatToggle}
          className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl border-b-4 transition-all transform active:scale-95 shadow-lg
            ${isRetreating ? 'bg-rose-600 border-rose-900' : 'bg-slate-800 border-slate-950 hover:bg-slate-700'}`}
        >
          <Undo2 size={20} className={`md:size-6 text-white transition-all duration-500 ${isRetreating ? 'rotate-180 scale-125' : ''}`} />
          <span className="text-[7px] md:text-[9px] font-black uppercase text-white header-font mt-1">RETREAT</span>
        </button>

        <div className="w-px h-10 bg-white/10"></div>

        {/* Summoning Deck */}
        <div className="flex space-x-2 md:space-x-4 overflow-x-auto no-scrollbar py-1">
            {playerStats.selectedDeck.map(type => {
              const config = SLIME_CONFIGS[type];
              const canAfford = playerBlueCrystals >= config.cost;
              return (
                <button 
                  key={type}
                  onClick={() => spawnUnit(type, 'player')}
                  disabled={!canAfford}
                  className={`shrink-0 flex flex-col items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl border-b-4 transition-all transform active:scale-90 shadow-lg
                    ${canAfford ? 'bg-slate-800 border-indigo-900 hover:bg-slate-700' : 'bg-slate-950 border-black opacity-30 cursor-not-allowed'}`}
                >
                  <span className="text-xl md:text-2xl mb-0.5 drop-shadow-md">{config.icon}</span>
                  <span className="text-[6px] md:text-[8px] font-black uppercase text-white/90 header-font leading-none">{config.name.split(' ')[0]}</span>
                  <span className={`text-[7px] md:text-[9px] font-black header-font ${canAfford ? 'text-sky-300' : 'text-slate-600'} mt-1`}>{config.cost}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};

const Tower: React.FC<{ team: 'player' | 'enemy'; hp: number; maxHp: number; flash: boolean; theme: any }> = ({ team, hp, maxHp, flash, theme }) => (
  <div className={`absolute bottom-16 md:bottom-22 ${team === 'player' ? 'left-2 md:left-4' : 'right-2 md:right-4'} flex flex-col items-center z-20`}>
     {/* Tower Base - Shorter for Mobile Landscape */}
     <div className={`relative w-14 h-32 md:w-24 md:h-64 ${team === 'player' ? 'bg-slate-800' : 'bg-slate-900'} rounded-t-2xl md:rounded-t-3xl border-2 md:border-4 ${flash ? 'border-white scale-105 shadow-[0_0_30px_white]' : 'border-white/20 shadow-xl'} transition-all duration-100 flex flex-col items-center overflow-visible`}>
        
        {/* Glow */}
        <div className={`absolute -top-4 md:-top-6 w-8 md:w-12 h-8 md:h-12 rounded-full blur-xl ${team === 'player' ? 'bg-sky-400/60' : 'bg-rose-500/60'} animate-pulse-glow`}></div>
        <div className={`absolute -top-2 md:-top-3 w-3 md:w-6 h-3 md:h-6 rounded-full border-2 border-white/30 ${team === 'player' ? 'bg-sky-400' : 'bg-rose-500'} shadow-lg`}></div>

        {/* Portal Orifice */}
        <div className="absolute bottom-6 md:bottom-12 w-10 md:w-16 h-16 md:h-28 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full border-2 md:border-4 animate-magic-rotate ${team === 'player' ? 'border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.4)]' : 'border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.4)]'}`}></div>
            <div className={`w-6 h-12 md:w-12 md:h-20 rounded-full flex items-center justify-center relative overflow-hidden border border-white/10
              ${team === 'player' ? 'bg-gradient-to-t from-sky-950 to-sky-600' : 'bg-gradient-to-t from-rose-950 to-rose-700'}`}>
                <LogIn size={12} className={`md:size-6 text-white/60 ${team === 'player' ? 'animate-pulse' : 'scale-x-[-1] animate-pulse'}`} />
            </div>
        </div>

        {/* HP Bar */}
        <div className="mt-2 md:mt-4 w-8 md:w-12 h-8 md:h-16 rounded-md bg-black/60 p-0.5 md:p-1 border border-white/10 flex flex-col justify-end overflow-hidden">
            <div 
              className={`w-full transition-all duration-300 rounded-sm ${team === 'player' ? 'bg-gradient-to-t from-sky-700 to-sky-400' : 'bg-gradient-to-t from-rose-700 to-rose-400'}`} 
              style={{ height: `${(hp/maxHp)*100}%` }}
            />
        </div>
     </div>

     {/* Tower Label */}
     <div className={`mt-2 md:mt-4 px-2 md:px-4 py-1 rounded-lg border-b-2 md:border-b-4 font-black text-[7px] md:text-[10px] uppercase tracking-wide shadow-lg header-font italic
        ${team === 'player' ? 'bg-sky-600 border-sky-900 text-white shadow-sky-500/10' : 'bg-rose-600 border-rose-900 text-white shadow-rose-500/10'}`}>
        <span>{team === 'player' ? 'BASTION' : 'RIFT'}</span>
     </div>
  </div>
);

export default Battlefield;
