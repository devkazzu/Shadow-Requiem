import type { GameSettings, PlayerProfile, SaveData } from '../types';

export const SAVE_VERSION = '0.1.0';
export const STORAGE_KEY = 'shadow-requiem-save-v1';

export interface SaveEnvelope {
  checksum: string;
  data: SaveData;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function defaultSettings(): GameSettings {
  return {
    screenShake: true,
    vibration: true,
    cameraSensitivity: 1,
    graphicsPreset: 'MEDIUM',
    fpsCap: 60,
    reducedMotion: false
  };
}

export function createDefaultProfile(): PlayerProfile {
  return {
    level: 1,
    xp: 0,
    gold: 0,
    skillPoints: 0,
    upgrades: {
      attack: 0,
      vitality: 0,
      shadow: 0
    },
    unlockedCharacters: ['shadow', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'],
    activeParty: ['shadow', 'alpha', 'beta', 'delta'],
    activeCharacterId: 'shadow',
    inventory: {
      shadowShard: 0,
      eclipseCore: 0,
      nullFragment: 0,
      trainingSigil: 0
    },
    unlockedWeapons: ['nocturne-katana'],
    equippedWeaponId: 'nocturne-katana',
    friendship: {},
    achievements: [],
    completedMissions: [],
    unlockedMissions: ['awakening'],
    lastMissionId: 'awakening',
    settings: defaultSettings()
  };
}

export function createNewSave(now = new Date()): SaveData {
  const timestamp = now.toISOString();
  return {
    version: SAVE_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    profile: createDefaultProfile()
  };
}

export function checksumForSave(data: SaveData): string {
  return fnv1a(stableStringify(data));
}

export function createEnvelope(data: SaveData): SaveEnvelope {
  return {
    checksum: checksumForSave(data),
    data
  };
}

export function isValidEnvelope(value: unknown): value is SaveEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Partial<SaveEnvelope>;
  if (typeof envelope.checksum !== 'string' || !envelope.data) return false;
  return envelope.checksum === checksumForSave(envelope.data);
}

export class SaveManager {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = window.localStorage) {
    this.storage = storage;
  }

  hasSave(): boolean {
    return this.storage.getItem(STORAGE_KEY) !== null;
  }

  load(): SaveData | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidEnvelope(parsed)) {
        console.warn('Rejected corrupted SHADOW REQUIEM save.');
        return null;
      }
      return migrateSave(parsed.data);
    } catch (error) {
      console.warn('Failed to parse SHADOW REQUIEM save.', error);
      return null;
    }
  }

  save(data: SaveData): void {
    const updated: SaveData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(createEnvelope(updated)));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }
}

function migrateSave(data: SaveData): SaveData {
  // Forward-compatible placeholder for future save versions.
  return {
    ...data,
    profile: {
      ...createDefaultProfile(),
      ...data.profile,
      settings: {
        ...defaultSettings(),
        ...data.profile.settings
      },
      upgrades: {
        ...createDefaultProfile().upgrades,
        ...data.profile.upgrades
      }
    }
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
