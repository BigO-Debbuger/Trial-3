// ─── AI Execution Service ───────────────────────────────────
// Controlled execution pipeline:
// Game State / Attack Context → Prompt Formulation → SwytchcodeAIAdapter
// → Swytchcode Kernel (vibewright.openai@1.0.0, openai.responsesbetatrue.create)
// → Schema Validation & Clamping → Deterministic Game Engine

import { SwytchcodeAIAdapter } from '../swytchcode/SwytchcodeAIAdapter.js';
import { FallbackAI } from './FallbackAI.js';

export class AIExecutionService {
  constructor() {
    this.swytchcodeAdapter = new SwytchcodeAIAdapter();
    this.fallbackAI = new FallbackAI();
    this._available = true;
  }

  isAvailable() {
    return this._available;
  }

  /**
   * Generate an offensive strategy using Swytchcode integration
   * @param {Object} gameState - Serialized game state snapshot
   * @returns {Promise<Object>} Validated strategy object
   */
  async generateStrategy(gameState) {
    const instructions = this._getSystemPrompt();
    const input = this._buildPrompt(gameState);

    try {
      const parsed = await this.swytchcodeAdapter.executeModelResponse(instructions, input, {
        model: 'gpt-4o-mini',
      });

      return this._validateStrategy(parsed);
    } catch (err) {
      console.warn('[SWYTCHCODE] Strategy execution fell back to deterministic scoring:', err.message);
      return this.fallbackAI.generateStrategy(gameState);
    }
  }

  /**
   * Generate an AI defensive doctrine response to a player attack using Swytchcode
   * @param {Object} attackContext - Information about incoming player assault
   * @returns {Promise<Object>} Validated defensive strategy
   */
  async generateDefensiveStrategy(attackContext) {
    const instructions = this._getDefensiveSystemPrompt();
    const input = this._buildDefensivePrompt(attackContext);

    try {
      const parsed = await this.swytchcodeAdapter.executeModelResponse(instructions, input, {
        model: 'gpt-4o-mini',
      });

      return this._validateDefensiveStrategy(parsed, attackContext);
    } catch (err) {
      console.warn('[SWYTCHCODE] Defense execution fell back to deterministic doctrine:', err.message);
      return this.fallbackAI.generateDefensiveStrategy(attackContext);
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
    return `Current game state (Turn ${state.turn || 1}/${state.maxTurns || 20}):

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
    if (!parsed || typeof parsed !== 'object') {
      return this.fallbackAI.generateStrategy({});
    }

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
      enemy_melee: Math.max(0, Math.min(1, Number(parsed.unit_mix?.enemy_melee ?? 0.5))),
      enemy_ranged: Math.max(0, Math.min(1, Number(parsed.unit_mix?.enemy_ranged ?? 0.3))),
      enemy_siege: Math.max(0, Math.min(1, Number(parsed.unit_mix?.enemy_siege ?? 0.2))),
    };

    // Normalize unit mix to sum to 1
    const total = unitMix.enemy_melee + unitMix.enemy_ranged + unitMix.enemy_siege;
    if (total > 0) {
      unitMix.enemy_melee /= total;
      unitMix.enemy_ranged /= total;
      unitMix.enemy_siege /= total;
    } else {
      unitMix.enemy_melee = 0.5;
      unitMix.enemy_ranged = 0.3;
      unitMix.enemy_siege = 0.2;
    }

    return {
      id: strategy,
      name: strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      target,
      unitMix,
      reason: parsed.reason || 'Strategic opportunity detected through Swytchcode analysis',
      confidence: Math.max(0.1, Math.min(1, Number(parsed.confidence ?? 0.85))),
      targetPriority: [`wall_${target}`, 'archer_tower', 'town_center'],
    };
  }

  _getDefensiveSystemPrompt() {
    return `You are the Supreme Commander defending the Enemy Empire in Fortress AI against a player invasion.
Analyze the player's incoming attacking units, target location, and deployment routes, and choose the optimal defensive response.

You MUST respond with a JSON object:
{
  "strategy": "HOLD | REINFORCE | COUNTERATTACK | REDIRECT",
  "defenders": {
    "enemy_melee": number (1-6),
    "enemy_ranged": number (1-5),
    "enemy_siege": number (0-2)
  },
  "reason": "string - concise tactical explanation of your defense under 15 words",
  "confidence": number 0-1
}

Tactical Guidelines:
- HOLD: Maximize structural defense (+35% building defense) when fortified behind walls or against low-siege assaults.
- REINFORCE: Rush emergency garrison defenders to threatened high-value assets (Stronghold, Gold Quarry).
- COUNTERATTACK: Deploy shock melee units with high counter damage (+75% counter damage) to destroy vulnerable siege rams or archers.
- REDIRECT: Shift perimeter marksmen to establish crossfire choke points along routes.`;
  }

  _buildDefensivePrompt(ctx) {
    return `INCOMING PLAYER ASSAULT:
Target: ${ctx.target?.name || 'Empire Structure'} (${ctx.target?.id}) - HP: ${ctx.target?.hp}/${ctx.target?.maxHp}
Assault Power: ${ctx.totalArmyPower || 0} (Siege Power: ${ctx.siegePower || 0})
Player Attack Force:
- Warriors: ${ctx.attackForce?.warrior || 0}
- Archers: ${ctx.attackForce?.archer || 0}
- Defenders: ${ctx.attackForce?.defender || 0}
- Siege Rams: ${ctx.attackForce?.siege || 0}

Routes Deployed:
- North: ${JSON.stringify(ctx.routes?.north || {})}
- Center: ${JSON.stringify(ctx.routes?.center || {})}
- South: ${JSON.stringify(ctx.routes?.south || {})}

Available Garrison: ${JSON.stringify(ctx.enemyGarrison || {})}

Select the optimal defensive doctrine.`;
  }

  _validateDefensiveStrategy(parsed, ctx) {
    if (!parsed || typeof parsed !== 'object') {
      return this.fallbackAI.generateDefensiveStrategy(ctx);
    }

    const validStrategies = ['HOLD', 'REINFORCE', 'COUNTERATTACK', 'REDIRECT'];
    const strategy = validStrategies.includes(parsed.strategy) ? parsed.strategy : 'REINFORCE';

    const defenders = {
      enemy_melee: Math.max(1, Math.min(6, Math.round(Number(parsed.defenders?.enemy_melee ?? 3)))),
      enemy_ranged: Math.max(1, Math.min(5, Math.round(Number(parsed.defenders?.enemy_ranged ?? 2)))),
      enemy_siege: Math.max(0, Math.min(2, Math.round(Number(parsed.defenders?.enemy_siege ?? 0)))),
    };

    const strategyNames = {
      HOLD: 'Fortify & Hold Position',
      REINFORCE: 'Emergency Garrison Reinforcement',
      COUNTERATTACK: 'Flanking Counter-Strike',
      REDIRECT: 'Strategic Sector Redirection',
    };

    return {
      strategy,
      strategyName: strategyNames[strategy],
      defenders,
      reason: parsed.reason || 'Calculated optimal defensive formation for sector defense via Swytchcode.',
      confidence: Math.max(0.3, Math.min(0.98, Number(parsed.confidence ?? 0.85))),
    };
  }
}
