import type { CharacterData, GameSettings, MissionData, PlayerProfile, Stats, WeaponData } from '../types';

export type CharacterTab = 'OVERVIEW' | 'SKILLS' | 'EQUIPMENT' | 'TALENTS' | 'STATS';
export type InventoryTab = 'WEAPONS' | 'ARTIFACTS' | 'MATERIALS' | 'CONSUMABLES' | 'COSMETICS';
export type MissionTab = 'STORY' | 'DAILY' | 'WEEKLY' | 'BOSS' | 'DUNGEON' | 'EVENT';
export type SettingsTab = 'GENERAL' | 'GRAPHICS' | 'AUDIO' | 'CONTROLS' | 'CAMERA' | 'ACCESSIBILITY' | 'ACCOUNT';
export type BottomNavId = 'home' | 'characters' | 'inventory' | 'missions' | 'more';

type MaterialBag = Record<string, number>;

interface BaseScreenProps {
  profile: PlayerProfile;
  activeNav?: BottomNavId;
}

export interface LobbyProps extends BaseScreenProps {
  activeCharacter: CharacterData;
  activeWeapon: WeaponData;
  message?: string;
  hasSave: boolean;
}

export interface CharacterScreenProps extends BaseScreenProps {
  characters: CharacterData[];
  activeCharacter: CharacterData;
  activeStats: Stats;
  activeWeapon: WeaponData;
  tab: CharacterTab;
  attackCost: number;
  vitalityCost: number;
  shadowCost: number;
}

export interface InventoryScreenProps extends BaseScreenProps {
  weapons: WeaponData[];
  equippedWeaponId: string;
  unlockedWeapons: string[];
  inventory: MaterialBag;
  tab: InventoryTab;
}

export interface MissionScreenProps extends BaseScreenProps {
  missions: MissionData[];
  selectedTab: MissionTab;
}

export interface PrepScreenProps extends BaseScreenProps {
  mission: MissionData;
  party: CharacterData[];
  roster: CharacterData[];
  selectedSlot: number;
}

export interface SettingsScreenProps extends BaseScreenProps {
  settings: GameSettings;
  selectedTab: SettingsTab;
}

export interface VictoryScreenProps {
  mission: MissionData;
  levelsGained: number;
  isFirstMission: boolean;
  materialLabel: string;
}

export function renderMainLobby(props: LobbyProps): string {
  const { profile, activeCharacter, activeWeapon, message, hasSave } = props;
  return mobileFrame(
    'home',
    `
      <header class="mobile-topbar">
        ${profileBlock(profile, activeCharacter)}
        <div class="top-currency-row">
          ${currencyPill('Gold', profile.gold)}
          ${currencyPill('Gems', profile.inventory.nullFragment ?? 0)}
          <button class="icon-chip" type="button" data-ui-action="archive" aria-label="Notifications">N</button>
          <button class="icon-chip" type="button" data-ui-action="settings" aria-label="Settings">S</button>
        </div>
      </header>

      <section class="lobby-stage" aria-label="Selected character lobby">
        <div class="event-ticket">
          <span>Current Event</span>
          <strong>Memory War Prelude</strong>
        </div>
        <div class="character-standee" style="--hero-a:${activeCharacter.visuals?.secondary ?? '#7c3aed'};--hero-b:${activeCharacter.visuals?.accent ?? '#f43f5e'}">
          <div class="standee-aura"></div>
          <div class="standee-body"><span>${activeCharacter.codename}</span></div>
        </div>
        <div class="lobby-character-card glass-panel">
          <span class="screen-kicker">${activeCharacter.rarity} · ${activeCharacter.role}</span>
          <h1>${activeCharacter.codename}</h1>
          <p>${activeCharacter.displayName} · ${activeWeapon.name}</p>
        </div>
        ${message ? `<div class="lobby-message glass-panel">${message}</div>` : ''}
      </section>

      <section class="quick-strip" aria-label="Quick actions">
        <button class="quick-card" type="button" data-ui-action="missions"><span>Daily</span><strong>Training</strong></button>
        <button class="quick-card" type="button" data-ui-action="inventory"><span>Reward</span><strong>Forge Ready</strong></button>
        <button class="quick-card" type="button" data-ui-action="garden"><span>HQ</span><strong>Nocturne</strong></button>
      </section>

      <button class="play-button" type="button" data-prepare-mission-id="${profile.lastMissionId || 'awakening'}">PLAY</button>
      ${!hasSave ? '<button class="ghost-start" type="button" data-ui-action="new-game">New Game Intro</button>' : '<button class="ghost-start" type="button" data-ui-action="continue">Continue Story</button>'}
    `
  );
}

