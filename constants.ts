
import { SlimeType, PlayerStats } from './types';

export const INITIAL_PLAYER_STATS: PlayerStats = {
  diamonds: 500,
  purpleCrystals: 1250,
  currentLevel: 1,
  unlockedSlimes: ['miner', 'warrior', 'archer'],
  selectedDeck: ['miner', 'warrior', 'archer', 'tank'],
  username: 'SlimeSovereign',
  rank: 'Petal Bronze I'
};

export const SLIME_CONFIGS: Record<SlimeType, { name: string; cost: number; hp: number; atk: number; color: string; icon: string }> = {
  miner: { name: 'Imperial Miner Knight', cost: 50, hp: 80, atk: 0, color: 'bg-emerald-400', icon: '💎' },
  warrior: { name: 'Slime Legionnaire', cost: 125, hp: 180, atk: 22, color: 'bg-sky-500', icon: '⚔️' },
  archer: { name: 'Azure Marksman', cost: 175, hp: 95, atk: 16, color: 'bg-indigo-400', icon: '🏹' },
  tank: { name: 'Grand Phalanx', cost: 350, hp: 650, atk: 14, color: 'bg-slate-600', icon: '🛡️' },
  mage: { name: 'Crystal Arcanist', cost: 400, hp: 130, atk: 60, color: 'bg-violet-400', icon: '✨' }
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
    bgColor: "from-green-900 to-emerald-800",
    groundColor: "bg-[#2d4a22]",
    accentColor: "text-emerald-400",
    enemyPrefix: "Forest",
    enemyColor: "bg-emerald-600",
    decor: ["🌲", "🌿", "🍄", "🍃"]
  },
  2: {
    name: "Crystal Cavern",
    bgColor: "from-indigo-950 to-slate-900",
    groundColor: "bg-[#1e1b4b]",
    accentColor: "text-indigo-400",
    enemyPrefix: "Crystal",
    enemyColor: "bg-indigo-700",
    decor: ["💎", "💠", "🌑", "🔮"]
  },
  3: {
    name: "Imperial Ruins",
    bgColor: "from-slate-900 to-slate-800",
    groundColor: "bg-[#334155]",
    accentColor: "text-amber-500",
    enemyPrefix: "Rebel",
    enemyColor: "bg-slate-700",
    decor: ["🏛️", "🗿", "📜", "⚔️"]
  },
  4: {
    name: "Shadow Frost Wasteland",
    bgColor: "from-violet-950 to-blue-950",
    groundColor: "bg-[#0f172a]",
    accentColor: "text-violet-400",
    enemyPrefix: "Shadow",
    enemyColor: "bg-violet-900",
    decor: ["❄️", "🧊", "💀", "🌪️"]
  },
  5: {
    name: "Crystal Sky Sanctuary",
    bgColor: "from-sky-400 to-indigo-300",
    groundColor: "bg-white/20",
    accentColor: "text-sky-100",
    enemyPrefix: "Celestial",
    enemyColor: "bg-white",
    decor: ["☁️", "🕊️", "✨", "🪐"]
  }
};

export const getThemeForLevel = (level: number): MapTheme => {
  const themeIndex = Math.min(5, Math.floor((level - 1) / 10) + 1);
  return MAP_THEMES[themeIndex];
};

export const TIPS = [
  "Blue Crystals are for battle! Mine them from Crystal Rocks.",
  "Purple Gems represent your wealth and can be used in the shop.",
  "Imperial Miner Knights need to reach the rocks before they can start mining.",
  "The enemy uses the same economy. Destroy their Miners to slow them down!",
  "Keep your Legionnaires ahead of your Archers for a balanced formation.",
  "A steady supply of Blue Crystals ensures a continuous flow of reinforcements."
];
