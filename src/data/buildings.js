// ─── Building Definitions ───────────────────────────────────────
// Every building has 3 levels. Costs, stats, and upgrade requirements are defined here.

export const BUILDING_TYPES = {
  TOWN_CENTER: 'town_center',
  WALL: 'wall',
  ARCHER_TOWER: 'archer_tower',
  CANNON_TOWER: 'cannon_tower',
  BARRACKS: 'barracks',
  RESOURCE_CAMP: 'resource_camp',
  STORAGE: 'storage',
  GATE: 'gate',
};

export const BUILDINGS = {
  [BUILDING_TYPES.TOWN_CENTER]: {
    name: 'Town Center',
    description: 'Heart of your village. If destroyed, you lose.',
    category: 'core',
    maxCount: 1,
    levels: [
      { hp: 500, armor: 5, cost: { gold: 0, wood: 0, stone: 0 }, buildTime: 0, populationBonus: 10, resourceBonus: { gold: 20, food: 10 } },
      { hp: 750, armor: 8, cost: { gold: 500, wood: 200, stone: 300 }, buildTime: 3, populationBonus: 15, resourceBonus: { gold: 30, food: 15 } },
      { hp: 1000, armor: 12, cost: { gold: 800, wood: 350, stone: 500 }, buildTime: 4, populationBonus: 20, resourceBonus: { gold: 45, food: 25 } },
    ],
  },

  [BUILDING_TYPES.WALL]: {
    name: 'Wall',
    description: 'Defensive barrier. Protects against enemy attacks.',
    category: 'defense',
    maxCount: 8, // 2 per side (N/S/E/W)
    levels: [
      { hp: 300, armor: 10, cost: { gold: 100, wood: 50, stone: 150 }, buildTime: 1 },
      { hp: 500, armor: 18, cost: { gold: 200, wood: 80, stone: 250 }, buildTime: 2 },
      { hp: 800, armor: 25, cost: { gold: 350, wood: 120, stone: 400 }, buildTime: 3 },
    ],
  },

  [BUILDING_TYPES.ARCHER_TOWER]: {
    name: 'Archer Tower',
    description: 'Ranged defense. Fires arrows at approaching enemies.',
    category: 'defense',
    maxCount: 4,
    levels: [
      { hp: 200, armor: 3, damage: 15, range: 4, attackSpeed: 1, cost: { gold: 250, wood: 100, stone: 50 }, buildTime: 2 },
      { hp: 300, armor: 5, damage: 25, range: 5, attackSpeed: 1.2, cost: { gold: 400, wood: 150, stone: 80 }, buildTime: 2 },
      { hp: 400, armor: 8, damage: 40, range: 6, attackSpeed: 1.5, cost: { gold: 600, wood: 200, stone: 120 }, buildTime: 3 },
    ],
  },

  [BUILDING_TYPES.CANNON_TOWER]: {
    name: 'Cannon Tower',
    description: 'Heavy defense. Deals splash damage to siege units.',
    category: 'defense',
    maxCount: 3,
    levels: [
      { hp: 250, armor: 5, damage: 30, range: 3, attackSpeed: 0.5, splash: 1, cost: { gold: 350, wood: 80, stone: 200 }, buildTime: 3 },
      { hp: 350, armor: 8, damage: 50, range: 4, attackSpeed: 0.6, splash: 1.5, cost: { gold: 550, wood: 120, stone: 300 }, buildTime: 3 },
      { hp: 500, armor: 12, damage: 75, range: 5, attackSpeed: 0.8, splash: 2, cost: { gold: 800, wood: 180, stone: 450 }, buildTime: 4 },
    ],
  },

  [BUILDING_TYPES.BARRACKS]: {
    name: 'Barracks',
    description: 'Trains military units to defend your village.',
    category: 'military',
    maxCount: 2,
    levels: [
      { hp: 250, armor: 3, cost: { gold: 200, wood: 150, stone: 50 }, buildTime: 2, trainSpeed: 1, unitCapacity: 5 },
      { hp: 350, armor: 5, cost: { gold: 350, wood: 250, stone: 100 }, buildTime: 3, trainSpeed: 1.5, unitCapacity: 8 },
      { hp: 500, armor: 8, cost: { gold: 550, wood: 350, stone: 150 }, buildTime: 3, trainSpeed: 2, unitCapacity: 12 },
    ],
  },

  [BUILDING_TYPES.RESOURCE_CAMP]: {
    name: 'Resource Camp',
    description: 'Generates resources each turn.',
    category: 'economy',
    maxCount: 3,
    levels: [
      { hp: 150, armor: 1, cost: { gold: 150, wood: 100, stone: 0 }, buildTime: 1, resourceBonus: { gold: 30, wood: 20, stone: 15, food: 10 } },
      { hp: 200, armor: 2, cost: { gold: 250, wood: 150, stone: 50 }, buildTime: 2, resourceBonus: { gold: 50, wood: 35, stone: 25, food: 20 } },
      { hp: 300, armor: 3, cost: { gold: 400, wood: 200, stone: 80 }, buildTime: 2, resourceBonus: { gold: 75, wood: 50, stone: 40, food: 30 } },
    ],
  },

  [BUILDING_TYPES.STORAGE]: {
    name: 'Storage',
    description: 'Increases maximum resource capacity.',
    category: 'economy',
    maxCount: 2,
    levels: [
      { hp: 150, armor: 1, cost: { gold: 100, wood: 80, stone: 30 }, buildTime: 1, capacityBonus: { gold: 500, wood: 300, stone: 300, food: 200 } },
      { hp: 200, armor: 2, cost: { gold: 180, wood: 120, stone: 60 }, buildTime: 2, capacityBonus: { gold: 800, wood: 500, stone: 500, food: 350 } },
      { hp: 300, armor: 3, cost: { gold: 300, wood: 180, stone: 100 }, buildTime: 2, capacityBonus: { gold: 1200, wood: 800, stone: 800, food: 500 } },
    ],
  },

  [BUILDING_TYPES.GATE]: {
    name: 'Defensive Gate',
    description: 'Fortified entrance. Slows enemies passing through.',
    category: 'defense',
    maxCount: 2,
    levels: [
      { hp: 250, armor: 8, cost: { gold: 150, wood: 60, stone: 120 }, buildTime: 1, slowEffect: 0.3 },
      { hp: 400, armor: 14, cost: { gold: 280, wood: 100, stone: 200 }, buildTime: 2, slowEffect: 0.5 },
      { hp: 600, armor: 20, cost: { gold: 450, wood: 150, stone: 350 }, buildTime: 3, slowEffect: 0.7 },
    ],
  },
};

// Category colors for UI
export const CATEGORY_COLORS = {
  core: '#FFD700',
  defense: '#E74C3C',
  military: '#3498DB',
  economy: '#2ECC71',
};

// Get building sprite color by category
export function getBuildingColor(type) {
  const building = BUILDINGS[type];
  if (!building) return '#888';
  return CATEGORY_COLORS[building.category] || '#888';
}
