import alpha from '../data/characters/alpha.json';
import beta from '../data/characters/beta.json';
import delta from '../data/characters/delta.json';
import epsilon from '../data/characters/epsilon.json';
import eta from '../data/characters/eta.json';
import gamma from '../data/characters/gamma.json';
import shadow from '../data/characters/shadow.json';
import zeta from '../data/characters/zeta.json';
import abyssKnight from '../data/enemies/abyss-knight-initiate.json';
import arcanist from '../data/enemies/eclipsed-arcanist.json';
import eclipseWarden from '../data/enemies/eclipse-warden.json';
import nullGuard from '../data/enemies/null-guard.json';
import cultist from '../data/enemies/shadow-cultist.json';
import awakening from '../data/missions/awakening.json';
import shadowTrace from '../data/missions/shadow-trace.json';
import eclipseCleaver from '../data/weapons/eclipse-cleaver.json';
import nocturneKatana from '../data/weapons/nocturne-katana.json';
import nullRequiem from '../data/weapons/null-requiem.json';
import type { CharacterData, EnemyData, MissionData, WeaponData } from './types';

export const protagonist = shadow as CharacterData;

export const characters: Record<string, CharacterData> = {
  shadow: shadow as CharacterData,
  alpha: alpha as CharacterData,
  beta: beta as CharacterData,
  gamma: gamma as CharacterData,
  delta: delta as CharacterData,
  epsilon: epsilon as CharacterData,
  zeta: zeta as CharacterData,
  eta: eta as CharacterData
};

export const defaultParty = ['shadow', 'alpha', 'beta', 'delta'];

export const weapons: Record<string, WeaponData> = {
  [nocturneKatana.id]: nocturneKatana as WeaponData,
  [eclipseCleaver.id]: eclipseCleaver as WeaponData,
  [nullRequiem.id]: nullRequiem as WeaponData
};

export const enemies: Record<string, EnemyData> = {
  [cultist.id]: cultist as EnemyData,
  [arcanist.id]: arcanist as EnemyData,
  [nullGuard.id]: nullGuard as EnemyData,
  [abyssKnight.id]: abyssKnight as EnemyData,
  [eclipseWarden.id]: eclipseWarden as EnemyData
};

export const missions: Record<string, MissionData> = {
  [awakening.id]: awakening as MissionData,
  [shadowTrace.id]: shadowTrace as MissionData
};
