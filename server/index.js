// ─── Fortress AI — Express Server ───────────────────────────
// Backend for Swytchcode + OpenAI AI strategy execution
// Falls back to deterministic AI if unavailable

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { AIExecutionService } from './ai/AIExecutionService.js';
import { FallbackAI } from './ai/FallbackAI.js';

export function createServerApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Services
  const aiService = new AIExecutionService();
  const fallbackAI = new FallbackAI();

  // ─── Routes ───

  /**
   * Health check
   */
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      swytchcodeAvailable: aiService.isAvailable(),
      mode: aiService.isAvailable() ? 'swytchcode' : 'deterministic',
    });
  });

  /**
   * AI Strategy endpoint (PS1 Offensive loop)
   */
  app.post('/api/ai/strategy', async (req, res) => {
    const { gameState, turnNumber } = req.body;

    if (!gameState) {
      return res.status(400).json({ error: 'Missing gameState' });
    }

    try {
      let strategy;
      let source = 'deterministic';

      if (aiService.isAvailable()) {
        try {
          strategy = await aiService.generateStrategy(gameState);
          source = 'swytchcode';
        } catch (err) {
          console.warn('[SWYTCHCODE] Strategy failed, falling back:', err.message);
          strategy = fallbackAI.generateStrategy(gameState);
        }
      } else {
        strategy = fallbackAI.generateStrategy(gameState);
      }

      res.json({
        strategy,
        source,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Strategy generation error:', err);
      res.status(500).json({
        error: 'Failed to generate strategy',
        strategy: fallbackAI.generateStrategy(gameState || {}),
        source: 'fallback',
      });
    }
  });

  /**
   * PS2 AI Defense endpoint (Player invasion countermeasure)
   */
  app.post('/api/ai/defend', async (req, res) => {
    const { attackContext, gameState } = req.body;

    if (!attackContext) {
      return res.status(400).json({ error: 'Missing attackContext' });
    }

    try {
      let defenseDecision;
      let source = 'deterministic';

      if (aiService.isAvailable()) {
        try {
          defenseDecision = await aiService.generateDefensiveStrategy(attackContext);
          source = 'swytchcode';
        } catch (err) {
          console.warn('[SWYTCHCODE] Defensive strategy failed, falling back:', err.message);
          defenseDecision = fallbackAI.generateDefensiveStrategy(attackContext);
        }
      } else {
        defenseDecision = fallbackAI.generateDefensiveStrategy(attackContext);
      }

      res.json({
        defenseDecision,
        source,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Defensive strategy error:', err);
      res.status(500).json({
        error: 'Failed to generate defensive strategy',
        defenseDecision: fallbackAI.generateDefensiveStrategy(attackContext || {}),
        source: 'fallback',
      });
    }
  });

  /**
   * Swytchcode Sandbox Target Handler for OpenAI Responses API (openai.responsesbetatrue.create)
   */
  app.post(['/responses', '//responses', '/v1/responses'], async (req, res) => {
    const { model, instructions, input } = req.body || {};

    const isDefense = /defense|defensive|assault|HOLD|REINFORCE|COUNTERATTACK|invasion/i.test(String(instructions) + ' ' + JSON.stringify(input));
    let content;
    if (isDefense) {
      content = JSON.stringify({
        strategy: 'COUNTERATTACK',
        defenders: { enemy_melee: 4, enemy_ranged: 2, enemy_siege: 0 },
        reason: 'Swytchcode AI deployed counter-strike against player vanguard',
        confidence: 0.92,
      });
    } else {
      content = JSON.stringify({
        strategy: 'north_assault',
        target: 'north',
        unit_mix: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 },
        reason: 'North sector perimeter detected as primary target vector via Swytchcode',
        confidence: 0.88,
      });
    }

    const response = {
      id: 'resp_' + Date.now(),
      object: 'response',
      status: 'completed',
      created_at: Math.floor(Date.now() / 1000),
      model: model || 'gpt-4o-mini',
      instructions: instructions || '',
      parallel_tool_calls: false,
      error: null,
      incomplete_details: null,
      output: [
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: content,
            },
          ],
        },
      ],
      text: content,
    };

    res.json(response);
  });

  return { app, aiService, fallbackAI };
}

// ─── Start Standalone Server if run directly ───
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const PORT = process.env.PORT || 3001;
  const { app, aiService } = createServerApp();
  app.listen(PORT, () => {
    console.log(`🏰 Fortress AI Server running on http://localhost:${PORT}`);
    console.log(`   Swytchcode Mode: ${aiService.isAvailable() ? '✅ Available' : '❌ Unavailable (using deterministic AI)'}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
  });
}