export function renderCharacterScreen(props: CharacterScreenProps): string {
  const { characters, activeCharacter, activeStats, activeWeapon, tab, profile, attackCost, vitalityCost, shadowCost } = props;
  const tabs: CharacterTab[] = ['OVERVIEW', 'SKILLS', 'EQUIPMENT', 'TALENTS', 'STATS'];
  return mobileFrame(
    'characters',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="menu">Back</button>
        <h1>Heroes</h1>
        ${currencyPill('Gold', profile.gold)}
      </header>
      <section class="hero-screen-grid">
        <div class="hero-model-panel">
          <div class="character-standee small" style="--hero-a:${activeCharacter.visuals?.secondary ?? '#7c3aed'};--hero-b:${activeCharacter.visuals?.accent ?? '#f43f5e'}">
            <div class="standee-aura"></div><div class="standee-body"><span>${activeCharacter.codename}</span></div>
          </div>
        </div>
        <aside class="hero-info-panel glass-panel">
          <span class="screen-kicker">${activeCharacter.rarity}</span>
          <h2>${activeCharacter.codename}</h2>
          <p>${activeCharacter.displayName}</p>
          <div class="compact-stat-grid">
            ${stat('LV', profile.level)}
            ${stat('HP', activeStats.maxHealth)}
            ${stat('ATK', activeStats.attack)}
            ${stat('DEF', activeStats.defense)}
            ${stat('MAG', Math.round(activeStats.attack * activeStats.shadowGainMultiplier))}
            ${stat('CP', combatPower(activeStats))}
          </div>
        </aside>
      </section>
      <nav class="portrait-rail" aria-label="Character carousel">
        ${characters
          .map((character) => portraitButton(character, character.id === activeCharacter.id, `data-character-id="${character.id}"`))
          .join('')}
      </nav>
      <nav class="tab-rail" aria-label="Character tabs">
        ${tabs.map((item) => tabButton(item, item === tab, 'character-tab')).join('')}
      </nav>
      <section class="tab-panel glass-panel">${renderCharacterTab(tab, activeCharacter, activeWeapon, profile, attackCost, vitalityCost, shadowCost)}</section>
    `
  );
}

export function renderInventoryScreen(props: InventoryScreenProps): string {
  const tabs: InventoryTab[] = ['WEAPONS', 'ARTIFACTS', 'MATERIALS', 'CONSUMABLES', 'COSMETICS'];
  const { tab } = props;
  return mobileFrame(
    'inventory',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="menu">Back</button>
        <h1>Bag</h1>
        ${currencyPill('Gold', props.profile.gold)}
      </header>
      <nav class="tab-rail" aria-label="Inventory categories">
        ${tabs.map((item) => tabButton(item, item === tab, 'inventory-category')).join('')}
      </nav>
      <section class="inventory-grid-screen">${renderInventoryTab(props)}</section>
    `
  );
}

export function renderMissionScreen(props: MissionScreenProps): string {
  const tabs: MissionTab[] = ['STORY', 'DAILY', 'WEEKLY', 'BOSS', 'DUNGEON', 'EVENT'];
  return mobileFrame(
    'missions',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="menu">Back</button>
        <h1>Quests</h1>
        <span class="mini-rank">${props.profile.completedMissions.length} done</span>
      </header>
      <nav class="tab-rail" aria-label="Mission categories">
        ${tabs.map((item) => tabButton(item, item === props.selectedTab, 'mission-category')).join('')}
      </nav>
      <section class="mission-board-screen">${renderMissionTab(props)}</section>
    `
  );
}

export function renderBattlePrepScreen(props: PrepScreenProps): string {
  const rewardLabel = [
    `${props.mission.rewards.xp} XP`,
    `${props.mission.rewards.gold} Gold`,
    formatCost(props.mission.rewards.materials ?? {})
  ].filter(Boolean).join(' · ');

  return mobileFrame(
    'missions',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="missions">Back</button>
        <h1>Prepare</h1>
        <span class="mini-rank">LV ${props.mission.recommendedLevel}</span>
      </header>
      <section class="prep-layout">
        <article class="prep-card glass-panel">
          <span class="screen-kicker">${props.mission.chapter}</span>
          <h2>${props.mission.title}</h2>
          <p>${props.mission.narrative}</p>
          <div class="prep-facts">
            ${stat('Difficulty', props.mission.difficulty)}
            ${stat('Enemy', inferEnemyType(props.mission))}
            ${stat('Reward', rewardLabel)}
          </div>
        </article>
        <article class="prep-card glass-panel">
          <h3>Selected Team</h3>
          <div class="team-slots">
            ${props.party.map((character, index) => `<button class="team-slot ${index === props.selectedSlot ? 'active' : ''}" type="button" data-team-slot="${index}">${portraitMarkup(character)}<strong>${character.codename}</strong></button>`).join('')}
          </div>
          <h3>Pick Hero</h3>
          <div class="portrait-rail inside">
            ${props.roster.map((character) => portraitButton(character, props.party.some((member) => member.id === character.id), `data-team-pick="${character.id}"`)).join('')}
          </div>
        </article>
      </section>
      <button class="play-button prep-play" type="button" data-launch-prepared="true">START</button>
    `
  );
}

