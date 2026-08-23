// ─── HUD Manager ───────────────────────────────────────
// Main HUD controller — manages Strategic Village HUD,
// Fullscreen Dedicated Enemy Assault Mode with Bottom Troop Tray,
// Enemy Offensive Alerts, and Two-Way War Battle Reports.

import { BUILDINGS, BUILDING_TYPES, CATEGORY_COLORS } from '../data/buildings.js';
import { PLAYER_UNITS, PLAYER_UNIT_TYPES, ENEMY_UNITS } from '../data/units.js';
import { ENEMY_TARGETS, DEFENSIVE_STRATEGIES } from '../data/enemyBase.js';

export class HUD {
  constructor(gameState, buildingSystem, unitSystem, renderer, turnManager, offensiveSystem, defensiveAI) {
    this.state = gameState;
    this.buildings = buildingSystem;
    this.units = unitSystem;
    this.renderer = renderer;
    this.turnManager = turnManager;
    this.offensiveSystem = offensiveSystem;
    this.defensiveAI = defensiveAI;

    this.activeTab = 'build';
    this.drawerOpen = false;
    this.battleLogCollapsed = false;

    this._bindElements();
    this._bindEvents();
    this._setupStateListeners();

    this.update();
  }

  _bindElements() {
    // Strategic Map UI Root
    this.uiOverlay = document.getElementById('ui-overlay');

    // Top bar
    this.turnCurrent = document.getElementById('turn-current');
    this.turnMax = document.getElementById('turn-max');
    this.phaseBadge = document.getElementById('phase-badge');
    this.phaseLabel = document.getElementById('phase-label');
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
    this.ps2DemoBtn = document.getElementById('ps2-demo-btn');

    // Build & Attack action panel
    this.buildCards = document.getElementById('build-cards');
    this.buildTabs = document.querySelectorAll('.build-tab');
    this.endTurnBtn = document.getElementById('end-turn-btn');
    this.attackModeBtn = document.getElementById('attack-mode-btn');

    // Battle log
    this.battleLog = document.getElementById('battle-log');
    this.battleLogToggle = document.getElementById('battle-log-toggle');
    this.leftPanel = document.getElementById('left-panel');

    // Enemy intel drawer
    this.rightPanel = document.getElementById('right-panel');
    this.aiStatusIndicator = document.getElementById('ai-status-indicator');
    this.forceFill = document.getElementById('force-fill');
    this.enemyUnitCounts = document.getElementById('enemy-unit-counts');
    this.enemyTargetsList = document.getElementById('enemy-targets-list');
    this.weakPointDisplay = document.getElementById('weak-point-display');
    this.predictedStrategy = document.getElementById('predicted-strategy');
    this.confidenceFill = document.getElementById('confidence-fill');
    this.confidenceValue = document.getElementById('confidence-value');
    this.pipelineSteps = document.querySelectorAll('.pipeline-step');

    // Drawer controls
    this.drawerCloseBtn = document.getElementById('ai-drawer-close');
    this.drawerOpenBtn = document.getElementById('ai-drawer-open');

    // Mini AI HUD
    this.miniHud = document.getElementById('ai-mini-hud');
    this.miniThreat = document.getElementById('mini-ai-threat');
    this.miniStrategy = document.getElementById('mini-ai-strategy');
    this.miniDefenseDoc = document.getElementById('mini-ai-defense-doc');
    this.miniEmpireStatus = document.getElementById('mini-ai-empire-status');
    this.miniPipeline = document.getElementById('mini-pipeline');

    // ─── PS2 Dedicated Fullscreen Enemy Assault Screen ───
    this.attackScreenOverlay = document.getElementById('attack-screen-overlay');
    this.attackRetreatBtn = document.getElementById('attack-retreat-btn');
    this.attackFinishBtn = document.getElementById('attack-finish-btn');
    this.assaultLogBody = document.getElementById('assault-log-body');
    this.assaultAiAlert = document.getElementById('assault-ai-alert');
    this.assaultAiDoctrine = document.getElementById('assault-ai-doctrine');
    this.assaultAiReason = document.getElementById('assault-ai-reason');
    this.trayDeployedCounter = document.getElementById('tray-deployed-counter');
    this.trayCards = document.querySelectorAll('.troop-tray-card');
    this.trayCountWarrior = document.getElementById('tray-count-warrior');
    this.trayCountArcher = document.getElementById('tray-count-archer');
    this.trayCountDefender = document.getElementById('tray-count-defender');
    this.trayCountSiege = document.getElementById('tray-count-siege');

    // ─── Enemy Offensive Warning Alert ───
    this.enemyOffensiveAlert = document.getElementById('enemy-offensive-alert');
    this.offensiveStrategyName = document.getElementById('offensive-strategy-name');
    this.offensiveTargetDirection = document.getElementById('offensive-target-direction');
    this.offensiveForceSize = document.getElementById('offensive-force-size');
    this.offensiveReasonText = document.getElementById('offensive-reason-text');

    // ─── PS2 Battle Report Modal ───
    this.battleReportModal = document.getElementById('battle-report-modal');
    this.reportMainTitle = document.getElementById('report-main-title');
    this.closeBattleReportBtn = document.getElementById('close-battle-report-btn');
    this.reportTargetSubtitle = document.getElementById('report-target-subtitle');
    this.reportTargetIcon = document.getElementById('report-target-icon');
    this.reportTargetName = document.getElementById('report-target-name');
    this.reportTargetHpText = document.getElementById('report-target-hp-text');
    this.reportTargetHpFill = document.getElementById('report-target-hp-fill');
    this.reportSideATitle = document.getElementById('report-side-a-title');
    this.reportPlayerDeployed = document.getElementById('report-player-deployed');
    this.reportPlayerLosses = document.getElementById('report-player-losses');
    this.reportSideBTitle = document.getElementById('report-side-b-title');
    this.reportEnemyDoctrineIcon = document.getElementById('report-enemy-doctrine-icon');
    this.reportEnemyDoctrineName = document.getElementById('report-enemy-doctrine-name');
    this.reportEnemyDeployed = document.getElementById('report-enemy-deployed');
    this.reportEnemyLosses = document.getElementById('report-enemy-losses');
    this.reportConsequenceText = document.getElementById('report-consequence-text');
    this.reportAdaptationText = document.getElementById('report-adaptation-text');

    // Phase banner & Game over
    this.phaseBanner = document.getElementById('phase-banner');
    this.phaseTitle = document.getElementById('phase-title');
    this.phaseSubtitle = document.getElementById('phase-subtitle');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.gameOverIcon = document.getElementById('game-over-icon');
    this.gameOverTitle = document.getElementById('game-over-title');
    this.gameOverMessage = document.getElementById('game-over-message');
    this.gameOverStats = document.getElementById('game-over-stats');
    this.restartBtn = document.getElementById('restart-btn');

    // AI Disclosure Modal
    this.aiDisclosureModal = document.getElementById('ai-disclosure-modal');
    this.closeDisclosureBtn = document.getElementById('close-disclosure');
    this.aiInfoBtn = document.getElementById('ai-info-btn');

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
    // End turn -> Triggers Enemy Offensive phase
    this.endTurnBtn.addEventListener('click', () => {
      if (this.state.phase === 'player' && !this.state.gameResult) {
        this.endTurnBtn.classList.add('processing');
        this.turnManager.endTurn().then(() => {
          this.endTurnBtn.classList.remove('processing');
          this.update();
        });
      }
    });

    // PS2 Attack Mode Trigger -> Launches dedicated Fullscreen Enemy Assault
    this.attackModeBtn.addEventListener('click', () => {
      this._enterFullscreenAttackMode();
    });

    // PS2 Demo Preset Trigger
    if (this.ps2DemoBtn) {
      this.ps2DemoBtn.addEventListener('click', () => {
        this.state.loadDemoScenario();
        this._renderBuildCards();
        this.update();
        this._enterFullscreenAttackMode();
      });
    }

    // Attack Screen Controls
    if (this.attackRetreatBtn) {
      this.attackRetreatBtn.addEventListener('click', () => {
        this.offensiveSystem.endAssault();
      });
    }

    if (this.attackFinishBtn) {
      this.attackFinishBtn.addEventListener('click', () => {
        this.offensiveSystem.endAssault();
      });
    }

    // Troop Tray Selection
    this.trayCards.forEach(card => {
      card.addEventListener('click', () => {
        const unitType = card.dataset.unit;
        this.trayCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.offensiveSystem.selectTroopType(unitType);
      });
    });

    // Battle Report Return Button
    if (this.closeBattleReportBtn) {
      this.closeBattleReportBtn.addEventListener('click', () => {
        this.battleReportModal.classList.add('hidden');
        this._exitFullscreenAttackMode();
      });
    }

    // Build tabs
    this.buildTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.activeTab = tab.dataset.tab;
        this.buildTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderBuildCards();
      });
    });

    // Strategic map click handler for building placement
    this.state.on('cell_clicked', (cell) => {
      if (this.state.selectedBuilding && this.state.phase === 'player' && !this.state.offensiveState.isAttackMode) {
        const result = this.buildings.placeBuilding(this.state.selectedBuilding, cell.col, cell.row);
        if (result) {
          this.state.selectedBuilding = null;
          this.renderer.clearPlaceablePositions();
          document.querySelectorAll('.build-card').forEach(c => c.classList.remove('selected'));
          this._renderBuildCards();
          this.update();
        }
      }
    });

    // Restart
    this.restartBtn.addEventListener('click', () => {
      this.state.reset();
      this.gameOverModal.classList.add('hidden');
      this._exitFullscreenAttackMode();
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

    // Drawer close / open
    if (this.drawerCloseBtn) this.drawerCloseBtn.addEventListener('click', () => this._closeDrawer());
    if (this.drawerOpenBtn) this.drawerOpenBtn.addEventListener('click', () => this._openDrawer());

    // Battle log collapse
    if (this.battleLogToggle) {
      this.battleLogToggle.addEventListener('click', () => {
        this.battleLogCollapsed = !this.battleLogCollapsed;
        this.leftPanel.classList.toggle('collapsed', this.battleLogCollapsed);
        this.battleLogToggle.textContent = this.battleLogCollapsed ? '+' : '−';
      });
    }
  }

  _setupStateListeners() {
    this.state.on('log', (entry) => this._addLogEntry(entry));
    this.state.on('phase_change', (phase) => {
      this._handlePhaseChange(phase);
      this.update();
    });
    this.state.on('ai_step', (step) => {
      this._highlightPipelineStep(step);
      this._updateMiniPipeline(step);
    });
    this.state.on('combat_resolved', (results) => this._showCombatResults(results));
    this.state.on('offensive_combat_resolved', (report) => this._showBattleReport(report));
    this.state.on('enemy_offensive_incoming', (data) => this._showEnemyOffensiveAlert(data));
    this.state.on('game_over', (data) => this._showGameOver(data));
    this.state.on('building_placed', () => this.update());

    this.state.on('troop_deployed', (data) => {
      this._updateTrayCounts();
      if (this.trayDeployedCounter) {
        this.trayDeployedCounter.textContent = `DEPLOYED: ${data.totalDeployed} TROOPS`;
      }
      this._addAssaultLog(`⚔️ Deployed ${PLAYER_UNITS[data.unit.type]?.name || data.unit.type} into battle.`);
    });

    this.state.on('tactical_damage', (data) => {
      this._addAssaultLog(`💥 ${data.targetName} sustained ${data.damage} damage! ${data.destroyed ? '💥 DESTROYED!' : ''}`);
    });

    this.state.on('ai_defense_step', (step) => {
      if (this.assaultAiAlert) {
        this.assaultAiAlert.classList.remove('hidden');
        const decision = this.state.offensiveState.lastAIDefense;
        if (decision) {
          this.assaultAiDoctrine.textContent = `DOCTRINE: ${decision.strategyName.toUpperCase()} (${decision.source?.toUpperCase() || 'LLM'})`;
          this.assaultAiReason.textContent = `"${decision.reason}"`;
        }
      }
    });
  }

  // ─── Fullscreen Dedicated Enemy Assault Mode ───

  _enterFullscreenAttackMode() {
    this.offensiveSystem.startAssault();

    // Hide normal village UI completely and show Dedicated Assault HUD
    this.uiOverlay.classList.add('hidden');
    this.attackScreenOverlay.classList.remove('hidden');
    this.assaultAiAlert.classList.add('hidden');
    if (this.assaultLogBody) this.assaultLogBody.innerHTML = '';

    this._updateTrayCounts();

    // Default select warrior
    this.trayCards.forEach(c => c.classList.remove('active'));
    document.getElementById('tray-card-warrior')?.classList.add('active');
    this.offensiveSystem.selectTroopType(PLAYER_UNIT_TYPES.WARRIOR);

    if (this.trayDeployedCounter) {
      this.trayDeployedCounter.textContent = `DEPLOYED: 0 TROOPS`;
    }
  }

  _exitFullscreenAttackMode() {
    this.state.offensiveState.isAttackMode = false;
    this.state.phase = 'player';

    this.attackScreenOverlay.classList.add('hidden');
    this.uiOverlay.classList.remove('hidden');
    this._renderBuildCards();
    this.update();
  }

  _updateTrayCounts() {
    const assault = this.offensiveSystem.activeAssault;
    if (!assault) return;

    const counts = assault.availableTroops;
    if (this.trayCountWarrior) this.trayCountWarrior.textContent = counts.warrior || 0;
    if (this.trayCountArcher) this.trayCountArcher.textContent = counts.archer || 0;
    if (this.trayCountDefender) this.trayCountDefender.textContent = counts.defender || 0;
    if (this.trayCountSiege) this.trayCountSiege.textContent = counts.siege || 0;

    document.getElementById('tray-card-warrior')?.classList.toggle('empty', (counts.warrior || 0) <= 0);
    document.getElementById('tray-card-archer')?.classList.toggle('empty', (counts.archer || 0) <= 0);
    document.getElementById('tray-card-defender')?.classList.toggle('empty', (counts.defender || 0) <= 0);
    document.getElementById('tray-card-siege')?.classList.toggle('empty', (counts.siege || 0) <= 0);
  }

  _addAssaultLog(text) {
    if (!this.assaultLogBody) return;
    const div = document.createElement('div');
    div.className = 'assault-log-entry';
    div.textContent = text;
    this.assaultLogBody.appendChild(div);
    this.assaultLogBody.scrollTop = this.assaultLogBody.scrollHeight;
  }

  // ─── Enemy Offensive Alert (Two-Way War) ───

  _showEnemyOffensiveAlert(data) {
    if (!this.enemyOffensiveAlert) return;

    this.offensiveStrategyName.textContent = data.strategy?.name || 'Assault';
    this.offensiveTargetDirection.textContent = `${(data.target || 'north').toUpperCase()} PERIMETER & DEFENSES`;
    this.offensiveForceSize.textContent = `${data.armySize} Attacking Units (${data.threatLevel} THREAT)`;
    this.offensiveReasonText.textContent = `"${data.reason}"`;

    this.enemyOffensiveAlert.classList.remove('hidden');

    setTimeout(() => {
      this.enemyOffensiveAlert.classList.add('hidden');
    }, 2800);
  }

  // ─── Battle Report Display ───

  _showBattleReport(report) {
    this.assaultAiAlert?.classList.add('hidden');
    this.battleReportModal.classList.remove('hidden');

    this.reportMainTitle.textContent = 'BATTLE REPORT — OFFENSIVE ASSAULT';
    this.reportTargetIcon.textContent = report.targetIcon || '🏰';
    this.reportTargetName.textContent = report.targetName;
    this.reportTargetSubtitle.textContent = `Assault on ${report.targetName} — Rating: ${'★'.repeat(report.stars || 1)}${'☆'.repeat(3 - (report.stars || 1))}`;

    const hpPercent = Math.max(0, Math.round((report.targetRemainingHp / report.targetMaxHp) * 100));
    this.reportTargetHpText.textContent = `${report.targetRemainingHp} / ${report.targetMaxHp} HP (-${report.targetDamageTaken} DMG dealt)`;
    this.reportTargetHpFill.style.width = `${hpPercent}%`;
    this.reportTargetHpFill.style.background = report.targetDestroyed ? '#555' : (hpPercent > 50 ? '#2ecc71' : '#e74c3c');

    this.reportPlayerLosses.textContent = `${report.playerTotalLosses} Units Fallen | ${report.playerSurvivors} Survivors`;
    this.reportEnemyLosses.textContent = `${report.enemyTotalLosses} Defenders Slain`;

    this.reportPlayerDeployed.innerHTML = Object.entries(report.playerForceDeployed)
      .filter(([_, c]) => c > 0)
      .map(([type, count]) => `<span>${PLAYER_UNITS[type]?.icon || ''} ${PLAYER_UNITS[type]?.name || type}: ${count} deployed</span>`)
      .join('');

    this.reportEnemyDoctrineIcon.textContent = report.aiDefense?.icon || '🛡️';
    this.reportEnemyDoctrineName.textContent = `${report.aiDefense?.strategyName} (${report.aiDefense?.source?.toUpperCase() || 'LLM'})`;

    this.reportEnemyDeployed.innerHTML = `
      <p class="report-doctrine-reason">"${report.aiDefense?.reason || ''}"</p>
      <div>Defenders: ${Object.entries(report.enemyLossesByType).map(([t, c]) => `${ENEMY_UNITS[t]?.name || t}: ${c} lost`).join(', ')}</div>
    `;

    this.reportConsequenceText.textContent = report.consequence;
    this.reportAdaptationText.textContent = report.aiAdaptation;
  }

  // ─── Drawer Methods ───

  _openDrawer() {
    this.drawerOpen = true;
    this.rightPanel.classList.add('drawer-open');
    this.rightPanel.classList.remove('drawer-closed');
  }

  _closeDrawer() {
    this.drawerOpen = false;
    this.rightPanel.classList.remove('drawer-open');
    this.rightPanel.classList.add('drawer-closed');
  }

  // ─── Update HUD State ───

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

    const isPlayerPhase = this.state.phase === 'player';
    this.endTurnBtn.disabled = !isPlayerPhase || !!this.state.gameResult;
    this.attackModeBtn.disabled = !isPlayerPhase || !!this.state.gameResult;
  }

  _updateEnemyIntel() {
    const statusMap = {
      player: 'Monitoring & Defending',
      attack_mode: 'INVASION IN PROGRESS',
      ai_analyzing: 'ANALYZING FORTRESS...',
      ai_attacking: 'ATTACKING FORTRESS!',
      combat: 'RESOLVING COMBAT',
      resolution: 'Updating...',
    };
    this.aiStatusIndicator.textContent = statusMap[this.state.phase] || 'Monitoring';
    this.aiStatusIndicator.className = `status-${this.state.phase === 'player' ? 'ready' : 'active'}`;

    const totalEnemy = Object.values(this.state.enemyArmy).reduce((s, c) => s + c, 0);
    const maxForce = 35;
    const fillPercent = Math.min(100, (totalEnemy / maxForce) * 100);
    this.forceFill.style.width = `${fillPercent}%`;

    this.enemyUnitCounts.innerHTML = Object.entries(this.state.enemyArmy)
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => {
        const unitDef = ENEMY_UNITS[type];
        return `<span class="enemy-unit-badge">${unitDef?.icon || '?'} ${count}</span>`;
      })
      .join('');

    if (this.enemyTargetsList && this.state.enemyBase?.targets) {
      this.enemyTargetsList.innerHTML = this.state.enemyBase.targets.map(t => {
        const pct = Math.round((t.hp / t.maxHp) * 100);
        return `
          <div class="target-intel-row ${t.status}">
            <span class="t-icon">${t.icon}</span>
            <span class="t-name">${t.name}</span>
            <span class="t-hp">${t.status === 'destroyed' ? '💥 RUINS' : `${t.hp}/${t.maxHp} HP (${pct}%)`}</span>
          </div>
        `;
      }).join('');
    }

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

    if (this.state.lastAIStrategy) {
      const s = this.state.lastAIStrategy;
      this.predictedStrategy.textContent = s.name;
      const conf = Math.floor((s.confidence || 0) * 100);
      this.confidenceFill.style.width = `${conf}%`;
      this.confidenceValue.textContent = `${conf}%`;
    }
  }

  _updateMiniHud() {
    if (!this.miniHud) return;

    const totalEnemy = Object.values(this.state.enemyArmy).reduce((s, c) => s + c, 0);
    let threatLevel = totalEnemy >= 20 ? 'CRITICAL' : totalEnemy >= 12 ? 'HIGH' : totalEnemy >= 6 ? 'MEDIUM' : 'LOW';
    let threatClass = `threat-${threatLevel.toLowerCase()}`;

    if (this.miniThreat) {
      this.miniThreat.textContent = threatLevel;
      this.miniThreat.className = `mini-value ${threatClass}`;
    }

    if (this.miniStrategy) {
      this.miniStrategy.textContent = this.state.lastAIStrategy?.name || 'Preparing...';
    }

    if (this.miniDefenseDoc) {
      const defense = this.state.offensiveState.lastAIDefense;
      this.miniDefenseDoc.textContent = defense ? defense.strategyName : 'Fortify & Hold';
    }

    if (this.miniEmpireStatus && this.state.enemyBase?.targets) {
      const activeTargets = this.state.enemyBase.targets.filter(t => t.status !== 'destroyed').length;
      const totalTargets = this.state.enemyBase.targets.length;
      this.miniEmpireStatus.textContent = `${activeTargets}/${totalTargets} Active`;
    }

    const isActive = this.state.phase.startsWith('ai_');
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

  // ─── Build & Recruit Cards ───

  _renderBuildCards() {
    this.buildCards.innerHTML = '';

    if (this.activeTab === 'build' || this.activeTab === 'defense') {
      const category = this.activeTab === 'build' ? ['economy', 'core'] : ['defense', 'military'];

      for (const [type, def] of Object.entries(BUILDINGS)) {
        if (!category.includes(def.category)) continue;
        if (type === BUILDING_TYPES.TOWN_CENTER) continue;

        const cost = def.levels[0].cost;
        const canAfford = this.state.canAfford(cost);
        const count = this.state.buildings.filter(b => b.type === type).length;
        const atMax = count >= def.maxCount;

        const card = document.createElement('div');
        card.className = `build-card ${!canAfford || atMax ? 'disabled' : ''} ${this.state.selectedBuilding === type ? 'selected' : ''}`;
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

            document.querySelectorAll('.build-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            this.state.log(`📍 Click green highlighted tile to place ${def.name}`, 'player');
          });
        }

        this.buildCards.appendChild(card);
      }
    } else if (this.activeTab === 'units') {
      for (const [type, def] of Object.entries(PLAYER_UNITS)) {
        const canRecruit = this.units.canRecruit(type);
        const count = this.state.playerUnits.filter(u => u.type === type).length;

        const card = document.createElement('div');
        card.className = `build-card unit-card ${!canRecruit ? 'disabled' : ''}`;
        card.innerHTML = `
          <div class="card-header" style="border-left: 3px solid ${def.color}">
            <span class="card-name">${def.icon} ${def.name}</span>
            <span class="card-count">Ready: ${count}</span>
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
        this.buildCards.innerHTML = '<div class="no-upgrades" style="padding: 10px; color: #888; font-size: 11px;">No upgrades available</div>';
      }
    }
  }

  // ─── Battle Log ───

  _addLogEntry(entry) {
    const div = document.createElement('div');
    div.className = `log-entry log-${entry.type}`;
    div.innerHTML = `<span class="log-turn">T${entry.turn}</span> ${entry.message}`;

    if (this.battleLog) {
      this.battleLog.appendChild(div);
      this.battleLog.scrollTop = this.battleLog.scrollHeight;
      while (this.battleLog.children.length > 120) {
        this.battleLog.removeChild(this.battleLog.firstChild);
      }
    }
  }

  // ─── Phase Changes ───

  _handlePhaseChange(phase) {
    if (phase === 'ai_analyzing') {
      this.phaseBanner.classList.remove('hidden');
      this.phaseTitle.textContent = 'ENEMY TURN — RECONNAISSANCE';
      this.phaseSubtitle.textContent = 'AI evaluating fortress defenses & plotting strike vector...';
      this.phaseBanner.className = 'phase-analyzing';
      this.phaseLabel.textContent = 'ENEMY PLANNING';
    } else if (phase === 'ai_attacking') {
      this.phaseTitle.textContent = 'ENEMY OFFENSIVE INCOMING';
      this.phaseSubtitle.textContent = this.state.lastAIStrategy?.name || 'Incoming assault!';
      this.phaseBanner.className = 'phase-attacking';
      this.phaseLabel.textContent = 'DEFEND FORTRESS';
    } else if (phase === 'player') {
      this.phaseBanner.classList.add('hidden');
      this.phaseLabel.textContent = 'STRATEGIC PLANNING';
      this._resetPipelineSteps();
      this._resetMiniPipeline();
      this._closeDrawer();
    }
  }

  _highlightPipelineStep(step) {
    this.pipelineSteps.forEach(el => el.classList.remove('active', 'completed'));
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
    this.pipelineSteps.forEach(el => el.classList.remove('active', 'completed'));
  }

  _showCombatResults(results) {
    if (results.damageToPlayer > 0) {
      this.renderer.shake(results.wallBreached ? 24 : 12);
    }
  }

  _showGameOver(data) {
    this.gameOverModal.classList.remove('hidden');
    this.phaseBanner.classList.add('hidden');

    if (data.result === 'victory') {
      this.gameOverIcon.textContent = '🏆';
      this.gameOverTitle.textContent = 'TOTAL VICTORY!';
      this.gameOverTitle.style.color = '#FFD700';
      this.gameOverMessage.textContent = data.reason || 'You have destroyed the Enemy Stronghold and conquered the realm!';
    } else {
      this.gameOverIcon.textContent = '💀';
      this.gameOverTitle.textContent = 'FORTRESS DESTROYED';
      this.gameOverTitle.style.color = '#E74C3C';
      this.gameOverMessage.textContent = 'Your Town Center has fallen. The enemy overwhelmed your walls.';
    }

    this.gameOverStats.innerHTML = `
      <div class="stat-row"><span>Turns Played</span><span>${this.state.stats.turnsPlayed}</span></div>
      <div class="stat-row"><span>Offensive Strikes Launched</span><span>${this.state.stats.offensiveCampaignsLaunched || 0}</span></div>
      <div class="stat-row"><span>Enemy Structures Destroyed</span><span>${this.state.stats.enemyStructuresDestroyed || 0}</span></div>
      <div class="stat-row"><span>Enemies Killed</span><span>${this.state.stats.enemiesKilled}</span></div>
      <div class="stat-row"><span>Total Damage Dealt</span><span>${Math.floor(this.state.stats.damageDealt)}</span></div>
      <div class="stat-row"><span>Total Damage Taken</span><span>${Math.floor(this.state.stats.damageTaken)}</span></div>
    `;
  }

  init() {
    this._renderBuildCards();
    this.update();
    this.state.log('⚔️ Welcome to Fortress AI — Two-Sided Strategic War!', 'player');
    this.state.log('🏰 Standing Army Ready! Click ATTACK EMPIRE or END TURN to engage the Enemy!', 'neutral');
  }
}
