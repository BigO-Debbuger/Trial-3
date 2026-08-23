// ─── Game Renderer ───────────────────────────────────────
// HTML5 Canvas rendering engine with layered rendering

import { GAME_CONFIG } from '../data/balancing.js';
import { BUILDINGS, BUILDING_TYPES, getBuildingColor } from '../data/buildings.js';
import { PLAYER_UNITS, ENEMY_UNITS } from '../data/units.js';
import { SpriteSystem } from './SpriteSystem.js';
import { ParticleSystem } from './ParticleSystem.js';

export class GameRenderer {
  constructor(canvas, gameState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = gameState;
    this.sprites = new SpriteSystem();
    this.particles = new ParticleSystem();

    // Camera
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    // Selection / hover
    this.hoveredCell = null;
    this.selectedCell = null;
    this.placeablePositions = [];

    // Combat animations queue
    this.combatAnimations = [];
    this.floatingTexts = [];

    // Screen shake
    this.shakeOffset = { x: 0, y: 0 };
    this.shakeIntensity = 0;

    // Setup
    this._resize();
    this._setupEvents();

    // Start render loop
    this._lastTime = 0;
    this._animate = this._animate.bind(this);
    requestAnimationFrame(this._animate);
  }

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _setupEvents() {
    window.addEventListener('resize', () => this._resize());

    // Mouse events for camera and selection
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e));
    this.canvas.addEventListener('click', (e) => this._onClick(e));
  }

  // ─── Event Handlers ───

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

    // Update hovered cell
    const cell = this._screenToCell(e.clientX, e.clientY);
    this.hoveredCell = cell;
    this.state.hoveredCell = cell;
  }

  _onMouseUp(e) {
    this.isDragging = false;
  }

  _onWheel(e) {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.camera.zoom = Math.max(0.5, Math.min(2, this.camera.zoom + delta));
  }

  _onClick(e) {
    const cell = this._screenToCell(e.clientX, e.clientY);
    if (cell) {
      this.state.selectedCell = cell;
      this.state.emit('cell_clicked', cell);
    }
  }

  /**
   * Convert screen coordinates to grid cell
   */
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

  /**
   * Convert grid cell to screen coordinates (center of cell)
   */
  _cellToScreen(col, row) {
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;
    return {
      x: offsetX + col * cellSize + cellSize / 2,
      y: offsetY + row * cellSize + cellSize / 2,
    };
  }

  // ─── Animation Loop ───

  _animate(timestamp) {
    const dt = (timestamp - this._lastTime) / 1000;
    this._lastTime = timestamp;

    this._update(dt);
    this._render();

    requestAnimationFrame(this._animate);
  }

  _update(dt) {
    // Update particles
    this.particles.update(dt);

    // Update floating texts
    this.floatingTexts = this.floatingTexts.filter(ft => {
      ft.life -= dt;
      ft.y -= 30 * dt;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
      return ft.life > 0;
    });

    // Update combat animations
    this.combatAnimations = this.combatAnimations.filter(anim => {
      anim.progress += dt * 2;
      return anim.progress < 1;
    });

    // Screen shake decay
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

    // Clear
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    // Render layers
    this._renderTerrain();
    this._renderGrid();
    this._renderPlaceableHighlights();
    this._renderBuildings();
    this._renderUnits();
    this._renderCombatAnimations();
    this._renderParticles();
    this._renderFloatingTexts();
    this._renderHoveredCell();
    this._renderSelectedCell();

    ctx.restore();
  }

  // ─── Render Layers ───

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

        // Base terrain color
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

        ctx.fillRect(x, y, cellSize, cellSize);

        // Terrain decorations
        if (terrain.type === 'trees') {
          this.sprites.drawTree(ctx, x, y, cellSize);
        } else if (terrain.type === 'rocks') {
          this.sprites.drawRock(ctx, x, y, cellSize);
        } else if (terrain.type === 'water') {
          this.sprites.drawWater(ctx, x, y, cellSize, this._lastTime);
        }

        // Village area highlight
        if (this.state._isVillageArea(c, r)) {
          ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }
  }

  _renderGrid() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
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

    // Village bounds outline
    const vb = GAME_CONFIG.VILLAGE_BOUNDS;
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      offsetX + vb.minCol * cellSize,
      offsetY + vb.minRow * cellSize,
      (vb.maxCol - vb.minCol + 1) * cellSize,
      (vb.maxRow - vb.minRow + 1) * cellSize
    );
    ctx.setLineDash([]);
  }

  _renderPlaceableHighlights() {
    if (this.placeablePositions.length === 0) return;

    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    const pulse = 0.3 + 0.2 * Math.sin(this._lastTime * 0.003);

    for (const pos of this.placeablePositions) {
      const x = offsetX + pos.col * cellSize;
      const y = offsetY + pos.row * cellSize;
      ctx.fillStyle = `rgba(46, 204, 113, ${pulse})`;
      ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
      ctx.strokeStyle = 'rgba(46, 204, 113, 0.6)';
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

      // Draw building sprite
      if (building.constructing) {
        this.sprites.drawConstructionSite(ctx, x, y, cellSize, this._lastTime);
      } else {
        this.sprites.drawBuilding(ctx, x, y, cellSize, building.type, building.level, color);
      }

      // HP bar
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

      // Construction progress
      if (building.constructing) {
        const buildDef = BUILDINGS[building.type].levels[building.level - 1];
        const totalTime = buildDef.buildTime;
        const progress = 1 - (building.turnsLeft / totalTime);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${Math.floor(cellSize * 0.25)}px Rajdhani`;
        ctx.textAlign = 'center';
        ctx.fillText(`${building.turnsLeft}T`, x + cellSize / 2, y + cellSize + 12);
      }

      // Level indicator
      if (!building.constructing && building.level > 1) {
        const starSize = cellSize * 0.12;
        for (let i = 0; i < building.level; i++) {
          ctx.fillStyle = '#FFD700';
          ctx.font = `${Math.floor(starSize + 4)}px sans-serif`;
          ctx.fillText('★', x + 4 + i * (starSize + 2), y + cellSize - 4);
        }
      }
    }
  }

  _renderUnits() {
    const ctx = this.ctx;
    const cellSize = GAME_CONFIG.CELL_SIZE * this.camera.zoom;
    const offsetX = this.camera.x + (this.canvas.width - GAME_CONFIG.MAP_COLS * cellSize) / 2;
    const offsetY = this.camera.y + (this.canvas.height - GAME_CONFIG.MAP_ROWS * cellSize) / 2;

    // Player units
    for (const unit of this.state.playerUnits) {
      const x = offsetX + unit.col * cellSize;
      const y = offsetY + unit.row * cellSize;
      const unitDef = PLAYER_UNITS[unit.type];
      if (!unitDef) continue;

      this.sprites.drawUnit(ctx, x, y, cellSize, unitDef.color, unitDef.icon, false);

      // HP bar
      if (unit.hp < unit.maxHp) {
        const hpPercent = unit.hp / unit.maxHp;
        const barWidth = cellSize * 0.6;
        const barHeight = 3;
        const barX = x + (cellSize - barWidth) / 2;
        const barY = y - 4;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = hpPercent > 0.5 ? '#4FC3F7' : '#FF7043';
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);
      }
    }

    // Enemy units during combat (visualized at spawn zones)
    if (this.state.phase === 'ai_attacking' || this.state.phase === 'combat') {
      const strategy = this.state.lastAIStrategy;
      if (strategy) {
        const dir = strategy.target || 'north';
        const spawn = GAME_CONFIG.ENEMY_SPAWN[dir];
        if (spawn) {
          let idx = 0;
          for (const [type, count] of Object.entries(this.state.enemyArmy)) {
            const unitDef = ENEMY_UNITS[type];
            if (!unitDef || count <= 0) continue;

            const displayCount = Math.min(count, 5);
            for (let i = 0; i < displayCount; i++) {
              let col, row;
              if (spawn.row !== undefined) {
                col = (spawn.colRange[0] + idx) % (spawn.colRange[1] + 1);
                row = spawn.row;
              } else {
                col = spawn.col;
                row = (spawn.rowRange[0] + idx) % (spawn.rowRange[1] + 1);
              }

              const x = offsetX + col * cellSize;
              const y = offsetY + row * cellSize;
              this.sprites.drawUnit(ctx, x, y, cellSize, unitDef.color, unitDef.icon, true);
              idx++;
            }
          }
        }
      }
    }
  }

  _renderCombatAnimations() {
    const ctx = this.ctx;

    for (const anim of this.combatAnimations) {
      const fromScreen = this._cellToScreen(anim.from.col, anim.from.row);
      const toScreen = this._cellToScreen(anim.to.col, anim.to.row);
      const t = anim.progress;

      const x = fromScreen.x + (toScreen.x - fromScreen.x) * t;
      const y = fromScreen.y + (toScreen.y - fromScreen.y) * t;

      if (anim.type === 'arrow') {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Trail
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromScreen.x + (toScreen.x - fromScreen.x) * Math.max(0, t - 0.2), fromScreen.y + (toScreen.y - fromScreen.y) * Math.max(0, t - 0.2));
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (anim.type === 'cannonball') {
        ctx.fillStyle = '#FF6B35';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 107, 53, 0.3)';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
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

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
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

  // ─── Public Methods ───

  addFloatingText(col, row, text, color = '#fff', size = 18) {
    const screen = this._cellToScreen(col, row);
    this.floatingTexts.push({
      x: screen.x,
      y: screen.y,
      text,
      color,
      size,
      alpha: 1,
      life: 1.5,
      maxLife: 1.5,
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
