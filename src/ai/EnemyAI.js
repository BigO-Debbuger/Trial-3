// ─── Enemy AI ───────────────────────────────────────
// Main AI controller implementing the 6-step pipeline:
// SCAN → EVALUATE → PLAN → SCORE → EXECUTE → LEARN

import { AI_CONFIG, STRATEGIES } from '../data/balancing.js';
import { BUILDINGS, BUILDING_TYPES } from '../data/buildings.js';
import { ENEMY_UNITS } from '../data/units.js';

export class EnemyAI {
  constructor(gameState) {
    this.state = gameState;
    this.weights = { ...AI_CONFIG.STRATEGY_WEIGHTS };
    this.attackHistory = [];
    this.playerProfile = 'balanced'; // 'aggressive' | 'defensive' | 'balanced' | 'economic'
  }

  /**
   * Execute the full AI pipeline
   * Returns a strategy object
   */
  async executePipeline() {
    // Step 1: SCAN
    this.state.aiPipelineStep = 'scan';
    this.state.emit('ai_step', 'scan');
    await this._delay(400);
    const scan = this.scan();

    // Step 2: EVALUATE
    this.state.aiPipelineStep = 'evaluate';
    this.state.emit('ai_step', 'evaluate');
    await this._delay(400);
    const evaluations = this.evaluate(scan);

    // Step 3: PLAN
    this.state.aiPipelineStep = 'plan';
    this.state.emit('ai_step', 'plan');
    await this._delay(400);
    const candidates = this.plan(scan, evaluations);

    // Step 4: SCORE
    this.state.aiPipelineStep = 'score';
    this.state.emit('ai_step', 'score');
    await this._delay(400);
    const scored = this.score(candidates, evaluations);

    // Step 5: EXECUTE
    this.state.aiPipelineStep = 'execute';
    this.state.emit('ai_step', 'execute');
    await this._delay(400);
    const strategy = this.selectBest(scored);

    // Step 6: LEARN (after combat resolves, called externally)
    this.state.aiPipelineStep = 'learn';
    this.state.emit('ai_step', 'learn');
    await this._delay(300);

    this.state.lastAIStrategy = strategy;
    return strategy;
  }

  /**
   * Step 1: SCAN — Collect game state intelligence
   */
  scan() {
    const walls = {};
    for (const dir of ['north', 'south', 'east', 'west']) {
      walls[dir] = this.state.getWallHP(dir);
    }

    const towers = this.state.getTowers().filter(t => !t.constructing);
    const towerPositions = towers.map(t => ({
      type: t.type,
      level: t.level,
      hp: t.hp,
      maxHp: t.maxHp,
      col: t.col,
      row: t.row,
    }));

    const playerUnits = this.state.playerUnits.map(u => ({
      type: u.type,
      hp: u.hp,
      maxHp: u.maxHp,
    }));

    const resourceBuildings = this.state.buildings.filter(
      b => b.type === BUILDING_TYPES.RESOURCE_CAMP && !b.constructing
    );

    return {
      walls,
      towers: towerPositions,
      towerCount: towers.length,
      playerUnits,
      playerUnitCount: playerUnits.length,
      resources: { ...this.state.resources },
      resourceBuildingCount: resourceBuildings.length,
      turn: this.state.turn,
      enemyArmy: { ...this.state.enemyArmy },
      buildings: this.state.buildings.filter(b => !b.constructing).map(b => ({
        type: b.type,
        level: b.level,
        hp: b.hp,
        maxHp: b.maxHp,
        direction: b.direction,
      })),
    };
  }

