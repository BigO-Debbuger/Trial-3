// ─── Defensive AI (Enemy Command) ──────────────────────────────
// Evaluates incoming player attacks, determines optimal defensive strategy,
// connects to the Swytchcode/server defense pipeline, and adapts based on player habits.

import { DEFENSIVE_STRATEGIES, ENEMY_TARGET_TYPES } from '../data/enemyBase.js';
import { PLAYER_UNIT_TYPES } from '../data/units.js';

export class DefensiveAI {
  constructor(gameState) {
    this.state = gameState;
    this.serverUrl = '/api/ai/defend';
  }

  /**
   * Execute full AI defense pipeline
   * SCAN → EVALUATE → PLAN → SCORE → SWYTCHCODE / LLM → VALIDATE → EXECUTE
   */
  async executeDefense(attackContext) {
    // 1. SCAN
    this.state.offensiveState.aiDefensePipelineStep = 'scan';
    this.state.emit('ai_defense_step', 'scan');
    await this._delay(300);

    // 2. EVALUATE
    this.state.offensiveState.aiDefensePipelineStep = 'evaluate';
    this.state.emit('ai_defense_step', 'evaluate');
    await this._delay(300);
    const evaluation = this._evaluateThreat(attackContext);

    // 3. PLAN
    this.state.offensiveState.aiDefensePipelineStep = 'plan';
    this.state.emit('ai_defense_step', 'plan');
    await this._delay(300);
    const candidatePlans = this._generateCandidatePlans(attackContext, evaluation);

    // 4. SCORE
    this.state.offensiveState.aiDefensePipelineStep = 'score';
    this.state.emit('ai_defense_step', 'score');
    await this._delay(300);
    const scoredPlans = this._scoreCandidatePlans(candidatePlans, evaluation);

    // 5. SWYTCHCODE / SERVER / FALLBACK EXECUTION
    this.state.offensiveState.aiDefensePipelineStep = 'swytchcode';
    this.state.emit('ai_defense_step', 'swytchcode');
    await this._delay(400);

    let rawDecision;
    let executionSource = 'fallback';

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attackContext,
          gameState: this.state.toAISnapshot(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.defenseDecision) {
          rawDecision = data.defenseDecision;
          executionSource = data.source || 'llm';
        }
      }
    } catch (err) {
      // Graceful offline fallback
    }

    if (!rawDecision) {
      rawDecision = scoredPlans[0] || this._defaultDefense(attackContext);
      executionSource = 'deterministic';
    }

    // 6. VALIDATE (Deterministic Game Engine Validation)
    this.state.offensiveState.aiDefensePipelineStep = 'validate';
    this.state.emit('ai_defense_step', 'validate');
    await this._delay(250);

    const validatedDecision = this._validateDefenseDecision(rawDecision, attackContext);
    validatedDecision.source = executionSource;

    // Finalized step
    this.state.offensiveState.aiDefensePipelineStep = 'execute';
    this.state.emit('ai_defense_step', 'execute');

    this.state.log(
      `🛡️ [ENEMY COMMAND] AI Commander selected: ${validatedDecision.strategyName} (${executionSource.toUpperCase()}) — ${validatedDecision.reason}`,
      'enemy'
    );

    return validatedDecision;
  }

  _evaluateThreat(ctx) {
    const totalSiege = ctx.attackForce[PLAYER_UNIT_TYPES.SIEGE] || 0;
    const totalWarriors = ctx.attackForce[PLAYER_UNIT_TYPES.WARRIOR] || 0;
    const totalArchers = ctx.attackForce[PLAYER_UNIT_TYPES.ARCHER] || 0;
    const isCoreTarget = ctx.target.id === ENEMY_TARGET_TYPES.COMMAND_CENTER;
    const isEconomicTarget = ctx.target.id === ENEMY_TARGET_TYPES.GOLD_MINE;

    const siegeThreat = totalSiege > 1 ? 'HIGH' : totalSiege === 1 ? 'MEDIUM' : 'LOW';
    const primaryThreatType = totalSiege >= 2 ? 'SIEGE_ASSAULT' : totalWarriors >= 6 ? 'MELEE_SWARM' : 'RANGED_FLANK';

    return {
      siegeThreat,
      primaryThreatType,
      isCoreTarget,
      isEconomicTarget,
      targetHealthRatio: ctx.target.hp / ctx.target.maxHp,
    };
  }

  _generateCandidatePlans(ctx, evalThreat) {
    const plans = [];

    // Plan 1: HOLD
    plans.push({
      strategy: 'HOLD',
      strategyName: DEFENSIVE_STRATEGIES.HOLD.name,
      icon: DEFENSIVE_STRATEGIES.HOLD.icon,
      defenders: { enemy_melee: 3, enemy_ranged: 3, enemy_siege: 0 },
      reason: 'Reinforce citadel walls and absorb incoming kinetic impacts.',
    });

    // Plan 2: REINFORCE
    plans.push({
      strategy: 'REINFORCE',
      strategyName: DEFENSIVE_STRATEGIES.REINFORCE.name,
      icon: DEFENSIVE_STRATEGIES.REINFORCE.icon,
      defenders: { enemy_melee: 4, enemy_ranged: 3, enemy_siege: 1 },
      reason: 'Dispatch emergency reserves to the threatened sector.',
    });

    // Plan 3: COUNTERATTACK
    plans.push({
      strategy: 'COUNTERATTACK',
      strategyName: DEFENSIVE_STRATEGIES.COUNTERATTACK.name,
      icon: DEFENSIVE_STRATEGIES.COUNTERATTACK.icon,
      defenders: { enemy_melee: 5, enemy_ranged: 2, enemy_siege: 0 },
      reason: 'Shock infantry counter-charges attacking formations directly.',
    });

    // Plan 4: REDIRECT
    plans.push({
      strategy: 'REDIRECT',
      strategyName: DEFENSIVE_STRATEGIES.REDIRECT.name,
      icon: DEFENSIVE_STRATEGIES.REDIRECT.icon,
      defenders: { enemy_melee: 2, enemy_ranged: 4, enemy_siege: 1 },
      reason: 'Reposition perimeter marksmen to establish a crossfire choke point.',
    });

    return plans;
  }

  _scoreCandidatePlans(candidates, evalThreat) {
    const weights = this.state.aiDefenseWeights || {};

    return candidates.map(c => {
      let score = 5.0 * (weights[c.strategy] || 1.0);

      // If heavy siege is attacking, COUNTERATTACK or REINFORCE are high priority
      if (evalThreat.siegeThreat === 'HIGH') {
        if (c.strategy === 'COUNTERATTACK') score += 4.5;
        if (c.strategy === 'REINFORCE') score += 3.0;
        if (c.strategy === 'HOLD') score -= 2.0;
      }

      // If core target is threatened and damaged, prioritize HOLD & REINFORCE
      if (evalThreat.isCoreTarget && evalThreat.targetHealthRatio < 0.6) {
        if (c.strategy === 'REINFORCE') score += 5.0;
        if (c.strategy === 'HOLD') score += 3.5;
      }

      // If economic mine is targeted, prioritize COUNTERATTACK
      if (evalThreat.isEconomicTarget) {
        if (c.strategy === 'COUNTERATTACK') score += 3.5;
        if (c.strategy === 'REDIRECT') score += 2.0;
      }

      return {
        ...c,
        score,
        confidence: Math.min(0.95, Math.max(0.4, score / 15)),
      };
    }).sort((a, b) => b.score - a.score);
  }

  _validateDefenseDecision(raw, ctx) {
    const validStrategies = ['HOLD', 'REINFORCE', 'COUNTERATTACK', 'REDIRECT'];
    const stratId = validStrategies.includes(raw.strategy) ? raw.strategy : 'REINFORCE';
    const stratDef = DEFENSIVE_STRATEGIES[stratId] || DEFENSIVE_STRATEGIES.REINFORCE;

    // Validate and clamp defenders
    const garrison = this.state.enemyBase.garrison || { enemy_melee: 4, enemy_ranged: 3, enemy_siege: 1 };
    const defenders = {
      enemy_melee: Math.min(garrison.enemy_melee || 4, Math.max(1, raw.defenders?.enemy_melee || 3)),
      enemy_ranged: Math.min(garrison.enemy_ranged || 3, Math.max(1, raw.defenders?.enemy_ranged || 2)),
      enemy_siege: Math.min(garrison.enemy_siege || 1, Math.max(0, raw.defenders?.enemy_siege || 0)),
    };

    return {
      strategy: stratId,
      strategyName: stratDef.name,
      icon: stratDef.icon,
      structureDefenseMultiplier: stratDef.structureDefenseMultiplier,
      counterDamageMultiplier: stratDef.counterDamageMultiplier,
      garrisonBonusCount: stratDef.garrisonBonusCount || 0,
      defenders,
      reason: raw.reason || 'Calculated optimal defensive formation for sector defense.',
      confidence: Math.max(0.3, Math.min(0.98, raw.confidence || 0.75)),
    };
  }

  _defaultDefense(ctx) {
    return {
      strategy: 'REINFORCE',
      strategyName: DEFENSIVE_STRATEGIES.REINFORCE.name,
      icon: DEFENSIVE_STRATEGIES.REINFORCE.icon,
      defenders: { enemy_melee: 3, enemy_ranged: 2, enemy_siege: 0 },
      reason: 'Standard tactical reinforcement deployed to sector.',
      confidence: 0.6,
    };
  }

  /**
   * Learn from the defensive outcome and adapt future strategy weights
   */
  learn(attackContext, defenseDecision, battleReport) {
    const memory = {
      turn: this.state.turn,
      targetId: attackContext.target.id,
      playerForce: { ...attackContext.attackForce },
      defenseStrategy: defenseDecision.strategy,
      structureDamaged: battleReport.targetDamageTaken,
      structureDestroyed: battleReport.targetDestroyed,
      playerCasualties: battleReport.playerTotalLosses,
      enemyCasualties: battleReport.enemyTotalLosses,
      success: battleReport.playerTotalLosses >= battleReport.enemyTotalLosses && !battleReport.targetDestroyed,
    };

    this.state.aiDefenseMemory.push(memory);

    // Adapt weights
    const weights = this.state.aiDefenseWeights;
    if (memory.success) {
      weights[defenseDecision.strategy] = (weights[defenseDecision.strategy] || 1.0) * 1.15;
    } else {
      weights[defenseDecision.strategy] = Math.max(0.5, (weights[defenseDecision.strategy] || 1.0) * 0.85);
      // Promote counter-strategies
      if (defenseDecision.strategy === 'HOLD') weights.COUNTERATTACK *= 1.2;
      if (defenseDecision.strategy === 'COUNTERATTACK') weights.REINFORCE *= 1.2;
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
