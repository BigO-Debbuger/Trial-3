// ─── Game Renderer ───────────────────────────────────────
// HTML5 Canvas rendering engine with responsive viewport scaling
// Seamlessly adapts to any screen resolution (1366x768, 1600x900, 1920x1080)
// Supports both Strategic Fortress Map and Fullscreen Enemy Assault Battlefield.

import { GAME_CONFIG } from '../data/balancing.js';
import { BUILDINGS, BUILDING_TYPES, getBuildingColor } from '../data/buildings.js';
import { PLAYER_UNITS, ENEMY_UNITS } from '../data/units.js';
import { SpriteSystem } from './SpriteSystem.js';
import { ParticleSystem } from './ParticleSystem.js';

export class GameRenderer {
  constructor(canvas, gameState, offensiveSystem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = gameState;
    this.offensive = offensiveSystem;
    this.sprites = new SpriteSystem();
    this.particles = new ParticleSystem();

    // Camera & responsive zoom
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    // Selection / hover
    this.hoveredCell = null;
    this.selectedCell = null;
    this.placeablePositions = [];

    // Combat animations & text
    this.combatAnimations = [];
    this.floatingTexts = [];

    // Screen shake
    this.shakeOffset = { x: 0, y: 0 };
    this.shakeIntensity = 0;

    // Setup
    this._resize();
    this._setupEvents();

    this._lastTime = 0;
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  setOffensiveSystem(offensiveSystem) {
    this.offensive = offensiveSystem;
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this._updateResponsiveZoom();
  }

  _updateResponsiveZoom() {
    const isAttackMode = this.state.offensiveState?.isAttackMode;
    const cellSize = GAME_CONFIG.CELL_SIZE;

    if (isAttackMode) {
      // Assault Mode: Focus rows 0-12 and cols 1-18 (80% screen occupancy)
      const availableW = this.canvas.width - 48;
      const availableH = this.canvas.height - 160; // Leave 50px top bar + 95px bottom tray + margins
      const assaultW = 18 * cellSize;
      const assaultH = 13 * cellSize;

      const fitZoom = Math.min(availableW / assaultW, availableH / assaultH);
      this.camera.zoom = Math.max(0.85, Math.min(1.55, fitZoom));
      this.camera.x = 0;
      this.camera.y = -15; // Shift slightly up to center battlefield
    } else {
      // Strategic Mode: Fit full village map (20 cols x 16 rows) cleanly
      const availableW = this.canvas.width - 40;
      const availableH = this.canvas.height - 180; // Leave top bar + bottom build panel
      const mapW = GAME_CONFIG.MAP_COLS * cellSize;
      const mapH = GAME_CONFIG.MAP_ROWS * cellSize;

      const fitZoom = Math.min(availableW / mapW, availableH / mapH);
      this.camera.zoom = Math.max(0.75, Math.min(1.4, fitZoom));
      this.camera.x = 0;
      this.camera.y = 8;
    }
  }

  _setupEvents() {
    window.addEventListener('resize', () => this._resize());

    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
    this.canvas.addEventListener('click', (e) => this._onClick(e));

    // Listen to attack mode changes to re-adjust camera zoom immediately
    this.state.on('attack_mode_started', () => this._updateResponsiveZoom());
    this.state.on('phase_change', () => this._updateResponsiveZoom());
  }

  _onMouseDown(e) {
    if (e.button === 1 || e.button === 2) {
      this.isDragging = true;
      this.dragStart = { x: e.clientX - this.camera.x, y: e.clientY - this.camera.y };
    }
  }

  _onMouseMove(e) {
    if (this.isDragging) {
      this.camera.x = e.clientX - this.dragStart.x;
      this.camera.y = e.clientY - this.dragStart.y;
    }

    const cell = this._screenToCell(e.clientX, e.clientY);
    this.hoveredCell = cell;
    this.state.hoveredCell = cell;
  }

  _onMouseUp(e) {
    this.isDragging = false;
  }

  _onWheel(e) {
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    this.camera.zoom = Math.max(0.6, Math.min(2.0, this.camera.zoom + delta));
  }

  _onClick(e) {
    const cell = this._screenToCell(e.clientX, e.clientY);
    if (!cell) return;

    // 1. Fullscreen Dedicated Assault Mode: Deploy Selected Troop
    if (this.state.offensiveState?.isAttackMode && this.offensive?.activeAssault?.isActive) {
      const worldPos = this._screenToWorld(e.clientX, e.clientY);
      if (cell.row >= 8) {
        const success = this.offensive.deployTroop(worldPos.x, worldPos.y, cell.col, cell.row);
        if (success) {
          const type = this.offensive.activeAssault.selectedTroopType;
          const uDef = PLAYER_UNITS[type];
          this.addFloatingText(cell.col, cell.row, `${uDef.icon} Deployed!`, '#4FC3F7', 16);
          this.particles.emit(worldPos.x, worldPos.y, 'sparks', 8);
        }
      } else {
        this.addFloatingText(cell.col, cell.row, '⚠️ Deploy in green zone below!', '#E74C3C', 14);
      }
      return;
    }

    // 2. Normal Strategic Map Interaction: Select Cell or Building Placement
    this.state.selectedCell = cell;

    // Clicked an enemy structure on strategic map preview
    if (cell.row <= 3 && this.state.enemyBase?.targets) {
      const clickedTarget = this.state.enemyBase.targets.find(
        t => Math.abs(t.col - cell.col) <= 1 && t.row === cell.row
      );
      if (clickedTarget) {
        this.state.offensiveState.selectedTargetId = clickedTarget.id;
        this.state.emit('target_selected', clickedTarget);
        this.addFloatingText(clickedTarget.col, clickedTarget.row, `🎯 ${clickedTarget.name}`, '#FFD700', 16);
      }
    }

    this.state.emit('cell_clicked', cell);
  }

  _screenToCell(screenX, screenY) {
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const col = Math.floor((screenX - offsetX) / cellSize);
    const row = Math.floor((screenY - offsetY) / cellSize);

    if (col >= 0 && col < GAME_CONFIG.MAP_COLS && row >= 0 && row < GAME_CONFIG.MAP_ROWS) {
      return { col, row };
    }
    return null;
  }

  _screenToWorld(screenX, screenY) {
    const cellSize = GAME_CONFIG.CELL_SIZE;
    const zoomCellSize = cellSize * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * zoomCellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * zoomCellSize) / 2;

    const x = (screenX - offsetX) / this.camera.zoom;
    const y = (screenY - offsetY) / this.camera.zoom;
    return { x, y };
  }

