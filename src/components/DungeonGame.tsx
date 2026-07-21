import { useEffect, useRef, useState } from 'react';
import { getLevel, getRandomLoot, getRouteExit, getRouteStart, getTutorialLevel, isInsideFourWayRoute, rerollLevel, ROUTE_POINTS, type EnemyKind, type LootDrop, type Point, type Weapon } from '../game/levels';
import { playFootstep, playHurt, setMusicDanger } from '../game/audio';
import { CANONICAL_CONTROL_CODES, DEFAULT_KEY_BINDINGS, type KeyBindings } from '../game/controls';
import { CastleGuardDialogue } from './CastleGuardDialogue';

export type GameSave = { level: number; players: 1 | 2; health: number; health2: number; coins: number; medkits?: number; medkits2?: number; inventory: Weapon[]; inventory2: Weapon[]; inventoryCapacity: number; inventoryCapacity2: number; weapon: Weapon | null; weapon2: Weapon | null; armor: Weapon | null; armor2?: Weapon | null; armorHealth: number; armorHealth2?: number; map: ReturnType<typeof getLevel>; hero: Point; hero2: Point; enemies: Enemy[]; openedChests: number[]; chestDrops: LootDrop[]; loot: Point | null; droppedItem: Weapon | null; explored?: Point[]; savedAt: number };

export type Enemy = Point & { kind: EnemyKind; hp: number; maxHp: number; flash: number; attackUntil: number; stunnedUntil: number; color: string; power: number; speed: number; leapStarted: number; leapUntil: number; leapTargetX: number; leapTargetY: number; nextLeapAt: number; hiddenInRock?: boolean; nextShotAt?: number; nextSummonAt?: number; nextContactAt?: number; playerWasInSummonRadius?: boolean; revived?: boolean; reviveFlashUntil?: number; swallowUntil?: number; swallowedPlayer?: 1 | 2; swallowDamageDone?: boolean; thrownStarted?: number; thrownUntil?: number; thrownStartX?: number; thrownStartY?: number; thrownTargetX?: number; thrownTargetY?: number };
export type NetworkGameState = { sender: 'host' | 'guest'; level: number; map?: ReturnType<typeof getLevel>; enemies: Enemy[]; openedChests: number[]; chestDrops: LootDrop[]; loot: Point | null; droppedItem: Weapon | null; sentAt: number };
type Projectile = Point & { vx: number; vy: number; damage: number; color: string };
type SuperFist = Point & { vx: number; vy: number; damage: number; hitTargets: Enemy[] };
type SwordUltimate = Point & { owner: 1 | 2; started: number; impactAt: number; until: number; color: string; name: string; damageApplied: boolean };
type RainArrow = Point & { started: number; impactAt: number; damaged: boolean };
type BowUltimate = Point & { owner: 1 | 2; started: number; rainStarted: number; until: number; nextArrowAt: number; color: string; name: string; arrows: RainArrow[] };
type StaffPulse = { started: number; damage: number };
type StaffUltimate = Point & { owner: 1 | 2; dx: number; dy: number; started: number; until: number; nextPulseAt: number; pulseIndex: number; kills: number; color: string; name: string; pulses: StaffPulse[] };
type GlovesUltimate = Point & { owner: 1 | 2; dx: number; dy: number; started: number; until: number; nextHitAt: number; hitIndex: number; damage: number; color: string; name: string; titanTargetX: number; titanTargetY: number; landed: boolean };
type MagicWave = Point & { dx: number; dy: number; color: string; started: number; until: number };
type SandTornado = Point & { vx: number; vy: number; damage: number; until: number; style?: 'sand' | 'ice' | 'iceRing' | 'iceSpiritDrop' | 'iceLarge' | 'iceShard' | 'frogTongue' | 'snake' | 'spear' | 'blood'; impactAt?: number; split?: boolean; source?: Enemy; startedAt?: number; tongueDx?: number; tongueDy?: number; tongueLength?: number; hitPlayer1?: boolean; hitPlayer2?: boolean };
type Tomb = Point & { spawnedAt: number; sinksAt: number };
type HeroSkin = 'default' | 'knight' | 'ninja' | 'dune' | 'king' | 'wizard' | 'gentleman';
type PlayerClass = 'knight' | 'mage' | 'archer' | 'boxer';
const MERCHANT = Object.freeze({ x: 500, y: 330, hitbox: Object.freeze({ x: 493, y: 310, w: 58, h: 64 }) });
function getTutorialClassLoot(playerClass: PlayerClass): LootDrop { const items: Record<PlayerClass, Weapon> = { knight: { name: 'Учебный меч', type: 'sword', damage: 2, color: '#dfe8e4' }, mage: { name: 'Учебный посох', type: 'staff', damage: 2, color: '#86bfff' }, archer: { name: 'Учебный лук', type: 'bow', damage: 2, color: '#85d8a3' }, boxer: { name: 'Учебные перчатки', type: 'gloves', damage: 2, color: '#c98355' } }; return { item: items[playerClass], rarity: { name: 'Обычный', color: '#b7b7a8', bonus: 0, tier: 0, chance: 100 } }; }

function segmentHitsRect(from: Point, to: Point, rect: { x: number; y: number; w: number; h: number }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  for (let step = 1; step < 20; step++) { const t = step / 20, x = from.x + dx * t, y = from.y + dy * t; if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return true; }
  return false;
}

function actorInsideRoute(x: number, y: number, width: number, height: number) {
  const inset = 3;
  return [
    { x: x + inset, y: y + inset },
    { x: x + width - inset, y: y + inset },
    { x: x + inset, y: y + height - inset },
    { x: x + width - inset, y: y + height - inset },
    { x: x + width / 2, y: y + height / 2 },
  ].every((point) => isInsideFourWayRoute(point.x, point.y));
}

function isInRouteSafeLane(x: number, y: number, clearance = 34) {
  return ROUTE_POINTS.slice(1).some((end, index) => {
    const start = ROUTE_POINTS[index], dx = end.x - start.x, dy = end.y - start.y, lengthSquared = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / Math.max(1, lengthSquared)));
    return Math.hypot(x - (start.x + dx * t), y - (start.y + dy * t)) <= clearance;
  });
}

const WIDTH = 640;
const HEIGHT = 400;
const ONE_GAME_SWORD: Weapon = { name: 'Клинок испытателя', type: 'sword', damage: 20, color: '#f6d66b' };
const ONE_GAME_ARMOR: Weapon = { name: 'Броня испытателя', type: 'armor', damage: 0, defense: 20, durability: 20, color: '#76c9e8' };
const ONE_GAME_LOADOUT_KEY = 'air-impairs-one-game-loadout-2026-07-21';
const BOSS_HITBOX_RADIUS = 55;
function enemyHitRadius(enemy: Enemy) { return enemy.kind === 'boss' ? BOSS_HITBOX_RADIUS : enemy.kind === 'goblin' || enemy.kind === 'monkey' || enemy.kind === 'nativeSpear' || enemy.kind === 'nativeClub' || enemy.kind === 'nativeAxe' || enemy.kind === 'mummy' || enemy.kind === 'iceGolem' || enemy.kind === 'mudMonster' ? 18 : 14; }
function bossBodyHits(point: Point, enemy: Enemy, extraRadius = 0) { const dx = point.x - enemy.x; return Math.abs(dx) <= 52 + extraRadius && point.y >= enemy.y - 92 - extraRadius && point.y <= enemy.y - 24 + extraRadius; }
function pointHitsEnemy(point: Point, enemy: Enemy, extraRadius = 0) {
  if (enemy.kind === 'mudPile' || enemy.hiddenInRock) return false;
  const dx = point.x - enemy.x, y = point.y;
  if (enemy.kind === 'boss') {
    const limbPadding = 3.2;
    const head = Math.abs(dx) <= 45 + limbPadding + extraRadius && y >= enemy.y - 175 - limbPadding - extraRadius && y <= enemy.y - 88 + limbPadding + extraRadius;
    const torso = Math.abs(dx) <= 52 + extraRadius && y >= enemy.y - 92 - extraRadius && y <= enemy.y - 24 + extraRadius;
    const arms = Math.abs(dx) >= 47 - limbPadding - extraRadius && Math.abs(dx) <= 75 + limbPadding + extraRadius && y >= enemy.y - 94 - limbPadding - extraRadius && y <= enemy.y - 24 + limbPadding + extraRadius;
    const legs = Math.abs(dx) <= 50 + limbPadding + extraRadius && y >= enemy.y - 29 - limbPadding - extraRadius && y <= enemy.y + 2 + limbPadding + extraRadius;
    return head || torso || arms || legs;
  }
  return Math.hypot(dx, enemy.y - y) <= enemyHitRadius(enemy) + extraRadius;
}
function meleeHitsEnemy(origin: Point, facing: Point, reach: number, enemy: Enemy) {
  if (enemy.kind === 'mudPile' || enemy.hiddenInRock) return false;
  if (enemy.kind !== 'boss') { const dx = enemy.x - origin.x, dy = enemy.y - origin.y, distance = Math.max(1, Math.hypot(dx, dy)); return distance <= reach + enemyHitRadius(enemy) && (dx * facing.x + dy * facing.y) / distance > .2; }
  const rectangles = [
    { x: enemy.x - 48.2, y: enemy.y - 178.2, w: 96.4, h: 93.4 },
    { x: enemy.x - 52, y: enemy.y - 92, w: 104, h: 68 },
    { x: enemy.x - 78.2, y: enemy.y - 97.2, w: 31.4, h: 76.4 }, { x: enemy.x + 46.8, y: enemy.y - 97.2, w: 31.4, h: 76.4 },
    { x: enemy.x - 53.2, y: enemy.y - 32.2, w: 106.4, h: 37.4 },
  ];
  return rectangles.some((rect) => { const hitX = Math.max(rect.x, Math.min(origin.x, rect.x + rect.w)), hitY = Math.max(rect.y, Math.min(origin.y, rect.y + rect.h)); const dx = hitX - origin.x, dy = hitY - origin.y, distance = Math.max(1, Math.hypot(dx, dy)); return distance <= reach && (dx * facing.x + dy * facing.y) / distance > -.05; });
}
function pixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size = 8) {
  ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), size, size);
}

function drawPixelFistIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.fillRect(x - 10, y - 8, 20, 18); ctx.fillRect(x - 7, y + 8, 14, 10);
  ctx.fillRect(x - 13, y - 13, 6, 11); ctx.fillRect(x - 6, y - 16, 6, 12); ctx.fillRect(x + 1, y - 16, 6, 12); ctx.fillRect(x + 8, y - 12, 6, 12);
  ctx.restore();
}

function drawPixelSwordIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.75); ctx.fillStyle = '#6a3f25'; ctx.fillRect(-4, 8, 8, 15); ctx.fillStyle = '#e5bd57'; ctx.fillRect(-11, 5, 22, 5); ctx.fillStyle = color; ctx.fillRect(-5, -20, 10, 27); ctx.fillStyle = '#fff5cf'; ctx.fillRect(-3, -18, 3, 21); ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(0, -29); ctx.lineTo(5, -20); ctx.fill(); ctx.restore();
}

function drawPixelBowIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-5, 0, 20, -1.15, 1.15); ctx.stroke(); ctx.strokeStyle = '#f4e8c7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(3, -18); ctx.lineTo(-2, 0); ctx.lineTo(3, 18); ctx.stroke(); ctx.fillStyle = '#d7a057'; ctx.fillRect(-4, -2, 27, 4); ctx.fillStyle = color; ctx.fillRect(17, -4, 8, 8); ctx.restore();
}

function drawPixelStaffIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) { ctx.save(); ctx.translate(x, y); ctx.rotate(-.65); ctx.fillStyle = '#75482c'; ctx.fillRect(-3, -22, 6, 43); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -24, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -27, 4, 4); ctx.restore(); }

function drawDecoration(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'rock' | 'grass' | 'log', variant: number, desert = false, ice = false, jungle = false) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (ice && kind === 'rock') {
    const size = 10 + variant * 2; ctx.fillStyle = 'rgba(22,62,85,.28)'; ctx.fillRect(-size - 3, 7, size * 2 + 8, 5);
    ctx.fillStyle = '#5ba7c9'; ctx.beginPath(); ctx.moveTo(-size,7); ctx.lineTo(-size+3,-5); ctx.lineTo(1,-11); ctx.lineTo(size+3,-2); ctx.lineTo(size+5,7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aeeaff'; ctx.beginPath(); ctx.moveTo(-size+4,-3); ctx.lineTo(0,-8); ctx.lineTo(size-1,-1); ctx.lineTo(2,1); ctx.closePath(); ctx.fill(); ctx.fillStyle='#effcff';ctx.fillRect(-2,-8,5,3);
  } else if (ice && kind === 'log') {
    ctx.fillStyle='rgba(20,55,76,.3)';ctx.fillRect(-18,12,38,5);ctx.fillStyle='#4f7890';ctx.fillRect(-14,-15,30,29);ctx.fillStyle='#9ed7e9';ctx.fillRect(-11,-12,24,23);ctx.fillStyle='#dff8ff';ctx.fillRect(-8,-9,5,15);
    ctx.fillStyle='#44677b';ctx.fillRect(-5,-5,12,3);ctx.fillRect(-1,-10,4,14);ctx.fillStyle='#77bcd6';ctx.fillRect(-17,9,36,6);ctx.fillStyle='#eefcff';ctx.fillRect(-12,8,26,3);
  } else if (desert && kind === 'rock') {
    const size = 11 + variant * 2; ctx.fillStyle = 'rgba(70,38,12,.22)'; ctx.beginPath(); ctx.ellipse(2, 7, size + 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c99047'; ctx.beginPath(); ctx.moveTo(-size - 4, 7); ctx.quadraticCurveTo(-size / 2, -3, 0, 3); ctx.quadraticCurveTo(size / 2, -8, size + 7, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e2b263'; ctx.beginPath(); ctx.moveTo(-size + 2, 4); ctx.quadraticCurveTo(-2, -1, 7, 3); ctx.lineTo(13, 7); ctx.lineTo(-size + 1, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f1cb80'; ctx.fillRect(-2, 0, 5, 2); ctx.fillRect(size - 3, 4, 3, 2);
  } else if (desert && kind === 'log') {
    ctx.strokeStyle = '#594126'; ctx.lineWidth = 4; ctx.lineCap = 'square';
    [[-1,8,-2,-10],[-2,-1,-14,-11],[-3,1,11,-12],[-9,-6,-18,-2],[7,-7,17,-3],[-11,-9,-15,-17],[11,-10,15,-18]].forEach(([x1,y1,x2,y2]) => { ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); });
    ctx.strokeStyle = '#947044'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-1,8); ctx.lineTo(-2,-10); ctx.stroke(); ctx.fillStyle = 'rgba(55,29,9,.25)'; ctx.fillRect(-20,9,40,4);
  } else if (jungle && kind === 'grass') {
    ctx.fillStyle='rgba(2,12,6,.36)';ctx.fillRect(-23,12,48,7);ctx.fillStyle=variant%2?'#245f35':'#2d7240';ctx.fillRect(-20,-2,42,16);ctx.fillRect(-14,-12,29,25);ctx.fillRect(-4,-18,17,28);ctx.fillStyle='#439553';ctx.fillRect(-15,-7,14,8);ctx.fillRect(4,-13,13,9);ctx.fillRect(11,1,10,7);ctx.fillStyle='#75bd67';ctx.fillRect(-8,-9,5,4);ctx.fillRect(8,-4,5,4);
  } else if (kind === 'grass') {
    ctx.fillStyle = ice ? 'rgba(25,92,125,.3)' : 'rgba(3,10,6,.25)'; ctx.fillRect(-10, 8, 22, 4);
    ctx.strokeStyle = ice ? (variant % 2 ? '#65c9ed' : '#a9efff') : desert ? (variant % 2 ? '#c99a32' : '#e0b84c') : (variant % 2 ? '#4f8448' : '#5d984e'); ctx.lineWidth = 3; ctx.lineCap = 'square';
    [-8, -3, 2, 7].forEach((offset, index) => { ctx.beginPath(); ctx.moveTo(offset, 9); ctx.lineTo(offset + (index % 2 ? 5 : -4), -4 - (index % 3) * 3); ctx.stroke(); });
    ctx.fillStyle = ice ? '#f5feff' : desert ? '#f2d36b' : '#8fbd62'; ctx.fillRect(-1, -8, 3, 4); if (ice) { ctx.fillRect(-12, -4, 3, 3); ctx.fillRect(10, -7, 3, 3); }
  } else if (jungle && kind === 'rock') {
    const size=9+variant*2;ctx.fillStyle='rgba(0,0,0,.3)';ctx.fillRect(-size,6,size*2+5,6);if(variant>=2){ctx.strokeStyle='#2f9b45';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-4,1);ctx.quadraticCurveTo(4,-14,13,-3);ctx.stroke();ctx.fillStyle='#65d567';ctx.fillRect(10,-7,7,6);ctx.fillStyle='#152819';ctx.fillRect(14,-5,2,2);}ctx.fillStyle='#46534d';ctx.beginPath();ctx.moveTo(-size,7);ctx.lineTo(-size+3,-4);ctx.lineTo(3,-9);ctx.lineTo(size,-2);ctx.lineTo(size+2,7);ctx.closePath();ctx.fill();ctx.fillStyle='#718078';ctx.fillRect(-size+4,-3,size,4);
  } else if (kind === 'rock') {
    const size = 9 + variant * 2; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(-size, 6, size * 2 + 5, 6);
    ctx.fillStyle = '#46534d'; ctx.beginPath(); ctx.moveTo(-size, 7); ctx.lineTo(-size + 3, -4); ctx.lineTo(3, -9); ctx.lineTo(size, -2); ctx.lineTo(size + 2, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#718078'; ctx.fillRect(-size + 4, -3, size, 4); ctx.fillStyle = '#89958e'; ctx.fillRect(-size + 5, -5, 5, 3);
  } else {
    ctx.rotate((variant - 1.5) * .16); ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(-18, 7, 39, 6);
    ctx.fillStyle = '#51311e'; ctx.fillRect(-18, -5, 36, 14); ctx.fillStyle = '#80502c'; ctx.fillRect(-15, -3, 30, 5);
    ctx.fillStyle = '#b68148'; ctx.beginPath(); ctx.arc(18, 2, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#5d371f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(18, 2, 3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#4f7c3d'; ctx.fillRect(-11, -9, 8, 4);
  }
  ctx.restore();
}
function drawPixelGlovesIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) { drawPixelFistIcon(ctx, x - 8, y, color); drawPixelFistIcon(ctx, x + 9, y + 4, color, .9); }

function drawStaffUltimate(ctx: CanvasRenderingContext2D, ultimate: StaffUltimate, now: number) {
  const angle = Math.atan2(ultimate.dy, ultimate.dx); const flame = ultimate.name.includes('пламени'); const storm = ultimate.name.includes('Грозовой');
  ultimate.pulses.forEach((pulse, index) => { const progress = Math.min(1, (now - pulse.started) / 520); ctx.save(); ctx.translate(ultimate.x, ultimate.y); ctx.rotate(angle); ctx.globalAlpha = 1 - progress; ctx.fillStyle = flame ? '#ff5b35' : storm ? '#5ab7ff' : '#b766ff'; ctx.fillRect(18 + progress * 85, -46 - index * 3, 36, 92 + index * 6); ctx.strokeStyle = ultimate.color; ctx.lineWidth = 5; ctx.strokeRect(12 + progress * 110, -50, 45, 100); for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#fff' : ultimate.color; const px = 25 + progress * 120 + i * 13; const py = Math.sin(i * 2.3 + now / 90) * 38; if (storm) { ctx.fillRect(px, py, 12, 3); ctx.fillRect(px + 7, py - 7, 3, 10); } else if (flame) ctx.fillRect(px, py - 8, 7, 15); else { ctx.fillRect(px - 4, py - 1, 10, 3); ctx.fillRect(px - 1, py - 5, 3, 10); } } ctx.restore(); });
}

function drawGlovesUltimate(ctx: CanvasRenderingContext2D, ultimate: GlovesUltimate, now: number) { const titan = ultimate.name.includes('титана'); ctx.save(); if (titan) { const impact = ultimate.landed ? Math.min(1, (now - ultimate.started - 520) / 350) : 0; ctx.translate(ultimate.titanTargetX, ultimate.titanTargetY); ctx.globalAlpha = ultimate.landed ? 1 - impact : .35; ctx.strokeStyle = ultimate.color; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 16 + impact * 22, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; ctx.fillStyle = '#806846'; ctx.fillRect(Math.cos(a) * (12 + impact * 18) - 4, Math.sin(a) * (12 + impact * 18) - 7, 8, 12); } } else { const progress = (now - ultimate.started) / Math.max(1, ultimate.until - ultimate.started); ctx.translate(ultimate.x, ultimate.y); ctx.rotate(Math.atan2(ultimate.dy, ultimate.dx)); for (let i = 0; i < 12; i++) { const x = 25 + (i % 4) * 23 + Math.sin(now / 70 + i) * 7; const y = -42 + Math.floor(i / 4) * 40; drawPixelFistIcon(ctx, x, y, i % 3 === 0 ? ultimate.color : i % 3 === 1 ? '#ffcf66' : '#c86cff', .35 + (1 - progress) * .5); } } ctx.restore(); }

function drawBowUltimate(ctx: CanvasRenderingContext2D, ultimate: BowUltimate, now: number) {
  const ice = ultimate.name.includes('Ледяной'); const hunter = ultimate.name.includes('Охотничий'); const flame = ultimate.name.includes('Пламенный'); const sun = ultimate.name.includes('Солнечный'); const sky = ultimate.name.includes('Небесный');
  const accent = ice ? '#d9f7ff' : hunter ? '#b8ed83' : flame ? '#ffcf55' : sun ? '#fff19a' : sky ? '#ffffff' : ultimate.color;
  ctx.save(); ctx.globalAlpha = now < ultimate.rainStarted ? .12 : .2; ctx.fillStyle = ultimate.color; ctx.fillRect(ultimate.x - 64, ultimate.y - 64, 128, 128);
  ctx.strokeStyle = ultimate.color; ctx.lineWidth = 3; ctx.setLineDash([8, 5]); ctx.globalAlpha = now < ultimate.rainStarted ? .45 : .85; ctx.strokeRect(ultimate.x - 64, ultimate.y - 64, 128, 128); ctx.setLineDash([]);
  for (let i = 0; i < 12; i++) { const phase = now / 350 + i * 1.7; const px = ultimate.x + Math.sin(phase * 1.3) * 56; const py = ultimate.y + Math.cos(phase) * 56; ctx.globalAlpha = .65; ctx.fillStyle = accent; if (ice) { ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); } else if (hunter) { ctx.fillRect(px - 4, py - 2, 8, 4); } else if (flame) { ctx.fillRect(px - 2, py - 6, 5, 9); ctx.fillStyle = '#ff5a35'; ctx.fillRect(px - 1, py - 3, 3, 5); } else if (sun) { ctx.fillRect(px - 5, py - 1, 10, 3); ctx.fillRect(px - 1, py - 5, 3, 10); } else if (sky) { ctx.fillRect(px - 5, py - 1, 10, 3); ctx.fillRect(px - 1, py - 5, 3, 10); ctx.fillStyle = '#9fd7ff'; ctx.fillRect(px - 1, py - 1, 3, 3); } }
  ultimate.arrows.forEach((arrow) => { const progress = Math.min(1, (now - arrow.started) / (arrow.impactAt - arrow.started)); const y = arrow.y - 82 + progress * 82; ctx.globalAlpha = 1; ctx.fillStyle = accent; ctx.fillRect(arrow.x - 2, y - 18, 4, 21); ctx.fillStyle = ultimate.color; ctx.fillRect(arrow.x - 5, y, 10, 7); if (flame) { ctx.fillStyle = '#ff6a35'; ctx.fillRect(arrow.x - 3, y - 25, 6, 7); } if (ice) { ctx.fillStyle = '#fff'; ctx.fillRect(arrow.x - 4, y - 12, 3, 3); } if (progress >= 1) { ctx.globalAlpha = Math.max(0, 1 - (now - arrow.impactAt) / 260); ctx.strokeStyle = accent; ctx.lineWidth = sky || sun ? 4 : 2; ctx.beginPath(); ctx.arc(arrow.x, arrow.y, 10 + (now - arrow.impactAt) / 30, 0, Math.PI * 2); ctx.stroke(); } });
  ctx.restore();
}

function drawSwordUltimate(ctx: CanvasRenderingContext2D, ultimate: SwordUltimate, now: number) {
  const impacted = now >= ultimate.impactAt; const progress = Math.min(1, (now - ultimate.started) / (ultimate.impactAt - ultimate.started));
  ctx.save(); ctx.translate(ultimate.x, ultimate.y);
  if (!impacted) { ctx.globalAlpha = .25 + progress * .65; ctx.strokeStyle = ultimate.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -10 - progress * 35); ctx.lineTo(-7, -48 - progress * 18); ctx.moveTo(18, -10 - progress * 35); ctx.lineTo(7, -48 - progress * 18); ctx.stroke(); }
  else {
    const burst = Math.min(1, (now - ultimate.impactAt) / 260); ctx.globalAlpha = 1 - burst * .45; ctx.strokeStyle = ultimate.color; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 64 * burst, 0, Math.PI * 2); ctx.stroke();
    const rockColor = ultimate.name.includes('Теневой') ? '#512d68' : ultimate.name.includes('вождя') ? '#527b3c' : ultimate.name.includes('Ржавый') ? '#875038' : '#68777c';
    for (let i = 0; i < 10; i++) { const angle = i / 10 * Math.PI * 2; const distance = 16 + burst * 47; const size = 7 + (i % 3) * 3; ctx.fillStyle = '#251f1d'; ctx.fillRect(Math.cos(angle) * distance - size / 2 + 2, Math.sin(angle) * distance - size, size, size + 5); ctx.fillStyle = rockColor; ctx.fillRect(Math.cos(angle) * distance - size / 2, Math.sin(angle) * distance - size - 2, size, size + 3); ctx.fillStyle = ultimate.color; ctx.fillRect(Math.cos(angle) * distance - 2, Math.sin(angle) * distance - size, 4, 4); }
  }
  ctx.restore();
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, tint: string) {
  ctx.fillStyle = 'rgba(4,12,8,.32)'; ctx.fillRect(x + 7, y + 53, 51, 8);
  ctx.fillStyle = '#4b3022'; ctx.fillRect(x + 26, y + 35, 15, 24); ctx.fillStyle = '#765036'; ctx.fillRect(x + 30, y + 36, 6, 21);
  ctx.fillStyle = '#3d291f'; ctx.fillRect(x + 17, y + 55, 17, 5); ctx.fillRect(x + 38, y + 54, 14, 5);
  ctx.fillStyle = '#10281d'; ctx.fillRect(x + 8, y + 18, 49, 32); ctx.fillRect(x + 17, y + 7, 34, 45);
  ctx.fillStyle = tint; ctx.fillRect(x + 4, y + 24, 18, 20); ctx.fillRect(x + 14, y + 10, 21, 27); ctx.fillRect(x + 30, y + 5, 20, 31); ctx.fillRect(x + 43, y + 18, 17, 25);
  ctx.fillStyle = '#527c4d'; ctx.fillRect(x + 15, y + 14, 11, 9); ctx.fillRect(x + 34, y + 9, 10, 8); ctx.fillRect(x + 45, y + 22, 8, 8);
  ctx.fillStyle = '#79a85f'; ctx.fillRect(x + 19, y + 13, 5, 5); ctx.fillRect(x + 36, y + 8, 6, 4);
  ctx.fillStyle = '#1b3b29'; ctx.fillRect(x + 9, y + 39, 12, 8); ctx.fillRect(x + 30, y + 37, 14, 10); ctx.fillRect(x + 48, y + 35, 9, 9);
}

function drawCactus(ctx: CanvasRenderingContext2D, x: number, y: number, tint: string) {
  ctx.fillStyle = 'rgba(35,20,8,.3)'; ctx.fillRect(x + 8, y + 54, 49, 8);
  ctx.fillStyle = '#75502c'; ctx.fillRect(x + 12, y + 55, 42, 6);
  ctx.fillStyle = '#193d2b'; ctx.fillRect(x + 26, y + 7, 19, 51);
  ctx.fillRect(x + 13, y + 25, 14, 14); ctx.fillRect(x + 13, y + 19, 8, 20);
  ctx.fillRect(x + 44, y + 31, 14, 13); ctx.fillRect(x + 51, y + 23, 8, 19);
  ctx.fillStyle = tint; ctx.fillRect(x + 29, y + 5, 13, 50);
  ctx.fillRect(x + 16, y + 22, 9, 13); ctx.fillRect(x + 18, y + 17, 5, 14);
  ctx.fillRect(x + 43, y + 34, 12, 7); ctx.fillRect(x + 52, y + 25, 5, 14);
  ctx.fillStyle = '#88b94e'; ctx.fillRect(x + 31, y + 9, 4, 35); ctx.fillRect(x + 18, y + 24, 3, 8); ctx.fillRect(x + 52, y + 28, 3, 8);
  ctx.fillStyle = '#d8d08a';
  for (let sy = 12; sy < 52; sy += 10) { ctx.fillRect(x + 25, y + sy, 3, 2); ctx.fillRect(x + 43, y + sy + 4, 3, 2); }
  ctx.fillStyle = '#ef6d67'; ctx.fillRect(x + 31, y + 1, 9, 5); ctx.fillStyle = '#ffd17a'; ctx.fillRect(x + 34, y, 3, 4);
}

