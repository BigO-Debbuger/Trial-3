// ─── Building System ───────────────────────────────────────
// Handles building placement, upgrades, and construction queue

import { BUILDINGS, BUILDING_TYPES } from '../data/buildings.js';
import { GAME_CONFIG } from '../data/balancing.js';

export class BuildingSystem {
  constructor(gameState, resourceSystem) {
    this.state = gameState;
    this.resources = resourceSystem;
  }

  /**
   * Get building definition
   */
  getBuildingDef(type) {
    return BUILDINGS[type];
  }

  /**
   * Check if a building can be placed at a given cell
   */
  canPlace(type, col, row) {
    // Check bounds
    if (col < 0 || col >= this.state.mapCols || row < 0 || row >= this.state.mapRows) return false;

    // Check terrain — can't build on water
    const terrain = this.state.terrain[row]?.[col];
    if (!terrain || terrain.type === 'water') return false;

    // Check if cell is already occupied
    const existing = this.state.getBuildingsAt(col, row);
    if (existing.length > 0) return false;

    // Check village bounds for non-wall buildings
    const vb = GAME_CONFIG.VILLAGE_BOUNDS;
    const isVillage = col >= vb.minCol && col <= vb.maxCol && row >= vb.minRow && row <= vb.maxRow;

    if (type === BUILDING_TYPES.WALL || type === BUILDING_TYPES.GATE) {
      // Walls go on the edges of the village
      const isEdge = (
        (row === vb.minRow - 1 || row === vb.maxRow + 1) && col >= vb.minCol - 1 && col <= vb.maxCol + 1 ||
        (col === vb.minCol - 1 || col === vb.maxCol + 1) && row >= vb.minRow - 1 && row <= vb.maxRow + 1
      );
      if (!isEdge) return false;
    } else if (type !== BUILDING_TYPES.RESOURCE_CAMP) {
      // Most buildings must be inside village area
      if (!isVillage) return false;
    }

    // Check max count
    const buildingDef = BUILDINGS[type];
    if (buildingDef.maxCount) {
      const count = this.state.buildings.filter(b => b.type === type).length;
      if (count >= buildingDef.maxCount) return false;
    }

    // Check cost
    const levelData = buildingDef.levels[0];
    if (!this.resources.canAfford(levelData.cost)) return false;

    return true;
  }

  /**
   * Get the wall direction based on position relative to village center
   */
  getWallDirection(col, row) {
    const vb = GAME_CONFIG.VILLAGE_BOUNDS;
    if (row <= vb.minRow - 1) return 'north';
    if (row >= vb.maxRow + 1) return 'south';
    if (col <= vb.minCol - 1) return 'west';
    if (col >= vb.maxCol + 1) return 'east';
    return null;
  }

  /**
   * Place a building
   */
  placeBuilding(type, col, row) {
    if (!this.canPlace(type, col, row)) return null;

    const buildingDef = BUILDINGS[type];
    const levelData = buildingDef.levels[0];

    // Spend resources
    if (!this.resources.spend(levelData.cost)) return null;

    const direction = (type === BUILDING_TYPES.WALL || type === BUILDING_TYPES.GATE)
      ? this.getWallDirection(col, row)
      : null;

    const building = {
      id: this.state.nextBuildingId++,
      type,
      level: 1,
      hp: levelData.buildTime > 0 ? 0 : levelData.hp,
      maxHp: levelData.hp,
      col,
      row,
      direction,
      constructing: levelData.buildTime > 0,
      turnsLeft: levelData.buildTime,
    };

    this.state.buildings.push(building);
    this.state.stats.buildingsBuilt++;

    if (building.constructing) {
      this.state.log(`🏗️ Started building ${buildingDef.name} (${building.turnsLeft} turns)`, 'player');
    } else {
      this.state.log(`✅ Built ${buildingDef.name}`, 'player');
      this.resources.recalculateIncome();
      this.resources.recalculateCaps();
      this.resources.recalculatePopulation();
    }

    this.state.emit('building_placed', building);
    return building;
  }