  /**
   * Step 2: EVALUATE — Score each defensive position
   */
  evaluate(scan) {
    const evaluations = {};

    // Evaluate each wall direction
    for (const [dir, wall] of Object.entries(scan.walls)) {
      const weakness = wall.maxHp > 0
        ? 1 - (wall.hp / wall.maxHp)
        : 1.0; // No wall = maximum weakness

      // Check tower coverage on this side
      const towerCoverage = scan.towers.filter(t => {
        if (dir === 'north') return t.row <= 6;
        if (dir === 'south') return t.row >= 10;
        if (dir === 'east') return t.col >= 12;
        if (dir === 'west') return t.col <= 8;
        return false;
      }).length;

      // Check player units near this side
      const nearbyUnits = scan.playerUnits.length; // Simplified

      evaluations[dir] = {
        weakness,
        towerCoverage,
        nearbyUnits,
        hasWall: wall.maxHp > 0,
        wallHP: wall.hp,
        wallMaxHP: wall.maxHp,
        threatScore: weakness * 10 - towerCoverage * 3 - nearbyUnits * 2,
      };
    }

    // Evaluate resource vulnerability
    evaluations.resources = {
      buildingCount: scan.resourceBuildingCount,
      vulnerability: scan.resourceBuildingCount > 0 ? 0.6 : 0.1,
    };

    // Evaluate tower threat
    evaluations.towers = {
      count: scan.towerCount,
      avgHP: scan.towers.length > 0
        ? scan.towers.reduce((s, t) => s + t.hp / t.maxHp, 0) / scan.towers.length
        : 0,
    };

    // Profile the player
    this._profilePlayer(scan);

    return evaluations;
  }

  /**
   * Step 3: PLAN — Generate candidate strategies
   */
  plan(scan, evaluations) {
    const candidates = [];

    // Generate all standard strategies
    for (const [key, strategy] of Object.entries(STRATEGIES)) {
      const candidate = {
        ...strategy,
        unitMix: { ...strategy.preferredUnits },
      };

      // Determine target direction for wall strategies
      if (strategy.id.includes('east')) candidate.target = 'east';
      else if (strategy.id.includes('west')) candidate.target = 'west';
      else if (strategy.id.includes('north')) candidate.target = 'north';
      else if (strategy.id.includes('south')) candidate.target = 'south';
      else {
        // Find weakest direction
        let weakestDir = 'north';
        let maxWeakness = -Infinity;
        for (const [dir, eval_] of Object.entries(evaluations)) {
          if (typeof eval_ === 'object' && eval_.weakness !== undefined) {
            if (eval_.weakness > maxWeakness) {
              maxWeakness = eval_.weakness;
              weakestDir = dir;
            }
          }
        }
        candidate.target = weakestDir;
      }

      candidates.push(candidate);
    }

    return candidates;
  }