function drawIceSpire(ctx: CanvasRenderingContext2D, x: number, y: number, tint: string) {
  ctx.fillStyle = 'rgba(15,45,68,.3)'; ctx.fillRect(x + 7, y + 54, 52, 8);
  ctx.fillStyle = '#bcecff'; ctx.beginPath(); ctx.moveTo(x + 5, y + 55); ctx.lineTo(x + 18, y + 17); ctx.lineTo(x + 27, y + 55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint; ctx.beginPath(); ctx.moveTo(x + 18, y + 56); ctx.lineTo(x + 36, y + 2); ctx.lineTo(x + 48, y + 56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8fdcff'; ctx.beginPath(); ctx.moveTo(x + 40, y + 56); ctx.lineTo(x + 52, y + 20); ctx.lineTo(x + 62, y + 56); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e9fbff'; ctx.beginPath(); ctx.moveTo(x + 22, y + 48); ctx.lineTo(x + 35, y + 8); ctx.lineTo(x + 36, y + 48); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5eadd5'; ctx.fillRect(x + 12, y + 52, 44, 5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 32, y + 12, 4, 11); ctx.fillRect(x + 49, y + 28, 3, 8);
}

function drawWaterBarrier(ctx: CanvasRenderingContext2D, x: number, y: number, tint: string) {
  ctx.fillStyle = 'rgba(20,28,10,.42)'; ctx.fillRect(x + 3, y + 50, 58, 11);
  ctx.fillStyle = '#263b24'; ctx.fillRect(x + 3, y + 9, 58, 48); ctx.fillStyle = tint; ctx.fillRect(x + 7, y + 13, 50, 40);
  ctx.fillStyle = '#53683a'; ctx.fillRect(x + 11, y + 17, 19, 6); ctx.fillRect(x + 35, y + 30, 18, 6); ctx.fillRect(x + 15, y + 43, 25, 5);
  ctx.fillStyle = '#9aa55a'; ctx.fillRect(x + 14, y + 18, 12, 3); ctx.fillRect(x + 39, y + 31, 10, 3); ctx.fillRect(x + 19, y + 44, 15, 2);
  ctx.fillStyle = '#1b311f'; ctx.fillRect(x + 4, y + 6, 56, 7); ctx.fillRect(x + 4, y + 53, 56, 6); ctx.fillStyle = '#71834a'; ctx.fillRect(x + 8, y + 8, 17, 3); ctx.fillRect(x + 37, y + 55, 19, 2);
}

function drawJungleTree(ctx:CanvasRenderingContext2D,x:number,y:number,tint:string){ctx.fillStyle='rgba(0,9,4,.45)';ctx.fillRect(x+2,y+55,64,9);ctx.fillStyle='#3b271a';ctx.fillRect(x+28,y+18,17,44);ctx.fillStyle='#77502e';ctx.fillRect(x+33,y+20,7,40);ctx.fillStyle='#53351f';ctx.fillRect(x+17,y+34,15,8);ctx.fillRect(x+14,y+23,8,18);ctx.fillRect(x+41,y+38,15,8);ctx.fillRect(x+51,y+20,8,24);ctx.fillStyle='#8a5b31';ctx.fillRect(x+19,y+35,10,4);ctx.fillRect(x+43,y+39,10,4);ctx.fillStyle='#092617';ctx.fillRect(x+16,y-2,42,25);ctx.fillRect(x+22,y-8,30,31);ctx.fillRect(x-2,y+7,29,22);ctx.fillRect(x+47,y+2,23,24);ctx.fillStyle=tint;ctx.fillRect(x+20,y+1,34,18);ctx.fillRect(x+27,y-5,21,23);ctx.fillRect(x+2,y+10,22,15);ctx.fillRect(x+50,y+5,17,17);ctx.fillStyle='#3f8b4b';ctx.fillRect(x+25,y+2,11,6);ctx.fillRect(x+8,y+12,9,6);ctx.fillRect(x+53,y+7,9,6);ctx.fillStyle='#7fbe65';ctx.fillRect(x+36,y-2,5,4);ctx.fillRect(x+13,y+10,4,4);ctx.fillRect(x+57,y+5,4,4);}

function drawCart(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(x - 3, y + 29, 46, 8); ctx.fillStyle = '#272423'; ctx.beginPath(); ctx.arc(x + 8, y + 29, 7, 0, Math.PI * 2); ctx.arc(x + 32, y + 29, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7c4b2c'; ctx.fillRect(x, y + 6, 40, 21); ctx.fillStyle = color; ctx.fillRect(x + 4, y + 9, 32, 13); ctx.fillStyle = '#b4884f'; ctx.fillRect(x - 3, y + 2, 46, 7); ctx.fillStyle = '#d7b66d'; ctx.fillRect(x + 5, y + 4, 5, 4); ctx.fillRect(x + 30, y + 4, 5, 4); }

function drawMerchant(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = 'rgba(0,0,0,.38)'; ctx.fillRect(x - 18, y + 36, 65, 8);
  ctx.fillStyle = '#292421'; ctx.fillRect(x - 7, y + 31, 13, 10); ctx.fillRect(x + 18, y + 31, 13, 10);
  ctx.fillStyle = '#51361f'; ctx.fillRect(x + 18, y - 2, 38, 43); ctx.fillStyle = '#886038'; ctx.fillRect(x + 22, y + 2, 30, 35); ctx.fillStyle = '#d0a75b'; ctx.fillRect(x + 25, y + 4, 5, 31); ctx.fillRect(x + 43, y + 4, 5, 31);
  ctx.fillStyle = '#6c4930'; ctx.fillRect(x - 7, y + 3, 12, 31); ctx.fillStyle = '#a06b3d'; ctx.fillRect(x + 3, y, 29, 37); ctx.fillStyle = '#d0a75b'; ctx.fillRect(x + 7, y, 5, 37);
  ctx.fillStyle = '#d7a678'; ctx.fillRect(x + 7, y - 20, 22, 21); ctx.fillStyle = '#57402d'; ctx.fillRect(x + 7, y - 20, 22, 7); ctx.fillStyle = '#20251e'; ctx.fillRect(x + 12, y - 11, 4, 3); ctx.fillRect(x + 21, y - 11, 4, 3); ctx.fillStyle = '#7d4936'; ctx.fillRect(x + 15, y - 4, 8, 3);
  ctx.fillStyle = '#172019'; ctx.fillRect(x - 28, y - 42, 106, 15); ctx.strokeStyle = '#cfae60'; ctx.lineWidth = 2; ctx.strokeRect(x - 28, y - 42, 106, 15); ctx.fillStyle = '#f0d780'; ctx.font = 'bold 7px monospace'; ctx.fillText('ТОРГОВЕЦ · E', x - 20, y - 32);
}

function drawMinimap(ctx: CanvasRenderingContext2D, map: ReturnType<typeof getLevel>, level: number, hero: Point, enemies: Enemy[], chestDrops: LootDrop[], openedChests: number[], explored: Point[], mobileControls = false) {
  const x = 8, y = mobileControls ? 138 : 58, width = 135, height = 74, sx = width / map.worldWidth, sy = height / map.worldHeight;
  ctx.fillStyle = 'rgba(5,9,8,.9)'; ctx.fillRect(x - 3, y - 3, width + 6, height + 14); ctx.strokeStyle = '#a68b58'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip(); ctx.fillStyle = map.floor[0]; ctx.fillRect(x, y, width, height);
  if (map.round) { ctx.fillStyle = '#09100c'; ctx.fillRect(x, y, width, height); ctx.fillStyle = map.floor[1]; ctx.beginPath(); ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.strokeStyle = '#987b50'; ctx.lineWidth = 5; ctx.beginPath(); ROUTE_POINTS.forEach((point, index) => { const px = x + point.x * sx, py = y + point.y * sy; if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.stroke(); }
  ctx.fillStyle = '#15251b'; map.walls.forEach((wall) => ctx.fillRect(x + wall.x * sx, y + wall.y * sy, Math.max(1, wall.w * sx), Math.max(1, wall.h * sy)));
  map.chests.forEach((chest, index) => { const drop = chestDrops[index]; if (!drop) return; const cx = x + chest.x * sx, cy = y + chest.y * sy; ctx.globalAlpha = openedChests.includes(index) ? .35 : 1; ctx.fillStyle = '#17120f'; ctx.fillRect(cx - 6, cy - 6, 12, 12); ctx.fillStyle = drop.rarity.color; ctx.fillRect(cx - 4, cy - 4, 8, 8); ctx.fillStyle = '#ffe58a'; ctx.fillRect(cx - 1, cy - 2, 3, 5); ctx.globalAlpha = 1; });
  enemies.forEach((enemy) => { if (enemy.hiddenInRock) return; const ex = x + enemy.x * sx, ey = y + enemy.y * sy; ctx.fillStyle = '#ff394f'; ctx.beginPath(); ctx.moveTo(ex, ey - 4); ctx.lineTo(ex + 4, ey); ctx.lineTo(ex, ey + 4); ctx.lineTo(ex - 4, ey); ctx.closePath(); ctx.fill(); });
  const hx = x + hero.x * sx, hy = y + hero.y * sy; ctx.fillStyle = '#63ecff'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  const minimapFog = document.createElement('canvas'); minimapFog.width = width; minimapFog.height = height; const minimapFogCtx = minimapFog.getContext('2d'); if (minimapFogCtx) { minimapFogCtx.fillStyle = 'rgba(2,5,4,.96)'; minimapFogCtx.fillRect(0, 0, width, height); minimapFogCtx.globalCompositeOperation = 'destination-out'; explored.forEach((point) => { minimapFogCtx.beginPath(); minimapFogCtx.arc(point.x * sx, point.y * sy, 160 * Math.max(sx, sy), 0, Math.PI * 2); minimapFogCtx.fill(); }); ctx.drawImage(minimapFog, x, y); }
  ctx.fillStyle = '#63ecff'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ead7a6'; ctx.font = 'bold 7px monospace'; ctx.fillText(`КАРТА · УРОВЕНЬ ${level}`, x, y + height + 9);
}

function drawGoblin(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const stride = Math.sin(now / 120 + e.x * .03);
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(64, 112, 39, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#493426'; ctx.fillRect(35, 65, 58, 39); ctx.fillStyle = e.flash > 0 ? '#fff' : e.color; ctx.fillRect(42, 22, 44, 43);
  ctx.beginPath(); ctx.moveTo(42, 30); ctx.lineTo(17, 18); ctx.lineTo(41, 45); ctx.fill(); ctx.beginPath(); ctx.moveTo(86, 30); ctx.lineTo(111, 18); ctx.lineTo(87, 45); ctx.fill();
  ctx.fillStyle = '#d8e8b0'; ctx.fillRect(49, 37, 10, 8); ctx.fillRect(70, 37, 10, 8); ctx.fillStyle = '#281d1b'; ctx.fillRect(54, 39, 5, 6); ctx.fillRect(70, 39, 5, 6);
  ctx.fillStyle = '#eff0c4'; ctx.beginPath(); ctx.moveTo(53, 55); ctx.lineTo(59, 64); ctx.lineTo(63, 54); ctx.fill(); ctx.beginPath(); ctx.moveTo(67, 54); ctx.lineTo(72, 64); ctx.lineTo(77, 55); ctx.fill();
  if (e.kind === 'boss' && attacking) {
    const progress = Math.max(0, Math.min(1, 1 - (e.attackUntil - now) / 220));
    const handY = progress < .45 ? 92 - progress / .45 * 100 : -8 + (progress - .45) / .55 * 119;
    const spread = progress < .45 ? 25 - progress / .45 * 13 : 12 + (progress - .45) / .55 * 10;
    ctx.strokeStyle = '#493426'; ctx.lineWidth = 13; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(39, 70); ctx.lineTo(52 - spread, 48); ctx.lineTo(64 - spread, handY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(90, 70); ctx.lineTo(77 + spread, 48); ctx.lineTo(65 + spread, handY); ctx.stroke();
    ctx.fillStyle = e.flash > 0 ? '#fff' : e.color; ctx.fillRect(57 - spread, handY - 7, 15, 14); ctx.fillRect(58 + spread, handY - 7, 15, 14);
    if (progress > .72) {
      const impact = (progress - .72) / .28; ctx.globalAlpha = 1 - impact;
      ctx.fillStyle = '#c7ab70'; ctx.fillRect(8 - impact * 8, 105 - impact * 16, 23, 7); ctx.fillRect(99 + impact * 8, 105 - impact * 16, 23, 7); ctx.fillRect(43, 111 - impact * 23, 13, 8); ctx.fillRect(75, 111 - impact * 23, 13, 8); ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = '#67503a'; ctx.fillRect(31, 68, 10, 31); ctx.fillRect(88, 68, 10, 31); ctx.fillStyle = e.flash > 0 ? '#fff' : e.color; ctx.fillRect(28, 93 + stride * 2, 16, 9); ctx.fillRect(86, 93 - stride * 2, 16, 9);
  }
  ctx.fillStyle = '#342a32'; ctx.fillRect(40, 98 + stride * 3, 20, 12); ctx.fillRect(70, 98 - stride * 3, 20, 12);
  if (e.kind === 'boss') {
    ctx.fillStyle = '#7b2637'; ctx.fillRect(31, 62, 10, 39); ctx.fillRect(89, 62, 10, 39); ctx.fillStyle = '#bc3b4e'; ctx.fillRect(40, 65, 50, 35);
    ctx.fillStyle = '#f0d7b0'; ctx.fillRect(40, 65, 7, 35); ctx.fillRect(83, 65, 7, 35); ctx.fillStyle = '#d5a83e'; ctx.fillRect(47, 91, 36, 7);
    ctx.fillStyle = '#6b431c'; ctx.fillRect(36, 12, 58, 20); ctx.fillStyle = '#f1c54e'; ctx.beginPath(); ctx.moveTo(36, 28); ctx.lineTo(36, 10); ctx.lineTo(48, 20); ctx.lineTo(58, 1); ctx.lineTo(68, 20); ctx.lineTo(81, 2); ctx.lineTo(94, 20); ctx.lineTo(94, 31); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff0a0'; ctx.fillRect(43, 23, 44, 5); ctx.fillStyle = '#d94f45'; ctx.fillRect(48, 19, 7, 7); ctx.fillStyle = '#63bce2'; ctx.fillRect(62, 18, 7, 8); ctx.fillStyle = '#70cb68'; ctx.fillRect(76, 19, 7, 7);
    ctx.fillStyle = '#d5a83e'; ctx.fillRect(25, 66, 14, 12); ctx.fillRect(91, 66, 14, 12); ctx.fillStyle = '#ffe190'; ctx.fillRect(29, 68, 6, 5); ctx.fillRect(95, 68, 6, 5);
  }
}

function drawJungleSnake(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const jumping = e.leapStarted > 0, wave = Math.sin(now / 105 + e.x * .04) * (jumping ? 14 : 8);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(64,108,48,9,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = e.flash > 0 ? '#fff' : '#2d7d3d'; ctx.lineWidth = 25; ctx.lineCap = 'square'; ctx.beginPath(); ctx.moveTo(19,99); ctx.bezierCurveTo(42,84+wave,57,110-wave,79,91); ctx.stroke();
  ctx.strokeStyle = '#65c858'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(20,96); ctx.bezierCurveTo(42,81+wave,57,107-wave,80,88); ctx.stroke();
  ctx.save(); if (jumping) { ctx.translate(91,75); ctx.rotate(-.24); ctx.translate(-91,-75); }
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#49a94f'; ctx.fillRect(73,55,38,38); ctx.fillRect(66,65,48,25);
  ctx.fillStyle='#d9ed83';ctx.fillRect(81,64,8,8);ctx.fillRect(100,64,8,8);ctx.fillStyle='#162418';ctx.fillRect(84,64,3,8);ctx.fillRect(103,64,3,8);
  ctx.fillStyle='#f06c76';ctx.fillRect(109,80,attacking?20:10,4); if(attacking){ctx.fillRect(126,77,3,4);ctx.fillRect(126,83,3,4);}
  ctx.restore(); ctx.fillStyle='#b6d84d';ctx.fillRect(38,85+wave,8,8);ctx.fillRect(57,93-wave,7,7);
}

function drawMonkey(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const stride=Math.sin(now/105+e.x*.03)*5, jumping=e.leapStarted>0;
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(64,111,jumping?28:40,jumping?6:9,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=e.flash>0?'#fff':'#82502f';ctx.fillRect(39,49,51,52);ctx.fillRect(43,22,43,38);
  ctx.fillStyle='#b77a49';ctx.fillRect(49,34,31,25);ctx.fillRect(52,51,25,13);ctx.fillStyle='#251b18';ctx.fillRect(53,40,7,7);ctx.fillRect(70,40,7,7);ctx.fillStyle='#e9d28e';ctx.fillRect(55,41,3,3);ctx.fillRect(72,41,3,3);
  ctx.fillStyle=e.flash>0?'#fff':'#82502f';ctx.fillRect(30,30,14,22);ctx.fillRect(85,30,14,22);ctx.fillStyle='#b77a49';ctx.fillRect(33,34,8,12);ctx.fillRect(88,34,8,12);
  ctx.strokeStyle=e.flash>0?'#fff':'#704126';ctx.lineWidth=13;ctx.lineCap='square';ctx.beginPath();ctx.moveTo(42,61);ctx.lineTo(jumping?25:31,jumping?88:99+stride);ctx.stroke();ctx.beginPath();ctx.moveTo(88,61);ctx.lineTo(jumping?105:99,jumping?88:99-stride);ctx.stroke();
  ctx.fillStyle='#493120';ctx.fillRect(43,96+(jumping?-9:stride),18,14);ctx.fillRect(70,96+(jumping?-9:-stride),18,14);
  ctx.strokeStyle='#704126';ctx.lineWidth=10;ctx.beginPath();ctx.arc(91,78,27,-1.4,1.8);ctx.stroke();
  if(attacking&&!jumping){ctx.fillStyle='#b77a49';ctx.fillRect(92,62,24,14);ctx.fillStyle='#82502f';ctx.fillRect(110,59,13,20);}
}

function drawNativeWarrior(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const stride=Math.sin(now/120+e.x*.03)*4, spear=e.kind==='nativeSpear', axe=e.kind==='nativeAxe';
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(64,111,38,9,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=e.flash>0?'#fff':'#8d552f';ctx.fillRect(43,25,43,38);ctx.fillRect(39,61,51,39);
  ctx.fillStyle='#42281d';ctx.fillRect(40,18,49,13);ctx.fillRect(35,24,10,31);ctx.fillRect(86,24,10,31);
  ctx.fillStyle='#f2d05b';ctx.fillRect(49,38,10,7);ctx.fillRect(70,38,10,7);ctx.fillStyle='#261a18';ctx.fillRect(54,39,4,6);ctx.fillRect(70,39,4,6);
  ctx.fillStyle='#d6b348';ctx.fillRect(38,63,54,8);ctx.fillStyle='#6e2f27';ctx.fillRect(43,72,44,27);
  ctx.fillStyle=e.flash>0?'#fff':'#8d552f';ctx.fillRect(27,63,13,34);ctx.fillRect(90,63,13,34);
  ctx.fillStyle='#3b2a22';ctx.fillRect(43,96+stride,18,15);ctx.fillRect(70,96-stride,18,15);
  if(spear){const thrust=attacking?25:0;ctx.save();ctx.translate(thrust,0);ctx.fillStyle='#6b4328';ctx.fillRect(91,22,7,92);ctx.fillStyle='#d7e1d5';ctx.beginPath();ctx.moveTo(94,5);ctx.lineTo(83,27);ctx.lineTo(105,27);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(92,12,4,10);ctx.restore();}
  else{const swing=attacking?-.8:-.15;ctx.save();ctx.translate(99,69);ctx.rotate(swing);ctx.fillStyle='#5b3824';ctx.fillRect(-5,-5,10,58);ctx.fillStyle=axe?'#b9c9c4':'#35251e';if(axe){ctx.beginPath();ctx.moveTo(-5,-17);ctx.lineTo(-27,-7);ctx.lineTo(-22,12);ctx.lineTo(5,8);ctx.closePath();ctx.fill();ctx.fillStyle='#eef8f4';ctx.fillRect(-21,-5,14,4);}else{ctx.fillRect(-13,-14,26,24);ctx.fillStyle='#846044';ctx.fillRect(-9,-10,18,7);}ctx.restore();}
}

function drawMummy(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const stride = Math.sin(now / 150 + e.x * .025); const rising = (e.reviveFlashUntil ?? 0) > now;
  ctx.save(); if (rising) { const progress = 1 - ((e.reviveFlashUntil ?? now) - now) / 900; ctx.globalAlpha = .45 + progress * .55; ctx.translate(0, (1 - progress) * 25); }
  ctx.fillStyle = 'rgba(54,31,12,.3)'; ctx.beginPath(); ctx.ellipse(64,112,38,9,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#5d4931'; ctx.fillRect(42,54,45,52); ctx.fillStyle = e.flash > 0 ? '#fff' : '#d8c79a'; ctx.fillRect(45,20,39,39); ctx.fillRect(38,58,52,42);
  ctx.fillStyle = '#a79570'; ctx.fillRect(43,28,42,7); ctx.fillRect(39,47,48,7); ctx.fillRect(37,67,54,7); ctx.fillRect(39,85,51,7);
  ctx.fillStyle = '#29231d'; ctx.fillRect(52,38,8,7); ctx.fillRect(70,38,8,7); ctx.fillStyle = '#f2b44c'; ctx.fillRect(55,39,3,3); ctx.fillRect(72,39,3,3);
  ctx.fillStyle = '#c3b486'; ctx.fillRect(27,62 + stride * 2,15,38); ctx.fillRect(87,62 - stride * 2,15,38); ctx.fillStyle = '#88795b'; ctx.fillRect(25,70 + stride * 2,19,6); ctx.fillRect(86,82 - stride * 2,19,6);
  ctx.fillStyle = '#b5a47a'; ctx.fillRect(42,98 + stride * 2,18,13); ctx.fillRect(70,98 - stride * 2,18,13);
  if (attacking) { ctx.fillStyle = '#dfca91'; ctx.fillRect(91,55,35,10); ctx.fillStyle = '#9b8964'; ctx.fillRect(105,54,7,12); }
  if (rising) { ctx.fillStyle = '#e3b65e'; ctx.font = 'bold 13px monospace'; ctx.fillText('ВОССТАЛА', 31, 9); }
  ctx.restore();
}

function drawMummyBoss(ctx: CanvasRenderingContext2D, e: Enemy, now: number) {
  drawMummy(ctx, e, now, e.attackUntil > now);
  ctx.fillStyle = '#9a6b28'; ctx.fillRect(38,12,52,9); ctx.fillStyle = '#e2b85b'; ctx.fillRect(45,4,9,12); ctx.fillRect(61,0,9,16); ctx.fillRect(77,5,9,11);
  ctx.fillStyle = '#5b3424'; ctx.fillRect(30,52,9,48); ctx.fillRect(90,52,9,48);
}

function drawTomb(ctx: CanvasRenderingContext2D, tomb: Tomb, now: number) {
  const sink = now > tomb.sinksAt ? Math.min(1, (now - tomb.sinksAt) / 550) : 0; ctx.save(); ctx.translate(tomb.x, tomb.y + sink * 48); ctx.globalAlpha = 1 - sink;
  ctx.fillStyle = 'rgba(50,27,9,.35)'; ctx.fillRect(-19,28,42,7); ctx.fillStyle = '#66584a'; ctx.fillRect(-16,-24,34,55); ctx.fillStyle = '#9a876a'; ctx.fillRect(-12,-20,26,47); ctx.fillStyle = '#44392f'; ctx.fillRect(-7,-10,16,4); ctx.fillRect(-2,-16,5,18); ctx.fillStyle = '#d0ad5a'; ctx.fillRect(-12,20,26,5); ctx.restore();
}

function drawSandTornado(ctx: CanvasRenderingContext2D, tornado: SandTornado, now: number) {
  if(tornado.style==='snake'){ctx.save();ctx.translate(tornado.x,tornado.y);ctx.rotate(Math.atan2(tornado.vy,tornado.vx));ctx.strokeStyle='#236b35';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-15,0);ctx.quadraticCurveTo(-7,-8,1,0);ctx.quadraticCurveTo(8,8,15,0);ctx.stroke();ctx.fillStyle='#55bd55';ctx.fillRect(11,-5,10,10);ctx.fillStyle='#ffe36b';ctx.fillRect(17,-2,2,2);ctx.fillStyle='#e65353';ctx.fillRect(21,-1,7,2);ctx.restore();return;}
  if(tornado.style==='spear'){ctx.save();ctx.translate(tornado.x,tornado.y);ctx.rotate(Math.atan2(tornado.vy,tornado.vx));ctx.fillStyle='#6b4328';ctx.fillRect(-24,-3,42,6);ctx.fillStyle='#d7e1d5';ctx.beginPath();ctx.moveTo(29,0);ctx.lineTo(14,-9);ctx.lineTo(14,9);ctx.closePath();ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(16,-4,7,3);ctx.restore();return;}
  if(tornado.style==='blood'){ctx.fillStyle='#7e1522';ctx.fillRect(tornado.x-3,tornado.y-4,7,9);ctx.fillStyle='#e33b48';ctx.fillRect(tornado.x-1,tornado.y-3,3,4);return;}
  if (tornado.style === 'frogTongue') {
    const started=tornado.startedAt??now,total=Math.max(1,tornado.until-started),progress=Math.max(0,Math.min(1,(now-started)/total));
    const reach=progress<.45?progress/.45:progress<.65?1:(1-progress)/.35; const length=(tornado.tongueLength??96)*Math.max(0,reach);
    const dx=tornado.tongueDx??1,dy=tornado.tongueDy??0,source=tornado.source; const x=source?source.x+(source.kind==='boss'?0:14):tornado.x,y=source?source.y+(source.kind==='boss'?-55:14):tornado.y;
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(dy,dx));ctx.fillStyle='#8f4057';ctx.fillRect(3,-4,length,9);ctx.fillStyle='#ef8da3';ctx.fillRect(5,-2,Math.max(0,length-4),5);if(length>8){ctx.fillStyle='#ffd1d8';ctx.fillRect(Math.max(5,length-8),-2,7,2);}ctx.restore();return;
  }
  if (tornado.style === 'iceSpiritDrop') { const warning=now<(tornado.impactAt??0);ctx.save();ctx.translate(tornado.x,tornado.y);if(warning){ctx.fillStyle='rgba(91,215,255,.2)';ctx.beginPath();ctx.arc(0,0,16,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8fe8ff';ctx.lineWidth=3;ctx.stroke();}else{ctx.fillStyle='#61c9ee';ctx.beginPath();ctx.moveTo(0,-34);ctx.lineTo(12,5);ctx.lineTo(0,18);ctx.lineTo(-12,5);ctx.closePath();ctx.fill();ctx.fillStyle='#efffff';ctx.beginPath();ctx.moveTo(-2,-27);ctx.lineTo(4,5);ctx.lineTo(-1,10);ctx.closePath();ctx.fill();}ctx.restore();return;}
  if (tornado.style === 'iceRing' || tornado.style === 'iceLarge') { const large = tornado.style === 'iceLarge'; const warning = now < (tornado.impactAt ?? 0); ctx.save(); ctx.translate(tornado.x,tornado.y); if (warning) { ctx.globalAlpha=.75;ctx.strokeStyle=large?'#dffaff':'#67dfff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,large?22:10,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(83,207,255,.15)';ctx.fill(); } else { ctx.fillStyle='#62c9ee';ctx.beginPath();ctx.moveTo(0,large?-48:-25);ctx.lineTo(large?17:9,large?13:7);ctx.lineTo(0,large?24:13);ctx.lineTo(large?-17:-9,large?13:7);ctx.closePath();ctx.fill();ctx.fillStyle='#ecffff';ctx.beginPath();ctx.moveTo(-3,large?-39:-20);ctx.lineTo(4,large?8:4);ctx.lineTo(-2,large?13:7);ctx.closePath();ctx.fill(); } ctx.restore();return; }
  if (tornado.style === 'iceShard') { ctx.save();ctx.translate(tornado.x,tornado.y);ctx.rotate(Math.atan2(tornado.vy,tornado.vx)+Math.PI/2);ctx.fillStyle='#6dd5f4';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(5,6);ctx.lineTo(0,10);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.fillStyle='#efffff';ctx.fillRect(-1,-6,2,9);ctx.restore();return; }
  if (tornado.style === 'ice') { ctx.save(); ctx.translate(tornado.x,tornado.y); ctx.rotate(Math.atan2(tornado.vy,tornado.vx)+Math.PI/4); ctx.fillStyle='rgba(117,220,255,.3)';ctx.fillRect(-13,-13,26,26);ctx.fillStyle='#65cbee';ctx.beginPath();ctx.moveTo(0,-15);ctx.lineTo(10,0);ctx.lineTo(0,15);ctx.lineTo(-10,0);ctx.closePath();ctx.fill();ctx.fillStyle='#e9fcff';ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(3,0);ctx.lineTo(0,8);ctx.lineTo(-3,0);ctx.closePath();ctx.fill();ctx.restore();return; }
  ctx.save(); ctx.translate(tornado.x,tornado.y); const spin = now / 115; ctx.rotate(spin);
  ctx.fillStyle='rgba(87,48,17,.3)';ctx.beginPath();ctx.ellipse(0,17,27,8,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<7;i++){const width=7+i*3.2, y=12-i*6;ctx.strokeStyle=i%3===0?'#fff0ae':i%2?'#e8b85c':'#a96e31';ctx.lineWidth=i<2?3:5;ctx.beginPath();ctx.ellipse(0,y,width,4+i*.8,i*.22,0,Math.PI*1.65);ctx.stroke();}
  ctx.rotate(-spin); for(let i=0;i<9;i++){const angle=spin*1.7+i*2.1, radius=13+(i%3)*8;ctx.fillStyle=i%2?'#f4d27e':'#b77b36';ctx.fillRect(Math.cos(angle)*radius-2,Math.sin(angle)*radius-12-(i%4)*5,4+(i%2)*2,4);}
  ctx.fillStyle='rgba(255,221,125,.32)';ctx.beginPath();ctx.arc(0,-7,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff1b0';ctx.fillRect(-3,-12,6,9);ctx.restore();
}

function drawIceGolem(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const step=Math.sin(now/130+e.x*.03)*3;ctx.fillStyle='rgba(19,61,84,.3)';ctx.beginPath();ctx.ellipse(64,110,46,9,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=e.flash>0?'#fff':'#66b9d7';ctx.fillRect(35,49,58,53);ctx.fillRect(43,20,42,37);ctx.fillStyle='#a9e9f7';ctx.fillRect(41,54,46,16);ctx.fillRect(48,25,30,11);
  ctx.fillStyle='#193b51';ctx.fillRect(50,37,8,7);ctx.fillRect(70,37,8,7);ctx.fillStyle='#dffcff';ctx.fillRect(53,38,3,3);ctx.fillRect(72,38,3,3);
  ctx.fillStyle='#4e9dbd';ctx.fillRect(22,58+step,17,41);ctx.fillRect(91,58-step,17,41);ctx.fillStyle='#bcefff';ctx.fillRect(19,84+step,22,13);ctx.fillRect(89,84-step,22,13);
  ctx.fillStyle='#4388a7';ctx.fillRect(39,98+step,20,14);ctx.fillRect(70,98-step,20,14);ctx.fillStyle='#eefeff';ctx.fillRect(27,55+step,7,15);ctx.fillRect(96,55-step,7,15);
  if(attacking){ctx.fillStyle='#eaffff';ctx.fillRect(103,76,18,8);ctx.fillStyle='rgba(100,220,255,.35)';ctx.fillRect(99,71,27,18);}
}

function drawIceSpirit(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const float=Math.sin(now/170+e.x*.02)*5,step=Math.sin(now/105+e.x*.03)*3;ctx.fillStyle='rgba(32,103,142,.28)';ctx.beginPath();ctx.ellipse(64,111,39,8,0,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(0,float);
  ctx.strokeStyle='#397d9e';ctx.lineWidth=11;ctx.lineCap='square';ctx.beginPath();ctx.moveTo(37,67);ctx.lineTo(18,82+step);ctx.moveTo(91,67);ctx.lineTo(110,82-step);ctx.moveTo(51,94);ctx.lineTo(43,111+step);ctx.moveTo(77,94);ctx.lineTo(85,111-step);ctx.stroke();
  ctx.fillStyle=e.flash>0?'#fff':'#71d5f2';ctx.beginPath();ctx.arc(64,61,39,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a9ecfa';ctx.beginPath();ctx.arc(53,49,22,0,Math.PI*2);ctx.fill();ctx.fillStyle='#eaffff';ctx.fillRect(43,58,13,10);ctx.fillRect(72,58,13,10);ctx.fillStyle='#24506b';ctx.fillRect(49,61,6,7);ctx.fillRect(73,61,6,7);ctx.fillStyle='#397d9e';ctx.fillRect(54,79,21,6);ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillRect(42,40,12,7);if(attacking){ctx.fillStyle='#efffff';ctx.fillRect(104,75,14,12);ctx.fillStyle='rgba(101,220,255,.35)';ctx.fillRect(99,70,24,22);}ctx.restore();
}

function drawFrog(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const hopping = e.leapUntil > now;
  const hopProgress = hopping ? Math.max(0, Math.min(1, 1 - (e.leapUntil - now) / 360)) : 0;
  const lift = hopping ? Math.sin(hopProgress * Math.PI) * 28 : Math.sin(now / 210 + e.x * .02) * 2;
  ctx.fillStyle = 'rgba(20,48,20,.34)'; ctx.beginPath(); ctx.ellipse(64, 110, hopping ? 32 : 47, hopping ? 6 : 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(0, -lift);
  ctx.fillStyle = '#315f2c'; ctx.fillRect(19, 82, 31, 22); ctx.fillRect(79, 82, 31, 22); ctx.fillRect(10, 98, 42, 11); ctx.fillRect(77, 98, 42, 11);
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#58a94f'; ctx.fillRect(31, 48, 67, 51); ctx.fillRect(39, 35, 51, 56);
  ctx.fillStyle = '#8bd368'; ctx.fillRect(43, 43, 42, 15); ctx.fillRect(36, 66, 55, 22); ctx.fillStyle = '#2e762f'; ctx.fillRect(48, 73, 33, 7);
  ctx.fillStyle = '#b5e87e'; ctx.fillRect(38, 28, 20, 24); ctx.fillRect(75, 28, 20, 24); ctx.fillStyle = '#f2f3c5'; ctx.fillRect(42, 31, 13, 13); ctx.fillRect(78, 31, 13, 13);
  ctx.fillStyle = '#16221a'; ctx.fillRect(48, 34, 6, 9); ctx.fillRect(78, 34, 6, 9); ctx.fillStyle = '#d7ef87'; ctx.fillRect(51, 35, 2, 3); ctx.fillRect(79, 35, 2, 3);
  ctx.fillStyle = '#3d8639'; ctx.fillRect(25, 70, 14, 27); ctx.fillRect(94, 70, 14, 27); ctx.fillStyle = '#71bd58'; ctx.fillRect(18, 89, 24, 10); ctx.fillRect(91, 89, 24, 10);
  if (attacking) { ctx.fillStyle = '#e893a4'; ctx.fillRect(54, 79, 25, 7); ctx.fillStyle = '#ffd1d9'; ctx.fillRect(59, 80, 13, 2); }
  ctx.restore();
}

function drawFrogBoss(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) { drawFrog(ctx,e,now,attacking);ctx.fillStyle='#6b431c';ctx.fillRect(35,20,60,13);ctx.fillStyle='#e6bd42';ctx.beginPath();ctx.moveTo(35,23);ctx.lineTo(37,4);ctx.lineTo(49,14);ctx.lineTo(63,-2);ctx.lineTo(76,14);ctx.lineTo(91,3);ctx.lineTo(95,24);ctx.closePath();ctx.fill();ctx.fillStyle='#fff09a';ctx.fillRect(43,18,44,4);ctx.fillStyle='#d94f45';ctx.fillRect(49,13,7,7);ctx.fillStyle='#65bde4';ctx.fillRect(61,11,8,8);ctx.fillStyle='#83cb55';ctx.fillRect(76,13,7,7);if(attacking){const puff=Math.sin(now/75)*3;ctx.fillStyle='#a6d66f';ctx.fillRect(24-puff,58,17,19);ctx.fillRect(89+puff,58,17,19);ctx.fillStyle='#321d22';ctx.fillRect(45,73,40,20);ctx.fillStyle='#e88ca0';ctx.fillRect(52,82,26,8);ctx.fillStyle='#f4c4cd';ctx.fillRect(58,83,13,3);} }

function drawMudCreature(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  if (e.kind === 'mudPile') { ctx.fillStyle='rgba(26,18,11,.35)';ctx.fillRect(14,96,100,13);ctx.fillStyle='#3b2a20';ctx.fillRect(20,82,88,22);ctx.fillStyle='#60452f';ctx.fillRect(31,68,62,29);ctx.fillStyle='#80603d';ctx.fillRect(43,61,35,13);ctx.fillStyle='#a1814d';ctx.fillRect(37,76,17,6);ctx.fillRect(73,88,22,5);ctx.fillStyle='#29351d';ctx.fillRect(25,75,9,7);ctx.fillRect(89,67,8,8);return; }
  const stomp=Math.sin(now/95+e.x*.03)*5;ctx.fillStyle='rgba(25,17,10,.34)';ctx.beginPath();ctx.ellipse(64,111,45,10,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=e.flash>0?'#fff':'#60452f';ctx.fillRect(31,45,66,57);ctx.fillRect(40,31,48,35);ctx.fillStyle='#80603d';ctx.fillRect(39,51,49,15);ctx.fillRect(46,35,23,10);
  ctx.fillStyle='#c7b05f';ctx.fillRect(45,52,11,9);ctx.fillRect(74,52,11,9);ctx.fillStyle='#211912';ctx.fillRect(50,55,5,6);ctx.fillRect(75,55,5,6);ctx.fillStyle='#34231d';ctx.fillRect(52,76,28,7);
  ctx.fillStyle='#4a3427';ctx.fillRect(18,62+stomp,18,38);ctx.fillRect(94,62-stomp,18,38);ctx.fillRect(35,96+stomp,23,14);ctx.fillRect(73,96-stomp,23,14);ctx.fillStyle='#87934b';ctx.fillRect(23,70+stomp,9,8);ctx.fillRect(83,39,9,7);
  if(attacking){ctx.fillStyle='#a27b48';ctx.fillRect(104,68,24,15);ctx.fillStyle='#d0af63';ctx.fillRect(116,71,10,7);}
}

function getPlantHitboxes(map: ReturnType<typeof getLevel>) {
  const hitboxes: { x: number; y: number; w: number; h: number }[] = [];
  const addPlant = (x: number, y: number) => hitboxes.push({ x: x + 4, y: y + 2, w: 56, h: 58 });
  if (!map.round) ROUTE_POINTS.slice(1).forEach((end, index) => {
    const start = ROUTE_POINTS[index], dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length;
    for (let distance = 20; distance < length; distance += 52) { const px = start.x + dx * distance / length, py = start.y + dy * distance / length; addPlant(px + nx * 88 - 30, py + ny * 88 - 30); addPlant(px - nx * 88 - 30, py - ny * 88 - 30); }
  });
  map.walls.forEach((wall) => {
    if (wall.w >= wall.h) for (let x = wall.x - 12; x < wall.x + wall.w; x += 48) addPlant(x, wall.y + wall.h / 2 - 34);
    else for (let y = wall.y - 18; y < wall.y + wall.h; y += 48) addPlant(wall.x + wall.w / 2 - 32, y);
  });
  return hitboxes;
}

function drawVisibleHitboxes(ctx: CanvasRenderingContext2D, map: ReturnType<typeof getLevel>, enemies: Enemy[], hero: Point, secondHero: Point | null) {
  ctx.save(); ctx.strokeStyle = '#29a8ff'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
  map.walls.forEach((wall) => ctx.strokeRect(wall.x, wall.y, wall.w, wall.h));
  getPlantHitboxes(map).forEach((hitbox) => ctx.strokeRect(hitbox.x, hitbox.y, hitbox.w, hitbox.h));
  map.carts.forEach((cart) => ctx.strokeRect(cart.x - 5, cart.y, 50, 36));
  ctx.strokeRect(hero.x, hero.y, 24, 28); if (secondHero) ctx.strokeRect(secondHero.x, secondHero.y, 24, 28);
  enemies.forEach((enemy) => {
    if (enemy.kind !== 'boss') { ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemyHitRadius(enemy), 0, Math.PI * 2); ctx.stroke(); return; }
    const pad = 3.2;
    ctx.strokeRect(enemy.x - 48.2, enemy.y - 178.2, 96.4, 93.4);
    ctx.strokeRect(enemy.x - 52, enemy.y - 92, 104, 68);
    ctx.strokeRect(enemy.x - 78.2, enemy.y - 97.2, 31.4, 76.4); ctx.strokeRect(enemy.x + 46.8, enemy.y - 97.2, 31.4, 76.4);
    ctx.strokeRect(enemy.x - 53.2, enemy.y - 32.2, 106.4, 37.4);
    ctx.setLineDash([]); ctx.strokeStyle = '#75d8ff'; ctx.strokeRect(enemy.x - 52, enemy.y - 92, 104, 68); ctx.strokeStyle = '#29a8ff'; ctx.setLineDash([5, 3]);
    void pad;
  });
  ctx.restore();
}

function drawScorpion(ctx: CanvasRenderingContext2D, e: Enemy, now: number, attacking: boolean) {
  const crawl = Math.sin(now / 95 + e.x * .04) * 4;
  ctx.fillStyle = 'rgba(47,25,8,.32)'; ctx.beginPath(); ctx.ellipse(64,106,48,10,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#56331f'; ctx.lineWidth = 8; ctx.lineCap = 'square';
  [[42,78,15,62],[42,88,10,88],[45,96,18,108],[86,78,113,62],[86,88,118,88],[83,96,110,108]].forEach(([x1,y1,x2,y2], index) => { ctx.beginPath(); ctx.moveTo(x1,y1 + (index % 2 ? crawl : -crawl)); ctx.lineTo(x2,y2); ctx.stroke(); });
  ctx.fillStyle = e.flash > 0 ? '#fff' : '#8b4d29'; ctx.fillRect(38,66,52,36); ctx.fillRect(49,55,30,18); ctx.fillStyle = '#c47737'; ctx.fillRect(45,69,38,13); ctx.fillRect(54,58,20,8);
  ctx.fillStyle = '#19130f'; ctx.fillRect(53,63,6,5); ctx.fillRect(70,63,6,5); ctx.fillStyle = '#ffd45c'; ctx.fillRect(55,63,2,2); ctx.fillRect(72,63,2,2);
  ctx.strokeStyle = e.flash > 0 ? '#fff' : '#743d22'; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(82,61); ctx.lineTo(99,48); ctx.lineTo(104,29); ctx.lineTo(94,17); ctx.stroke();
  ctx.fillStyle = '#342016'; ctx.beginPath(); ctx.moveTo(88,15); ctx.lineTo(101,14); ctx.lineTo(94,28); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4f2b1b'; ctx.fillRect(15,50,23,15); ctx.fillRect(91,50,23,15); ctx.fillStyle = '#b25e2b'; ctx.fillRect(12,45,13,17); ctx.fillRect(104,45,13,17);
  if (attacking) { ctx.fillStyle = '#8cff65'; ctx.fillRect(92,11,7,7); ctx.fillStyle = 'rgba(105,255,80,.35)'; ctx.fillRect(88,7,15,15); }
}

export function BestiaryMonster({ id, hidden = false }: { id: string; hidden?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, 128, 128); ctx.save(); ctx.translate(0, 5);
    const enemy: Enemy = { x: 0, y: 0, kind: id.includes('boss') ? 'boss' : id === 'mummy' ? 'mummy' : id === 'scorpion' ? 'scorpion' : id === 'ice-spirit' ? 'iceSpirit' : id.includes('ice-golem') ? 'iceGolem' : id === 'goblin' ? 'goblin' : 'slime', hp: 10, maxHp: 10, flash: 0, attackUntil: 0, stunnedUntil: 0, color: '#69ad68', power: 1, speed: 1, leapStarted: 0, leapUntil: 0, leapTargetX: 0, leapTargetY: 0, nextLeapAt: 0 };
    if (id === 'goblin') drawGoblin(ctx, enemy, 0, false);
    else if (id === 'goblin-boss') { ctx.translate(16, 13); ctx.scale(.75,.75); drawGoblin(ctx, enemy, 0, false); }
    else if (id === 'mummy') drawMummy(ctx, enemy, 0, false);
    else if (id === 'mummy-boss') { ctx.translate(16, 13); ctx.scale(.75,.75); drawMummyBoss(ctx, enemy, 0); }
    else if (id === 'scorpion') drawScorpion(ctx, enemy, 0, false);
    else if (id === 'ice-spirit') drawIceSpirit(ctx, enemy, 0, false);
    else if (id === 'ice-golem') drawIceGolem(ctx, enemy, 0, false);
    else if (id === 'ice-golem-boss') { ctx.translate(16, 13); ctx.scale(.75,.75); drawIceGolem(ctx, enemy, 0, false); }
    else {
      ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(64,112,49,11,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#14251c';ctx.beginPath();ctx.moveTo(12,98);ctx.lineTo(12,70);ctx.lineTo(24,70);ctx.lineTo(24,48);ctx.lineTo(36,48);ctx.lineTo(36,30);ctx.lineTo(48,30);ctx.lineTo(48,22);ctx.lineTo(82,22);ctx.lineTo(82,30);ctx.lineTo(96,30);ctx.lineTo(96,48);ctx.lineTo(108,48);ctx.lineTo(108,70);ctx.lineTo(118,70);ctx.lineTo(118,98);ctx.lineTo(106,108);ctx.lineTo(22,108);ctx.closePath();ctx.fill();
      ctx.fillStyle='#69ad68';ctx.fillRect(24,48,82,52);ctx.fillRect(36,32,58,68);ctx.fillRect(48,24,34,76);ctx.fillRect(16,70,98,27);ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(34,40,18,10);ctx.fillRect(29,56,8,24);ctx.fillStyle='#e8f5c8';ctx.fillRect(39,59,18,13);ctx.fillRect(73,59,18,13);ctx.fillStyle='#17231a';ctx.fillRect(47,62,7,9);ctx.fillRect(76,62,7,9);ctx.fillStyle='#315b34';ctx.fillRect(52,84,27,7);
    }
    ctx.restore(); if (hidden) { ctx.globalCompositeOperation='source-in'; ctx.fillStyle='#080a09'; ctx.fillRect(0,0,128,128); }
  }, [hidden, id]);
  return <canvas ref={canvasRef} className="bestiary-canvas" width={128} height={128} aria-hidden="true" />;
}

function createEnemies(map: ReturnType<typeof getLevel>, multiplier = 1, oneHitBoss = false): Enemy[] {
  const spawns = map.round ? map.enemies : multiplier === .5 ? map.enemies.filter((_, index) => index % 2 === 0) : multiplier === 2 ? map.enemies.flatMap((enemy) => [enemy, { ...enemy, x: enemy.x + 4, y: enemy.y + 4 }]) : map.enemies;
  const jungleRocks = map.decorations.filter((decoration) => decoration.kind === 'rock');
  return spawns.map((enemy, index) => {
    const hp = enemy.kind === 'boss' ? oneHitBoss ? 1 : map.enemy.hp * (map.floor[0] === '#303944' ? 7.5 : 5) : enemy.kind === 'mudPile' ? 9999 : enemy.kind === 'mudMonster' ? 1 : enemy.kind === 'frog' ? 4 : enemy.kind === 'snake' ? 3.5 : enemy.kind === 'monkey' ? 5.5 : enemy.kind === 'nativeSpear' || enemy.kind === 'nativeClub' || enemy.kind === 'nativeAxe' ? map.enemy.hp * 1.5 : enemy.kind === 'iceSpirit' ? 3 : enemy.kind === 'goblin' || enemy.kind === 'mummy' ? map.enemy.hp * 1.5 : enemy.kind === 'iceGolem' ? map.enemy.hp * .75 : map.enemy.hp;
    const speed = enemy.kind === 'boss' ? map.enemy.speed * .65 : enemy.kind === 'mudPile' ? 0 : enemy.kind === 'mudMonster' ? Math.max(1.05, map.enemy.speed) : enemy.kind === 'monkey' ? map.enemy.speed * 1.15 : enemy.kind === 'goblin' || enemy.kind === 'iceGolem' ? map.enemy.speed * 1.25 : enemy.kind === 'mummy' ? map.enemy.speed * .8 : map.enemy.speed;
    const snakeRock = enemy.kind === 'snake' ? jungleRocks[index % Math.max(1, jungleRocks.length)] : undefined;
    return { ...enemy, ...(snakeRock ? { x: snakeRock.x, y: snakeRock.y - 4 } : {}), ...map.enemy, color: enemy.kind === 'slime' ? map.enemy.color : enemy.kind === 'snake' ? '#49a94f' : enemy.kind === 'monkey' ? '#82502f' : enemy.kind === 'nativeSpear' || enemy.kind === 'nativeClub' || enemy.kind === 'nativeAxe' ? '#8d552f' : enemy.kind === 'frog' ? '#58a94f' : enemy.kind === 'mudPile' || enemy.kind === 'mudMonster' ? '#60452f' : enemy.kind === 'iceSpirit' ? '#71d5f2' : enemy.kind === 'mummy' ? '#d8c79a' : enemy.kind === 'scorpion' ? '#a95d2e' : enemy.kind === 'iceGolem' ? '#6bc8e8' : '#69ad68', hp, maxHp: hp, power: enemy.kind === 'mudPile' || enemy.kind === 'mudMonster' ? 5 : enemy.kind === 'nativeSpear' ? 3 : enemy.kind === 'nativeClub' ? 5 : enemy.kind === 'nativeAxe' ? 7 : enemy.kind === 'monkey' ? 3.5 : enemy.kind === 'snake' ? 1 : enemy.kind === 'boss' ? 2 : enemy.kind === 'iceSpirit' ? 1 : enemy.kind === 'mummy' ? Math.max(.5, map.enemy.power / 2) : enemy.kind === 'iceGolem' ? 1.3 : map.enemy.power, speed, flash: 0, attackUntil: 0, stunnedUntil: 0, leapStarted: 0, leapUntil: 0, leapTargetX: 0, leapTargetY: 0, nextLeapAt: 0, hiddenInRock: Boolean(snakeRock), nextShotAt: 0, nextSummonAt: 0, nextContactAt: 0, playerWasInSummonRadius: false, revived: false, reviveFlashUntil: 0 };
  });
}

function drawLoot(ctx: CanvasRenderingContext2D, p: Point, item: Weapon) {
  ctx.save(); ctx.translate(p.x + 18, p.y + 18); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(10, 18, 28, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.rotate(-.55); ctx.scale(.48, .48);
  if (item.type === 'sword') { ctx.fillStyle = '#2b2528'; ctx.fillRect(-13, -8, 33, 16); ctx.fillStyle = '#70462e'; ctx.fillRect(-10, -5, 29, 10); ctx.fillStyle = '#332a21'; ctx.fillRect(17, -15, 10, 30); ctx.fillStyle = '#d5a84a'; ctx.fillRect(19, -13, 6, 26); ctx.fillStyle = '#596363'; ctx.fillRect(26, -9, 57, 18); ctx.fillStyle = item.color; ctx.fillRect(29, -7, 50, 14); ctx.fillStyle = '#fff'; ctx.fillRect(34, -5, 39, 4); ctx.fillStyle = item.color; ctx.beginPath(); ctx.moveTo(79, -7); ctx.lineTo(96, 0); ctx.lineTo(79, 7); ctx.fill(); }
  if (item.type === 'bow') { ctx.strokeStyle = '#3a251a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(3, 0, 37, -1.25, 1.25); ctx.stroke(); ctx.strokeStyle = '#a66c35'; ctx.lineWidth = 7; ctx.stroke(); ctx.strokeStyle = '#e8dfc6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(15, -35); ctx.lineTo(7, 0); ctx.lineTo(15, 35); ctx.stroke(); ctx.fillStyle = '#67442b'; ctx.fillRect(4, -5, 20, 10); ctx.fillStyle = item.color; ctx.fillRect(10, -3, 12, 6); }
  if (item.type === 'staff') { ctx.fillStyle = '#39251c'; ctx.fillRect(-12, -7, 79, 14); ctx.fillStyle = '#7b5031'; ctx.fillRect(-9, -4, 74, 8); ctx.fillStyle = '#d5a84a'; ctx.fillRect(55, -10, 13, 20); ctx.strokeStyle = item.color; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(77, 0, 19, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = item.color; ctx.fillRect(70, -8, 15, 16); ctx.fillStyle = '#fff'; ctx.fillRect(73, -6, 5, 5); }
  if (item.type === 'armor') { ctx.rotate(.55); ctx.fillStyle = '#292735'; ctx.fillRect(-27, -28, 54, 61); ctx.fillStyle = item.color; ctx.fillRect(-23, -25, 46, 55); ctx.fillRect(-36, -20, 14, 28); ctx.fillRect(22, -20, 14, 28); ctx.fillStyle = '#e8dfff'; ctx.fillRect(-14, -17, 28, 6); ctx.fillRect(-3, -10, 6, 33); ctx.fillStyle = '#fff'; ctx.fillRect(-11, -14, 8, 4); }
  if (item.type === 'gloves') { ctx.rotate(.55); drawPixelGlovesIcon(ctx, 0, 0, item.color); }
  ctx.restore();
  ctx.fillStyle='#07100b';ctx.fillRect(p.x-59,p.y-28,154,24);ctx.strokeStyle='#e1bd60';ctx.lineWidth=2;ctx.strokeRect(p.x-58,p.y-27,152,22);ctx.fillStyle='#fff4c7';ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillText('E · ПОДОБРАТЬ',p.x+18,p.y-10);ctx.textAlign='start';
}

function drawBentLimb(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, bend: number, color: string, boot?: string) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.fillStyle = color; ctx.fillRect(-6, 0, 12, 20); ctx.fillRect(-8, 17, 16, 8);
  ctx.translate(0, 21); ctx.rotate(bend); ctx.fillRect(-6, 0, 12, 20);
  if (boot) { ctx.fillStyle = boot; ctx.fillRect(-7, 16, 18, 10); }
  ctx.restore();
}

function drawWeaponArms(ctx: CanvasRenderingContext2D, weapon: Weapon, facing: Point) {
  const angle = Math.atan2(facing.y, facing.x); const rotate = (x: number, y: number) => ({ x: 91 + x * Math.cos(angle) - y * Math.sin(angle), y: 83 + x * Math.sin(angle) + y * Math.cos(angle) });
  const grips = weapon.type === 'bow' ? [rotate(13, 0), rotate(-1, -18)] : weapon.type === 'staff' ? [rotate(7, 0), rotate(29, 0)] : [rotate(4, 0), rotate(15, 0)];
  const shoulders = [{ x: 34, y: 70 }, { x: 96, y: 70 }];
  shoulders.forEach((shoulder, index) => { const hand = grips[index]; const elbow = { x: (shoulder.x + hand.x) / 2, y: (shoulder.y + hand.y) / 2 + (index ? 10 : -2) }; ctx.strokeStyle = '#8d5d43'; ctx.lineWidth = 17; ctx.lineCap = 'square'; ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke(); ctx.strokeStyle = '#e1b87b'; ctx.lineWidth = 12; ctx.stroke(); ctx.fillStyle = '#f2c394'; ctx.fillRect(hand.x - 7, hand.y - 7, 14, 14); });
}

function drawSwordAttackArms(ctx: CanvasRenderingContext2D, facing: Point, progress: number) {
  const swing = -1.25 + (1 - progress) * 2.1; const angle = Math.atan2(facing.y, facing.x) + swing;
  const handAt = (distance: number) => ({ x: 65 + Math.cos(angle) * distance, y: 72 + Math.sin(angle) * distance });
  const hands = [handAt(7), handAt(19)]; const shoulders = [{ x: 34, y: 70 }, { x: 96, y: 70 }];
  shoulders.forEach((shoulder, index) => { const hand = hands[index]; const elbow = { x: (shoulder.x + hand.x) / 2 - Math.sin(angle) * (index ? -12 : 12), y: (shoulder.y + hand.y) / 2 + Math.cos(angle) * (index ? -12 : 12) + (index ? 0 : 8) }; ctx.strokeStyle = '#8d5d43'; ctx.lineWidth = 17; ctx.lineCap = 'square'; ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke(); ctx.strokeStyle = '#e1b87b'; ctx.lineWidth = 12; ctx.stroke(); });
}

function drawHeldWeapon(ctx: CanvasRenderingContext2D, weapon: Weapon, facing: Point) {
  const direction = Math.atan2(facing.y, facing.x); ctx.save(); ctx.translate(91, 83); ctx.rotate(direction);
  const grip = (x: number, y: number) => { ctx.fillStyle = '#8d5d43'; ctx.fillRect(x - 7, y - 8, 17, 17); ctx.fillStyle = '#f2c394'; ctx.fillRect(x - 5, y - 7, 14, 14); ctx.fillStyle = '#c98d68'; ctx.fillRect(x - 3, y - 6, 3, 12); ctx.fillRect(x + 3, y - 6, 3, 12); };
  if (weapon.type === 'sword') {
    ctx.fillStyle = '#2b2528'; ctx.fillRect(-5, -8, 27, 16); ctx.fillStyle = '#70462e'; ctx.fillRect(-2, -5, 22, 10);
    ctx.fillStyle = '#332a21'; ctx.fillRect(17, -15, 10, 30); ctx.fillStyle = '#d5a84a'; ctx.fillRect(19, -13, 6, 26);
    ctx.fillStyle = '#596363'; ctx.fillRect(26, -9, 57, 18); ctx.fillStyle = weapon.color; ctx.fillRect(29, -7, 50, 14);
    ctx.fillStyle = '#fff'; ctx.fillRect(34, -5, 39, 4); ctx.fillStyle = '#aab4b1'; ctx.beginPath(); ctx.moveTo(79, -7); ctx.lineTo(94, 0); ctx.lineTo(79, 7); ctx.fill();
    grip(7, 0);
  }
  if (weapon.type === 'bow') {
    ctx.strokeStyle = '#3a251a'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(3, 0, 37, -1.25, 1.25); ctx.stroke(); ctx.strokeStyle = '#a66c35'; ctx.lineWidth = 7; ctx.stroke();
    ctx.strokeStyle = '#e8dfc6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(15, -35); ctx.lineTo(7, 0); ctx.lineTo(15, 35); ctx.stroke();
    ctx.fillStyle = '#67442b'; ctx.fillRect(4, -5, 20, 10); ctx.fillStyle = weapon.color; ctx.fillRect(10, -3, 12, 6);
    grip(13, 0); grip(-1, -18);
  }
  if (weapon.type === 'staff') {
    ctx.fillStyle = '#39251c'; ctx.fillRect(-6, -7, 73, 14); ctx.fillStyle = '#7b5031'; ctx.fillRect(-3, -4, 68, 8); ctx.fillStyle = '#d5a84a'; ctx.fillRect(55, -10, 13, 20);
    ctx.strokeStyle = weapon.color; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(77, 0, 19, 0, Math.PI * 2); ctx.stroke(); ctx.fillStyle = weapon.color; ctx.fillRect(70, -8, 15, 16); ctx.fillStyle = '#fff'; ctx.fillRect(73, -6, 5, 5);
    grip(7, 0); grip(29, 0);
  }
  if (weapon.type === 'gloves') { ctx.fillStyle = weapon.color; ctx.fillRect(-5, -12, 23, 24); ctx.fillRect(18, -10, 18, 20); ctx.fillStyle = '#fff'; ctx.fillRect(-1, -8, 10, 4); }
  ctx.restore();
}

function drawHero(ctx: CanvasRenderingContext2D, p: Point, attackProgress: number, weapon: Weapon | null, armor: Weapon | null, facing: Point, moving: boolean, now: number, health: number, profileName: string, female = false, swordUltimate?: SwordUltimate, bowUltimate?: BowUltimate, glovesUltimate?: GlovesUltimate, skin: HeroSkin = 'default') {
  ctx.fillStyle = '#241719'; ctx.fillRect(p.x - 7, p.y - 24, 42, 7); ctx.fillStyle = '#6b252b'; ctx.fillRect(p.x - 5, p.y - 22, 38, 3); ctx.fillStyle = '#ef3949'; ctx.fillRect(p.x - 5, p.y - 22, 38 * Math.max(0, health / 10), 3);
  const swordSlamming = Boolean(swordUltimate && now < swordUltimate.impactAt + 250); const bowAiming = Boolean(bowUltimate && now < bowUltimate.rainStarted); const ultimateProgress = swordUltimate ? Math.min(1, (now - swordUltimate.started) / (swordUltimate.impactAt - swordUltimate.started)) : 0; const titanJump = glovesUltimate?.name.includes('титана') && !glovesUltimate.landed ? Math.min(1, (now - glovesUltimate.started) / 520) : 0; const jumpOffset = swordUltimate && now < swordUltimate.impactAt ? -Math.sin(ultimateProgress * Math.PI) * 48 : titanJump ? -Math.sin(titanJump * Math.PI) * 85 : 0; const titanOffsetX = titanJump && glovesUltimate ? (glovesUltimate.titanTargetX - p.x) * titanJump : 0; const titanOffsetY = titanJump && glovesUltimate ? (glovesUltimate.titanTargetY - p.y) * titanJump : 0;
  ctx.save(); ctx.translate(p.x - 11 + titanOffsetX, p.y - 12 + titanOffsetY + jumpOffset); ctx.scale(.38, .38);
  const walking = moving && attackProgress <= 0; const phase = walking ? Math.sin(now / 85) : 0; const bounce = walking ? Math.abs(phase) * -4 : 0;
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(64, 112, 42, 11, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, bounce);
  ctx.fillStyle = female ? '#3d2738' : '#30201e'; ctx.fillRect(37, 13, 54, 43); ctx.fillStyle = female ? '#70435f' : '#654035'; ctx.fillRect(43, 9, 42, 14); if (female) { ctx.fillRect(31, 25, 13, 57); ctx.fillRect(85, 25, 13, 57); ctx.fillStyle = '#c578a6'; ctx.fillRect(38, 11, 10, 10); }
  ctx.fillStyle = '#f2c394'; ctx.fillRect(41, 25, 48, 39); ctx.fillStyle = '#dda878'; ctx.fillRect(41, 52, 48, 12);
  ctx.fillStyle = '#fff'; ctx.fillRect(49, 38, 12, 9); ctx.fillRect(70, 38, 12, 9); ctx.fillStyle = '#253139'; ctx.fillRect(54, 40, 6, 7); ctx.fillRect(71, 40, 6, 7);
  ctx.fillStyle = female ? '#b76579' : '#9b5e55'; ctx.fillRect(58, 54, 16, 5); ctx.fillStyle = female ? '#6c397d' : '#315a8b'; ctx.fillRect(35, 64, 60, 40); ctx.fillStyle = female ? '#9a59ad' : '#4d83b8'; ctx.fillRect(45, 67, 40, 31);
  if (weapon && attackProgress <= 0 && !swordSlamming && !bowAiming) drawWeaponArms(ctx, weapon, facing);
  else if (weapon?.type === 'sword' && attackProgress > 0) drawSwordAttackArms(ctx, facing, attackProgress);
  else if (!weapon && attackProgress > 0) { const punch = Math.sin((1 - attackProgress) * Math.PI); const direction = Math.atan2(facing.y, facing.x); ctx.save(); ctx.translate(65, 72); ctx.rotate(direction); ctx.fillStyle = '#8d5d43'; ctx.fillRect(5, -10, 35 + punch * 38, 20); ctx.fillStyle = '#e1b87b'; ctx.fillRect(8, -7, 37 + punch * 38, 14); ctx.fillStyle = '#f2c394'; ctx.fillRect(39 + punch * 38, -12, 20, 24); ctx.fillRect(48 + punch * 38, -16, 8, 9); ctx.fillStyle = '#fff0db'; ctx.fillRect(42 + punch * 38, -9, 11, 5); ctx.restore(); }
  else if (swordSlamming) { ctx.strokeStyle = '#8d5d43'; ctx.lineWidth = 17; ctx.beginPath(); ctx.moveTo(34, 70); ctx.lineTo(51, 58); ctx.lineTo(65, 67); ctx.moveTo(96, 70); ctx.lineTo(79, 58); ctx.lineTo(65, 67); ctx.stroke(); ctx.strokeStyle = '#e1b87b'; ctx.lineWidth = 12; ctx.stroke(); }
  else if (bowAiming) { ctx.strokeStyle = '#e1b87b'; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(34, 70); ctx.lineTo(49, 43); ctx.lineTo(61, 24); ctx.moveTo(96, 70); ctx.lineTo(82, 43); ctx.lineTo(69, 24); ctx.stroke(); }
  else { drawBentLimb(ctx, 34, 69, phase * .48, .28 + Math.max(0, -phase) * .45, '#e1b87b'); drawBentLimb(ctx, 96, 69, -phase * .48, -.28 - Math.max(0, phase) * .45, '#e1b87b'); }
  drawBentLimb(ctx, 52, 96, phase * .42, Math.max(0, phase) * .65, '#273b62', '#322936');
  drawBentLimb(ctx, 78, 96, -phase * .42, Math.max(0, -phase) * .65, '#273b62', '#322936');
  if (skin === 'knight') { ctx.fillStyle = '#7f8b94'; ctx.fillRect(35, 18, 60, 40); ctx.fillStyle = '#bac5cc'; ctx.fillRect(41, 23, 48, 8); ctx.fillRect(45, 67, 40, 34); ctx.fillStyle = '#30383d'; ctx.fillRect(48, 38, 34, 7); }
  if (skin === 'ninja') { ctx.fillStyle = '#15171c'; ctx.fillRect(34, 15, 62, 49); ctx.fillRect(38, 65, 54, 38); ctx.fillStyle = '#59245f'; ctx.fillRect(34, 55, 62, 9); ctx.fillStyle = '#dbe9e7'; ctx.fillRect(48, 37, 34, 9); ctx.fillStyle = '#25212d'; ctx.fillRect(61, 37, 7, 9); }
  if (skin === 'dune') { ctx.fillStyle='#d4a24f';ctx.fillRect(34,13,62,18);ctx.fillRect(29,26,72,32);ctx.fillStyle='#5a3922';ctx.fillRect(40,43,50,12);ctx.fillStyle='#e8c979';ctx.fillRect(49,45,9,5);ctx.fillRect(72,45,9,5);ctx.fillStyle='#b7813f';ctx.fillRect(35,64,60,40);ctx.fillStyle='#67432b';ctx.fillRect(45,88,40,14); }
  if (skin === 'king') { ctx.fillStyle='#f1c54e';ctx.fillRect(38,12,54,12);ctx.fillRect(42,3,10,20);ctx.fillRect(60,0,10,23);ctx.fillRect(78,4,10,19);ctx.fillStyle='#a52f43';ctx.fillRect(35,64,60,40);ctx.fillStyle='#f0d9b0';ctx.fillRect(35,64,9,40);ctx.fillRect(86,64,9,40);ctx.fillStyle='#d3a943';ctx.fillRect(44,91,42,8); }
  if (skin === 'wizard') { ctx.fillStyle='#563f9b';ctx.beginPath();ctx.moveTo(65,-5);ctx.lineTo(99,30);ctx.lineTo(78,25);ctx.lineTo(102,39);ctx.lineTo(28,39);ctx.lineTo(50,25);ctx.closePath();ctx.fill();ctx.fillStyle='#49358b';ctx.fillRect(35,64,60,40);ctx.fillStyle='#9cecff';ctx.fillRect(58,73,14,14);ctx.fillStyle='#dffcff';ctx.fillRect(62,76,5,5); }
  if (skin === 'gentleman') { ctx.fillStyle='#1c1d22';ctx.fillRect(36,4,58,24);ctx.fillRect(27,25,76,10);ctx.fillStyle='#24262c';ctx.fillRect(35,64,60,40);ctx.fillStyle='#f1f1e9';ctx.fillRect(59,64,12,34);ctx.fillStyle='#9c3042';ctx.fillRect(58,68,14,8);ctx.fillStyle='#e4c76b';ctx.strokeStyle='#e4c76b';ctx.lineWidth=3;ctx.strokeRect(72,39,13,12);ctx.fillRect(84,49,4,16); }
  if (armor) { ctx.fillStyle = armor.color; ctx.fillRect(32, 64, 15, 32); ctx.fillRect(84, 64, 15, 32); ctx.fillRect(45, 66, 40, 34); ctx.strokeStyle = '#f3efff'; ctx.lineWidth = 4; ctx.strokeRect(48, 70, 34, 26); ctx.fillStyle = '#fff'; ctx.fillRect(62, 70, 6, 26); }
  if (weapon && attackProgress <= 0 && !swordSlamming && !bowAiming) drawHeldWeapon(ctx, weapon, facing);
  if (swordSlamming && weapon?.type === 'sword') { const plunge = ultimateProgress < .55 ? 38 - ultimateProgress / .55 * 26 : 12 + (ultimateProgress - .55) / .45 * 36; ctx.fillStyle = '#70462e'; ctx.fillRect(61, 55, 8, 22); ctx.fillStyle = '#d5a84a'; ctx.fillRect(51, 72, 28, 8); ctx.fillStyle = weapon.color; ctx.fillRect(59, 78, 12, plunge + 25); ctx.fillStyle = '#fff'; ctx.fillRect(61, 80, 3, plunge + 18); ctx.beginPath(); ctx.moveTo(59, 103 + plunge); ctx.lineTo(65, 114 + plunge); ctx.lineTo(71, 103 + plunge); ctx.fill(); }
  if (bowAiming && weapon?.type === 'bow') { ctx.strokeStyle = weapon.color; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(65, 20, 29, Math.PI, 0); ctx.stroke(); ctx.strokeStyle = '#f4e8c7'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(36, 20); ctx.lineTo(65, 8); ctx.lineTo(94, 20); ctx.stroke(); ctx.fillStyle = '#d7a057'; ctx.fillRect(62, -14, 6, 42); ctx.fillStyle = weapon.color; ctx.fillRect(59, -18, 12, 8); }
  if (attackProgress > 0 && weapon?.type === 'sword') {
    const swing = -1.25 + (1 - attackProgress) * 2.1;
    const direction = Math.atan2(facing.y, facing.x);
    ctx.save(); ctx.translate(65, 72); ctx.rotate(direction + swing); ctx.fillStyle = '#2b2020'; ctx.fillRect(-3, -8, 29, 16); ctx.fillStyle = '#72452d'; ctx.fillRect(0, -6, 24, 12); ctx.fillStyle = '#d5a84a'; ctx.fillRect(18, -14, 10, 28); ctx.fillStyle = '#586261'; ctx.fillRect(28, -9, 60, 18); ctx.fillStyle = weapon.color; ctx.fillRect(28, -8, 58, 16); ctx.fillStyle = weapon.color; ctx.beginPath(); ctx.moveTo(86, -8); ctx.lineTo(104, 0); ctx.lineTo(86, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(36, -6, 43, 4); ctx.fillStyle = '#f2c394'; ctx.fillRect(1, -8, 13, 16); ctx.fillRect(13, -8, 13, 16); ctx.fillStyle = '#c98d68'; ctx.fillRect(6, -7, 3, 14); ctx.fillRect(18, -7, 3, 14); ctx.restore();
  } else if (attackProgress > 0 && weapon) {
    const direction = Math.atan2(facing.y, facing.x); ctx.save(); ctx.translate(65, 72); ctx.rotate(direction);
    if (weapon.type === 'bow') { ctx.strokeStyle = '#b77b3c'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(10, 0, 34, -1.2, 1.2); ctx.stroke(); ctx.fillStyle = weapon.color; ctx.fillRect(16, -4, 80, 8); }
    if (weapon.type === 'staff') { ctx.fillStyle = '#71462f'; ctx.fillRect(4, -6, 74, 12); ctx.fillStyle = weapon.color; ctx.beginPath(); ctx.arc(90, 0, 18, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  ctx.restore();
  ctx.save(); ctx.font = 'bold 8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.shadowColor = '#69e8ff'; ctx.shadowBlur = 7; ctx.fillStyle = '#dffcff'; ctx.fillText(profileName, p.x + 14, p.y - 29, 150); ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, map: ReturnType<typeof getLevel>, hero: Point, enemies: Enemy[], projectiles: Projectile[], superFists: SuperFist[], swordUltimates: SwordUltimate[], bowUltimates: BowUltimate[], staffUltimates: StaffUltimate[], glovesUltimates: GlovesUltimate[], waves: MagicWave[], sandTornadoes: SandTornado[], tombs: Tomb[], now: number, openedChests: number[], chestDrops: LootDrop[], attackProgress: number, loot: Point | null, droppedItem: Weapon | null, level: number, weapon: Weapon | null, weapon2: Weapon | null, armor: Weapon | null, facing: Point, moving: boolean, health: number, superReloading: boolean, profileName: string, secondHero: Point | null, secondFacing: Point, secondMoving: boolean, secondHealth: number, superReloading2: boolean, attackProgress2: number, armor2: Weapon | null, skin: HeroSkin, skin2: HeroSkin, explored: Point[], mobileControls = false, cameraFocus: Point = hero, castleGuardVisible = true) {
  ctx.fillStyle = map.round ? '#0c1510' : map.floor[0]; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const cameraZoom = .5, viewWidth = WIDTH / cameraZoom, viewHeight = HEIGHT / cameraZoom;
  const cameraX = Math.round((cameraFocus.x + 12 - viewWidth / 2) / 2) * 2;
  const cameraY = Math.round((cameraFocus.y + 14 - viewHeight / 2) / 2) * 2; ctx.save(); ctx.scale(cameraZoom, cameraZoom); ctx.translate(-cameraX, -cameraY);
  if (map.round) { ctx.save(); ctx.beginPath(); ctx.arc(320, 336, 336, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = map.floor[0]; ctx.fillRect(0, 0, map.worldWidth, map.worldHeight); }
  for (let y = 32; y < map.worldHeight - 32; y += 64) for (let x = 32; x < map.worldWidth - 32; x += 64) {
    ctx.fillStyle = (x / 64 + y / 64) % 2 ? map.floor[0] : map.floor[1]; ctx.fillRect(x, y, 64, 64);
    pixel(ctx, x + 12, y + 15, map.floor[2], 4); pixel(ctx, x + 43, y + 42, map.floor[2], 3);
    ctx.strokeStyle = level >= 13 && level <= 18 ? '#dff8ff' : '#64845a'; ctx.beginPath(); ctx.moveTo(x + 25, y + 50); ctx.lineTo(x + 27, y + 43); ctx.lineTo(x + 30, y + 50); ctx.stroke();
  }
  if (map.round) ctx.restore();
  if (!map.round) {
    const iceRegion = level >= 13 && level <= 18, coastalRegion=level===25||level===26, mudRegion = level >= 19 && level <= 24; ctx.fillStyle = coastalRegion?'#06170e':iceRegion ? 'rgba(35,94,119,.38)' : 'rgba(4,10,7,.78)'; ctx.fillRect(32, 32, map.worldWidth - 64, map.worldHeight - 64); ctx.strokeStyle = coastalRegion?'#092718':iceRegion ? '#477f9a' : mudRegion ? '#3d2a20' : '#17271d'; ctx.lineWidth = coastalRegion?260:158; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ROUTE_POINTS.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); }); ctx.stroke();if(coastalRegion){ctx.strokeStyle='#123d25';ctx.lineWidth=210;ctx.stroke();} ctx.strokeStyle = coastalRegion?'#194a30':mudRegion ? '#765037' : map.floor[1]; ctx.lineWidth = 136; ctx.stroke();
    if (mudRegion) ROUTE_POINTS.slice(1).forEach((end, index) => { const start=ROUTE_POINTS[index],dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;for(let distance=18;distance<length;distance+=34){const offset=Math.sin(distance*.17+index*2.4)*45,x=start.x+dx*distance/length+nx*offset,y=start.y+dy*distance/length+ny*offset;ctx.fillStyle=(Math.floor(distance/34)+index)%3===0?'#9a6c46':'#5d3e2e';ctx.fillRect(Math.round(x-5),Math.round(y-3),10,6);if(Math.floor(distance/34)%4===0){ctx.fillStyle='#35271f';ctx.fillRect(Math.round(x+12),Math.round(y-10),5,8);ctx.fillRect(Math.round(x+20),Math.round(y+2),5,8);}} });
    const desert = level >= 7 && level <= 12, ice = level >= 13 && level <= 18, water = level >= 19 && level <= 24; const borderPlant = desert ? drawCactus : ice ? drawIceSpire : coastalRegion?drawJungleTree:water ? drawWaterBarrier : drawTree;
    ROUTE_POINTS.slice(1).forEach((end, index) => { const start = ROUTE_POINTS[index]; const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length; for (let distance = 20; distance < length; distance += coastalRegion?44:52) { const px = start.x + dx * distance / length, py = start.y + dy * distance / length; borderPlant(ctx, px + nx * 88 - 30, py + ny * 88 - 30, desert ? '#4f8d43' : ice ? '#79ccef' : coastalRegion?'#236b3b':water ? '#405b32' : '#315f3c'); borderPlant(ctx, px - nx * 88 - 30, py - ny * 88 - 30, desert ? '#397a3c' : ice ? '#559fc8' : coastalRegion?'#19552f':water ? '#344d2c' : '#284f35'); } });
  }
  map.decorations.forEach((decoration) => drawDecoration(ctx, decoration.x, decoration.y, decoration.kind, decoration.variant, level >= 7 && level <= 12, level >= 13 && level <= 18,level===25||level===26));
  map.walls.forEach((wall,wallIndex) => {
    if((level===25||level===26)&&wallIndex<4)return;
    const desert = level >= 7 && level <= 12, ice = level >= 13 && level <= 18, coast=level===25||level===26, water = level >= 19 && level <= 24; const wallPlant = desert ? drawCactus : ice ? drawIceSpire : coast?drawJungleTree:water ? drawWaterBarrier : drawTree;
    ctx.fillStyle = desert ? '#624526' : ice ? '#315f79' : coast?'#8c6835':water ? '#263b24' : '#11271c'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    if (wall.w >= wall.h) for (let x = wall.x - 12; x < wall.x + wall.w; x += 48) wallPlant(ctx, x, wall.y + wall.h / 2 - 34, desert ? '#4b8b42' : ice ? '#69bde3' : coast?'#3f944d':water ? '#455f35' : map.floor[2]);
    else for (let y = wall.y - 18; y < wall.y + wall.h; y += 48) wallPlant(ctx, wall.x + wall.w / 2 - 32, y, desert ? '#4b8b42' : ice ? '#69bde3' : coast?'#3f944d':water ? '#455f35' : map.floor[2]);
  });
  map.chests.forEach((chest, index) => { const open = openedChests.includes(index); const drop = chestDrops[index]; if (!drop) return;
    const x=chest.x,y=chest.y,rarity=open?'#79502e':drop.rarity.color;
    ctx.fillStyle='rgba(0,0,0,.42)';ctx.fillRect(x-3,y+38,58,9);ctx.fillRect(x+3,y+45,46,3);
    if(open){ctx.fillStyle='#241812';ctx.fillRect(x+1,y-8,50,22);ctx.fillStyle='#4b3020';ctx.fillRect(x+5,y-4,42,14);ctx.fillStyle='#b58a3d';ctx.fillRect(x+5,y-4,42,4);ctx.fillRect(x+22,y-8,8,19);ctx.fillStyle='#17100d';ctx.fillRect(x+9,y+5,34,5);}
    else{ctx.fillStyle='#211611';ctx.fillRect(x-2,y+3,56,18);ctx.fillRect(x+2,y-2,48,5);ctx.fillStyle=rarity;ctx.fillRect(x+2,y+6,48,13);ctx.fillRect(x+6,y+1,40,5);ctx.fillStyle='#6b3e22';ctx.fillRect(x+6,y+10,40,6);ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x+8,y+3,25,3);ctx.fillStyle='#c49a45';ctx.fillRect(x+3,y+17,46,4);ctx.fillRect(x+22,y+1,8,18);}
    ctx.fillStyle='#211611';ctx.fillRect(x-3,y+19,58,23);ctx.fillStyle='#6a3d22';ctx.fillRect(x+1,y+22,50,17);ctx.fillStyle=rarity;ctx.fillRect(x+6,y+23,40,12);ctx.fillStyle='#8d5730';ctx.fillRect(x+7,y+24,38,4);ctx.fillStyle='#c49a45';ctx.fillRect(x+1,y+19,50,5);ctx.fillRect(x+3,y+35,46,5);ctx.fillRect(x+8,y+20,5,19);ctx.fillRect(x+39,y+20,5,19);ctx.fillStyle='#f6d36b';ctx.fillRect(x+21,y+20,11,14);ctx.fillStyle='#533819';ctx.fillRect(x+25,y+26,3,6);ctx.fillStyle='#17100d';ctx.fillRect(x+1,y+40,10,4);ctx.fillRect(x+41,y+40,10,4);
    if (!open) { ctx.fillStyle = '#07100b'; ctx.fillRect(chest.x - 70, chest.y - 42, 192, 34); ctx.strokeStyle='#e1bd60';ctx.lineWidth=3;ctx.strokeRect(chest.x-68,chest.y-40,188,30);ctx.fillStyle = '#fff4c7'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText('E · ОТКРЫТЬ СУНДУК', chest.x + 26, chest.y - 22);ctx.fillStyle=drop.rarity.color;ctx.font='bold 11px monospace';ctx.fillText(drop.rarity.name.toUpperCase(),chest.x+26,chest.y-11); ctx.textAlign = 'start'; }
  });
  map.carts.forEach((cart) => drawCart(ctx, cart.x, cart.y, map.floor[2]));
  if ((level === 6 || level === 12 || level === 18) && !enemies.some((enemy) => enemy.kind === 'boss')) drawMerchant(ctx, MERCHANT.x, MERCHANT.y);
  if (loot && droppedItem) drawLoot(ctx, loot, droppedItem);
  if (!map.round) {
    const routeExit = level === 0 ? { x: map.worldWidth - 70, y: 336 } : getRouteExit(); const exitX = routeExit.x; const exitY = routeExit.y - 46;
    if(level===26){ctx.fillStyle='#27342d';ctx.fillRect(exitX-8,exitY-26,62,118);ctx.fillStyle='#566557';ctx.fillRect(exitX-5,exitY-20,22,112);ctx.fillRect(exitX+34,exitY-20,22,112);ctx.fillStyle='#788674';for(let y=exitY-17;y<exitY+82;y+=18){ctx.fillRect(exitX-2,y,16,8);ctx.fillRect(exitX+37,y+7,16,8);}ctx.fillStyle='#171d19';ctx.fillRect(exitX+16,exitY+12,19,80);ctx.fillStyle='#a68b58';ctx.fillRect(exitX+23,exitY+15,4,74);if(castleGuardVisible){ctx.save();ctx.translate(exitX-67,exitY+38);ctx.scale(.38,.38);drawNativeWarrior(ctx,{x:0,y:0,kind:'nativeAxe',hp:1,maxHp:1,flash:0,attackUntil:0,stunnedUntil:0,color:'#8d552f',power:7,speed:0,leapStarted:0,leapUntil:0,leapTargetX:0,leapTargetY:0,nextLeapAt:0},now,false);ctx.restore();}}
    ctx.fillStyle = '#d5a84a'; ctx.fillRect(exitX, exitY, 12, 92);
    ctx.fillStyle='#07100b';ctx.fillRect(exitX-88,exitY-39,216,29);ctx.strokeStyle='#e1bd60';ctx.lineWidth=3;ctx.strokeRect(exitX-86,exitY-37,212,25);ctx.fillStyle = '#fff4c7'; ctx.font = 'bold 16px monospace'; ctx.fillText(level === 0 ? 'E · ОТКРЫТЬ ДВЕРЬ' : 'E · ПЕРЕЙТИ ДАЛЬШЕ', exitX - 78, exitY - 18);
  }
  if (level === 1) {
    const portalY = getRouteStart().y - 46; ctx.fillStyle = '#5cf2ff'; ctx.fillRect(32, portalY, 12, 92);
    ctx.fillStyle = '#b9faff'; ctx.fillRect(44, portalY + 12, 5, 68);
    ctx.fillStyle = '#f3ffff'; ctx.font = '8px monospace'; ctx.fillText('ПОРТАЛ · E', 51, portalY - 9);
  }
  if (level === 7) {
    const portalY = getRouteStart().y - 46; ctx.fillStyle = '#ffb33f'; ctx.fillRect(32, portalY, 12, 92);
    ctx.fillStyle = '#ffe08a'; ctx.fillRect(44, portalY + 12, 5, 68);
    ctx.fillStyle = '#fff0bf'; ctx.font = '8px monospace'; ctx.fillText('ПОРТАЛ В ГРОБНИЦУ · E', 51, portalY - 9);
  }
  if (level === 13) {
    const portalY = getRouteStart().y; const pulse = 1 + Math.sin(now / 180) * .08; ctx.save(); ctx.translate(52, portalY); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(56,184,255,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 33, 50, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5cf2ff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, 0, 27, 44, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#e7ffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 17, 34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -28, 6, 9); ctx.fillRect(13, 8, 4, 7); ctx.fillRect(-17, 18, 5, 8); ctx.restore();
    ctx.fillStyle = '#e9fbff'; ctx.font = 'bold 8px monospace'; ctx.fillText('ПОРТАЛ К ЛЕДЯНОМУ БОССУ · E', 87, portalY - 48);
  }
  if (level === 19) {
    const portalY = getRouteStart().y - 46; ctx.fillStyle = '#81934b'; ctx.fillRect(32, portalY, 12, 92);
    ctx.fillStyle = '#c0c96d'; ctx.fillRect(44, portalY + 12, 5, 68);
    ctx.fillStyle = '#d8df8a'; ctx.font = '8px monospace'; ctx.fillText('ПОРТАЛ К БОЛОТНОМУ БОССУ · E', 51, portalY - 9);
  }
  if (level > 0 && level % 6 === 0 && !enemies.some((enemy) => enemy.kind === 'boss')) {
    const pulse = 1 + Math.sin(now / 170) * .08; ctx.save(); ctx.translate(320, 336); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(90,238,255,.2)'; ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5cf2ff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, 0, 32, 48, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#e7ffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 21, 37, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#e7ffff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('ПОРТАЛ ПОБЕДЫ · E', 320, 278); ctx.textAlign = 'start';
  }
  enemies.forEach((e) => {
    if (e.hiddenInRock) return;
    const attacking = e.attackUntil > now; const distance = Math.max(1, Math.hypot(hero.x - e.x, hero.y - e.y));
    const force = attacking ? Math.sin((e.attackUntil - now) / 220 * Math.PI) * 4.5 : 0;
    const boss = e.kind === 'boss';
    const airborne = boss && e.leapStarted > 0 && now > e.leapStarted + 380 && now < e.leapUntil;
    if (airborne) {
      ctx.save(); ctx.translate(e.leapTargetX, e.leapTargetY);
      const swampJump=level===24,jumpProgress=Math.max(0,Math.min(1,(now-e.leapStarted)/Math.max(1,e.leapUntil-e.leapStarted)));ctx.fillStyle=swampJump?'rgba(22,30,12,.62)':'rgba(151,24,32,.22)'; ctx.beginPath(); ctx.arc(0, 0, swampJump?24+jumpProgress*58:80, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = swampJump?'#81934b':'#ff4655'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, swampJump?24+jumpProgress*58:80, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,170,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke(); ctx.restore();
      return;
    }
    if (!boss && e.kind !== 'mudPile') { ctx.fillStyle = '#171918'; ctx.fillRect(e.x + 1, e.y - 14, 26, 4); ctx.fillStyle = '#54292d'; ctx.fillRect(e.x + 3, e.y - 12, 22, 2); ctx.fillStyle = '#67d06f'; ctx.fillRect(e.x + 3, e.y - 12, 22 * Math.max(0, e.hp / e.maxHp), 2); }
    ctx.save();
    if (boss) { ctx.translate(e.x - 122 + (hero.x - e.x) / distance * force, e.y - 213 + (hero.y - e.y) / distance * force); ctx.scale(1.9, 1.9); }
    else { ctx.translate(e.x + 1 + (hero.x - e.x) / distance * force, e.y - 5 + (hero.y - e.y) / distance * force); const enemyScale = e.kind === 'goblin' || e.kind === 'monkey' || e.kind === 'nativeSpear' || e.kind === 'nativeClub' || e.kind === 'nativeAxe' || e.kind === 'mummy' || e.kind === 'iceGolem' || e.kind === 'iceSpirit' || e.kind === 'frog' || e.kind === 'mudPile' || e.kind === 'mudMonster' ? .38 : e.kind === 'snake' || e.kind === 'scorpion' ? .28 : .21; ctx.scale(enemyScale, enemyScale); }
    if(e.kind==='frog'&&(e.thrownUntil??0)>now){const progress=Math.max(0,Math.min(1,(now-(e.thrownStarted??now))/Math.max(1,(e.thrownUntil??now)-(e.thrownStarted??now))));ctx.translate(64,64);ctx.rotate(progress*Math.PI*4);ctx.scale(.68,.68);ctx.translate(-64,-64);}
    if (e.kind === 'iceGolem') { drawIceGolem(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#eaffff'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'iceSpirit') { drawIceSpirit(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#eaffff'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'frog') { drawFrog(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#d9ff88'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'mudPile' || e.kind === 'mudMonster') { drawMudCreature(ctx, e, now, attacking); ctx.restore(); if (e.kind === 'mudMonster' && e.stunnedUntil > now) { ctx.fillStyle = '#d8c76b'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'scorpion') { drawScorpion(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#ffe56b'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'mummy') { drawMummy(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#ffe56b'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'snake') { drawJungleSnake(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#d9ff88'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'monkey') { drawMonkey(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#ffe56b'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'nativeSpear' || e.kind === 'nativeClub' || e.kind === 'nativeAxe') { drawNativeWarrior(ctx, e, now, attacking); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#ffe56b'; ctx.font = 'bold 14px monospace'; ctx.fillText('★ ★ ★', e.x - 7, e.y - 22); } return; }
    if (e.kind === 'goblin' || boss) { if (boss && level === 12) drawMummyBoss(ctx, e, now); else if (boss && level === 18) drawIceGolem(ctx, e, now, attacking); else if (boss && level === 24) drawFrogBoss(ctx,e,now,attacking); else drawGoblin(ctx, e, now, attacking || (boss && e.leapStarted > 0)); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = level === 18 ? '#dffcff' : '#ffe56b'; ctx.font = `bold ${boss ? 22 : 14}px monospace`; ctx.fillText('★ ★ ★', e.x - (boss ? 42 : 7), e.y - (boss ? 235 : 22) + Math.sin(now / 90) * 3); } return; }
    const walking = distance > 18 && !attacking; const walkPhase = walking ? Math.sin(now / 105 + e.x * .02) : 0; const hop = walking ? Math.abs(walkPhase) * 9 : 0;
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(64, 112, 49 - hop * .8, 11 - hop * .18, 0, 0, Math.PI * 2); ctx.fill();
    const wobble = Math.sin(now / 180 + e.x * .02) * .045; ctx.translate(0, -hop); ctx.translate(64, 108); ctx.scale(1 + wobble, 1 - wobble); ctx.translate(-64, -108);
    const body = e.flash > 0 ? '#fff' : e.color; ctx.fillStyle = '#14251c'; ctx.beginPath(); ctx.moveTo(12, 98); ctx.lineTo(12, 70); ctx.lineTo(24, 70); ctx.lineTo(24, 48); ctx.lineTo(36, 48); ctx.lineTo(36, 30); ctx.lineTo(48, 30); ctx.lineTo(48, 22); ctx.lineTo(82, 22); ctx.lineTo(82, 30); ctx.lineTo(96, 30); ctx.lineTo(96, 48); ctx.lineTo(108, 48); ctx.lineTo(108, 70); ctx.lineTo(118, 70); ctx.lineTo(118, 98); ctx.lineTo(106, 108); ctx.lineTo(22, 108); ctx.closePath(); ctx.fill();
    ctx.fillStyle = body; ctx.fillRect(24, 48, 82, 52); ctx.fillRect(36, 32, 58, 68); ctx.fillRect(48, 24, 34, 76); ctx.fillRect(16, 70, 98, 27);
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(34, 40, 18, 10); ctx.fillRect(29, 56, 8, 24); ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(88, 70, 10, 10); ctx.fillRect(29, 85, 7, 7);
    ctx.fillStyle = '#fff'; ctx.fillRect(35, 47, 25, 30); ctx.fillRect(69, 47, 25, 30); ctx.fillStyle = '#201a24'; ctx.fillRect(47, 57, 9, 15); ctx.fillRect(73, 57, 9, 15); ctx.fillStyle = '#fff'; ctx.fillRect(49, 58, 3, 4); ctx.fillRect(75, 58, 3, 4);
    ctx.fillStyle = '#26332d'; ctx.beginPath(); ctx.ellipse(34 + walkPhase * 10, 105 - Math.max(0, walkPhase) * 5, 21, 8, 0, 0, Math.PI * 2); ctx.ellipse(94 - walkPhase * 10, 105 + Math.min(0, walkPhase) * 5, 21, 8, 0, 0, Math.PI * 2); ctx.fill();
    if (attacking) { ctx.strokeStyle = '#ffdf8c'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(64, 68, 78, -.85, .85); ctx.stroke(); }
    ctx.restore();
    if (e.stunnedUntil > now) { ctx.fillStyle = '#ffe56b'; ctx.font = 'bold 14px monospace'; ctx.fillText('★  ★  ★', e.x - 7, e.y - 22 + Math.sin(now / 90) * 3); }
  });
  projectiles.forEach((arrow) => { const angle = Math.atan2(arrow.vy, arrow.vx); ctx.save(); ctx.translate(arrow.x, arrow.y); ctx.rotate(angle); ctx.fillStyle = '#765030'; ctx.fillRect(-10, -2, 22, 4); ctx.fillStyle = arrow.color; ctx.fillRect(8, -4, 8, 8); ctx.fillStyle = '#eee4c7'; ctx.fillRect(-13, -5, 5, 10); ctx.restore(); });
  superFists.forEach((fist) => { const angle = Math.atan2(fist.vy, fist.vx); ctx.save(); ctx.translate(fist.x, fist.y); ctx.rotate(angle); ctx.fillStyle = 'rgba(255,196,80,.2)'; ctx.fillRect(-42, -36, 84, 72); ctx.fillStyle = '#5c321f'; ctx.fillRect(-30, -23, 40, 46); ctx.fillStyle = '#d78a4e'; ctx.fillRect(-24, -18, 38, 36); ctx.fillRect(6, -27, 16, 19); ctx.fillRect(18, -24, 15, 18); ctx.fillRect(29, -18, 14, 17); ctx.fillRect(37, -10, 12, 16); ctx.fillStyle = '#f3b873'; ctx.fillRect(-18, -14, 25, 8); ctx.fillRect(9, -23, 9, 5); ctx.restore(); });
  swordUltimates.forEach((ultimate) => drawSwordUltimate(ctx, ultimate, now));
  bowUltimates.forEach((ultimate) => drawBowUltimate(ctx, ultimate, now));
  staffUltimates.forEach((ultimate) => drawStaffUltimate(ctx, ultimate, now));
  glovesUltimates.forEach((ultimate) => drawGlovesUltimate(ctx, ultimate, now));
  waves.forEach((wave) => { const progress = Math.min(1, (now - wave.started) / (wave.until - wave.started)); ctx.save(); ctx.translate(wave.x, wave.y); ctx.rotate(Math.atan2(wave.dy, wave.dx)); ctx.globalAlpha = 1 - progress * .65; ctx.fillStyle = wave.color; ctx.fillRect(8, -48, 24 + progress * 48, 96); ctx.fillStyle = '#ffe8c7'; ctx.fillRect(18 + progress * 34, -38, 12, 76); ctx.strokeStyle = '#fff4d8'; ctx.lineWidth = 3; ctx.strokeRect(8, -48, 24 + progress * 48, 96); ctx.restore(); });
  tombs.forEach((tomb) => drawTomb(ctx, tomb, now)); sandTornadoes.forEach((tornado) => drawSandTornado(ctx, tornado, now));
  const swallowedPlayer=enemies.find((enemy)=>enemy.kind==='boss'&&(enemy.swallowUntil??0)>now)?.swallowedPlayer;
  if(swallowedPlayer!==1)drawHero(ctx, hero, attackProgress, weapon, armor, facing, moving, now, health, profileName, false, swordUltimates.find((ultimate) => ultimate.owner === 1 && now < ultimate.until), bowUltimates.find((ultimate) => ultimate.owner === 1 && now < ultimate.rainStarted), glovesUltimates.find((ultimate) => ultimate.owner === 1 && ultimate.name.includes('титана') && !ultimate.landed), skin);
  if (secondHero&&swallowedPlayer!==2) drawHero(ctx, secondHero, attackProgress2, weapon2, armor2, secondFacing, secondMoving, now, secondHealth, 'Игрок 2', true, swordUltimates.find((ultimate) => ultimate.owner === 2 && now < ultimate.until), bowUltimates.find((ultimate) => ultimate.owner === 2 && now < ultimate.rainStarted), glovesUltimates.find((ultimate) => ultimate.owner === 2 && ultimate.name.includes('титана') && !ultimate.landed), skin2);
  drawVisibleHitboxes(ctx, map, enemies, hero, secondHero);
  const fog = document.createElement('canvas'); fog.width = map.worldWidth; fog.height = map.worldHeight; const fogCtx = fog.getContext('2d'); if (fogCtx) { fogCtx.fillStyle = 'rgba(1,4,3,.94)'; fogCtx.fillRect(0, 0, map.worldWidth, map.worldHeight); fogCtx.globalCompositeOperation = 'destination-out'; explored.forEach((point) => { const gradient = fogCtx.createRadialGradient(point.x, point.y, 160, point.x, point.y, 190); gradient.addColorStop(0, 'rgba(0,0,0,1)'); gradient.addColorStop(1, 'rgba(0,0,0,0)'); fogCtx.fillStyle = gradient; fogCtx.beginPath(); fogCtx.arc(point.x, point.y, 190, 0, Math.PI * 2); fogCtx.fill(); }); ctx.drawImage(fog, 0, 0); }
  ctx.restore();
  drawMinimap(ctx, map, level, hero, enemies, chestDrops, openedChests, explored, mobileControls);
  const boss = enemies.find((enemy) => enemy.kind === 'boss');
  if (boss) {
    ctx.save(); ctx.translate(0, 54);
    ctx.fillStyle = '#251914'; ctx.fillRect(151, 6, 338, 31); ctx.fillStyle = '#6c482b'; ctx.fillRect(156, 9, 328, 25); ctx.fillStyle = '#171012'; ctx.fillRect(162, 12, 316, 19);
    ctx.fillStyle = '#87939a'; ctx.beginPath(); ctx.moveTo(151, 7); ctx.lineTo(139, 1); ctx.lineTo(146, 17); ctx.fill(); ctx.beginPath(); ctx.moveTo(489, 7); ctx.lineTo(501, 1); ctx.lineTo(494, 17); ctx.fill();
    ctx.fillStyle = '#69ad68'; ctx.beginPath(); ctx.moveTo(157, 12); ctx.lineTo(128, 6); ctx.lineTo(153, 25); ctx.fill(); ctx.beginPath(); ctx.moveTo(483, 12); ctx.lineTo(512, 6); ctx.lineTo(487, 25); ctx.fill();
    ctx.fillStyle = '#e8e4bd'; ctx.beginPath(); ctx.moveTo(166, 24); ctx.lineTo(174, 37); ctx.lineTo(180, 23); ctx.fill(); ctx.beginPath(); ctx.moveTo(460, 23); ctx.lineTo(466, 37); ctx.lineTo(474, 24); ctx.fill();
    ctx.fillStyle = '#d7bd63'; ctx.fillRect(146, 17, 9, 9); ctx.fillRect(485, 17, 9, 9);
    ctx.fillStyle = '#f0d7b0'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(level === 24 ? 'КОРОЛЬ ЖАБ' : 'ВЕЛИКИЙ ГОБЛИН', 320, 20); ctx.textAlign = 'start';
    ctx.fillStyle = '#35191d'; ctx.fillRect(170, 24, 300, 7); ctx.fillStyle = '#ef3949'; ctx.fillRect(170, 24, 300 * Math.max(0, boss.hp / boss.maxHp), 7);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(172, 25, 296 * Math.max(0, boss.hp / boss.maxHp), 2);
    if (level === 12) {
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = '#211b17'; ctx.fillRect(142, 3, 356, 36); ctx.fillStyle = '#8b6b3d'; ctx.fillRect(147, 6, 346, 30); ctx.fillStyle = '#cba75b'; ctx.fillRect(151, 9, 338, 24); ctx.fillStyle = '#40352a'; ctx.fillRect(157, 12, 326, 18);
      ctx.fillStyle = '#e8d7a5'; ctx.fillRect(166, 24, 308, 8); ctx.fillStyle = '#5c371f'; ctx.fillRect(170, 25, 300, 6); ctx.fillStyle = boss.revived ? '#e78232' : '#d3a83e'; ctx.fillRect(170, 25, 300 * ratio, 6); ctx.fillStyle = '#fff0a5'; ctx.fillRect(172, 26, 296 * ratio, 2);
      ctx.fillStyle = '#d9c79b'; for (let x = 158; x < 483; x += 34) { ctx.fillRect(x, 13, 22, 3); ctx.fillRect(x + 8, 18, 24, 3); }
      ctx.fillStyle = '#17130f'; ctx.beginPath(); ctx.moveTo(151,18); ctx.lineTo(162,11); ctx.lineTo(173,18); ctx.lineTo(162,25); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.moveTo(467,18); ctx.lineTo(478,11); ctx.lineTo(489,18); ctx.lineTo(478,25); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#66d6c4'; ctx.fillRect(159,16,6,4); ctx.fillRect(475,16,6,4);
      ctx.fillStyle = '#fff0c2'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(boss.revived ? 'ВЛАДЫКА ГРОБНИЦ · ВОЗРОЖДЁННЫЙ' : 'ВЛАДЫКА ГРОБНИЦ', 320, 20); ctx.textAlign = 'start';
    }
    if(level===24){const ratio=Math.max(0,boss.hp/boss.maxHp);ctx.fillStyle='#172316';ctx.fillRect(140,3,360,37);ctx.fillStyle='#405b32';ctx.fillRect(146,7,348,29);ctx.fillStyle='#81934b';ctx.fillRect(152,11,336,21);ctx.fillStyle='#26351f';ctx.fillRect(163,23,314,9);ctx.fillStyle='#702f3d';ctx.fillRect(167,25,306,6);ctx.fillStyle='#b9d45e';ctx.fillRect(167,25,306*ratio,6);ctx.fillStyle='#e2ef91';ctx.fillRect(169,26,302*ratio,2);ctx.fillStyle='#d8e997';ctx.fillRect(151,8,20,15);ctx.fillRect(469,8,20,15);ctx.fillStyle='#172116';ctx.fillRect(158,13,7,8);ctx.fillRect(475,13,7,8);ctx.fillStyle='#f1c54e';ctx.beginPath();ctx.moveTo(291,10);ctx.lineTo(296,0);ctx.lineTo(306,8);ctx.lineTo(320,-2);ctx.lineTo(334,8);ctx.lineTo(344,0);ctx.lineTo(349,10);ctx.closePath();ctx.fill();ctx.fillStyle='#eef2b0';ctx.font='bold 9px monospace';ctx.textAlign='center';ctx.fillText('КОРОЛЬ ЖАБ',320,20);ctx.textAlign='start';}
    ctx.restore();
  }
  if (!mobileControls) { ctx.save(); ctx.translate(0, -58);
  ctx.fillStyle = superReloading ? 'rgba(18,18,18,.88)' : 'rgba(78,45,25,.9)'; ctx.beginPath(); ctx.arc(588, 348, 38, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = superReloading ? '#4b4b4b' : '#ffc95c'; ctx.lineWidth = 4; ctx.stroke();
  const shadowReach = 10 + Math.sin(now / 130) * 3;
  if (weapon?.type === 'sword') { if (!superReloading) { drawPixelSwordIcon(ctx, 588 - shadowReach, 343, '#ff4f66'); drawPixelSwordIcon(ctx, 588 + shadowReach, 343, '#4fa8ff'); } drawPixelSwordIcon(ctx, 588, 343, superReloading ? '#555' : weapon.color); }
  else if (weapon?.type === 'bow') { if (!superReloading) { drawPixelBowIcon(ctx, 588 - shadowReach, 343, '#ff4f66'); drawPixelBowIcon(ctx, 588 + shadowReach, 343, '#4fa8ff'); } drawPixelBowIcon(ctx, 588, 343, superReloading ? '#555' : weapon.color); }
  else if (weapon?.type === 'staff') { if (!superReloading) { drawPixelStaffIcon(ctx, 588 - shadowReach, 343, '#ff4f66'); drawPixelStaffIcon(ctx, 588 + shadowReach, 343, '#4fa8ff'); } drawPixelStaffIcon(ctx, 588, 343, superReloading ? '#555' : weapon.color); }
  else if (weapon?.type === 'gloves') { if (!superReloading) { drawPixelGlovesIcon(ctx, 588 - shadowReach, 343, '#ff4f66'); drawPixelGlovesIcon(ctx, 588 + shadowReach, 343, '#4fa8ff'); } drawPixelGlovesIcon(ctx, 588, 343, superReloading ? '#555' : weapon.color); }
  else { if (!superReloading) { drawPixelFistIcon(ctx, 588 - shadowReach, 343, '#ff4f66', .55); drawPixelFistIcon(ctx, 588 + shadowReach, 343, '#4fa8ff', .55); drawPixelFistIcon(ctx, 588, 343 - shadowReach, '#69e07b', .5); drawPixelFistIcon(ctx, 588, 343 + shadowReach, '#ba68ff', .5); } drawPixelFistIcon(ctx, 588, 343, superReloading ? '#555' : '#f2a85d'); }
  ctx.textAlign = 'center';
  ctx.fillStyle = superReloading ? '#777' : '#ffd86b'; ctx.font = 'bold 10px monospace'; ctx.fillText(superReloading ? '...' : 'Q', 588, 367); ctx.textAlign = 'start';
  if (secondHero) { ctx.fillStyle = superReloading2 ? 'rgba(18,18,18,.88)' : 'rgba(57,34,72,.92)'; ctx.beginPath(); ctx.arc(500, 348, 38, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = superReloading2 ? '#4b4b4b' : '#dc83ff'; ctx.lineWidth = 4; ctx.stroke(); if (weapon2?.type === 'sword') drawPixelSwordIcon(ctx, 500, 343, superReloading2 ? '#555' : weapon2.color); else if (weapon2?.type === 'bow') drawPixelBowIcon(ctx, 500, 343, superReloading2 ? '#555' : weapon2.color); else if (weapon2?.type === 'staff') drawPixelStaffIcon(ctx, 500, 343, superReloading2 ? '#555' : weapon2.color); else if (weapon2?.type === 'gloves') drawPixelGlovesIcon(ctx, 500, 343, superReloading2 ? '#555' : weapon2.color); else drawPixelFistIcon(ctx, 500, 343, superReloading2 ? '#555' : '#d99be9'); ctx.textAlign = 'center'; ctx.fillStyle = superReloading2 ? '#777' : '#f0b4ff'; ctx.font = 'bold 10px monospace'; ctx.fillText(superReloading2 ? '...' : 'Б', 500, 367); ctx.textAlign = 'start'; }
  ctx.restore(); }
}

export function DungeonGame({ paused = false, enemyMultiplier = 1, startingCoins = 0, oneHitBoss = false, startingLevel: requestedStartingLevel, profileName, players = 1, playerClass = 'knight', playerClass2 = 'knight', initialSave, tutorial = false, merchantMode = false, mobileControls = false, equippedSkin = 'default', travelToLevel, saveRequest = 0, onSaveSnapshot, onVictory, onShopOpenChange, networkRole = null, remotePosition = null, onNetworkPosition, remoteGameState = null, onNetworkGameState, keyBindings = DEFAULT_KEY_BINDINGS }: { paused?: boolean; enemyMultiplier?: number; startingCoins?: number; oneHitBoss?: boolean; startingLevel?: number | null; profileName: string; players?: 1 | 2; playerClass?: PlayerClass; playerClass2?: PlayerClass; initialSave?: GameSave | null; tutorial?: boolean; merchantMode?: boolean; mobileControls?: boolean; equippedSkin?: string; travelToLevel?: number | null; saveRequest?: number; onSaveSnapshot?: (save: GameSave) => void; onVictory?: (level: number) => void; onShopOpenChange?: (open: boolean) => void; networkRole?: 'host' | 'guest' | null; remotePosition?: (Point & { fx?: number; fy?: number; moving?: boolean }) | null; onNetworkPosition?: (position: Point & { fx?: number; fy?: number; moving?: boolean }) => void; remoteGameState?: NetworkGameState | null; onNetworkGameState?: (state: NetworkGameState) => void; keyBindings?: KeyBindings }) {
  const oneGameLoadout = useRef(!initialSave && typeof window !== 'undefined' && sessionStorage.getItem(ONE_GAME_LOADOUT_KEY) !== 'used').current;
  const effectiveTutorial = tutorial;
  const requestedLevel = initialSave?.level ?? (effectiveTutorial ? 0 : requestedStartingLevel ?? 1);
  const stageInRegion = requestedLevel > 0 ? ((requestedLevel - 1) % 6) + 1 : 0;
  const startingLevel = stageInRegion === 4 || stageInRegion === 5 ? requestedLevel + (6 - stageInRegion) : requestedLevel;
  const savedMapIsRemoved = Boolean(initialSave && startingLevel !== initialSave.level);
  const loadedFirstMap = !savedMapIsRemoved && initialSave?.map ? initialSave.map : effectiveTutorial ? getTutorialLevel() : getLevel(startingLevel);
  const firstMap = startingLevel >= 19 && startingLevel <= 24 ? { ...loadedFirstMap, enemies: loadedFirstMap.enemies.map((enemy) => enemy.kind === 'slime' ? { ...enemy, kind: 'frog' as const } : enemy.kind === 'goblin' ? { ...enemy, kind: 'mudPile' as const } : enemy) } : loadedFirstMap;
  const castleTestStart = startingLevel === 26 ? getRouteExit() : null;
  const startingPoint = !savedMapIsRemoved && initialSave?.hero ? initialSave.hero : effectiveTutorial ? { x: 75, y: 320 } : castleTestStart ? { x: castleTestStart.x - 96, y: castleTestStart.y - 14 } : firstMap.round ? { x: 35, y: 322 } : getRouteStart();
  const currentMap = useRef(firstMap);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hero = useRef<Point>(startingPoint);
  const facing = useRef<Point>({ x: 1, y: 0 });
  const hero2 = useRef<Point>(!savedMapIsRemoved && initialSave?.hero2 ? initialSave.hero2 : firstMap.round ? { x: 65, y: 322 } : { ...startingPoint, y: startingPoint.y + 32 });
  const remoteMovingUntil = useRef(0);
  const nextNetworkStateAt = useRef(0);
  const nextNetworkMapAt = useRef(0);
  const facing2 = useRef<Point>({ x: 1, y: 0 });
  const enemies = useRef<Enemy[]>(!savedMapIsRemoved && initialSave?.enemies ? initialSave.enemies.map((enemy) => startingLevel >= 19 && startingLevel <= 24 && enemy.kind === 'slime' ? { ...enemy, kind: 'frog', hp: 4, maxHp: 4, color: '#58a94f', nextShotAt: 0, nextLeapAt: 0 } : startingLevel >= 19 && startingLevel <= 24 && enemy.kind === 'goblin' ? { ...enemy, kind: 'mudPile', hp: 9999, maxHp: 9999, power: 5, color: '#60452f' } : enemy) : createEnemies(firstMap, enemyMultiplier, oneHitBoss));
  const keys = useRef(new Set<string>());
  const mobileMove = useRef<Point>({ x: 0, y: 0 });
  const projectiles = useRef<Projectile[]>([]);
  const superFists = useRef<SuperFist[]>([]);
  const swordUltimates = useRef<SwordUltimate[]>([]);
  const bowUltimates = useRef<BowUltimate[]>([]);
  const staffUltimates = useRef<StaffUltimate[]>([]);
  const glovesUltimates = useRef<GlovesUltimate[]>([]);
  const waves = useRef<MagicWave[]>([]);
  const sandTornadoes = useRef<SandTornado[]>([]);
  const activatedSnakeRocks = useRef(new Set<number>());
  const tombs = useRef<Tomb[]>([]);
  const weaponRef = useRef<Weapon | null>(null);
  const weapon2Ref = useRef<Weapon | null>(null);
  const readyAt = useRef(0);
  const readyAt2 = useRef(0);
  const superReadyAt = useRef(0);
  const superReadyAt2 = useRef(0);
  const attackUntil = useRef(0);
  const attackUntil2 = useRef(0);
  const healReadyAt = useRef(0);
  const healReadyAt2 = useRef(0);
  const poisonedUntil = useRef(0);
  const poisonedUntil2 = useRef(0);
  const slowedUntil = useRef(0);
  const slowedUntil2 = useRef(0);
  const nextPoisonTick = useRef(0);
  const nextPoisonTick2 = useRef(0);
  const itemPicker = useRef<1 | 2>(1);
  const handledSaveRequest = useRef(saveRequest);
  const nextFootstepAt = useRef(0);
  const nextNetworkSendAt = useRef(0);
  const ambushAt = useRef(-1);
  const tutorialStep = useRef(0);
  const [tutorialGuide, setTutorialGuide] = useState('Иди вперёд. Обходи препятствия и следуй по дороге к воротам.');
  const explored = useRef<Point[]>(!savedMapIsRemoved && initialSave?.explored ? initialSave.explored : [{ ...startingPoint }]);
  const exploredLevel = useRef(startingLevel);
  const checkpointLevel = useRef(startingLevel);
  const [health, setHealth] = useState(initialSave?.health ?? 10);
  const [health2, setHealth2] = useState(initialSave?.health2 ?? 10);
  const [coins, setCoins] = useState(initialSave?.coins ?? startingCoins);
  const [medkits, setMedkits] = useState(initialSave?.medkits ?? 0);
  const [medkits2, setMedkits2] = useState(initialSave?.medkits2 ?? 0);
  const [inventory, setInventory] = useState<Weapon[]>(initialSave?.inventory ?? (oneGameLoadout ? [ONE_GAME_SWORD, ONE_GAME_ARMOR] : []));
  const [inventory2, setInventory2] = useState<Weapon[]>(initialSave?.inventory2 ?? []);
  const [inventoryCapacity, setInventoryCapacity] = useState(initialSave?.inventoryCapacity ?? 10);
  const [inventoryCapacity2, setInventoryCapacity2] = useState(initialSave?.inventoryCapacity2 ?? 10);
  const [inventoryOwner, setInventoryOwner] = useState<1 | 2>(1);
  const [showInventory, setShowInventory] = useState(false);
  const [openedChests, setOpenedChests] = useState<number[]>(initialSave?.openedChests ?? []);
  const [loot, setLoot] = useState<Point | null>(initialSave?.loot ?? null);
  const [droppedItem, setDroppedItem] = useState<Weapon | null>(initialSave?.droppedItem ?? null);
  const [choiceItem, setChoiceItem] = useState<Weapon | null>(null);
  const [chestDrops, setChestDrops] = useState<LootDrop[]>(() => initialSave?.chestDrops ?? firstMap.chests.map(() => startingLevel === 0 ? getTutorialClassLoot(playerClass) : getRandomLoot(startingLevel)));
  const [weapon, setWeapon] = useState<Weapon | null>(initialSave?.weapon ?? (oneGameLoadout ? ONE_GAME_SWORD : null));
  const [weapon2, setWeapon2] = useState<Weapon | null>(initialSave?.weapon2 ?? null);
  const [armor, setArmor] = useState<Weapon | null>(initialSave?.armor ?? (oneGameLoadout ? ONE_GAME_ARMOR : null));
  const [armor2, setArmor2] = useState<Weapon | null>(initialSave?.armor2 ?? null);
  const [armorHealth, setArmorHealth] = useState(initialSave?.armorHealth ?? (oneGameLoadout ? 20 : 0));
  const [armorHealth2, setArmorHealth2] = useState(initialSave?.armorHealth2 ?? 0);
  const armorHealthRef = useRef(initialSave?.armorHealth ?? (oneGameLoadout ? 20 : 0));
  const armorHealthRef2 = useRef(initialSave?.armorHealth2 ?? 0);
  const [level, setLevel] = useState(startingLevel);
  const [dead, setDead] = useState(false);
  const [victory, setVictory] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [castleGuardDialogueOpen, setCastleGuardDialogueOpen] = useState(false);
  const [castleGuardOutcome, setCastleGuardOutcome] = useState<'locked'|'peace'|'farewell'|'fight'>('locked');
  useEffect(() => { if (!remotePosition || !networkRole) return; const remote = networkRole === 'host' ? hero2.current : hero.current; const moved = Math.hypot(remote.x - remotePosition.x, remote.y - remotePosition.y) > .4; remote.x = remotePosition.x; remote.y = remotePosition.y; if (remotePosition.fx !== undefined && remotePosition.fy !== undefined) { const direction = networkRole === 'host' ? facing2 : facing; direction.current = { x: remotePosition.fx, y: remotePosition.fy }; } if (moved || remotePosition.moving) remoteMovingUntil.current = performance.now() + 180; }, [networkRole, remotePosition]);
  useEffect(() => { if (!networkRole || !remoteGameState || remoteGameState.sender === networkRole) return; if (networkRole === 'guest') { if (remoteGameState.map) currentMap.current = remoteGameState.map; if (remoteGameState.level !== level) { setLevel(remoteGameState.level); checkpointLevel.current = remoteGameState.level; setChoiceItem(null); } enemies.current = remoteGameState.enemies.map((enemy) => ({ ...enemy })); setOpenedChests(remoteGameState.openedChests); setChestDrops(remoteGameState.chestDrops); setLoot(remoteGameState.loot); setDroppedItem(remoteGameState.droppedItem); } else { if (remoteGameState.level !== level) { if (!remoteGameState.map) return; currentMap.current = remoteGameState.map; setLevel(remoteGameState.level); checkpointLevel.current = remoteGameState.level; enemies.current = remoteGameState.enemies.map((enemy) => ({ ...enemy })); setOpenedChests(remoteGameState.openedChests); setChestDrops(remoteGameState.chestDrops); setLoot(remoteGameState.loot); setDroppedItem(remoteGameState.droppedItem); return; } const unmatched = new Set(remoteGameState.enemies.map((_, index) => index)); enemies.current.forEach((enemy) => { let match=-1,best=100; unmatched.forEach((index)=>{const candidate=remoteGameState.enemies[index];if(candidate.kind!==enemy.kind)return;const distance=Math.hypot(candidate.x-enemy.x,candidate.y-enemy.y);if(distance<best){best=distance;match=index;}});if(match>=0){const guestEnemy=remoteGameState.enemies[match];unmatched.delete(match);if(guestEnemy.hp<enemy.hp)enemy.hp=guestEnemy.hp;}else if(remoteGameState.enemies.length<enemies.current.length)enemy.hp=0; }); const combined = Array.from(new Set([...openedChests, ...remoteGameState.openedChests])); if (combined.length !== openedChests.length) setOpenedChests(combined); const guestKnowsAllOpened=openedChests.every((index)=>remoteGameState.openedChests.includes(index)); if (guestKnowsAllOpened && loot && !remoteGameState.loot) { setLoot(null); setDroppedItem(null); setChoiceItem(null); } } }, [level, networkRole, openedChests, remoteGameState]);
  const [shopOwner, setShopOwner] = useState<1 | 2>(1);
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null);
  const [skin, setSkin] = useState<HeroSkin>((['dune','king','wizard','gentleman'].includes(equippedSkin) ? equippedSkin : 'default') as HeroSkin);
  const [skin2, setSkin2] = useState<HeroSkin>('default');
  const victoryReported = useRef(false);
  const [reloading, setReloading] = useState(false);
  const [superReloading, setSuperReloading] = useState(false);
  const [superReloading2, setSuperReloading2] = useState(false);
  const [teammateFallen, setTeammateFallen] = useState(false);
  const [, setMessage] = useState(tutorial ? 'ОБУЧЕНИЕ: двигайся клавишами WASD. Второй игрок использует стрелки.' : 'Найди старый сундук в северо-восточной части зала.');

  useEffect(() => { onShopOpenChange?.(shopOpen); return () => onShopOpenChange?.(false); }, [onShopOpenChange, shopOpen]);
  useEffect(() => { if (oneGameLoadout) sessionStorage.setItem(ONE_GAME_LOADOUT_KEY, 'used'); }, [oneGameLoadout]);

  const restart = () => {
    const checkpoint = checkpointLevel.current; const restartLevel = dead && checkpoint > 0 && checkpoint % 6 === 0 ? checkpoint - 5 : checkpoint; rerollLevel(restartLevel); const map = getLevel(restartLevel); const start = map.round ? { x: 35, y: 322 } : getRouteStart();
    hero.current = start; facing.current = { x: 1, y: 0 };
    hero2.current = map.round ? { x: 65, y: 322 } : { ...start, y: start.y + 32 }; facing2.current = { x: 1, y: 0 };
    currentMap.current = map; explored.current = [{ ...start }]; exploredLevel.current = restartLevel; enemies.current = createEnemies(map, enemyMultiplier);
    ambushAt.current = -1;
    slowedUntil.current = 0; slowedUntil2.current = 0;
    keys.current.clear(); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; sandTornadoes.current = []; tombs.current = []; readyAt.current = 0; readyAt2.current = 0; attackUntil2.current = 0; healReadyAt.current = 0; healReadyAt2.current = 0; superReadyAt.current = 0; superReadyAt2.current = 0; poisonedUntil.current = 0; poisonedUntil2.current = 0; nextPoisonTick.current = 0; nextPoisonTick2.current = 0; setReloading(false); setSuperReloading(false); setSuperReloading2(false); setHealth(10); setHealth2(10); setInventoryOwner(1); setShowInventory(false); setOpenedChests([]); setLoot(null); setDroppedItem(null); setChoiceItem(null); setChestDrops(map.chests.map(() => getRandomLoot(restartLevel)));
    checkpointLevel.current = restartLevel; setLevel(restartLevel); setDead(false); setTeammateFallen(false); setVictory(false); victoryReported.current = false; setMessage(restartLevel !== checkpoint ? `Возвращение на первый уровень локации: ${restartLevel}. Здоровье восстановлено, ресурсы сохранены.` : `Уровень ${restartLevel} перезапущен. Здоровье восстановлено, ресурсы сохранены.`);
  };

  useEffect(() => { checkpointLevel.current = level; }, [level]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if(event.isTrusted){const action=(Object.keys(keyBindings) as Array<keyof KeyBindings>).find((id)=>keyBindings[id]===event.code);const mapped=action?CANONICAL_CONTROL_CODES[action]:event.code;if(mapped!==event.code){event.preventDefault();window.dispatchEvent(new KeyboardEvent('keydown',{code:mapped,repeat:event.repeat,bubbles:true}));return;}}
      keys.current.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyH', 'KeyL', 'KeyQ', 'KeyI', 'KeyE', 'Period', 'Quote', 'Comma', 'Semicolon', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (false && event.code === 'KeyY' && !event.repeat) {
        event.preventDefault(); rerollLevel(13); const map = getLevel(13); const start = getRouteStart(); currentMap.current = map; checkpointLevel.current = 13; exploredLevel.current = 13; explored.current = [{ ...start }]; hero.current = start; hero2.current = { ...start, y: start.y + 32 }; enemies.current = createEnemies(map, enemyMultiplier); keys.current.clear(); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; sandTornadoes.current = []; tombs.current = []; setLevel(13); setHealth(10); setHealth2(10); setDead(false); setVictory(false); setOpenedChests([]); setChestDrops(map.chests.map(() => getRandomLoot(13))); setLoot(null); setDroppedItem(null); setChoiceItem(null); setMessage('Телепорт Y: Ледяное кладбище · уровень 13.'); return;
      }
      if (event.code === 'KeyI' && !event.repeat) { keys.current.clear(); setInventoryOwner(1); setShowInventory((current) => inventoryOwner === 1 ? !current : true); return; }
      if (players === 2 && event.code === 'Quote' && !event.repeat) { keys.current.clear(); setInventoryOwner(2); setShowInventory((current) => inventoryOwner === 2 ? !current : true); return; }
      if (players === 1 && event.code === 'KeyH' && !event.repeat) {
        const now = performance.now();
        if (health <= 0) { setMessage('Павший герой не может вылечить себя.'); return; }
        if (health >= 10) { setMessage('Здоровье уже полное.'); return; }
        if (medkits <= 0) { setMessage('Аптечки закончились. Купи новую у торговца.'); return; }
        if (now < healReadyAt.current) { setMessage(`Лечение будет готово через ${Math.ceil((healReadyAt.current - now) / 1000)} сек.`); return; }
        healReadyAt.current = now + 5000; setMedkits((count) => count - 1); setHealth((current) => Math.min(10, current + 3)); setMessage('Герой использовал аптечку и восстановил 3 HP.'); return;
      }
      if (players === 2 && event.code === 'KeyH' && !event.repeat) {
        const now = performance.now(); const distance = Math.hypot(hero.current.x - hero2.current.x, hero.current.y - hero2.current.y);
        if (health <= 0) { setMessage('Павший первый игрок не может лечить тиммейта.'); return; }
        if (distance > 80) { setMessage('Подойди ближе к тиммейту, чтобы вылечить его.'); return; }
        if (health2 >= 10) { setMessage('У тиммейта уже полное здоровье.'); return; }
        if (medkits <= 0) { setMessage('У первого игрока закончились аптечки.'); return; }
        if (now < healReadyAt.current) { setMessage(`Лечение будет готово через ${Math.ceil((healReadyAt.current - now) / 1000)} сек.`); return; }
        healReadyAt.current = now + 5000; setMedkits((count) => count - 1); setHealth2((current) => Math.min(10, Math.max(3, current + 3))); setTeammateFallen(false); setMessage(health2 <= 0 ? 'Первый игрок потратил аптечку и поднял тиммейта с 3 HP!' : 'Первый игрок потратил аптечку и восстановил тиммейту 3 HP!'); return;
      }
      if (players === 2 && event.code === 'KeyL' && !event.repeat) {
        const now = performance.now(); const distance = Math.hypot(hero.current.x - hero2.current.x, hero.current.y - hero2.current.y);
        if (health2 <= 0) { setMessage('Павший второй игрок не может лечить тиммейта.'); return; }
        if (distance > 80) { setMessage('Второму игроку нужно подойти ближе для лечения.'); return; }
        if (health >= 10) { setMessage('У первого игрока уже полное здоровье.'); return; }
        if (medkits2 <= 0) { setMessage('У второго игрока закончились аптечки.'); return; }
        if (now < healReadyAt2.current) { setMessage(`Лечение второго игрока будет готово через ${Math.ceil((healReadyAt2.current - now) / 1000)} сек.`); return; }
        healReadyAt2.current = now + 5000; setMedkits2((count) => count - 1); setHealth((current) => Math.min(10, Math.max(3, current + 3))); setTeammateFallen(false); setMessage(health <= 0 ? 'Второй игрок потратил аптечку и поднял первого с 3 HP!' : 'Второй игрок потратил аптечку и восстановил первому 3 HP!'); return;
      }
      if ((event.code === 'KeyQ' || players === 2 && event.code === 'Comma') && !event.repeat) {
        const now = performance.now(); const secondCaster = players === 2 && event.code === 'Comma'; if (secondCaster ? health2 <= 0 : health <= 0) return; const cooldown = secondCaster ? superReadyAt2 : superReadyAt; if (now < cooldown.current) return;
        cooldown.current = now + 8000; if (secondCaster) setSuperReloading2(true); else setSuperReloading(true);
        const caster = secondCaster ? hero2.current : hero.current;
        const casterFacing = secondCaster ? facing2.current : facing.current;
        const owner: 1 | 2 = secondCaster ? 2 : 1;
        const currentWeapon = secondCaster ? weapon2Ref.current : weaponRef.current;
        if (currentWeapon?.type === 'sword') swordUltimates.current.push({ owner, x: caster.x + 13, y: caster.y + 25, started: now, impactAt: now + 360, until: now + 950, color: currentWeapon.color, name: currentWeapon.name, damageApplied: false });
        else if (currentWeapon?.type === 'bow') { const centerDistance = 96; bowUltimates.current.push({ owner, x: caster.x + 13 + casterFacing.x * centerDistance, y: caster.y + 14 + casterFacing.y * centerDistance, started: now, rainStarted: now + 1000, until: now + 5000, nextArrowAt: now + 1000, color: currentWeapon.color, name: currentWeapon.name, arrows: [] }); }
        else if (currentWeapon?.type === 'staff') staffUltimates.current.push({ owner, x: caster.x + 13, y: caster.y + 14, dx: casterFacing.x, dy: casterFacing.y, started: now, until: now + 2700, nextPulseAt: now + 1000, pulseIndex: 0, kills: 0, color: currentWeapon.color, name: currentWeapon.name, pulses: [] });
        else if (currentWeapon?.type === 'gloves') { const titan = currentWeapon.name.includes('титана'); glovesUltimates.current.push({ owner, x: caster.x + 13, y: caster.y + 14, dx: casterFacing.x, dy: casterFacing.y, started: now, until: now + (titan ? 1000 : 1300), nextHitAt: now + (titan ? 520 : 150), hitIndex: 0, damage: currentWeapon.damage, color: currentWeapon.color, name: currentWeapon.name, titanTargetX: caster.x + casterFacing.x * 150, titanTargetY: caster.y + casterFacing.y * 150, landed: false }); }
        else superFists.current.push({ x: caster.x + 14, y: caster.y + 14, vx: casterFacing.x * 9, vy: casterFacing.y * 9, damage: 10, hitTargets: [] });
        window.setTimeout(() => { if (performance.now() >= cooldown.current - 10) { if (secondCaster) setSuperReloading2(false); else setSuperReloading(false); } }, 8000);
      }
      if (event.code === 'Space' && !event.repeat) {
        const now = performance.now(); if (health <= 0 || now < readyAt.current) return;
        const current = weaponRef.current;
        const cooldown = current?.type === 'staff' ? 1200 : current?.type === 'bow' ? 800 : current?.type === 'sword' ? 450 : current?.type === 'gloves' ? 220 : 500;
        readyAt.current = now + cooldown; attackUntil.current = now + 180; setReloading(true); window.setTimeout(() => { if (performance.now() >= readyAt.current - 10) setReloading(false); }, cooldown);
        if (current?.type === 'bow') projectiles.current.push({ x: hero.current.x + 13, y: hero.current.y + 18, vx: facing.current.x * 7, vy: facing.current.y * 7, damage: current.damage, color: current.color });
        if (current?.type === 'staff') {
          const origin = { x: hero.current.x + 13, y: hero.current.y + 18 }; const direction = facing.current;
          waves.current.push({ ...origin, dx: direction.x, dy: direction.y, color: current.color, started: now, until: now + 360 });
          enemies.current.forEach((enemy) => { const ex = enemy.x - origin.x, ey = enemy.y - origin.y; const forward = ex * direction.x + ey * direction.y; const side = Math.abs(ex * -direction.y + ey * direction.x); const hitRadius = enemyHitRadius(enemy); if (forward > -hitRadius && forward < 80 + hitRadius && side < 48 + hitRadius) { enemy.hp -= current.damage; enemy.flash = 12; } });
        }
      }
      if (players === 2 && event.code === 'Semicolon' && !event.repeat) {
        const now = performance.now(); if (now < readyAt2.current || health2 <= 0) return; const current = weapon2Ref.current;
        const cooldown = current?.type === 'staff' ? 1200 : current?.type === 'bow' ? 800 : current?.type === 'sword' ? 450 : current?.type === 'gloves' ? 220 : 500;
        readyAt2.current = now + cooldown; attackUntil2.current = now + 180;
        if (current?.type === 'bow') projectiles.current.push({ x: hero2.current.x + 13, y: hero2.current.y + 18, vx: facing2.current.x * 7, vy: facing2.current.y * 7, damage: current.damage, color: current.color });
        if (current?.type === 'staff') { const origin = { x: hero2.current.x + 13, y: hero2.current.y + 18 }; waves.current.push({ ...origin, dx: facing2.current.x, dy: facing2.current.y, color: current.color, started: now, until: now + 360 }); enemies.current.forEach((enemy) => { const ex = enemy.x - origin.x, ey = enemy.y - origin.y; const forward = ex * facing2.current.x + ey * facing2.current.y; const side = Math.abs(ex * -facing2.current.y + ey * facing2.current.x); if (forward > 0 && forward < 190 && side < 50) { enemy.hp -= current.damage; enemy.flash = 12; } }); }
      }
    };
    const up = (event: KeyboardEvent) => {if(event.isTrusted){const action=(Object.keys(keyBindings) as Array<keyof KeyBindings>).find((id)=>keyBindings[id]===event.code);const mapped=action?CANONICAL_CONTROL_CODES[action]:event.code;if(mapped!==event.code){window.dispatchEvent(new KeyboardEvent('keyup',{code:mapped,bubbles:true}));return;}}keys.current.delete(event.code);};
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [health, health2, inventoryOwner, keyBindings, medkits, medkits2, players]);

  useEffect(() => { weaponRef.current = weapon; }, [weapon]);
  useEffect(() => { if (['dune','king','wizard','gentleman'].includes(equippedSkin)) setSkin(equippedSkin as HeroSkin); }, [equippedSkin]);
  useEffect(() => { weapon2Ref.current = weapon2; }, [weapon2]);
  useEffect(() => { if (saveRequest > handledSaveRequest.current) { handledSaveRequest.current = saveRequest; onSaveSnapshot?.({ level, players, health, health2, coins, medkits, medkits2, inventory, inventory2, inventoryCapacity, inventoryCapacity2, weapon, weapon2, armor, armor2, armorHealth, armorHealth2, map: currentMap.current, hero: { ...hero.current }, hero2: { ...hero2.current }, enemies: enemies.current.map((enemy) => ({ ...enemy })), openedChests: [...openedChests], chestDrops: chestDrops.map((drop) => ({ rarity: { ...drop.rarity }, item: { ...drop.item } })), loot: loot ? { ...loot } : null, droppedItem: droppedItem ? { ...droppedItem } : null, explored: explored.current.map((point) => ({ ...point })), savedAt: Date.now() }); } }, [armor, armor2, armorHealth, armorHealth2, chestDrops, coins, droppedItem, health, health2, inventory, inventory2, inventoryCapacity, inventoryCapacity2, level, loot, medkits, medkits2, onSaveSnapshot, openedChests, players, saveRequest, weapon, weapon2]);
  useEffect(() => { setMusicDanger(health === 1 && !dead); return () => setMusicDanger(false); }, [dead, health]);
  useEffect(() => { if (victory && !victoryReported.current) { victoryReported.current = true; window.setTimeout(() => onVictory?.(level), 150); } }, [level, onVictory, victory]);
  useEffect(() => { if (merchantMode && (level === 6 || level === 12 || level === 18)) { setVictory(false); setMessage(level === 18 ? 'Ледяной торговец прибыл после победы над големом. Подойди и нажми E.' : level === 12 ? 'Пустынный торговец прибыл с новым оружием. Подойди и нажми E.' : 'Странствующий торговец прибыл. Подойди и нажми E. Второй игрок использует Ю.'); } else setShopOpen(false); }, [level, merchantMode]);
  useEffect(() => {
    if (!travelToLevel || travelToLevel === level) return;
    rerollLevel(travelToLevel);
    const map = getLevel(travelToLevel); const start = map.round ? { x: 35, y: 322 } : getRouteStart();
    currentMap.current = map; explored.current = [{ ...start }]; exploredLevel.current = travelToLevel;
    hero.current = start; hero2.current = map.round ? { x: 65, y: 322 } : { ...start, y: start.y + 32 };
    enemies.current = createEnemies(map, enemyMultiplier); keys.current.clear(); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = [];
    setLevel(travelToLevel); setOpenedChests([]); setChestDrops(map.chests.map(() => getRandomLoot(travelToLevel))); setLoot(null); setDroppedItem(null); setChoiceItem(null); setVictory(false); victoryReported.current = false; setDead(false); setMessage(`Новая область: ${map.name}. Найди путь к её хранителю.`);
  }, [travelToLevel]);
  useEffect(() => { ambushAt.current = -1; activatedSnakeRocks.current.clear(); }, [level]);
  useEffect(() => { if (exploredLevel.current !== level) { exploredLevel.current = level; explored.current = [{ ...hero.current }, ...(players === 2 ? [{ ...hero2.current }] : [])]; } }, [level, players]);

  const acceptItem = () => {
    if (!choiceItem) return;
    const secondPicker = itemPicker.current === 2; const targetInventory = secondPicker ? inventory2 : inventory; const targetCapacity = secondPicker ? inventoryCapacity2 : inventoryCapacity;
    if (targetInventory.length >= targetCapacity) { setMessage(`Рюкзак ${secondPicker ? 'второго' : 'первого'} игрока заполнен: ${targetCapacity}/${targetCapacity}.`); return; }
    if (secondPicker) setInventory2((current) => [...current, choiceItem]); else setInventory((current) => [...current, choiceItem]);
    if (choiceItem.type === 'armor') { const durability = choiceItem.durability ?? 5; if (secondPicker) { armorHealthRef2.current = durability; setArmorHealth2(durability); setArmor2(choiceItem); } else { armorHealthRef.current = durability; setArmorHealth(durability); setArmor(choiceItem); } setMessage(`${choiceItem.name} надета игроком ${secondPicker ? 2 : 1}. Прочность: ${durability}.`); }
    else if (itemPicker.current === 2) { setWeapon2(choiceItem); setMessage(`Второй игрок получил «${choiceItem.name}». Урон: ${choiceItem.damage}.`); }
    else { setWeapon(choiceItem); setMessage(`Первый игрок получил «${choiceItem.name}». Урон: ${choiceItem.damage}.`); }
    setLoot(null); setDroppedItem(null); setChoiceItem(null);
  };

  const equipInventoryItem = (item: Weapon) => {
    if (item.type === 'armor') { const durability = item.durability ?? 5; if (inventoryOwner === 2) { armorHealthRef2.current = durability; setArmorHealth2(durability); setArmor2(item); } else { armorHealthRef.current = durability; setArmorHealth(durability); setArmor(item); } setMessage(`${item.name} надета игроком ${inventoryOwner} из рюкзака.`); }
    else if (inventoryOwner === 2) { setWeapon2(item); setMessage(`Второй игрок экипировал ${item.name}.`); }
    else { setWeapon(item); setMessage(`${item.name} экипирован из рюкзака.`); }
    setShowInventory(false);
  };

  const upgradeInventory = () => { const capacity = inventoryOwner === 2 ? inventoryCapacity2 : inventoryCapacity; const nextCapacity = capacity === 10 ? 20 : 30; const cost = capacity === 10 ? 100 : 250; if (capacity >= 30) return; if (coins < cost) { setMessage(`Для улучшения рюкзака нужно ${cost} осколков.`); return; } setCoins((current) => current - cost); if (inventoryOwner === 2) setInventoryCapacity2(nextCapacity); else setInventoryCapacity(nextCapacity); setMessage(`Рюкзак ${inventoryOwner === 2 ? 'второго' : 'первого'} игрока улучшен до ${nextCapacity} мест!`); };

  const rejectItem = () => { if (choiceItem) setMessage(`${choiceItem.name} брошен и остался лежать на земле.`); keys.current.clear(); setChoiceItem(null); };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    ctx.imageSmoothingEnabled = false; let frame = 0; let last = performance.now();
    const loop = (now: number) => {
      const map = currentMap.current; const plantHitboxes = getPlantHitboxes(map); const solidHitboxes = [...map.walls, ...plantHitboxes]; const dt = Math.min((now - last) / 16.67, 2); last = now; const p = hero.current; const baseSpeed = 3 * dt; const speed = now < slowedUntil.current ? baseSpeed / 1.5 : baseSpeed; const speed2 = now < slowedUntil2.current ? baseSpeed / 1.5 : baseSpeed;
      [p, ...(players === 2 ? [hero2.current] : [])].forEach((viewer) => { if (!explored.current.some((point) => Math.hypot(point.x - viewer.x, point.y - viewer.y) < 54)) explored.current.push({ x: viewer.x, y: viewer.y }); });
      if (paused || dead || victory || choiceItem || showInventory || shopOpen || castleGuardDialogueOpen) { drawScene(ctx, map, p, enemies.current, projectiles.current, superFists.current, swordUltimates.current, bowUltimates.current, staffUltimates.current, glovesUltimates.current, waves.current, sandTornadoes.current, tombs.current, now, openedChests, chestDrops, 0, loot, droppedItem, level, weapon, weapon2, armor, facing.current, false, health, superReloading, profileName, players === 2 ? hero2.current : null, facing2.current, false, health2, superReloading2, 0, armor2, skin, skin2, explored.current, mobileControls, networkRole==='guest'?hero2.current:p,castleGuardOutcome!=='fight'&&castleGuardOutcome!=='peace'); frame = requestAnimationFrame(loop); return; }
      if (ambushAt.current > 0 && now >= ambushAt.current) {
        ambushAt.current = -1;
        const spawns: Array<Point & { kind: EnemyKind }> = [];
        for (let index = 0; index < 10; index++) {
          for (let attempt = 0; attempt < 80; attempt++) {
            const angle = Math.random() * Math.PI * 2; const radius = 76 + Math.random() * 54;
            const x = p.x + Math.cos(angle) * radius; const y = p.y + Math.sin(angle) * radius;
            const outsideRoute = level !== 0 && !actorInsideRoute(x, y, 28, 28);
            const hitsWall = map.walls.some((wall) => x + 28 > wall.x && x < wall.x + wall.w && y + 28 > wall.y && y < wall.y + wall.h) || !isInRouteSafeLane(x + 14, y + 14) && plantHitboxes.some((wall) => x + 28 > wall.x && x < wall.x + wall.w && y + 28 > wall.y && y < wall.y + wall.h);
            const hitsCart = map.carts.some((cart) => x + 28 > cart.x - 5 && x < cart.x + 45 && y + 28 > cart.y && y < cart.y + 36);
            if (!outsideRoute && !hitsWall && !hitsCart && spawns.every((spawn) => Math.hypot(spawn.x - x, spawn.y - y) > 16)) { spawns.push({ x, y, kind: index % 3 === 2 ? 'goblin' : 'slime' }); break; }
          }
        }
        while (spawns.length < 10 && spawns.length > 0) { const base = spawns[spawns.length % Math.max(1, spawns.length)]; spawns.push({ ...base, kind: spawns.length % 3 === 2 ? 'goblin' : 'slime' }); }
        enemies.current.push(...createEnemies({ ...map, enemies: spawns }, 1));
        setMessage('ЗАСАДА! Вокруг героя появились 10 дополнительных монстров!');
      }
      let dx = health > 0 && networkRole!=='guest' ? mobileMove.current.x * speed : 0, dy = health > 0 && networkRole!=='guest' ? mobileMove.current.y * speed : 0; if (health > 0 && networkRole!=='guest') { if (keys.current.has('KeyA') || players === 1 && keys.current.has('ArrowLeft')) dx -= speed; if (keys.current.has('KeyD') || players === 1 && keys.current.has('ArrowRight')) dx += speed;
      if (keys.current.has('KeyW') || players === 1 && keys.current.has('ArrowUp')) dy -= speed; if (keys.current.has('KeyS') || players === 1 && keys.current.has('ArrowDown')) dy += speed; }
      if (dx || dy) { const length = Math.hypot(dx, dy); facing.current = { x: dx / length, y: dy / length }; }
      const playerBlocked = (x: number, y: number) => map.round && Math.hypot(x + 12 - 320, y + 14 - 336) > 306 || level !== 0 && !map.round && !actorInsideRoute(x, y, 24, 28) || map.carts.some((cart) => x + 24 > cart.x - 5 && x < cart.x + 45 && y + 28 > cart.y && y < cart.y + 36) || map.walls.some((wall) => x + 24 > wall.x - 6 && x < wall.x + wall.w + 6 && y + 28 > wall.y - 6 && y < wall.y + wall.h + 6) || !isInRouteSafeLane(x + 12, y + 14) && plantHitboxes.some((wall) => x + 24 > wall.x - 6 && x < wall.x + wall.w + 6 && y + 28 > wall.y - 6 && y < wall.y + wall.h + 6) || merchantMode && (level === 6 || level === 12 || level === 18) && x + 24 > MERCHANT.hitbox.x && x < MERCHANT.hitbox.x + MERCHANT.hitbox.w && y + 28 > MERCHANT.hitbox.y && y < MERCHANT.hitbox.y + MERCHANT.hitbox.h;
      const moveSliding = (actor: Point, moveX: number, moveY: number) => { const targetX = Math.max(34, Math.min(map.worldWidth - 60, actor.x + moveX)); const targetY = Math.max(34, Math.min(map.worldHeight - 64, actor.y + moveY)); if (!playerBlocked(targetX, actor.y)) actor.x = targetX; if (!playerBlocked(actor.x, targetY)) actor.y = targetY; };
      const oldX = p.x, oldY = p.y; moveSliding(p, dx, dy); if ((p.x !== oldX || p.y !== oldY) && now >= nextFootstepAt.current) { playFootstep(); nextFootstepAt.current = now + 280; }
      let dx2 = 0, dy2 = 0; const p2 = hero2.current;
      if (players === 2 && health2 > 0 && networkRole!=='host') {
        if(networkRole==='guest'){dx2=mobileMove.current.x*speed2;dy2=mobileMove.current.y*speed2;if(keys.current.has('KeyA')||keys.current.has('ArrowLeft'))dx2-=speed2;if(keys.current.has('KeyD')||keys.current.has('ArrowRight'))dx2+=speed2;if(keys.current.has('KeyW')||keys.current.has('ArrowUp'))dy2-=speed2;if(keys.current.has('KeyS')||keys.current.has('ArrowDown'))dy2+=speed2;}else{if (keys.current.has('ArrowLeft')) dx2 -= speed2; if (keys.current.has('ArrowRight')) dx2 += speed2; if (keys.current.has('ArrowUp')) dy2 -= speed2; if (keys.current.has('ArrowDown')) dy2 += speed2;}
        if (dx2 || dy2) { const length = Math.hypot(dx2, dy2); facing2.current = { x: dx2 / length, y: dy2 / length }; }
        moveSliding(p2, dx2, dy2);
      }
      if(networkRole&&onNetworkPosition&&now>=nextNetworkSendAt.current){nextNetworkSendAt.current=now+50;const local=networkRole==='guest'?p2:p;const localFacing=networkRole==='guest'?facing2.current:facing.current;const localMoving=networkRole==='guest'?Boolean(dx2||dy2):Boolean(dx||dy);onNetworkPosition({x:local.x,y:local.y,fx:localFacing.x,fy:localFacing.y,moving:localMoving});}
      if(networkRole&&onNetworkGameState&&now>=nextNetworkStateAt.current){nextNetworkStateAt.current=now+120;const includeMap=now>=nextNetworkMapAt.current;if(includeMap)nextNetworkMapAt.current=now+2000;onNetworkGameState({sender:networkRole,level,map:includeMap?map:undefined,enemies:enemies.current.map((enemy)=>({...enemy})),openedChests:[...openedChests],chestDrops,loot,droppedItem,sentAt:Date.now()});}
      if (merchantMode && (level === 6 || level === 12 || level === 18)) { const nearMerchant1 = Math.hypot(p.x - MERCHANT.x, p.y - MERCHANT.y) < 85, nearMerchant2 = players === 2 && Math.hypot(p2.x - MERCHANT.x, p2.y - MERCHANT.y) < 85; if (keys.current.has('KeyE') && nearMerchant1 || keys.current.has('Period') && nearMerchant2) { setShopOwner(keys.current.has('Period') && nearMerchant2 ? 2 : 1); keys.current.clear(); setShopOpen(true); } }
      const attacking = now < attackUntil.current;
      if (attacking) enemies.current.forEach((e) => {
        if (weapon?.type !== 'bow' && weapon?.type !== 'staff' && meleeHitsEnemy({ x: p.x + 12, y: p.y + 14 }, facing.current, 58, e) && e.flash <= 0) { e.hp -= weapon?.damage || 1; e.flash = 12; }
      });
      const attacking2 = players === 2 && health2 > 0 && now < attackUntil2.current;
      if (attacking2) enemies.current.forEach((enemy) => { if (weapon2?.type !== 'bow' && weapon2?.type !== 'staff' && meleeHitsEnemy({ x: p2.x + 12, y: p2.y + 14 }, facing2.current, 58, enemy) && enemy.flash <= 0) { enemy.hp -= weapon2?.damage || 1; enemy.flash = 12; } });
      projectiles.current = projectiles.current.filter((arrow) => {
        arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt;
        const hitsWall = solidHitboxes.some((wall) => arrow.x > wall.x && arrow.x < wall.x + wall.w && arrow.y > wall.y && arrow.y < wall.y + wall.h);
        const target = enemies.current.find((e) => pointHitsEnemy(arrow, e, 5));
        if (target) { target.hp -= arrow.damage; target.flash = 12; return false; }
        const insideArena = !map.round || Math.hypot(arrow.x - 320, arrow.y - 336) < 336;
        return !hitsWall && insideArena && arrow.x > 0 && arrow.x < map.worldWidth && arrow.y > 0 && arrow.y < map.worldHeight;
      });
      superFists.current = superFists.current.filter((fist) => {
        fist.x += fist.vx * dt; fist.y += fist.vy * dt;
        const targets = enemies.current.filter((e) => !fist.hitTargets.includes(e) && !(e.kind === 'boss' && e.leapStarted > 0 && now < e.leapUntil) && pointHitsEnemy(fist, e, 28));
        targets.forEach((target) => { target.hp -= fist.damage; target.flash = 12; fist.hitTargets.push(target); });
        if (targets.length) setMessage(`Суперкулак нанёс по 10 урона ${targets.length === 1 ? 'врагу' : 'врагам'}!`);
        const cameraX = Math.max(0, Math.min(map.worldWidth - WIDTH, p.x - WIDTH / 2)); const cameraY = Math.max(0, Math.min(map.worldHeight - HEIGHT, p.y - HEIGHT / 2));
        return fist.x > cameraX - 64 && fist.x < cameraX + WIDTH + 64 && fist.y > cameraY - 64 && fist.y < cameraY + HEIGHT + 64;
      });
      swordUltimates.current = swordUltimates.current.filter((ultimate) => {
        if (!ultimate.damageApplied && now >= ultimate.impactAt) { ultimate.damageApplied = true; const targets = enemies.current.filter((enemy) => pointHitsEnemy(ultimate, enemy, 64)); targets.forEach((enemy) => { enemy.hp -= ultimate.name.includes('Теневой') ? 8 : 5; enemy.flash = 12; if (ultimate.name.includes('Стальной')) { const distance = Math.max(1, Math.hypot(enemy.x - ultimate.x, enemy.y - ultimate.y)); enemy.x += (enemy.x - ultimate.x) / distance * 35; enemy.y += (enemy.y - ultimate.y) / distance * 35; } if (ultimate.name.includes('вождя')) enemy.stunnedUntil = now + 900; }); setMessage(targets.length ? `Ульта меча поразила ${targets.length === 1 ? 'врага' : 'врагов'}!` : 'Камни вырвались из земли!'); }
        return now < ultimate.until;
      });
      bowUltimates.current = bowUltimates.current.filter((ultimate) => {
        while (now >= ultimate.nextArrowAt && ultimate.nextArrowAt < ultimate.until) { for (let i = 0; i < 5; i++) ultimate.arrows.push({ x: ultimate.x - 60 + Math.random() * 120, y: ultimate.y - 60 + Math.random() * 120, started: ultimate.nextArrowAt, impactAt: ultimate.nextArrowAt + 300, damaged: false }); ultimate.nextArrowAt += 200; }
        ultimate.arrows.forEach((arrow) => { if (!arrow.damaged && now >= arrow.impactAt) { arrow.damaged = true; enemies.current.filter((enemy) => pointHitsEnemy(arrow, enemy, ultimate.name.includes('Солнечный') ? 27 : 16)).forEach((enemy) => { enemy.hp -= ultimate.name.includes('Пламенный') || ultimate.name.includes('Небесный') ? 2 : 1.5; enemy.flash = 12; if (ultimate.name.includes('Ледяной')) enemy.stunnedUntil = now + 650; if (ultimate.name.includes('Охотничий')) enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + 250); }); } });
        ultimate.arrows = ultimate.arrows.filter((arrow) => now < arrow.impactAt + 300); return now < ultimate.until + 300;
      });
      staffUltimates.current = staffUltimates.current.filter((ultimate) => {
        while (now >= ultimate.nextPulseAt && ultimate.pulseIndex < 3) {
          const baseDamage = ultimate.pulseIndex === 0 ? 3 : ultimate.pulseIndex === 1 ? 5 : ultimate.kills; const damage = ultimate.name.includes('пламени') ? baseDamage + 1 : ultimate.name.includes('звёзд') && ultimate.pulseIndex === 2 ? baseDamage + 3 : baseDamage; ultimate.pulses.push({ started: ultimate.nextPulseAt, damage });
          enemies.current.forEach((enemy) => { const ex = enemy.x - ultimate.x, ey = enemy.y - ultimate.y; const forward = ex * ultimate.dx + ey * ultimate.dy; const side = Math.abs(ex * -ultimate.dy + ey * ultimate.dx); const hitRadius = enemyHitRadius(enemy); if (forward > -hitRadius && forward < 180 + hitRadius && side < 55 + hitRadius && !(enemy.kind === 'boss' && enemy.leapStarted > 0)) { const wasAlive = enemy.hp > 0; enemy.hp -= damage; enemy.flash = 12; enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + (ultimate.name.includes('Грозовой') ? 1500 : 1100)); if (ultimate.pulseIndex < 2 && wasAlive && enemy.hp <= 0) ultimate.kills++; } });
          ultimate.pulseIndex++; ultimate.nextPulseAt += 600; setMessage(ultimate.pulseIndex === 3 ? `Третья волна нанесла ${damage} урона — столько врагов убили первые две!` : `Волна посоха ${ultimate.pulseIndex}: ${damage} урона и оглушение!`);
        }
        ultimate.pulses = ultimate.pulses.filter((pulse) => now < pulse.started + 520); return now < ultimate.until;
      });
      glovesUltimates.current = glovesUltimates.current.filter((ultimate) => {
        const titan = ultimate.name.includes('титана');
        if (titan && !ultimate.landed && now >= ultimate.nextHitAt) { ultimate.landed = true; const tx = Math.max(34, Math.min(map.worldWidth - 60, ultimate.titanTargetX)); const ty = Math.max(34, Math.min(map.worldHeight - 64, ultimate.titanTargetY)); const ownerHero = ultimate.owner === 2 ? p2 : p; ownerHero.x = tx; ownerHero.y = ty; ultimate.titanTargetX = tx; ultimate.titanTargetY = ty; enemies.current.filter((enemy) => pointHitsEnemy({ x: tx, y: ty }, enemy, 16)).forEach((enemy) => { enemy.hp -= 15; enemy.flash = 12; }); setMessage('Перчатки титана: прыжок через стену и удар на 15 HP!'); }
        if (!titan) while (now >= ultimate.nextHitAt && ultimate.hitIndex < 10) { const finalHit = ultimate.hitIndex === 9; enemies.current.forEach((enemy) => { const ex = enemy.x - ultimate.x, ey = enemy.y - ultimate.y; const forward = ex * ultimate.dx + ey * ultimate.dy; const side = Math.abs(ex * -ultimate.dy + ey * ultimate.dx); const hitRadius = enemyHitRadius(enemy); if (forward > -hitRadius && forward < 105 + hitRadius && side < 55 + hitRadius) { const fireBonus = ultimate.name.includes('Огненные') ? .5 : 0; enemy.hp -= (finalHit ? ultimate.damage * 2 : ultimate.damage) + fireBonus; enemy.flash = 12; if (ultimate.name.includes('Грозовые') && ultimate.hitIndex % 3 === 2) enemy.stunnedUntil = now + 700; if (finalHit) { enemy.x += ultimate.dx * 28; enemy.y += ultimate.dy * 28; } } }); if (ultimate.name.includes('Теневые')) { const ownerHero = ultimate.owner === 2 ? p2 : p; ownerHero.x = Math.max(34, Math.min(map.worldWidth - 60, ownerHero.x + ultimate.dx * 5)); ownerHero.y = Math.max(34, Math.min(map.worldHeight - 64, ownerHero.y + ultimate.dy * 5)); } ultimate.hitIndex++; ultimate.nextHitAt += 100; }
        return now < ultimate.until;
      });
      waves.current = waves.current.filter((wave) => now < wave.until);
      const showTeammateFallen = () => { setTeammateFallen(true); window.setTimeout(() => setTeammateFallen(false), 3200); };
      const damageHero = (amount: number, hitMessage?: string, second = false) => {
        playHurt();
        const wornArmor = second ? armor2 : armor; const wornArmorHealth = second ? armorHealthRef2 : armorHealthRef;
        if (wornArmor && wornArmorHealth.current > 0) {
          const nextArmor = Math.max(0, wornArmorHealth.current - amount); wornArmorHealth.current = nextArmor;
          const updateArmorDurability = (items: Weapon[]) => items.map((item) => item.type === 'armor' && item.name === wornArmor.name ? { ...item, durability: nextArmor } : item);
          if (second) { setArmorHealth2(nextArmor); setInventory2(updateArmorDurability); setArmor2((current) => nextArmor > 0 && current ? { ...current, durability: nextArmor } : null); }
          else { setArmorHealth(nextArmor); setInventory(updateArmorDurability); setArmor((current) => nextArmor > 0 && current ? { ...current, durability: nextArmor } : null); }
          if (nextArmor === 0) setMessage(`Броня игрока ${second ? 2 : 1} приняла удар и сломалась!`); else if (hitMessage) setMessage(`${hitMessage} Броня игрока ${second ? 2 : 1} получила ${amount} урона.`);
        } else if (second) setHealth2((current) => { const next = Math.max(0, current - amount); if (current > 0 && next === 0) { if (health <= 0) { setDead(true); keys.current.clear(); } else showTeammateFallen(); } if (hitMessage) setMessage(`${hitMessage} Второй игрок получил ${amount} урона.`); return next; });
        else setHealth((current) => { const next = Math.max(0, current - amount); if (current > 0 && next === 0) { if (players === 1 || health2 <= 0) { setDead(true); keys.current.clear(); setMessage('Тьма поглотила героя…'); } else showTeammateFallen(); } else if (hitMessage) setMessage(`${hitMessage} Получено ${amount} урона.`); return next; });
      };
      if(level===25||level===26)map.decorations.forEach((rock,index)=>{if(rock.kind!=='rock'||rock.variant<2||activatedSnakeRocks.current.has(index))return;const d1=health>0?Math.hypot(p.x+12-rock.x,p.y+14-rock.y):Infinity,d2=players===2&&health2>0?Math.hypot(p2.x+12-rock.x,p2.y+14-rock.y):Infinity;if(Math.min(d1,d2)>48)return;activatedSnakeRocks.current.add(index);const target=d2<d1?p2:p,count=1+(index+rock.variant)%3;for(let snake=0;snake<count;snake++){const sx=rock.x+(snake-1)*7,sy=rock.y-5+snake*4,spread=(snake-(count-1)/2)*.16,base=Math.atan2(target.y+14-sy,target.x+12-sx)+spread;sandTornadoes.current.push({x:sx,y:sy,vx:Math.cos(base)*5.2,vy:Math.sin(base)*5.2,damage:0,until:now+2600,style:'snake'});}setMessage(`Из-за камня вылетело змей: ${count}!`);});
      enemies.current.forEach((e) => {
        if (e.hiddenInRock) {
          const distanceFirst = health > 0 ? Math.hypot(p.x + 12 - e.x, p.y + 14 - e.y) : Infinity;
          const distanceSecond = players === 2 && health2 > 0 ? Math.hypot(p2.x + 12 - e.x, p2.y + 14 - e.y) : Infinity;
          if (Math.min(distanceFirst, distanceSecond) > 48) return;
          const target = distanceSecond < distanceFirst ? p2 : p;
          e.hiddenInRock = false; e.leapStarted = now; e.leapUntil = now + 480; e.thrownStartX = e.x; e.thrownStartY = e.y; e.leapTargetX = target.x; e.leapTargetY = target.y; e.attackUntil = now + 480;
          setMessage('Из камня вылетела змея!');
        }
        if(e.kind==='frog'&&(e.thrownUntil??0)>0){const started=e.thrownStarted??now,until=e.thrownUntil??now,progress=Math.max(0,Math.min(1,(now-started)/Math.max(1,until-started))),sx=e.thrownStartX??e.x,sy=e.thrownStartY??e.y,tx=e.thrownTargetX??e.x,ty=e.thrownTargetY??e.y;e.x=sx+(tx-sx)*progress;e.y=sy+(ty-sy)*progress-Math.sin(progress*Math.PI)*105;if(now<until)return;e.x=tx;e.y=ty;e.thrownUntil=0;e.thrownStarted=undefined;e.attackUntil=now+300;const hitFirst=health>0&&Math.hypot(p.x-e.x,p.y-e.y)<32,hitSecond=players===2&&health2>0&&Math.hypot(p2.x-e.x,p2.y-e.y)<32;if(hitFirst||hitSecond)damageHero(1,'Маленькая жаба приземлилась на героя и нанесла 1 HP!',!hitFirst&&hitSecond);else setMessage('Маленькая жаба приземлилась мимо и теперь преследует героя!');}
        if (e.kind === 'mudPile') { const nearFirst=health>0&&Math.hypot(p.x-e.x,p.y-e.y)<=96,nearSecond=players===2&&health2>0&&Math.hypot(p2.x-e.x,p2.y-e.y)<=96;if(!nearFirst&&!nearSecond)return;e.kind='mudMonster';e.hp=1;e.maxHp=1;e.power=5;e.speed=Math.max(1.05,map.enemy.speed);e.flash=10;e.stunnedUntil=now+380;setMessage('Грязевая куча ожила — из болота поднялся монстр!'); }
        if (e.kind === 'mudMonster') {
          const blockedAt = (x: number, y: number) => { const outside = map.round ? Math.hypot(x + 14 - 320, y + 14 - 336) > 306 : level !== 0 && !actorInsideRoute(x, y, 26, 28); const wall = map.walls.some((hitbox) => x + 26 > hitbox.x && x < hitbox.x + hitbox.w && y + 28 > hitbox.y && y < hitbox.y + hitbox.h); const water = !isInRouteSafeLane(x + 13, y + 14) && plantHitboxes.some((hitbox) => x + 26 > hitbox.x && x < hitbox.x + hitbox.w && y + 28 > hitbox.y && y < hitbox.y + hitbox.h); const cart = map.carts.some((item) => x + 26 > item.x - 5 && x < item.x + 45 && y + 28 > item.y && y < item.y + 36); const enemy = enemies.current.some((other) => other !== e && other.hp > 0 && Math.hypot(other.x - x, other.y - y) < enemyHitRadius(other) + 14); return outside || wall || water || cart || enemy; };
          if (blockedAt(e.x, e.y)) { let escaped: Point | null = null; for (let radius=8;radius<=128&&!escaped;radius+=8) for (let index=0;index<16;index++){const angle=index/16*Math.PI*2,candidate={x:e.x+Math.cos(angle)*radius,y:e.y+Math.sin(angle)*radius};if(!blockedAt(candidate.x,candidate.y)){escaped=candidate;break;}} if(escaped){e.x=escaped.x;e.y=escaped.y;} }
        }
        const sees = (target: Point) => { const from = { x: e.x + 14, y: e.y + 14 }, to = { x: target.x + 12, y: target.y + 14 }; return !solidHitboxes.some((wall) => segmentHitsRect(from, to, wall)) && !map.carts.some((cart) => segmentHitsRect(from, to, { x: cart.x - 5, y: cart.y, w: 50, h: 36 })); };
        e.flash--; const huntsThroughObstacles=e.kind==='mudMonster'; const distance1 = health > 0 && (huntsThroughObstacles || sees(p)) ? Math.hypot(p.x - e.x, p.y - e.y) : Infinity; const distance2 = players === 2 && health2 > 0 && (huntsThroughObstacles || sees(p2)) ? Math.hypot(p2.x - e.x, p2.y - e.y) : Infinity; const targetsSecond = distance2 < distance1; const targetHero = targetsSecond ? p2 : p; const ex = targetHero.x - e.x, ey = targetHero.y - e.y, distance = Math.min(distance1, distance2);
        if (e.kind === 'boss' && level !== 24 && now >= (e.nextContactAt ?? 0)) { const firstTouches = health > 0 && bossBodyHits({ x: p.x + 12, y: p.y + 14 }, e, 12); const secondTouches = players === 2 && health2 > 0 && bossBodyHits({ x: p2.x + 12, y: p2.y + 14 }, e, 12); if (firstTouches || secondTouches) { damageHero(.5, 'Касание туловища босса обжигает героя!', !firstTouches && secondTouches); e.nextContactAt = now + 700; } }
        if (e.stunnedUntil > now) return;
        if (e.kind === 'monkey' && e.leapStarted > 0) {
          const progress = Math.max(0, Math.min(1, (now - e.leapStarted) / Math.max(1, e.leapUntil - e.leapStarted)));
          const startX = e.thrownStartX ?? e.x, startY = e.thrownStartY ?? e.y;
          e.x = startX + (e.leapTargetX - startX) * progress;
          e.y = startY + (e.leapTargetY - startY) * progress - Math.sin(progress * Math.PI) * 58;
          e.attackUntil = now + 100;
          if (now < e.leapUntil) return;
          e.x = e.leapTargetX; e.y = e.leapTargetY; e.leapStarted = 0; e.leapUntil = 0; e.thrownStartX = undefined; e.thrownStartY = undefined; e.nextLeapAt = now + 2600;
          return;
        }
        if (e.kind === 'snake' && e.leapStarted > 0) {
          const progress = Math.max(0, Math.min(1, (now - e.leapStarted) / Math.max(1, e.leapUntil - e.leapStarted)));
          const startX = e.thrownStartX ?? e.x, startY = e.thrownStartY ?? e.y;
          e.x = startX + (e.leapTargetX - startX) * progress;
          e.y = startY + (e.leapTargetY - startY) * progress - Math.sin(progress * Math.PI) * 25;
          e.attackUntil = now + 90;
          if (now < e.leapUntil) return;
          e.x = e.leapTargetX; e.y = e.leapTargetY; e.leapStarted = 0; e.leapUntil = 0; e.thrownStartX = undefined; e.thrownStartY = undefined; e.nextLeapAt = now + 1800;
          const hitsFirst = health > 0 && Math.hypot(p.x - e.x, p.y - e.y) <= 25;
          const hitsSecond = players === 2 && health2 > 0 && Math.hypot(p2.x - e.x, p2.y - e.y) <= 25;
          if (hitsFirst || hitsSecond) damageHero(e.power, 'Змея прыгнула и укусила героя!', !hitsFirst && hitsSecond);
          return;
        }
        if (e.kind === 'iceGolem' && distance <= 128 && now >= (e.nextShotAt ?? 0)) { const length = Math.max(1, distance); sandTornadoes.current.push({ x: e.x, y: e.y, vx: ex / length * 4.2, vy: ey / length * 4.2, damage: e.power, until: now + 3200, style: 'ice' }); e.nextShotAt = now + 1400; e.attackUntil = now + 320; }
        if (e.kind === 'nativeSpear' && distance <= 96) {
          if (now >= (e.nextShotAt ?? 0)) { const length = Math.max(1, distance); sandTornadoes.current.push({ x: e.x + 20, y: e.y + 12, vx: ex / length * 5.2, vy: ey / length * 5.2, damage: 3, until: now + 1300, style: 'spear' }); e.nextShotAt = now + 1550; e.attackUntil = now + 420; }
          return;
        }
        if (e.kind === 'frog' && distance <= 96) {
          if (now >= (e.nextShotAt ?? 0)) { const length = Math.max(1, distance); sandTornadoes.current.push({ x: e.x + 14, y: e.y + 14, vx: 0, vy: 0, damage: e.power, startedAt: now, until: now + 1250, style: 'frogTongue', source: e, tongueDx: ex / length, tongueDy: ey / length, tongueLength: Math.min(96, length + 12) }); e.nextShotAt = now + 2050; e.attackUntil = now + 1250; }
          return;
        }
        if (level === 12 && e.kind === 'boss') {
          const haste = e.revived ? 1.5 : 1;
          if (distance < 272) e.playerWasInSummonRadius = true;
          if (now >= (e.nextShotAt ?? 0)) { const length = Math.max(1, distance); sandTornadoes.current.push({ x: e.x, y: e.y, vx: ex / length * 3.4 * haste, vy: ey / length * 3.4 * haste, damage: e.power, until: now + 5000 }); e.nextShotAt = now + 2000 / haste; e.attackUntil = now + 520; }
          if (distance >= 272 && e.playerWasInSummonRadius && now >= (e.nextSummonAt ?? 0)) {
            e.playerWasInSummonRadius = false;
            e.attackUntil = now + 850; e.nextSummonAt = now + 7000 / haste;
            const graves = [{ x: e.x - 75, y: e.y }, { x: e.x + 75, y: e.y }, { x: e.x, y: e.y - 75 }, { x: e.x, y: e.y + 75 }].map((point) => ({ x: Math.max(45, Math.min(map.worldWidth - 45, point.x)), y: Math.max(55, Math.min(map.worldHeight - 55, point.y)), spawnedAt: now, sinksAt: now + 1250 }));
            tombs.current.push(...graves); const summons = graves.map((grave) => ({ x: grave.x, y: grave.y, kind: 'mummy' as const })); const summonedMummies = createEnemies({ ...map, enemies: summons }, 1).map((mummy) => ({ ...mummy, hp: mummy.hp / 2, maxHp: mummy.maxHp / 2 })); enemies.current.push(...summonedMummies); setMessage('Владыка гробниц поднял обе руки — из четырёх саркофагов восстали ослабленные мумии!');
          }
          return;
        }
        if (level === 18 && e.kind === 'boss') {
          const length = Math.max(1, distance);
          if (now >= (e.nextShotAt ?? 0)) {
            sandTornadoes.current.push({ x: e.x, y: e.y, vx: ex / length * 4.8, vy: ey / length * 4.8, damage: 2, until: now + 3600, style: 'ice' });
            e.nextShotAt = now + 1450; e.attackUntil = now + 420;
          }
          if (distance > 128 && now >= (e.nextSummonAt ?? 0)) {
            e.attackUntil = now + 800; e.nextSummonAt = now + 5200;
            for (let index = 0; index < 10; index++) { const angle = index / 10 * Math.PI * 2; sandTornadoes.current.push({ x: targetHero.x + 12 + Math.cos(angle) * 32, y: targetHero.y + 14 + Math.sin(angle) * 32, vx: 0, vy: 0, damage: 2, impactAt: now + 750, until: now + 1450, style: 'iceRing' }); }
            setMessage('Ледяной голем ударил по земле — вокруг героя поднимается кольцо сосулек!');
          }
          if (e.hp <= e.maxHp / 2 && now >= e.nextLeapAt) {
            e.nextLeapAt = now + 4200; e.attackUntil = now + 950;
            for (let index = 0; index < 5; index++) { const angle = index * 2.4; const radius = index === 0 ? 0 : 28 + (index % 2) * 24; sandTornadoes.current.push({ x: targetHero.x + 12 + Math.cos(angle) * radius, y: targetHero.y + 14 + Math.sin(angle) * radius, vx: 0, vy: 0, damage: 2, impactAt: now + 1050 + index * 130, until: now + 1900 + index * 130, style: 'iceLarge', split: true }); }
            setMessage('Голем топает! С неба падают большие сосульки — после удара они расколются!');
          }
          return;
        }
        if (level === 24 && e.kind === 'boss') {
          if ((e.swallowUntil??0)>now && e.swallowedPlayer) { const victim=e.swallowedPlayer===2?p2:p;victim.x=e.x-1;victim.y=e.y-42;e.attackUntil=now+120;return; }
          if (e.swallowedPlayer && !e.swallowDamageDone) { const second=e.swallowedPlayer===2,victim=second?p2:p,length=Math.max(1,Math.hypot(victim.x-e.x,victim.y-e.y));damageHero(3,'Король жаб прожевал героя 3 секунды и выплюнул его!',second);victim.x=Math.max(34,Math.min(map.worldWidth-60,e.x+(victim.x-e.x)/length*115));victim.y=Math.max(34,Math.min(map.worldHeight-64,e.y+(victim.y-e.y)/length*115));e.swallowDamageDone=true;e.swallowedPlayer=undefined;e.swallowUntil=0;e.nextShotAt=now+1800; }
          if (e.leapStarted>0) { if(now<e.leapUntil)return;e.x=e.leapTargetX;e.y=e.leapTargetY;e.leapStarted=0;e.leapUntil=0;e.nextLeapAt=now+3100;const hitSecond=players===2&&health2>0&&Math.hypot(p2.x+12-e.x,p2.y+14-e.y)<=82;if(health>0&&Math.hypot(p.x+12-e.x,p.y+14-e.y)<=82||hitSecond)damageHero(2,'Король жаб обрушился сверху и нанёс 2 HP!',!((health>0&&Math.hypot(p.x+12-e.x,p.y+14-e.y)<=82))&&hitSecond);return; }
          if(distance>384){if(e.hp<=e.maxHp/2&&now>=(e.nextSummonAt??0)){e.nextSummonAt=now+3100;e.attackUntil=now+700;const startX=e.x,startY=e.y-65,targetX=targetHero.x,targetY=targetHero.y;const minion=createEnemies({...map,enemies:[{x:startX,y:startY,kind:'frog'}]},1)[0];minion.hp=1;minion.maxHp=1;minion.power=1;minion.leapUntil=0;minion.nextLeapAt=now+2650;minion.thrownStarted=now;minion.thrownUntil=now+2000;minion.thrownStartX=startX;minion.thrownStartY=startY;minion.thrownTargetX=targetX;minion.thrownTargetY=targetY;enemies.current.push(minion);setMessage('Король жаб раскрыл пасть и выплюнул маленькую жабу — она летит 2 секунды!');}if(now>=e.nextLeapAt){e.leapStarted=now;e.leapUntil=now+1250;e.leapTargetX=targetHero.x;e.leapTargetY=targetHero.y;e.attackUntil=now+500;}return;}
          if(now>=(e.nextShotAt??0)){const tongueX=targetHero.x+12-e.x,tongueY=targetHero.y+14-(e.y-55),length=Math.max(1,Math.hypot(tongueX,tongueY));sandTornadoes.current.push({x:e.x,y:e.y-55,vx:0,vy:0,damage:3,startedAt:now,until:now+1250,style:'frogTongue',source:e,tongueDx:tongueX/length,tongueDy:tongueY/length,tongueLength:Math.min(384,length+18)});e.nextShotAt=now+2300;e.attackUntil=now+1250;e.swallowDamageDone=false;}return;
        }
        if (e.kind === 'boss' && e.leapStarted > 0) {
          if (now < e.leapUntil) return;
          e.x = e.leapTargetX; e.y = e.leapTargetY; e.leapStarted = 0; e.leapUntil = 0; e.nextLeapAt = now + 4500; e.attackUntil = now + 220;
          const hitSecond = players === 2 && Math.hypot(p2.x + 12 - e.x, p2.y + 14 - e.y) <= 80; if (Math.hypot(p.x + 12 - e.x, p.y + 14 - e.y) <= 80 || hitSecond) damageHero(e.power, 'Босс обрушился с неба и попал по герою!', hitSecond);
          else setMessage('Ты успел покинуть зону падения босса!');
          return;
        }
        if (!Number.isFinite(distance)) return;
        if (e.kind === 'monkey' && distance > 40 && distance <= 112 && now >= e.nextLeapAt) {
          e.leapStarted = now; e.leapUntil = now + 620; e.leapTargetX = targetHero.x; e.leapTargetY = targetHero.y; e.thrownStartX = e.x; e.thrownStartY = e.y; e.attackUntil = now + 620;
          return;
        }
        if (e.kind === 'snake' && distance > 28 && distance <= 80 && now >= e.nextLeapAt) {
          e.leapStarted = now; e.leapUntil = now + 390; e.leapTargetX = targetHero.x; e.leapTargetY = targetHero.y; e.thrownStartX = e.x; e.thrownStartY = e.y; e.attackUntil = now + 390;
          return;
        }
        if (e.kind === 'boss' && e.hp < e.maxHp / 2 && distance >= 192 && now >= e.nextLeapAt) {
          e.leapStarted = now; e.leapUntil = now + 1450; e.leapTargetX = targetHero.x; e.leapTargetY = targetHero.y; e.attackUntil = now + 380; setMessage('Босс прыгнул! Уходи из красного круга!'); return;
        }
        const contactDistance = e.kind === 'boss' ? 65 : e.kind === 'nativeSpear' ? 82 : e.kind === 'nativeClub' ? 18 : 14;
        if (distance > contactDistance) {
          if (e.kind === 'frog' && now >= e.nextLeapAt) { e.leapStarted = now; e.leapUntil = now + 360; e.nextLeapAt = now + 690; }
          const enemySpeed = e.speed * dt * (e.kind === 'frog' ? (now < e.leapUntil ? 2.35 : 0) : 1); const dx = ex / distance; const dy = ey / distance;
          const wallGap = 6;
          const canMoveTo = (x: number, y: number) => {
            const outsideArena = map.round && Math.hypot(x + 14 - 320, y + 14 - 336) > 306;
            const outsideRoute = level !== 0 && !map.round && !actorInsideRoute(x, y, 26, 28);
            const hitsWall = map.walls.some((w) => x + 26 > w.x - wallGap && x < w.x + w.w + wallGap && y + 28 > w.y - wallGap && y < w.y + w.h + wallGap) || !isInRouteSafeLane(x + 13, y + 14) && plantHitboxes.some((w) => x + 26 > w.x - wallGap && x < w.x + w.w + wallGap && y + 28 > w.y - wallGap && y < w.y + w.h + wallGap);
            const hitsCart = map.carts.some((cart) => x + 26 > cart.x - 5 - wallGap && x < cart.x + 45 + wallGap && y + 28 > cart.y - wallGap && y < cart.y + 36 + wallGap);
            const hitsEnemy = e.kind === 'mudMonster' && enemies.current.some((other) => other !== e && other.hp > 0 && Math.hypot(other.x - x, other.y - y) < enemyHitRadius(other) + 15);
            return !outsideArena && !outsideRoute && !hitsWall && !hitsCart && !hitsEnemy;
          };
          const directions = [{ x: dx, y: dy }, { x: -dy, y: dx }, { x: dy, y: -dx }, { x: dx * .7 - dy * .7, y: dy * .7 + dx * .7 }, { x: dx * .7 + dy * .7, y: dy * .7 - dx * .7 }];
          const next = directions.map((direction) => ({ x: e.x + direction.x * enemySpeed, y: e.y + direction.y * enemySpeed })).filter((point) => canMoveTo(point.x, point.y)).sort((a, b) => Math.hypot(targetHero.x - a.x, targetHero.y - a.y) - Math.hypot(targetHero.x - b.x, targetHero.y - b.y))[0];
          if (next) { e.x = next.x; e.y = next.y; }
        }
        const attackInterval = e.kind === 'boss' ? 1600 : 700;
        if (e.kind !== 'iceGolem' && e.kind !== 'frog' && e.kind !== 'nativeSpear' && distance < (e.kind === 'boss' ? 94 : e.kind === 'nativeClub' ? 22 : 16) && Math.floor(now / attackInterval) !== Math.floor((now - 17) / attackInterval)) {
          e.attackUntil = now + 220;
          damageHero(e.power, undefined, targetsSecond);
          if (e.kind === 'scorpion' && Math.random() < .07) {
            const poisonEnd = now + 4000;
            if (targetsSecond) { poisonedUntil2.current = poisonEnd; nextPoisonTick2.current = now + 1000; }
            else { poisonedUntil.current = poisonEnd; nextPoisonTick.current = now + 1000; }
            setMessage(`Скорпион отравил игрока ${targetsSecond ? 2 : 1}! Яд действует 4 секунды.`);
          }
        }
      });
      const newIceShards: SandTornado[] = [];
      sandTornadoes.current = sandTornadoes.current.filter((tornado) => {
        tornado.x += tornado.vx * dt; tornado.y += tornado.vy * dt;
        if(tornado.style==='blood')return now<tornado.until;
        if (tornado.style === 'frogTongue') { const started=tornado.startedAt??now,total=Math.max(1,tornado.until-started),progress=Math.max(0,Math.min(1,(now-started)/total));const reach=progress<.45?progress/.45:progress<.65?1:(1-progress)/.35;const source=tornado.source;if(source){tornado.x=source.x+(source.kind==='boss'?0:14)+(tornado.tongueDx??1)*(tornado.tongueLength??96)*Math.max(0,reach);tornado.y=source.y+(source.kind==='boss'?-55:14)+(tornado.tongueDy??0)*(tornado.tongueLength??96)*Math.max(0,reach);}}
        const waitingToFall = Boolean(tornado.impactAt && now < tornado.impactAt);
        if (!waitingToFall && tornado.style === 'iceLarge' && tornado.split) {
          tornado.split = false;
          for (let index = 0; index < 5; index++) { const angle = index / 5 * Math.PI * 2; newIceShards.push({ x: tornado.x, y: tornado.y, vx: Math.cos(angle) * 4.4, vy: Math.sin(angle) * 4.4, damage: 1, until: now + 1200, style: 'iceShard' }); }
        }
        const radius = tornado.style === 'iceLarge' ? 25 : tornado.style === 'iceSpiritDrop' ? 16 : tornado.style === 'iceRing' ? 12 : tornado.style === 'iceShard' ? 13 : tornado.style === 'frogTongue' ? 8 : 22;
        const hitFirst = !waitingToFall && health > 0 && !tornado.hitPlayer1 && Math.hypot(p.x + 12 - tornado.x, p.y + 14 - tornado.y) < radius;
        const hitSecond = !waitingToFall && players === 2 && health2 > 0 && !tornado.hitPlayer2 && Math.hypot(p2.x + 12 - tornado.x, p2.y + 14 - tornado.y) < radius;
        if (hitFirst || hitSecond) {
          if(tornado.style==='snake'){const second=!hitFirst&&hitSecond;if(Math.random()<.45){const poisonEnd=now+3000;if(second){poisonedUntil2.current=poisonEnd;nextPoisonTick2.current=now+500;}else{poisonedUntil.current=poisonEnd;nextPoisonTick.current=now+500;}setMessage(`Змея укусила игрока ${second?2:1}! Герой истекает кровью 3 секунды.`);}else setMessage(`Змея укусила игрока ${second?2:1}, но кровотечения удалось избежать.`);return false;}
          const iceShot = tornado.style?.startsWith('ice');
          if(tornado.style==='frogTongue'&&level===24&&tornado.source?.kind==='boss'){tornado.source.swallowedPlayer=hitFirst?1:2;tornado.source.swallowUntil=now+3000;tornado.source.swallowDamageDone=false;setMessage('Король жаб притянул героя языком и проглотил его на 3 секунды!');return false;}
          if (tornado.style === 'ice') { if (hitFirst) slowedUntil.current = now + 3000; else slowedUntil2.current = now + 3000; }
          damageHero(tornado.damage, tornado.style === 'frogTongue' ? `Язык жабы нанёс ${tornado.damage} HP урона!` : iceShot ? `Сосулька нанесла ${tornado.damage} HP урона!` : 'Песчаный торнадо настиг героя!', !hitFirst && hitSecond);
          const mummyBoss = !iceShot ? enemies.current.find((enemy) => level === 12 && enemy.kind === 'boss' && enemy.hp > 0) : undefined;
          if (mummyBoss) { const healed = Math.min(5, mummyBoss.maxHp - mummyBoss.hp); mummyBoss.hp += healed; if (healed > 0) setMessage(`Торнадо высосал силу героя — Владыка гробниц восстановил ${healed} HP!`); }
          if (tornado.style === 'frogTongue') { if (hitFirst) tornado.hitPlayer1 = true; if (hitSecond) tornado.hitPlayer2 = true; return now < tornado.until; }
          return false;
        }
        return now < tornado.until && tornado.x > 0 && tornado.x < map.worldWidth && tornado.y > 0 && tornado.y < map.worldHeight;
      });
      sandTornadoes.current.push(...newIceShards);
      tombs.current = tombs.current.filter((tomb) => now < tomb.sinksAt + 550);
      if (health > 0 && now < poisonedUntil.current && now >= nextPoisonTick.current) { nextPoisonTick.current += 1000; damageHero(.5, 'Яд заставляет героя истекать кровью!');for(let i=0;i<5;i++)sandTornadoes.current.push({x:p.x+7+i*3,y:p.y+15,vx:(i-2)*.35,vy:1+i*.18,damage:0,until:now+650,style:'blood'}); }
      if (players === 2 && health2 > 0 && now < poisonedUntil2.current && now >= nextPoisonTick2.current) { nextPoisonTick2.current += 1000; damageHero(.5, 'Яд заставляет героя истекать кровью!', true);for(let i=0;i<5;i++)sandTornadoes.current.push({x:p2.x+7+i*3,y:p2.y+15,vx:(i-2)*.35,vy:1+i*.18,damage:0,until:now+650,style:'blood'}); }
      const firstDeathMummies = enemies.current.filter((e) => e.kind === 'mummy' && e.hp <= 0 && !e.revived);
      firstDeathMummies.forEach((mummy) => { mummy.revived = true; mummy.hp = mummy.maxHp / 2; mummy.flash = 0; mummy.stunnedUntil = now + 900; mummy.reviveFlashUntil = now + 900; });
      const revivingDesertBoss = enemies.current.find((e) => level === 12 && e.kind === 'boss' && e.hp <= 0 && !e.revived);
      if (revivingDesertBoss) { revivingDesertBoss.revived = true; revivingDesertBoss.hp = revivingDesertBoss.maxHp / 2; revivingDesertBoss.flash = 0; revivingDesertBoss.stunnedUntil = now + 1200; revivingDesertBoss.reviveFlashUntil = now + 1200; revivingDesertBoss.nextShotAt = now + 1200; revivingDesertBoss.nextSummonAt = now + 1800; setMessage('Владыка гробниц воскрес! Все его атаки ускорились в 1,5 раза!'); }
      const defeated = enemies.current.filter((e) => e.hp <= 0);
      defeated.filter((enemy) => enemy.kind === 'iceSpirit').forEach((spirit) => sandTornadoes.current.push({ x: spirit.x + 14, y: spirit.y + 14, vx: 0, vy: 0, damage: .5, impactAt: now + 500, until: now + 1150, style: 'iceSpiritDrop' }));
      enemies.current = enemies.current.filter((e) => e.hp > 0);
      if (firstDeathMummies.length) setMessage(firstDeathMummies.length === 1 ? 'Мумия восстала из песка!' : 'Павшие мумии снова восстали из песка!');
      if (defeated.length) { const bossFallen = defeated.some((e) => e.kind === 'boss'); const reward = defeated.reduce((sum, e) => sum + (e.kind === 'boss' ? 100 : e.kind === 'goblin' || e.kind === 'mummy' || e.kind === 'iceGolem' ? 10 : 5), 0); setCoins((c) => c + reward); setMessage(bossFallen ? 'Хранитель окончательно повержен! В центре арены открылся портал победы.' : defeated.some((e) => e.kind === 'frog') ? 'Жаба повержена и оставила несколько осколков.' : defeated.some((e) => e.kind === 'iceSpirit') ? 'Ледяной дух исчез — через полсекунды сюда упадёт сосулька!' : defeated.some((e) => e.kind === 'mummy') ? 'Мумия окончательно повержена и оставила 10 осколков.' : defeated.some((e) => e.kind === 'iceGolem') ? 'Ледяной голем раскололся и оставил 10 осколков.' : defeated.some((e) => e.kind === 'goblin') ? 'Гоблин повержен и оставил 10 осколков.' : 'Слизень оставил несколько осколков.'); if (bossFallen) keys.current.clear(); }
      if (level === 0) {
        const progressX = Math.max(p.x, players === 2 ? p2.x : p.x);
        const steps = [{ x: 330, text: 'Обойди телегу и пройди через пролом. Можно двигаться по диагонали.' }, { x: 590, text: 'Подойди к сундуку и нажми E. Второй игрок использует Ю.' }, { x: 900, text: 'Враг! SPACE — атака первого игрока, Ж — атака второго.' }, { x: 1190, text: 'Используй ульту: Q у первого игрока, Б у второго.' }, { x: 1500, text: 'Рюкзак: I у первого, Э у второго. У ворот нажми E или Ю.' }];
        if (tutorialStep.current < steps.length && progressX >= steps[tutorialStep.current].x) { const guideTips=['Обойди телегу. У закрытой двери подойди ближе и нажми E.','Подойди к сундуку и нажми E. На телефоне нажми кнопку с рукой.','Враг рядом! Бей кнопкой SPACE, а второй игрок — кнопкой Ж.','Используй сильную ульту: нажми Q. Второй игрок нажимает Б.','Открой рюкзак кнопкой I. У выходной двери снова нажми E.'];setTutorialGuide(guideTips[tutorialStep.current]);setMessage(steps[tutorialStep.current].text); tutorialStep.current++; }
      }
      const secondInteracts = players === 2 && keys.current.has('Period'); const interactionHero = secondInteracts ? p2 : p;
      const nearChest = map.chests.findIndex((chest, index) => !openedChests.includes(index) && Math.hypot(chest.x + 24 - interactionHero.x, chest.y + 20 - interactionHero.y) < 75);
      if ((keys.current.has('KeyE') || secondInteracts) && nearChest >= 0 && !loot) { const chest = map.chests[nearChest]; const ownerClass = secondInteracts ? playerClass2 : playerClass; let drop = level === 0 ? getTutorialClassLoot(ownerClass) : chestDrops[nearChest]; if (level === 0) setChestDrops((drops) => drops.map((current, index) => index === nearChest ? drop : current)); itemPicker.current = secondInteracts ? 2 : 1; if (!secondInteracts) keys.current.delete('KeyE'); setOpenedChests((current) => [...current, nearChest]); setDroppedItem(drop.item); setLoot({ x: chest.x + 8, y: chest.y + 48 }); if (level > 0 && level < 6 && Math.random() < .1) ambushAt.current = performance.now(); setMessage(`${drop.rarity.name} сундук: выпал предмет «${drop.item.name}»!`); }
      const playerOnePicks = loot && droppedItem && keys.current.has('KeyE') && Math.hypot(loot.x - p.x, loot.y - p.y) < 52; const playerTwoPicks = loot && droppedItem && players === 2 && keys.current.has('Period') && Math.hypot(loot.x - p2.x, loot.y - p2.y) < 52;
      if (playerOnePicks || playerTwoPicks) { itemPicker.current = playerTwoPicks || itemPicker.current === 2 && !playerOnePicks ? 2 : 1; keys.current.clear(); setChoiceItem(droppedItem); }
      const nearFirstLevelPortal = level === 1 && p.x < 100 && Math.abs(p.y + 14 - getRouteStart().y) < 75; const secondNearFirstPortal = players === 2 && level === 1 && p2.x < 100 && Math.abs(p2.y + 14 - getRouteStart().y) < 75;
      if (keys.current.has('KeyE') && nearFirstLevelPortal || keys.current.has('Period') && secondNearFirstPortal) {
        keys.current.delete(secondNearFirstPortal && keys.current.has('Period') ? 'Period' : 'KeyE'); rerollLevel(6); const portalMap = getLevel(6); currentMap.current = portalMap; setLevel(6); setOpenedChests([]); setChestDrops([]); setLoot(null); setDroppedItem(null); setChoiceItem(null); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; hero.current = { x: 35, y: 322 }; hero2.current = { x: 65, y: 322 }; enemies.current = createEnemies(portalMap, enemyMultiplier, oneHitBoss); setMessage(oneHitBoss ? 'Тестовый босс появился с 1 HP.' : 'Портал перенёс тебя на шестой уровень: Круг гоблинов.');
      }
      const nearDesertPortal = level === 7 && p.x < 100 && Math.abs(p.y + 14 - getRouteStart().y) < 75; const secondNearDesertPortal = players === 2 && level === 7 && p2.x < 100 && Math.abs(p2.y + 14 - getRouteStart().y) < 75;
      if (keys.current.has('KeyE') && nearDesertPortal || keys.current.has('Period') && secondNearDesertPortal) {
        setHealth(10); setHealth2(10); setDead(false); setTeammateFallen(false); poisonedUntil.current = 0; poisonedUntil2.current = 0; checkpointLevel.current = 12;
        keys.current.delete(secondNearDesertPortal && keys.current.has('Period') ? 'Period' : 'KeyE'); rerollLevel(12); const portalMap = getLevel(12); currentMap.current = portalMap; setLevel(12); setOpenedChests([]); setChestDrops([]); setLoot(null); setDroppedItem(null); setChoiceItem(null); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; hero.current = { x: 35, y: 322 }; hero2.current = { x: 65, y: 322 }; enemies.current = createEnemies(portalMap, enemyMultiplier); victoryReported.current = false; setVictory(false); setMessage('Пустынный портал перенёс героев на уровень 12 — в гробницу хранителя!');
      }
      const nearIcePortal = level === 13 && p.x < 100 && Math.abs(p.y + 14 - getRouteStart().y) < 75; const secondNearIcePortal = players === 2 && level === 13 && p2.x < 100 && Math.abs(p2.y + 14 - getRouteStart().y) < 75;
      if (keys.current.has('KeyE') && nearIcePortal || keys.current.has('Period') && secondNearIcePortal) {
        setHealth(10); setHealth2(10); setDead(false); setTeammateFallen(false); poisonedUntil.current = 0; poisonedUntil2.current = 0; checkpointLevel.current = 18;
        keys.current.delete(secondNearIcePortal && keys.current.has('Period') ? 'Period' : 'KeyE'); rerollLevel(18); const portalMap = getLevel(18); currentMap.current = portalMap; setLevel(18); setOpenedChests([]); setChestDrops([]); setLoot(null); setDroppedItem(null); setChoiceItem(null); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; sandTornadoes.current = []; tombs.current = []; hero.current = { x: 35, y: 322 }; hero2.current = { x: 65, y: 322 }; enemies.current = createEnemies(portalMap, enemyMultiplier); victoryReported.current = false; setVictory(false); setMessage('Ледяной портал перенёс героев на уровень 18 — к боссу Ледяного кладбища!');
      }
      const nearSwampPortal = level === 19 && p.x < 100 && Math.abs(p.y + 14 - getRouteStart().y) < 75; const secondNearSwampPortal = players === 2 && level === 19 && p2.x < 100 && Math.abs(p2.y + 14 - getRouteStart().y) < 75;
      if (keys.current.has('KeyE') && nearSwampPortal || keys.current.has('Period') && secondNearSwampPortal) {
        setHealth(10); setHealth2(10); setDead(false); setTeammateFallen(false); poisonedUntil.current = 0; poisonedUntil2.current = 0; checkpointLevel.current = 24;
        keys.current.delete(secondNearSwampPortal && keys.current.has('Period') ? 'Period' : 'KeyE'); rerollLevel(24); const portalMap=getLevel(24);currentMap.current=portalMap;setLevel(24);setOpenedChests([]);setChestDrops([]);setLoot(null);setDroppedItem(null);setChoiceItem(null);projectiles.current=[];superFists.current=[];swordUltimates.current=[];bowUltimates.current=[];staffUltimates.current=[];glovesUltimates.current=[];waves.current=[];sandTornadoes.current=[];tombs.current=[];hero.current={x:35,y:322};hero2.current={x:65,y:322};enemies.current=createEnemies(portalMap,enemyMultiplier);victoryReported.current=false;setVictory(false);setMessage('Болотный портал перенёс героев на уровень 24 — к хранителю 4-й локации!');
      }
      const bossDefeated = level > 0 && level % 6 === 0 && !enemies.current.some((enemy) => enemy.kind === 'boss'); const nearVictoryPortal = bossDefeated && Math.hypot(p.x - 320, p.y - 336) < 70; const secondNearVictoryPortal = players === 2 && bossDefeated && Math.hypot(p2.x - 320, p2.y - 336) < 70;
      if (keys.current.has('KeyE') && nearVictoryPortal || keys.current.has('Period') && secondNearVictoryPortal) { keys.current.clear(); setVictory(true); setMessage(level === 12 ? 'Владыка гробниц повержен. Жаркая пустыня освобождена!' : 'Великий гоблин повержен. Подземелье спасено!'); }
      const routeExit = level === 0 ? { x: map.worldWidth - 70, y: 336 } : getRouteExit(); const nearExit = !map.round && Math.abs(p.x - routeExit.x) < 80 && Math.abs(p.y + 14 - routeExit.y) < 75; const secondNearExit = players === 2 && !map.round && Math.abs(p2.x - routeExit.x) < 80 && Math.abs(p2.y + 14 - routeExit.y) < 75;
      if (keys.current.has('KeyE') && nearExit || keys.current.has('Period') && secondNearExit) {
        keys.current.delete(secondNearExit && keys.current.has('Period') ? 'Period' : 'KeyE');
        if(level===26&&castleGuardOutcome!=='peace'&&!(castleGuardOutcome==='fight'&&!enemies.current.some((enemy)=>enemy.kind==='nativeAxe'))){if(castleGuardOutcome==='fight')setMessage('Сначала победи стража с топором!');else setCastleGuardDialogueOpen(true);}
        else if (level > 0 && level % 6 === 0) { setVictory(true); keys.current.clear(); setMessage('Все четыре этапа области пройдены!'); }
        else { const next = level > 0 && level % 6 === 3 ? level + 3 : level + 1; rerollLevel(next); const nextMap = getLevel(next); currentMap.current = nextMap; setLevel(next); setOpenedChests([]); setChestDrops(nextMap.chests.map(() => getRandomLoot(next))); setLoot(null); setDroppedItem(null); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; hero.current = nextMap.round ? { x: 35, y: 322 } : getRouteStart(); hero2.current = nextMap.round ? { x: 65, y: 322 } : { ...getRouteStart(), y: getRouteStart().y + 32 }; enemies.current = createEnemies(nextMap, enemyMultiplier); setMessage(`Уровень ${next}: ${nextMap.name}. Враги стали сильнее!`); }
      }
      const attackProgress = attacking ? Math.max(0, (attackUntil.current - now) / 180) : 0;
      const attackProgress2 = attacking2 ? Math.max(0, (attackUntil2.current - now) / 180) : 0;
      drawScene(ctx, map, p, enemies.current, projectiles.current, superFists.current, swordUltimates.current, bowUltimates.current, staffUltimates.current, glovesUltimates.current, waves.current, sandTornadoes.current, tombs.current, now, openedChests, chestDrops, attackProgress, loot, droppedItem, level, weapon, weapon2, armor, facing.current, Boolean(dx || dy) || networkRole==='guest'&&now<remoteMovingUntil.current, health, superReloading, profileName, players === 2 ? p2 : null, facing2.current, Boolean(dx2 || dy2) || networkRole==='host'&&now<remoteMovingUntil.current, health2, superReloading2, attackProgress2, armor2, skin, skin2, explored.current, mobileControls, networkRole==='guest'?p2:p,castleGuardOutcome!=='fight'&&castleGuardOutcome!=='peace'); frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, [armor, armor2, castleGuardDialogueOpen, castleGuardOutcome, chestDrops, choiceItem, dead, droppedItem, enemyMultiplier, health, health2, level, loot, merchantMode, mobileControls, networkRole, openedChests, paused, players, profileName, shopOpen, showInventory, skin, skin2, superReloading, superReloading2, victory, weapon, weapon2]);

  const shopWeapons: Weapon[] = level === 12 ? [{ name: 'Песчаный клинок', type: 'sword', damage: 10, color: '#e5b85b' }, { name: 'Лук барханов', type: 'bow', damage: 12, color: '#d99a42' }, { name: 'Посох песчаной бури', type: 'staff', damage: 15, color: '#f0c76a' }, { name: 'Когти скорпиона', type: 'gloves', damage: 17, color: '#b96032' }, { name: 'Клинок фараона', type: 'sword', damage: 21, color: '#ffe28a' }] : [{ name: 'Меч каравана', type: 'sword', damage: 4, color: '#e6d4a0' }, { name: 'Лук странника', type: 'bow', damage: 6, color: '#78c999' }, { name: 'Посох туманностей', type: 'staff', damage: 9, color: '#8fb5ff' }, { name: 'Клинок башни', type: 'sword', damage: 13, color: '#d58cff' }, { name: 'Перчатки великана', type: 'gloves', damage: 18, color: '#ff9a5c' }];
  const buyWeapon = (item: Weapon) => { const price = item.damage * 220; const bag = shopOwner === 2 ? inventory2 : inventory, capacity = shopOwner === 2 ? inventoryCapacity2 : inventoryCapacity; if (coins < price) { setMessage('Недостаточно осколков.'); return; } if (bag.length >= capacity) { setMessage('В рюкзаке нет свободного места.'); return; } setCoins((value) => value - price); if (shopOwner === 2) setInventory2((items) => [...items, item]); else setInventory((items) => [...items, item]); setMessage(`${item.name} куплен игроком ${shopOwner} за ${price} осколков.`); };
  const buySkin = (newSkin: HeroSkin) => { if (coins < 5000) { setMessage('Для покупки скина нужно 5000 осколков.'); return; } setCoins((value) => value - 5000); if (shopOwner === 2) setSkin2(newSkin); else setSkin(newSkin); setMessage(`Игрок ${shopOwner} приобрёл новый облик.`); };
  const buyMedkit = () => { const count = shopOwner === 2 ? medkits2 : medkits; if (count >= 5) { setMessage('Можно носить не больше 5 аптечек.'); return; } if (coins < 200) { setMessage('Для аптечки нужно 200 осколков.'); return; } setCoins((value) => value - 200); if (shopOwner === 2) setMedkits2((value) => value + 1); else setMedkits((value) => value + 1); setMessage(`Игрок ${shopOwner} купил аптечку.`); };
  const confirmPurchase = (key: string, purchase: () => void) => { if (pendingPurchase === key) { purchase(); setPendingPurchase(null); } else { setPendingPurchase(key); setMessage('Нажми на выбранный товар ещё раз, чтобы подтвердить покупку.'); } };
  const tapMobileKey = (code: 'Space' | 'KeyE' | 'KeyQ' | 'KeyI') => { const resolved=networkRole==='guest'?({Space:'Semicolon',KeyE:'Period',KeyQ:'Comma',KeyI:'Quote'} as const)[code]:code;window.dispatchEvent(new KeyboardEvent('keydown', { code:resolved, bubbles: true })); window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code:resolved, bubbles: true })), 90); };
  const moveMobileJoystick = (event: React.PointerEvent<HTMLDivElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const rect = event.currentTarget.getBoundingClientRect(); const rawX = event.clientX - rect.left - rect.width / 2, rawY = event.clientY - rect.top - rect.height / 2, distance = Math.hypot(rawX, rawY), max = rect.width * .34, scale = distance > max ? max / distance : 1, x = rawX * scale, y = rawY * scale; mobileMove.current = { x: x / max, y: y / max }; const knob = event.currentTarget.querySelector<HTMLElement>('.mobile-stick-knob'); if (knob) knob.style.transform = `translate(${x}px,${y}px)`; };
  const releaseMobileJoystick = (event: React.PointerEvent<HTMLDivElement>) => { mobileMove.current = { x: 0, y: 0 }; const knob = event.currentTarget.querySelector<HTMLElement>('.mobile-stick-knob'); if (knob) knob.style.transform = 'translate(0,0)'; };
  const resolveCastleGuardDialogue = (outcome: 'fight'|'peace'|'farewell') => { setCastleGuardDialogueOpen(false);setCastleGuardOutcome(outcome);if(outcome==='fight'){const exit=getRouteExit();const guard=createEnemies({...currentMap.current,enemies:[{x:exit.x-68,y:exit.y-18,kind:'nativeAxe'}]},1)[0];guard.hp=14;guard.maxHp=14;guard.power=7;enemies.current.push(guard);setMessage('Страж взревел и поднял топор. Начинается бой!');}else if(outcome==='peace')setMessage('Страж мирно открыл ворота. Теперь можно пройти в замок.');else setMessage('Страж попрощался, но ворота остались закрыты.');};
  const visibleInventory = inventoryOwner === 2 ? inventory2 : inventory; const visibleCapacity = inventoryOwner === 2 ? inventoryCapacity2 : inventoryCapacity;
  return <section className="game-shell">
      <div className="hud">{armor && <span>🛡{armorHealth}</span>}<b>{weapon ? `${weapon.type === 'bow' ? '🏹' : weapon.type === 'staff' ? '✦' : weapon.type === 'gloves' ? '✊' : '⚔'} ${weapon.name.toUpperCase()} · ${weapon.damage}` : `ОСКОЛКИ ${coins}`}</b><span className={reloading ? 'reload busy' : 'reload'}>{reloading ? 'ПЕРЕЗАРЯДКА' : 'ГОТОВО'}</span><span>🎒 I {inventory.length}/{inventoryCapacity}{players === 2 ? ` · Э ${inventory2.length}/${inventoryCapacity2}` : ''}</span><span>LV {level}/30</span></div>
    <div className="canvas-stage"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      {level===26&&castleGuardDialogueOpen&&<CastleGuardDialogue onClose={()=>setCastleGuardDialogueOpen(false)} onOutcome={resolveCastleGuardDialogue}/>}
      {level===0&&!dead&&!victory&&!showInventory&&!shopOpen&&<aside className={`tutorial-knight-guide ${mobileControls?'mobile':''}`}><div className="tutorial-knight-speech"><small>СЭР ЭДГАР · НАСТАВНИК</small><p>{tutorialGuide}</p></div><div className="tutorial-knight" aria-label="Рыцарь-наставник"><i className="knight-plume"/><i className="knight-head"/><i className="knight-eye"/><i className="knight-body"/><i className="knight-arm arm-left"/><i className="knight-arm arm-right"/><i className="knight-shield"/><i className="knight-sword"/><i className="knight-leg leg-left"/><i className="knight-leg leg-right"/></div></aside>}
      {mobileControls && !dead && !victory && !showInventory && !shopOpen && <div className="mobile-game-controls"><div className="mobile-joystick" onPointerDown={moveMobileJoystick} onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && moveMobileJoystick(event)} onPointerUp={releaseMobileJoystick} onPointerCancel={releaseMobileJoystick}><i className="mobile-stick-knob" /></div><button className="mobile-backpack" onPointerDown={(event) => { event.preventDefault(); tapMobileKey('KeyI'); }}><i className="mobile-icon-bag" /><span>РЮКЗАК</span></button><div className="mobile-action-buttons"><button className="mobile-ultimate" onPointerDown={(event) => { event.preventDefault(); tapMobileKey('KeyQ'); }}><i className="mobile-icon-crystal" /><span>УЛЬТА</span></button><button className="mobile-pickup" onPointerDown={(event) => { event.preventDefault(); tapMobileKey('KeyE'); }}><i className="mobile-icon-hand" /><span>ПОДБОР</span></button><button className="mobile-attack" onPointerDown={(event) => { event.preventDefault(); tapMobileKey('Space'); }}><i className="mobile-icon-fist" /><span>УДАР</span></button></div></div>}
      {shopOpen && <div className="merchant-shop"><div className="shop-heading"><div><small>СТРАНСТВУЮЩИЙ ТОРГОВЕЦ</small><strong>МАГАЗИН · ИГРОК {shopOwner}</strong></div><b>ОСКОЛКИ: {coins}</b><button onClick={() => { setShopOpen(false); setPendingPurchase(null); }}>✕</button></div><div className="shop-confirm">{pendingPurchase ? 'НАЖМИ ЕЩЁ РАЗ ДЛЯ ПОКУПКИ' : 'ВЫБЕРИ ТОВАР'}</div><h3>РАСХОДНИКИ</h3><div className="shop-grid"><button className={pendingPurchase === 'medkit' ? 'confirming' : ''} onClick={() => confirmPurchase('medkit', buyMedkit)}><i>🧰</i><strong>АПТЕЧКА</strong><span>Восстанавливает 3 HP · максимум 5</span><b>200 ◆ · {shopOwner === 2 ? medkits2 : medkits}/5</b></button></div><h3>ОРУЖИЕ</h3><div className="shop-grid">{shopWeapons.map((item) => <button key={item.name} className={pendingPurchase === item.name ? 'confirming' : ''} onClick={() => confirmPurchase(item.name, () => buyWeapon(item))}><i style={{ color: item.color }}>{item.type === 'bow' ? '🏹' : item.type === 'staff' ? '🔮' : item.type === 'gloves' ? '✊' : '⚔️'}</i><strong>{item.name}</strong><span>УРОН {item.damage}</span><b>{item.damage * 220} ◆</b></button>)}</div><h3>ОБЛИКИ</h3><div className="shop-grid skins"><button className={pendingPurchase === 'skin-knight' ? 'confirming' : ''} onClick={() => confirmPurchase('skin-knight', () => buySkin('knight'))}><i>♞</i><strong>РЫЦАРЬ</strong><span>Полноразмерный доспех</span><b>5000 ◆</b></button><button className={pendingPurchase === 'skin-ninja' ? 'confirming' : ''} onClick={() => confirmPurchase('skin-ninja', () => buySkin('ninja'))}><i>🥷</i><strong>НИНДЗЯ</strong><span>Тёмный костюм и маска</span><b>5000 ◆</b></button></div></div>}
      {teammateFallen && <div className="teammate-fallen">ВАШ ТИММЕЙТ ПАЛ</div>}
      {showInventory && <div className="inventory-panel"><div className="inventory-title"><div><small>РЮКЗАК · ИГРОК {inventoryOwner}</small><strong>{visibleInventory.length}/{visibleCapacity} МЕСТ</strong></div><button onClick={() => { keys.current.clear(); setShowInventory(false); }}>✕</button></div><div className="inventory-grid">{Array.from({ length: visibleCapacity }, (_, index) => { const item = visibleInventory[index]; return <button key={index} className={`inventory-slot ${item ? 'filled' : ''}`} onClick={() => item && equipInventoryItem(item)} title={item?.name}>{item ? <><span>{item.type === 'bow' ? '🏹' : item.type === 'staff' ? '🔮' : item.type === 'gloves' ? '✊' : item.type === 'armor' ? '🛡️' : '⚔️'}</span><small>{item.name}</small><b>{item.type === 'armor' ? `🛡${item.durability}` : `⚔${item.damage}`}</b></> : <i>{index + 1}</i>}</button>; })}</div><div className="inventory-footer"><span>ОСКОЛКИ: {coins}</span><strong className="medkit-count">🧰 АПТЕЧКИ: {inventoryOwner === 2 ? medkits2 : medkits}/5</strong>{visibleCapacity < 30 ? <button onClick={upgradeInventory}>УЛУЧШИТЬ ДО {visibleCapacity === 10 ? 20 : 30} · {visibleCapacity === 10 ? 100 : 250}</button> : <b>МАКСИМУМ: 30</b>}</div></div>}
      {choiceItem && <div className="loot-choice"><div className="loot-icon">{choiceItem.type === 'bow' ? '🏹' : choiceItem.type === 'staff' ? '🔮' : choiceItem.type === 'gloves' ? '✊' : choiceItem.type === 'armor' ? '🛡️' : '⚔️'}</div><small>НАЙДЕН ПРЕДМЕТ</small><strong>{choiceItem.name}</strong><p>{choiceItem.type === 'armor' ? `Прочность: ${choiceItem.durability}` : `Урон: ${choiceItem.damage}`}</p><div><button onClick={acceptItem}>ОСТАВИТЬ</button><button className="secondary" onClick={rejectItem}>БРОСИТЬ</button></div></div>}
      {(dead || victory) && <div className="death-screen"><strong>{victory ? 'ПОЗДРАВЛЯЕМ!' : 'ТЫ ПАЛ'}</strong><p>{victory ? level === 12 ? 'Владыка гробниц повержен — Жаркая пустыня освобождена!' : 'Великий гоблин повержен — все шесть подземелий пройдены!' : 'Пепельное сердце погасло'}</p><button onClick={restart}>{victory ? 'СЫГРАТЬ ЕЩЁ' : 'НАЧАТЬ ЗАНОВО'}</button></div>}
    </div>
  </section>;
}
