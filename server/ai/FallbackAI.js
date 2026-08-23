// ─── Fallback AI ───────────────────────────────────────
// Deterministic strategy engine — works without network/LLM
// Uses the same scoring logic as the client-side EnemyAI

export class FallbackAI {
  constructor() {
    this.weights = {
      targetWeakness: 3.0,
      expectedDamage: 2.0,
      routeAccessibility: 1.0,
      estimatedLosses: -2.5,
      adaptationBonus: 2.0,
    };
  }

  /**
   * Generate a strategy using deterministic scoring
   * @param {Object} gameState - Serialized game state snapshot
   * @returns {Object} Strategy object
   */
  generateStrategy(gameState) {
    const evaluations = this._evaluateDefenses(gameState);
    const candidates = this._generateCandidates(evaluations, gameState);
    const scored = this._scoreCandidates(candidates, evaluations, gameState);

    if (scored.length === 0) {
      return this._defaultStrategy();
    }

    return scored[0];
  }

  _evaluateDefenses(state) {
    const evaluations = {};
    const walls = state.walls || {};

    for (const dir of ['north', 'south', 'east', 'west']) {
      const wall = walls[dir] || { hp: 0, maxHp: 0, percentage: 0 };
      const weakness = wall.maxHp > 0 ? 1 - (wall.hp / wall.maxHp) : 1.0;

      // Check tower coverage
      const towerCoverage = (state.towers || []).filter(t => {
        if (dir === 'north') return t.row <= 6;
        if (dir === 'south') return t.row >= 10;
        if (dir === 'east') return t.col >= 12;
        if (dir === 'west') return t.col <= 8;
        return false;
      }).length;

      evaluations[dir] = {
        weakness,
        towerCoverage,
        hasWall: wall.maxHp > 0,
        threatScore: weakness * 10 - towerCoverage * 3,
      };
    }

    return evaluations;
  }

  _generateCandidates(evaluations, state) {
    const strategies = [
      { id: 'north_assault', name: 'North Assault', dir: 'north', preferredUnits: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 } },
      { id: 'south_assault', name: 'South Assault', dir: 'south', preferredUnits: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 } },
      { id: 'east_wall_breach', name: 'East Wall Breach', dir: 'east', preferredUnits: { enemy_melee: 0.6, enemy_ranged: 0.2, enemy_siege: 0.2 } },
      { id: 'west_wall_breach', name: 'West Wall Breach', dir: 'west', preferredUnits: { enemy_melee: 0.6, enemy_ranged: 0.2, enemy_siege: 0.2 } },
      { id: 'siege_assault', name: 'Siege Assault', dir: this._weakestDir(evaluations), preferredUnits: { enemy_melee: 0.3, enemy_ranged: 0.2, enemy_siege: 0.5 } },
      { id: 'tower_suppression', name: 'Tower Suppression', dir: this._weakestDir(evaluations), preferredUnits: { enemy_melee: 0.3, enemy_ranged: 0.3, enemy_siege: 0.4 } },
      { id: 'diversionary', name: 'Diversion + Main Strike', dir: this._weakestDir(evaluations), preferredUnits: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 } },
    ];

    return strategies;
  }

  _scoreCandidates(candidates, evaluations, state) {
    const memory = state.aiMemory || [];

    return candidates.map(c => {
      let score = 0;
      const dirEval = evaluations[c.dir];

      if (dirEval) {
        score += dirEval.weakness * this.weights.targetWeakness;
        score += (1 - dirEval.towerCoverage / 5) * this.weights.routeAccessibility;
        score += (dirEval.towerCoverage * 0.3) * this.weights.estimatedLosses;
      }

      // Adaptation bonus — prefer unused strategies
      const recentUses = memory.filter(m => m.strategyId === c.id).length;
      score += (recentUses === 0 ? 1.0 : 1.0 / (recentUses + 1)) * this.weights.adaptationBonus;

      // Penalty for recent failures
      const failures = memory.filter(m => m.strategyId === c.id && !m.success).length;
      score -= failures * 1.5;

      const confidence = Math.max(0.1, Math.min(1.0, (score + 5) / 15));

      return {
        ...c,
        target: c.dir,
        unitMix: c.preferredUnits,
        targetPriority: [`wall_${c.dir}`, 'archer_tower', 'town_center'],
        score,
        confidence,
        reason: `Deterministic analysis: ${c.dir} has threat score ${dirEval?.threatScore?.toFixed(1) || '?'}`,
      };
    }).sort((a, b) => b.score - a.score);
  }

  _weakestDir(evaluations) {
    let weakest = 'north';
    let maxThreat = -Infinity;
    for (const [dir, eval_] of Object.entries(evaluations)) {
      if (eval_.threatScore > maxThreat) {
        maxThreat = eval_.threatScore;
        weakest = dir;
      }
    }
    return weakest;
  }

  _defaultStrategy() {
    return {
      id: 'north_assault',
      name: 'North Assault',
      target: 'north',
      unitMix: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 },
      targetPriority: ['wall_north', 'archer_tower', 'town_center'],
      confidence: 0.3,
      score: 0,
      reason: 'Fallback strategy — default north assault',
    };
  }
}
