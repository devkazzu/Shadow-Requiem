import { describe, expect, it } from 'vitest';
import { characters, defaultParty, missions, weapons } from '../game/content';

describe('data-driven full-game shell content', () => {
  it('contains Shadow and the seven original Nocturne commanders', () => {
    expect(Object.keys(characters).sort()).toEqual(['alpha', 'beta', 'delta', 'epsilon', 'eta', 'gamma', 'shadow', 'zeta']);
    for (const character of Object.values(characters)) {
      expect(character.skills).toHaveLength(3);
      expect(character.ultimate.name.length).toBeGreaterThan(0);
    }
  });

  it('has a valid default combat party', () => {
    expect(defaultParty).toHaveLength(4);
    for (const characterId of defaultParty) {
      expect(characters[characterId]).toBeDefined();
    }
  });

  it('has craftable weapons and missions with rewards', () => {
    expect(weapons['nocturne-katana'].attackBonus).toBeGreaterThan(0);
    expect(weapons['null-requiem'].unlockCost.nullFragment).toBeGreaterThan(0);
    expect(missions.awakening.rewards.materials?.eclipseCore).toBe(1);
  });
});
