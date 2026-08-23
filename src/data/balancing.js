// ─── Game Balance Constants ───────────────────────────────────────
// All tunable game parameters in one place

export const GAME_CONFIG = {
  // Demo mode enabled for frictionless judging & full feature access
  DEMO_MODE: true,

  // Turn settings
  MAX_TURNS: 20,
  DEMO_START_TURN: 1,

  // Starting resources (Generous for seamless PS2 demonstration)
  STARTING_RESOURCES: {
    gold: 2400,
    wood: 1800,
    stone: 1500,
    food: 1200,
  },

  // Base resource generation per turn (before buildings)
  BASE_INCOME: {
    gold: 45,
    wood: 30,
    stone: 20,
    food: 25,
  },

  // Resource caps (before storage buildings)
  BASE_RESOURCE_CAP: {
    gold: 5000,
    wood: 4000,
    stone: 4000,
    food: 3000,
  },

  // Population
  BASE_POPULATION: 50,
  MAX_POPULATION: 80,

  // Map dimensions (grid cells)
  MAP_COLS: 20,
  MAP_ROWS: 16,
  CELL_SIZE: 48,

  // Village area (center of map for player fortress)
  VILLAGE_BOUNDS: {
    minCol: 5,
    maxCol: 14,
    minRow: 4,
    maxRow: 12,
  },

  // Enemy spawn zones (edges)
  ENEMY_SPAWN: {
    north: { row: 0, colRange: [3, 16] },
    south: { row: 15, colRange: [3, 16] },
    east: { col: 19, rowRange: [3, 12] },
    west: { col: 0, rowRange: [3, 12] },
  },
};

// ─── Combat Formulas ───────────────────────────────────────
export const COMBAT = {
  // damage = baseDamage × levelMultiplier × targetModifier × randomVariance
  LEVEL_MULTIPLIER: [1.0, 1.4, 1.9],
  RANDOM_VARIANCE_MIN: 0.85,
  RANDOM_VARIANCE_MAX: 1.15,

  // Armor damage reduction: effectiveDamage = damage × (100 / (100 + armor))
  ARMOR_FORMULA_BASE: 100,

  // Wall breach threshold
  WALL_BREACH_BONUS_DAMAGE: 1.5,

  // Tower auto-fire priority
  TOWER_FIRE_PRIORITY: ['enemy_siege', 'enemy_melee', 'enemy_ranged'],
};

// ─── AI Difficulty Scaling ───────────────────────────────────────
export const AI_CONFIG = {
  ENEMY_BASE_INCOME: {
    gold: 250,
    reinforcements: 3,
  },

  STARTING_ENEMY_ARMY: {
    enemy_melee: 12,
    enemy_ranged: 8,
    enemy_siege: 3,
  },

  REINFORCEMENT_RATE: {
    enemy_melee: 2,
    enemy_ranged: 1,
    enemy_siege: 0.5,
  },

  STRATEGY_WEIGHTS: {
    targetWeakness: 3.0,
    expectedDamage: 2.0,
    resourceValue: 1.5,
    routeAccessibility: 1.0,
    estimatedLosses: -2.5,
    adaptationBonus: 2.0,
  },

  FIRST_ATTACK_TURN: 3,
  MEMORY_TURNS: 5,

  CONFIDENCE_HIGH: 0.75,
  CONFIDENCE_MEDIUM: 0.5,
  CONFIDENCE_LOW: 0.3,
};

// ─── Predefined Defensive Attack Strategies ──────────────────────────
export const STRATEGIES = {
  EAST_WALL_BREACH: {
    id: 'east_wall_breach',
    name: 'East Wall Breach',
    description: 'Concentrate forces on the eastern wall',
    preferredUnits: { enemy_melee: 0.6, enemy_ranged: 0.2, enemy_siege: 0.2 },
    targetPriority: ['wall_east', 'archer_tower', 'town_center'],
  },
  WEST_WALL_BREACH: {
    id: 'west_wall_breach',
    name: 'West Wall Breach',
    description: 'Concentrate forces on the western wall',
    preferredUnits: { enemy_melee: 0.6, enemy_ranged: 0.2, enemy_siege: 0.2 },
    targetPriority: ['wall_west', 'archer_tower', 'town_center'],
  },
  NORTH_ASSAULT: {
    id: 'north_assault',
    name: 'North Assault',
    description: 'Full frontal assault from the north',
    preferredUnits: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 },
    targetPriority: ['wall_north', 'cannon_tower', 'town_center'],
  },
  SOUTH_ASSAULT: {
    id: 'south_assault',
    name: 'South Assault',
    description: 'Attack from the south',
    preferredUnits: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 },
    targetPriority: ['wall_south', 'cannon_tower', 'town_center'],
  },
  RESOURCE_RAID: {
    id: 'resource_raid',
    name: 'Resource Raid',
    description: 'Target resource buildings to cripple economy',
    preferredUnits: { enemy_melee: 0.7, enemy_ranged: 0.3, enemy_siege: 0.0 },
    targetPriority: ['resource_camp', 'storage', 'town_center'],
  },
  TOWER_SUPPRESSION: {
    id: 'tower_suppression',
    name: 'Tower Suppression',
    description: 'Neutralize defensive towers first',
    preferredUnits: { enemy_melee: 0.3, enemy_ranged: 0.3, enemy_siege: 0.4 },
    targetPriority: ['archer_tower', 'cannon_tower', 'wall'],
  },
  SIEGE_ASSAULT: {
    id: 'siege_assault',
    name: 'Siege Assault',
    description: 'Heavy siege focus to break through walls',
    preferredUnits: { enemy_melee: 0.3, enemy_ranged: 0.2, enemy_siege: 0.5 },
    targetPriority: ['wall', 'gate', 'town_center'],
  },
  DIVERSIONARY: {
    id: 'diversionary',
    name: 'Diversion + Main Strike',
    description: 'Feint at one wall, strike another',
    preferredUnits: { enemy_melee: 0.5, enemy_ranged: 0.3, enemy_siege: 0.2 },
    targetPriority: ['wall', 'town_center'],
    isDiversion: true,
  },
};
