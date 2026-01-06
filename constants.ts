
import { SlimeType, PlayerStats } from './types';

export const INITIAL_PLAYER_STATS: PlayerStats = {
  diamonds: 930,
  purpleCrystals: 1250,
  currentLevel: 1,
  unlockedSlimes: ['miner', 'warrior', 'archer', 'tank', 'mage'],
  selectedDeck: ['miner', 'warrior', 'archer', 'tank', 'mage'],
  username: 'COMMANDER',
  rank: 'Petal Bronze I'
};

export const SLIME_CONFIGS: Record<SlimeType | 'big_slime', { name: string; cost: number; hp: number; atk: number; color: string; icon: string }> = {
  miner: { name: 'Miner Slime', cost: 30, hp: 400, atk: 0, color: 'bg-amber-600', icon: '⛏️' },
  warrior: { name: 'Imperial Knight Slime', cost: 50, hp: 1200, atk: 150, color: 'bg-blue-600', icon: '⚔️' },
  archer: { name: 'Imperial Archer Slime', cost: 40, hp: 600, atk: 85, color: 'bg-emerald-600', icon: '🏹' },
  tank: { name: 'Imperial Paladin Knight Slime', cost: 60, hp: 2000, atk: 120, color: 'bg-slate-200', icon: '🛡️' },
  mage: { name: 'Imperial Mage Slime', cost: 55, hp: 500, atk: 40, color: 'bg-purple-600', icon: '✨' },
  big_slime: { name: 'Big Slime', cost: 100, hp: 4500, atk: 250, color: 'bg-rose-600', icon: '👑' }
};

export interface MapTheme {
  name: string;
  bgColor: string;
  groundColor: string;
  accentColor: string;
  enemyPrefix: string;
  enemyColor: string;
  decor: string[];
}

export const MAP_THEMES: Record<number, MapTheme> = {
  1: {
    name: "Forest Frontier",
    bgColor: "from-sky-300 to-sky-500",
    groundColor: "bg-emerald-700",
    accentColor: "text-emerald-400",
    enemyPrefix: "Forest",
    enemyColor: "bg-red-900",
    decor: ["🌲", "🌿"]
  }
};

export const getThemeForLevel = (level: number): MapTheme => {
  return MAP_THEMES[1];
};

export const TIPS = [
  "Miners are the backbone of your army. Protect them at all costs!",
  "Archers fire in arcs. They can hit enemies from behind tanks.",
  "Mages summon smaller slimes periodically. Great for overwhelming enemies!",
  "The Big Slime is the only unit with a powerful knockback effect.",
  "Use the Retreat command to pull units back into the portal for healing."
];
