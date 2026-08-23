// ─── Resource System ───────────────────────────────────────
// Handles resource generation, spending, and capacity management

import { BUILDINGS, BUILDING_TYPES } from '../data/buildings.js';
import { GAME_CONFIG } from '../data/balancing.js';

export class ResourceSystem {
  constructor(gameState) {
    this.state = gameState;
  }

  /**
   * Calculate total income per turn from all sources
   */
  calculateIncome() {
    const income = { gold: 0, wood: 0, stone: 0, food: 0 };

    // Base income from balancing config is already in state.income
    // But let's recalculate from buildings for accuracy
    const baseIncome = { ...this.state.income };

    // Reset to base values
    Object.assign(income, baseIncome);

    return income;
  }

  /**
   * Recalculate income based on current buildings
   */
  recalculateIncome() {
    const income = { ...GAME_CONFIG.BASE_INCOME };

    for (const building of this.state.buildings) {
      if (building.constructing) continue;

      const buildingData = BUILDINGS[building.type];
      if (!buildingData) continue;

      const levelData = buildingData.levels[building.level - 1];
      if (!levelData || !levelData.resourceBonus) continue;

      for (const [res, amount] of Object.entries(levelData.resourceBonus)) {
        income[res] = (income[res] || 0) + amount;
      }
    }

    this.state.income = income;
    return income;
  }

  /**
   * Recalculate resource caps based on storage buildings
   */
  recalculateCaps() {
    const caps = { ...GAME_CONFIG.BASE_RESOURCE_CAP };

    for (const building of this.state.buildings) {
      if (building.constructing) continue;
      if (building.type !== BUILDING_TYPES.STORAGE) continue;

      const levelData = BUILDINGS[BUILDING_TYPES.STORAGE].levels[building.level - 1];
      if (!levelData || !levelData.capacityBonus) continue;

      for (const [res, amount] of Object.entries(levelData.capacityBonus)) {
        caps[res] = (caps[res] || 0) + amount;
      }
    }

    this.state.resourceCaps = caps;
    return caps;
  }

  /**
   * Recalculate population cap
   */
  recalculatePopulation() {
    let maxPop = GAME_CONFIG.BASE_POPULATION;

    for (const building of this.state.buildings) {
      if (building.constructing) continue;
      const buildingData = BUILDINGS[building.type];
      if (!buildingData) continue;
      const levelData = buildingData.levels[building.level - 1];
      if (levelData && levelData.populationBonus) {
        maxPop += levelData.populationBonus;
      }
    }

    this.state.maxPopulation = Math.min(maxPop, GAME_CONFIG.MAX_POPULATION);
  }

  /**
   * Collect income at start of player turn
   */
  collectIncome() {
    this.recalculateIncome();
    this.recalculateCaps();
    this.recalculatePopulation();

    const income = this.state.income;
    const collected = {};

    for (const [res, amount] of Object.entries(income)) {
      const before = this.state.resources[res] || 0;
      this.state.resources[res] = Math.min(before + amount, this.state.resourceCaps[res] || Infinity);
      collected[res] = this.state.resources[res] - before;
    }

    return collected;
  }

  /**
   * Check if player can afford a cost
   */
  canAfford(costs) {
    return this.state.canAfford(costs);
  }

  /**
   * Spend resources
   */
  spend(costs) {
    if (!this.canAfford(costs)) return false;
    this.state.spendResources(costs);
    return true;
  }
}
