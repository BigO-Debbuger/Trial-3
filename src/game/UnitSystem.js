// ─── Unit System ───────────────────────────────────────
// Handles player unit recruitment and management

import { PLAYER_UNITS, PLAYER_UNIT_TYPES } from '../data/units.js';
import { BUILDING_TYPES } from '../data/buildings.js';

export class UnitSystem {
  constructor(gameState, resourceSystem) {
    this.state = gameState;
    this.resources = resourceSystem;
  }

  /**
   * Check if a unit can be recruited
   */
  canRecruit(unitType) {
    const unitDef = PLAYER_UNITS[unitType];
    if (!unitDef) return false;

    // Check cost
    if (!this.resources.canAfford(unitDef.cost)) return false;

    // Check population
    if (this.state.population + unitDef.populationCost > this.state.maxPopulation) return false;

    // Check barracks
    const barracks = this.state.buildings.filter(
      b => b.type === BUILDING_TYPES.BARRACKS && !b.constructing
    );
    if (barracks.length === 0) return false;

    return true;
  }

  /**
   * Recruit a unit
   */
  recruitUnit(unitType) {
    if (!this.canRecruit(unitType)) return null;

    const unitDef = PLAYER_UNITS[unitType];
    if (!this.resources.spend(unitDef.cost)) return null;

    // Place near a barracks
    const barracks = this.state.buildings.find(
      b => b.type === BUILDING_TYPES.BARRACKS && !b.constructing
    );

    const unit = {
      id: this.state.nextUnitId++,
      type: unitType,
      hp: unitDef.hp,
      maxHp: unitDef.hp,
      damage: unitDef.damage,
      armor: unitDef.armor,
      range: unitDef.range,
      col: barracks ? barracks.col + 1 : 10,
      row: barracks ? barracks.row : 8,
    };

    this.state.playerUnits.push(unit);
    this.state.population += unitDef.populationCost;
    this.state.stats.unitsRecruited++;
    this.state.log(`🗡️ Recruited ${unitDef.name}`, 'player');
    this.state.emit('unit_recruited', unit);

    return unit;
  }

  /**
   * Remove a dead unit
   */
  removeUnit(unitId) {
    const idx = this.state.playerUnits.findIndex(u => u.id === unitId);
    if (idx === -1) return;

    const unit = this.state.playerUnits[idx];
    const unitDef = PLAYER_UNITS[unit.type];
    this.state.population -= unitDef.populationCost;
    this.state.playerUnits.splice(idx, 1);
  }

  /**
   * Deal damage to a player unit
   */
  damageUnit(unitId, damage) {
    const unit = this.state.playerUnits.find(u => u.id === unitId);
    if (!unit) return 0;

    const unitDef = PLAYER_UNITS[unit.type];
    const armor = unitDef.armor || 0;
    const effectiveDamage = Math.max(1, damage * (100 / (100 + armor)));
    unit.hp = Math.max(0, unit.hp - effectiveDamage);

    if (unit.hp <= 0) {
      this.state.log(`💀 ${unitDef.name} has fallen!`, 'enemy');
      this.removeUnit(unitId);
    }

    return effectiveDamage;
  }

  /**
   * Get all alive player units
   */
  getAliveUnits() {
    return this.state.playerUnits.filter(u => u.hp > 0);
  }

  /**
   * Heal all units slightly between turns
   */
  healUnits() {
    for (const unit of this.state.playerUnits) {
      const unitDef = PLAYER_UNITS[unit.type];
      if (unit.hp < unitDef.hp) {
        const healAmount = Math.ceil(unitDef.hp * 0.1); // 10% heal per turn
        unit.hp = Math.min(unitDef.hp, unit.hp + healAmount);
      }
    }
  }
}
