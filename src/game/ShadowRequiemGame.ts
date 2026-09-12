import { App as CapacitorApp } from '@capacitor/app';
import * as THREE from 'three';
import { AudioEngine } from './audio';
import { characters, defaultParty, enemies, missions, protagonist, weapons } from './content';
import {
  SHADOW_POWER_MAX,
  addShadowPower,
  applyXp,
  clamp,
  computeDamage,
  deriveStats,
  formatCooldown,
  levelXpRequirement,
  upgradeGoldCost
} from './systems/combat';
import { SaveManager, createNewSave } from './systems/save';
import {
  type CharacterTab,
  type GeneratedModeId,
  type InventoryTab,
  type MissionTab,
  type SettingsTab,
  renderArchiveScreen,
  renderBattlePrepScreen,
  renderCharacterScreen as renderMobileCharacterScreen,
  renderDailyRewardScreen,
  renderDefeatScreen,
  renderGardenScreen,
  renderHelpScreen,
  renderInventoryScreen as renderMobileInventoryScreen,
  renderLobbyModeOverlay,
  renderMailScreen,
  renderMainLobby,
  renderMapScreen as renderMobileMapScreen,
  renderMissionScreen as renderMobileMissionScreen,
  renderModeScreen,
  renderMoreScreen,
  renderSettingsScreen as renderMobileSettingsScreen,
  renderShopScreen,
  renderVictoryScreen
} from './ui/mobileScreens';
import type { CharacterData, EnemyAIStyle, EnemyData, GameScreen, MissionData, MissionReward, PlayerProfile, SaveData, Stats, WeaponData } from './types';

const ARENA_LIMIT = 21;
const PLAYER_RADIUS = 0.85;

type InputAction = 'attack' | 'skill1' | 'skill2' | 'skill3' | 'dodge' | 'ultimate';

type UIAction =
  | 'new-game'
  | 'continue'
  | 'story'
  | 'characters'
  | 'weapons'
  | 'inventory'
  | 'map'
  | 'missions'
  | 'garden'
  | 'dungeon'
  | 'arena'
  | 'shop'
  | 'more'
  | 'archive'
  | 'settings'
  | 'help'
  | 'daily-reward'
  | 'mail'
  | 'play-modes'
  | 'lobby-inspect'
  | 'menu'
  | 'intro-next'
  | 'intro-skip'
  | 'open-upgrade'
  | 'start-second'
  | 'save-menu'
  | 'retry'
  | 'launch-prepared'
  | 'start-dungeon'
  | 'start-arena'
  | 'start-training'
  | 'upgrade-attack'
  | 'upgrade-vitality'
  | 'upgrade-shadow'
  | 'toggle-shake'
  | 'toggle-motion'
  | 'toggle-fps'
  | 'toggle-graphics';

interface PlayerEntity {
  object: THREE.Group;
  hp: number;
  maxHp: number;
  radius: number;
  cooldowns: Map<string, number>;
  attackReadyAt: number;
  invulnerableUntil: number;
  dodgeUntil: number;
  dodgeVelocity: THREE.Vector3;
  barrierUntil: number;
  shadowPower: number;
  combo: number;
  comboExpiresAt: number;
  facing: number;
  stats: Stats;
}

interface PendingAttack {
  impactAt: number;
  radius: number;
  damage: number;
  label: string;
  color: string;
}

interface EnemyEntity {
  id: string;
  data: EnemyData;
  object: THREE.Group;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  radius: number;
  stagger: number;
  staggerMax: number;
  xpReward: number;
  goldReward: number;
  aiStyle: EnemyAIStyle;
  attackReadyAt: number;
  abilityReadyAt: number;
  stunnedUntil: number;
  pendingAttack?: PendingAttack;
  alive: boolean;
  bossPhase: number;
  abilityIndex: number;
}

interface ProjectileEntity {
  object: THREE.Mesh;
  velocity: THREE.Vector3;
  damage: number;
  radius: number;
  life: number;
  from: 'enemy' | 'player';
  color: string;
}

interface EffectEntity {
  object: THREE.Object3D;
  life: number;
  maxLife: number;
  velocity?: THREE.Vector3;
  expand?: number;
  fade?: boolean;
}

interface DamageLabel {
  element: HTMLDivElement;
  world: THREE.Vector3;
  life: number;
  maxLife: number;
  lift: number;
}

interface RuntimeRefs {
  sceneHost: HTMLDivElement;
  overlay: HTMLDivElement;
  hud: HTMLDivElement;
  touchControls: HTMLDivElement;
  damageLayer: HTMLDivElement;
  healthFill: HTMLSpanElement;
  shadowFill: HTMLSpanElement;
  xpFill: HTMLSpanElement;
  activeCodename: HTMLDivElement;
  activeName: HTMLElement;
  playerLevel: HTMLSpanElement;
  playerGold: HTMLSpanElement;
  playerXp: HTMLSpanElement;
  objectiveCopy: HTMLParagraphElement;
  bossPanel: HTMLDivElement;
  bossName: HTMLSpanElement;
  bossPhase: HTMLSpanElement;
  bossFill: HTMLSpanElement;
  comboBadge: HTMLDivElement;
  toast: HTMLDivElement;
  joystickZone: HTMLDivElement;
  joystickThumb: HTMLDivElement;
  minimapGrid: HTMLDivElement;
  partyBar: HTMLDivElement;
  actionButtons: Map<InputAction, HTMLButtonElement>;
}

export class ShadowRequiemGame {
  private readonly root: HTMLElement;
  private readonly saveManager = new SaveManager();
  private readonly audio = new AudioEngine();
  private saveData: SaveData;
  private profile: PlayerProfile;
  private refs!: RuntimeRefs;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private player!: PlayerEntity;
  private enemies: EnemyEntity[] = [];
  private projectiles: ProjectileEntity[] = [];
  private effects: EffectEntity[] = [];
  private damageLabels: DamageLabel[] = [];
  private screen: GameScreen = 'menu';
  private currentMission: MissionData | null = null;
  private currentStepIndex = -1;
  private currentObjective = 'Awaiting mission.';
  private waveAdvanceAt = 0;
  private waypointMarker: THREE.Group | null = null;
  private activeBoss: EnemyEntity | null = null;
  private cameraYaw = Math.PI;
  private cameraPitch = 0.34;
  private cameraShake = 0;
  private joystickPointerId: number | null = null;
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private moveInput = new THREE.Vector2();
  private readonly keys = new Set<string>();
  private animationFrame = 0;
  private introIndex = 0;
  private ultimateImpactAt = 0;
  private ultimateEndsAt = 0;
  private ultimateDidImpact = false;
  private lastFrameSecond = 0;
  private enemySerial = 0;
  private arenaRoot!: THREE.Group;
  private lobbyRoot!: THREE.Group;
  private lobbyHero: THREE.Group | null = null;
  private lobbyParticles: THREE.Mesh[] = [];
  private lobbyAnimatedObjects: THREE.Object3D[] = [];
  private lobbyPointerId: number | null = null;
  private lobbyPointers = new Map<number, { x: number; y: number }>();
  private lobbyPinchDistance = 0;
  private lobbyPinchZoomStart = 1;
  private lobbyHeroYaw = Math.PI;
  private lobbyZoom = 1;
  private lobbyPointerMoved = false;
  private lobbyLastTapAt = 0;
  private lobbyInspectUntil = 0;
  private lobbyHeroEntranceAt = 0;
  private characterTab: CharacterTab = 'OVERVIEW';
  private inventoryTab: InventoryTab = 'WEAPONS';
  private missionTab: MissionTab = 'STORY';
  private settingsTab: SettingsTab = 'GENERAL';
  private preparedMission: MissionData | null = null;
  private preparedCheckpointMissionId = 'awakening';
  private selectedTeamSlot = 0;
  private partySwipeStartX = 0;
  private partySwipePointerId: number | null = null;
  private readonly achievementCatalog: Record<string, string> = {
    firstBlood: 'First Blood',
    perfectDodge: 'Perfect Dodge',
    shadowAwakening: 'Shadow Awakening',
    sevenCommanders: 'Seven Commanders',
    bossDestroyer: 'Boss Destroyer',
    dungeonMaster: 'Dungeon Master',
    ultimateFinish: 'Ultimate Finish'
  };
  private readonly introLines = [
    {
      kicker: 'Underground Chamber',
      title: 'Whispers Beneath a Ruined Kingdom',
      copy: 'Black particles drift through a sealed arena. A voice from the Eclipse Order calls the subject incomplete. The subject opens his eyes and smiles.'
    },
    {
      kicker: 'Civilian Identity',
      title: 'Noctis Veyr',
      copy: 'To the world he is ordinary, unserious, and forgettable. In the dark, he is the impossible answer to an experiment that should never have awakened.'
    },
    {
      kicker: 'Shadow Identity',
      title: 'Every Legend Begins in the Darkness',
      copy: 'The first mission teaches movement, sword combat, dodge timing, shadow skills, and the Eclipse Requiem ultimate against a boss with four phases.'
    }
  ];

  constructor(root: HTMLElement) {
    this.root = root;
    this.saveData = this.saveManager.load() ?? createNewSave();
    this.profile = this.saveData.profile;
    this.buildShell();
    this.setupThree();
    this.bindEvents();
    this.showLoadingScreen();
    window.setTimeout(() => this.showMenu(), 680);
    this.animationFrame = window.requestAnimationFrame((time) => this.loop(time));
  }

  destroy(): void {
    window.cancelAnimationFrame(this.animationFrame);
    this.renderer.dispose();
    this.root.innerHTML = '';
  }

  private getActiveCharacter(): CharacterData {
    return characters[this.profile.activeCharacterId] ?? protagonist;
  }

  private getActiveParty(): CharacterData[] {
    const partyIds = this.profile.activeParty?.length ? this.profile.activeParty : defaultParty;
    return partyIds.map((id) => characters[id]).filter(Boolean);
  }

  private getActiveWeapon(): WeaponData {
    return weapons[this.profile.equippedWeaponId] ?? weapons['nocturne-katana'];
  }

  private getComputedStats(character = this.getActiveCharacter()): Stats {
    const stats = deriveStats(character.baseStats, this.profile.level, this.profile.upgrades);
    const weapon = this.getActiveWeapon();
    return {
      ...stats,
      attack: stats.attack + weapon.attackBonus,
      shadowGainMultiplier: weapon.id === 'null-requiem' ? stats.shadowGainMultiplier + 0.18 : stats.shadowGainMultiplier
    };
  }

