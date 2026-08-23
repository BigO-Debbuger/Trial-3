// ─── Unit Definitions ───────────────────────────────────────
// Player units (defenders) and Enemy units (attackers)

export const PLAYER_UNIT_TYPES = {
  ARCHER: 'archer',
  WARRIOR: 'warrior',
  DEFENDER: 'defender',
};

export const ENEMY_UNIT_TYPES = {
  MELEE: 'enemy_melee',
  RANGED: 'enemy_ranged',
  SIEGE: 'enemy_siege',
};

export const PLAYER_UNITS = {
  [PLAYER_UNIT_TYPES.ARCHER]: {
    name: 'Archer',
    description: 'Ranged defender. Effective against melee units.',
    hp: 60,
    damage: 18,
    armor: 2,
    range: 5,
    attackSpeed: 1.2,
    cost: { gold: 80, food: 20 },
    trainTime: 1,
    populationCost: 1,
    // Combat modifiers vs enemy types
    modifiers: {
      [ENEMY_UNIT_TYPES.MELEE]: 1.3,   // strong vs melee
      [ENEMY_UNIT_TYPES.RANGED]: 0.9,   // neutral vs ranged
      [ENEMY_UNIT_TYPES.SIEGE]: 0.6,    // weak vs siege
    },
    color: '#4FC3F7',
    icon: '🏹',
  },

  [PLAYER_UNIT_TYPES.WARRIOR]: {
    name: 'Warrior',
    description: 'Melee fighter. High damage, moderate defense.',
    hp: 100,
    damage: 25,
    armor: 5,
    range: 1,
    attackSpeed: 1,
    cost: { gold: 100, food: 25 },
    trainTime: 1,
    populationCost: 1,
    modifiers: {
      [ENEMY_UNIT_TYPES.MELEE]: 1.0,
      [ENEMY_UNIT_TYPES.RANGED]: 1.3,   // strong vs ranged
      [ENEMY_UNIT_TYPES.SIEGE]: 1.1,
    },
    color: '#FF7043',
    icon: '⚔️',
  },

  [PLAYER_UNIT_TYPES.DEFENDER]: {
    name: 'Defender',
    description: 'Tank unit. High HP and armor, absorbs damage.',
    hp: 180,
    damage: 10,
    armor: 12,
    range: 1,
    attackSpeed: 0.7,
    cost: { gold: 120, food: 30 },
    trainTime: 2,
    populationCost: 2,
    modifiers: {
      [ENEMY_UNIT_TYPES.MELEE]: 1.2,
      [ENEMY_UNIT_TYPES.RANGED]: 1.0,
      [ENEMY_UNIT_TYPES.SIEGE]: 0.8,
    },
    color: '#66BB6A',
    icon: '🛡️',
  },
};

export const ENEMY_UNITS = {
  [ENEMY_UNIT_TYPES.MELEE]: {
    name: 'Infantry',
    description: 'Fast melee attacker. High numbers, moderate damage.',
    hp: 80,
    damage: 20,
    armor: 3,
    range: 1,
    attackSpeed: 1.1,
    // vs building modifiers
    buildingModifiers: {
      wall: 0.5,          // weak vs walls
      archer_tower: 0.8,
      cannon_tower: 0.7,
      gate: 0.6,
      default: 1.0,
    },
    color: '#EF5350',
    icon: '⚔️',
  },

  [ENEMY_UNIT_TYPES.RANGED]: {
    name: 'Enemy Archer',
    description: 'Ranged attacker. Targets defenders and archers.',
    hp: 55,
    damage: 22,
    armor: 1,
    range: 5,
    attackSpeed: 1.0,
    buildingModifiers: {
      wall: 0.3,
      archer_tower: 1.2,   // targets towers
      cannon_tower: 1.0,
      gate: 0.4,
      default: 0.8,
    },
    color: '#FF8A65',
    icon: '🏹',
  },

  [ENEMY_UNIT_TYPES.SIEGE]: {
    name: 'Siege Engine',
    description: 'Slow but devastating. Destroys walls and buildings.',
    hp: 200,
    damage: 45,
    armor: 8,
    range: 3,
    attackSpeed: 0.4,
    buildingModifiers: {
      wall: 2.0,           // devastating vs walls
      archer_tower: 1.5,
      cannon_tower: 1.3,
      gate: 1.8,
      default: 1.2,
    },
    color: '#B71C1C',
    icon: '🏗️',
  },
};

// Get all unit types
export function getAllPlayerUnits() {
  return Object.entries(PLAYER_UNITS).map(([id, data]) => ({ id, ...data }));
}

export function getAllEnemyUnits() {
  return Object.entries(ENEMY_UNITS).map(([id, data]) => ({ id, ...data }));
}
