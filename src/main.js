// ─── Fortress AI — Main Entry Point ───────────────────────────
// Initializes all game systems and wires them together

import './styles/main.css';

import { GameState } from './game/GameState.js';
import { ResourceSystem } from './game/ResourceSystem.js';
import { BuildingSystem } from './game/BuildingSystem.js';
import { UnitSystem } from './game/UnitSystem.js';
import { AnimationSystem } from './renderer/AnimationSystem.js';
import { CombatSystem } from './game/CombatSystem.js';
import { TurnManager } from './game/TurnManager.js';
import { EnemyAI } from './ai/EnemyAI.js';
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
const renderer = new GameRenderer(canvas, gameState);

// 5. HUD (DOM overlay)
const hud = new HUD(gameState, buildingSystem, unitSystem, renderer, turnManager);

// 6. Animation system (visual effects for combat)
const animationSystem = new AnimationSystem(renderer, gameState);

// 7. Initialize HUD (renders build cards + welcome messages)
hud.init();

// ─── Keyboard Shortcuts ───

document.addEventListener('keydown', (e) => {
  // Escape to deselect
  if (e.key === 'Escape') {
    gameState.selectedBuilding = null;
    gameState.selectedCell = null;
    renderer.clearPlaceablePositions();
  }

  // Space or Enter to end turn
  if ((e.key === ' ' || e.key === 'Enter') && gameState.phase === 'player' && !gameState.gameResult) {
    e.preventDefault();
    document.getElementById('end-turn-btn')?.click();
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
console.log('🏰 Fortress AI initialized');
console.log('   Turn-based adaptive strategy defense');
console.log('   Game systems:', {
  gameState: '✅',
  resources: '✅',
  buildings: '✅',
  units: '✅',
  combat: '✅',
  ai: '✅',
  renderer: '✅',
  hud: '✅',
});
