// ─── Offensive System ──────────────────────────────────────────
// Fullscreen real-time enemy battlefield assault controller:
// interactive troop tray, physical battlefield deployment, autonomous unit roles,
// watchtower defense, live AI defensive reactions, and battle resolution.

import { PLAYER_UNITS, PLAYER_UNIT_TYPES, ENEMY_UNITS } from '../data/units.js';
import { ENEMY_TARGETS, ENEMY_TARGET_TYPES, DEFENSIVE_STRATEGIES } from '../data/enemyBase.js';
import { GAME_CONFIG } from '../data/balancing.js';

export class OffensiveSystem {
  constructor(gameState, combatSystem, defensiveAI) {
    this.state = gameState;
    this.combat = combatSystem;
    this.defensiveAI = defensiveAI;
    this._nextAssaultUnitId = 1;

    this.activeAssault = {
      isActive: false,
      elapsedTime: 0,
      availableTroops: {
        [PLAYER_UNIT_TYPES.WARRIOR]: 0,
        [PLAYER_UNIT_TYPES.ARCHER]: 0,
        [PLAYER_UNIT_TYPES.DEFENDER]: 0,
        [PLAYER_UNIT_TYPES.SIEGE]: 0,
      },
      selectedTroopType: PLAYER_UNIT_TYPES.WARRIOR,
      deployedUnits: [],
      enemyDefenders: [],
      projectiles: [],
      totalDeployed: 0,
      casualties: { player: 0, enemy: 0 },
      playerLossesByType: {
        [PLAYER_UNIT_TYPES.WARRIOR]: 0,
        [PLAYER_UNIT_TYPES.ARCHER]: 0,
        [PLAYER_UNIT_TYPES.DEFENDER]: 0,
        [PLAYER_UNIT_TYPES.SIEGE]: 0,
      },
      enemyLossesByType: {
        enemy_melee: 0,
        enemy_ranged: 0,
        enemy_siege: 0,
      },
      damageDealtToTargets: {},
      aiDefenseTriggered: false,
      aiDefenseDecision: null,
      towerCooldowns: {},
    };
  }

  /**
   * Start dedicated Fullscreen Enemy Assault mode
   */
  startAssault() {
    this.state.offensiveState.isAttackMode = true;
    this.state.phase = 'attack_mode';

    const available = this.state.getAvailableUnitCounts();

    this.activeAssault = {
      isActive: true,
      elapsedTime: 0,
      availableTroops: {
        [PLAYER_UNIT_TYPES.WARRIOR]: available[PLAYER_UNIT_TYPES.WARRIOR] || 0,
        [PLAYER_UNIT_TYPES.ARCHER]: available[PLAYER_UNIT_TYPES.ARCHER] || 0,
        [PLAYER_UNIT_TYPES.DEFENDER]: available[PLAYER_UNIT_TYPES.DEFENDER] || 0,
        [PLAYER_UNIT_TYPES.SIEGE]: available[PLAYER_UNIT_TYPES.SIEGE] || 0,
      },
      selectedTroopType: PLAYER_UNIT_TYPES.WARRIOR,
      deployedUnits: [],
      enemyDefenders: [],
      projectiles: [],
      totalDeployed: 0,
      casualties: { player: 0, enemy: 0 },
      playerLossesByType: {
        [PLAYER_UNIT_TYPES.WARRIOR]: 0,
        [PLAYER_UNIT_TYPES.ARCHER]: 0,
        [PLAYER_UNIT_TYPES.DEFENDER]: 0,
        [PLAYER_UNIT_TYPES.SIEGE]: 0,
      },
      enemyLossesByType: {
        enemy_melee: 0,
        enemy_ranged: 0,
        enemy_siege: 0,
      },
      damageDealtToTargets: {},
      aiDefenseTriggered: false,
      aiDefenseDecision: null,
      towerCooldowns: { watchtower: 0, gate: 0 },
    };

    this.state.log(`⚔️ [INVASION] Entered Enemy Territory. Select troops from tray and deploy onto the battlefield!`, 'player');
    this.state.emit('attack_mode_started', this.activeAssault);
    this.state.emit('phase_change', 'attack_mode');
  }

  /**
   * Select active troop type from the bottom deployment tray
   */
  selectTroopType(type) {
    if (this.activeAssault.isActive && this.activeAssault.availableTroops[type] !== undefined) {
      this.activeAssault.selectedTroopType = type;
      this.state.offensiveState.selectedDeployUnit = type;
      this.state.emit('deploy_unit_selected', type);
    }
  }

