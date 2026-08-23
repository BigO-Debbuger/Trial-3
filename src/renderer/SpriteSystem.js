// ─── Sprite System ───────────────────────────────────────
// Procedural sprite generator — all buildings, units, and terrain drawn via canvas
// No external assets needed

import { BUILDING_TYPES } from '../data/buildings.js';

export class SpriteSystem {
  constructor() {
    this._cache = new Map();
  }

  // ─── Buildings ───

  drawBuilding(ctx, x, y, size, type, level, color) {
    const pad = size * 0.1;
    const innerSize = size - pad * 2;

    ctx.save();
    ctx.translate(x + pad, y + pad);

    switch (type) {
      case BUILDING_TYPES.TOWN_CENTER:
        this._drawTownCenter(ctx, innerSize, level, color);
        break;
      case BUILDING_TYPES.WALL:
        this._drawWall(ctx, innerSize, level, color);
        break;
      case BUILDING_TYPES.ARCHER_TOWER:
        this._drawArcherTower(ctx, innerSize, level, color);
        break;
      case BUILDING_TYPES.CANNON_TOWER:
        this._drawCannonTower(ctx, innerSize, level, color);
        break;
      case BUILDING_TYPES.BARRACKS:
        this._drawBarracks(ctx, innerSize, level, color);
        break;
      case BUILDING_TYPES.RESOURCE_CAMP:
        this._drawResourceCamp(ctx, innerSize, level, color);
        break;
      case BUILDING_TYPES.STORAGE:
        this._drawStorage(ctx, innerSize, level, color);
        break;
      case BUILDING_TYPES.GATE:
        this._drawGate(ctx, innerSize, level, color);
        break;
      default:
        this._drawDefault(ctx, innerSize, color);
    }

    ctx.restore();
  }

  _drawTownCenter(ctx, s, level, color) {
    // Main structure
    const gradient = ctx.createLinearGradient(0, 0, 0, s);
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(1, '#B8860B');
    ctx.fillStyle = gradient;

    // Base
    ctx.fillRect(s * 0.1, s * 0.3, s * 0.8, s * 0.65);

    // Roof
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(0, s * 0.35);
    ctx.lineTo(s * 0.5, s * 0.05);
    ctx.lineTo(s, s * 0.35);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#4a2800';
    ctx.fillRect(s * 0.35, s * 0.55, s * 0.3, s * 0.4);

    // Windows
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(s * 0.15, s * 0.45, s * 0.15, s * 0.12);
    ctx.fillRect(s * 0.7, s * 0.45, s * 0.15, s * 0.12);

    // Flag
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.05);
    ctx.lineTo(s * 0.5, -s * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(s * 0.5, -s * 0.1, s * 0.15, s * 0.08);
  }

  _drawWall(ctx, s, level, color) {
    const heights = [0.5, 0.6, 0.75];
    const h = s * (heights[level - 1] || 0.5);

    // Wall body
    const gradient = ctx.createLinearGradient(0, s - h, 0, s);
    gradient.addColorStop(0, '#8B8B8B');
    gradient.addColorStop(1, '#5a5a5a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, s - h, s, h);

    // Battlement pattern
    ctx.fillStyle = '#7a7a7a';
    const merlonWidth = s / 5;
    for (let i = 0; i < 5; i += 2) {
      ctx.fillRect(i * merlonWidth, s - h - s * 0.08, merlonWidth, s * 0.08);
    }

    // Stone texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, s - h + h * (i / 3));
      ctx.lineTo(s, s - h + h * (i / 3));
      ctx.stroke();
    }
  }

  _drawArcherTower(ctx, s, level, color) {
    // Tower base
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(s * 0.2, s * 0.35, s * 0.6, s * 0.6);

    // Tower top / platform
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(s * 0.1, s * 0.25, s * 0.8, s * 0.15);

    // Pointed roof
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.moveTo(s * 0.15, s * 0.28);
    ctx.lineTo(s * 0.5, s * 0.02);
    ctx.lineTo(s * 0.85, s * 0.28);
    ctx.closePath();
    ctx.fill();

    // Arrow slit
    ctx.fillStyle = '#2c1a0e';
    ctx.fillRect(s * 0.43, s * 0.5, s * 0.14, s * 0.2);

    // Bow
    ctx.strokeStyle = '#DEB887';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.35, s * 0.12, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
  }

