// ─── Fortress AI — Express Server ───────────────────────────
// Backend for Swytchcode + OpenAI AI strategy execution
// Falls back to deterministic AI if unavailable

import express from 'express';
import cors from 'cors';
import { AIExecutionService } from './ai/AIExecutionService.js';
import { FallbackAI } from './ai/FallbackAI.js';

const app = express();
const PORT = process.env.PORT || 3001;

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
    llmAvailable: aiService.isAvailable(),
    mode: aiService.isAvailable() ? 'llm' : 'deterministic',
  });
});

/**
 * AI Strategy endpoint
 * Receives game state, returns structured strategy decision
 */
app.post('/api/ai/strategy', async (req, res) => {
  const { gameState, turnNumber } = req.body;

  if (!gameState) {
    return res.status(400).json({ error: 'Missing gameState' });
  }

  try {
    let strategy;
    let source = 'deterministic';

    // Try LLM-powered strategy first
    if (aiService.isAvailable()) {
      try {
        strategy = await aiService.generateStrategy(gameState);
        source = 'llm';
      } catch (err) {
        console.warn('LLM strategy failed, falling back:', err.message);
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

// ─── Start Server ───

app.listen(PORT, () => {
  console.log(`🏰 Fortress AI Server running on http://localhost:${PORT}`);
  console.log(`   LLM Mode: ${aiService.isAvailable() ? '✅ Available' : '❌ Unavailable (using deterministic AI)'}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
