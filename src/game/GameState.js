// ─── Game State Manager ───────────────────────────────────────
// Central game state store — single source of truth for the entire game
// Supports both PS1 defensive fortress and PS2 fullscreen offensive warfare.

import { GAME_CONFIG, AI_CONFIG } from '../data/balancing.js';
import { BUILDINGS, BUILDING_TYPES } from '../data/buildings.js';
import { PLAYER_UNITS, PLAYER_UNIT_TYPES } from '../data/units.js';
import { ENEMY_TARGETS, ENEMY_TARGET_TYPES, DEFENSIVE_STRATEGIES } from '../data/enemyBase.js';

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    // Turn tracking
    this.turn = 1;
    this.maxTurns = GAME_CONFIG.MAX_TURNS;
    // Phases: 'player' | 'attack_mode' | 'ai_defending' | 'ai_analyzing' | 'ai_attacking' | 'combat' | 'resolution' | 'game_over'
    this.phase = 'player';

    // Player resources
    this.resources = { ...GAME_CONFIG.STARTING_RESOURCES };
    this.resourceCaps = { ...GAME_CONFIG.BASE_RESOURCE_CAP };
    this.income = { ...GAME_CONFIG.BASE_INCOME };

    // Population
    this.population = 0;
    this.maxPopulation = GAME_CONFIG.BASE_POPULATION;

    // Buildings placed on the map
    this.buildings = [];
    this.nextBuildingId = 1;

    // Player units
    this.playerUnits = [];
    this.nextUnitId = 1;

    // Enemy state
    this.enemyArmy = { ...AI_CONFIG.STARTING_ENEMY_ARMY };
    this.enemyUnitsOnField = [];
    this.enemyTotalStrength = 0;

    // ─── PS2 Enemy Empire & Strategic Targets ───
    this.enemyBase = {
      targets: Object.values(ENEMY_TARGETS).map(t => ({
        id: t.id,
        name: t.name,
        subtitle: t.subtitle,
        icon: t.icon,
        col: t.col,
        row: t.row,
        lane: t.lane,
        hp: t.maxHp,
        maxHp: t.maxHp,
        baseArmor: t.baseArmor,
        value: t.value,
        badgeColor: t.badgeColor,
        description: t.description,
        consequence: t.consequence,
        status: 'active', // 'active' | 'damaged' | 'destroyed'
      })),
      modifiers: {
        incomePenalty: 0,
        reinforcementPenalty: 0,
        defensePenalty: 0,
        hpPenalty: 0,
        vulnerabilityBonus: 0,
      },
      garrison: {
        enemy_melee: 8,
        enemy_ranged: 6,
        enemy_siege: 2,
      },
    };

    // ─── PS2 Offensive Campaign State ───
    this.offensiveState = {
      isAttackMode: false,
      selectedTargetId: ENEMY_TARGET_TYPES.GOLD_MINE,
      selectedDeployUnit: PLAYER_UNIT_TYPES.WARRIOR,
      routes: {
        north: { [PLAYER_UNIT_TYPES.WARRIOR]: 0, [PLAYER_UNIT_TYPES.ARCHER]: 0, [PLAYER_UNIT_TYPES.DEFENDER]: 0, [PLAYER_UNIT_TYPES.SIEGE]: 0 },
        center: { [PLAYER_UNIT_TYPES.WARRIOR]: 0, [PLAYER_UNIT_TYPES.ARCHER]: 0, [PLAYER_UNIT_TYPES.DEFENDER]: 0, [PLAYER_UNIT_TYPES.SIEGE]: 0 },
        south: { [PLAYER_UNIT_TYPES.WARRIOR]: 0, [PLAYER_UNIT_TYPES.ARCHER]: 0, [PLAYER_UNIT_TYPES.DEFENDER]: 0, [PLAYER_UNIT_TYPES.SIEGE]: 0 },
      },
      lastAttackReport: null,
      lastAIDefense: null,
      aiDefensePipelineStep: null,
    };

    // Walls
    this.walls = {
      north: { hp: 0, maxHp: 0, segments: [] },
      south: { hp: 0, maxHp: 0, segments: [] },
      east:  { hp: 0, maxHp: 0, segments: [] },
      west:  { hp: 0, maxHp: 0, segments: [] },
    };

    // AI memory
    this.aiMemory = [];
    this.lastAIStrategy = null;
    this.aiPipelineStep = null;

    // AI Defense Memory
    this.aiDefenseMemory = [];
    this.aiDefenseWeights = {
      HOLD: 1.0,
      REINFORCE: 1.0,
      COUNTERATTACK: 1.0,
      REDIRECT: 1.0,
    };

    // Battle log & build queue
    this.battleLog = [];
    this.buildQueue = [];

    // Game stats
    this.stats = {
      buildingsBuilt: 0,
      unitsRecruited: 0,
      enemiesKilled: 0,
      damageDealt: 0,
      damageTaken: 0,
      enemyStructuresDestroyed: 0,
      offensiveCampaignsLaunched: 0,
      resourcesSpent: { gold: 0, wood: 0, stone: 0, food: 0 },
      turnsPlayed: 0,
    };

    // UI state
    this.selectedBuilding = null;
    this.selectedCell = null;
    this.hoveredCell = null;
    this.activeTab = 'build';

    // Map data
    this.mapCols = GAME_CONFIG.MAP_COLS;
    this.mapRows = GAME_CONFIG.MAP_ROWS;
    this.cellSize = GAME_CONFIG.CELL_SIZE;
    this.terrain = this._generateTerrain();

    // Place initial Town Center and Demo Army
    this._placeStartingBuildingsAndArmy();

    // Camera
    this.camera = { x: 0, y: 0, zoom: 1 };

    // Game result
    this.gameResult = null;
    this.victoryReason = null;

    // Listeners
    this._listeners = {};
  }

  _generateTerrain() {
    const terrain = [];
    for (let r = 0; r < this.mapRows; r++) {
      terrain[r] = [];
      for (let c = 0; c < this.mapCols; c++) {
        let type = 'grass';

        if (r <= 3) {
          type = 'dirt';
          if ((c === 4 || c === 16) && r === 1) type = 'rocks';
          if (c === 10 && r === 2) type = 'road';
        } else {
          if (c === 10 && (r < 5 || r > 11)) type = 'road';
          if (r === 8 && (c < 6 || c > 14)) type = 'road';

          const hash = (r * 7 + c * 13) % 37;
          if (type === 'grass') {
            if (hash < 3 && !this._isVillageArea(c, r)) type = 'trees';
            else if (hash < 5 && !this._isVillageArea(c, r)) type = 'rocks';
          }

          if ((r === 2 && c >= 18) || (r === 3 && c >= 18)) {
            type = 'water';
          }
        }

        terrain[r][c] = { type, decoration: (r * 7 + c * 13) % 5 };
      }
    }
    return terrain;
  }

  _isVillageArea(col, row) {
    const vb = GAME_CONFIG.VILLAGE_BOUNDS;
    return col >= vb.minCol && col <= vb.maxCol && row >= vb.minRow && row <= vb.maxRow;
  }

  _placeStartingBuildingsAndArmy() {
    // 1. Place Fortress Core
    const tcCol = 10;
    const tcRow = 8;
    this.buildings.push({
      id: this.nextBuildingId++,
      type: BUILDING_TYPES.TOWN_CENTER,
      level: 2,
      hp: 1600,
      maxHp: 1600,
      col: tcCol,
      row: tcRow,
      constructing: false,
      turnsLeft: 0,
    });

    if (GAME_CONFIG.DEMO_MODE) {
      // Established fortress structures for instant demo access
      this.buildings.push(
        { id: this.nextBuildingId++, type: BUILDING_TYPES.BARRACKS, level: 2, hp: 700, maxHp: 700, col: 7, row: 7, constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.ARCHER_TOWER, level: 2, hp: 450, maxHp: 450, col: 8, row: 5, constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.ARCHER_TOWER, level: 2, hp: 450, maxHp: 450, col: 12, row: 5, constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.CANNON_TOWER, level: 1, hp: 500, maxHp: 500, col: 10, row: 5, constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.RESOURCE_CAMP, level: 2, hp: 350, maxHp: 350, col: 13, row: 7, constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.STORAGE, level: 1, hp: 400, maxHp: 400, col: 7, row: 9, constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.WALL, level: 2, hp: 600, maxHp: 600, col: 7, row: 4, direction: 'north', constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.WALL, level: 2, hp: 600, maxHp: 600, col: 8, row: 4, direction: 'north', constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.WALL, level: 2, hp: 600, maxHp: 600, col: 12, row: 4, direction: 'north', constructing: false, turnsLeft: 0 },
        { id: this.nextBuildingId++, type: BUILDING_TYPES.WALL, level: 2, hp: 600, maxHp: 600, col: 13, row: 4, direction: 'north', constructing: false, turnsLeft: 0 },
      );

      // Standing Army Ready for Offensive Operations: 14 Warriors, 10 Archers, 6 Defenders, 4 Siege Rams
      const armyManifest = [
        { type: PLAYER_UNIT_TYPES.WARRIOR, count: 14 },
        { type: PLAYER_UNIT_TYPES.ARCHER, count: 10 },
        { type: PLAYER_UNIT_TYPES.DEFENDER, count: 6 },
        { type: PLAYER_UNIT_TYPES.SIEGE, count: 4 },
      ];

      for (const group of armyManifest) {
        const def = PLAYER_UNITS[group.type];
        for (let i = 0; i < group.count; i++) {
          const col = 7 + (i % 6);
          const row = 9 + Math.floor(i / 6);
          this.playerUnits.push({
            id: this.nextUnitId++,
            type: group.type,
            hp: def.hp,
            maxHp: def.hp,
            col,
            row,
          });
        }
      }
    }

    this.population = this.playerUnits.reduce((s, u) => s + (PLAYER_UNITS[u.type]?.populationCost || 1), 0);
  }

  // ─── Enemy Base Target Accessors & Mutation ───

  getEnemyTarget(id) {
    return this.enemyBase.targets.find(t => t.id === id);
  }

  getEnemyTargets() {
    return this.enemyBase.targets;
  }

  damageEnemyTarget(id, damage) {
    const target = this.getEnemyTarget(id);
    if (!target || target.status === 'destroyed') return { damage: 0, destroyed: false };

    const actualDamage = Math.min(target.hp, damage);
    target.hp -= actualDamage;

    let destroyed = false;
    if (target.hp <= 0) {
      target.hp = 0;
      target.status = 'destroyed';
      destroyed = true;
      this.stats.enemyStructuresDestroyed++;
      this.applyTargetConsequence(target);
    } else if (target.hp < target.maxHp) {
      target.status = 'damaged';
    }

    this.emit('enemy_target_damaged', { target, damage: actualDamage, destroyed });
    return { damage: actualDamage, destroyed, target };
  }

  applyTargetConsequence(target) {
    const mods = this.enemyBase.modifiers;
    switch (target.id) {
      case ENEMY_TARGET_TYPES.GOLD_MINE:
        mods.incomePenalty = 0.50;
        this.log(`💥 Enemy Gold Mine destroyed! Enemy resource budget reduced by 50%.`, 'player');
        break;
      case ENEMY_TARGET_TYPES.BARRACKS:
        mods.reinforcementPenalty = 0.50;
        this.log(`💥 Warlord Barracks leveled! Enemy reinforcement rate reduced by 50%.`, 'player');
        break;
      case ENEMY_TARGET_TYPES.WATCHTOWER:
        mods.defensePenalty = 0.40;
        this.log(`💥 Fortified Watchtower collapsed! Enemy crossfire defense bonus eliminated.`, 'player');
        break;
      case ENEMY_TARGET_TYPES.RESOURCE_DEPOT:
        mods.hpPenalty = 0.15;
        this.log(`💥 Supply Depot burned! Enemy army resilience reduced by 15%.`, 'player');
        break;
      case ENEMY_TARGET_TYPES.WALL_OUTPOST:
        mods.vulnerabilityBonus = 0.30;
        this.log(`💥 Outer Citadel breached! Stronghold now suffers +30% assault vulnerability.`, 'player');
        break;
      case ENEMY_TARGET_TYPES.COMMAND_CENTER:
        this.gameResult = 'victory';
        this.victoryReason = 'Enemy Stronghold Destroyed';
        this.phase = 'game_over';
        this.emit('game_over', { result: 'victory', reason: this.victoryReason });
        this.log(`🏆 THE ENEMY STRONGHOLD HAS FALLEN! TOTAL VICTORY!`, 'player');
        break;
    }
  }

  // ─── Fast Demo Scenario Reset ───

  loadDemoScenario() {
    this.reset();
    this.turn = 8;
    this.stats.turnsPlayed = 7;
    this.resources = { gold: 3000, wood: 2200, stone: 1800, food: 1500 };
    this.income = { gold: 60, wood: 40, stone: 30, food: 35 };

    this.log(`⚔️ [DEMO SCENARIO LOADED — TURN 8] Established Fortress & Army ready for Offensive Strike!`, 'player');
    this.emit('demo_loaded');
    this.emit('phase_change', this.phase);
  }

  // ─── Accessors ───

  getBuilding(id) {
    return this.buildings.find(b => b.id === id);
  }

  getBuildingsAt(col, row) {
    return this.buildings.filter(b => b.col === col && b.row === row);
  }

  getBuildingsByType(type) {
    return this.buildings.filter(b => b.type === type);
  }

  getWallHP(direction) {
    const walls = this.buildings.filter(b => b.type === BUILDING_TYPES.WALL && b.direction === direction);
    if (walls.length === 0) return { hp: 0, maxHp: 0, percentage: 0 };
    const hp = walls.reduce((sum, w) => sum + w.hp, 0);
    const maxHp = walls.reduce((sum, w) => sum + w.maxHp, 0);
    return { hp, maxHp, percentage: maxHp > 0 ? hp / maxHp : 0 };
  }

  getTowers() {
    return this.buildings.filter(b =>
      b.type === BUILDING_TYPES.ARCHER_TOWER || b.type === BUILDING_TYPES.CANNON_TOWER
    );
  }

  getAvailableUnitCounts() {
    const counts = {
      [PLAYER_UNIT_TYPES.WARRIOR]: 0,
      [PLAYER_UNIT_TYPES.ARCHER]: 0,
      [PLAYER_UNIT_TYPES.DEFENDER]: 0,
      [PLAYER_UNIT_TYPES.SIEGE]: 0,
    };
    for (const unit of this.playerUnits) {
      if (unit.hp > 0 && counts[unit.type] !== undefined) {
        counts[unit.type]++;
      }
    }
    return counts;
  }

  canAfford(costs) {
    for (const [res, amount] of Object.entries(costs)) {
      if ((this.resources[res] || 0) < amount) return false;
    }
    return true;
  }

  spendResources(costs) {
    for (const [res, amount] of Object.entries(costs)) {
      this.resources[res] -= amount;
      this.stats.resourcesSpent[res] = (this.stats.resourcesSpent[res] || 0) + amount;
    }
  }

  addResources(amounts) {
    for (const [res, amount] of Object.entries(amounts)) {
      this.resources[res] = Math.min(
        (this.resources[res] || 0) + amount,
        this.resourceCaps[res] || Infinity
      );
    }
  }

  // ─── Event System ───

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    for (const cb of this._listeners[event]) {
      cb(data);
    }
  }

  // ─── Battle Log ───

  log(message, type = 'neutral') {
    const entry = { turn: this.turn, message, type, timestamp: Date.now() };
    this.battleLog.push(entry);
    this.emit('log', entry);
  }

  // ─── Serialization for AI ───

  toAISnapshot() {
    return {
      turn: this.turn,
      maxTurns: this.maxTurns,
      resources: { ...this.resources },
      walls: {
        north: this.getWallHP('north'),
        south: this.getWallHP('south'),
        east: this.getWallHP('east'),
        west: this.getWallHP('west'),
      },
      towers: this.getTowers().map(t => ({
        type: t.type,
        level: t.level,
        hp: t.hp,
        maxHp: t.maxHp,
        col: t.col,
        row: t.row,
      })),
      playerUnits: this.playerUnits.map(u => ({
        type: u.type,
        hp: u.hp,
      })),
      enemyArmy: { ...this.enemyArmy },
      enemyBase: {
        targets: this.enemyBase.targets.map(t => ({
          id: t.id,
          name: t.name,
          hp: t.hp,
          maxHp: t.maxHp,
          status: t.status,
        })),
        modifiers: { ...this.enemyBase.modifiers },
      },
      buildings: this.buildings.map(b => ({
        type: b.type,
        level: b.level,
        hp: b.hp,
        maxHp: b.maxHp,
        direction: b.direction,
      })),
      aiMemory: this.aiMemory.slice(-AI_CONFIG.MEMORY_TURNS),
      aiDefenseMemory: this.aiDefenseMemory.slice(-AI_CONFIG.MEMORY_TURNS),
    };
  }
}
