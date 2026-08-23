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
    name: 'Fortified Wall',
    description: 'Defensive perimeter wall. Absorbs incoming enemy siege & melee assaults.',
    category: 'defense',
    maxCount: 24, // Ample capacity for all perimeter sides
    levels: [
      { hp: 400, armor: 12, cost: { gold: 80, wood: 40, stone: 100 }, buildTime: 0 },
      { hp: 700, armor: 20, cost: { gold: 180, wood: 70, stone: 200 }, buildTime: 2 },
      { hp: 1100, armor: 28, cost: { gold: 300, wood: 100, stone: 350 }, buildTime: 3 },
    ],
  },

  [BUILDING_TYPES.ARCHER_TOWER]: {
    name: 'Archer Tower',
    description: 'Ranged defense. Fires arrows at approaching enemies.',
    category: 'defense',
    maxCount: 6,
    levels: [
      { hp: 200, armor: 3, damage: 15, range: 4, attackSpeed: 1, cost: { gold: 250, wood: 100, stone: 50 }, buildTime: 0 },
      { hp: 300, armor: 5, damage: 25, range: 5, attackSpeed: 1.2, cost: { gold: 400, wood: 150, stone: 80 }, buildTime: 2 },
      { hp: 400, armor: 8, damage: 40, range: 6, attackSpeed: 1.5, cost: { gold: 600, wood: 200, stone: 120 }, buildTime: 3 },
    ],
  },

  [BUILDING_TYPES.CANNON_TOWER]: {
    name: 'Cannon Tower',
    description: 'Heavy defense. Deals splash damage to siege units.',
    category: 'defense',
    maxCount: 4,
    levels: [
      { hp: 250, armor: 5, damage: 30, range: 3, attackSpeed: 0.5, splash: 1, cost: { gold: 350, wood: 80, stone: 200 }, buildTime: 0 },
      { hp: 350, armor: 8, damage: 50, range: 4, attackSpeed: 0.6, splash: 1.5, cost: { gold: 550, wood: 120, stone: 300 }, buildTime: 3 },
      { hp: 500, armor: 12, damage: 75, range: 5, attackSpeed: 0.8, splash: 2, cost: { gold: 800, wood: 180, stone: 450 }, buildTime: 4 },
    ],
  },

  [BUILDING_TYPES.BARRACKS]: {
    name: 'Barracks',
    description: 'Trains military units. Higher levels unlock advanced units.',
    category: 'military',
    maxCount: 2,
    levels: [
      { hp: 300, armor: 3, cost: { gold: 200, wood: 150, stone: 100 }, buildTime: 0, unlocks: ['warrior', 'archer'] },
      { hp: 500, armor: 6, cost: { gold: 450, wood: 250, stone: 200 }, buildTime: 3, unlocks: ['defender'] },
      { hp: 750, armor: 10, cost: { gold: 700, wood: 400, stone: 350 }, buildTime: 4, unlocks: ['siege'] },
    ],
  },

  [BUILDING_TYPES.RESOURCE_CAMP]: {
    name: 'Resource Camp',
    description: 'Generates extra resources each turn.',
    category: 'economy',
    maxCount: 4,
    levels: [
      { hp: 150, armor: 1, cost: { gold: 100, wood: 80, stone: 30 }, buildTime: 0, resourceBonus: { gold: 15, wood: 10, stone: 8, food: 10 } },
      { hp: 250, armor: 3, cost: { gold: 250, wood: 150, stone: 80 }, buildTime: 2, resourceBonus: { gold: 30, wood: 20, stone: 15, food: 20 } },
      { hp: 400, armor: 5, cost: { gold: 450, wood: 250, stone: 150 }, buildTime: 3, resourceBonus: { gold: 50, wood: 35, stone: 25, food: 35 } },
    ],
  },

  [BUILDING_TYPES.STORAGE]: {
    name: 'Storage Vault',
    description: 'Increases maximum resource capacity.',
    category: 'economy',
    maxCount: 2,
    levels: [
      { hp: 200, armor: 4, cost: { gold: 150, wood: 120, stone: 80 }, buildTime: 0, capBonus: { gold: 1000, wood: 800, stone: 800, food: 500 } },
      { hp: 350, armor: 7, cost: { gold: 300, wood: 200, stone: 150 }, buildTime: 2, capBonus: { gold: 2000, wood: 1500, stone: 1500, food: 1000 } },
      { hp: 500, armor: 10, cost: { gold: 500, wood: 300, stone: 250 }, buildTime: 3, capBonus: { gold: 3500, wood: 2500, stone: 2500, food: 2000 } },
    ],
  },

  [BUILDING_TYPES.GATE]: {
    name: 'Fortified Gate',
    description: 'Reinforced passage in walls. Allows player units to pass through.',
    category: 'defense',
    maxCount: 4,
    levels: [
      { hp: 350, armor: 8, cost: { gold: 150, wood: 80, stone: 100 }, buildTime: 0 },
      { hp: 600, armor: 15, cost: { gold: 300, wood: 120, stone: 200 }, buildTime: 2 },
      { hp: 900, armor: 22, cost: { gold: 500, wood: 180, stone: 300 }, buildTime: 3 },
    ],
  },
};

export const CATEGORY_COLORS = {
  core: '#FFD700',
  defense: '#4FC3F7',
  military: '#EF5350',
  economy: '#66BB6A',
};

export function getBuildingColor(type) {
  const def = BUILDINGS[type];
  return def ? CATEGORY_COLORS[def.category] || '#FFF' : '#FFF';
}
