// ─── AI Execution Service ───────────────────────────────────
// Orchestrates: game state → prompt → Swytchcode → OpenAI → response parsing → validation
// This service sits between the game and the LLM

export class AIExecutionService {
  constructor() {
    this._available = false;
    this._checkAvailability();
  }

  async _checkAvailability() {
    try {
      // Check if OpenAI API key is set
      if (process.env.OPENAI_API_KEY && process.env.ENABLE_LLM_AI !== 'false') {
        this._available = true;
      }
    } catch (err) {
      this._available = false;
    }
  }

  isAvailable() {
    return this._available;
  }

  /**
   * Generate a strategy using the LLM
   * @param {Object} gameState - Serialized game state snapshot
   * @returns {Object} Validated strategy object
   */
  async generateStrategy(gameState) {
    if (!this._available) {
      throw new Error('LLM not available');
    }

    const prompt = this._buildPrompt(gameState);

    try {
      // Dynamic import to avoid requiring the module if not available
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: this._getSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error('Empty LLM response');

      const parsed = JSON.parse(text);
      return this._validateStrategy(parsed);
    } catch (err) {
      console.error('LLM execution error:', err.message);
      throw err;
    }
  }

  _getSystemPrompt() {
    return `You are the AI strategist for Fortress AI, a tower defense game. You analyze the player's defenses and choose the optimal attack strategy.

You MUST respond with a JSON object containing:
{
  "strategy": "string - one of: east_wall_breach, west_wall_breach, north_assault, south_assault, resource_raid, tower_suppression, siege_assault, diversionary",
  "target": "string - primary attack direction: north, south, east, or west",
  "unit_mix": {
    "enemy_melee": number 0-1 (percentage of melee units to deploy),
    "enemy_ranged": number 0-1 (percentage of ranged units),
    "enemy_siege": number 0-1 (percentage of siege units)
  },
  "reason": "string - brief explanation of why this strategy was chosen",
  "confidence": number 0-1 (how confident you are in this strategy)
}

Strategy guidelines:
- Target the weakest wall direction (lowest HP percentage)
- If no walls exist on a side, that's maximum vulnerability
- Tower coverage reduces a direction's attractiveness
- Previous failed strategies should be avoided
- Resource raids work when resource buildings are exposed
- Siege units are most effective against walls
- Diversionary attacks split forces to exploit multiple weaknesses`;
  }

  _buildPrompt(state) {
    return `Current game state (Turn ${state.turn}/${state.maxTurns}):

WALLS:
- North: ${state.walls?.north?.hp || 0}/${state.walls?.north?.maxHp || 0} HP (${Math.floor((state.walls?.north?.percentage || 0) * 100)}%)
- South: ${state.walls?.south?.hp || 0}/${state.walls?.south?.maxHp || 0} HP (${Math.floor((state.walls?.south?.percentage || 0) * 100)}%)
- East: ${state.walls?.east?.hp || 0}/${state.walls?.east?.maxHp || 0} HP (${Math.floor((state.walls?.east?.percentage || 0) * 100)}%)
- West: ${state.walls?.west?.hp || 0}/${state.walls?.west?.maxHp || 0} HP (${Math.floor((state.walls?.west?.percentage || 0) * 100)}%)

TOWERS: ${state.towers?.length || 0} active
${state.towers?.map(t => `  - ${t.type} (Lv${t.level}) at [${t.col},${t.row}] HP: ${t.hp}/${t.maxHp}`).join('\n') || '  None'}

PLAYER UNITS: ${state.playerUnits?.length || 0}
${state.playerUnits?.map(u => `  - ${u.type} HP: ${u.hp}`).join('\n') || '  None'}

ENEMY ARMY:
- Melee: ${state.enemyArmy?.enemy_melee || 0}
- Ranged: ${state.enemyArmy?.enemy_ranged || 0}
- Siege: ${state.enemyArmy?.enemy_siege || 0}

PREVIOUS ATTACKS:
${state.aiMemory?.slice(-3).map(m => `  Turn ${m.turn}: ${m.strategyId} → ${m.success ? 'SUCCESS' : 'FAILED'} (${m.buildingsDestroyed} destroyed, ${m.unitsLost} lost)`).join('\n') || '  No previous attacks'}

Choose the optimal attack strategy.`;
  }

  _validateStrategy(parsed) {
    const validStrategies = [
      'east_wall_breach', 'west_wall_breach', 'north_assault', 'south_assault',
      'resource_raid', 'tower_suppression', 'siege_assault', 'diversionary'
    ];

    const validDirections = ['north', 'south', 'east', 'west'];

    const strategy = validStrategies.includes(parsed.strategy)
      ? parsed.strategy
      : 'north_assault';

    const target = validDirections.includes(parsed.target)
      ? parsed.target
      : 'north';

    const unitMix = {
      enemy_melee: Math.max(0, Math.min(1, parsed.unit_mix?.enemy_melee ?? 0.5)),
      enemy_ranged: Math.max(0, Math.min(1, parsed.unit_mix?.enemy_ranged ?? 0.3)),
      enemy_siege: Math.max(0, Math.min(1, parsed.unit_mix?.enemy_siege ?? 0.2)),
    };

    // Normalize unit mix to sum to 1
    const total = unitMix.enemy_melee + unitMix.enemy_ranged + unitMix.enemy_siege;
    if (total > 0) {
      unitMix.enemy_melee /= total;
      unitMix.enemy_ranged /= total;
      unitMix.enemy_siege /= total;
    }

    return {
      id: strategy,
      name: strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      target,
      unitMix,
      reason: parsed.reason || 'Strategic opportunity detected',
      confidence: Math.max(0.1, Math.min(1, parsed.confidence ?? 0.5)),
      targetPriority: [`wall_${target}`, 'archer_tower', 'town_center'],
    };
  }
}
