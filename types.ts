
export enum GameState {
  INTRO = 'INTRO',
  LANDING = 'LANDING',
  MAP_SELECTION = 'MAP_SELECTION',
  BATTLE = 'BATTLE',
  SHOP = 'SHOP',
  DECK = 'DECK'
}

export type SlimeType = 'miner' | 'warrior' | 'archer' | 'tank' | 'mage';

export interface SlimeUnit {
  id: string;
  type: SlimeType;
  health: number;
  maxHealth: number;
  attack: number;
  speed: number;
  range: number;
  cost: number;
  position: number; // 0 to 100 (percentage of battlefield)
  team: 'player' | 'enemy';
  lastAttackTime: number;
  isDead: boolean;
  isMining?: boolean;
  isRetreating?: boolean;
}

export interface PlayerStats {
  diamonds: number;
  purpleCrystals: number; // Meta-currency (Purple Gems)
  currentLevel: number;
  unlockedSlimes: SlimeType[];
  selectedDeck: SlimeType[];
  username: string;
  rank: string;
}

export interface MapLevel {
  id: number;
  name: string;
  isBoss: boolean;
  difficulty: number;
  unlocked: boolean;
  completed: boolean;
}