  /**
   * Upgrade a building
   */
  upgradeBuilding(buildingId) {
    const building = this.state.getBuilding(buildingId);
    if (!building) return false;

    const buildingDef = BUILDINGS[building.type];
    if (!buildingDef) return false;

    if (building.level >= buildingDef.levels.length) return false; // Max level
    if (building.constructing) return false;

    const nextLevel = buildingDef.levels[building.level]; // 0-indexed, current level is already 1-indexed
    if (!nextLevel) return false;

    if (!this.resources.spend(nextLevel.cost)) return false;

    building.level++;
    building.maxHp = nextLevel.hp;
    building.hp = nextLevel.hp;

    if (nextLevel.buildTime > 0) {
      building.constructing = true;
      building.turnsLeft = nextLevel.buildTime;
      this.state.log(`⬆️ Upgrading ${buildingDef.name} to Level ${building.level} (${building.turnsLeft} turns)`, 'player');
    } else {
      this.state.log(`⬆️ ${buildingDef.name} upgraded to Level ${building.level}!`, 'player');
    }

    this.resources.recalculateIncome();
    this.resources.recalculateCaps();
    this.resources.recalculatePopulation();

    this.state.emit('building_upgraded', building);
    return true;
  }

  /**
   * Process build queue — called at the start of each turn
   */
  processBuildQueue() {
    for (const building of this.state.buildings) {
      if (!building.constructing) continue;

      building.turnsLeft--;

      if (building.turnsLeft <= 0) {
        building.constructing = false;
        building.hp = building.maxHp;
        const buildingDef = BUILDINGS[building.type];
        this.state.log(`✅ ${buildingDef.name} construction complete!`, 'player');

        this.resources.recalculateIncome();
        this.resources.recalculateCaps();
        this.resources.recalculatePopulation();

        this.state.emit('building_completed', building);
      }
    }
  }

  /**
   * Damage a building
   */
  damageBuilding(buildingId, damage) {
    const building = this.state.getBuilding(buildingId);
    if (!building) return;

    const buildingDef = BUILDINGS[building.type];
    const levelData = buildingDef.levels[building.level - 1];
    const armor = levelData.armor || 0;

    // Apply armor reduction
    const effectiveDamage = Math.max(1, damage * (100 / (100 + armor)));
    building.hp = Math.max(0, building.hp - effectiveDamage);

    if (building.hp <= 0) {
      this.state.log(`💥 ${buildingDef.name} destroyed!`, 'enemy');
      this.state.emit('building_destroyed', building);

      // Remove building
      this.state.buildings = this.state.buildings.filter(b => b.id !== buildingId);

      // Check for town center destruction
      if (building.type === BUILDING_TYPES.TOWN_CENTER) {
        this.state.gameResult = 'defeat';
        this.state.phase = 'game_over';
        this.state.emit('game_over', { result: 'defeat' });
      }

      this.resources.recalculateIncome();
      this.resources.recalculateCaps();
      this.resources.recalculatePopulation();
    }

    return effectiveDamage;
  }

  /**
   * Repair a building (costs resources)
   */
  repairBuilding(buildingId) {
    const building = this.state.getBuilding(buildingId);
    if (!building || building.hp >= building.maxHp) return false;

    const repairCost = {
      gold: Math.ceil((building.maxHp - building.hp) * 0.5),
      wood: Math.ceil((building.maxHp - building.hp) * 0.2),
    };

    if (!this.resources.spend(repairCost)) return false;

    building.hp = building.maxHp;
    this.state.log(`🔧 Repaired ${BUILDINGS[building.type].name}`, 'player');
    this.state.emit('building_repaired', building);
    return true;
  }

  /**
   * Get placeable positions for a building type
   */
  getPlaceablePositions(type) {
    const positions = [];
    for (let r = 0; r < this.state.mapRows; r++) {
      for (let c = 0; c < this.state.mapCols; c++) {
        if (this.canPlace(type, c, r)) {
          positions.push({ col: c, row: r });
        }
      }
    }
    return positions;
  }
}
