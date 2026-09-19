import { describe, expect, it } from 'vitest';
import { addShadowPower, applyXp, computeDamage, deriveStats, levelXpRequirement, upgradeGoldCost } from '../game/systems/combat';
import type { Stats } from '../game/types';

const baseStats: Stats = {
  maxHealth: 420,
  attack: 48,
  defense: 12,
  speed: 7.2,
  critChance: 0.08,
  shadowGainMultiplier: 1
};

describe('combat math', () => {
  it('always deals at least one damage after mitigation', () => {
    expect(computeDamage(1, 0.1, 999)).toBe(1);
  });

  it('applies deterministic critical damage when random value is below crit chance', () => {
    const normal = computeDamage(50, 1, 5, 1, 0.5, 0.9);
    const critical = computeDamage(50, 1, 5, 1, 0.5, 0.1);
    expect(critical).toBeGreaterThan(normal);
  });

  it('caps Shadow Power at the maximum meter value', () => {
    expect(addShadowPower(96, 20)).toBe(100);
    expect(addShadowPower(0, -10)).toBe(0);
  });

  it('scales derived character stats from level and upgrades', () => {
    const stats = deriveStats(baseStats, 4, { attack: 2, vitality: 1, shadow: 3 });
    expect(stats.attack).toBeGreaterThan(baseStats.attack);
    expect(stats.maxHealth).toBeGreaterThan(baseStats.maxHealth);
    expect(stats.shadowGainMultiplier).toBeGreaterThan(baseStats.shadowGainMultiplier);
  });

  it('levels up when enough XP is earned', () => {
    const requirement = levelXpRequirement(1);
    const result = applyXp(1, 0, requirement + 5);
    expect(result.level).toBe(2);
    expect(result.xp).toBe(5);
    expect(result.levelsGained).toBe(1);
  });

  it('increases upgrade costs with rank and level', () => {
    expect(upgradeGoldCost(3, 2)).toBeGreaterThan(upgradeGoldCost(1, 0));
  });
});
