export type Point = { x: number; y: number };
export type Wall = { x: number; y: number; w: number; h: number };
export type Weapon = { name: string; type: 'sword' | 'bow' | 'staff' | 'gloves' | 'armor'; damage: number; defense?: number; durability?: number; color: string };
export type Rarity = { name: string; color: string; bonus: number; tier: number; chance: number };
export type LootDrop = { item: Weapon; rarity: Rarity };
export type EnemyKind = 'slime' | 'goblin' | 'mummy' | 'scorpion' | 'iceGolem' | 'boss';
export type EnemySpawn = Point & { kind: EnemyKind };
export type Decoration = Point & { kind: 'rock' | 'grass' | 'log'; variant: number };
export type EnemyStyle = { color: string; hp: number; power: number; speed: number };
export type LevelConfig = {
  name: string;
  worldWidth: number;
  worldHeight: number;
  round: boolean;
  floor: [string, string, string];
  walls: Wall[];
  chests: Point[];
  carts: Point[];
  enemies: EnemySpawn[];
  decorations: Decoration[];
  loot: Weapon;
  enemy: EnemyStyle;
};
export const WORLD_WIDTH = 7680;
export const ROUTE_WIDTH = 1900;
export const ROUTE_HEIGHT = 672;
export const ROUTE_POINTS: Point[] = [{ x: 90, y: 120 }, { x: 1810, y: 120 }, { x: 1810, y: 336 }, { x: 90, y: 336 }, { x: 90, y: 552 }, { x: 1810, y: 552 }];

export function getTrackY(x: number, level: number) {
  const section = Math.floor(x / 720); const local = (x % 720) / 720; const upper = (section + level - 1) % 2 !== 0; const from = upper ? 105 : 295; const to = upper ? 295 : 105;
  if (local < .9) return from;
  const turn = (local - .9) / .1; return from + (to - from) * (turn * turn * (3 - 2 * turn));
}

export function isInsideFourWayRoute(x: number, y: number) { const horizontal = (Math.abs(y - 120) < 72 || Math.abs(y - 336) < 72 || Math.abs(y - 552) < 72) && x > 32 && x < ROUTE_WIDTH - 32; const vertical = (Math.abs(x - 1810) < 72 && y > 120 && y < 336) || (Math.abs(x - 90) < 72 && y > 336 && y < 552); return horizontal || vertical; }
export function getRouteStart() { return { x: 70, y: 106 }; }
export function getRouteExit() { return { x: 1810, y: 552 }; }

export function getTutorialLevel(): LevelConfig {
  return {
    name: 'Руины Пепельного замка', worldWidth: 1900, worldHeight: 672, round: false,
    floor: ['#252c29', '#2d3531', '#39413b'], loot: { name: 'Клинок пробуждения', type: 'sword', damage: 3, color: '#e4d39a' },
    enemy: { color: '#69ad68', hp: 3, power: 1, speed: .52 },
    walls: [{ x: 0, y: 0, w: 1900, h: 32 }, { x: 0, y: 640, w: 1900, h: 32 }, { x: 0, y: 0, w: 32, h: 672 }, { x: 1868, y: 0, w: 32, h: 672 }, { x: 280, y: 32, w: 48, h: 235 }, { x: 280, y: 405, w: 48, h: 235 }, { x: 560, y: 180, w: 190, h: 44 }, { x: 560, y: 448, w: 190, h: 44 }, { x: 890, y: 32, w: 46, h: 250 }, { x: 890, y: 390, w: 46, h: 250 }, { x: 1210, y: 160, w: 180, h: 44 }, { x: 1210, y: 468, w: 180, h: 44 }, { x: 1510, y: 32, w: 44, h: 238 }, { x: 1510, y: 402, w: 44, h: 238 }],
    chests: [{ x: 650, y: 310 }], carts: [{ x: 430, y: 315 }],
    enemies: [{ x: 1060, y: 305, kind: 'slime' }, { x: 1325, y: 315, kind: 'slime' }, { x: 1420, y: 355, kind: 'goblin' }],
    decorations: [{ x: 110, y: 105, kind: 'rock', variant: 1 }, { x: 190, y: 525, kind: 'log', variant: 2 }, { x: 385, y: 110, kind: 'grass', variant: 0 }, { x: 820, y: 540, kind: 'rock', variant: 3 }, { x: 1010, y: 115, kind: 'log', variant: 1 }, { x: 1160, y: 550, kind: 'grass', variant: 2 }, { x: 1610, y: 105, kind: 'rock', variant: 0 }, { x: 1730, y: 520, kind: 'log', variant: 3 }],
  };
}

