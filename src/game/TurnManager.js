// ─── Turn Manager ───────────────────────────────────────
// Controls the turn-based two-way war game loop:
// Player Turn (Economy, Recruitment, Offensive Invasion)
// ↔ Enemy Turn (Reconnaissance, Offensive Strike, Player Defense)

import { AI_CONFIG } from '../data/balancing.js';

export class TurnManager {
  constructor(gameState, resourceSystem, buildingSystem, unitSystem, combatSystem, enemyAI) {
    this.state = gameState;
    this.resources = resourceSystem;
    this.buildings = buildingSystem;
    this.units = unitSystem;
    this.combat = combatSystem;
    this.ai = enemyAI;
    this.isProcessing = false;
  }

  /**
   * End the player's turn and execute the Enemy Offensive Phase
   */
  async endTurn() {
    if (this.isProcessing) return;
    if (this.state.phase !== 'player') return;
    if (this.state.gameResult) return;

    this.isProcessing = true;
    this.state.log(`── Turn ${this.state.turn} Completed ──`, 'neutral');

    try {
      // 1. Process build queue
      this.buildings.processBuildQueue();

      // 2. Heal surviving player units
      this.units.healUnits();

      // 3. Reinforce enemy army (scaled by surviving barracks/mines)
      this.combat.reinforceEnemy();

      // 4. Enemy AI Offensive Phase
      const totalEnemyUnits = Object.values(this.state.enemyArmy).reduce((s, c) => s + c, 0);

      if (totalEnemyUnits > 0) {
        this.state.phase = 'ai_analyzing';
        this.state.emit('phase_change', 'ai_analyzing');

        // AI evaluates player defenses and chooses attack strategy
        const strategy = await this.ai.executePipeline();

        // Calculate threat level
        const armySize = Math.floor(totalEnemyUnits * 0.6);
        const threatLevel = armySize >= 15 ? 'CRITICAL' : armySize >= 8 ? 'HIGH' : 'MEDIUM';

        this.state.emit('enemy_offensive_incoming', {
          strategy,
          target: strategy.target || 'north',
          armySize,
          threatLevel,
          reason: strategy.reason || 'Exploiting detected weakness in fortress perimeter.',
        });

        // Enter AI Attack phase
        this.state.phase = 'ai_attacking';
        this.state.emit('phase_change', 'ai_attacking');
        await this._delay(900);

        // Combat resolution phase
        this.state.phase = 'combat';
        this.state.emit('phase_change', 'combat');

        const results = this.combat.resolveCombat(strategy);

        // AI learns from outcome
        this.ai.learn(strategy, results);

        this.state.emit('combat_resolved', results);
        this.state.emit('enemy_offensive_resolved', { strategy, results });
        await this._delay(1200);
      } else {
        this.state.log(`🛡️ Enemy forces regrouping; no offensive strike launched this turn.`, 'neutral');
        await this._delay(400);
      }

      // 5. Check game over conditions
      if (this.state.gameResult) {
        this.isProcessing = false;
        return;
      }

      // 6. Advance turn
      this.state.turn++;
      this.state.stats.turnsPlayed++;

      // 7. Check victory (survived all turns)
      if (this.state.turn > this.state.maxTurns) {
        this.state.gameResult = 'victory';
        this.state.phase = 'game_over';
        this.state.emit('game_over', { result: 'victory', reason: 'Survived 20 turns against all enemy invasions!' });
        this.isProcessing = false;
        return;
      }

      // 8. Collect income for new turn
      this.state.phase = 'resolution';
      this.state.emit('phase_change', 'resolution');
      const collected = this.resources.collectIncome();

      const incomeStr = Object.entries(collected)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `${k}: +${v}`)
        .join(', ');
      if (incomeStr) {
        this.state.log(`💰 New Turn Income: ${incomeStr}`, 'player');
      }

      // 9. Start new player turn
      this.state.phase = 'player';
      this.state.emit('phase_change', 'player');
      this.state.log(`── Turn ${this.state.turn} Active — Plan Your Defense or Attack! ──`, 'player');

    } catch (error) {
      console.error('Turn processing error:', error);
      this.state.phase = 'player';
      this.state.emit('phase_change', 'player');
    }

    this.isProcessing = false;
    this.state.emit('turn_end', this.state.turn);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
