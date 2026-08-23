// ─── Fortress AI — Main Entry Point ───────────────────────────
// Initializes all game systems, offensive/defensive AI, and UI overlay

import './styles/main.css';

import { GameState } from './game/GameState.js';
import { ResourceSystem } from './game/ResourceSystem.js';
import { BuildingSystem } from './game/BuildingSystem.js';
import { UnitSystem } from './game/UnitSystem.js';
import { AnimationSystem } from './renderer/AnimationSystem.js';
import { CombatSystem } from './game/CombatSystem.js';
import { TurnManager } from './game/TurnManager.js';
import { EnemyAI } from './ai/EnemyAI.js';
import { DefensiveAI } from './ai/DefensiveAI.js';
import { OffensiveSystem } from './game/OffensiveSystem.js';
import { GameRenderer } from './renderer/GameRenderer.js';
import { HUD } from './ui/HUD.js';

// ─── Initialize Game ───

const canvas = document.getElementById('game-canvas');
if (!canvas) {
  throw new Error('Game canvas not found');
}

// 1. Core game state
const gameState = new GameState();

// 2. Game systems
const resourceSystem = new ResourceSystem(gameState);
const buildingSystem = new BuildingSystem(gameState, resourceSystem);
const unitSystem = new UnitSystem(gameState, resourceSystem);
const combatSystem = new CombatSystem(gameState, buildingSystem, unitSystem);
const enemyAI = new EnemyAI(gameState);
const defensiveAI = new DefensiveAI(gameState);
const offensiveSystem = new OffensiveSystem(gameState, combatSystem, defensiveAI);

// 3. Turn manager (orchestrates the turn loop)
const turnManager = new TurnManager(
  gameState,
  resourceSystem,
  buildingSystem,
  unitSystem,
  combatSystem,
  enemyAI
);

// 4. Renderer (Canvas)
const renderer = new GameRenderer(canvas, gameState, offensiveSystem);

// 5. HUD (DOM overlay)
const hud = new HUD(
  gameState,
  buildingSystem,
  unitSystem,
  renderer,
  turnManager,
  offensiveSystem,
  defensiveAI
);

// 6. Animation system (visual effects for combat)
const animationSystem = new AnimationSystem(renderer, gameState);

// 7. Initialize HUD
hud.init();

// ─── Keyboard Shortcuts ───

document.addEventListener('keydown', (e) => {
  // Escape to deselect / close modals
  if (e.key === 'Escape') {
    gameState.selectedBuilding = null;
    gameState.selectedCell = null;
    renderer.clearPlaceablePositions();
    document.getElementById('attack-planner-modal')?.classList.add('hidden');
    document.getElementById('battle-report-modal')?.classList.add('hidden');
  }

  // Space or Enter to end turn
  if ((e.key === ' ' || e.key === 'Enter') && gameState.phase === 'player' && !gameState.gameResult) {
    if (document.getElementById('attack-planner-modal')?.classList.contains('hidden')) {
      e.preventDefault();
      document.getElementById('end-turn-btn')?.click();
    }
  }

  // 'A' or 'a' key to open Attack Mode
  if ((e.key === 'a' || e.key === 'A') && gameState.phase === 'player' && !gameState.gameResult) {
    document.getElementById('attack-mode-btn')?.click();
  }

  // Number keys for tabs
  if (e.key === '1') document.querySelector('[data-tab="build"]')?.click();
  if (e.key === '2') document.querySelector('[data-tab="defense"]')?.click();
  if (e.key === '3') document.querySelector('[data-tab="units"]')?.click();
  if (e.key === '4') document.querySelector('[data-tab="upgrades"]')?.click();
});

// ─── Prevent context menu on canvas ───
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ─── Log startup ───
console.log('🏰 Fortress AI initialized — Two-Sided Strategic War');
console.log('   Game systems:', {
  gameState: '✅',
  resources: '✅',
  buildings: '✅',
  units: '✅',
  combat: '✅',
  enemyAI: '✅',
  defensiveAI: '✅',
  offensiveSystem: '✅',
  renderer: '✅',
  hud: '✅',
});