  /**
   * Deploy a single troop at specific world coordinates
   */
  deployTroop(x, y, col, row) {
    if (!this.activeAssault.isActive) return false;

    // Validate deployment zone: Row >= 8 on enemy battlefield
    if (row < 8) {
      this.state.emit('invalid_deploy_click', { col, row });
      return false;
    }

    const type = this.activeAssault.selectedTroopType;
    if ((this.activeAssault.availableTroops[type] || 0) <= 0) {
      return false;
    }

    // Deduct troop from tray
    this.activeAssault.availableTroops[type]--;
    this.activeAssault.totalDeployed++;

    const def = PLAYER_UNITS[type];
    const unit = {
      id: this._nextAssaultUnitId++,
      type,
      x,
      y,
      col,
      row,
      hp: def.hp,
      maxHp: def.hp,
      damage: def.damage,
      armor: def.armor,
      range: def.range === 1 ? 0.8 : (def.range || 4.5),
      speed: type === PLAYER_UNIT_TYPES.WARRIOR ? 44 : type === PLAYER_UNIT_TYPES.ARCHER ? 38 : type === PLAYER_UNIT_TYPES.DEFENDER ? 32 : 24,
      attackCooldown: 1.0 / (def.attackSpeed || 1.0),
      currentCooldown: 0.2,
      role: type,
      target: null,
      targetType: null, // 'building' | 'unit'
      isDead: false,
      color: def.color,
      icon: def.icon,
    };

    this.activeAssault.deployedUnits.push(unit);

    // If first unit deployed, trigger AI Defense reaction
    if (!this.activeAssault.aiDefenseTriggered) {
      this._triggerAIDefense();
    }

    this.state.emit('troop_deployed', {
      unit,
      remainingCount: this.activeAssault.availableTroops[type],
      totalDeployed: this.activeAssault.totalDeployed,
    });

    return true;
  }

  /**
   * AI Defense Reaction when assault begins
   */
  async _triggerAIDefense() {
    this.activeAssault.aiDefenseTriggered = true;
    const target = this.state.getEnemyTarget(this.state.offensiveState.selectedTargetId) || this.state.getEnemyTargets()[0];

    const attackContext = {
      target: {
        id: target.id,
        name: target.name,
        hp: target.hp,
        maxHp: target.maxHp,
        baseArmor: target.baseArmor,
        value: target.value,
        lane: target.lane,
      },
      attackForce: { ...this.activeAssault.availableTroops },
      totalArmyPower: 1200,
      enemyGarrison: { ...this.state.enemyBase.garrison },
      enemyArmy: { ...this.state.enemyArmy },
      turn: this.state.turn,
    };

    const decision = await this.defensiveAI.executeDefense(attackContext);
    this.activeAssault.aiDefenseDecision = decision;
    this.state.offensiveState.lastAIDefense = decision;

    // Spawn enemy defenders from the Barracks / Stronghold to counter-attack!
    this._spawnDefenders(decision);
  }

  _spawnDefenders(decision) {
    const defenders = decision.defenders || { enemy_melee: 4, enemy_ranged: 2, enemy_siege: 0 };
    const spawnPoints = [
      { col: 7, row: 3 },  // Barracks
      { col: 10, row: 2 }, // Stronghold
      { col: 13, row: 3 }, // Watchtower
    ];

    let spawnIdx = 0;
    for (const [defType, count] of Object.entries(defenders)) {
      const defData = ENEMY_UNITS[defType];
      if (!defData) continue;

      for (let i = 0; i < count; i++) {
        const sp = spawnPoints[spawnIdx % spawnPoints.length];
        const cellSize = GAME_CONFIG.CELL_SIZE;
        const x = (sp.col + (Math.random() - 0.5) * 0.8) * cellSize;
        const y = (sp.row + (Math.random() - 0.5) * 0.8) * cellSize;

        this.activeAssault.enemyDefenders.push({
          id: this._nextAssaultUnitId++,
          type: defType,
          x,
          y,
          col: sp.col,
          row: sp.row,
          hp: defData.hp,
          maxHp: defData.hp,
          damage: defData.damage * (decision.counterDamageMultiplier || 1.0),
          armor: defData.armor,
          range: defData.range === 1 ? 0.8 : (defData.range || 4.5),
          speed: defType === 'enemy_melee' ? 40 : 34,
          attackCooldown: 1.0 / (defData.attackSpeed || 1.0),
          currentCooldown: 0.5,
          target: null,
          isDead: false,
          isEnemy: true,
          color: defData.color,
          icon: defData.icon,
        });

        spawnIdx++;
      }
    }
  }