export function renderMapScreen(): string {
  return mobileFrame(
    'more',
    `
      <header class="map-overlay-header">
        <button class="back-chip" type="button" data-ui-action="more">Back</button>
        <h1>World Map</h1>
      </header>
      <section class="full-map" aria-label="Shadow Requiem map">
        ${mapNode('Shadow City', 'Home', 21, 58, 'garden')}
        ${mapNode('Sealed Arena', 'Quest', 43, 65, 'missions')}
        ${mapNode('Abyss Gate', 'Dungeon', 65, 38, 'dungeon')}
        ${mapNode('Capital Arena', 'Boss', 76, 72, 'arena')}
        <span class="locked-node mobile" style="left:29%;top:26%">Dark Forest</span>
        <span class="locked-node mobile" style="left:83%;top:22%">Null Dimension</span>
      </section>
    `
  );
}

export function renderMoreScreen(): string {
  const items = [
    ['map', 'Map', 'Teleport and world nodes'],
    ['garden', 'Garden', 'Nocturne HQ'],
    ['dungeon', 'Dungeon', 'Abyss run'],
    ['arena', 'Arena', 'Boss rush'],
    ['shop', 'Shop', 'Prototype store'],
    ['archive', 'Archive', 'Lore and achievements'],
    ['settings', 'Settings', 'Controls and device']
  ];
  return mobileFrame(
    'more',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="menu">Back</button>
        <h1>More</h1>
        <span class="mini-rank">Systems</span>
      </header>
      <section class="more-grid">
        ${items.map(([action, title, copy]) => `<button class="more-tile glass-panel" type="button" data-ui-action="${action}"><strong>${title}</strong><span>${copy}</span></button>`).join('')}
      </section>
    `
  );
}

export function renderGardenScreen(): string {
  const rooms = [
    ['command', 'Command', 'Missions'],
    ['training', 'Training', 'Practice'],
    ['forge', 'Forge', 'Weapons'],
    ['laboratory', 'Lab', 'Dungeon'],
    ['library', 'Library', 'Lore'],
    ['treasury', 'Treasury', 'Materials'],
    ['teleport', 'Teleport', 'Map'],
    ['secret', 'Secret', 'Arena']
  ];
  return mobileFrame(
    'more',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="more">Back</button>
        <h1>Garden HQ</h1>
        <span class="mini-rank">Lv 1</span>
      </header>
      <section class="hq-stage glass-panel">
        <strong>Nocturne Garden</strong>
        <span>Dark fantasy headquarters shell. Rooms route to working systems.</span>
      </section>
      <section class="room-grid">
        ${rooms.map(([id, title, copy]) => `<button class="room-chip" type="button" data-room-id="${id}"><strong>${title}</strong><span>${copy}</span></button>`).join('')}
      </section>
    `
  );
}

