
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
  position: number; // 0 to 100
  team: 'player' | 'enemy';
  lastAttackTime: number;
  lastSummonTime?: number; // For Mages
  isDead: boolean;
  isMining?: boolean;
  isRetreating?: boolean;
  stuckArrows?: number;
  isBigSlime?: boolean;
}

export interface Projectile {
  id: string;
  type: 'arrow' | 'magic';
  team: 'player' | 'enemy';
  x: number;
  y: number; // Visual height (0 is ground, higher is up)
  targetX: number;
  targetId: string | 'tower';
  damage: number;
  speed: number;
  vx: number;
  vy: number;
  isDone: boolean;
}

export interface PlayerStats {
  diamonds: number;
  purpleCrystals: number;
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
