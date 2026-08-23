// ─── Combat System ───────────────────────────────────────
// Handles combat resolution between enemy attacks and player defenses

import { BUILDINGS, BUILDING_TYPES } from '../data/buildings.js';
import { PLAYER_UNITS, PLAYER_UNIT_TYPES, ENEMY_UNITS, ENEMY_UNIT_TYPES } from '../data/units.js';
import { COMBAT, AI_CONFIG } from '../data/balancing.js';

export class CombatSystem {
  constructor(gameState, buildingSystem, unitSystem) {
    this.state = gameState;
    this.buildings = buildingSystem;
    this.units = unitSystem;
    this.combatLog = [];
    this.animations = []; // Queue for the animation system
  }

  /**
   * Resolve a complete combat round
   * @param {Object} strategy - The AI's chosen strategy
   * @returns {Object} Combat results summary
   */
  resolveCombat(strategy) {
    this.combatLog = [];
    this.animations = [];

    const results = {
      damageToPlayer: 0,
      damageToEnemy: 0,
      buildingsDestroyed: 0,
      enemiesKilled: 0,
      playerUnitsLost: 0,
      wallBreached: false,
      targetDirection: strategy.target || 'north',
    };

    // 1. Generate enemy attack force based on strategy
    const attackForce = this._generateAttackForce(strategy);

    // 2. Tower auto-fire phase
    results.damageToEnemy += this._towerFirePhase(attackForce);

    // 3. Player unit defense phase
    results.damageToEnemy += this._playerUnitDefensePhase(attackForce);

    // 4. Enemy attack phase — remaining enemies attack buildings/walls
    const attackResults = this._enemyAttackPhase(attackForce, strategy);
    results.damageToPlayer += attackResults.damage;
    results.buildingsDestroyed = attackResults.buildingsDestroyed;
    results.wallBreached = attackResults.wallBreached;

    // 5. Count losses
    results.enemiesKilled = attackForce.filter(u => u.hp <= 0).length;
    results.playerUnitsLost = this.combatLog.filter(e => e.type === 'unit_killed').length;

    // Update stats
    this.state.stats.damageDealt += results.damageToEnemy;
    this.state.stats.damageTaken += results.damageToPlayer;
    this.state.stats.enemiesKilled += results.enemiesKilled;

    // Remove killed enemy units from army
    this._removeDeadEnemies(attackForce);

    // Log summary
    this.state.log(`⚔️ Combat resolved: ${results.enemiesKilled} enemies killed, ${results.damageToPlayer.toFixed(0)} damage taken`, 'neutral');

    if (results.wallBreached) {
      this.state.log(`🔥 WALL BREACHED on the ${results.targetDirection} side!`, 'enemy');
    }

    return results;
  }

  /**
   * Generate attack force from strategy's unit composition
   */
  _generateAttackForce(strategy) {
    const force = [];
    const army = this.state.enemyArmy;
    const unitMix = strategy.unitMix || { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 };

    for (const [unitType, percentage] of Object.entries(unitMix)) {
      const available = army[unitType] || 0;
      // Send percentage of available units (minimum 1 if available)
      const count = Math.max(available > 0 ? 1 : 0, Math.floor(available * percentage));
      const unitDef = ENEMY_UNITS[unitType];

      if (!unitDef) continue;

      for (let i = 0; i < count; i++) {
        force.push({
          type: unitType,
          hp: unitDef.hp,
          maxHp: unitDef.hp,
          damage: unitDef.damage,
          armor: unitDef.armor,
          range: unitDef.range,
        });
      }
    }

    return force;
  }