const themes: Array<{ name: string; floor: [string, string, string]; loot: Weapon; enemy: EnemyStyle }> = [
  { name: 'Зелёные руины', floor: ['#29443a', '#2d4b40', '#345749'], loot: { name: 'Ржавый клинок', type: 'sword', damage: 2, color: '#dfe8e4' }, enemy: { color: '#69ad68', hp: 3, power: 1, speed: .62 } },
  { name: 'Синие пещеры', floor: ['#263c55', '#2e4863', '#3d5c78'], loot: { name: 'Ледяной лук', type: 'bow', damage: 3, color: '#77d9ff' }, enemy: { color: '#558fe0', hp: 5, power: 1, speed: .70 } },
  { name: 'Фиолетовые катакомбы', floor: ['#3c3048', '#443650', '#51405d'], loot: { name: 'Аметистовая броня', type: 'armor', damage: 0, defense: 1, durability: 3, color: '#bc8cff' }, enemy: { color: '#a35ad1', hp: 7, power: 1, speed: .78 } },
  { name: 'Алая темница', floor: ['#4d292d', '#5b3035', '#713b40'], loot: { name: 'Посох пламени', type: 'staff', damage: 5, color: '#ff6565' }, enemy: { color: '#dc4f59', hp: 9, power: 2, speed: .86 } },
  { name: 'Золотая кузница', floor: ['#554426', '#64502c', '#806538'], loot: { name: 'Солнечный лук', type: 'bow', damage: 7, color: '#ffd85e' }, enemy: { color: '#e2a92f', hp: 12, power: 2, speed: .96 } },
  { name: 'Круг гоблинов', floor: ['#24392b', '#2c4634', '#385a40'], loot: { name: 'Клинок вождя', type: 'sword', damage: 10, color: '#9dff79' }, enemy: { color: '#72b957', hp: 15, power: 2, speed: 1.05 } },
];
const regions = [
  { name: 'Тёмный лес', floor: ['#29443a', '#2d4b40', '#345749'] as [string, string, string], enemy: '#69ad68' },
  { name: 'Жаркая пустыня', floor: ['#8a5b2d', '#a66f35', '#c48b45'] as [string, string, string], enemy: '#d8943f' },
  { name: 'Ледяное кладбище', floor: ['#8fcbe0', '#a9dced', '#d7f4fb'] as [string, string, string], enemy: '#78b9d2' },
  { name: 'Смертельные горы', floor: ['#303944', '#3d4855', '#536170'] as [string, string, string], enemy: '#8096ab' },
  { name: 'Дикий берег', floor: ['#1f5660', '#286b73', '#36848a'] as [string, string, string], enemy: '#51aeb0' },
];

function randomFor(seed: number) {
  let value = seed * 9973 + 17;
  return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
}

const levelSeeds = Array.from({ length: 30 }, (_, index) => index + 1);

/** Creates a new layout for a level while keeping it stable until the next reroll. */
export function rerollLevel(number: number) {
  const index = Math.max(0, Math.min(29, number - 1));
  levelSeeds[index] = Math.floor(Math.random() * 2_000_000_000) + 1;
}

function blocksRouteSpine(wall: Wall) {
  const clearance = 32;
  return ROUTE_POINTS.slice(1).some((point, index) => {
    const previous = ROUTE_POINTS[index];
    const left = Math.min(previous.x, point.x) - clearance;
    const right = Math.max(previous.x, point.x) + clearance;
    const top = Math.min(previous.y, point.y) - clearance;
    const bottom = Math.max(previous.y, point.y) + clearance;
    return wall.x < right && wall.x + wall.w > left && wall.y < bottom && wall.y + wall.h > top;
  });
}