export function renderModeScreen(kind: 'dungeon' | 'arena' | 'training'): string {
  const config = {
    dungeon: ['Abyss Dungeon', 'Three compact randomized combat rooms with scaling rewards.', 'Enter Abyss', 'start-dungeon'],
    arena: ['Capital Arena', 'Boss Rush challenge with elite enemies and a main boss.', 'Start Rush', 'start-arena'],
    training: ['Training Room', 'Practice movement, cooldowns, switching, and ultimates.', 'Train', 'start-training']
  }[kind];
  return mobileFrame(
    'more',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="more">Back</button>
        <h1>${config[0]}</h1>
        <span class="mini-rank">Mode</span>
      </header>
      <section class="mode-hero glass-panel">
        <span class="screen-kicker">Playable Mode</span>
        <h2>${config[0]}</h2>
        <p>${config[1]}</p>
        <button class="play-button inline-play" type="button" data-ui-action="${config[3]}">${config[2]}</button>
      </section>
    `
  );
}

export function renderShopScreen(profile: PlayerProfile): string {
  return mobileFrame(
    'more',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="more">Back</button>
        <h1>Shop</h1>
        ${currencyPill('Gold', profile.gold)}
      </header>
      <nav class="tab-rail" aria-label="Shop categories"><span class="tab-pill active static-pill">WEAPONS</span><span class="tab-pill static-pill">COSMETICS</span><span class="tab-pill static-pill">MATERIALS</span><span class="tab-pill static-pill">SPECIAL</span></nav>
      <section class="inventory-grid-screen">
        <article class="item-tile locked"><strong>Supporter Skin</strong><span>TODO Cosmetic-only</span></article>
        <article class="item-tile"><strong>Training Pack</strong><span>Earn in missions</span></article>
        <article class="item-tile locked"><strong>Expansion Pass</strong><span>TODO Future content</span></article>
      </section>
    `
  );
}