  /**
   * Tower auto-fire phase — towers fire at enemies based on priority
   */
  _towerFirePhase(attackForce) {
    let totalDamage = 0;
    const towers = this.state.getTowers().filter(t => !t.constructing && t.hp > 0);

    for (const tower of towers) {
      const towerDef = BUILDINGS[tower.type];
      const levelData = towerDef.levels[tower.level - 1];
      const baseDamage = levelData.damage || 0;
      const levelMult = COMBAT.LEVEL_MULTIPLIER[tower.level - 1] || 1;

      // Find target by priority
      let target = null;
      for (const priority of COMBAT.TOWER_FIRE_PRIORITY) {
        target = attackForce.find(u => u.type === priority && u.hp > 0);
        if (target) break;
      }

      if (!target) target = attackForce.find(u => u.hp > 0);
      if (!target) continue;

      const variance = COMBAT.RANDOM_VARIANCE_MIN +
        Math.random() * (COMBAT.RANDOM_VARIANCE_MAX - COMBAT.RANDOM_VARIANCE_MIN);
      const damage = baseDamage * levelMult * variance;
      const effectiveDamage = Math.max(1, damage * (100 / (100 + target.armor)));

      target.hp -= effectiveDamage;
      totalDamage += effectiveDamage;

      // Splash damage for cannon towers
      if (tower.type === BUILDING_TYPES.CANNON_TOWER && levelData.splash) {
        const splashTargets = attackForce.filter(u => u !== target && u.hp > 0).slice(0, 2);
        for (const st of splashTargets) {
          const splashDmg = effectiveDamage * 0.4;
          st.hp -= splashDmg;
          totalDamage += splashDmg;
        }
      }

      this.combatLog.push({
        type: 'tower_fire',
        tower: tower.type,
        target: target.type,
        damage: effectiveDamage,
      });

      // Add animation
      this.animations.push({
        type: tower.type === BUILDING_TYPES.CANNON_TOWER ? 'cannonball' : 'arrow',
        from: { col: tower.col, row: tower.row },
        to: { col: 10, row: 2 }, // Enemy approach area
        damage: effectiveDamage,
      });

      if (target.hp <= 0) {
        this.state.log(`🏹 ${towerDef.name} destroyed ${ENEMY_UNITS[target.type].name}!`, 'player');
      }
    }

    return totalDamage;
  }

  /**
   * Player units defend against attacking enemies
   */
  _playerUnitDefensePhase(attackForce) {
    let totalDamage = 0;
    const aliveUnits = this.units.getAliveUnits();

    for (const unit of aliveUnits) {
      const unitDef = PLAYER_UNITS[unit.type];
      if (!unitDef) continue;

      // Find alive enemy to attack
      const target = attackForce.find(u => u.hp > 0);
      if (!target) break;

      const modifier = unitDef.modifiers?.[target.type] || 1.0;
      const variance = COMBAT.RANDOM_VARIANCE_MIN +
        Math.random() * (COMBAT.RANDOM_VARIANCE_MAX - COMBAT.RANDOM_VARIANCE_MIN);
      const damage = unitDef.damage * modifier * variance;
      const effectiveDamage = Math.max(1, damage * (100 / (100 + target.armor)));

      target.hp -= effectiveDamage;
      totalDamage += effectiveDamage;

      // Enemy counter-attacks the player unit
      const enemyDef = ENEMY_UNITS[target.type];
      if (enemyDef && target.hp > 0) {
        const counterVariance = COMBAT.RANDOM_VARIANCE_MIN +
          Math.random() * (COMBAT.RANDOM_VARIANCE_MAX - COMBAT.RANDOM_VARIANCE_MIN);
        const counterDmg = enemyDef.damage * counterVariance;
        this.units.damageUnit(unit.id, counterDmg);
      }

      if (target.hp <= 0) {
        this.state.log(`⚔️ ${unitDef.name} killed ${enemyDef.name}!`, 'player');
      }
    }

    return totalDamage;
  }