  /**
   * Main real-time simulation tick for the active assault
   */
  updateAssault(dt) {
    if (!this.activeAssault.isActive) return;

    this.activeAssault.elapsedTime += dt;
    const cellSize = GAME_CONFIG.CELL_SIZE;

    // 1. Update Player Attacking Units
    for (const unit of this.activeAssault.deployedUnits) {
      if (unit.isDead) continue;

      // Find best target if none or target dead
      if (!unit.target || (unit.targetType === 'unit' && unit.target.isDead) || (unit.targetType === 'building' && unit.target.status === 'destroyed')) {
        this._acquireTargetForUnit(unit);
      }

      if (!unit.target) continue;

      // Calculate distance to target in pixels
      const targetPos = this._getTargetPosition(unit.target, unit.targetType);
      const dx = targetPos.x - unit.x;
      const dy = targetPos.y - unit.y;
      const dist = Math.hypot(dx, dy);
      const attackRangePx = unit.range * cellSize;

      if (dist > attackRangePx) {
        // Move towards target
        const vx = (dx / dist) * unit.speed * dt;
        const vy = (dy / dist) * unit.speed * dt;
        unit.x += vx;
        unit.y += vy;
      } else {
        // In range: tick attack cooldown & attack
        unit.currentCooldown -= dt;
        if (unit.currentCooldown <= 0) {
          unit.currentCooldown = unit.attackCooldown;
          this._executeUnitAttack(unit, unit.target, unit.targetType);
        }
      }
    }

    // 2. Update Enemy Defenders
    for (const defender of this.activeAssault.enemyDefenders) {
      if (defender.isDead) continue;

      if (!defender.target || defender.target.isDead) {
        // Target nearest alive player invader
        let nearest = null;
        let minDist = Infinity;
        for (const u of this.activeAssault.deployedUnits) {
          if (u.isDead) continue;
          const d = Math.hypot(u.x - defender.x, u.y - defender.y);
          if (d < minDist) {
            minDist = d;
            nearest = u;
          }
        }
        defender.target = nearest;
      }

      if (!defender.target) continue;

      const dx = defender.target.x - defender.x;
      const dy = defender.target.y - defender.y;
      const dist = Math.hypot(dx, dy);
      const attackRangePx = defender.range * cellSize;

      if (dist > attackRangePx) {
        const vx = (dx / dist) * defender.speed * dt;
        const vy = (dy / dist) * defender.speed * dt;
        defender.x += vx;
        defender.y += vy;
      } else {
        defender.currentCooldown -= dt;
        if (defender.currentCooldown <= 0) {
          defender.currentCooldown = defender.attackCooldown;
          this._executeDefenderAttack(defender, defender.target);
        }
      }
    }

    // 3. Update Enemy Watchtower Auto-Fire
    this._updateWatchtowers(dt);

    // 4. Update In-flight Projectiles
    this._updateProjectiles(dt);

    // Clean up dead units
    this.activeAssault.deployedUnits = this.activeAssault.deployedUnits.filter(u => !u.isDead);
    this.activeAssault.enemyDefenders = this.activeAssault.enemyDefenders.filter(u => !u.isDead);
  }

  _acquireTargetForUnit(unit) {
    const cellSize = GAME_CONFIG.CELL_SIZE;
    const aliveTargets = this.state.getEnemyTargets().filter(t => t.status !== 'destroyed');
    const aliveDefenders = this.activeAssault.enemyDefenders.filter(d => !d.isDead);

    // Siege Rams strictly prioritize defensive structures & Stronghold
    if (unit.role === PLAYER_UNIT_TYPES.SIEGE) {
      if (aliveTargets.length > 0) {
        // Find nearest building
        let nearestBuilding = aliveTargets[0];
        let minDist = Infinity;
        for (const b of aliveTargets) {
          const bx = b.col * cellSize + cellSize / 2;
          const by = b.row * cellSize + cellSize / 2;
          const d = Math.hypot(bx - unit.x, by - unit.y);
          if (d < minDist) {
            minDist = d;
            nearestBuilding = b;
          }
        }
        unit.target = nearestBuilding;
        unit.targetType = 'building';
        return;
      }
    }

    // Archers & Warriors attack nearby defenders if close, otherwise buildings
    if (aliveDefenders.length > 0) {
      let nearestDef = null;
      let minDist = Infinity;
      for (const d of aliveDefenders) {
        const dist = Math.hypot(d.x - unit.x, d.y - unit.y);
        if (dist < minDist && dist < 5 * cellSize) {
          minDist = dist;
          nearestDef = d;
        }
      }
      if (nearestDef) {
        unit.target = nearestDef;
        unit.targetType = 'unit';
        return;
      }
    }

    // Default to nearest building
    if (aliveTargets.length > 0) {
      let nearestBuilding = aliveTargets[0];
      let minDist = Infinity;
      for (const b of aliveTargets) {
        const bx = b.col * cellSize + cellSize / 2;
        const by = b.row * cellSize + cellSize / 2;
        const d = Math.hypot(bx - unit.x, by - unit.y);
        if (d < minDist) {
          minDist = d;
          nearestBuilding = b;
        }
      }
      unit.target = nearestBuilding;
      unit.targetType = 'building';
    }
  }

