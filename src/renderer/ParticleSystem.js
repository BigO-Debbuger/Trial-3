// ─── Particle System ───────────────────────────────────────
// Lightweight particle engine for fire, smoke, sparks, debris

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.maxParticles = 500;
  }

  /**
   * Emit particles at a position
   */
  emit(x, y, type = 'fire', count = 10) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const particle = this._createParticle(x, y, type);
      this.particles.push(particle);
    }
  }

  _createParticle(x, y, type) {
    const base = {
      x,
      y,
      life: 0,
      maxLife: 0.5 + Math.random() * 1,
      alpha: 1,
    };

    switch (type) {
      case 'fire':
        return {
          ...base,
          vx: (Math.random() - 0.5) * 40,
          vy: -30 - Math.random() * 50,
          size: 3 + Math.random() * 5,
          color: Math.random() > 0.5 ? '#FF6B35' : '#FFD700',
          maxLife: 0.3 + Math.random() * 0.5,
          shrink: true,
        };
      case 'smoke':
        return {
          ...base,
          vx: (Math.random() - 0.5) * 20,
          vy: -15 - Math.random() * 25,
          size: 5 + Math.random() * 8,
          color: '#666',
          maxLife: 0.8 + Math.random() * 1,
          shrink: false,
          grow: true,
        };
      case 'sparks':
        return {
          ...base,
          vx: (Math.random() - 0.5) * 100,
          vy: -50 - Math.random() * 80,
          size: 1 + Math.random() * 2,
          color: '#FFD700',
          maxLife: 0.3 + Math.random() * 0.4,
          gravity: 150,
          shrink: true,
        };
      case 'debris':
        return {
          ...base,
          vx: (Math.random() - 0.5) * 80,
          vy: -40 - Math.random() * 60,
          size: 2 + Math.random() * 4,
          color: '#8B7355',
          maxLife: 0.5 + Math.random() * 0.5,
          gravity: 200,
          shrink: false,
        };
      case 'explosion':
        return {
          ...base,
          vx: (Math.random() - 0.5) * 150,
          vy: (Math.random() - 0.5) * 150,
          size: 4 + Math.random() * 8,
          color: Math.random() > 0.3 ? '#FF6B35' : '#FFD700',
          maxLife: 0.2 + Math.random() * 0.4,
          shrink: true,
        };
      default:
        return {
          ...base,
          vx: (Math.random() - 0.5) * 30,
          vy: -20 - Math.random() * 30,
          size: 3,
          color: '#fff',
        };
    }
  }

  /**
   * Update all particles
   */
  update(dt) {
    this.particles = this.particles.filter(p => {
      p.life += dt;

      if (p.life >= p.maxLife) return false;

      // Movement
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;

      // Gravity
      if (p.gravity) {
        p.vy += p.gravity * dt;
      }

      // Size
      const lifePercent = p.life / p.maxLife;
      if (p.shrink) {
        p.currentSize = p.size * (1 - lifePercent);
      } else if (p.grow) {
        p.currentSize = p.size * (1 + lifePercent * 0.5);
      } else {
        p.currentSize = p.size;
      }

      // Alpha fade
      p.alpha = 1 - lifePercent;

      return true;
    });
  }

  /**
   * Render all particles
   */
  render(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.currentSize || p.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Clear all particles
   */
  clear() {
    this.particles = [];
  }
}