  /**
   * Enemy attacks buildings and walls
   */
  _enemyAttackPhase(attackForce, strategy) {
    let totalDamage = 0;
    let buildingsDestroyed = 0;
    let wallBreached = false;

    const aliveEnemies = attackForce.filter(u => u.hp > 0);

    // Determine target priorities from strategy
    const targetPriority = strategy.targetPriority || ['wall', 'archer_tower', 'town_center'];
    const targetDirection = strategy.target || 'north';

    for (const enemy of aliveEnemies) {
      const enemyDef = ENEMY_UNITS[enemy.type];
      if (!enemyDef) continue;

      // Find target building
      let targetBuilding = null;

      for (const targetType of targetPriority) {
        // Check for directional walls
        if (targetType.startsWith('wall_')) {
          const dir = targetType.split('_')[1];
          targetBuilding = this.state.buildings.find(
            b => b.type === BUILDING_TYPES.WALL && b.direction === dir && b.hp > 0 && !b.constructing
          );
        } else if (targetType === 'wall') {
          targetBuilding = this.state.buildings.find(
            b => b.type === BUILDING_TYPES.WALL && b.direction === targetDirection && b.hp > 0 && !b.constructing
          );
          if (!targetBuilding) {
            // Try any wall
            targetBuilding = this.state.buildings.find(
              b => b.type === BUILDING_TYPES.WALL && b.hp > 0 && !b.constructing
            );
          }
        } else {
          targetBuilding = this.state.buildings.find(
            b => b.type === targetType && b.hp > 0 && !b.constructing
          );
        }

        if (targetBuilding) break;
      }

      // Fallback to Town Center
      if (!targetBuilding) {
        targetBuilding = this.state.buildings.find(
          b => b.type === BUILDING_TYPES.TOWN_CENTER && b.hp > 0
        );
      }

      if (!targetBuilding) continue;

      // Calculate damage
      const buildingModifier = enemyDef.buildingModifiers?.[targetBuilding.type] || enemyDef.buildingModifiers?.default || 1.0;
      const variance = COMBAT.RANDOM_VARIANCE_MIN +
        Math.random() * (COMBAT.RANDOM_VARIANCE_MAX - COMBAT.RANDOM_VARIANCE_MIN);
      const damage = enemyDef.damage * buildingModifier * variance;

      const effectiveDamage = this.buildings.damageBuilding(targetBuilding.id, damage);
      totalDamage += effectiveDamage || 0;

      this.combatLog.push({
        type: 'enemy_attack',
        enemy: enemy.type,
        target: targetBuilding.type,
        targetId: targetBuilding.id,
        damage: effectiveDamage,
      });

      // Check if building was destroyed
      if (!this.state.getBuilding(targetBuilding.id)) {
        buildingsDestroyed++;
        if (targetBuilding.type === BUILDING_TYPES.WALL) {
          wallBreached = true;
        }
      }
    }

    return { damage: totalDamage, buildingsDestroyed, wallBreached };
  }

  /**
   * Remove dead enemies from the army
   */
  _removeDeadEnemies(attackForce) {
    const killed = {};
    for (const enemy of attackForce) {
      if (enemy.hp <= 0) {
        killed[enemy.type] = (killed[enemy.type] || 0) + 1;
      }
    }

    for (const [type, count] of Object.entries(killed)) {
      this.state.enemyArmy[type] = Math.max(0, (this.state.enemyArmy[type] || 0) - count);
    }
  }