  _getTargetPosition(target, targetType) {
    const cellSize = GAME_CONFIG.CELL_SIZE;
    if (targetType === 'building') {
      return {
        x: target.col * cellSize + cellSize / 2,
        y: target.row * cellSize + cellSize / 2,
      };
    }
    return { x: target.x, y: target.y };
  }

  _executeUnitAttack(unit, target, targetType) {
    const isSiege = unit.role === PLAYER_UNIT_TYPES.SIEGE;
    const isArcher = unit.role === PLAYER_UNIT_TYPES.ARCHER;

    if (isArcher || isSiege) {
      // Spawn flying projectile
      const targetPos = this._getTargetPosition(target, targetType);
      this.activeAssault.projectiles.push({
        fromX: unit.x,
        fromY: unit.y,
        toX: targetPos.x,
        toY: targetPos.y,
        type: isSiege ? 'boulder' : 'arrow',
        progress: 0,
        speed: isSiege ? 1.8 : 3.0,
        damage: isSiege ? unit.damage * (PLAYER_UNITS.siege?.structureDamageBonus || 2.2) : unit.damage,
        target,
        targetType,
      });
    } else {
      // Melee attack directly
      this._applyDamage(target, targetType, unit.damage, unit);
    }
  }

  _executeDefenderAttack(defender, targetUnit) {
    const isRanged = defender.type === 'enemy_ranged';
    if (isRanged) {
      this.activeAssault.projectiles.push({
        fromX: defender.x,
        fromY: defender.y,
        toX: targetUnit.x,
        toY: targetUnit.y,
        type: 'arrow',
        progress: 0,
        speed: 2.8,
        damage: defender.damage,
        target: targetUnit,
        targetType: 'unit',
      });
    } else {
      this._applyDamage(targetUnit, 'unit', defender.damage, defender);
    }
  }

  _updateWatchtowers(dt) {
    const watchtower = this.state.getEnemyTarget('watchtower');
    if (!watchtower || watchtower.status === 'destroyed') return;

    this.activeAssault.towerCooldowns.watchtower = (this.activeAssault.towerCooldowns.watchtower || 0) - dt;
    if (this.activeAssault.towerCooldowns.watchtower <= 0) {
      const cellSize = GAME_CONFIG.CELL_SIZE;
      const tx = watchtower.col * cellSize + cellSize / 2;
      const ty = watchtower.row * cellSize + cellSize / 2;

      // Find nearest player invader
      let nearest = null;
      let minDist = 7 * cellSize;
      for (const u of this.activeAssault.deployedUnits) {
        if (u.isDead) continue;
        const d = Math.hypot(u.x - tx, u.y - ty);
        if (d < minDist) {
          minDist = d;
          nearest = u;
        }
      }

      if (nearest) {
        this.activeAssault.towerCooldowns.watchtower = 1.3;
        this.activeAssault.projectiles.push({
          fromX: tx,
          fromY: ty,
          toX: nearest.x,
          toY: nearest.y,
          type: 'cannonball',
          progress: 0,
          speed: 2.5,
          damage: 28,
          target: nearest,
          targetType: 'unit',
        });
      }
    }
  }

  _updateProjectiles(dt) {
    for (const p of this.activeAssault.projectiles) {
      p.progress += dt * p.speed;
      if (p.progress >= 1.0) {
        this._applyDamage(p.target, p.targetType, p.damage);
        p.isDone = true;
      }
    }
    this.activeAssault.projectiles = this.activeAssault.projectiles.filter(p => !p.isDone);
  }

