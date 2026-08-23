// ─── HUD Manager ───────────────────────────────────────
// Main HUD overlay controller — binds all UI panels

import { BUILDINGS, BUILDING_TYPES, CATEGORY_COLORS } from '../data/buildings.js';
import { PLAYER_UNITS, PLAYER_UNIT_TYPES } from '../data/units.js';
import { ENEMY_UNITS } from '../data/units.js';
import { AI_CONFIG } from '../data/balancing.js';

export class HUD {
  constructor(gameState, buildingSystem, unitSystem, renderer, turnManager) {
    this.state = gameState;
    this.buildings = buildingSystem;
    this.units = unitSystem;
    this.renderer = renderer;
    this.turnManager = turnManager;

    this.activeTab = 'build';
    this.drawerOpen = false;
    this.battleLogCollapsed = false;

    this._bindElements();
    this._bindEvents();
    this._setupStateListeners();

    this.update();
  }

  _bindElements() {
    // Top bar
    this.turnCurrent = document.getElementById('turn-current');
    this.turnMax = document.getElementById('turn-max');
    this.resGold = document.getElementById('res-gold');
    this.resWood = document.getElementById('res-wood');
    this.resStone = document.getElementById('res-stone');
    this.resFood = document.getElementById('res-food');
    this.incomeGold = document.getElementById('income-gold');
    this.incomeWood = document.getElementById('income-wood');
    this.incomeStone = document.getElementById('income-stone');
    this.incomeFood = document.getElementById('income-food');
    this.popCurrent = document.getElementById('pop-current');
    this.popMax = document.getElementById('pop-max');

    // Build panel
    this.buildCards = document.getElementById('build-cards');
    this.buildTabs = document.querySelectorAll('.build-tab');
    this.endTurnBtn = document.getElementById('end-turn-btn');

    // Battle log
    this.battleLog = document.getElementById('battle-log');
    this.battleLogToggle = document.getElementById('battle-log-toggle');
    this.leftPanel = document.getElementById('left-panel');

    // Enemy intel (inside drawer)
    this.rightPanel = document.getElementById('right-panel');
    this.aiStatusIndicator = document.getElementById('ai-status-indicator');
    this.forceFill = document.getElementById('force-fill');
    this.enemyUnitCounts = document.getElementById('enemy-unit-counts');
    this.weakPointDisplay = document.getElementById('weak-point-display');
    this.predictedStrategy = document.getElementById('predicted-strategy');
    this.confidenceFill = document.getElementById('confidence-fill');
    this.confidenceValue = document.getElementById('confidence-value');
    this.pipelineSteps = document.querySelectorAll('.pipeline-step');

    // Drawer controls
    this.drawerToggle = document.getElementById('ai-drawer-toggle');
    this.drawerCloseBtn = document.getElementById('ai-drawer-close');
    this.drawerOpenBtn = document.getElementById('ai-drawer-open');

    // Mini AI HUD
    this.miniHud = document.getElementById('ai-mini-hud');
    this.miniThreat = document.getElementById('mini-ai-threat');
    this.miniTarget = document.getElementById('mini-ai-target');
    this.miniStrategy = document.getElementById('mini-ai-strategy');
    this.miniConfidence = document.getElementById('mini-ai-confidence');
    this.miniPipeline = document.getElementById('mini-pipeline');

    // Phase banner
    this.phaseBanner = document.getElementById('phase-banner');
    this.phaseTitle = document.getElementById('phase-title');
    this.phaseSubtitle = document.getElementById('phase-subtitle');

    // Game over
    this.gameOverModal = document.getElementById('game-over-modal');
    this.gameOverIcon = document.getElementById('game-over-icon');
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverMessage = document.getElementById('game-over-message');
    this.gameOverStats = document.getElementById('game-over-stats');
    this.restartBtn = document.getElementById('restart-btn');

    // Modals
    this.aiDisclosureModal = document.getElementById('ai-disclosure-modal');
    this.closeDisclosureBtn = document.getElementById('close-disclosure');
    this.aiInfoBtn = document.getElementById('ai-info-btn');

    // Tooltip
    this.tooltip = document.getElementById('tooltip');
    this.tooltipTitle = document.getElementById('tooltip-title');
    this.tooltipBody = document.getElementById('tooltip-body');

    // Build the mini pipeline dots
    this._buildMiniPipeline();
  }