  private buildShell(): void {
    this.root.innerHTML = `
      <main class="game-shell">
        <div id="sceneHost" class="scene-host" aria-label="3D tutorial arena"></div>
        <div class="vignette" aria-hidden="true"></div>
        <div id="damageLayer" class="damage-layer" aria-hidden="true"></div>

        <section id="hud" class="hud hidden" aria-label="Combat HUD">
          <div class="hud-top">
            <div class="player-panel glass-panel">
              <div class="player-name-row">
                <div>
                  <div id="activeCodename" class="codename">SHADOW</div>
                  <strong id="activeName">Noctis Veyr</strong>
                </div>
                <span id="playerLevel" class="level-chip">LV 1</span>
              </div>
              <div class="bar-stack" aria-hidden="true">
                <div class="bar"><span id="healthFill" class="health-fill"></span></div>
                <div class="bar"><span id="shadowFill" class="shadow-fill"></span></div>
                <div class="bar"><span id="xpFill" class="xp-fill"></span></div>
              </div>
              <div class="resource-row">
                <span id="playerXp">XP 0 / 144</span>
                <span id="playerGold">GOLD 0</span>
              </div>
            </div>

            <div class="objective-panel glass-panel" role="status" aria-live="polite">
              <p class="objective-title">Mission Objective</p>
              <p id="objectiveCopy" class="objective-copy">Awaiting mission.</p>
            </div>

            <div class="minimap glass-panel" aria-label="Arena mini map">
              <div id="minimapGrid" class="minimap-grid"></div>
            </div>
          </div>
        </section>

        <section id="bossPanel" class="boss-panel glass-panel hidden" aria-label="Boss status">
          <div class="boss-title-row">
            <span id="bossName" class="boss-name">Boss</span>
            <span id="bossPhase" class="phase-chip">Phase 1</span>
          </div>
          <div class="bar boss-bar" aria-hidden="true"><span id="bossFill" class="boss-fill"></span></div>
        </section>

        <div id="comboBadge" class="combo-badge glass-panel hidden" aria-live="polite">0 HIT</div>
        <div id="toast" class="toast glass-panel hidden" role="status" aria-live="polite"></div>
        <div id="partyBar" class="party-bar glass-panel hidden" aria-label="Character switch portraits"></div>

        <section id="touchControls" class="touch-controls hidden" aria-label="Touch combat controls">
          <div id="joystickZone" class="joystick-zone" aria-label="Virtual joystick" role="application">
            <div class="joystick-ring"><div id="joystickThumb" class="joystick-thumb"></div></div>
          </div>
          <div class="action-cluster">
            <button class="action-button primary" type="button" data-action="attack" aria-label="Normal sword attack">Attack</button>
            <button class="action-button" type="button" data-action="skill1" aria-label="Skill 1 Shadow Step">Step<span class="cooldown-label" hidden></span></button>
            <button class="action-button" type="button" data-action="skill2" aria-label="Skill 2 Umbral Bloom">Bloom<span class="cooldown-label" hidden></span></button>
            <button class="action-button" type="button" data-action="skill3" aria-label="Skill 3 Nocturne Barrier">Guard<span class="cooldown-label" hidden></span></button>
            <button class="action-button" type="button" data-action="dodge" aria-label="Dodge">Dodge<span class="cooldown-label" hidden></span></button>
            <button class="action-button ultimate" type="button" data-action="ultimate" aria-label="Ultimate Eclipse Requiem">Ultimate<span class="cooldown-label" hidden></span></button>
          </div>
        </section>

        <section id="overlay" class="overlay" aria-label="Game screens"></section>
      </main>
    `;

    const qs = <T extends HTMLElement>(selector: string): T => {
      const element = this.root.querySelector<T>(selector);
      if (!element) throw new Error(`Missing UI element: ${selector}`);
      return element;
    };

    const actionButtons = new Map<InputAction, HTMLButtonElement>();
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-action]')) {
      actionButtons.set(button.dataset.action as InputAction, button);
    }

    this.refs = {
      sceneHost: qs<HTMLDivElement>('#sceneHost'),
      overlay: qs<HTMLDivElement>('#overlay'),
      hud: qs<HTMLDivElement>('#hud'),
      touchControls: qs<HTMLDivElement>('#touchControls'),
      damageLayer: qs<HTMLDivElement>('#damageLayer'),
      activeCodename: qs<HTMLDivElement>('#activeCodename'),
      activeName: qs<HTMLElement>('#activeName'),
      healthFill: qs<HTMLSpanElement>('#healthFill'),
      shadowFill: qs<HTMLSpanElement>('#shadowFill'),
      xpFill: qs<HTMLSpanElement>('#xpFill'),
      playerLevel: qs<HTMLSpanElement>('#playerLevel'),
      playerGold: qs<HTMLSpanElement>('#playerGold'),
      playerXp: qs<HTMLSpanElement>('#playerXp'),
      objectiveCopy: qs<HTMLParagraphElement>('#objectiveCopy'),
      bossPanel: qs<HTMLDivElement>('#bossPanel'),
      bossName: qs<HTMLSpanElement>('#bossName'),
      bossPhase: qs<HTMLSpanElement>('#bossPhase'),
      bossFill: qs<HTMLSpanElement>('#bossFill'),
      comboBadge: qs<HTMLDivElement>('#comboBadge'),
      toast: qs<HTMLDivElement>('#toast'),
      joystickZone: qs<HTMLDivElement>('#joystickZone'),
      joystickThumb: qs<HTMLDivElement>('#joystickThumb'),
      minimapGrid: qs<HTMLDivElement>('#minimapGrid'),
      partyBar: qs<HTMLDivElement>('#partyBar'),
      actionButtons
    };
  }

  private setupThree(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070713');
    this.scene.fog = new THREE.Fog('#070713', 20, 56);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#070713', 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.updateRendererQuality();
    this.refs.sceneHost.appendChild(this.renderer.domElement);

    const ambient = new THREE.HemisphereLight('#b8a7ff', '#10040f', 1.35);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight('#ffffff', 1.6);
    key.position.set(-6, 10, 8);
    key.castShadow = true;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 50;
    key.shadow.camera.left = -24;
    key.shadow.camera.right = 24;
    key.shadow.camera.top = 24;
    key.shadow.camera.bottom = -24;
    this.scene.add(key);

    const rim = new THREE.PointLight('#7c3aed', 42, 30);
    rim.position.set(0, 6, -8);
    this.scene.add(rim);

    this.lobbyRoot = new THREE.Group();
    this.lobbyRoot.name = 'Nocturne Garden HQ lobby';
    this.scene.add(this.lobbyRoot);
    this.arenaRoot = new THREE.Group();
    this.arenaRoot.name = 'Combat arena';
    this.scene.add(this.arenaRoot);

    this.createLobbyEnvironment();
    this.createArena();
    this.createWaypointMarker();
    this.createPlayer();
    this.setSceneMode('lobby');
    this.resize();
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('beforeunload', () => this.persist());
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      if (event.code === 'Space') this.handleInputAction('dodge');
      if (event.code === 'KeyJ' || event.code === 'Enter') this.handleInputAction('attack');
      if (event.code === 'KeyK') this.handleInputAction('skill1');
      if (event.code === 'KeyL') this.handleInputAction('skill2');
      if (event.code === 'KeyI') this.handleInputAction('skill3');
      if (event.code === 'KeyU') this.handleInputAction('ultimate');
      if (event.code === 'KeyQ') this.switchPartyRelative(-1);
      if (event.code === 'KeyE') this.switchPartyRelative(1);
      if (event.code === 'Escape' && this.screen === 'playing') this.showMenu();
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('contextmenu', (event) => event.preventDefault());
    void CapacitorApp.addListener('backButton', () => {
      if (this.screen === 'playing') {
        this.showMenu('Paused from Android back button. Continue resumes the mission checkpoint.');
        return;
      }
      if (this.screen !== 'menu') {
        this.showMenu();
        return;
      }
      void CapacitorApp.exitApp();
    }).catch(() => undefined);

    for (const [action, button] of this.refs.actionButtons) {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        button.classList.add('pressed');
        void this.handleInputAction(action);
      });
      button.addEventListener('pointerup', () => button.classList.remove('pressed'));
      button.addEventListener('pointercancel', () => button.classList.remove('pressed'));
      button.addEventListener('pointerleave', () => button.classList.remove('pressed'));
    }

    this.refs.overlay.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>(
        '[data-ui-action], [data-prepare-mission-id], [data-prepare-mode], [data-launch-prepared], [data-character-id], [data-character-tab], [data-inventory-category], [data-mission-category], [data-settings-category], [data-team-slot], [data-team-pick], [data-equip-weapon-id], [data-craft-weapon-id], [data-room-id]'
      );
      if (!button || button.disabled) return;
      if (button.dataset.prepareMissionId) {
        this.prepareMission(button.dataset.prepareMissionId);
        return;
      }
      if (button.dataset.prepareMode) {
        this.prepareGeneratedMode(button.dataset.prepareMode as GeneratedModeId);
        return;
      }
      if (button.dataset.launchPrepared) {
        this.launchPreparedMission();
        return;
      }
      if (button.dataset.characterId) {
        const cameFromLobby = this.screen === 'menu';
        this.setActiveCharacter(button.dataset.characterId, this.screen === 'character');
        if (cameFromLobby) this.showMenu();
        return;
      }
      if (button.dataset.characterTab) {
        this.characterTab = button.dataset.characterTab as CharacterTab;
        this.showCharacterScreen();
        return;
      }
      if (button.dataset.inventoryCategory) {
        this.inventoryTab = button.dataset.inventoryCategory as InventoryTab;
        this.showInventoryScreen();
        return;
      }
      if (button.dataset.missionCategory) {
        this.missionTab = button.dataset.missionCategory as MissionTab;
        this.showMissionsScreen();
        return;
      }
      if (button.dataset.settingsCategory) {
        this.settingsTab = button.dataset.settingsCategory as SettingsTab;
        this.showSettings();
        return;
      }
      if (button.dataset.teamSlot) {
        this.selectedTeamSlot = Number(button.dataset.teamSlot);
        this.showBattlePrepScreen();
        return;
      }
      if (button.dataset.teamPick) {
        this.pickPreparedTeamMember(button.dataset.teamPick);
        return;
      }
      if (button.dataset.equipWeaponId) {
        this.equipWeapon(button.dataset.equipWeaponId);
        return;
      }
      if (button.dataset.craftWeaponId) {
        this.craftWeapon(button.dataset.craftWeaponId);
        return;
      }
      if (button.dataset.roomId) {
        this.showGardenRoom(button.dataset.roomId);
        return;
      }
      const action = button.dataset.uiAction as UIAction;
      void this.handleUIAction(action);
    });

    this.refs.partyBar.addEventListener('click', (event) => {
      if (this.screen !== 'playing') return;
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLButtonElement>('[data-party-index]');
      if (!button) return;
      this.switchPartyTo(Number(button.dataset.partyIndex));
    });
    this.refs.partyBar.addEventListener('pointerdown', (event) => {
      this.partySwipePointerId = event.pointerId;
      this.partySwipeStartX = event.clientX;
    });
    this.refs.partyBar.addEventListener('pointerup', (event) => {
      if (event.pointerId !== this.partySwipePointerId) return;
      const deltaX = event.clientX - this.partySwipeStartX;
      this.partySwipePointerId = null;
      if (Math.abs(deltaX) > 44) this.switchPartyRelative(deltaX < 0 ? 1 : -1);
    });

    this.refs.joystickZone.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      this.refs.joystickZone.setPointerCapture(event.pointerId);
      this.updateJoystick(event.clientX, event.clientY);
    });
    this.refs.joystickZone.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.joystickPointerId) return;
      this.updateJoystick(event.clientX, event.clientY);
    });
    const endJoystick = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.moveInput.set(0, 0);
      this.refs.joystickThumb.style.transform = 'translate(-50%, -50%)';
    };
    this.refs.joystickZone.addEventListener('pointerup', endJoystick);
    this.refs.joystickZone.addEventListener('pointercancel', endJoystick);

    this.refs.sceneHost.addEventListener('pointerdown', (event) => {
      if (this.screen === 'playing') {
        this.lookPointerId = event.pointerId;
        this.lastLookX = event.clientX;
        this.lastLookY = event.clientY;
        this.refs.sceneHost.setPointerCapture(event.pointerId);
        return;
      }
      if (this.isLobbyInteractive()) this.beginLobbyPointer(event);
    });
    this.refs.sceneHost.addEventListener('pointermove', (event) => {
      if (this.screen === 'playing') {
        if (event.pointerId !== this.lookPointerId) return;
        const sensitivity = this.profile.settings.cameraSensitivity;
        const dx = event.clientX - this.lastLookX;
        const dy = event.clientY - this.lastLookY;
        this.lastLookX = event.clientX;
        this.lastLookY = event.clientY;
        this.cameraYaw -= dx * 0.0045 * sensitivity;
        this.cameraPitch = clamp(this.cameraPitch + dy * 0.0022 * sensitivity, 0.12, 0.72);
        return;
      }
      if (this.isLobbyInteractive()) this.moveLobbyPointer(event);
    });
    const endLook = (event: PointerEvent): void => {
      if (this.screen === 'playing') {
        if (event.pointerId === this.lookPointerId) this.lookPointerId = null;
        return;
      }
      if (this.isLobbyInteractive()) this.endLobbyPointer(event);
    };
    this.refs.sceneHost.addEventListener('pointerup', endLook);
    this.refs.sceneHost.addEventListener('pointercancel', endLook);
  }

  private async handleUIAction(action: UIAction): Promise<void> {
    await this.audio.resume();
    this.audio.click();
    this.audio.startMusic(this.profile.activeCharacterId === 'shadow' ? 'shadow' : 'menu');

    switch (action) {
      case 'new-game':
        this.startNewGame();
        break;
      case 'continue':
        this.continueGame();
        break;
      case 'story':
      case 'missions':
        this.showMissionsScreen();
        break;
      case 'characters':
        this.showCharacterScreen();
        break;
      case 'weapons':
        this.inventoryTab = 'WEAPONS';
        this.showInventoryScreen();
        break;
      case 'inventory':
        this.showInventoryScreen();
        break;
      case 'map':
        this.showMapScreen();
        break;
      case 'garden':
        this.showGardenScreen();
        break;
      case 'dungeon':
        this.showDungeonScreen();
        break;
      case 'arena':
        this.showArenaScreen();
        break;
      case 'shop':
        this.showShopScreen();
        break;
      case 'more':
        this.showMoreScreen();
        break;
      case 'archive':
        this.showArchiveScreen();
        break;
      case 'settings':
        this.showSettings();
        break;
      case 'help':
        this.showHelp();
        break;
      case 'daily-reward':
        this.showDailyRewardScreen();
        break;
      case 'mail':
        this.showMailScreen();
        break;
      case 'play-modes':
        this.showLobbyModeSelection();
        break;
      case 'lobby-inspect':
        this.triggerLobbyInteraction();
        break;
      case 'menu':
        this.persist();
        this.showMenu();
        break;
      case 'intro-next':
        this.advanceIntro();
        break;
      case 'intro-skip':
        this.prepareMission('awakening');
        break;
      case 'open-upgrade':
        this.showCharacterScreen();
        break;
      case 'start-second':
        this.prepareMission('shadow-trace');
        break;
      case 'save-menu':
        this.persist();
        this.showMenu('Progress saved. Continue resumes from your latest unlocked mission.');
        break;
      case 'retry':
        if (this.currentMission?.id === 'abyss-dungeon-run') this.startGeneratedMission('dungeon');
        else if (this.currentMission?.id === 'arena-boss-rush') this.startGeneratedMission('boss');
        else if (this.currentMission?.id === 'arena-skirmish') this.startGeneratedMission('arena');
        else if (this.currentMission?.id === 'training-simulation') this.startGeneratedMission('training');
        else this.startMission(this.currentMission?.id ?? this.profile.lastMissionId ?? 'awakening');
        break;
      case 'launch-prepared':
        this.launchPreparedMission();
        break;
      case 'start-dungeon':
        this.prepareGeneratedMode('dungeon');
        break;
      case 'start-arena':
        this.prepareGeneratedMode('arena');
        break;
      case 'start-training':
        this.prepareGeneratedMode('training');
        break;
      case 'upgrade-attack':
        this.purchaseUpgrade('attack');
        break;
      case 'upgrade-vitality':
        this.purchaseUpgrade('vitality');
        break;
      case 'upgrade-shadow':
        this.purchaseUpgrade('shadow');
        break;
      case 'toggle-shake':
        this.profile.settings.screenShake = !this.profile.settings.screenShake;
        this.persist();
        this.showSettings();
        break;
      case 'toggle-motion':
        this.profile.settings.reducedMotion = !this.profile.settings.reducedMotion;
        this.persist();
        this.showSettings();
        break;
      case 'toggle-fps':
        this.profile.settings.fpsCap = this.profile.settings.fpsCap === 60 ? 30 : 60;
        this.persist();
        this.showSettings();
        break;
      case 'toggle-graphics':
        this.cycleGraphicsPreset();
        this.persist();
        this.showSettings();
        break;
      default:
        action satisfies never;
    }
  }

  private async handleInputAction(action: InputAction): Promise<void> {
    if (this.screen !== 'playing') return;
    await this.audio.resume();
    this.audio.startMusic(this.activeBoss?.aiStyle === 'boss' ? 'boss' : 'battle');

    switch (action) {
      case 'attack':
        this.basicAttack();
        break;
      case 'skill1':
        this.useSkill(0);
        break;
      case 'skill2':
        this.useSkill(1);
        break;
      case 'skill3':
        this.useSkill(2);
        break;
      case 'dodge':
        this.dodge();
        break;
      case 'ultimate':
        this.useUltimate();
        break;
      default:
        action satisfies never;
    }
  }

  private showLoadingScreen(): void {
    this.screen = 'menu';
    this.setCombatUI(false);
    this.setSceneMode('lobby');
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.classList.remove('lobby-overlay');
    this.refs.overlay.innerHTML = `
      <div class="mobile-screen loading-screen">
        <section class="loading-mark glass-panel">
          <span class="screen-kicker">Original Anime Action RPG</span>
          <h1>SHADOW REQUIEM</h1>
          <p>Loading Nocturne Garden HQ</p>
          <div class="loading-bar"><span></span></div>
        </section>
      </div>
    `;
  }

  private showMenu(message?: string): void {
    this.screen = 'menu';
    this.setCombatUI(false);
    this.setSceneMode('lobby');
    this.refs.overlay.classList.add('lobby-overlay');
    this.refs.overlay.classList.remove('hidden');
    const loadedSave = this.saveManager.load();
    const hasSave = loadedSave !== null;
    if (loadedSave) {
      this.saveData = loadedSave;
      this.profile = loadedSave.profile;
      this.setSceneMode('lobby');
    }
    this.refs.overlay.innerHTML = renderMainLobby({
      profile: this.profile,
      activeCharacter: this.getActiveCharacter(),
      activeWeapon: this.getActiveWeapon(),
      roster: Object.values(characters).filter((character) => this.profile.unlockedCharacters.includes(character.id)),
      hasSave,
      message,
      activeNav: 'home'
    });
  }

  private showHelp(): void {
    this.screen = 'more';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('lobby-overlay');
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderHelpScreen();
  }

  private showLobbyModeSelection(): void {
    this.screen = 'menu';
    this.setCombatUI(false);
    this.setSceneMode('lobby');
    this.refs.overlay.classList.add('lobby-overlay');
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderLobbyModeOverlay({
      profile: this.profile,
      activeCharacter: this.getActiveCharacter(),
      activeWeapon: this.getActiveWeapon(),
      roster: Object.values(characters).filter((character) => this.profile.unlockedCharacters.includes(character.id)),
      hasSave: this.saveManager.hasSave(),
      activeNav: 'home'
    });
  }

  private showDailyRewardScreen(): void {
    this.screen = 'daily';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('lobby-overlay');
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderDailyRewardScreen(this.profile);
  }

  private showMailScreen(): void {
    this.screen = 'mail';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('lobby-overlay');
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderMailScreen();
  }

  private showMissionsScreen(): void {
    this.screen = 'missions';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderMobileMissionScreen({
      profile: this.profile,
      missions: Object.values(missions),
      selectedTab: this.missionTab,
      activeNav: 'missions'
    });
  }

  private showMapScreen(): void {
    this.screen = 'map';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderMobileMapScreen();
  }

  private showGardenScreen(): void {
    this.screen = 'garden';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderGardenScreen();
  }

  private showGardenRoom(roomId: string): void {
    switch (roomId) {
      case 'command':
        this.showMissionsScreen();
        return;
      case 'training':
        this.prepareGeneratedMode('training');
        return;
      case 'forge':
      case 'treasury':
        this.showInventoryScreen();
        return;
      case 'laboratory':
        this.showDungeonScreen();
        return;
      case 'library':
        this.showArchiveScreen();
        return;
      case 'teleport':
        this.showMapScreen();
        return;
      case 'secret':
        this.showArenaScreen();
        return;
      default:
        this.showGardenScreen();
    }
  }

  private showInventoryScreen(): void {
    this.screen = 'inventory';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderMobileInventoryScreen({
      profile: this.profile,
      weapons: Object.values(weapons),
      equippedWeaponId: this.profile.equippedWeaponId,
      unlockedWeapons: this.profile.unlockedWeapons,
      inventory: this.profile.inventory,
      tab: this.inventoryTab,
      activeNav: 'inventory'
    });
  }

  private showDungeonScreen(): void {
    this.screen = 'more';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderModeScreen('dungeon');
  }

  private showArenaScreen(): void {
    this.screen = 'more';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderModeScreen('arena');
  }

  private showArchiveScreen(): void {
    this.screen = 'archive';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderArchiveScreen(
      this.achievementCatalog,
      this.profile.achievements,
      this.profile.completedMissions.includes('awakening')
    );
  }

  private showMoreScreen(): void {
    this.screen = 'more';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderMoreScreen();
  }

  private showShopScreen(): void {
    this.screen = 'shop';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderShopScreen(this.profile);
  }

  private unlockAchievement(id: keyof ShadowRequiemGame['achievementCatalog']): void {
    if (this.profile.achievements.includes(id)) return;
    this.profile.achievements.push(id);
    this.toast(`Achievement unlocked: ${this.achievementCatalog[id]}`);
    this.persist();
  }

  private prettyMaterial(key: string): string {
    const names: Record<string, string> = {
      shadowShard: 'Shadow Shards',
      eclipseCore: 'Eclipse Cores',
      nullFragment: 'Null Fragments',
      trainingSigil: 'Training Sigils'
    };
    return names[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
  }

  private formatCost(cost: Record<string, number>): string {
    const entries = Object.entries(cost);
    if (entries.length === 0) return 'Unlocked';
    return entries.map(([key, value]) => `${value} ${this.prettyMaterial(key)}`).join(' · ');
  }

  private canAffordMaterials(cost: Record<string, number>): boolean {
    return Object.entries(cost).every(([key, value]) => (this.profile.inventory[key] ?? 0) >= value);
  }

  private grantMaterials(materials: Record<string, number> = {}): void {
    for (const [key, value] of Object.entries(materials)) {
      this.profile.inventory[key] = (this.profile.inventory[key] ?? 0) + value;
    }
  }

  private consumeMaterials(cost: Record<string, number>): void {
    for (const [key, value] of Object.entries(cost)) {
      this.profile.inventory[key] = Math.max(0, (this.profile.inventory[key] ?? 0) - value);
    }
  }

  private equipWeapon(weaponId: string): void {
    if (!weapons[weaponId] || !this.profile.unlockedWeapons.includes(weaponId)) return;
    this.profile.equippedWeaponId = weaponId;
    this.syncPlayerStatsFromProfile(true);
    this.persist();
    this.showInventoryScreen();
  }

  private craftWeapon(weaponId: string): void {
    const weapon = weapons[weaponId];
    if (!weapon || this.profile.unlockedWeapons.includes(weaponId) || !this.canAffordMaterials(weapon.unlockCost)) return;
    this.consumeMaterials(weapon.unlockCost);
    this.profile.unlockedWeapons.push(weaponId);
    this.profile.equippedWeaponId = weaponId;
    this.syncPlayerStatsFromProfile(true);
    this.persist();
    this.showInventoryScreen();
  }

  private cycleGraphicsPreset(): void {
    const order: PlayerProfile['settings']['graphicsPreset'][] = ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'];
    const index = order.indexOf(this.profile.settings.graphicsPreset);
    this.profile.settings.graphicsPreset = order[(index + 1) % order.length];
    this.updateRendererQuality();
  }

  private showSettings(): void {
    this.screen = 'settings';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderMobileSettingsScreen({
      profile: this.profile,
      settings: this.profile.settings,
      selectedTab: this.settingsTab,
      activeNav: 'more'
    });
  }

  private startNewGame(): void {
    this.saveManager.clear();
    this.saveData = createNewSave();
    this.profile = this.saveData.profile;
    this.resetPlayerForMission();
    this.introIndex = 0;
    this.screen = 'intro';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.renderIntro();
  }

  private renderIntro(): void {
    const line = this.introLines[this.introIndex];
    this.refs.overlay.innerHTML = `
      <div class="mobile-screen intro-screen">
        <section class="intro-card glass-panel">
          <div class="screen-kicker">${line.kicker}</div>
          <h1>${line.title}</h1>
          <p>${line.copy}</p>
          <blockquote>Every legend begins in the darkness.</blockquote>
          <div class="popup-actions">
            <button class="menu-button" type="button" data-ui-action="intro-next">${this.introIndex === this.introLines.length - 1 ? 'Begin Tutorial' : 'Next'}</button>
            <button class="secondary-button" type="button" data-ui-action="intro-skip">Skip</button>
          </div>
        </section>
      </div>
    `;
  }

  private advanceIntro(): void {
    if (this.introIndex < this.introLines.length - 1) {
      this.introIndex += 1;
      this.renderIntro();
      return;
    }
    this.prepareMission('awakening');
  }

  private continueGame(): void {
    const loaded = this.saveManager.load();
    if (!loaded) {
      this.showMenu('No valid save was found. Start a new game to create one.');
      return;
    }
    this.saveData = loaded;
    this.profile = loaded.profile;
    this.prepareMission(this.profile.lastMissionId || 'awakening');
  }

  private prepareMission(missionId: string): void {
    const mission = missions[missionId] ?? missions.awakening;
    this.preparedMission = mission;
    this.preparedCheckpointMissionId = mission.id;
    this.selectedTeamSlot = 0;
    this.showBattlePrepScreen();
  }

  private prepareGeneratedMode(kind: GeneratedModeId): void {
    this.preparedMission = this.createGeneratedMission(kind);
    this.preparedCheckpointMissionId = this.profile.lastMissionId || 'awakening';
    this.selectedTeamSlot = 0;
    this.showBattlePrepScreen();
  }

  private showBattlePrepScreen(): void {
    if (!this.preparedMission) return;
    this.screen = 'team-prep';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderBattlePrepScreen({
      profile: this.profile,
      mission: this.preparedMission,
      party: this.getActiveParty(),
      roster: Object.values(characters),
      selectedSlot: this.selectedTeamSlot,
      activeNav: 'missions'
    });
  }

  private pickPreparedTeamMember(characterId: string): void {
    if (!characters[characterId] || !this.profile.unlockedCharacters.includes(characterId)) return;
    const nextParty = [...(this.profile.activeParty?.length ? this.profile.activeParty : defaultParty)];
    const previousIndex = nextParty.indexOf(characterId);
    if (previousIndex >= 0) {
      [nextParty[previousIndex], nextParty[this.selectedTeamSlot]] = [nextParty[this.selectedTeamSlot], nextParty[previousIndex]];
    } else {
      nextParty[this.selectedTeamSlot] = characterId;
    }
    this.profile.activeParty = nextParty.slice(0, 4);
    this.profile.activeCharacterId = this.profile.activeParty[0];
    this.syncPlayerStatsFromProfile(true);
    this.rebuildPlayerModel(true);
    this.persist();
    this.showBattlePrepScreen();
  }

  private launchPreparedMission(): void {
    if (!this.preparedMission) {
      this.prepareMission(this.profile.lastMissionId || 'awakening');
      return;
    }
    this.beginMission(this.preparedMission, this.preparedCheckpointMissionId);
  }

  private startMission(missionId: string): void {
    const mission = missions[missionId] ?? missions.awakening;
    this.beginMission(mission, mission.id);
  }

  private startGeneratedMission(kind: GeneratedModeId): void {
    this.beginMission(this.createGeneratedMission(kind), this.profile.lastMissionId || 'awakening');
  }

  private createGeneratedMission(kind: GeneratedModeId): MissionData {
    const randomEnemy = () => ['shadow-cultist', 'eclipsed-arcanist', 'null-guard'][Math.floor(Math.random() * 3)];
    return kind === 'boss'
      ? {
          id: 'arena-boss-rush',
          chapter: 'Arena — Boss Rush',
          title: 'Capital Arena: Eclipse Exhibition',
          recommendedLevel: this.profile.level,
          difficulty: 'Challenge',
          narrative: 'A functional boss-rush prototype for testing elite patterns, switching, ultimate timing, and reward pacing.',
          rewards: { xp: 180, gold: 180, skillPoints: 1, materials: { shadowShard: 6, eclipseCore: 1, nullFragment: 1 } },
          nextMission: this.profile.lastMissionId || 'shadow-trace',
          steps: [
            { type: 'waypoint', objective: 'Enter the arena center.', marker: { x: 0, z: -6 } },
            { type: 'wave', objective: 'Defeat the armored qualifier.', spawns: [{ enemyId: 'null-guard', x: 0, z: -10 }, { enemyId: 'eclipsed-arcanist', x: -5, z: -12 }] },
            { type: 'wave', objective: 'Break the Abyss Knight.', spawns: [{ enemyId: 'abyss-knight-initiate', x: 0, z: -13 }] },
            { type: 'wave', objective: 'Finish the Eclipse Warden boss rush.', spawns: [{ enemyId: 'eclipse-warden', x: 0, z: -15 }] }
          ]
        }
      : kind === 'arena'
        ? {
            id: 'arena-skirmish',
            chapter: 'Arena — Skirmish',
            title: 'Midnight Rank Trial',
            recommendedLevel: this.profile.level,
            difficulty: 'Fast',
            narrative: 'A short mobile arena skirmish designed for one-tap entry, quick waves, and skill rotation practice.',
            rewards: { xp: 110, gold: 95, skillPoints: 0, materials: { shadowShard: 4, trainingSigil: 1 } },
            nextMission: this.profile.lastMissionId || 'shadow-trace',
            steps: [
              { type: 'waypoint', objective: 'Enter the ranked combat circle.', marker: { x: 0, z: -5 } },
              { type: 'wave', objective: 'Clear the first arena wave.', spawns: [{ enemyId: 'shadow-cultist', x: -4, z: -9 }, { enemyId: 'eclipsed-arcanist', x: 4, z: -10 }] },
              { type: 'wave', objective: 'Defeat the arena enforcer.', spawns: [{ enemyId: 'null-guard', x: 0, z: -12 }, { enemyId: 'shadow-cultist', x: -5, z: -13 }] }
            ]
          }
        : kind === 'training'
          ? {
            id: 'training-simulation',
            chapter: 'Nocturne Garden — Training Room',
            title: 'Infinite Edge Calibration',
            recommendedLevel: this.profile.level,
            difficulty: 'Practice',
            narrative: 'A compact training room simulation for testing movement, switching, cooldowns, Shadow Power, and combo flow.',
            rewards: { xp: 70, gold: 45, skillPoints: 0, materials: { trainingSigil: 2, shadowShard: 2 } },
            nextMission: this.profile.lastMissionId || 'awakening',
            steps: [
              { type: 'waypoint', objective: 'Step into the training glyph.', marker: { x: 0, z: -6 } },
              { type: 'wave', objective: 'Defeat the training echoes.', spawns: [{ enemyId: 'shadow-cultist', x: -4, z: -9 }, { enemyId: 'shadow-cultist', x: 4, z: -9 }, { enemyId: 'eclipsed-arcanist', x: 0, z: -13 }] }
            ]
          }
        : {
            id: 'abyss-dungeon-run',
            chapter: 'Abyss Dungeon — Procedural Prototype',
            title: 'Three Rooms Below Midnight',
            recommendedLevel: this.profile.level,
            difficulty: 'Scaling',
            narrative: 'A compact procedural dungeon run. Enemy room compositions are rolled each time and rewards feed the forge.',
            rewards: { xp: 140, gold: 130, skillPoints: 1, materials: { shadowShard: 7, trainingSigil: 2 } },
            nextMission: this.profile.lastMissionId || 'shadow-trace',
            steps: [
              { type: 'waypoint', objective: 'Activate the abyss gate.', marker: { x: 0, z: -7 } },
              { type: 'wave', objective: 'Clear Abyss Room 1.', spawns: [{ enemyId: randomEnemy(), x: -5, z: -9 }, { enemyId: randomEnemy(), x: 4, z: -10 }] },
              { type: 'wave', objective: 'Clear Abyss Room 2.', spawns: [{ enemyId: randomEnemy(), x: -6, z: -12 }, { enemyId: randomEnemy(), x: 0, z: -14 }, { enemyId: randomEnemy(), x: 6, z: -12 }] },
              { type: 'wave', objective: 'Defeat the dungeon sentinel.', spawns: [{ enemyId: 'abyss-knight-initiate', x: 0, z: -15 }] }
            ]
          };
  }

  private beginMission(mission: MissionData, checkpointMissionId: string): void {
    this.currentMission = mission;
    this.profile.lastMissionId = checkpointMissionId;
    this.persist();
    this.currentStepIndex = -1;
    this.currentObjective = mission.narrative;
    this.waveAdvanceAt = 0;
    this.screen = 'playing';
    this.refs.overlay.classList.add('hidden');
    this.setCombatUI(true);
    this.renderPartyBar();
    this.updateCombatButtonLabels();
    this.clearEnemiesAndProjectiles();
    this.resetPlayerForMission();
    this.audio.stopMusic();
    this.audio.startMusic(mission.id === 'arena-boss-rush' ? 'boss' : 'battle');
    this.toast(`${mission.chapter}: ${mission.title}`);
    this.advanceMissionStep();
  }

  private completeMission(): void {
    if (!this.currentMission) return;
    const mission = this.currentMission;
    this.clearEnemiesAndProjectiles();
    this.setCombatUI(false);
    this.screen = 'reward';
    this.refs.overlay.classList.remove('hidden');
    const rewards = mission.rewards;
    const levelResult = this.grantRewards(rewards.xp, rewards.gold, rewards.skillPoints);
    this.grantMaterials(rewards.materials);
    if (!this.profile.completedMissions.includes(mission.id)) {
      this.profile.completedMissions.push(mission.id);
    }
    if (mission.id === 'awakening' || mission.id === 'arena-boss-rush') this.unlockAchievement('bossDestroyer');
    if (mission.id === 'abyss-dungeon-run') this.unlockAchievement('dungeonMaster');
    if (!this.profile.unlockedMissions.includes(mission.nextMission)) {
      this.profile.unlockedMissions.push(mission.nextMission);
    }
    this.profile.lastMissionId = mission.nextMission;
    this.persist();

    this.refs.overlay.innerHTML = renderVictoryScreen({
      mission,
      levelsGained: levelResult.levelsGained,
      isFirstMission: mission.id === 'awakening',
      materialLabel: this.formatCost(rewards.materials ?? {}) || '—'
    });
  }

  private showCharacterScreen(): void {
    this.screen = 'character';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    if (this.profile.unlockedCharacters.length >= 8) this.unlockAchievement('sevenCommanders');
    this.syncPlayerStatsFromProfile(false);
    const active = this.getActiveCharacter();
    this.refs.overlay.innerHTML = renderMobileCharacterScreen({
      profile: this.profile,
      characters: Object.values(characters),
      activeCharacter: active,
      activeStats: this.player.stats,
      activeWeapon: this.getActiveWeapon(),
      tab: this.characterTab,
      attackCost: upgradeGoldCost(this.profile.level, this.profile.upgrades.attack),
      vitalityCost: upgradeGoldCost(this.profile.level, this.profile.upgrades.vitality),
      shadowCost: upgradeGoldCost(this.profile.level, this.profile.upgrades.shadow),
      activeNav: 'characters'
    });
  }

  private upgradeCard(title: string, copy: string, action: UIAction, cost: number, rank: number): string {
    const canBuy = this.profile.gold >= cost;
    return `
      <div class="upgrade-card">
        <h3>${title} <span class="level-chip">Rank ${rank}</span></h3>
        <p>${copy}</p>
        <button class="secondary-button" type="button" data-ui-action="${action}" ${canBuy ? '' : 'disabled'}>Upgrade — ${cost} Gold</button>
      </div>
    `;
  }

  private purchaseUpgrade(kind: keyof PlayerProfile['upgrades']): void {
    const cost = upgradeGoldCost(this.profile.level, this.profile.upgrades[kind]);
    if (this.profile.gold < cost) {
      this.toast('Not enough gold for that upgrade.');
      this.showCharacterScreen();
      return;
    }
    this.profile.gold -= cost;
    this.profile.upgrades[kind] += 1;
    this.syncPlayerStatsFromProfile(true);
    this.persist();
    this.showCharacterScreen();
  }

  private setActiveCharacter(characterId: string, redrawCharacterScreen = false): void {
    const character = characters[characterId];
    if (!character || !this.profile.unlockedCharacters.includes(characterId)) return;
    this.profile.activeCharacterId = characterId;
    if (!this.profile.activeParty.includes(characterId)) {
      this.profile.activeParty = [characterId, ...this.profile.activeParty].slice(0, 4);
    }
    this.syncPlayerStatsFromProfile(true);
    this.rebuildPlayerModel(true);
    this.syncLobbyHero();
    this.updateCombatButtonLabels();
    this.renderPartyBar();
    this.persist();
    if (this.screen === 'menu') {
      this.audio.stopMusic();
      this.audio.startMusic(character.id === 'shadow' ? 'shadow' : 'menu');
    }
    if (redrawCharacterScreen) this.showCharacterScreen();
  }

  private switchPartyTo(index: number): void {
    const party = this.getActiveParty();
    const character = party[index];
    if (!character || character.id === this.profile.activeCharacterId) return;
    this.setActiveCharacter(character.id);
    this.player.shadowPower = addShadowPower(this.player.shadowPower, 6, this.player.stats.shadowGainMultiplier);
    this.spawnRing(this.player.object.position, character.visuals?.accent ?? '#a78bfa', 3.4, 0.32);
    this.damageEnemiesInArc(3.4, Math.PI * 1.6, 1.35, 'Switch Attack', character.visuals?.accent ?? '#a78bfa', 0.9);
    this.toast(`Switch Attack: ${character.codename}`);
  }

  private switchPartyRelative(direction: -1 | 1): void {
    if (this.screen !== 'playing') return;
    const party = this.getActiveParty();
    const current = Math.max(0, party.findIndex((character) => character.id === this.profile.activeCharacterId));
    const next = (current + direction + party.length) % party.length;
    this.switchPartyTo(next);
  }

  private renderPartyBar(): void {
    const party = this.getActiveParty();
    const buttons = party
      .map((character, index) => {
        const isActive = character.id === this.profile.activeCharacterId;
        const visuals = character.visuals ?? { secondary: '#7c3aed', accent: '#f43f5e' };
        return `<button class="party-button ${isActive ? 'active' : ''}" type="button" data-party-index="${index}" aria-label="Switch to ${character.codename}"><span style="--orb-a:${visuals.secondary};--orb-b:${visuals.accent}">${character.codename.slice(0, 2)}</span><strong>${character.codename}</strong></button>`;
      })
      .join('');
    this.refs.partyBar.innerHTML = buttons;
    this.refs.partyBar.classList.toggle('hidden', this.screen !== 'playing');
  }

  private updateCombatButtonLabels(): void {
    const character = this.getActiveCharacter();
    const labels: Partial<Record<InputAction, string>> = {
      skill1: character.skills[0]?.name ?? 'Skill 1',
      skill2: character.skills[1]?.name ?? 'Skill 2',
      skill3: character.skills[2]?.name ?? 'Skill 3',
      ultimate: character.ultimate.name
    };
    for (const [action, label] of Object.entries(labels) as [InputAction, string][]) {
      const button = this.refs.actionButtons.get(action);
      if (button) {
        const cooldown = button.querySelector('.cooldown-label');
        const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE);
        if (textNode) textNode.textContent = label.split(' ')[0];
        button.setAttribute('aria-label', `${action} ${label}`);
        if (cooldown) button.appendChild(cooldown);
      }
    }
  }

  private showDefeat(): void {
    this.screen = 'defeat';
    this.setCombatUI(false);
    this.refs.overlay.classList.remove('hidden');
    this.refs.overlay.innerHTML = renderDefeatScreen();
  }

  private createLobbyEnvironment(): void {
    const root = this.lobbyRoot;
    root.clear();
    this.lobbyParticles = [];
    this.lobbyAnimatedObjects = [];

    const reflectionMaterial = new THREE.MeshBasicMaterial({
      color: '#7c3aed',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    for (const radius of [1.9, 3.1, 4.35]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + 0.035, 96), reflectionMaterial.clone());
      ring.name = 'lobbyForegroundReflection';
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(0, 0.03 + radius * 0.002, 0.12);
      ring.userData.spinY = radius % 2 === 0 ? 0.08 : -0.055;
      root.add(ring);
      this.lobbyAnimatedObjects.push(ring);
    }

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: '#f43f5e',
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const heroGlow = new THREE.Mesh(new THREE.CircleGeometry(1.55, 72), glowMaterial);
    heroGlow.name = 'lobbyHeroGroundGlow';
    heroGlow.rotation.x = -Math.PI / 2;
    heroGlow.position.y = 0.035;
    heroGlow.userData.pulse = 0.16;
    root.add(heroGlow);
    this.lobbyAnimatedObjects.push(heroGlow);

    const particleGeometry = new THREE.SphereGeometry(0.035, 6, 4);
    for (let i = 0; i < 80; i += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 5 === 0 ? '#f43f5e' : i % 3 === 0 ? '#22d3ee' : '#a78bfa',
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      });
      const particle = new THREE.Mesh(particleGeometry, material);
      particle.name = 'lobbyForegroundParticle';
      particle.position.set((Math.random() - 0.5) * 12, Math.random() * 5.6 + 0.45, (Math.random() - 0.5) * 4.5 + 0.2);
      particle.userData.baseColor = material.color.getHex();
      particle.userData.seed = Math.random() * Math.PI * 2;
      particle.userData.speed = 0.08 + Math.random() * 0.22;
      root.add(particle);
      this.lobbyParticles.push(particle);
    }

    const moonFill = new THREE.DirectionalLight('#c7d2fe', 1.2);
    moonFill.position.set(-2.5, 6.5, 5.5);
    root.add(moonFill);

    const heroKey = new THREE.SpotLight('#a78bfa', 72, 16, Math.PI / 5, 0.52, 1.2);
    heroKey.position.set(0, 6.6, 5.4);
    heroKey.target.position.set(0, 1.2, 0);
    root.add(heroKey, heroKey.target);

    const rimLight = new THREE.PointLight('#f43f5e', 24, 12);
    rimLight.position.set(3.2, 2.8, 2.1);
    root.add(rimLight);

    this.syncLobbyHero();
  }

  private syncLobbyHero(): void {
    const active = this.getActiveCharacter();
    if (this.lobbyHero?.userData.characterId === active.id) return;
    if (this.lobbyHero?.parent) this.lobbyHero.parent.remove(this.lobbyHero);
    const hero = this.makePlayerModel();
    hero.name = 'LobbyHero';
    hero.userData.characterId = active.id;
    hero.position.set(0, 0, 0);
    hero.rotation.y = this.lobbyHeroYaw;
    hero.scale.setScalar(active.id === 'shadow' ? 1.58 : 1.46);

    const visual = active.visuals ?? { accent: '#f43f5e', secondary: '#7c3aed', primary: '#111124' };
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(active.id === 'shadow' ? 1.18 : 1.02, 0.025, 8, 72),
      new THREE.MeshBasicMaterial({ color: visual.accent, transparent: true, opacity: active.id === 'shadow' ? 0.72 : 0.46, side: THREE.DoubleSide })
    );
    halo.name = 'lobbyHeroHalo';
    halo.position.y = 1.05;
    halo.rotation.x = Math.PI / 2;
    hero.add(halo);

    if (active.id === 'shadow') {
      const shadowAura = new THREE.Mesh(
        new THREE.SphereGeometry(1.05, 32, 16),
        new THREE.MeshBasicMaterial({ color: '#05030f', transparent: true, opacity: 0.42, side: THREE.BackSide })
      );
      shadowAura.name = 'lobbyShadowAura';
      shadowAura.position.y = 1.12;
      shadowAura.scale.set(1.15, 1.55, 1.15);
      hero.add(shadowAura);
    }

    this.lobbyRoot.add(hero);
    this.lobbyHero = hero;
    this.lobbyHeroEntranceAt = performance.now() / 1000;
    this.spawnLobbyPulse(visual.accent, 2.8, 0.56);
  }

  private triggerLobbyInteraction(): void {
    if (!this.lobbyHero || this.screen !== 'menu') return;
    const active = this.getActiveCharacter();
    const visual = active.visuals ?? { accent: '#f43f5e', secondary: '#7c3aed', primary: '#111124' };
    const now = performance.now() / 1000;
    this.lobbyInspectUntil = now + 1.35;
    this.spawnLobbyPulse(visual.accent, active.id === 'shadow' ? 3.8 : 3.1, 0.72);
    this.toast(active.id === 'shadow' ? 'Shadow: The garden grows darker.' : `${active.codename}: Ready for deployment.`);
    if (this.profile.settings.vibration && typeof navigator.vibrate === 'function') navigator.vibrate(18);
    void this.audio.resume().then(() => {
      this.audio.click();
      this.audio.stopMusic();
      this.audio.startMusic(active.id === 'shadow' ? 'shadow' : 'menu');
    });
  }

  private spawnLobbyPulse(color: string, finalScale: number, duration: number): void {
    if (!this.lobbyRoot) return;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1.02, 72),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    ring.position.set(0, 0.075, 0);
    ring.rotation.x = -Math.PI / 2;
    this.lobbyRoot.add(ring);
    this.effects.push({ object: ring, life: duration, maxLife: duration, expand: finalScale, fade: true });
  }

  private updateLobby(delta: number, now: number): void {
    this.syncLobbyHero();
    const active = this.getActiveCharacter();
    const shadowMode = active.id === 'shadow';

    for (const particle of this.lobbyParticles) {
      const seed = Number(particle.userData.seed ?? 0);
      const speed = Number(particle.userData.speed ?? 0.15);
      particle.position.y += delta * (0.24 + speed);
      particle.position.x += Math.sin(now * 0.45 + seed) * delta * 0.08;
      particle.position.z += Math.cos(now * 0.32 + seed) * delta * 0.06;
      if (particle.position.y > 9.4) particle.position.y = 0.55;
      const material = particle.material as THREE.MeshBasicMaterial;
      material.opacity = shadowMode ? 0.22 + Math.sin(now + seed) * 0.08 : 0.32 + Math.sin(now + seed) * 0.08;
      material.color.set(shadowMode && seed % 2 > 1 ? '#05030f' : Number(particle.userData.baseColor ?? 0xa78bfa));
    }

    for (const object of this.lobbyAnimatedObjects) {
      if (object.userData.spinY) object.rotation.y += Number(object.userData.spinY) * delta;
      if (object.userData.spinZ) object.rotation.z += Number(object.userData.spinZ) * delta;
      if (object.userData.floatBaseY !== undefined) {
        object.position.y = Number(object.userData.floatBaseY) + Math.sin(now * 1.2 + Number(object.userData.phase ?? 0)) * Number(object.userData.floatAmp ?? 0.1);
      }
      if (object.userData.pulse && object instanceof THREE.Mesh) {
        const material = object.material as THREE.Material & { opacity?: number };
        material.opacity = 0.18 + Math.sin(now * 1.7 + Number(object.userData.pulse)) * 0.05;
      }
      if (object.userData.baseX !== undefined) {
        const phase = Number(object.userData.phase ?? 0);
        const range = Number(object.userData.range ?? 1);
        object.position.x = Number(object.userData.baseX) + Math.sin(now * Number(object.userData.speed ?? 0.2) + phase) * range;
        object.rotation.y = Math.sin(now * Number(object.userData.speed ?? 0.2) + phase) > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }

    if (!this.lobbyHero) return;
    const visual = active.visuals ?? { accent: '#f43f5e', secondary: '#7c3aed', primary: '#111124' };
    const elapsedEntrance = clamp(now - this.lobbyHeroEntranceAt, 0, 1.2);
    const entranceEase = 1 - Math.pow(1 - elapsedEntrance / 1.2, 3);
    const targetScale = shadowMode ? 1.58 : 1.46;
    const poseBoost = now < this.lobbyInspectUntil ? 0.05 : 0;
    this.lobbyHero.scale.setScalar(targetScale * (0.82 + entranceEase * 0.18 + poseBoost));
    this.lobbyHero.position.x = (1 - entranceEase) * 0.8;
    this.lobbyHero.position.y = Math.sin(now * 1.35) * 0.035;
    const cinematicSway = now < this.lobbyInspectUntil ? Math.sin(now * 9.5) * 0.08 : Math.sin(now * 0.75) * 0.035;
    this.lobbyHero.rotation.y = this.lobbyHeroYaw + cinematicSway;

    const weapon = this.lobbyHero.getObjectByName('heroWeapon');
    if (weapon) {
      weapon.rotation.z = -0.38 + Math.sin(now * (now < this.lobbyInspectUntil ? 10 : 1.8)) * (now < this.lobbyInspectUntil ? 0.22 : 0.035);
      weapon.position.y = 1.22 + Math.sin(now * 1.6) * 0.035;
    }
    const cape = this.lobbyHero.getObjectByName('heroCape');
    if (cape) {
      cape.rotation.x = Math.sin(now * 1.2) * 0.035;
      cape.position.z = -0.31 + Math.sin(now * 1.5) * 0.015;
    }
    const aura = this.lobbyHero.getObjectByName('heroAura') as THREE.Mesh | undefined;
    if (aura) {
      aura.rotation.z += delta * (shadowMode ? 1.6 : 0.72);
      const material = aura.material as THREE.MeshBasicMaterial;
      material.color.set(visual.accent);
      material.opacity = shadowMode ? 0.78 : 0.56;
    }
    const halo = this.lobbyHero.getObjectByName('lobbyHeroHalo');
    if (halo) {
      halo.rotation.z += delta * (shadowMode ? -1.15 : -0.58);
      const pulse = 1 + Math.sin(now * 2.2) * (shadowMode ? 0.08 : 0.04);
      halo.scale.setScalar(pulse);
    }
  }

  private updateLobbyCamera(delta: number, now: number): void {
    const idleOrbit = this.profile.settings.reducedMotion ? 0 : Math.sin(now * 0.09) * 0.22 + Math.sin(now * 0.037) * 0.16;
    const angle = idleOrbit;
    const distance = 7.7 * this.lobbyZoom;
    const height = 2.35 + Math.sin(now * 0.12) * 0.16;
    const targetPosition = new THREE.Vector3(Math.sin(angle) * 2.4, height, distance + Math.cos(angle) * 0.45);
    this.camera.position.lerp(targetPosition, 1 - Math.pow(0.004, delta));
    this.camera.lookAt(new THREE.Vector3(0, 1.45, -0.15));
  }

  private isLobbyInteractive(): boolean {
    return this.screen === 'menu' && this.lobbyRoot?.visible === true;
  }

  private beginLobbyPointer(event: PointerEvent): void {
    this.lobbyPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.lobbyPointerMoved = false;
    if (this.lobbyPointers.size === 1) {
      this.lobbyPointerId = event.pointerId;
      this.refs.sceneHost.setPointerCapture(event.pointerId);
    }
    if (this.lobbyPointers.size === 2) {
      const points = [...this.lobbyPointers.values()];
      this.lobbyPinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      this.lobbyPinchZoomStart = this.lobbyZoom;
    }
    void this.audio.resume().then(() => this.audio.startMusic(this.profile.activeCharacterId === 'shadow' ? 'shadow' : 'menu'));
  }

  private moveLobbyPointer(event: PointerEvent): void {
    const previous = this.lobbyPointers.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) this.lobbyPointerMoved = true;
    this.lobbyPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.lobbyPointers.size >= 2) {
      const points = [...this.lobbyPointers.values()];
      const distance = Math.max(24, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
      if (this.lobbyPinchDistance > 0) {
        this.lobbyZoom = clamp(this.lobbyPinchZoomStart * (this.lobbyPinchDistance / distance), 0.72, 1.36);
      }
      return;
    }

    if (event.pointerId === this.lobbyPointerId) {
      this.lobbyHeroYaw += dx * 0.009;
    }
  }

  private endLobbyPointer(event: PointerEvent): void {
    const wasSinglePointer = this.lobbyPointers.size === 1 && event.pointerId === this.lobbyPointerId;
    this.lobbyPointers.delete(event.pointerId);
    if (event.pointerId === this.lobbyPointerId) this.lobbyPointerId = null;
    if (this.lobbyPointers.size < 2) this.lobbyPinchDistance = 0;
    if (!wasSinglePointer || this.lobbyPointerMoved) return;
    const now = performance.now();
    if (now - this.lobbyLastTapAt < 320) {
      this.lobbyHeroYaw = Math.PI;
      this.lobbyZoom = 1;
      this.toast('Lobby camera reset.');
      this.lobbyLastTapAt = 0;
      return;
    }
    this.lobbyLastTapAt = now;
    this.triggerLobbyInteraction();
  }

  private createArena(): void {
    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#14142f', roughness: 0.8, metalness: 0.12 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(48, 48), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.arenaRoot.add(floor);

    const grid = new THREE.GridHelper(48, 24, '#7c3aed', '#27273b');
    grid.position.y = 0.018;
    this.arenaRoot.add(grid);

    const gateMaterial = new THREE.MeshStandardMaterial({ color: '#2e1065', emissive: '#14002d', roughness: 0.56 });
    const wallMaterial = new THREE.MeshStandardMaterial({ color: '#0f172a', emissive: '#080812', roughness: 0.82 });
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const radius = 23;
      const obelisk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5 + (i % 3), 1.2), i % 4 === 0 ? gateMaterial : wallMaterial);
      obelisk.position.set(Math.sin(angle) * radius, obelisk.geometry.parameters.height / 2, Math.cos(angle) * radius);
      obelisk.rotation.y = angle;
      obelisk.castShadow = true;
      obelisk.receiveShadow = true;
      this.arenaRoot.add(obelisk);
    }

    for (const z of [-18, 18]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(44, 3, 0.7), wallMaterial);
      wall.position.set(0, 1.5, z);
      wall.receiveShadow = true;
      wall.castShadow = true;
      this.arenaRoot.add(wall);
    }
    for (const x of [-18, 18]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3, 44), wallMaterial);
      wall.position.set(x, 1.5, 0);
      wall.receiveShadow = true;
      wall.castShadow = true;
      this.arenaRoot.add(wall);
    }
  }

  private createWaypointMarker(): void {
    const group = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.72, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.55, 48), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.32, 3.8, 16),
      new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.26 })
    );
    pillar.position.y = 1.9;
    group.add(pillar);
    group.visible = false;
    this.arenaRoot.add(group);
    this.waypointMarker = group;
  }

  private createPlayer(): void {
    const object = this.makePlayerModel();
    object.position.set(0, 0, 6);
    this.arenaRoot.add(object);
    const stats = this.getComputedStats();
    this.player = {
      object,
      hp: stats.maxHealth,
      maxHp: stats.maxHealth,
      radius: PLAYER_RADIUS,
      cooldowns: new Map<string, number>(),
      attackReadyAt: 0,
      invulnerableUntil: 0,
      dodgeUntil: 0,
      dodgeVelocity: new THREE.Vector3(),
      barrierUntil: 0,
      shadowPower: 0,
      combo: 0,
      comboExpiresAt: 0,
      facing: Math.PI,
      stats
    };
  }

  private makePlayerModel(): THREE.Group {
    const group = new THREE.Group();
    const visual = this.getActiveCharacter().visuals ?? { primary: '#111124', secondary: '#7c3aed', accent: '#f43f5e' };
    const coat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.72, 1.95, 6),
      new THREE.MeshToonMaterial({ color: visual.primary })
    );
    coat.name = 'heroCoat';
    coat.position.y = 1.05;
    coat.castShadow = true;
    group.add(coat);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.5), new THREE.MeshToonMaterial({ color: visual.secondary }));
    chest.name = 'heroChest';
    chest.position.set(0, 1.45, 0.05);
    chest.castShadow = true;
    group.add(chest);

    const cape = new THREE.Mesh(
      new THREE.PlaneGeometry(1.28, 1.85),
      new THREE.MeshToonMaterial({ color: visual.primary, side: THREE.DoubleSide })
    );
    cape.name = 'heroCape';
    cape.position.set(0, 1.12, -0.31);
    cape.castShadow = true;
    group.add(cape);

    const armMaterial = new THREE.MeshToonMaterial({ color: visual.primary });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8), armMaterial);
    leftArm.name = 'heroLeftArm';
    leftArm.position.set(-0.63, 1.36, 0.03);
    leftArm.rotation.z = 0.22;
    leftArm.castShadow = true;
    group.add(leftArm);
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.12, 8), armMaterial.clone());
    rightArm.name = 'heroRightArm';
    rightArm.position.set(0.64, 1.35, 0.02);
    rightArm.rotation.z = -0.32;
    rightArm.castShadow = true;
    group.add(rightArm);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), new THREE.MeshToonMaterial({ color: '#e0c8b0' }));
    head.name = 'heroHead';
    head.position.y = 2.23;
    head.castShadow = true;
    group.add(head);

    const hair = new THREE.Mesh(new THREE.ConeGeometry(0.43, 0.42, 7), new THREE.MeshToonMaterial({ color: '#050509' }));
    hair.name = 'heroHair';
    hair.position.y = 2.52;
    hair.rotation.y = 0.4;
    hair.castShadow = true;
    group.add(hair);

    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), new THREE.MeshStandardMaterial({ color: '#dbeafe', emissive: visual.accent, metalness: 0.52, roughness: 0.22 }));
    sword.name = 'heroWeapon';
    sword.position.set(0.78, 1.22, 0.12);
    sword.rotation.z = -0.38;
    sword.castShadow = true;
    group.add(sword);

    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.025, 8, 48),
      new THREE.MeshBasicMaterial({ color: visual.accent, transparent: true, opacity: 0.65 })
    );
    aura.name = 'heroAura';
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 0.08;
    group.add(aura);
    return group;
  }

  private rebuildPlayerModel(preserveTransform: boolean): void {
    if (!this.player) return;
    const position = this.player.object.position.clone();
    const rotationY = this.player.object.rotation.y;
    this.player.object.parent?.remove(this.player.object);
    const nextModel = this.makePlayerModel();
    if (preserveTransform) {
      nextModel.position.copy(position);
      nextModel.rotation.y = rotationY;
    }
    this.arenaRoot.add(nextModel);
    this.player.object = nextModel;
  }

  private makeEnemyModel(data: EnemyData): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(data.color);
    const isBoss = data.aiStyle === 'boss';
    const isMiniBoss = data.aiStyle === 'miniboss';
    const height = isBoss ? 3.6 : isMiniBoss ? 2.8 : data.aiStyle === 'tank' ? 2.35 : 1.9;
    const width = isBoss ? 1.35 : isMiniBoss ? 1.05 : data.aiStyle === 'tank' ? 0.95 : 0.72;
    const material = new THREE.MeshToonMaterial({ color });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(width * 0.62, width * 0.78, height, 7), material);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(width * 0.38, 18, 14), new THREE.MeshToonMaterial({ color: '#111827' }));
    head.position.y = height + width * 0.26;
    head.castShadow = true;
    group.add(head);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(width * 0.18, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.82 })
    );
    core.position.set(0, height * 0.6, width * 0.62);
    group.add(core);

    if (data.aiStyle === 'ranged') {
      const staff = new THREE.Mesh(new THREE.BoxGeometry(0.09, height * 0.95, 0.09), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
      staff.position.set(width * 0.75, height * 0.55, 0);
      group.add(staff);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, height * 0.72, 0.12), new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: data.color, metalness: 0.3 }));
      blade.position.set(width * 0.86, height * 0.45, 0.18);
      blade.rotation.z = -0.4;
      blade.castShadow = true;
      group.add(blade);
    }

    return group;
  }

  private loop(timeMs: number): void {
    this.animationFrame = window.requestAnimationFrame((time) => this.loop(time));
    const now = timeMs / 1000;
    const rawDelta = Math.min(this.clock.getDelta(), 0.05);
    const minFrameDelta = this.profile.settings.fpsCap === 30 ? 1 / 30 : 1 / 60;
    if (now - this.lastFrameSecond < minFrameDelta * 0.65) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.lastFrameSecond = now;

    const timeScale = this.ultimateEndsAt > now && !this.profile.settings.reducedMotion ? (now < this.ultimateImpactAt ? 0.2 : 0.48) : 1;
    const delta = rawDelta * timeScale;
    if (this.screen === 'playing') {
      this.updatePlayer(delta, now);
      this.updateEnemies(delta, now);
      this.updateProjectiles(delta, now);
      this.updateMission(now);
      this.updateCooldownButtons(now);
    } else if (this.lobbyRoot?.visible) {
      this.updateLobby(rawDelta, now);
    }
    this.updateEffects(rawDelta);
    this.updateDamageLabels(rawDelta);
    this.updateCamera(rawDelta, now);
    this.updateHud();
    this.renderer.render(this.scene, this.camera);
  }

  private updatePlayer(delta: number, now: number): void {
    if (now > this.player.comboExpiresAt) {
      this.player.combo = 0;
    }

    const position = this.player.object.position;
    if (now < this.player.dodgeUntil) {
      position.addScaledVector(this.player.dodgeVelocity, delta);
      this.clampToArena(position);
      return;
    }

    const input = this.getKeyboardInput().add(this.moveInput);
    if (input.lengthSq() > 1) input.normalize();
    if (input.lengthSq() <= 0.0001 || now < this.ultimateEndsAt) return;

    const forward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const move = new THREE.Vector3().addScaledVector(right, input.x).addScaledVector(forward, input.y);
    if (move.lengthSq() > 0.0001) {
      move.normalize();
      position.addScaledVector(move, this.player.stats.speed * delta);
      this.clampToArena(position);
      this.player.facing = Math.atan2(move.x, move.z);
      this.player.object.rotation.y = this.player.facing;
    }
  }

  private updateEnemies(delta: number, now: number): void {
    for (const enemy of [...this.enemies]) {
      if (!enemy.alive) continue;
      if (enemy.hp <= 0) {
        this.killEnemy(enemy);
        continue;
      }
      this.updateBossPhase(enemy, now);
      if (enemy.pendingAttack) {
        this.resolvePendingAttack(enemy, now);
        continue;
      }
      if (now < enemy.stunnedUntil) {
        enemy.object.rotation.y += delta * 2;
        continue;
      }

      switch (enemy.aiStyle) {
        case 'melee':
          this.updateMeleeAI(enemy, delta, now, 1.75, 0.38, 1.15);
          break;
        case 'tank':
          this.updateMeleeAI(enemy, delta, now, 2.1, 0.72, 1.55);
          break;
        case 'ranged':
          this.updateRangedAI(enemy, delta, now);
          break;
        case 'miniboss':
          this.updateMiniBossAI(enemy, delta, now);
          break;
        case 'boss':
          this.updateBossAI(enemy, delta, now);
          break;
        default:
          enemy.aiStyle satisfies never;
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.alive);
    if (this.activeBoss && !this.activeBoss.alive) this.activeBoss = null;
  }

  private updateMeleeAI(enemy: EnemyEntity, delta: number, now: number, range: number, windup: number, damageScale: number): void {
    const distance = this.distanceToPlayer(enemy.object.position);
    if (distance > range) {
      this.moveEnemyTowardPlayer(enemy, delta, enemy.speed);
      return;
    }
    this.facePlayer(enemy.object);
    if (now >= enemy.attackReadyAt) {
      this.queueEnemyAttack(enemy, windup, range + 0.32, enemy.attack * damageScale, 'Blade Impact', '#ef4444');
      enemy.attackReadyAt = now + 1.25 + windup;
    }
  }

  private updateRangedAI(enemy: EnemyEntity, delta: number, now: number): void {
    const distance = this.distanceToPlayer(enemy.object.position);
    if (distance < 5.8) {
      const direction = enemy.object.position.clone().sub(this.player.object.position).setY(0).normalize();
      enemy.object.position.addScaledVector(direction, enemy.speed * delta);
      this.clampToArena(enemy.object.position);
    } else if (distance > 8.5) {
      this.moveEnemyTowardPlayer(enemy, delta, enemy.speed * 0.86);
    } else {
      const strafe = new THREE.Vector3(Math.cos(now + enemy.object.id), 0, Math.sin(now + enemy.object.id));
      enemy.object.position.addScaledVector(strafe, enemy.speed * 0.32 * delta);
      this.clampToArena(enemy.object.position);
    }
    this.facePlayer(enemy.object);
    if (now >= enemy.attackReadyAt) {
      const direction = this.player.object.position.clone().sub(enemy.object.position).setY(0.42).normalize();
      this.spawnProjectile(enemy.object.position.clone().add(new THREE.Vector3(0, 1.35, 0)), direction, 8.4, enemy.attack, 0.34, 'enemy', '#38bdf8');
      this.spawnRing(enemy.object.position, '#38bdf8', 1.8, 0.34);
      enemy.attackReadyAt = now + 2.35;
    }
  }

  private updateMiniBossAI(enemy: EnemyEntity, delta: number, now: number): void {
    const distance = this.distanceToPlayer(enemy.object.position);
    if (now >= enemy.abilityReadyAt) {
      this.facePlayer(enemy.object);
      const direction = this.player.object.position.clone().sub(enemy.object.position).setY(0).normalize();
      enemy.object.position.addScaledVector(direction, Math.min(distance, 5.6));
      this.clampToArena(enemy.object.position);
      this.queueEnemyAttack(enemy, 0.48, 3.1, enemy.attack * 1.9, 'Abyss Charge', '#f43f5e');
      this.spawnRing(enemy.object.position, '#f43f5e', 3.2, 0.52);
      enemy.abilityReadyAt = now + 5.2;
      return;
    }
    this.updateMeleeAI(enemy, delta, now, 2.6, 0.46, 1.35);
  }

  private updateBossAI(enemy: EnemyEntity, delta: number, now: number): void {
    const distance = this.distanceToPlayer(enemy.object.position);
    const phaseSpeed = 1 + (enemy.bossPhase - 1) * 0.12;
    if (distance > 3.05) {
      this.moveEnemyTowardPlayer(enemy, delta, enemy.speed * phaseSpeed);
    } else if (now >= enemy.attackReadyAt) {
      this.queueEnemyAttack(enemy, 0.52, 3.35, enemy.attack * (1.18 + enemy.bossPhase * 0.12), 'Warden Cleave', '#f97316');
      enemy.attackReadyAt = now + Math.max(0.82, 1.42 - enemy.bossPhase * 0.12);
    }

    if (now < enemy.abilityReadyAt) return;
    enemy.abilityIndex += 1;
    const phase = enemy.bossPhase;
    if (phase === 1) {
      this.bossFanProjectiles(enemy, 3, 0.35, '#f97316');
      enemy.abilityReadyAt = now + 3.4;
    } else if (phase === 2) {
      this.bossFanProjectiles(enemy, 5, 0.55, '#f43f5e');
      enemy.abilityReadyAt = now + 3.0;
    } else if (phase === 3) {
      this.queueEnemyAttack(enemy, 0.95, 5.8, enemy.attack * 1.85, 'Null Stomp', '#a78bfa');
      this.spawnRing(enemy.object.position, '#a78bfa', 5.8, 0.95);
      enemy.abilityReadyAt = now + 3.2;
    } else {
      this.bossRadialProjectiles(enemy, 10, '#facc15');
      this.queueEnemyAttack(enemy, 0.62, 4.2, enemy.attack * 2.1, 'Memory Rupture', '#facc15');
      enemy.abilityReadyAt = now + 2.6;
    }
  }

  private updateBossPhase(enemy: EnemyEntity, now: number): void {
    if (enemy.aiStyle !== 'boss') return;
    const ratio = enemy.hp / enemy.maxHp;
    const nextPhase = ratio <= 0.25 ? 4 : ratio <= 0.5 ? 3 : ratio <= 0.75 ? 2 : 1;
    if (nextPhase > enemy.bossPhase) {
      enemy.bossPhase = nextPhase;
      enemy.attackReadyAt = now + 0.7;
      enemy.abilityReadyAt = now + 1.1;
      this.player.shadowPower = addShadowPower(this.player.shadowPower, 12, this.player.stats.shadowGainMultiplier);
      this.toast(`Eclipse Warden Phase ${nextPhase}: patterns changed.`);
      this.audio.bossPhase();
      this.shake(0.6);
      this.spawnRing(enemy.object.position, '#facc15', 7.5, 0.8);
    }
  }

  private updateProjectiles(delta: number, now: number): void {
    for (const projectile of this.projectiles) {
      projectile.life -= delta;
      projectile.object.position.addScaledVector(projectile.velocity, delta);
      projectile.object.rotation.x += delta * 8;
      projectile.object.rotation.y += delta * 5;
      if (projectile.from === 'enemy') {
        const distance = projectile.object.position.distanceTo(this.player.object.position.clone().setY(projectile.object.position.y));
        if (distance <= projectile.radius + this.player.radius) {
          this.damagePlayer(projectile.damage, projectile.object.position, now, 'Magic Bolt');
          projectile.life = 0;
          this.spawnRing(projectile.object.position, projectile.color, 1.8, 0.24);
        }
      } else {
        for (const enemy of this.enemies) {
          const distance = projectile.object.position.distanceTo(enemy.object.position.clone().setY(projectile.object.position.y));
          if (distance <= projectile.radius + enemy.radius) {
            this.damageEnemy(enemy, projectile.damage / Math.max(1, this.player.stats.attack), 'Arcane Shot', projectile.color, 0.7);
            projectile.life = 0;
            this.spawnRing(projectile.object.position, projectile.color, 1.8, 0.24);
            break;
          }
        }
      }
    }

    for (const projectile of this.projectiles.filter((item) => item.life <= 0)) {
      this.scene.remove(projectile.object);
      projectile.object.geometry.dispose();
      const material = projectile.object.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    }
    this.projectiles = this.projectiles.filter((item) => item.life > 0);
  }

  private updateMission(now: number): void {
    if (!this.currentMission || this.currentStepIndex < 0) return;
    const step = this.currentMission.steps[this.currentStepIndex];
    if (!step) return;

    if (step.type === 'waypoint') {
      const markerPosition = new THREE.Vector3(step.marker.x, 0, step.marker.z);
      if (this.player.object.position.distanceTo(markerPosition) < 2) {
        this.spawnRing(markerPosition, '#22d3ee', 3.2, 0.5);
        this.advanceMissionStep();
      }
      return;
    }

    if (step.type === 'wave' && this.enemies.length === 0) {
      if (this.waveAdvanceAt === 0) {
        this.waveAdvanceAt = now + 1.1;
        this.currentObjective = 'Area clear. Preparing next objective.';
      } else if (now >= this.waveAdvanceAt) {
        this.waveAdvanceAt = 0;
        this.advanceMissionStep();
      }
    }
  }

  private advanceMissionStep(): void {
    if (!this.currentMission) return;
    this.currentStepIndex += 1;
    const step = this.currentMission.steps[this.currentStepIndex];
    if (!step) {
      this.completeMission();
      return;
    }

    this.currentObjective = step.objective;
    this.waveAdvanceAt = 0;
    if (step.type === 'waypoint') {
      this.placeWaypoint(step.marker.x, step.marker.z);
      this.toast(step.objective);
      return;
    }

    this.hideWaypoint();
    for (const spawn of step.spawns) {
      this.spawnEnemy(spawn.enemyId, spawn.x, spawn.z);
    }
    this.toast(step.objective);
  }

  private basicAttack(): void {
    const now = performance.now() / 1000;
    if (now < this.player.attackReadyAt || now < this.ultimateEndsAt) return;
    this.player.attackReadyAt = now + 0.36;
    this.faceNearestEnemy(4.1);
    this.audio.slash();
    this.spawnSlashArc('#e2e8f0', 3.2);
    const hitCount = this.damageEnemiesInArc(3.25, Math.PI * 0.78, 1.0, 'Slash', '#e2e8f0', 0.8);
    if (hitCount === 0) this.player.shadowPower = addShadowPower(this.player.shadowPower, 1, this.player.stats.shadowGainMultiplier);
  }

  private useSkill(skillIndex: 0 | 1 | 2): void {
    const character = this.getActiveCharacter();
    const skill = character.skills[skillIndex];
    if (!skill) return;
    const now = performance.now() / 1000;
    if (!this.cooldownReady(skill.id, now) || now < this.ultimateEndsAt) return;
    this.player.cooldowns.set(skill.id, now + skill.cooldown);
    const color = character.visuals?.accent ?? '#a78bfa';

    if (skillIndex === 0) {
      const target = this.nearestEnemy(skill.range);
      if (target) {
        this.rotatePlayerToward(target.object.position);
        if (skill.range > 6) {
          const direction = target.object.position.clone().sub(this.player.object.position).setY(0.2).normalize();
          this.spawnProjectile(this.player.object.position.clone().add(new THREE.Vector3(0, 1.3, 0)), direction, 12, this.player.stats.attack * skill.damageMultiplier, 0.38, 'player', color);
        } else {
          const behind = target.object.position.clone().add(this.getPlayerForward().multiplyScalar(-1.65));
          behind.y = 0;
          this.player.object.position.copy(behind);
          this.clampToArena(this.player.object.position);
        }
      } else {
        this.player.object.position.addScaledVector(this.getPlayerForward(), 3.8);
        this.clampToArena(this.player.object.position);
      }
      this.player.invulnerableUntil = now + 0.22;
      this.spawnSlashArc(color, skill.radius + 0.3);
      this.damageEnemiesInArc(skill.radius, Math.PI * 1.12, skill.damageMultiplier, skill.name, color, 1.2);
    } else if (skillIndex === 1) {
      this.spawnRing(this.player.object.position, color, skill.radius, 0.46);
      for (const enemy of this.enemies) {
        if (enemy.object.position.distanceTo(this.player.object.position) <= skill.radius + enemy.radius) {
          this.damageEnemy(enemy, skill.damageMultiplier, skill.name, color, 0.75);
          enemy.stagger += 12;
        }
      }
    } else {
      this.player.barrierUntil = now + (skill.duration ?? 3.4);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.06));
      this.spawnRing(this.player.object.position, color, skill.radius, skill.duration ?? 0.62);
      for (const enemy of this.enemies) {
        if (enemy.object.position.distanceTo(this.player.object.position) <= skill.radius + enemy.radius) {
          this.damageEnemy(enemy, skill.damageMultiplier, skill.name, color, 0.35);
        }
      }
      this.toast(`${skill.name}: defensive flow active.`);
    }

    this.audio.magic();
    this.spawnParticleBurst(this.player.object.position, color, 22, 0.68);
    this.player.shadowPower = addShadowPower(this.player.shadowPower, skill.shadowGain, this.player.stats.shadowGainMultiplier);
  }

  private useShadowStep(): void {
    const skill = this.getActiveCharacter().skills[0];
    const now = performance.now() / 1000;
    if (!this.cooldownReady(skill.id, now) || now < this.ultimateEndsAt) return;
    this.player.cooldowns.set(skill.id, now + skill.cooldown);
    const target = this.nearestEnemy(skill.range);
    if (target) {
      this.rotatePlayerToward(target.object.position);
      const behind = target.object.position.clone().add(this.getPlayerForward().multiplyScalar(-1.7));
      behind.y = 0;
      this.player.object.position.copy(behind);
      this.clampToArena(this.player.object.position);
    } else {
      this.player.object.position.addScaledVector(this.getPlayerForward(), 4.5);
      this.clampToArena(this.player.object.position);
    }
    this.player.invulnerableUntil = now + 0.25;
    this.audio.magic();
    this.spawnRing(this.player.object.position, '#7c3aed', 3.2, 0.28);
    this.spawnParticleBurst(this.player.object.position, '#a78bfa', 18, 0.55);
    this.damageEnemiesInArc(skill.radius, Math.PI * 1.15, skill.damageMultiplier, skill.name, '#a78bfa', 1.8);
    this.player.shadowPower = addShadowPower(this.player.shadowPower, skill.shadowGain, this.player.stats.shadowGainMultiplier);
  }

  private useUmbralBloom(): void {
    const skill = protagonist.skills[1];
    const now = performance.now() / 1000;
    if (!this.cooldownReady(skill.id, now) || now < this.ultimateEndsAt) return;
    this.player.cooldowns.set(skill.id, now + skill.cooldown);
    this.audio.magic();
    this.spawnRing(this.player.object.position, '#f43f5e', skill.radius, 0.42);
    this.spawnParticleBurst(this.player.object.position, '#f43f5e', 30, 0.72);
    let hit = 0;
    for (const enemy of this.enemies) {
      if (enemy.object.position.distanceTo(this.player.object.position) <= skill.radius + enemy.radius) {
        this.damageEnemy(enemy, skill.damageMultiplier, skill.name, '#f43f5e', 0.9);
        enemy.stagger += 18;
        hit += 1;
      }
    }
    this.player.shadowPower = addShadowPower(this.player.shadowPower, skill.shadowGain + hit * 2, this.player.stats.shadowGainMultiplier);
  }

  private useNocturneBarrier(): void {
    const skill = protagonist.skills[2];
    const now = performance.now() / 1000;
    if (!this.cooldownReady(skill.id, now)) return;
    this.player.cooldowns.set(skill.id, now + skill.cooldown);
    this.player.barrierUntil = now + (skill.duration ?? 4);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.08));
    this.audio.magic();
    this.spawnRing(this.player.object.position, '#22d3ee', skill.radius, skill.duration ?? 4);
    for (const enemy of this.enemies) {
      if (enemy.object.position.distanceTo(this.player.object.position) <= skill.radius + enemy.radius) {
        this.damageEnemy(enemy, skill.damageMultiplier, skill.name, '#22d3ee', 0.4);
      }
    }
    this.player.shadowPower = addShadowPower(this.player.shadowPower, skill.shadowGain, this.player.stats.shadowGainMultiplier);
    this.toast('Nocturne Barrier active: incoming damage reduced.');
  }

  private dodge(): void {
    const now = performance.now() / 1000;
    if (!this.cooldownReady('dodge', now) || now < this.ultimateEndsAt) return;
    this.player.cooldowns.set('dodge', now + 1.05);
    const input = this.getKeyboardInput().add(this.moveInput);
    const direction = input.lengthSq() > 0.01 ? this.inputToWorldDirection(input) : this.getPlayerForward();
    this.player.dodgeVelocity.copy(direction.normalize().multiplyScalar(16));
    this.player.dodgeUntil = now + 0.32;
    this.player.invulnerableUntil = now + 0.42;
    this.audio.dodge();
    this.spawnAfterImage();
    this.spawnRing(this.player.object.position, '#a78bfa', 2.1, 0.25);
  }

  private useUltimate(): void {
    const character = this.getActiveCharacter();
    const ultimate = character.ultimate;
    const now = performance.now() / 1000;
    if (this.player.shadowPower < SHADOW_POWER_MAX || !this.cooldownReady(ultimate.id, now) || now < this.ultimateEndsAt) return;
    this.player.cooldowns.set(ultimate.id, now + ultimate.cooldown);
    this.unlockAchievement('shadowAwakening');
    this.player.shadowPower = 0;
    this.ultimateImpactAt = now + (this.profile.settings.reducedMotion ? 0.18 : 0.86);
    this.ultimateEndsAt = now + (this.profile.settings.reducedMotion ? 0.7 : 2.35);
    this.ultimateDidImpact = false;
    this.currentObjective = ultimate.line;
    this.audio.ultimate();
    this.shake(1.35);
    this.spawnRing(this.player.object.position, '#facc15', 7, 0.9);
    this.spawnParticleBurst(this.player.object.position, '#7c3aed', 54, 1.4);
    this.toast(`Ultimate — ${ultimate.name}`);
  }

  private impactUltimate(now: number): void {
    if (this.ultimateDidImpact || now < this.ultimateImpactAt) return;
    this.ultimateDidImpact = true;
    const ultimate = this.getActiveCharacter().ultimate;
    const aliveBefore = this.enemies.filter((enemy) => enemy.alive).length;
    this.spawnRing(this.player.object.position, '#f43f5e', ultimate.radius, 0.68);
    this.spawnParticleBurst(this.player.object.position, '#facc15', 72, 1.1);
    for (const enemy of [...this.enemies]) {
      if (enemy.object.position.distanceTo(this.player.object.position) <= ultimate.radius + enemy.radius) {
        this.damageEnemy(enemy, ultimate.damageMultiplier, ultimate.name, '#facc15', 4.4);
      }
    }
    if (this.enemies.filter((enemy) => enemy.alive).length < aliveBefore) this.unlockAchievement('ultimateFinish');
    this.shake(1.8);
  }

  private damageEnemiesInArc(range: number, angle: number, multiplier: number, label: string, color: string, knockback: number): number {
    const origin = this.player.object.position;
    const forward = this.getPlayerForward();
    let hitCount = 0;
    for (const enemy of this.enemies) {
      const offset = enemy.object.position.clone().sub(origin).setY(0);
      const distance = offset.length();
      if (distance > range + enemy.radius || distance <= 0.001) continue;
      const direction = offset.clone().normalize();
      if (direction.dot(forward) < Math.cos(angle / 2)) continue;
      this.damageEnemy(enemy, multiplier, label, color, knockback);
      hitCount += 1;
    }
    return hitCount;
  }

  private damageEnemy(enemy: EnemyEntity, multiplier: number, label: string, color: string, knockback: number): void {
    if (!enemy.alive) return;
    const damage = computeDamage(this.player.stats.attack, multiplier, enemy.defense, 0.94 + Math.random() * 0.16, this.player.stats.critChance, Math.random());
    enemy.hp = Math.max(0, enemy.hp - damage);
    enemy.stagger += damage * 0.36;
    this.player.combo += 1;
    this.player.comboExpiresAt = performance.now() / 1000 + 2.4;
    this.player.shadowPower = addShadowPower(this.player.shadowPower, 3.2, this.player.stats.shadowGainMultiplier);
    this.audio.hit();
    this.spawnDamageLabel(enemy.object.position.clone().add(new THREE.Vector3(0, 2.2, 0)), damage, color, label);
    this.spawnParticleBurst(enemy.object.position.clone().add(new THREE.Vector3(0, 1.2, 0)), color, 8, 0.35);

    const knockDirection = enemy.object.position.clone().sub(this.player.object.position).setY(0);
    if (knockDirection.lengthSq() > 0.001) {
      enemy.object.position.addScaledVector(knockDirection.normalize(), knockback * 0.22);
      this.clampToArena(enemy.object.position);
    }

    if (enemy.stagger >= enemy.staggerMax) {
      enemy.stagger = 0;
      enemy.stunnedUntil = performance.now() / 1000 + (enemy.aiStyle === 'boss' ? 1.1 : 1.65);
      this.spawnDamageLabel(enemy.object.position.clone().add(new THREE.Vector3(0, 3, 0)), 'STAGGER', '#facc15', 'Break');
      this.player.shadowPower = addShadowPower(this.player.shadowPower, 9, this.player.stats.shadowGainMultiplier);
    }

    if (enemy.hp <= 0) this.killEnemy(enemy);
  }

  private damagePlayer(amount: number, source: THREE.Vector3, now: number, label: string): void {
    if (this.screen !== 'playing') return;
    if (now < this.player.invulnerableUntil) {
      this.player.shadowPower = addShadowPower(this.player.shadowPower, 9, this.player.stats.shadowGainMultiplier);
      this.unlockAchievement('perfectDodge');
      this.spawnDamageLabel(this.player.object.position.clone().add(new THREE.Vector3(0, 2.4, 0)), 'PERFECT', '#a78bfa', 'Dodge');
      this.toast('Perfect dodge: Shadow Power increased.');
      return;
    }

    const barrierScale = now < this.player.barrierUntil ? 0.42 : 1;
    const mitigated = Math.max(1, Math.round((amount - this.player.stats.defense * 0.45) * barrierScale));
    this.player.hp = Math.max(0, this.player.hp - mitigated);
    this.spawnDamageLabel(this.player.object.position.clone().add(new THREE.Vector3(0, 2.5, 0)), mitigated, '#ef4444', label);
    this.spawnRing(source, '#ef4444', 1.4, 0.24);
    this.shake(0.55);

    if (this.profile.settings.vibration && 'vibrate' in navigator) {
      navigator.vibrate(28);
    }

    if (this.player.hp <= 0) {
      this.showDefeat();
    }
  }

  private killEnemy(enemy: EnemyEntity): void {
    if (!enemy.alive) return;
    enemy.alive = false;
    this.unlockAchievement('firstBlood');
    this.grantRewards(enemy.xpReward, enemy.goldReward, 0, false);
    if (enemy.aiStyle === 'boss') this.grantMaterials({ nullFragment: 1, eclipseCore: 1 });
    else if (enemy.aiStyle === 'miniboss') this.grantMaterials({ eclipseCore: 1 });
    else if (enemy.aiStyle === 'tank') this.grantMaterials({ shadowShard: 2 });
    else if (enemy.aiStyle === 'ranged') this.grantMaterials({ trainingSigil: 1 });
    else this.grantMaterials({ shadowShard: 1 });
    this.spawnRing(enemy.object.position, enemy.data.color, 2.5 + enemy.radius, 0.38);
    this.spawnParticleBurst(enemy.object.position.clone().add(new THREE.Vector3(0, 1.4, 0)), enemy.data.color, enemy.aiStyle === 'boss' ? 42 : 18, 0.8);
    this.scene.remove(enemy.object);
    if (this.activeBoss === enemy) this.activeBoss = null;
  }

  private grantRewards(xp: number, gold: number, skillPoints: number, showToast = true): { levelsGained: number } {
    const result = applyXp(this.profile.level, this.profile.xp, xp);
    this.profile.level = result.level;
    this.profile.xp = result.xp;
    this.profile.gold += gold;
    this.profile.skillPoints += skillPoints;
    if (result.levelsGained > 0) {
      this.syncPlayerStatsFromProfile(true);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.round(this.player.maxHp * 0.25));
    }
    if (showToast) {
      this.toast(`Rewards: +${xp} XP, +${gold} Gold${result.levelsGained ? `, +${result.levelsGained} Level` : ''}`);
    }
    return { levelsGained: result.levelsGained };
  }

  private queueEnemyAttack(enemy: EnemyEntity, windup: number, radius: number, damage: number, label: string, color: string): void {
    enemy.pendingAttack = {
      impactAt: performance.now() / 1000 + windup,
      radius,
      damage,
      label,
      color
    };
    this.spawnTelegraph(enemy.object.position, color, radius, windup);
  }

  private resolvePendingAttack(enemy: EnemyEntity, now: number): void {
    if (!enemy.pendingAttack) return;
    this.facePlayer(enemy.object);
    if (now < enemy.pendingAttack.impactAt) return;
    const pending = enemy.pendingAttack;
    enemy.pendingAttack = undefined;
    this.spawnRing(enemy.object.position, pending.color, pending.radius, 0.25);
    if (this.distanceToPlayer(enemy.object.position) <= pending.radius + this.player.radius) {
      this.damagePlayer(pending.damage, enemy.object.position, now, pending.label);
    }
  }

  private bossFanProjectiles(enemy: EnemyEntity, count: number, spread: number, color: string): void {
    this.facePlayer(enemy.object);
    const base = this.player.object.position.clone().sub(enemy.object.position).setY(0).normalize();
    const baseAngle = Math.atan2(base.x, base.z);
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const angle = baseAngle + t * spread * Math.PI;
      const direction = new THREE.Vector3(Math.sin(angle), 0.06, Math.cos(angle)).normalize();
      this.spawnProjectile(enemy.object.position.clone().add(new THREE.Vector3(0, 1.7, 0)), direction, 7.2 + enemy.bossPhase, enemy.attack * 0.88, 0.42, 'enemy', color);
    }
    this.spawnRing(enemy.object.position, color, 2.5, 0.38);
  }

  private bossRadialProjectiles(enemy: EnemyEntity, count: number, color: string): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const direction = new THREE.Vector3(Math.sin(angle), 0.05, Math.cos(angle)).normalize();
      this.spawnProjectile(enemy.object.position.clone().add(new THREE.Vector3(0, 1.7, 0)), direction, 8.4, enemy.attack * 0.82, 0.42, 'enemy', color);
    }
    this.spawnRing(enemy.object.position, color, 4.8, 0.42);
  }

  private spawnEnemy(enemyId: string, x: number, z: number): void {
    const data = enemies[enemyId];
    if (!data) throw new Error(`Unknown enemy: ${enemyId}`);
    const object = this.makeEnemyModel(data);
    object.position.set(x, 0, z);
    this.arenaRoot.add(object);
    const levelScale = 1 + Math.max(0, this.profile.level - 1) * 0.08;
    const entity: EnemyEntity = {
      id: `${enemyId}-${this.enemySerial += 1}`,
      data,
      object,
      hp: Math.round(data.maxHealth * levelScale),
      maxHp: Math.round(data.maxHealth * levelScale),
      attack: Math.round(data.attack * levelScale),
      defense: Math.round(data.defense * levelScale),
      speed: data.speed,
      radius: data.radius,
      stagger: 0,
      staggerMax: data.staggerMax,
      xpReward: data.xpReward,
      goldReward: data.goldReward,
      aiStyle: data.aiStyle,
      attackReadyAt: performance.now() / 1000 + 0.8,
      abilityReadyAt: performance.now() / 1000 + 1.5,
      stunnedUntil: 0,
      alive: true,
      bossPhase: 1,
      abilityIndex: 0
    };
    this.enemies.push(entity);
    if (data.aiStyle === 'boss' || data.aiStyle === 'miniboss') {
      this.activeBoss = entity;
      this.refs.bossPanel.classList.remove('hidden');
      this.audio.stopMusic();
      this.audio.startMusic(data.aiStyle === 'boss' ? 'boss' : 'battle');
    }
  }

  private clearEnemiesAndProjectiles(): void {
    for (const enemy of this.enemies) enemy.object.parent?.remove(enemy.object);
    for (const projectile of this.projectiles) projectile.object.parent?.remove(projectile.object);
    this.enemies = [];
    this.projectiles = [];
    this.activeBoss = null;
    this.refs.bossPanel.classList.add('hidden');
  }

  private resetPlayerForMission(): void {
    this.syncPlayerStatsFromProfile(false);
    this.rebuildPlayerModel(false);
    this.player.hp = this.player.maxHp;
    this.player.shadowPower = 0;
    this.player.combo = 0;
    this.player.comboExpiresAt = 0;
    this.player.cooldowns.clear();
    this.player.object.position.set(0, 0, 6);
    this.player.facing = Math.PI;
    this.player.object.rotation.y = Math.PI;
    this.cameraYaw = Math.PI;
    this.hideWaypoint();
  }

  private syncPlayerStatsFromProfile(keepHealthRatio: boolean): void {
    const oldMax = this.player?.maxHp ?? protagonist.baseStats.maxHealth;
    const ratio = oldMax > 0 ? (this.player?.hp ?? oldMax) / oldMax : 1;
    if (!this.player) return;
    const stats = this.getComputedStats();
    this.player.stats = stats;
    this.player.maxHp = stats.maxHealth;
    this.player.hp = keepHealthRatio ? Math.max(1, Math.round(stats.maxHealth * ratio)) : Math.min(this.player.hp || stats.maxHealth, stats.maxHealth);
  }

  private getKeyboardInput(): THREE.Vector2 {
    const input = new THREE.Vector2();
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) input.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) input.x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) input.y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) input.y -= 1;
    return input;
  }

  private inputToWorldDirection(input: THREE.Vector2): THREE.Vector3 {
    const normalized = input.clone();
    if (normalized.lengthSq() > 1) normalized.normalize();
    const forward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    return new THREE.Vector3().addScaledVector(right, normalized.x).addScaledVector(forward, normalized.y).normalize();
  }

  private updateJoystick(clientX: number, clientY: number): void {
    const rect = this.refs.joystickZone.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const max = rect.width * 0.34;
    const dx = clamp(clientX - centerX, -max, max);
    const dy = clamp(clientY - centerY, -max, max);
    this.moveInput.set(dx / max, -dy / max);
    if (this.moveInput.lengthSq() > 1) this.moveInput.normalize();
    this.refs.joystickThumb.style.transform = `translate(calc(-50% + ${this.moveInput.x * max}px), calc(-50% + ${-this.moveInput.y * max}px))`;
  }

  private cooldownReady(id: string, now: number): boolean {
    return (this.player.cooldowns.get(id) ?? 0) <= now;
  }

  private updateCooldownButtons(now: number): void {
    const character = this.getActiveCharacter();
    const byAction: Partial<Record<InputAction, string>> = {
      skill1: character.skills[0].id,
      skill2: character.skills[1].id,
      skill3: character.skills[2].id,
      dodge: 'dodge',
      ultimate: character.ultimate.id
    };

    for (const [action, button] of this.refs.actionButtons) {
      const cooldownId = byAction[action];
      const label = button.querySelector<HTMLSpanElement>('.cooldown-label');
      let remaining = 0;
      if (cooldownId) remaining = Math.max(0, (this.player.cooldowns.get(cooldownId) ?? 0) - now);
      const ultimateBlocked = action === 'ultimate' && this.player.shadowPower < SHADOW_POWER_MAX;
      const disabled = remaining > 0 || ultimateBlocked || now < this.ultimateEndsAt;
      button.classList.toggle('disabled', disabled);
      button.setAttribute('aria-disabled', String(disabled));
      if (label) {
        label.hidden = !disabled;
        label.textContent = action === 'ultimate' && ultimateBlocked && remaining <= 0 ? '100%' : formatCooldown(remaining);
      }
    }
  }

  private updateEffects(delta: number): void {
    for (const effect of this.effects) {
      effect.life -= delta;
      if (effect.velocity) effect.object.position.addScaledVector(effect.velocity, delta);
      if (effect.expand) {
        const scale = 1 + (1 - effect.life / effect.maxLife) * effect.expand;
        effect.object.scale.setScalar(scale);
      }
      if (effect.fade) {
        effect.object.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.material) return;
          const material = mesh.material as THREE.Material & { opacity?: number; transparent?: boolean };
          material.transparent = true;
          material.opacity = clamp(effect.life / effect.maxLife, 0, 1);
        });
      }
    }

    for (const effect of this.effects.filter((item) => item.life <= 0)) {
      effect.object.parent?.remove(effect.object);
    }
    this.effects = this.effects.filter((item) => item.life > 0);

    if (this.screen === 'playing') {
      const now = performance.now() / 1000;
      this.impactUltimate(now);
    }
  }

  private updateDamageLabels(delta: number): void {
    const width = this.refs.damageLayer.clientWidth;
    const height = this.refs.damageLayer.clientHeight;
    for (const label of this.damageLabels) {
      label.life -= delta;
      label.lift += delta * 0.9;
      const projected = label.world.clone().add(new THREE.Vector3(0, label.lift, 0)).project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const opacity = clamp(label.life / label.maxLife, 0, 1);
      label.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 + (1 - opacity) * 0.18})`;
      label.element.style.opacity = opacity.toString();
    }
    for (const label of this.damageLabels.filter((item) => item.life <= 0)) {
      label.element.remove();
    }
    this.damageLabels = this.damageLabels.filter((item) => item.life > 0);
  }

  private updateCamera(delta: number, now: number): void {
    if (this.screen !== 'playing') {
      this.updateLobbyCamera(delta, now);
      return;
    }
    const playerPosition = this.player.object.position;
    const forward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const ultimateZoom = now < this.ultimateEndsAt && !this.profile.settings.reducedMotion ? 0.62 : 1;
    const distance = 8.4 * ultimateZoom;
    const height = 4.9 * ultimateZoom + Math.sin(this.cameraPitch) * 1.4;
    const desired = playerPosition.clone().addScaledVector(forward, -distance).addScaledVector(right, 1.25).add(new THREE.Vector3(0, height, 0));

    if (this.cameraShake > 0 && this.profile.settings.screenShake && !this.profile.settings.reducedMotion) {
      this.cameraShake = Math.max(0, this.cameraShake - delta * 1.6);
      desired.x += (Math.random() - 0.5) * this.cameraShake * 0.34;
      desired.y += (Math.random() - 0.5) * this.cameraShake * 0.22;
    }

    this.camera.position.lerp(desired, 1 - Math.pow(0.002, delta));
    const lookAt = playerPosition.clone().addScaledVector(forward, 2.8).add(new THREE.Vector3(0, 1.65, 0));
    this.camera.lookAt(lookAt);
  }

  private updateHud(): void {
    if (!this.player) return;
    const activeCharacter = this.getActiveCharacter();
    const healthRatio = clamp(this.player.hp / this.player.maxHp, 0, 1);
    this.refs.activeCodename.textContent = activeCharacter.codename;
    this.refs.activeName.textContent = activeCharacter.displayName;
    this.refs.healthFill.style.transform = `scaleX(${healthRatio})`;
    this.refs.shadowFill.style.transform = `scaleX(${clamp(this.player.shadowPower / SHADOW_POWER_MAX, 0, 1)})`;
    const xpRequirement = levelXpRequirement(this.profile.level);
    this.refs.xpFill.style.transform = `scaleX(${clamp(this.profile.xp / xpRequirement, 0, 1)})`;
    this.refs.playerLevel.textContent = `LV ${this.profile.level}`;
    this.refs.playerGold.textContent = `GOLD ${this.profile.gold}`;
    this.refs.playerXp.textContent = `XP ${this.profile.xp} / ${xpRequirement}`;
    this.refs.objectiveCopy.textContent = this.currentObjective;

    if (this.activeBoss && this.activeBoss.alive) {
      this.refs.bossPanel.classList.remove('hidden');
      this.refs.bossName.textContent = this.activeBoss.data.displayName;
      this.refs.bossPhase.textContent = this.activeBoss.aiStyle === 'boss' ? `Phase ${this.activeBoss.bossPhase}` : 'Mini-Boss';
      this.refs.bossFill.style.transform = `scaleX(${clamp(this.activeBoss.hp / this.activeBoss.maxHp, 0, 1)})`;
    } else {
      this.refs.bossPanel.classList.add('hidden');
    }

    if (this.player.combo > 1 && performance.now() / 1000 < this.player.comboExpiresAt) {
      this.refs.comboBadge.classList.remove('hidden');
      this.refs.comboBadge.textContent = `${this.player.combo} HIT`;
    } else {
      this.refs.comboBadge.classList.add('hidden');
    }

    this.updateMinimap();
  }

  private updateMinimap(): void {
    const grid = this.refs.minimapGrid;
    grid.innerHTML = '';
    const addDot = (className: string, x: number, z: number): void => {
      const dot = document.createElement('span');
      dot.className = `map-dot ${className}`;
      dot.style.left = `${clamp((x / ARENA_LIMIT) * 50 + 50, 4, 96)}%`;
      dot.style.top = `${clamp((z / ARENA_LIMIT) * 50 + 50, 4, 96)}%`;
      grid.appendChild(dot);
    };
    addDot('player', this.player.object.position.x, this.player.object.position.z);
    for (const enemy of this.enemies) addDot('enemy', enemy.object.position.x, enemy.object.position.z);
    if (this.waypointMarker?.visible) addDot('marker', this.waypointMarker.position.x, this.waypointMarker.position.z);
  }

  private setSceneMode(mode: 'lobby' | 'arena'): void {
    if (!this.lobbyRoot || !this.arenaRoot) return;
    const shell = this.root.querySelector<HTMLElement>('.game-shell');
    const lobbyActive = mode === 'lobby';
    this.lobbyRoot.visible = lobbyActive;
    this.arenaRoot.visible = !lobbyActive;
    shell?.classList.toggle('lobby-background-active', lobbyActive);
    if (lobbyActive) {
      this.scene.background = null;
      this.scene.fog = null;
      this.renderer.setClearColor('#000000', 0);
      this.syncLobbyHero();
      return;
    }
    this.scene.background = new THREE.Color('#070713');
    this.scene.fog = new THREE.Fog('#070713', 20, 56);
    this.renderer.setClearColor('#070713', 1);
  }

  private setCombatUI(visible: boolean): void {
    this.refs.overlay.classList.remove('lobby-overlay');
    this.setSceneMode(visible ? 'arena' : 'lobby');
    this.refs.hud.classList.toggle('hidden', !visible);
    this.refs.touchControls.classList.toggle('hidden', !visible);
    this.refs.partyBar.classList.toggle('hidden', !visible);
    if (!visible) {
      this.refs.bossPanel.classList.add('hidden');
      this.refs.comboBadge.classList.add('hidden');
    }
  }

  private placeWaypoint(x: number, z: number): void {
    if (!this.waypointMarker) return;
    this.waypointMarker.position.set(x, 0.04, z);
    this.waypointMarker.visible = true;
  }

  private hideWaypoint(): void {
    if (this.waypointMarker) this.waypointMarker.visible = false;
  }

  private spawnProjectile(origin: THREE.Vector3, direction: THREE.Vector3, speed: number, damage: number, radius: number, from: 'enemy' | 'player', color: string): void {
    const material = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
    mesh.position.copy(origin);
    this.arenaRoot.add(mesh);
    this.projectiles.push({ object: mesh, velocity: direction.normalize().multiplyScalar(speed), damage, radius, life: 4.2, from, color });
  }

  private spawnRing(position: THREE.Vector3, color: string, finalScale: number, duration: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.76, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.02, 64), material);
    ring.position.copy(position).setY(0.07);
    ring.rotation.x = -Math.PI / 2;
    this.arenaRoot.add(ring);
    this.effects.push({ object: ring, life: duration, maxLife: duration, expand: finalScale, fade: true });
  }

  private spawnTelegraph(position: THREE.Vector3, color: string, radius: number, duration: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.34, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.86, radius, 64), material);
    ring.position.copy(position).setY(0.055);
    ring.rotation.x = -Math.PI / 2;
    this.arenaRoot.add(ring);
    this.effects.push({ object: ring, life: duration, maxLife: duration, fade: true });
  }

  private spawnParticleBurst(position: THREE.Vector3, color: string, count: number, duration: number): void {
    const geometry = new THREE.SphereGeometry(0.06, 8, 6);
    for (let i = 0; i < count; i += 1) {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
      mesh.position.copy(position).add(new THREE.Vector3(0, 0.8 + Math.random() * 0.8, 0));
      const velocity = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 5);
      this.arenaRoot.add(mesh);
      this.effects.push({ object: mesh, life: duration, maxLife: duration, velocity, fade: true });
    }
  }

  private spawnSlashArc(color: string, range: number): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.66, side: THREE.DoubleSide });
    const arc = new THREE.Mesh(new THREE.RingGeometry(range * 0.52, range * 0.58, 48, 1, -0.65, 1.3), material);
    arc.position.copy(this.player.object.position).add(new THREE.Vector3(0, 0.7, 0)).addScaledVector(this.getPlayerForward(), 1.1);
    arc.rotation.x = Math.PI / 2;
    arc.rotation.z = -this.player.facing;
    this.arenaRoot.add(arc);
    this.effects.push({ object: arc, life: 0.18, maxLife: 0.18, expand: 0.35, fade: true });
  }

  private spawnAfterImage(): void {
    const ghost = this.player.object.clone(true);
    ghost.position.copy(this.player.object.position);
    ghost.rotation.copy(this.player.object.rotation);
    ghost.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.material) return;
      mesh.material = new THREE.MeshBasicMaterial({ color: '#a78bfa', transparent: true, opacity: 0.26 });
    });
    this.arenaRoot.add(ghost);
    this.effects.push({ object: ghost, life: 0.32, maxLife: 0.32, fade: true });
  }

  private spawnDamageLabel(position: THREE.Vector3, amount: number | string, color: string, label: string): void {
    const element = document.createElement('div');
    element.className = 'damage-number';
    element.style.color = color;
    element.textContent = typeof amount === 'number' ? `${label} ${amount}` : amount;
    this.refs.damageLayer.appendChild(element);
    this.damageLabels.push({ element, world: position, life: 0.95, maxLife: 0.95, lift: 0 });
  }

  private toast(message: string): void {
    this.refs.toast.textContent = message;
    this.refs.toast.classList.remove('hidden');
    window.setTimeout(() => this.refs.toast.classList.add('hidden'), 2600);
  }

  private faceNearestEnemy(maxRange: number): void {
    const target = this.nearestEnemy(maxRange);
    if (target) this.rotatePlayerToward(target.object.position);
  }

  private nearestEnemy(maxRange: number): EnemyEntity | null {
    let nearest: EnemyEntity | null = null;
    let nearestDistance = maxRange;
    for (const enemy of this.enemies) {
      const distance = enemy.object.position.distanceTo(this.player.object.position);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private rotatePlayerToward(target: THREE.Vector3): void {
    const offset = target.clone().sub(this.player.object.position);
    if (offset.lengthSq() <= 0.001) return;
    this.player.facing = Math.atan2(offset.x, offset.z);
    this.player.object.rotation.y = this.player.facing;
  }

  private getPlayerForward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.player.facing), 0, Math.cos(this.player.facing)).normalize();
  }

  private moveEnemyTowardPlayer(enemy: EnemyEntity, delta: number, speed: number): void {
    const direction = this.player.object.position.clone().sub(enemy.object.position).setY(0);
    if (direction.lengthSq() <= 0.001) return;
    direction.normalize();
    enemy.object.position.addScaledVector(direction, speed * delta);
    this.facePlayer(enemy.object);
    this.clampToArena(enemy.object.position);
  }

  private facePlayer(object: THREE.Object3D): void {
    const direction = this.player.object.position.clone().sub(object.position).setY(0);
    if (direction.lengthSq() <= 0.001) return;
    object.rotation.y = Math.atan2(direction.x, direction.z);
  }

  private distanceToPlayer(position: THREE.Vector3): number {
    return position.clone().setY(0).distanceTo(this.player.object.position.clone().setY(0));
  }

  private clampToArena(position: THREE.Vector3): void {
    position.x = clamp(position.x, -ARENA_LIMIT + 1, ARENA_LIMIT - 1);
    position.z = clamp(position.z, -ARENA_LIMIT + 1, ARENA_LIMIT - 1);
  }

  private shake(amount: number): void {
    if (!this.profile.settings.screenShake || this.profile.settings.reducedMotion) return;
    this.cameraShake = Math.max(this.cameraShake, amount);
  }

  private resize(): void {
    const width = this.refs.sceneHost.clientWidth || window.innerWidth;
    const height = this.refs.sceneHost.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private updateRendererQuality(): void {
    const preset = this.profile.settings.graphicsPreset;
    const ratio = preset === 'LOW' ? 1 : preset === 'MEDIUM' ? 1.35 : preset === 'HIGH' ? 1.75 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratio));
  }

  private persist(): void {
    this.saveData.profile = this.profile;
    this.saveManager.save(this.saveData);
  }
}