  /**
   * Step 4: SCORE — Score each candidate strategy
   */
  score(candidates, evaluations) {
    const scored = [];

    for (const candidate of candidates) {
      let score = 0;

      // Target weakness
      const dirEval = evaluations[candidate.target];
      if (dirEval && dirEval.weakness !== undefined) {
        score += dirEval.weakness * this.weights.targetWeakness;
      }

      // Expected damage
      const armyStrength = this._calculateArmyStrength(candidate.unitMix);
      score += (armyStrength / 1000) * this.weights.expectedDamage;

      // Resource value (for resource raids)
      if (candidate.id === 'resource_raid') {
        score += evaluations.resources.vulnerability * this.weights.resourceValue;
      }

      // Route accessibility (less towers = more accessible)
      if (dirEval) {
        const accessibility = 1 - (dirEval.towerCoverage / 5);
        score += accessibility * this.weights.routeAccessibility;
      }

      // Estimated losses
      if (dirEval) {
        const estimatedLosses = (dirEval.towerCoverage * 0.3 + dirEval.nearbyUnits * 0.2);
        score += estimatedLosses * this.weights.estimatedLosses;
      }

      // Adaptation bonus — bonus for trying strategies that haven't been used recently
      const recentUses = this.attackHistory.filter(
        h => h.strategyId === candidate.id
      ).length;
      const adaptBonus = recentUses === 0 ? 1.0 : 1.0 / (recentUses + 1);
      score += adaptBonus * this.weights.adaptationBonus;

      // Penalty for strategies that failed recently
      const recentFailures = this.attackHistory.filter(
        h => h.strategyId === candidate.id && !h.success
      ).length;
      score -= recentFailures * 1.5;

      // Calculate confidence
      const maxPossibleScore = Object.values(this.weights).reduce((s, w) => s + Math.abs(w), 0) * 1.5;
      const confidence = Math.max(0.1, Math.min(1.0, (score + 5) / maxPossibleScore));

      scored.push({
        ...candidate,
        score,
        confidence,
      });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * Step 5: Select the best strategy
   */
  selectBest(scored) {
    if (scored.length === 0) {
      // Fallback strategy
      return {
        id: 'north_assault',
        name: 'North Assault',
        target: 'north',
        unitMix: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 },
        targetPriority: ['wall_north', 'archer_tower', 'town_center'],
        confidence: 0.3,
        score: 0,
        reason: 'Fallback strategy',
      };
    }

    const best = scored[0];

    // Add a reason
    best.reason = this._generateReason(best);

    this.state.log(`🎯 AI selected: ${best.name} (confidence: ${(best.confidence * 100).toFixed(0)}%)`, 'enemy');

    return best;
  }

  /**
   * Step 6: LEARN — Store outcome and adjust weights
   */
  learn(strategy, combatResults) {
    const success = combatResults.buildingsDestroyed > 0 || combatResults.wallBreached;

    const outcome = {
      turn: this.state.turn,
      strategyId: strategy.id,
      target: strategy.target,
      success,
      damageDealt: combatResults.damageToPlayer,
      unitsLost: combatResults.enemiesKilled,
      buildingsDestroyed: combatResults.buildingsDestroyed,
      wallBreached: combatResults.wallBreached,
    };

    this.attackHistory.push(outcome);
    this.state.aiMemory.push(outcome);

    // Keep memory limited
    if (this.attackHistory.length > AI_CONFIG.MEMORY_TURNS) {
      this.attackHistory.shift();
    }

    // Adapt weights based on outcome
    if (success) {
      // Reinforce successful weights
      this.weights.targetWeakness *= 1.05;
      this.weights.expectedDamage *= 1.02;
    } else {
      // Increase adaptation and exploration
      this.weights.adaptationBonus *= 1.1;
      this.weights.estimatedLosses *= 1.05;
    }

    // Normalize weights
    const maxWeight = Math.max(...Object.values(this.weights).map(Math.abs));
    if (maxWeight > 5) {
      for (const key of Object.keys(this.weights)) {
        this.weights[key] = (this.weights[key] / maxWeight) * 3;
      }
    }

    this.state.log(`🧠 AI learning from ${success ? 'successful' : 'failed'} attack`, 'enemy');
  }

  // ─── Helpers ───

  _calculateArmyStrength(unitMix) {
    let strength = 0;
    for (const [type, percentage] of Object.entries(unitMix)) {
      const count = Math.floor((this.state.enemyArmy[type] || 0) * percentage);
      const unitDef = ENEMY_UNITS[type];
      if (unitDef) {
        strength += count * (unitDef.hp + unitDef.damage * 3);
      }
    }
    return strength;
  }

  _profilePlayer(scan) {
    const walls = Object.values(scan.walls).filter(w => w.maxHp > 0).length;
    const towers = scan.towerCount;
    const units = scan.playerUnitCount;
    const resources = scan.resourceBuildingCount;

    if (towers >= 3 && walls >= 3) this.playerProfile = 'defensive';
    else if (units >= 5) this.playerProfile = 'aggressive';
    else if (resources >= 2) this.playerProfile = 'economic';
    else this.playerProfile = 'balanced';
  }

  _generateReason(strategy) {
    const reasons = {
      east_wall_breach: 'Eastern defenses appear weakest',
      west_wall_breach: 'Western wall shows vulnerability',
      north_assault: 'Northern front has gaps in coverage',
      south_assault: 'Southern approach less defended',
      resource_raid: 'Economic targets exposed',
      tower_suppression: 'Towers threatening our forces',
      siege_assault: 'Walls require heavy siege equipment',
      diversionary: 'Splitting forces to exploit multiple weaknesses',
    };
    return reasons[strategy.id] || 'Strategic opportunity detected';
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
