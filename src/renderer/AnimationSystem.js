// ─── Animation System ───────────────────────────────────────
// Manages combat animations: projectiles, unit movements, damage numbers,
// and screen effects. Works with the GameRenderer and ParticleSystem.

export class AnimationSystem {
  constructor(renderer, gameState) {
    this.renderer = renderer;
    this.state = gameState;
    this.queue = [];
    this.isPlaying = false;

    this._setupListeners();
  }

  _setupListeners() {
    // Listen for combat events to queue animations
    this.state.on('combat_resolved', (results) => {
      this._animateCombat(results);
    });

    this.state.on('building_placed', (building) => {
      const screen = this.renderer._cellToScreen(building.col, building.row);
      this.renderer.addFloatingText(building.col, building.row, '✅ Built!', '#2ECC71', 16);
    });

    this.state.on('building_destroyed', (building) => {
      const screen = this.renderer._cellToScreen(building.col, building.row);
      this.renderer.particles.emit(screen.x, screen.y, 'explosion', 25);
      this.renderer.particles.emit(screen.x, screen.y, 'debris', 15);
      this.renderer.particles.emit(screen.x, screen.y, 'smoke', 10);
      this.renderer.shake(18);
      this.renderer.addFloatingText(building.col, building.row, '💥 DESTROYED', '#E74C3C', 22);
    });

    this.state.on('unit_recruited', (unit) => {
      this.renderer.addFloatingText(unit.col, unit.row, '⚔️ Recruited!', '#4FC3F7', 14);
    });

    this.state.on('building_completed', (building) => {
      const screen = this.renderer._cellToScreen(building.col, building.row);
      this.renderer.particles.emit(screen.x, screen.y, 'sparks', 12);
      this.renderer.addFloatingText(building.col, building.row, '🔨 Complete!', '#FFD700', 16);
    });
  }

  /**
   * Animate a full combat resolution
   */
  _animateCombat(results) {
    // Get the combat log from the combat system
    const combatLog = this.renderer.combatAnimations || [];

    // Add tower fire animations
    if (results.damageToEnemy > 0) {
      const towers = this.state.getTowers().filter(t => !t.constructing);
      for (const tower of towers) {
        const type = tower.type.includes('cannon') ? 'cannonball' : 'arrow';
        // Fire towards the enemy spawn direction
        const dir = results.targetDirection || 'north';
        const targetRow = dir === 'north' ? 2 : dir === 'south' ? 14 : 8;
        const targetCol = dir === 'east' ? 18 : dir === 'west' ? 1 : 10;

        this.renderer.addCombatAnimation(
          { col: tower.col, row: tower.row },
          { col: targetCol, row: targetRow },
          type
        );

        // Spawn particles at tower
        const screen = this.renderer._cellToScreen(tower.col, tower.row);
        if (type === 'cannonball') {
          this.renderer.particles.emit(screen.x, screen.y, 'fire', 5);
          this.renderer.particles.emit(screen.x, screen.y, 'smoke', 3);
        }
      }
    }

    // Add damage numbers for player damage
    if (results.damageToPlayer > 0) {
      const dir = results.targetDirection || 'north';
      const vb = { minCol: 5, maxCol: 14, minRow: 4, maxRow: 12 };

      // Place damage numbers near the attacked direction
      let dmgCol, dmgRow;
      switch (dir) {
        case 'north': dmgCol = 10; dmgRow = vb.minRow - 1; break;
        case 'south': dmgCol = 10; dmgRow = vb.maxRow + 1; break;
        case 'east': dmgCol = vb.maxCol + 1; dmgRow = 8; break;
        case 'west': dmgCol = vb.minCol - 1; dmgRow = 8; break;
        default: dmgCol = 10; dmgRow = 3;
      }

      this.renderer.addFloatingText(
        dmgCol, dmgRow,
        `-${Math.floor(results.damageToPlayer)}`,
        '#E74C3C',
        24
      );

      // Screen shake proportional to damage
      this.renderer.shake(Math.min(25, results.damageToPlayer / 10));

      // Fire particles at impact zone
      const impactScreen = this.renderer._cellToScreen(dmgCol, dmgRow);
      this.renderer.particles.emit(impactScreen.x, impactScreen.y, 'fire', 8);
      this.renderer.particles.emit(impactScreen.x, impactScreen.y, 'sparks', 12);
    }

    // Show enemy kills as floating text at spawn zone
    if (results.enemiesKilled > 0) {
      const dir = results.targetDirection || 'north';
      const spawnRow = dir === 'north' ? 1 : dir === 'south' ? 15 : 8;
      const spawnCol = dir === 'east' ? 19 : dir === 'west' ? 0 : 10;

      this.renderer.addFloatingText(
        spawnCol, spawnRow,
        `☠️ ${results.enemiesKilled} killed`,
        '#2ECC71',
        18
      );
    }

    // Wall breach effect
    if (results.wallBreached) {
      this.renderer.shake(25);

      // Big explosion at breached wall
      const dir = results.targetDirection || 'north';
      const vb = { minCol: 5, maxCol: 14, minRow: 4, maxRow: 12 };
      let bCol, bRow;
      switch (dir) {
        case 'north': bCol = 10; bRow = vb.minRow - 1; break;
        case 'south': bCol = 10; bRow = vb.maxRow + 1; break;
        case 'east': bCol = vb.maxCol + 1; bRow = 8; break;
        case 'west': bCol = vb.minCol - 1; bRow = 8; break;
        default: bCol = 10; bRow = 3;
      }

      const breachScreen = this.renderer._cellToScreen(bCol, bRow);
      this.renderer.particles.emit(breachScreen.x, breachScreen.y, 'explosion', 30);
      this.renderer.particles.emit(breachScreen.x, breachScreen.y, 'debris', 20);
      this.renderer.particles.emit(breachScreen.x, breachScreen.y, 'smoke', 15);

      this.renderer.addFloatingText(bCol, bRow, '🔥 WALL BREACHED!', '#FF6B35', 26);
    }
  }
}
