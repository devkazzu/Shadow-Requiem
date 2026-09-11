export type GameScreen =
  | 'menu'
  | 'intro'
  | 'playing'
  | 'reward'
  | 'character'
  | 'missions'
  | 'map'
  | 'garden'
  | 'inventory'
  | 'archive'
  | 'defeat'
  | 'settings';

export type EnemyAIStyle = 'melee' | 'ranged' | 'tank' | 'miniboss' | 'boss';

export interface Stats {
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  shadowGainMultiplier: number;
}

export interface SkillData {
  id: string;
  name: string;
  slot: 1 | 2 | 3;
  cooldown: number;
  damageMultiplier: number;
  radius: number;
  range: number;
  duration?: number;
  shadowGain: number;
  description: string;
}

export interface UltimateData {
  id: string;
  name: string;
  cooldown: number;
  damageMultiplier: number;
  radius: number;
  line: string;
  description: string;
}

export interface CharacterVisuals {
  primary: string;
  secondary: string;
  accent: string;
}

export interface CharacterData {
  id: string;
  displayName: string;
  codename: string;
  title: string;
  rarity: string;
  role: string;
  baseStats: Stats;
  visuals?: CharacterVisuals;
  skills: SkillData[];
  ultimate: UltimateData;
}

export interface EnemyData {
  id: string;
  displayName: string;
  archetype: string;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  radius: number;
  staggerMax: number;
  xpReward: number;
  goldReward: number;
  color: string;
  aiStyle: EnemyAIStyle;
  description: string;
}

export interface MissionReward {
  xp: number;
  gold: number;
  skillPoints: number;
  materials?: Record<string, number>;
}

export interface SpawnPoint {
  enemyId: string;
  x: number;
  z: number;
}

export interface WaypointStep {
  type: 'waypoint';
  objective: string;
  marker: { x: number; z: number };
}

export interface WaveStep {
  type: 'wave';
  objective: string;
  spawns: SpawnPoint[];
}

export type MissionStep = WaypointStep | WaveStep;

export interface MissionData {
  id: string;
  chapter: string;
  title: string;
  recommendedLevel: number;
  difficulty: string;
  narrative: string;
  rewards: MissionReward;
  nextMission: string;
  steps: MissionStep[];
}

export interface UpgradeState {
  attack: number;
  vitality: number;
  shadow: number;
}

export interface WeaponData {
  id: string;
  name: string;
  category: 'Sword' | 'Greatsword' | 'Bow' | 'Staff' | 'Daggers' | 'Magic weapon' | 'Experimental weapon';
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'Shadow-tier';
  attackBonus: number;
  passive: string;
  unlockCost: Record<string, number>;
}

export interface PlayerProfile {
  level: number;
  xp: number;
  gold: number;
  skillPoints: number;
  upgrades: UpgradeState;
  unlockedCharacters: string[];
  activeParty: string[];
  activeCharacterId: string;
  inventory: Record<string, number>;
  unlockedWeapons: string[];
  equippedWeaponId: string;
  friendship: Record<string, number>;
  achievements: string[];
  completedMissions: string[];
  unlockedMissions: string[];
  lastMissionId: string;
  settings: GameSettings;
}

export interface GameSettings {
  screenShake: boolean;
  vibration: boolean;
  cameraSensitivity: number;
  graphicsPreset: 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  fpsCap: 30 | 60;
  reducedMotion: boolean;
}

export interface SaveData {
  version: string;
  createdAt: string;
  updatedAt: string;
  profile: PlayerProfile;
}