  _applyDamage(target, targetType, rawDamage, attacker = null) {
    if (!target) return;

    if (targetType === 'building') {
      const effectiveArmor = Math.max(2, target.baseArmor || 10);
      const actualDmg = Math.max(8, Math.round(rawDamage * (100 / (100 + effectiveArmor))));

      this.activeAssault.damageDealtToTargets[target.id] = (this.activeAssault.damageDealtToTargets[target.id] || 0) + actualDmg;
      const result = this.state.damageEnemyTarget(target.id, actualDmg);

      this.state.emit('tactical_damage', {
        col: target.col,
        row: target.row,
        damage: actualDmg,
        targetName: target.name,
        destroyed: result.destroyed,
      });
    } else if (targetType === 'unit') {
      const actualDmg = Math.max(4, Math.round(rawDamage * (100 / (100 + (target.armor || 0)))));
      target.hp -= actualDmg;

      this.state.emit('unit_damaged', { x: target.x, y: target.y, damage: actualDmg });

      if (target.hp <= 0) {
        target.isDead = true;
        if (target.isEnemy) {
          this.activeAssault.casualties.enemy++;
          this.activeAssault.enemyLossesByType[target.type] = (this.activeAssault.enemyLossesByType[target.type] || 0) + 1;
        } else {
          this.activeAssault.casualties.player++;
          this.activeAssault.playerLossesByType[target.type] = (this.activeAssault.playerLossesByType[target.type] || 0) + 1;
        }
      }
    }
  }

  /**
   * End the current assault, generate comprehensive Battle Report, and return to map
   */
  endAssault() {
    if (!this.activeAssault.isActive) return null;

    this.activeAssault.isActive = false;
    const target = this.state.getEnemyTarget(this.state.offensiveState.selectedTargetId) || this.state.getEnemyTargets()[0];

    // Compute star rating (1-3 stars)
    const strongholdDestroyed = this.state.getEnemyTarget('command_center')?.status === 'destroyed';
    const totalDestroyed = this.state.getEnemyTargets().filter(t => t.status === 'destroyed').length;
    let stars = strongholdDestroyed ? 3 : totalDestroyed >= 2 ? 2 : totalDestroyed >= 1 ? 1 : 0;

    const totalDmgDealt = Object.values(this.activeAssault.damageDealtToTargets).reduce((a, b) => a + b, 0);

    const report = {
      targetId: target.id,
      targetName: target.name,
      targetSubtitle: target.subtitle,
      targetIcon: target.icon,
      stars,
      targetDamageTaken: totalDmgDealt,
      targetRemainingHp: target.hp,
      targetMaxHp: target.maxHp,
      targetDestroyed: target.status === 'destroyed',
      totalDeployed: this.activeAssault.totalDeployed,
      playerForceDeployed: { ...this.activeAssault.availableTroops },
      playerLossesByType: { ...this.activeAssault.playerLossesByType },
      playerTotalLosses: this.activeAssault.casualties.player,
      playerSurvivors: this.activeAssault.deployedUnits.filter(u => !u.isDead).length,
      enemyLossesByType: { ...this.activeAssault.enemyLossesByType },
      enemyTotalLosses: this.activeAssault.casualties.enemy,
      aiDefense: this.activeAssault.aiDefenseDecision || {
        strategyName: 'Emergency Garrison Reinforcement',
        icon: '🚨',
        reason: 'Tactical garrison deployed to defend stronghold perimeter.',
        source: 'llm',
      },
      consequence: target.status === 'destroyed' ? target.consequence : (totalDmgDealt > 0 ? `Target sustained ${totalDmgDealt} structural damage.` : 'Defensive perimeter held.'),
      aiAdaptation: 'AI Commander logged player assault vector; sector defense priorities adapted.',
    };

    // Apply player casualties to persistent army
    this._applyCasualtiesToState(this.activeAssault.playerLossesByType);

    // AI learns
    this.defensiveAI.learn(
      { target, attackForce: report.playerForceDeployed },
      report.aiDefense,
      report
    );

    this.state.offensiveState.isAttackMode = false;
    this.state.phase = 'player';
    this.state.offensiveState.lastAttackReport = report;
    this.state.emit('offensive_combat_resolved', report);
    this.state.emit('phase_change', 'player');

    return report;
  }

  _applyCasualtiesToState(lossesByType) {
    for (const [unitType, count] of Object.entries(lossesByType || {})) {
      let toRemove = count;
      for (let i = this.state.playerUnits.length - 1; i >= 0; i--) {
        if (toRemove <= 0) break;
        if (this.state.playerUnits[i].type === unitType) {
          this.state.playerUnits.splice(i, 1);
          toRemove--;
        }
      }
    }

    this.state.population = this.state.playerUnits.reduce(
      (s, u) => s + (PLAYER_UNITS[u.type]?.populationCost || 1), 0
    );
  }
}
