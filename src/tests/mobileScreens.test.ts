import { describe, expect, it } from 'vitest';
import { characters, missions, weapons } from '../game/content';
import { deriveStats } from '../game/systems/combat';
import { createDefaultProfile } from '../game/systems/save';
import { renderBattlePrepScreen, renderCharacterScreen, renderInventoryScreen, renderMainLobby, renderMapScreen, renderMissionScreen } from '../game/ui/mobileScreens';

describe('mobile-first screen renderers', () => {
  it('renders a lobby with fixed bottom navigation and a direct play action', () => {
    const profile = createDefaultProfile();
    const html = renderMainLobby({
      profile,
      activeCharacter: characters.shadow,
      activeWeapon: weapons['nocturne-katana'],
      hasSave: false
    });

    expect(html).toContain('bottom-nav');
    expect(html).toContain('data-prepare-mission-id');
    expect(html).toContain('PLAY');
  });

  it('renders character details with tabs and a horizontal portrait rail', () => {
    const profile = createDefaultProfile();
    const html = renderCharacterScreen({
      profile,
      characters: Object.values(characters),
      activeCharacter: characters.alpha,
      activeStats: deriveStats(characters.alpha.baseStats, profile.level, profile.upgrades),
      activeWeapon: weapons['nocturne-katana'],
      tab: 'SKILLS',
      attackCost: 100,
      vitalityCost: 100,
      shadowCost: 100
    });

    expect(html).toContain('portrait-rail');
    expect(html).toContain('data-character-tab="SKILLS"');
    expect(html).not.toContain('full-shell-actions');
  });

  it('renders inventory and missions as tabbed compact screens', () => {
    const profile = createDefaultProfile();
    const inventory = renderInventoryScreen({
      profile,
      weapons: Object.values(weapons),
      equippedWeaponId: profile.equippedWeaponId,
      unlockedWeapons: profile.unlockedWeapons,
      inventory: profile.inventory,
      tab: 'WEAPONS'
    });
    const mission = renderMissionScreen({ profile, missions: Object.values(missions), selectedTab: 'STORY' });

    expect(inventory).toContain('data-inventory-category="WEAPONS"');
    expect(inventory).toContain('inventory-grid-screen');
    expect(mission).toContain('mission-board-screen');
    expect(mission).toContain('data-prepare-mission-id="awakening"');
  });

  it('renders battle preparation and full-screen map without scroll-page wrappers', () => {
    const profile = createDefaultProfile();
    const prep = renderBattlePrepScreen({
      profile,
      mission: missions.awakening,
      party: [characters.shadow, characters.alpha, characters.beta, characters.delta],
      roster: Object.values(characters),
      selectedSlot: 0
    });
    const map = renderMapScreen();

    expect(prep).toContain('team-slots');
    expect(prep).toContain('data-launch-prepared="true"');
    expect(map).toContain('full-map');
    expect(map).not.toContain('world-map-panel');
  });
});