  _drawCannonTower(ctx, s, level, color) {
    // Tower base
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(s * 0.15, s * 0.3, s * 0.7, s * 0.65);

    // Reinforced top
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(s * 0.1, s * 0.22, s * 0.8, s * 0.12);

    // Cannon barrel
    ctx.fillStyle = '#333';
    ctx.fillRect(s * 0.6, s * 0.45, s * 0.35, s * 0.12);

    // Cannon wheel
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s * 0.55, s * 0.65, s * 0.08, 0, Math.PI * 2);
    ctx.stroke();

    // Emblem
    ctx.fillStyle = '#FF6B35';
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.5, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawBarracks(ctx, s, level, color) {
    // Main building
    ctx.fillStyle = '#3a5a8c';
    ctx.fillRect(s * 0.1, s * 0.35, s * 0.8, s * 0.6);

    // Roof
    ctx.fillStyle = '#2c4a6e';
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.38);
    ctx.lineTo(s * 0.5, s * 0.12);
    ctx.lineTo(s * 0.95, s * 0.38);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(s * 0.35, s * 0.55, s * 0.3, s * 0.4);

    // Shield emblem
    ctx.fillStyle = '#4FC3F7';
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.42);
    ctx.lineTo(s * 0.42, s * 0.35);
    ctx.lineTo(s * 0.42, s * 0.28);
    ctx.lineTo(s * 0.58, s * 0.28);
    ctx.lineTo(s * 0.58, s * 0.35);
    ctx.closePath();
    ctx.fill();
  }

  _drawResourceCamp(ctx, s, level, color) {
    // Tent base
    ctx.fillStyle = '#2ECC71';
    ctx.beginPath();
    ctx.moveTo(s * 0.1, s * 0.85);
    ctx.lineTo(s * 0.5, s * 0.2);
    ctx.lineTo(s * 0.9, s * 0.85);
    ctx.closePath();
    ctx.fill();

    // Tent stripe
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.moveTo(s * 0.3, s * 0.85);
    ctx.lineTo(s * 0.5, s * 0.35);
    ctx.lineTo(s * 0.7, s * 0.85);
    ctx.closePath();
    ctx.fill();

    // Flag pole
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.2);
    ctx.lineTo(s * 0.5, s * 0.05);
    ctx.stroke();

    // Resource crates
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(s * 0.65, s * 0.7, s * 0.2, s * 0.15);
  }

  _drawStorage(ctx, s, level, color) {
    // Barn-like structure
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(s * 0.1, s * 0.4, s * 0.8, s * 0.55);

    // Curved roof
    ctx.fillStyle = '#A0522D';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.4, s * 0.42, s * 0.2, 0, Math.PI, 0);
    ctx.fill();

    // Door
    ctx.fillStyle = '#5a3010';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.95, s * 0.15, s * 0.18, 0, Math.PI, 0);
    ctx.fill();

    // Cross beams
    ctx.strokeStyle = '#6a3a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.1, s * 0.6);
    ctx.lineTo(s * 0.9, s * 0.6);
    ctx.stroke();
  }

  _drawGate(ctx, s, level, color) {
    // Gate posts
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(s * 0.05, s * 0.15, s * 0.2, s * 0.8);
    ctx.fillRect(s * 0.75, s * 0.15, s * 0.2, s * 0.8);

    // Gate arch
    ctx.strokeStyle = '#8B8B8B';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.35, s * 0.35, Math.PI, 0);
    ctx.stroke();

    // Gate bars
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const bx = s * 0.3 + i * s * 0.12;
      ctx.beginPath();
      ctx.moveTo(bx, s * 0.35);
      ctx.lineTo(bx, s * 0.95);
      ctx.stroke();
    }

    // Portcullis crossbar
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s * 0.25, s * 0.6);
    ctx.lineTo(s * 0.75, s * 0.6);
    ctx.stroke();
  }

  _drawDefault(ctx, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(s * 0.15, s * 0.15, s * 0.7, s * 0.7);
  }

  // ─── Construction Site ───

  drawConstructionSite(ctx, x, y, size, time) {
    const pad = size * 0.1;
    const s = size - pad * 2;

    ctx.save();
    ctx.translate(x + pad, y + pad);

    // Foundation
    ctx.fillStyle = 'rgba(139, 119, 42, 0.4)';
    ctx.fillRect(0, s * 0.6, s, s * 0.35);

    // Scaffolding
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.1, s * 0.2);
    ctx.lineTo(s * 0.1, s * 0.95);
    ctx.moveTo(s * 0.9, s * 0.2);
    ctx.lineTo(s * 0.9, s * 0.95);
    ctx.moveTo(s * 0.1, s * 0.5);
    ctx.lineTo(s * 0.9, s * 0.5);
    ctx.stroke();

    // Animated hammer
    const hammerAngle = Math.sin(time * 0.005) * 0.5;
    ctx.save();
    ctx.translate(s * 0.5, s * 0.3);
    ctx.rotate(hammerAngle);
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(-2, -s * 0.2, 4, s * 0.2);
    ctx.fillStyle = '#888';
    ctx.fillRect(-6, -s * 0.22, 12, 8);
    ctx.restore();

    ctx.restore();
  }

  // ─── Units ───

  drawUnit(ctx, x, y, size, color, icon, isEnemy) {
    const pad = size * 0.2;
    const s = size - pad * 2;
    const cx = x + size / 2;
    const cy = y + size / 2;

    // Unit circle
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = isEnemy ? 'rgba(231, 76, 60, 0.3)' : 'rgba(79, 195, 247, 0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = isEnemy ? 'rgba(231, 76, 60, 0.6)' : 'rgba(79, 195, 247, 0.6)';
    ctx.fill();

    // Unit icon
    ctx.font = `${Math.floor(s * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, cx, cy);

    // Enemy glow
    if (isEnemy) {
      ctx.shadowColor = '#e74c3c';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // ─── Terrain ───

  drawTree(ctx, x, y, size) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const s = size * 0.35;

    // Trunk
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(cx - 2, cy, 4, s * 0.6);

    // Foliage
    ctx.fillStyle = '#2a8a2a';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.1, s * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3a9a3a';
    ctx.beginPath();
    ctx.arc(cx + 3, cy - s * 0.2, s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  drawRock(ctx, x, y, size) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const s = size * 0.3;

    ctx.fillStyle = '#5a5a64';
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.1, s * 0.6, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6a6a74';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.2, cy, s * 0.3, s * 0.25, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWater(ctx, x, y, size, time) {
    const wave = Math.sin(time * 0.002 + x * 0.05) * 2;

    ctx.fillStyle = '#2a6aaa';
    ctx.fillRect(x, y, size, size);

    // Wave lines
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const wy = y + size * 0.25 + i * size * 0.25;
      ctx.beginPath();
      ctx.moveTo(x, wy + wave);
      ctx.quadraticCurveTo(x + size * 0.5, wy - wave, x + size, wy + wave);
      ctx.stroke();
    }
  }

  // ─── PS2 Enemy Empire Structures ───

  drawEnemyStructure(ctx, x, y, size, targetId, status, time) {
    const pad = size * 0.08;
    const s = size - pad * 2;

    ctx.save();
    ctx.translate(x + pad, y + pad);

    if (status === 'destroyed') {
      this._drawRuins(ctx, s, time);
      ctx.restore();
      return;
    }

    switch (targetId) {
      case 'command_center':
        this._drawEnemyStronghold(ctx, s, time);
        break;
      case 'gold_mine':
        this._drawEnemyGoldMine(ctx, s, time);
        break;
      case 'barracks':
        this._drawEnemyBarracks(ctx, s, time);
        break;
      case 'watchtower':
        this._drawEnemyWatchtower(ctx, s, time);
        break;
      case 'resource_depot':
        this._drawEnemySupplyDepot(ctx, s, time);
        break;
      case 'wall_outpost':
        this._drawEnemyCitadelGate(ctx, s, time);
        break;
      default:
        this._drawDefault(ctx, s, '#8B0000');
    }

    if (status === 'damaged') {
      this._drawDamagedEffect(ctx, s, time);
    }

    ctx.restore();
  }

  _drawEnemyStronghold(ctx, s, time) {
    // Dark fortress citadel with crimson spire & glowing core
    const grad = ctx.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, '#4A0E17');
    grad.addColorStop(1, '#1A0508');
    ctx.fillStyle = grad;
    ctx.fillRect(s * 0.1, s * 0.25, s * 0.8, s * 0.7);

    // Battlements & spires
    ctx.fillStyle = '#7A1C24';
    ctx.fillRect(s * 0.05, s * 0.15, s * 0.25, s * 0.8);
    ctx.fillRect(s * 0.7, s * 0.15, s * 0.25, s * 0.8);

    // Spired Central Keep
    ctx.fillStyle = '#991B24';
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.25);
    ctx.lineTo(s * 0.5, -s * 0.1);
    ctx.lineTo(s * 0.8, s * 0.25);
    ctx.closePath();
    ctx.fill();

    // Glowing warlord eye / crest
    const pulse = 0.6 + 0.4 * Math.sin(time * 0.005);
    ctx.shadowColor = '#FF2A2A';
    ctx.shadowBlur = 12 * pulse;
    ctx.fillStyle = `rgba(255, 42, 42, ${pulse})`;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.35, s * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Iron gate
    ctx.fillStyle = '#111';
    ctx.fillRect(s * 0.38, s * 0.6, s * 0.24, s * 0.35);
  }

  _drawEnemyGoldMine(ctx, s, time) {
    // Quarry rocks & gold seams
    ctx.fillStyle = '#3E2723';
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.85);
    ctx.lineTo(s * 0.3, s * 0.25);
    ctx.lineTo(s * 0.7, s * 0.2);
    ctx.lineTo(s * 0.95, s * 0.85);
    ctx.closePath();
    ctx.fill();

    // Mine shaft
    ctx.fillStyle = '#1A110F';
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.65, s * 0.2, Math.PI, 0);
    ctx.fill();

    // Wooden scaffolding
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = 2;
    ctx.strokeRect(s * 0.32, s * 0.4, s * 0.36, s * 0.45);

    // Shimmering gold nuggets
    const shimmer = 0.7 + 0.3 * Math.sin(time * 0.004);
    ctx.fillStyle = `rgba(255, 215, 0, ${shimmer})`;
    ctx.beginPath();
    ctx.arc(s * 0.4, s * 0.75, s * 0.06, 0, Math.PI * 2);
    ctx.arc(s * 0.6, s * 0.78, s * 0.07, 0, Math.PI * 2);
    ctx.arc(s * 0.5, s * 0.3, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawEnemyBarracks(ctx, s, time) {
    // Military garrison fortress
    ctx.fillStyle = '#5D101D';
    ctx.fillRect(s * 0.1, s * 0.35, s * 0.8, s * 0.55);

    // Steel reinforced roof
    ctx.fillStyle = '#2B2B36';
    ctx.beginPath();
    ctx.moveTo(s * 0.05, s * 0.38);
    ctx.lineTo(s * 0.5, s * 0.12);
    ctx.lineTo(s * 0.95, s * 0.38);
    ctx.closePath();
    ctx.fill();

    // Red war flag waving
    const wave = Math.sin(time * 0.006) * 3;
    ctx.strokeStyle = '#D32F2F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.12);
    ctx.lineTo(s * 0.5, -s * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#E53935';
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.1);
    ctx.lineTo(s * 0.75 + wave, -s * 0.06);
    ctx.lineTo(s * 0.5, -s * 0.02);
    ctx.closePath();
    ctx.fill();

    // Crossed weapons emblem
    ctx.strokeStyle = '#FFC107';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.38, s * 0.5);
    ctx.lineTo(s * 0.62, s * 0.65);
    ctx.moveTo(s * 0.62, s * 0.5);
    ctx.lineTo(s * 0.38, s * 0.65);
    ctx.stroke();
  }

  _drawEnemyWatchtower(ctx, s, time) {
    // Dark stone tower
    ctx.fillStyle = '#37474F';
    ctx.fillRect(s * 0.25, s * 0.3, s * 0.5, s * 0.65);

    // Ranged lookout platform
    ctx.fillStyle = '#263238';
    ctx.fillRect(s * 0.15, s * 0.18, s * 0.7, s * 0.14);

    // Dark crimson conical roof
    ctx.fillStyle = '#880E4F';
    ctx.beginPath();
    ctx.moveTo(s * 0.15, s * 0.18);
    ctx.lineTo(s * 0.5, -s * 0.05);
    ctx.lineTo(s * 0.85, s * 0.18);
    ctx.closePath();
    ctx.fill();

    // Searchlight / Watch flare
    const flare = 0.5 + 0.5 * Math.sin(time * 0.005);
    ctx.fillStyle = `rgba(255, 110, 64, ${flare})`;
    ctx.beginPath();
    ctx.arc(s * 0.5, s * 0.24, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawEnemySupplyDepot(ctx, s, time) {
    // Reinforced logistics warehouse
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(s * 0.15, s * 0.4, s * 0.7, s * 0.55);

    // Corrugated iron roof
    ctx.fillStyle = '#455A64';
    ctx.fillRect(s * 0.1, s * 0.3, s * 0.8, s * 0.12);

    // Stacked supply crates & barrels
    ctx.fillStyle = '#795548';
    ctx.fillRect(s * 0.22, s * 0.62, s * 0.25, s * 0.28);
    ctx.fillRect(s * 0.52, s * 0.62, s * 0.25, s * 0.28);
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(s * 0.36, s * 0.48, s * 0.26, s * 0.22);
  }

  _drawEnemyCitadelGate(ctx, s, time) {
    // Heavy fortified gatehouse & iron spikes
    ctx.fillStyle = '#212121';
    ctx.fillRect(s * 0.08, s * 0.15, s * 0.25, s * 0.8);
    ctx.fillRect(s * 0.67, s * 0.15, s * 0.25, s * 0.8);

    // Reinforced iron portcullis arch
    ctx.strokeStyle = '#B71C1C';
    ctx.lineWidth = 3;
    ctx.strokeRect(s * 0.33, s * 0.25, s * 0.34, s * 0.7);

    // Iron bars
    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const bx = s * 0.37 + i * s * 0.08;
      ctx.beginPath();
      ctx.moveTo(bx, s * 0.28);
      ctx.lineTo(bx, s * 0.95);
      ctx.stroke();
    }
  }

  _drawRuins(ctx, s, time) {
    // Smoking rubble & charred stone
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.75, s * 0.45, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Jagged charred pillars
    ctx.fillStyle = '#2E2E2E';
    ctx.fillRect(s * 0.2, s * 0.55, s * 0.15, s * 0.25);
    ctx.fillRect(s * 0.65, s * 0.6, s * 0.18, s * 0.2);

    // Glowing embers
    const ember = 0.4 + 0.4 * Math.sin(time * 0.008);
    ctx.fillStyle = `rgba(255, 87, 34, ${ember})`;
    ctx.beginPath();
    ctx.arc(s * 0.35, s * 0.72, s * 0.04, 0, Math.PI * 2);
    ctx.arc(s * 0.55, s * 0.76, s * 0.05, 0, Math.PI * 2);
    ctx.arc(s * 0.7, s * 0.68, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawDamagedEffect(ctx, s, time) {
    // Fire and smoke plume on damaged structures
    const flicker = 0.6 + 0.4 * Math.sin(time * 0.01);
    ctx.fillStyle = `rgba(255, 110, 0, ${flicker * 0.7})`;
    ctx.beginPath();
    ctx.arc(s * 0.65, s * 0.3, s * 0.15 * flicker, 0, Math.PI * 2);
    ctx.fill();
  }
}
