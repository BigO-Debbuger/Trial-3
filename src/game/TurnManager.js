// ─── Turn Manager ───────────────────────────────────────
// Controls the turn-based game loop

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
   * End the player's turn and start the AI turn
   */
  async endTurn() {
    if (this.isProcessing) return;
    if (this.state.phase !== 'player') return;
    if (this.state.gameResult) return;

    this.isProcessing = true;
    this.state.phase = 'ai_analyzing';
    this.state.emit('phase_change', 'ai_analyzing');
    this.state.log(`── Turn ${this.state.turn} End ──`, 'neutral');

    try {
      // 1. Process build queue
      this.buildings.processBuildQueue();

      // 2. Heal player units
      this.units.healUnits();

      // 3. Reinforce enemy army
      this.combat.reinforceEnemy();

      // 4. AI turn (if past first attack turn)
      if (this.state.turn >= AI_CONFIG.FIRST_ATTACK_TURN) {
        // AI analysis phase
        this.state.phase = 'ai_analyzing';
        this.state.emit('phase_change', 'ai_analyzing');

        // Execute AI pipeline
        const strategy = await this.ai.executePipeline();

        // AI attack phase
        this.state.phase = 'ai_attacking';
        this.state.emit('phase_change', 'ai_attacking');
        await this._delay(600);

        // Combat resolution
        this.state.phase = 'combat';
        this.state.emit('phase_change', 'combat');

        const results = this.combat.resolveCombat(strategy);

        // AI learns from the outcome
        this.ai.learn(strategy, results);

        this.state.emit('combat_resolved', results);
        await this._delay(800);
      } else {
        this.state.log(`🛡️ Enemies are gathering forces... (Attack begins turn ${AI_CONFIG.FIRST_ATTACK_TURN})`, 'neutral');
        await this._delay(500);
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
        this.state.emit('game_over', { result: 'victory' });
        this.isProcessing = false;
        return;
      }

      // 8. Collect income for new turn
      this.state.phase = 'resolution';
      this.state.emit('phase_change', 'resolution');
      const collected = this.resources.collectIncome();

      // Log income
      const incomeStr = Object.entries(collected)
        .filter(([_, v]) => v > 0)
        .map(([k, v]) => `${k}: +${v}`)
        .join(', ');
      if (incomeStr) {
        this.state.log(`💰 Income collected: ${incomeStr}`, 'player');
      }

      // 9. Start new player turn
      this.state.phase = 'player';
      this.state.emit('phase_change', 'player');
      this.state.log(`── Turn ${this.state.turn} Start ──`, 'neutral');

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