export function getLevel(number: number): LevelConfig {
  const index = Math.max(0, Math.min(29, number - 1)); const regionIndex = Math.floor(index / 6); const localIndex = index % 6; const localNumber = localIndex + 1; const baseTheme = themes[localIndex]; const region = regions[regionIndex]; const theme = { ...baseTheme, name: `${region.name} · ${baseTheme.name}`, floor: region.floor, enemy: { ...baseTheme.enemy, color: region.enemy, hp: baseTheme.enemy.hp + regionIndex * 4, power: baseTheme.enemy.power + Math.floor(regionIndex / 2), speed: baseTheme.enemy.speed + regionIndex * .05 } }; const random = randomFor(levelSeeds[index]);
  const round = localNumber === 6; const worldWidth = round ? 640 : ROUTE_WIDTH; const worldHeight = round ? 672 : ROUTE_HEIGHT;
  const walls: Wall[] = round ? [] : [
    { x: 0, y: 0, w: worldWidth, h: 32 }, { x: 0, y: worldHeight - 32, w: worldWidth, h: 32 },
    { x: 0, y: 0, w: 32, h: worldHeight }, { x: worldWidth - 32, y: 0, w: 32, h: worldHeight },
  ];
  for (let i = 0; i < (round ? 0 : 8 + localIndex * 2); i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const horizontal = random() > .5;
      const candidate = { x: round ? 230 + Math.floor(random() * 6) * 32 : 75 + Math.floor(random() * 54) * 32, y: 55 + Math.floor(random() * (round ? 6 : 17)) * 32, w: horizontal ? 64 + Math.floor(random() * 3) * 32 : 32, h: horizontal ? 32 : 64 + Math.floor(random() * 3) * 32 };
      if (!round && !isInsideFourWayRoute(candidate.x + candidate.w / 2, candidate.y + candidate.h / 2)) continue;
      if (!round && blocksRouteSpine(candidate)) continue;
      if (round && Math.hypot(candidate.x + candidate.w / 2 - 320, candidate.y + candidate.h / 2 - 200) > 105) continue;
      const touchesAnother = walls.slice(4).some((wall) => candidate.x - 24 < wall.x + wall.w && candidate.x + candidate.w + 24 > wall.x && candidate.y - 24 < wall.y + wall.h && candidate.y + candidate.h + 24 > wall.y);
      if (!touchesAnother) { walls.push(candidate); break; }
    }
  }
  const occupied: Point[] = [];
  const safePoint = () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const point = { x: round ? 180 + Math.floor(random() * 9) * 32 : 75 + Math.floor(random() * 54) * 32, y: 55 + Math.floor(random() * (round ? 9 : 17)) * 32 };
      if (round && Math.hypot(point.x + 14 - 320, point.y + 14 - 200) > 135) continue;
      if (!round && !isInsideFourWayRoute(point.x + 14, point.y + 14)) continue;
      const insideWall = walls.some((wall) => point.x + 28 > wall.x - 32 && point.x < wall.x + wall.w + 32 && point.y + 28 > wall.y - 32 && point.y < wall.y + wall.h + 32);
      const reserved = round ? point.x < 215 || point.x > 430 : point.x < 145 && point.y > 140 || point.x > worldWidth - 110 && point.y > 120 && point.y < 270;
      if (!insideWall && !reserved && occupied.every((other) => Math.hypot(point.x - other.x, point.y - other.y) > 50)) { occupied.push(point); return point; }
    }
    return { x: 300, y: 300 };
  };
  const chestCount = round ? 0 : Math.max(1, Math.ceil((2 + Math.floor(random() * 5)) / 3));
  const chests = Array.from({ length: chestCount }, safePoint);
  const carts = round ? [] : Array.from({ length: 7 + localNumber }, (_, cartIndex) => { const lane = cartIndex % 3; return { x: 220 + random() * 1420, y: [102, 318, 534][lane] }; });
  const enemies: EnemySpawn[] = round
    ? [{ x: 320, y: 260, kind: 'boss' }]
    : Array.from({ length: Math.floor((1 + localNumber) * 20 * (regionIndex === 2 ? .4 : 1)) }, (_, index) => ({
      ...safePoint(), kind: index % 4 === 3 ? (regionIndex === 1 ? 'mummy' as const : regionIndex === 2 ? 'iceGolem' as const : 'goblin' as const) : (regionIndex === 1 ? 'scorpion' as const : 'slime' as const),
    }));
  const decorations: Decoration[] = [];
  const decorationCount = round ? 32 : 105;
  for (let i = 0; i < decorationCount; i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const point = { x: 38 + random() * (worldWidth - 76), y: 38 + random() * (worldHeight - 76) };
      if (round && Math.hypot(point.x - 320, point.y - 336) > 300) continue;
      if (!round && !isInsideFourWayRoute(point.x, point.y)) continue;
      const nearWall = walls.slice(4).some((wall) => point.x > wall.x - 18 && point.x < wall.x + wall.w + 18 && point.y > wall.y - 18 && point.y < wall.y + wall.h + 18);
      const nearObject = [...chests, ...carts].some((object) => Math.hypot(point.x - object.x, point.y - object.y) < 38);
      const nearImportantPlace = !round && (Math.hypot(point.x - 90, point.y - 120) < 90 || Math.hypot(point.x - 1810, point.y - 552) < 90);
      if (nearWall || nearObject || nearImportantPlace) continue;
      const roll = random();
      decorations.push({ ...point, kind: roll < .42 ? 'grass' : roll < .76 ? 'rock' : 'log', variant: Math.floor(random() * 4) });
      break;
    }
  }
  const loot = { ...theme.loot };
  return { ...theme, worldWidth, worldHeight, round, floor: [...theme.floor], loot, enemy: { ...theme.enemy }, walls, chests, carts, enemies, decorations };
}