  /**
   * Reinforce enemy army each turn (with strategic consequence scaling)
   */
  reinforceEnemy() {
    const turn = this.state.turn;
    let scaling = 1 + (turn * 0.1); // 10% stronger each turn

    // Apply strategic penalties from player offensive conquests
    const reinfPenalty = this.state.enemyBase?.modifiers?.reinforcementPenalty || 0;
    const incomePenalty = this.state.enemyBase?.modifiers?.incomePenalty || 0;
    scaling *= Math.max(0.25, 1.0 - (reinfPenalty * 0.6 + incomePenalty * 0.4));

    for (const [type, rate] of Object.entries(AI_CONFIG.REINFORCEMENT_RATE)) {
      const reinforcements = Math.floor(rate * scaling);
      if (reinforcements > 0 || (rate > 0 && turn % Math.ceil(1 / Math.max(0.1, rate)) === 0)) {
        const actual = Math.max(reinforcements, rate >= 1 ? 1 : 0);
        this.state.enemyArmy[type] = (this.state.enemyArmy[type] || 0) + actual;
      }
    }

    // Calculate total enemy strength for display
    let strength = 0;
    for (const [type, count] of Object.entries(this.state.enemyArmy)) {
      const unitDef = ENEMY_UNITS[type];
      if (unitDef) {
        strength += count * (unitDef.hp + unitDef.damage * 3);
      }
    }
    this.state.enemyTotalStrength = strength;
  }

