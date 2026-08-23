// ─── Game State Manager ───────────────────────────────────────
// Central game state store — single source of truth for the entire game

import { GAME_CONFIG, AI_CONFIG } from '../data/balancing.js';
import { BUILDINGS, BUILDING_TYPES } from '../data/buildings.js';

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    // Turn tracking
    this.turn = 1;
    this.maxTurns = GAME_CONFIG.MAX_TURNS;
    this.phase = 'player'; // 'player' | 'ai_analyzing' | 'ai_attacking' | 'combat' | 'resolution' | 'game_over'

    // Player resources
    this.resources = { ...GAME_CONFIG.STARTING_RESOURCES };
    this.resourceCaps = { ...GAME_CONFIG.BASE_RESOURCE_CAP };
    this.income = { ...GAME_CONFIG.BASE_INCOME };

    // Population
    this.population = 0;
    this.maxPopulation = GAME_CONFIG.BASE_POPULATION;

    // Buildings placed on the map
    // Each entry: { id, type, level, hp, maxHp, col, row, direction?, buildQueue? }
    this.buildings = [];
    this.nextBuildingId = 1;

    // Player units
    // Each entry: { id, type, hp, maxHp, col, row, assignedTo? }
    this.playerUnits = [];
    this.nextUnitId = 1;

    // Enemy state
    this.enemyArmy = { ...AI_CONFIG.STARTING_ENEMY_ARMY };
    this.enemyUnitsOnField = []; // Active enemy units during combat
    this.enemyTotalStrength = 0;

    // Walls (directional HP)
    this.walls = {
      north: { hp: 0, maxHp: 0, segments: [] },
      south: { hp: 0, maxHp: 0, segments: [] },
      east:  { hp: 0, maxHp: 0, segments: [] },
      west:  { hp: 0, maxHp: 0, segments: [] },
    };

    // AI memory
    this.aiMemory = [];       // Last N attack outcomes
    this.lastAIStrategy = null;
    this.aiPipelineStep = null; // Current step in AI pipeline for animation

    // Battle log
    this.battleLog = [];

    // Build queue (buildings under construction)
    this.buildQueue = [];

    // Game stats
    this.stats = {
      buildingsBuilt: 0,
      unitsRecruited: 0,
      enemiesKilled: 0,
      damageDealt: 0,
      damageTaken: 0,
      resourcesSpent: { gold: 0, wood: 0, stone: 0, food: 0 },
      turnsPlayed: 0,
    };

    // UI state
    this.selectedBuilding = null;   // Building type being placed
    this.selectedCell = null;       // {col, row} of selected cell
    this.hoveredCell = null;        // {col, row} of hovered cell
    this.activeTab = 'build';

    // Map data
    this.mapCols = GAME_CONFIG.MAP_COLS;
    this.mapRows = GAME_CONFIG.MAP_ROWS;
    this.cellSize = GAME_CONFIG.CELL_SIZE;
    this.terrain = this._generateTerrain();

    // Place initial Town Center
    this._placeStartingBuildings();

    // Camera
    this.camera = { x: 0, y: 0, zoom: 1 };

    // Game result
    this.gameResult = null; // 'victory' | 'defeat' | null

    // Listeners
    this._listeners = {};
  }

  _generateTerrain() {
    const terrain = [];
    for (let r = 0; r < this.mapRows; r++) {
      terrain[r] = [];
      for (let c = 0; c < this.mapCols; c++) {
        // Default to grass
        let type = 'grass';

        // Roads leading to village center
        if (c === 10 && (r < 5 || r > 11)) type = 'road';
        if (r === 8 && (c < 6 || c > 14)) type = 'road';

        // Some trees/rocks for decoration
        const hash = (r * 7 + c * 13) % 37;
        if (type === 'grass') {
          if (hash < 3 && !this._isVillageArea(c, r)) type = 'trees';
          else if (hash < 5 && !this._isVillageArea(c, r)) type = 'rocks';
        }

        // Water patches
        if ((r === 2 && c >= 16 && c <= 18) || (r === 3 && c >= 17 && c <= 18)) {
          type = 'water';
        }

        terrain[r][c] = { type, decoration: hash % 5 };
      }
    }
    return terrain;
  }

  _isVillageArea(col, row) {
    const vb = GAME_CONFIG.VILLAGE_BOUNDS;
    return col >= vb.minCol && col <= vb.maxCol && row >= vb.minRow && row <= vb.maxRow;
  }

  _placeStartingBuildings() {
    // Place Town Center at center of village
    const tcCol = Math.floor((GAME_CONFIG.VILLAGE_BOUNDS.minCol + GAME_CONFIG.VILLAGE_BOUNDS.maxCol) / 2);
    const tcRow = Math.floor((GAME_CONFIG.VILLAGE_BOUNDS.minRow + GAME_CONFIG.VILLAGE_BOUNDS.maxRow) / 2);

    const tcData = BUILDINGS[BUILDING_TYPES.TOWN_CENTER].levels[0];
    this.buildings.push({
      id: this.nextBuildingId++,
      type: BUILDING_TYPES.TOWN_CENTER,
      level: 1,
      hp: tcData.hp,
      maxHp: tcData.hp,
      col: tcCol,
      row: tcRow,
      constructing: false,
      turnsLeft: 0,
    });

    // Update population from Town Center
    this.maxPopulation = GAME_CONFIG.BASE_POPULATION + (tcData.populationBonus || 0);

    // Update income from Town Center
    if (tcData.resourceBonus) {
      for (const [res, amount] of Object.entries(tcData.resourceBonus)) {
        this.income[res] = (this.income[res] || 0) + amount;
      }
    }
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
      buildings: this.buildings.map(b => ({
        type: b.type,
        level: b.level,
        hp: b.hp,
        maxHp: b.maxHp,
        direction: b.direction,
      })),
      aiMemory: this.aiMemory.slice(-AI_CONFIG.MEMORY_TURNS),
    };
  }
}