const randomLoot: Array<Weapon & { tier: number }> = [
  { name: 'Стальной меч', type: 'sword', damage: 3, color: '#dfe8e4', tier: 0 },
  { name: 'Охотничий лук', type: 'bow', damage: 3, color: '#85d8a3', tier: 0 },
  { name: 'Рыцарская броня', type: 'armor', damage: 0, durability: 3, color: '#aebbd0', tier: 1 },
  { name: 'Грозовой посох', type: 'staff', damage: 5, color: '#70b7ff', tier: 2 },
  { name: 'Пламенный лук', type: 'bow', damage: 6, color: '#ff854d', tier: 3 },
  { name: 'Теневой клинок', type: 'sword', damage: 8, color: '#c58aff', tier: 4 },
  { name: 'Посох звёзд', type: 'staff', damage: 11, color: '#ff6fae', tier: 5 },
  { name: 'Небесный лук', type: 'bow', damage: 15, color: '#fff39a', tier: 6 },
  { name: 'Кожаные перчатки', type: 'gloves', damage: 1.5, color: '#b9784d', tier: 0 },
  { name: 'Огненные кулаки', type: 'gloves', damage: 2, color: '#ff633d', tier: 2 },
  { name: 'Грозовые кастеты', type: 'gloves', damage: 2.5, color: '#62baff', tier: 3 },
  { name: 'Теневые когти', type: 'gloves', damage: 3, color: '#a95cff', tier: 4 },
  { name: 'Перчатки титана', type: 'gloves', damage: 5, color: '#d3a954', tier: 5 },
];

export function getRandomLoot(level: number): LootDrop {
  const roll = Math.random();
  const rarity: Rarity = roll < .35 ? { name: 'Обычный', color: '#b7b7a8', bonus: 0, tier: 0, chance: 35 }
    : roll < .58 ? { name: 'Необычный', color: '#55c878', bonus: 1, tier: 1, chance: 23 }
      : roll < .76 ? { name: 'Редкий', color: '#4ea1ff', bonus: 2, tier: 2, chance: 18 }
        : roll < .89 ? { name: 'Эпический', color: '#b861e8', bonus: 4, tier: 3, chance: 13 }
          : roll < .96 ? { name: 'Легендарный', color: '#ffb72e', bonus: 7, tier: 4, chance: 7 }
            : roll < .99 ? { name: 'Мифический', color: '#ff4f79', bonus: 10, tier: 5, chance: 3 }
              : { name: 'Божественный', color: '#fff39a', bonus: 15, tier: 6, chance: 1 };
  const available = randomLoot.filter((item) => item.tier <= rarity.tier);
  const item = available[Math.floor(Math.random() * available.length)];
  const levelBonus = Math.floor((level - 1) / 2);
  const result = { ...item, name: `${rarity.name} ${item.name}`, damage: item.type === 'armor' ? 0 : item.damage + levelBonus + rarity.bonus, durability: item.type === 'armor' ? 3 + rarity.bonus : item.durability };
  return { item: result, rarity };
}