  /**
   * Resolve a player offensive assault on an enemy base target
   * @param {Object} attackSummary - Deployed player forces and route setup
   * @param {Object} aiDefense - AI defensive response and defender deployment
   * @returns {Object} Comprehensive battle report
   */
  resolvePlayerAttack(attackSummary, aiDefense) {
    const target = this.state.getEnemyTarget(attackSummary.target.id) || attackSummary.target;
    const targetId = target.id;

    // 1. Calculate raw player offensive power across routes
    let totalAssaultDamage = 0;
    const playerLossesByType = {
      [PLAYER_UNIT_TYPES.WARRIOR]: 0,
      [PLAYER_UNIT_TYPES.ARCHER]: 0,
      [PLAYER_UNIT_TYPES.DEFENDER]: 0,
      [PLAYER_UNIT_TYPES.SIEGE]: 0,
    };

    // Route calculations
    for (const [routeName, units] of Object.entries(this.state.offensiveState.routes || {})) {
      for (const [unitType, count] of Object.entries(units || {})) {
        if (count <= 0) continue;
        const def = PLAYER_UNITS[unitType];
        if (!def) continue;

        let dmgPerUnit = def.damage;

        // Siege multiplier vs structures
        if (unitType === PLAYER_UNIT_TYPES.SIEGE) {
          dmgPerUnit *= (def.structureDamageBonus || 2.2);
        }

        // Route bonus
        if (routeName === 'north' && unitType === PLAYER_UNIT_TYPES.ARCHER) dmgPerUnit *= 1.25;
        if (routeName === 'center' && unitType === PLAYER_UNIT_TYPES.SIEGE) dmgPerUnit *= 1.35;
        if (routeName === 'south' && unitType === PLAYER_UNIT_TYPES.WARRIOR) dmgPerUnit *= 1.25;

        // Outer gate breach vulnerability bonus
        if (this.state.enemyBase?.modifiers?.vulnerabilityBonus > 0 && targetId === 'command_center') {
          dmgPerUnit *= (1 + this.state.enemyBase.modifiers.vulnerabilityBonus);
        }

        const variance = COMBAT.RANDOM_VARIANCE_MIN +
          Math.random() * (COMBAT.RANDOM_VARIANCE_MAX - COMBAT.RANDOM_VARIANCE_MIN);
        totalAssaultDamage += count * dmgPerUnit * variance;
      }
    }

    // 2. AI Defensive Multipliers & Defender Absorption
    const defenseMultiplier = aiDefense.structureDefenseMultiplier || 1.0;
    const baseArmor = target.baseArmor || 10;
    const effectiveArmor = Math.max(2, baseArmor * defenseMultiplier);

    // Watchtower crossfire penalty if watchtower is still active
    const watchtowerActive = this.state.getEnemyTarget('watchtower')?.status !== 'destroyed';
    if (watchtowerActive && targetId !== 'watchtower') {
      totalAssaultDamage *= 0.88; // 12% damage reduction from suppression fire
    }

    // Effective structural damage
    const netStructureDamage = Math.max(15, totalAssaultDamage * (100 / (100 + effectiveArmor)));

    // 3. AI Defender Counter-Attack & Player Casualties
    let enemyCounterDamage = 0;
    const enemyLossesByType = {
      enemy_melee: 0,
      enemy_ranged: 0,
      enemy_siege: 0,
    };

    const defenders = aiDefense.defenders || { enemy_melee: 3, enemy_ranged: 2, enemy_siege: 0 };
    for (const [defType, count] of Object.entries(defenders)) {
      const defData = ENEMY_UNITS[defType];
      if (!defData || count <= 0) continue;

      const counterMultiplier = aiDefense.counterDamageMultiplier || 1.0;
      const dmg = count * defData.damage * counterMultiplier * (0.85 + Math.random() * 0.3);
      enemyCounterDamage += dmg;

      // Calculate defender casualties based on player assault ferocity
      const defenderKilled = Math.min(count, Math.floor(count * (netStructureDamage / (target.maxHp * 0.7))));
      enemyLossesByType[defType] = defenderKilled;
    }

    // 4. Distribute casualties to player attacking units
    let remainingCounterDmg = enemyCounterDamage;
    const deployed = attackSummary.deployedCounts;

    // Defenders absorb first, then Warriors, then Archers, then Siege
    const casualtyOrder = [
      PLAYER_UNIT_TYPES.DEFENDER,
      PLAYER_UNIT_TYPES.WARRIOR,
      PLAYER_UNIT_TYPES.ARCHER,
      PLAYER_UNIT_TYPES.SIEGE,
    ];

    for (const unitType of casualtyOrder) {
      const count = deployed[unitType] || 0;
      if (count <= 0 || remainingCounterDmg <= 0) continue;
      const uDef = PLAYER_UNITS[unitType];
      const hpPerUnit = uDef.hp + uDef.armor * 2;
      const unitsLost = Math.min(count, Math.floor(remainingCounterDmg / hpPerUnit));
      playerLossesByType[unitType] = unitsLost;
      remainingCounterDmg -= unitsLost * hpPerUnit;
    }

    // 5. Apply Damage to Enemy Target
    const damageResult = this.state.damageEnemyTarget(targetId, netStructureDamage);

    // 6. Update Game Stats
    const playerTotalLosses = Object.values(playerLossesByType).reduce((a, b) => a + b, 0);
    const enemyTotalLosses = Object.values(enemyLossesByType).reduce((a, b) => a + b, 0);

    this.state.stats.damageDealt += Math.round(netStructureDamage);
    this.state.stats.enemiesKilled += enemyTotalLosses;

    // Log the offensive outcome
    this.state.log(
      `⚔️ [BATTLE REPORT] Dealt ${Math.round(netStructureDamage)} damage to ${target.name}. Losses: Player -${playerTotalLosses}, Enemy -${enemyTotalLosses}.`,
      damageResult.destroyed ? 'player' : 'neutral'
    );

    return {
      targetId: target.id,
      targetName: target.name,
      targetSubtitle: target.subtitle,
      targetIcon: target.icon,
      playerForceDeployed: { ...deployed },
      aiDefense: {
        strategy: aiDefense.strategy,
        strategyName: aiDefense.strategyName,
        icon: aiDefense.icon,
        reason: aiDefense.reason,
        source: aiDefense.source || 'llm',
      },
      targetDamageTaken: Math.round(netStructureDamage),
      targetRemainingHp: Math.round(damageResult.target?.hp || 0),
      targetMaxHp: target.maxHp,
      targetDestroyed: damageResult.destroyed,
      playerLossesByType,
      playerTotalLosses,
      enemyLossesByType,
      enemyTotalLosses,
      consequence: damageResult.destroyed ? target.consequence : (target.hp < target.maxHp * 0.5 ? 'Severe structural damage sustained.' : 'Defensive perimeter holding.'),
      aiAdaptation: `Enemy AI analyzed assault pattern; updated defensive priority for future incursions.`,
    };
  }
}
