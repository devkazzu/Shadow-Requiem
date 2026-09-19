import { describe, expect, it } from 'vitest';
import { SaveManager, STORAGE_KEY, checksumForSave, createEnvelope, createNewSave, isValidEnvelope } from '../game/systems/save';

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe('save system', () => {
  it('creates a checksum that validates unchanged save data', () => {
    const save = createNewSave(new Date('2026-09-11T00:00:00.000Z'));
    const envelope = createEnvelope(save);
    expect(isValidEnvelope(envelope)).toBe(true);
    expect(envelope.checksum).toBe(checksumForSave(save));
  });

  it('rejects tampered save payloads', () => {
    const save = createNewSave(new Date('2026-09-11T00:00:00.000Z'));
    const envelope = createEnvelope(save);
    envelope.data.profile.gold = 999999;
    expect(isValidEnvelope(envelope)).toBe(false);
  });

  it('creates default full-game shell progression fields', () => {
    const save = createNewSave(new Date('2026-09-11T00:00:00.000Z'));
    expect(save.profile.unlockedCharacters).toContain('eta');
    expect(save.profile.activeParty).toEqual(['shadow', 'alpha', 'beta', 'delta']);
    expect(save.profile.unlockedWeapons).toContain('nocturne-katana');
    expect(save.profile.inventory.shadowShard).toBe(0);
  });

  it('persists and loads through an injected storage implementation', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const save = createNewSave(new Date('2026-09-11T00:00:00.000Z'));
    save.profile.gold = 140;
    manager.save(save);
    expect(storage.getItem(STORAGE_KEY)).toContain('checksum');
    expect(manager.load()?.profile.gold).toBe(140);
  });
});