  _buildMiniPipeline() {
    if (!this.miniPipeline) return;
    const steps = ['scan', 'evaluate', 'plan', 'score', 'execute', 'learn'];
    this.miniPipeline.innerHTML = '';
    steps.forEach(step => {
      const dot = document.createElement('div');
      dot.className = 'mini-step';
      dot.dataset.step = step;
      this.miniPipeline.appendChild(dot);
    });
  }

  _bindEvents() {
    // End turn
    this.endTurnBtn.addEventListener('click', () => {
      if (this.state.phase === 'player' && !this.state.gameResult) {
        this.endTurnBtn.classList.add('processing');
        this.turnManager.endTurn().then(() => {
          this.endTurnBtn.classList.remove('processing');
          this.update();
        });
      }
    });

    // Build tabs
    this.buildTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.buildTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderBuildCards();
      });
    });

    // Cell click handler for building placement
    this.state.on('cell_clicked', (cell) => {
      if (this.state.selectedBuilding && this.state.phase === 'player') {
        const result = this.buildings.placeBuilding(this.state.selectedBuilding, cell.col, cell.row);
        if (result) {
          this.state.selectedBuilding = null;
          this.renderer.clearPlaceablePositions();
          this._renderBuildCards();
          this.update();
        }
      }
    });

    // Restart
    this.restartBtn.addEventListener('click', () => {
      this.state.reset();
      this.gameOverModal.classList.add('hidden');
      this.update();
      this._renderBuildCards();
    });

    // AI Disclosure
    this.aiInfoBtn.addEventListener('click', () => {
      this.aiDisclosureModal.classList.remove('hidden');
    });
    this.closeDisclosureBtn.addEventListener('click', () => {
      this.aiDisclosureModal.classList.add('hidden');
    });
    this.aiDisclosureModal.addEventListener('click', (e) => {
      if (e.target === this.aiDisclosureModal) {
        this.aiDisclosureModal.classList.add('hidden');
      }
    });

    // ─── Drawer toggle/close/open ───
    if (this.drawerToggle) {
      this.drawerToggle.addEventListener('click', () => this._toggleDrawer());
    }
    if (this.drawerCloseBtn) {
      this.drawerCloseBtn.addEventListener('click', () => this._closeDrawer());
    }
    if (this.drawerOpenBtn) {
      this.drawerOpenBtn.addEventListener('click', () => this._openDrawer());
    }

    // ─── Battle log collapse ───
    if (this.battleLogToggle) {
      this.battleLogToggle.addEventListener('click', () => {
        this.battleLogCollapsed = !this.battleLogCollapsed;
        this.leftPanel.classList.toggle('collapsed', this.battleLogCollapsed);
        this.battleLogToggle.textContent = this.battleLogCollapsed ? '+' : '−';
      });
    }
  }

  _setupStateListeners() {
    // Battle log entries
    this.state.on('log', (entry) => {
      this._addLogEntry(entry);
    });

    // Phase changes
    this.state.on('phase_change', (phase) => {
      this._handlePhaseChange(phase);
      this.update();
    });

    // AI pipeline steps
    this.state.on('ai_step', (step) => {
      this._highlightPipelineStep(step);
      this._updateMiniPipeline(step);
    });

    // Combat resolved
    this.state.on('combat_resolved', (results) => {
      this._showCombatResults(results);
    });

    // Game over
    this.state.on('game_over', (data) => {
      this._showGameOver(data);
    });

    // Building events
    this.state.on('building_placed', () => this.update());
    this.state.on('building_destroyed', (b) => {
      this.renderer.shake(15);
      const screen = this.renderer._cellToScreen(b.col, b.row);
      this.renderer.particles.emit(screen.x, screen.y, 'explosion', 20);
      this.renderer.particles.emit(screen.x, screen.y, 'debris', 15);
    });
  }

  // ─── Drawer Methods ───

  _openDrawer() {
    this.drawerOpen = true;
    this.rightPanel.classList.add('drawer-open');
    this.rightPanel.classList.remove('drawer-closed');
    if (this.drawerToggle) this.drawerToggle.classList.add('drawer-active');
  }

  _closeDrawer() {
    this.drawerOpen = false;
    this.rightPanel.classList.remove('drawer-open');
    this.rightPanel.classList.add('drawer-closed');
    if (this.drawerToggle) this.drawerToggle.classList.remove('drawer-active');
  }

  _toggleDrawer() {
    if (this.drawerOpen) {
      this._closeDrawer();
    } else {
      this._openDrawer();
    }
  }

  // ─── Update ───

  update() {
    this._updateTopBar();
    this._updateEnemyIntel();
    this._updateMiniHud();
  }

  _updateTopBar() {
    this.turnCurrent.textContent = this.state.turn;
    this.turnMax.textContent = this.state.maxTurns;

    this.resGold.textContent = Math.floor(this.state.resources.gold);
    this.resWood.textContent = Math.floor(this.state.resources.wood);
    this.resStone.textContent = Math.floor(this.state.resources.stone);
    this.resFood.textContent = Math.floor(this.state.resources.food);

    this.incomeGold.textContent = `(+${this.state.income.gold || 0})`;
    this.incomeWood.textContent = `(+${this.state.income.wood || 0})`;
    this.incomeStone.textContent = `(+${this.state.income.stone || 0})`;
    this.incomeFood.textContent = `(+${this.state.income.food || 0})`;

    this.popCurrent.textContent = this.state.population;
    this.popMax.textContent = this.state.maxPopulation;

    // Disable end turn button during AI turn
    if (this.state.phase !== 'player' || this.state.gameResult) {
      this.endTurnBtn.disabled = true;
      this.endTurnBtn.classList.add('disabled');
    } else {
      this.endTurnBtn.disabled = false;
      this.endTurnBtn.classList.remove('disabled');
    }
  }

  _updateEnemyIntel() {
    // AI status
    const statusMap = {
      player: 'Monitoring',
      ai_analyzing: 'ANALYZING...',
      ai_attacking: 'ATTACKING!',
      combat: 'IN COMBAT',
      resolution: 'Updating...',
    };
    this.aiStatusIndicator.textContent = statusMap[this.state.phase] || 'Monitoring';
    this.aiStatusIndicator.className = `status-${this.state.phase === 'player' ? 'ready' : 'active'}`;

    // Enemy force
    const totalEnemy = Object.values(this.state.enemyArmy).reduce((s, c) => s + c, 0);
    const maxForce = 30; // Visual max
    const fillPercent = Math.min(100, (totalEnemy / maxForce) * 100);
    this.forceFill.style.width = `${fillPercent}%`;

    // Unit counts
    this.enemyUnitCounts.innerHTML = Object.entries(this.state.enemyArmy)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => {
        const unitDef = ENEMY_UNITS[type];
        return `<span class="enemy-unit-badge">${unitDef?.icon || '?'} ${count}</span>`;
      })
      .join('');

    // Weakest point
    let weakestDir = 'none';
    let maxWeakness = -1;
    for (const dir of ['north', 'south', 'east', 'west']) {
      const wall = this.state.getWallHP(dir);
      if (wall.maxHp === 0) {
        if (1 > maxWeakness) {
          maxWeakness = 1;
          weakestDir = dir;
        }
      } else {
        const weakness = 1 - wall.percentage;
        if (weakness > maxWeakness) {
          maxWeakness = weakness;
          weakestDir = dir;
        }
      }
    }

    const wallInfo = this.state.getWallHP(weakestDir);
    if (wallInfo.maxHp > 0) {
      this.weakPointDisplay.innerHTML = `
        <span class="weak-direction">${weakestDir.toUpperCase()}</span>
        <div class="weak-hp-bar">
          <div class="weak-hp-fill" style="width: ${wallInfo.percentage * 100}%"></div>
        </div>
        <span class="weak-hp-text">${Math.floor(wallInfo.hp)}/${wallInfo.maxHp}</span>
      `;
    } else {
      this.weakPointDisplay.innerHTML = `<span class="weak-direction danger">${weakestDir.toUpperCase()} — NO WALL!</span>`;
    }

    // Predicted attack
    if (this.state.lastAIStrategy) {
      const s = this.state.lastAIStrategy;
      this.predictedStrategy.textContent = s.name;
      const conf = Math.floor((s.confidence || 0) * 100);
      this.confidenceFill.style.width = `${conf}%`;
      this.confidenceValue.textContent = `${conf}%`;
    }
  }

  // ─── Mini HUD Updates ───

  _updateMiniHud() {
    if (!this.miniHud) return;

    // Threat level based on total enemy count
    const totalEnemy = Object.values(this.state.enemyArmy).reduce((s, c) => s + c, 0);
    let threatLevel = 'LOW';
    let threatClass = 'threat-low';
    if (totalEnemy >= 20) {
      threatLevel = 'CRITICAL';
      threatClass = 'threat-critical';
    } else if (totalEnemy >= 12) {
      threatLevel = 'HIGH';
      threatClass = 'threat-high';
    } else if (totalEnemy >= 6) {
      threatLevel = 'MEDIUM';
      threatClass = 'threat-medium';
    }

    if (this.miniThreat) {
      this.miniThreat.textContent = threatLevel;
      this.miniThreat.className = `mini-value ${threatClass}`;
    }

    // Target — weakest wall direction
    let weakestDir = 'none';
    let maxWeakness = -1;
    for (const dir of ['north', 'south', 'east', 'west']) {
      const wall = this.state.getWallHP(dir);
      if (wall.maxHp === 0) {
        if (1 > maxWeakness) {
          maxWeakness = 1;
          weakestDir = dir;
        }
      } else {
        const weakness = 1 - wall.percentage;
        if (weakness > maxWeakness) {
          maxWeakness = weakness;
          weakestDir = dir;
        }
      }
    }
    if (this.miniTarget) {
      this.miniTarget.textContent = weakestDir !== 'none' ? weakestDir.toUpperCase() : 'Scanning...';
    }

    // Strategy
    if (this.miniStrategy) {
      this.miniStrategy.textContent = this.state.lastAIStrategy?.name || '—';
    }

    // Confidence
    if (this.miniConfidence) {
      const conf = this.state.lastAIStrategy
        ? `${Math.floor((this.state.lastAIStrategy.confidence || 0) * 100)}%`
        : '—';
      this.miniConfidence.textContent = conf;
    }

    // Active state glow
    const isActive = this.state.phase === 'ai_analyzing' || this.state.phase === 'ai_attacking';
    this.miniHud.classList.toggle('active', isActive);
  }

  _updateMiniPipeline(currentStep) {
    if (!this.miniPipeline) return;
    const steps = this.miniPipeline.querySelectorAll('.mini-step');
    let found = false;
    steps.forEach(dot => {
      dot.classList.remove('active', 'done');
      if (dot.dataset.step === currentStep) {
        dot.classList.add('active');
        found = true;
      } else if (!found) {
        dot.classList.add('done');
      }
    });
  }

  _resetMiniPipeline() {
    if (!this.miniPipeline) return;
    const steps = this.miniPipeline.querySelectorAll('.mini-step');
    steps.forEach(dot => dot.classList.remove('active', 'done'));
  }

  // ─── Build Cards ───

  _renderBuildCards() {
    this.buildCards.innerHTML = '';

    if (this.activeTab === 'build' || this.activeTab === 'defense') {
      const category = this.activeTab === 'build' ? ['economy', 'core'] : ['defense', 'military'];

      for (const [type, def] of Object.entries(BUILDINGS)) {
        if (!category.includes(def.category)) continue;
        if (type === BUILDING_TYPES.TOWN_CENTER) continue; // Can't build another

        const cost = def.levels[0].cost;
        const canAfford = this.state.canAfford(cost);
        const count = this.state.buildings.filter(b => b.type === type).length;
        const atMax = count >= def.maxCount;

        const card = document.createElement('div');
        card.className = `build-card ${!canAfford || atMax ? 'disabled' : ''}`;
        card.innerHTML = `
          <div class="card-header" style="border-left: 3px solid ${CATEGORY_COLORS[def.category]}">
            <span class="card-name">${def.name}</span>
            <span class="card-count">${count}/${def.maxCount}</span>
          </div>
          <div class="card-desc">${def.description}</div>
          <div class="card-costs">
            ${cost.gold ? `<span class="cost-item ${this.state.resources.gold < cost.gold ? 'insufficient' : ''}">💰${cost.gold}</span>` : ''}
            ${cost.wood ? `<span class="cost-item ${this.state.resources.wood < cost.wood ? 'insufficient' : ''}">🪵${cost.wood}</span>` : ''}
            ${cost.stone ? `<span class="cost-item ${this.state.resources.stone < cost.stone ? 'insufficient' : ''}">🪨${cost.stone}</span>` : ''}
          </div>
          ${def.levels[0].buildTime > 0 ? `<div class="card-build-time">⏱ ${def.levels[0].buildTime} turns</div>` : ''}
        `;

        if (canAfford && !atMax) {
          card.addEventListener('click', () => {
            this.state.selectedBuilding = type;
            const positions = this.buildings.getPlaceablePositions(type);
            this.renderer.setPlaceablePositions(positions);

            // Highlight selected card
            document.querySelectorAll('.build-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
          });
        }

        this.buildCards.appendChild(card);
      }
    } else if (this.activeTab === 'units') {
      for (const [type, def] of Object.entries(PLAYER_UNITS)) {
        const canRecruit = this.units.canRecruit(type);

        const card = document.createElement('div');
        card.className = `build-card unit-card ${!canRecruit ? 'disabled' : ''}`;
        card.innerHTML = `
          <div class="card-header" style="border-left: 3px solid ${def.color}">
            <span class="card-name">${def.icon} ${def.name}</span>
            <span class="card-count">Pop: ${def.populationCost}</span>
          </div>
          <div class="card-desc">${def.description}</div>
          <div class="card-stats">
            <span>❤️ ${def.hp}</span>
            <span>⚔️ ${def.damage}</span>
            <span>🛡️ ${def.armor}</span>
          </div>
          <div class="card-costs">
            ${def.cost.gold ? `<span class="cost-item ${this.state.resources.gold < def.cost.gold ? 'insufficient' : ''}">💰${def.cost.gold}</span>` : ''}
            ${def.cost.food ? `<span class="cost-item ${this.state.resources.food < def.cost.food ? 'insufficient' : ''}">🍖${def.cost.food}</span>` : ''}
          </div>
        `;

        if (canRecruit) {
          card.addEventListener('click', () => {
            this.units.recruitUnit(type);
            this._renderBuildCards();
            this.update();
          });
        }

        this.buildCards.appendChild(card);
      }
    } else if (this.activeTab === 'upgrades') {
      // Show upgradeable buildings
      for (const building of this.state.buildings) {
        if (building.constructing) continue;
        const def = BUILDINGS[building.type];
        if (!def || building.level >= def.levels.length) continue;

        const nextLevel = def.levels[building.level];
        if (!nextLevel) continue;

        const canAfford = this.state.canAfford(nextLevel.cost);

        const card = document.createElement('div');
        card.className = `build-card upgrade-card ${!canAfford ? 'disabled' : ''}`;
        card.innerHTML = `
          <div class="card-header" style="border-left: 3px solid ${CATEGORY_COLORS[def.category]}">
            <span class="card-name">⬆️ ${def.name}</span>
            <span class="card-count">Lv ${building.level} → ${building.level + 1}</span>
          </div>
          <div class="card-desc">HP: ${def.levels[building.level - 1].hp} → ${nextLevel.hp}</div>
          <div class="card-costs">
            ${nextLevel.cost.gold ? `<span class="cost-item ${this.state.resources.gold < nextLevel.cost.gold ? 'insufficient' : ''}">💰${nextLevel.cost.gold}</span>` : ''}
            ${nextLevel.cost.wood ? `<span class="cost-item ${this.state.resources.wood < nextLevel.cost.wood ? 'insufficient' : ''}">🪵${nextLevel.cost.wood}</span>` : ''}
            ${nextLevel.cost.stone ? `<span class="cost-item ${this.state.resources.stone < nextLevel.cost.stone ? 'insufficient' : ''}">🪨${nextLevel.cost.stone}</span>` : ''}
          </div>
        `;

        if (canAfford) {
          card.addEventListener('click', () => {
            this.buildings.upgradeBuilding(building.id);
            this._renderBuildCards();
            this.update();
          });
        }

        this.buildCards.appendChild(card);
      }

      if (this.buildCards.children.length === 0) {
        this.buildCards.innerHTML = '<div class="no-upgrades">No upgrades available</div>';
      }
    }
  }

  // ─── Battle Log ───

  _addLogEntry(entry) {
    const div = document.createElement('div');
    div.className = `log-entry log-${entry.type}`;
    div.innerHTML = `<span class="log-turn">T${entry.turn}</span> ${entry.message}`;

    this.battleLog.appendChild(div);
    this.battleLog.scrollTop = this.battleLog.scrollHeight;

    // Limit log entries
    while (this.battleLog.children.length > 100) {
      this.battleLog.removeChild(this.battleLog.firstChild);
    }
  }

  // ─── Phase Changes ───

  _handlePhaseChange(phase) {
    if (phase === 'ai_analyzing') {
      this.phaseBanner.classList.remove('hidden');
      this.phaseTitle.textContent = 'ENEMY TURN';
      this.phaseSubtitle.textContent = 'AI analyzing your defenses...';
      this.phaseBanner.className = 'phase-analyzing';
    } else if (phase === 'ai_attacking') {
      this.phaseTitle.textContent = 'ATTACK INCOMING';
      this.phaseSubtitle.textContent = this.state.lastAIStrategy?.name || 'Preparing attack...';
      this.phaseBanner.className = 'phase-attacking';

      // Auto-open drawer briefly during attack phase
      this._openDrawer();
    } else if (phase === 'combat') {
      this.phaseTitle.textContent = 'COMBAT';
      this.phaseSubtitle.textContent = 'Resolving battle...';
      this.phaseBanner.className = 'phase-combat';
    } else if (phase === 'player') {
      this.phaseBanner.classList.add('hidden');
      this._resetPipelineSteps();
      this._resetMiniPipeline();

      // Auto-close drawer when player turn starts
      this._closeDrawer();
    } else {
      this.phaseBanner.classList.add('hidden');
    }
  }

  _highlightPipelineStep(step) {
    this.pipelineSteps.forEach(el => {
      el.classList.remove('active', 'completed');
    });

    let found = false;
    this.pipelineSteps.forEach(el => {
      if (el.dataset.step === step) {
        el.classList.add('active');
        found = true;
      } else if (!found) {
        el.classList.add('completed');
      }
    });
  }

  _resetPipelineSteps() {
    this.pipelineSteps.forEach(el => {
      el.classList.remove('active', 'completed');
    });
  }

  // ─── Combat Results ───

  _showCombatResults(results) {
    if (results.damageToPlayer > 0) {
      this.renderer.shake(results.wallBreached ? 20 : 10);
    }
  }

  // ─── Game Over ───

  _showGameOver(data) {
    this.gameOverModal.classList.remove('hidden');
    this.phaseBanner.classList.add('hidden');

    if (data.result === 'victory') {
      this.gameOverIcon.textContent = '🏆';
      this.gameOverTitle.textContent = 'VICTORY!';
      this.gameOverTitle.style.color = '#FFD700';
      this.gameOverMessage.textContent = 'Your fortress has withstood all enemy assaults!';
    } else {
      this.gameOverIcon.textContent = '💀';
      this.gameOverTitle.textContent = 'DEFEAT';
      this.gameOverTitle.style.color = '#E74C3C';
      this.gameOverMessage.textContent = 'Your fortress has fallen. The enemy overwhelmed your defenses.';
    }

    this.gameOverStats.innerHTML = `
      <div class="stat-row"><span>Turns Survived</span><span>${this.state.stats.turnsPlayed}</span></div>
      <div class="stat-row"><span>Buildings Built</span><span>${this.state.stats.buildingsBuilt}</span></div>
      <div class="stat-row"><span>Units Recruited</span><span>${this.state.stats.unitsRecruited}</span></div>
      <div class="stat-row"><span>Enemies Killed</span><span>${this.state.stats.enemiesKilled}</span></div>
      <div class="stat-row"><span>Damage Dealt</span><span>${Math.floor(this.state.stats.damageDealt)}</span></div>
      <div class="stat-row"><span>Damage Taken</span><span>${Math.floor(this.state.stats.damageTaken)}</span></div>
    `;
  }

  // ─── Initialize ───

  init() {
    this._renderBuildCards();
    this.update();
    this.state.log('🏰 Welcome to Fortress AI! Build your defenses and survive 20 turns.', 'neutral');
    this.state.log('⚠️ Enemies will begin attacking on Turn 3. Prepare your walls!', 'neutral');
  }
}