  _cellToScreen(col, row) {
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;
    return {
      x: offsetX + col * cellSize + cellSize / 2,
      y: offsetY + row * cellSize + cellSize / 2,
    };
  }

  _worldToScreen(x, y) {
    const cellSize = GAME_CONFIG.CELL_SIZE;
    const zoomCellSize = cellSize * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * zoomCellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * zoomCellSize) / 2;
    return {
      x: offsetX + x * this.camera.zoom,
      y: offsetY + y * this.camera.zoom,
    };
  }

  _animate(timestamp) {
    const dt = Math.min(0.1, (timestamp - this._lastTime) / 1000);
    this._lastTime = timestamp;

    this._update(dt);
    this._render();

    requestAnimationFrame(this._animate);
  }

  _update(dt) {
    // Tick active real-time tactical assault if in attack mode
    if (this.state.offensiveState?.isAttackMode && this.offensive?.activeAssault?.isActive) {
      this.offensive.updateAssault(dt);
    }

    this.particles.update(dt);

    this.floatingTexts = this.floatingTexts.filter(ft => {
      ft.life -= dt;
      ft.y -= 30 * dt;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
      return ft.life > 0;
    });

    this.combatAnimations = this.combatAnimations.filter(anim => {
      anim.progress += dt * 2;
      return anim.progress < 1;
    });

    if (this.shakeIntensity > 0) {
      this.shakeOffset.x = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeOffset.y = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.9;
      if (this.shakeIntensity < 0.5) this.shakeIntensity = 0;
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    const isAttackMode = this.state.offensiveState?.isAttackMode;

    if (isAttackMode) {
      // ═══════════════════════════════════════════════════════
      // FULLSCREEN ENEMY ASSAULT BATTLEFIELD (75%-85% Space)
      // ═══════════════════════════════════════════════════════
      this._renderEnemyAssaultTerrain();
      this._renderEnemyAssaultGrid();
      this._renderEnemyAssaultStructures();
      this._renderPlayerDeploymentZone();
      this._renderLiveAssaultUnits();
      this._renderLiveAssaultProjectiles();
      this._renderParticles();
      this._renderFloatingTexts();
      this._renderDeploymentCursor();
    } else {
      // ═══════════════════════════════════════════════════════
      // STRATEGIC FORTRESS MAP (Normal Village View)
      // ═══════════════════════════════════════════════════════
      this._renderTerrain();
      this._renderGrid();
      this._renderEnemyTerritoryPreview();
      this._renderPlaceableHighlights();
      this._renderBuildings();
      this._renderUnits();
      this._renderCombatAnimations();
      this._renderParticles();
      this._renderFloatingTexts();
      this._renderHoveredCell();
      this._renderSelectedCell();
    }

    ctx.restore();
  }

  // ─── Fullscreen Enemy Assault Rendering ───

  _renderEnemyAssaultTerrain() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    for (let r = 0; r < GAME_CONFIG.MAP_ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.MAP_COLS; c++) {
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;

        if (r <= 5) {
          // Enemy stronghold territory
          ctx.fillStyle = (c + r) % 2 === 0 ? '#1b1114' : '#241518';
          ctx.fillRect(x, y, cellSize, cellSize);

          // Glowing lava cracks
          if ((r === 4 && (c === 6 || c === 13)) || (r === 2 && c === 9)) {
            const pulse = 0.5 + 0.5 * Math.sin(this._lastTime * 0.005);
            ctx.fillStyle = `rgba(255, 69, 0, ${pulse * 0.65})`;
            ctx.fillRect(x + 4, y + 10, cellSize - 8, 4);
          }
        } else if (r === 6 || r === 7) {
          // Outer perimeter barricade & battle approach
          ctx.fillStyle = '#2f2022';
          ctx.fillRect(x, y, cellSize, cellSize);
        } else {
          // Player invasion staging ground
          ctx.fillStyle = (c + r) % 2 === 0 ? '#18261e' : '#1e3025';
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }
  }

  _renderEnemyAssaultGrid() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let r = 0; r <= GAME_CONFIG.MAP_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + r * cellSize);
      ctx.lineTo(offsetX + GAME_CONFIG.MAP_COLS * cellSize, offsetY + r * cellSize);
      ctx.stroke();
    }
    for (let c = 0; c <= GAME_CONFIG.MAP_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * cellSize, offsetY);
      ctx.lineTo(offsetX + c * cellSize, offsetY + GAME_CONFIG.MAP_ROWS * cellSize);
      ctx.stroke();
    }
  }

  _renderEnemyAssaultStructures() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const targets = this.state.getEnemyTargets();

    for (const target of targets) {
      const x = offsetX + target.col * cellSize;
      const y = offsetY + target.row * cellSize;

      this.sprites.drawEnemyStructure(ctx, x, y, cellSize, target.id, target.status, this._lastTime);

      // Structure HP Bar & Title
      if (target.status !== 'destroyed') {
        const hpPercent = Math.max(0, target.hp / target.maxHp);
        const barW = cellSize * 1.1;
        const barH = 6;
        const barX = x + (cellSize - barW) / 2;
        const barY = y - 10;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(barX, barY, barW, barH);

        const hpColor = hpPercent > 0.6 ? '#2ecc71' : hpPercent > 0.3 ? '#f39c12' : '#e74c3c';
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpPercent, barH);

        ctx.fillStyle = target.badgeColor || '#FFF';
        ctx.font = `bold ${Math.floor(cellSize * 0.24)}px Rajdhani`;
        ctx.textAlign = 'center';
        ctx.fillText(target.name, x + cellSize / 2, y - 14);
      } else {
        ctx.fillStyle = '#999';
        ctx.font = `bold ${Math.floor(cellSize * 0.22)}px Rajdhani`;
        ctx.textAlign = 'center';
        ctx.fillText('💥 RUINS', x + cellSize / 2, y + cellSize + 12);
      }
    }
  }

  _renderPlayerDeploymentZone() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const pulse = 0.65 + 0.35 * Math.sin(this._lastTime * 0.005);
    ctx.save();
    ctx.strokeStyle = `rgba(46, 204, 113, ${pulse * 0.85})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]);
    ctx.strokeRect(
      offsetX + 1 * cellSize,
      offsetY + 8 * cellSize,
      18 * cellSize,
      6.5 * cellSize
    );
    ctx.setLineDash([]);

    ctx.fillStyle = `rgba(46, 204, 113, 0.04)`;
    ctx.fillRect(
      offsetX + 1 * cellSize,
      offsetY + 8 * cellSize,
      18 * cellSize,
      6.5 * cellSize
    );

    ctx.font = `bold ${Math.floor(cellSize * 0.25)}px Orbitron`;
    ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
    ctx.textAlign = 'center';
    ctx.fillText('▼ PLAYER DEPLOYMENT ZONE — CLICK TO DROP TROOPS ▼', offsetX + 10 * cellSize, offsetY + 8.4 * cellSize);
    ctx.restore();
  }

  _renderLiveAssaultUnits() {
    if (!this.offensive?.activeAssault?.isActive) return;

    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE;
    const assault = this.offensive.activeAssault;

    // 1. Invading Player Units
    for (const unit of assault.deployedUnits) {
      if (unit.isDead) continue;
      const screen = this._worldToScreen(unit.x, unit.y);
      const drawSize = cellSize * this.camera.zoom;

      this.sprites.drawUnit(ctx, screen.x - drawSize / 2, screen.y - drawSize / 2, drawSize, unit.color, unit.icon, false);

      const hpPct = unit.hp / unit.maxHp;
      const bw = drawSize * 0.65;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(screen.x - bw / 2, screen.y - drawSize / 2 - 5, bw, 3.5);
      ctx.fillStyle = hpPct > 0.5 ? '#4FC3F7' : '#FF7043';
      ctx.fillRect(screen.x - bw / 2, screen.y - drawSize / 2 - 5, bw * hpPct, 3.5);
    }

    // 2. Enemy Defenders
    for (const def of assault.enemyDefenders) {
      if (def.isDead) continue;
      const screen = this._worldToScreen(def.x, def.y);
      const drawSize = cellSize * this.camera.zoom;

      this.sprites.drawUnit(ctx, screen.x - drawSize / 2, screen.y - drawSize / 2, drawSize, def.color, def.icon, true);

      const hpPct = def.hp / def.maxHp;
      const bw = drawSize * 0.65;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(screen.x - bw / 2, screen.y - drawSize / 2 - 5, bw, 3.5);
      ctx.fillStyle = '#EF5350';
      ctx.fillRect(screen.x - bw / 2, screen.y - drawSize / 2 - 5, bw * hpPct, 3.5);
    }
  }

  _renderLiveAssaultProjectiles() {
    if (!this.offensive?.activeAssault?.isActive) return;

    const ctx = this.ctx;
    const projectiles = this.offensive.activeAssault.projectiles;

    for (const p of projectiles) {
      const fromScreen = this._worldToScreen(p.fromX, p.fromY);
      const toScreen = this._worldToScreen(p.toX, p.toY);
      const t = p.progress;

      const x = fromScreen.x + (toScreen.x - fromScreen.x) * t;
      const arcHeight = p.type === 'boulder' ? 45 : 20;
      const y = fromScreen.y + (toScreen.y - fromScreen.y) * t - Math.sin(t * Math.PI) * arcHeight;

      if (p.type === 'arrow') {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromScreen.x + (toScreen.x - fromScreen.x) * Math.max(0, t - 0.2), fromScreen.y + (toScreen.y - fromScreen.y) * Math.max(0, t - 0.2));
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (p.type === 'boulder') {
        ctx.fillStyle = '#FF5722';
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 87, 34, 0.4)';
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'cannonball') {
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _renderDeploymentCursor() {
    if (!this.hoveredCell || this.hoveredCell.row < 8) return;

    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const x = offsetX + this.hoveredCell.col * cellSize;
    const y = offsetY + this.hoveredCell.row * cellSize;

    const type = this.offensive?.activeAssault?.selectedTroopType || 'warrior';
    const uDef = PLAYER_UNITS[type];

    const pulse = 0.7 + 0.3 * Math.sin(this._lastTime * 0.008);
    ctx.save();
    ctx.strokeStyle = `rgba(46, 204, 113, ${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

    ctx.fillStyle = `rgba(46, 204, 113, 0.18)`;
    ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    ctx.font = `${Math.floor(cellSize * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(uDef?.icon || '⚔️', x + cellSize / 2, y + cellSize * 0.65);
    ctx.restore();
  }

  // ─── Normal Strategic Map Rendering ───

  _renderTerrain() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    for (let r = 0; r < GAME_CONFIG.MAP_ROWS; r++) {
      for (let c = 0; c < GAME_CONFIG.MAP_COLS; c++) {
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;
        const terrain = this.state.terrain[r]?.[c];
        if (!terrain) continue;

        if (r <= 3) {
          ctx.fillStyle = (c + r) % 2 === 0 ? '#1f1315' : '#29181b';
        } else {
          switch (terrain.type) {
            case 'grass':
              ctx.fillStyle = terrain.decoration % 3 === 0 ? '#2d5e35' : terrain.decoration % 3 === 1 ? '#336b3d' : '#275530';
              break;
            case 'road':
              ctx.fillStyle = '#5a5040';
              break;
            case 'water':
              ctx.fillStyle = '#2a5a8c';
              break;
            case 'trees':
              ctx.fillStyle = '#1a4a24';
              break;
            case 'rocks':
              ctx.fillStyle = '#404048';
              break;
            default:
              ctx.fillStyle = '#2d5e35';
          }
        }

        ctx.fillRect(x, y, cellSize, cellSize);

        if (r > 3) {
          if (terrain.type === 'trees') {
            this.sprites.drawTree(ctx, x, y, cellSize);
          } else if (terrain.type === 'rocks') {
            this.sprites.drawRock(ctx, x, y, cellSize);
          } else if (terrain.type === 'water') {
            this.sprites.drawWater(ctx, x, y, cellSize, this._lastTime);
          }

          if (this.state._isVillageArea(c, r)) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }
      }
    }
  }

  _renderGrid() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    for (let r = 0; r <= GAME_CONFIG.MAP_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + r * cellSize);
      ctx.lineTo(offsetX + GAME_CONFIG.MAP_COLS * cellSize, offsetY + r * cellSize);
      ctx.stroke();
    }
    for (let c = 0; c <= GAME_CONFIG.MAP_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + c * cellSize, offsetY);
      ctx.lineTo(offsetX + c * cellSize, offsetY + GAME_CONFIG.MAP_ROWS * cellSize);
      ctx.stroke();
    }

    // Village bounds
    const vb = GAME_CONFIG.VILLAGE_BOUNDS;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      offsetX + vb.minCol * cellSize,
      offsetY + vb.minRow * cellSize,
      (vb.maxCol - vb.minCol + 1) * cellSize,
      (vb.maxRow - vb.minRow + 1) * cellSize
    );

    // Enemy preview boundary
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(
      offsetX + 2 * cellSize,
      offsetY + 0.5 * cellSize,
      16 * cellSize,
      3.5 * cellSize
    );
    ctx.setLineDash([]);
  }

  _renderEnemyTerritoryPreview() {
    if (!this.state.enemyBase?.targets) return;

    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    ctx.font = `bold ${Math.floor(cellSize * 0.28)}px Orbitron`;
    ctx.fillStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('⚔ ENEMY EMPIRE DOMAIN', offsetX + 2 * cellSize, offsetY + 0.35 * cellSize);

    for (const target of this.state.enemyBase.targets) {
      const x = offsetX + target.col * cellSize;
      const y = offsetY + target.row * cellSize;
      this.sprites.drawEnemyStructure(ctx, x, y, cellSize, target.id, target.status, this._lastTime);
    }
  }

  _renderPlaceableHighlights() {
    if (this.placeablePositions.length === 0) return;

    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const pulse = 0.35 + 0.25 * Math.sin(this._lastTime * 0.004);

    for (const pos of this.placeablePositions) {
      const x = offsetX + pos.col * cellSize;
      const y = offsetY + pos.row * cellSize;
      ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
      ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      ctx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
    }
  }

  _renderBuildings() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    for (const building of this.state.buildings) {
      const x = offsetX + building.col * cellSize;
      const y = offsetY + building.row * cellSize;
      const color = getBuildingColor(building.type);

      if (building.constructing) {
        this.sprites.drawConstructionSite(ctx, x, y, cellSize, this._lastTime);
      } else {
        this.sprites.drawBuilding(ctx, x, y, cellSize, building.type, building.level, color);
      }

      if (building.hp < building.maxHp && !building.constructing) {
        const hpPercent = building.hp / building.maxHp;
        const barWidth = cellSize * 0.8;
        const barHeight = 4;
        const barX = x + (cellSize - barWidth) / 2;
        const barY = y - 6;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpColor = hpPercent > 0.6 ? '#2ecc71' : hpPercent > 0.3 ? '#f39c12' : '#e74c3c';
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
      }

      if (building.constructing) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${Math.floor(cellSize * 0.25)}px Rajdhani`;
        ctx.textAlign = 'center';
        ctx.fillText(`${building.turnsLeft}T`, x + cellSize / 2, y + cellSize + 12);
      }
    }
  }

  _renderUnits() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    for (const unit of this.state.playerUnits) {
      const x = offsetX + unit.col * cellSize;
      const y = offsetY + unit.row * cellSize;
      const unitDef = PLAYER_UNITS[unit.type];
      if (!unitDef) continue;

      this.sprites.drawUnit(ctx, x, y, cellSize, unitDef.color, unitDef.icon, false);
    }
  }

  _renderCombatAnimations() {
    const ctx = this.ctx;

    for (const anim of this.combatAnimations) {
      const fromScreen = this._cellToScreen(anim.from.col, anim.from.row);
      const toScreen = this._cellToScreen(anim.to.col, anim.to.row);
      const t = anim.progress;

      const x = fromScreen.x + (toScreen.x - fromScreen.x) * t;
      const y = fromScreen.y + (toScreen.y - fromScreen.y) * t - Math.sin(t * Math.PI) * 40;

      if (anim.type === 'arrow') {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (anim.type === 'cannonball' || anim.type === 'boulder') {
        ctx.fillStyle = '#FF6B35';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _renderParticles() {
    this.particles.render(this.ctx);
  }

  _renderFloatingTexts() {
    const ctx = this.ctx;

    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = `bold ${ft.size}px Rajdhani`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 5;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  _renderHoveredCell() {
    if (!this.hoveredCell) return;

    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const x = offsetX + this.hoveredCell.col * cellSize;
    const y = offsetY + this.hoveredCell.row * cellSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
  }

  _renderSelectedCell() {
    if (!this.state.selectedCell) return;

    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const x = offsetX + this.state.selectedCell.col * cellSize;
    const y = offsetY + this.state.selectedCell.row * cellSize;

    const pulse = 0.6 + 0.4 * Math.sin(this._lastTime * 0.004);
    ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
  }

  // ─── Public Helpers ───

  addFloatingText(col, row, text, color = '#fff', size = 18) {
    const screen = this._cellToScreen(col, row);
    this.floatingTexts.push({
      x: screen.x,
      y: screen.y,
      text,
      color,
      size,
      alpha: 1,
      life: 1.6,
      maxLife: 1.6,
    });
  }

  addCombatAnimation(from, to, type) {
    this.combatAnimations.push({
      from,
      to,
      type,
      progress: 0,
    });
  }

  shake(intensity = 10) {
    this.shakeIntensity = intensity;
  }

  setPlaceablePositions(positions) {
    this.placeablePositions = positions;
  }

  clearPlaceablePositions() {
    this.placeablePositions = [];
  }
}
