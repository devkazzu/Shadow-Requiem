import type { Stats, UpgradeState } from '../types';

export const SHADOW_POWER_MAX = 100;

export function computeDamage(
  attack: number,
  multiplier: number,
  defense: number,
  variance = 1,
  critChance = 0,
  randomValue = 1
): number {
  const mitigatedDefense = Math.max(0, defense * 0.72);
  const critMultiplier = randomValue < critChance ? 1.55 : 1;
  const rawDamage = attack * multiplier * variance * critMultiplier - mitigatedDefense;
  return Math.max(1, Math.round(rawDamage));
}

export function addShadowPower(current: number, amount: number, multiplier = 1): number {
  return clamp(current + amount * multiplier, 0, SHADOW_POWER_MAX);
}

export function levelXpRequirement(level: number): number {
  return Math.round(110 + Math.pow(level, 1.45) * 34);
}

export function upgradeGoldCost(currentLevel: number, upgradeRank: number): number {
  return Math.round(75 + currentLevel * 32 + upgradeRank * 58);
}

export function deriveStats(base: Stats, level: number, upgrades: UpgradeState): Stats {
  const levelScale = 1 + Math.max(0, level - 1) * 0.075;
  return {
    maxHealth: Math.round(base.maxHealth * levelScale + upgrades.vitality * 58),
    attack: Math.round(base.attack * levelScale + upgrades.attack * 8),
    defense: Math.round(base.defense * levelScale + upgrades.vitality * 2),
    speed: Number((base.speed + upgrades.shadow * 0.08).toFixed(2)),
    critChance: clamp(base.critChance + upgrades.attack * 0.008, 0, 0.35),
    shadowGainMultiplier: Number((base.shadowGainMultiplier + upgrades.shadow * 0.06).toFixed(2))
  };
}

export function applyXp(level: number, xp: number, gainedXp: number): { level: number; xp: number; levelsGained: number } {
  let nextLevel = level;
  let nextXp = xp + gainedXp;
  let levelsGained = 0;

  while (nextXp >= levelXpRequirement(nextLevel)) {
    nextXp -= levelXpRequirement(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }

  return { level: nextLevel, xp: nextXp, levelsGained };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatCooldown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return '';
  if (secondsRemaining < 1) return secondsRemaining.toFixed(1);
  return Math.ceil(secondsRemaining).toString();
}