export function renderSettingsScreen(props: SettingsScreenProps): string {
  const tabs: SettingsTab[] = ['GENERAL', 'GRAPHICS', 'AUDIO', 'CONTROLS', 'CAMERA', 'ACCESSIBILITY', 'ACCOUNT'];
  return mobileFrame(
    'more',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="more">Back</button>
        <h1>Settings</h1>
        <span class="mini-rank">${props.selectedTab}</span>
      </header>
      <nav class="tab-rail settings-tabs" aria-label="Settings categories">
        ${tabs.map((item) => tabButton(item, item === props.selectedTab, 'settings-category')).join('')}
      </nav>
      <section class="settings-panel glass-panel">${renderSettingsTab(props.settings, props.selectedTab)}</section>
    `
  );
}

export function renderArchiveScreen(achievements: Record<string, string>, unlockedIds: string[], nullKingUnlocked: boolean): string {
  return mobileFrame(
    'more',
    `
      <header class="mobile-topbar compact-topbar">
        <button class="back-chip" type="button" data-ui-action="more">Back</button>
        <h1>Archive</h1>
        <span class="mini-rank">Lore</span>
      </header>
      <section class="archive-layout">
        <article class="lore-card glass-panel"><strong>The Eclipse Order</strong><span>A public myth and private machine.</span></article>
        <article class="lore-card glass-panel"><strong>Nocturne Garden</strong><span>A secret organization moving faster than kingdoms.</span></article>
        <article class="lore-card glass-panel"><strong>The Null King</strong><span>${nullKingUnlocked ? 'A monarch who edits memory rather than territory.' : 'Locked: complete The Awakening.'}</span></article>
      </section>
      <section class="achievement-strip">
        ${Object.entries(achievements).map(([id, name]) => `<span class="achievement-chip ${unlockedIds.includes(id) ? 'on' : ''}">${name}</span>`).join('')}
      </section>
    `
  );
}

export function renderHelpScreen(): string {
  return mobileFrame(
    'more',
    `
      <header class="mobile-topbar compact-topbar"><button class="back-chip" type="button" data-ui-action="more">Back</button><h1>Controls</h1></header>
      <section class="settings-panel glass-panel">
        <h2>Battle Controls</h2>
        <div class="setting-list">
          ${settingRow('Move', 'Left joystick / WASD')}
          ${settingRow('Attack', 'Attack button / J')}
          ${settingRow('Dodge', 'Dodge / Space')}
          ${settingRow('Skills', 'Skill buttons / K L I')}
          ${settingRow('Switch', 'Tap portrait / Swipe / Q E')}
          ${settingRow('Ultimate', 'Fill Shadow Power / U')}
        </div>
      </section>
    `
  );
}

export function renderVictoryScreen(props: VictoryScreenProps): string {
  const { mission, levelsGained, isFirstMission, materialLabel } = props;
  return `
    <div class="mobile-screen popup-screen">
      <section class="result-popup glass-panel">
        <span class="screen-kicker">Mission Complete</span>
        <h1>Victory</h1>
        <p>${mission.title}</p>
        <div class="compact-stat-grid">
          ${stat('XP', mission.rewards.xp)}
          ${stat('Gold', mission.rewards.gold)}
          ${stat('SP', mission.rewards.skillPoints)}
          ${stat('Materials', materialLabel)}
          ${stat('Level', levelsGained > 0 ? `+${levelsGained}` : '—')}
        </div>
        <div class="popup-actions">
          ${isFirstMission ? '<button class="menu-button" type="button" data-ui-action="open-upgrade">Upgrade</button>' : '<button class="menu-button" type="button" data-ui-action="save-menu">Save</button>'}
          <button class="secondary-button" type="button" data-ui-action="retry">Replay</button>
          <button class="secondary-button" type="button" data-ui-action="menu">Lobby</button>
        </div>
      </section>
    </div>
  `;
}

export function renderDefeatScreen(): string {
  return `
    <div class="mobile-screen popup-screen">
      <section class="result-popup glass-panel">
        <span class="screen-kicker">Defeat</span>
        <h1>Shadow Falls Silent</h1>
        <p>Read red telegraphs, dodge impact windows, switch heroes, and answer with Eclipse Requiem.</p>
        <div class="popup-actions">
          <button class="menu-button" type="button" data-ui-action="retry">Retry</button>
          <button class="secondary-button" type="button" data-ui-action="open-upgrade">Upgrade</button>
          <button class="secondary-button" type="button" data-ui-action="menu">Lobby</button>
        </div>
      </section>
    </div>
  `;
}

function mobileFrame(activeNav: BottomNavId, content: string): string {
  return `<div class="mobile-screen">${content}${bottomNav(activeNav)}</div>`;
}

function bottomNav(active: BottomNavId): string {
  const items: [BottomNavId, string, string][] = [
    ['home', 'HOME', 'menu'],
    ['characters', 'HERO', 'characters'],
    ['inventory', 'BAG', 'inventory'],
    ['missions', 'QUEST', 'missions'],
    ['more', 'MORE', 'more']
  ];
  return `<nav class="bottom-nav" aria-label="Primary game navigation">${items.map(([id, label, action]) => `<button class="bottom-nav-item ${id === active ? 'active' : ''}" type="button" data-ui-action="${action}"><span>${label[0]}</span><strong>${label}</strong></button>`).join('')}</nav>`;
}

function profileBlock(profile: PlayerProfile, character: CharacterData): string {
  return `
    <button class="profile-chip" type="button" data-ui-action="characters" aria-label="Open player profile">
      ${portraitMarkup(character)}
      <span><strong>Shadow Lord</strong><small>LV ${profile.level}</small></span>
    </button>
  `;
}

function currencyPill(label: string, value: number): string {
  return `<span class="currency-pill"><small>${label}</small><strong>${value}</strong></span>`;
}

function portraitMarkup(character: CharacterData): string {
  const visual = character.visuals ?? { secondary: '#7c3aed', accent: '#f43f5e' };
  return `<span class="portrait-mini" style="--orb-a:${visual.secondary};--orb-b:${visual.accent}">${character.codename.slice(0, 2)}</span>`;
}

function portraitButton(character: CharacterData, active: boolean, dataAttrs: string): string {
  return `<button class="portrait-button ${active ? 'active' : ''}" type="button" ${dataAttrs}>${portraitMarkup(character)}<strong>${character.codename}</strong></button>`;
}

function tabButton<T extends string>(item: T, active: boolean, dataName: string): string {
  return `<button class="tab-pill ${active ? 'active' : ''}" type="button" data-${dataName}="${item}">${item}</button>`;
}

function stat(label: string, value: string | number): string {
  return `<div class="mini-stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function settingRow(label: string, value: string): string {
  return `<div class="setting-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function combatPower(stats: Stats): number {
  return Math.round(stats.maxHealth * 0.8 + stats.attack * 11 + stats.defense * 8 + stats.speed * 20 + stats.shadowGainMultiplier * 80);
}

function renderCharacterTab(
  tab: CharacterTab,
  character: CharacterData,
  weapon: WeaponData,
  profile: PlayerProfile,
  attackCost: number,
  vitalityCost: number,
  shadowCost: number
): string {
  if (tab === 'SKILLS') {
    return `<div class="skill-row">${character.skills.map((skill) => `<article><strong>${skill.name}</strong><span>${skill.description}</span><small>${skill.cooldown}s CD</small></article>`).join('')}<article><strong>${character.ultimate.name}</strong><span>${character.ultimate.description}</span><small>Ultimate</small></article></div>`;
  }
  if (tab === 'EQUIPMENT') {
    return `<div class="setting-list">${settingRow('Weapon', weapon.name)}${settingRow('Rarity', weapon.rarity)}${settingRow('Passive', weapon.passive)}<button class="menu-button" type="button" data-ui-action="inventory">Open Bag</button></div>`;
  }
  if (tab === 'TALENTS') {
    return `<div class="upgrade-actions"><button class="secondary-button" type="button" data-ui-action="upgrade-attack" ${profile.gold >= attackCost ? '' : 'disabled'}>ATK ${attackCost}G</button><button class="secondary-button" type="button" data-ui-action="upgrade-vitality" ${profile.gold >= vitalityCost ? '' : 'disabled'}>HP ${vitalityCost}G</button><button class="secondary-button" type="button" data-ui-action="upgrade-shadow" ${profile.gold >= shadowCost ? '' : 'disabled'}>SHADOW ${shadowCost}G</button></div>`;
  }
  if (tab === 'STATS') {
    return `<div class="setting-list">${settingRow('Role', character.role)}${settingRow('Title', character.title)}${settingRow('Attack Rank', String(profile.upgrades.attack))}${settingRow('Vitality Rank', String(profile.upgrades.vitality))}${settingRow('Shadow Rank', String(profile.upgrades.shadow))}</div>`;
  }
  return `<div class="setting-list">${settingRow('Identity', `${character.displayName} / ${character.codename}`)}${settingRow('Rarity', character.rarity)}${settingRow('Role', character.role)}${settingRow('Weapon', weapon.name)}</div>`;
}

function renderInventoryTab(props: InventoryScreenProps): string {
  if (props.tab === 'WEAPONS') {
    return props.weapons.map((weapon) => {
      const unlocked = props.unlockedWeapons.includes(weapon.id);
      const equipped = props.equippedWeaponId === weapon.id;
      return `<article class="item-tile ${equipped ? 'selected' : ''}"><strong>${weapon.name}</strong><span>${weapon.rarity} · +${weapon.attackBonus} ATK</span><small>${weapon.passive}</small>${unlocked ? `<button class="mini-go" type="button" data-equip-weapon-id="${weapon.id}" ${equipped ? 'disabled' : ''}>${equipped ? 'ON' : 'EQUIP'}</button>` : `<button class="mini-go" type="button" data-craft-weapon-id="${weapon.id}" ${canAfford(props.inventory, weapon.unlockCost) ? '' : 'disabled'}>CRAFT</button>`}</article>`;
    }).join('');
  }
  if (props.tab === 'MATERIALS') {
    return Object.entries(props.inventory).map(([key, value]) => `<article class="item-tile"><strong>${prettyMaterial(key)}</strong><span>${value} owned</span></article>`).join('');
  }
  return Array.from({ length: 6 }, (_, index) => `<article class="item-tile locked"><strong>${props.tab} ${index + 1}</strong><span>TODO future loot</span></article>`).join('');
}

function renderMissionTab(props: MissionScreenProps): string {
  if (props.selectedTab === 'STORY') {
    return props.missions.map((mission) => missionCard(mission, props.profile.unlockedMissions.includes(mission.id), props.profile.completedMissions.includes(mission.id))).join('');
  }
  if (props.selectedTab === 'DAILY') {
    return `${quickMissionCard('Daily Training', 'Practice one combat room.', 'Training Sigils', 'training')}${quickMissionCard('Daily Abyss', 'Clear randomized rooms.', 'Shadow Shards', 'dungeon')}`;
  }
  if (props.selectedTab === 'BOSS') {
    return `${quickMissionCard('Eclipse Boss Rush', 'Elite guard, mini-boss, Warden.', 'Null Fragment', 'arena')}`;
  }
  if (props.selectedTab === 'DUNGEON') {
    return `${quickMissionCard('Abyss Dungeon', 'Three procedural rooms.', 'Forge materials', 'dungeon')}`;
  }
  return Array.from({ length: 3 }, (_, index) => `<article class="mission-card locked"><div><strong>${props.selectedTab} ${index + 1}</strong><span>Scheduled roadmap content</span></div><button class="mini-go" type="button" disabled>TODO</button></article>`).join('');
}

function missionCard(mission: MissionData, unlocked: boolean, completed: boolean): string {
  return `<article class="mission-card ${unlocked ? '' : 'locked'}"><div><strong>${mission.title}</strong><span>${mission.difficulty} · LV ${mission.recommendedLevel}</span><small>${mission.steps[0]?.objective ?? mission.narrative}</small></div><button class="mini-go" type="button" data-prepare-mission-id="${mission.id}" ${unlocked ? '' : 'disabled'}>${completed ? 'REPLAY' : 'GO'}</button></article>`;
}

function quickMissionCard(title: string, objective: string, reward: string, mode: string): string {
  return `<article class="mission-card"><div><strong>${title}</strong><span>${objective}</span><small>${reward}</small></div><button class="mini-go" type="button" data-prepare-mode="${mode}">GO</button></article>`;
}

function renderSettingsTab(settings: GameSettings, tab: SettingsTab): string {
  if (tab === 'GRAPHICS') {
    return `<div class="setting-list">${settingRow('Preset', settings.graphicsPreset)}${settingRow('FPS', `${settings.fpsCap}`)}<button class="secondary-button" type="button" data-ui-action="toggle-graphics">Cycle Preset</button><button class="secondary-button" type="button" data-ui-action="toggle-fps">Toggle FPS</button></div>`;
  }
  if (tab === 'ACCESSIBILITY') {
    return `<div class="setting-list">${settingRow('Reduced Motion', settings.reducedMotion ? 'On' : 'Off')}${settingRow('Screen Shake', settings.screenShake ? 'On' : 'Off')}<button class="secondary-button" type="button" data-ui-action="toggle-motion">Toggle Motion</button><button class="secondary-button" type="button" data-ui-action="toggle-shake">Toggle Shake</button></div>`;
  }
  if (tab === 'CONTROLS') return `<div class="setting-list">${settingRow('Touch Targets', '48dp+')}${settingRow('Joystick', 'Left fixed')}${settingRow('Skills', 'Right cluster')}${settingRow('Switch', 'One-tap portraits')}</div>`;
  if (tab === 'AUDIO') return `<div class="setting-list">${settingRow('Music', 'Procedural prototype')}${settingRow('SFX', 'Enabled')}${settingRow('Voice', 'Voice-ready TODO')}</div>`;
  if (tab === 'CAMERA') return `<div class="setting-list">${settingRow('Sensitivity', String(settings.cameraSensitivity))}${settingRow('Lock-on', 'TODO v0.2')}${settingRow('Shake', settings.screenShake ? 'Enabled' : 'Disabled')}</div>`;
  if (tab === 'ACCOUNT') return `<div class="setting-list">${settingRow('Mode', 'Offline-first')}${settingRow('Cloud Save', 'TODO')}${settingRow('Privacy', 'No analytics in MVP')}</div>`;
  return `<div class="setting-list">${settingRow('Vibration', settings.vibration ? 'On' : 'Off')}${settingRow('Graphics', settings.graphicsPreset)}${settingRow('FPS', `${settings.fpsCap}`)}</div>`;
}

function mapNode(name: string, label: string, left: number, top: number, action: string): string {
  return `<button class="map-node mobile" type="button" data-ui-action="${action}" style="left:${left}%;top:${top}%"><strong>${name}</strong><span>${label}</span></button>`;
}

function inferEnemyType(mission: MissionData): string {
  const ids = mission.steps.flatMap((step) => step.type === 'wave' ? step.spawns.map((spawn) => spawn.enemyId) : []);
  if (ids.some((id) => id.includes('warden'))) return 'Boss';
  if (ids.some((id) => id.includes('abyss'))) return 'Elite';
  return 'Mixed';
}

function prettyMaterial(key: string): string {
  const names: Record<string, string> = {
    shadowShard: 'Shadow Shards',
    eclipseCore: 'Eclipse Cores',
    nullFragment: 'Null Fragments',
    trainingSigil: 'Training Sigils'
  };
  return names[key] ?? key;
}

function formatCost(cost: Record<string, number>): string {
  const entries = Object.entries(cost);
  if (!entries.length) return '';
  return entries.map(([key, value]) => `${value} ${prettyMaterial(key)}`).join(' · ');
}

function canAfford(inventory: MaterialBag, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([key, value]) => (inventory[key] ?? 0) >= value);
}
