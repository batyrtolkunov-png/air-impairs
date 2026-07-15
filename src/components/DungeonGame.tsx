import { useEffect, useRef, useState } from 'react';
import { getLevel, getRandomLoot, getRouteExit, getRouteStart, getTutorialLevel, isInsideFourWayRoute, rerollLevel, ROUTE_POINTS, type EnemyKind, type LootDrop, type Point, type Weapon } from '../game/levels';
import { playFootstep, playHurt, setMusicDanger } from '../game/audio';

export type GameSave = { level: number; players: 1 | 2; health: number; health2: number; coins: number; inventory: Weapon[]; inventory2: Weapon[]; inventoryCapacity: number; inventoryCapacity2: number; weapon: Weapon | null; weapon2: Weapon | null; armor: Weapon | null; armorHealth: number; map: ReturnType<typeof getLevel>; hero: Point; hero2: Point; enemies: Enemy[]; openedChests: number[]; chestDrops: LootDrop[]; loot: Point | null; droppedItem: Weapon | null; explored?: Point[]; savedAt: number };

export type Enemy = Point & { kind: EnemyKind; hp: number; maxHp: number; flash: number; attackUntil: number; stunnedUntil: number; color: string; power: number; speed: number; leapStarted: number; leapUntil: number; leapTargetX: number; leapTargetY: number; nextLeapAt: number };
type Projectile = Point & { vx: number; vy: number; damage: number; color: string };
type SuperFist = Point & { vx: number; vy: number; damage: number; hitTargets: Enemy[] };
type SwordUltimate = Point & { owner: 1 | 2; started: number; impactAt: number; until: number; color: string; name: string; damageApplied: boolean };
type RainArrow = Point & { started: number; impactAt: number; damaged: boolean };
type BowUltimate = Point & { owner: 1 | 2; started: number; rainStarted: number; until: number; nextArrowAt: number; color: string; name: string; arrows: RainArrow[] };
type StaffPulse = { started: number; damage: number };
type StaffUltimate = Point & { owner: 1 | 2; dx: number; dy: number; started: number; until: number; nextPulseAt: number; pulseIndex: number; kills: number; color: string; name: string; pulses: StaffPulse[] };
type GlovesUltimate = Point & { owner: 1 | 2; dx: number; dy: number; started: number; until: number; nextHitAt: number; hitIndex: number; damage: number; color: string; name: string; titanTargetX: number; titanTargetY: number; landed: boolean };
type MagicWave = Point & { dx: number; dy: number; color: string; started: number; until: number };

const WIDTH = 640;
const HEIGHT = 400;
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

function drawDecoration(ctx: CanvasRenderingContext2D, x: number, y: number, kind: 'rock' | 'grass' | 'log', variant: number) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (kind === 'grass') {
    ctx.fillStyle = 'rgba(3,10,6,.25)'; ctx.fillRect(-10, 8, 22, 4);
    ctx.strokeStyle = variant % 2 ? '#4f8448' : '#5d984e'; ctx.lineWidth = 3; ctx.lineCap = 'square';
    [-8, -3, 2, 7].forEach((offset, index) => { ctx.beginPath(); ctx.moveTo(offset, 9); ctx.lineTo(offset + (index % 2 ? 5 : -4), -4 - (index % 3) * 3); ctx.stroke(); });
    ctx.fillStyle = '#8fbd62'; ctx.fillRect(-1, -8, 3, 4);
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

function drawCart(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) { ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(x - 3, y + 29, 46, 8); ctx.fillStyle = '#272423'; ctx.beginPath(); ctx.arc(x + 8, y + 29, 7, 0, Math.PI * 2); ctx.arc(x + 32, y + 29, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#7c4b2c'; ctx.fillRect(x, y + 6, 40, 21); ctx.fillStyle = color; ctx.fillRect(x + 4, y + 9, 32, 13); ctx.fillStyle = '#b4884f'; ctx.fillRect(x - 3, y + 2, 46, 7); ctx.fillStyle = '#d7b66d'; ctx.fillRect(x + 5, y + 4, 5, 4); ctx.fillRect(x + 30, y + 4, 5, 4); }

function drawMinimap(ctx: CanvasRenderingContext2D, map: ReturnType<typeof getLevel>, level: number, hero: Point, enemies: Enemy[], chestDrops: LootDrop[], openedChests: number[], explored: Point[]) {
  const x = 8, y = 8, width = 135, height = 74, sx = width / map.worldWidth, sy = height / map.worldHeight;
  ctx.fillStyle = 'rgba(5,9,8,.9)'; ctx.fillRect(x - 3, y - 3, width + 6, height + 14); ctx.strokeStyle = '#a68b58'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip(); ctx.fillStyle = map.floor[0]; ctx.fillRect(x, y, width, height);
  if (map.round) { ctx.fillStyle = '#09100c'; ctx.fillRect(x, y, width, height); ctx.fillStyle = map.floor[1]; ctx.beginPath(); ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.strokeStyle = '#987b50'; ctx.lineWidth = 5; ctx.beginPath(); ROUTE_POINTS.forEach((point, index) => { const px = x + point.x * sx, py = y + point.y * sy; if (index === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }); ctx.stroke(); }
  ctx.fillStyle = '#15251b'; map.walls.slice(4).forEach((wall) => ctx.fillRect(x + wall.x * sx, y + wall.y * sy, Math.max(1, wall.w * sx), Math.max(1, wall.h * sy)));
  map.chests.forEach((chest, index) => { const drop = chestDrops[index]; if (!drop) return; const cx = x + chest.x * sx, cy = y + chest.y * sy; ctx.globalAlpha = openedChests.includes(index) ? .35 : 1; ctx.fillStyle = '#17120f'; ctx.fillRect(cx - 6, cy - 6, 12, 12); ctx.fillStyle = drop.rarity.color; ctx.fillRect(cx - 4, cy - 4, 8, 8); ctx.fillStyle = '#ffe58a'; ctx.fillRect(cx - 1, cy - 2, 3, 5); ctx.globalAlpha = 1; });
  enemies.forEach((enemy) => { const ex = x + enemy.x * sx, ey = y + enemy.y * sy; ctx.fillStyle = '#ff394f'; ctx.beginPath(); ctx.moveTo(ex, ey - 4); ctx.lineTo(ex + 4, ey); ctx.lineTo(ex, ey + 4); ctx.lineTo(ex - 4, ey); ctx.closePath(); ctx.fill(); });
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
}

function createEnemies(map: ReturnType<typeof getLevel>, multiplier = 1): Enemy[] {
  const spawns = map.round ? map.enemies : multiplier === .5 ? map.enemies.filter((_, index) => index % 2 === 0) : multiplier === 2 ? map.enemies.flatMap((enemy) => [enemy, { ...enemy, x: enemy.x + 4, y: enemy.y + 4 }]) : map.enemies;
  return spawns.map((enemy) => {
    const hp = enemy.kind === 'boss' ? map.enemy.hp * 5 : enemy.kind === 'goblin' ? map.enemy.hp * 1.5 : map.enemy.hp;
    const speed = enemy.kind === 'boss' ? map.enemy.speed * .65 : enemy.kind === 'goblin' ? map.enemy.speed * 1.25 : map.enemy.speed;
    return { ...enemy, ...map.enemy, color: enemy.kind === 'slime' ? map.enemy.color : '#69ad68', hp, maxHp: hp, power: enemy.kind === 'boss' ? 2 : map.enemy.power, speed, flash: 0, attackUntil: 0, stunnedUntil: 0, leapStarted: 0, leapUntil: 0, leapTargetX: 0, leapTargetY: 0, nextLeapAt: 0 };
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

function drawHero(ctx: CanvasRenderingContext2D, p: Point, attackProgress: number, weapon: Weapon | null, armor: Weapon | null, facing: Point, moving: boolean, now: number, health: number, profileName: string, female = false, swordUltimate?: SwordUltimate, bowUltimate?: BowUltimate, glovesUltimate?: GlovesUltimate) {
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

function drawScene(ctx: CanvasRenderingContext2D, map: ReturnType<typeof getLevel>, hero: Point, enemies: Enemy[], projectiles: Projectile[], superFists: SuperFist[], swordUltimates: SwordUltimate[], bowUltimates: BowUltimate[], staffUltimates: StaffUltimate[], glovesUltimates: GlovesUltimate[], waves: MagicWave[], now: number, openedChests: number[], chestDrops: LootDrop[], attackProgress: number, loot: Point | null, droppedItem: Weapon | null, level: number, weapon: Weapon | null, weapon2: Weapon | null, armor: Weapon | null, facing: Point, moving: boolean, health: number, superReloading: boolean, profileName: string, secondHero: Point | null, secondFacing: Point, secondMoving: boolean, secondHealth: number, superReloading2: boolean, attackProgress2: number, explored: Point[]) {
  ctx.fillStyle = map.round ? '#0c1510' : map.floor[0]; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const cameraX = Math.max(0, Math.min(map.worldWidth - WIDTH, hero.x - WIDTH / 2));
  const cameraY = Math.max(0, Math.min(map.worldHeight - HEIGHT, hero.y - HEIGHT / 2)); ctx.save(); ctx.translate(-cameraX, -cameraY);
  if (map.round) { ctx.save(); ctx.beginPath(); ctx.arc(320, 336, 336, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = map.floor[0]; ctx.fillRect(0, 0, map.worldWidth, map.worldHeight); }
  for (let y = 32; y < map.worldHeight - 32; y += 64) for (let x = 32; x < map.worldWidth - 32; x += 64) {
    ctx.fillStyle = (x / 64 + y / 64) % 2 ? map.floor[0] : map.floor[1]; ctx.fillRect(x, y, 64, 64);
    pixel(ctx, x + 12, y + 15, map.floor[2], 4); pixel(ctx, x + 43, y + 42, map.floor[2], 3);
    ctx.strokeStyle = '#64845a'; ctx.beginPath(); ctx.moveTo(x + 25, y + 50); ctx.lineTo(x + 27, y + 43); ctx.lineTo(x + 30, y + 50); ctx.stroke();
  }
  if (map.round) ctx.restore();
  if (!map.round) {
    ctx.fillStyle = 'rgba(4,10,7,.78)'; ctx.fillRect(32, 32, map.worldWidth - 64, map.worldHeight - 64); ctx.strokeStyle = '#17271d'; ctx.lineWidth = 158; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); ROUTE_POINTS.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); }); ctx.stroke(); ctx.strokeStyle = map.floor[1]; ctx.lineWidth = 136; ctx.stroke();
    ROUTE_POINTS.slice(1).forEach((end, index) => { const start = ROUTE_POINTS[index]; const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy), nx = -dy / length, ny = dx / length; for (let distance = 20; distance < length; distance += 52) { const px = start.x + dx * distance / length, py = start.y + dy * distance / length; drawTree(ctx, px + nx * 88 - 30, py + ny * 88 - 30, '#315f3c'); drawTree(ctx, px - nx * 88 - 30, py - ny * 88 - 30, '#284f35'); } });
  }
  map.decorations.forEach((decoration) => drawDecoration(ctx, decoration.x, decoration.y, decoration.kind, decoration.variant));
  map.walls.forEach((wall) => {
    ctx.fillStyle = '#11271c'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    if (wall.w >= wall.h) for (let x = wall.x - 12; x < wall.x + wall.w; x += 48) drawTree(ctx, x, wall.y + wall.h / 2 - 34, map.floor[2]);
    else for (let y = wall.y - 18; y < wall.y + wall.h; y += 48) drawTree(ctx, wall.x + wall.w / 2 - 32, y, map.floor[2]);
  });
  map.chests.forEach((chest, index) => { const open = openedChests.includes(index); const drop = chestDrops[index]; if (!drop) return;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(chest.x + 2, chest.y + 34, 50, 9);
    ctx.fillStyle = open ? '#68462b' : drop.rarity.color; ctx.fillRect(chest.x, chest.y + 11, 50, 28); ctx.fillStyle = '#3b281e'; ctx.fillRect(chest.x + 4, chest.y + 28, 42, 7);
    ctx.fillStyle = open ? '#3d2c22' : drop.rarity.color; ctx.fillRect(chest.x + 3, chest.y, 44, 15); ctx.fillStyle = '#f4cf62'; ctx.fillRect(chest.x + 21, chest.y + 15, 9, 13); pixel(ctx, chest.x + 6, chest.y + 18, '#7b4d27', 7); pixel(ctx, chest.x + 37, chest.y + 18, '#7b4d27', 7);
    if (!open) { ctx.fillStyle = '#101513'; ctx.fillRect(chest.x - 18, chest.y - 17, 86, 12); ctx.fillStyle = drop.rarity.color; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${drop.rarity.name.toUpperCase()} ${drop.rarity.chance}%`, chest.x + 25, chest.y - 8); ctx.textAlign = 'start'; }
  });
  map.carts.forEach((cart) => drawCart(ctx, cart.x, cart.y, map.floor[2]));
  if (loot && droppedItem) drawLoot(ctx, loot, droppedItem);
  if (!map.round) {
    const routeExit = level === 0 ? { x: map.worldWidth - 70, y: 336 } : getRouteExit(); const exitX = routeExit.x; const exitY = routeExit.y - 46;
    ctx.fillStyle = '#d5a84a'; ctx.fillRect(exitX, exitY, 12, 92);
    ctx.fillStyle = '#f3e7c3'; ctx.font = '8px monospace'; ctx.fillText(level === 0 ? 'ВОРОТА · E' : 'ВЫХОД', exitX - 48, exitY - 9);
  }
  if (level === 1) {
    const portalY = getRouteStart().y - 46; ctx.fillStyle = '#5cf2ff'; ctx.fillRect(32, portalY, 12, 92);
    ctx.fillStyle = '#b9faff'; ctx.fillRect(44, portalY + 12, 5, 68);
    ctx.fillStyle = '#f3ffff'; ctx.font = '8px monospace'; ctx.fillText('ПОРТАЛ · E', 51, portalY - 9);
  }
  if (level === 6 && !enemies.some((enemy) => enemy.kind === 'boss')) {
    const pulse = 1 + Math.sin(now / 170) * .08; ctx.save(); ctx.translate(320, 336); ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(90,238,255,.2)'; ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5cf2ff'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(0, 0, 32, 48, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#e7ffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 21, 37, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.fillStyle = '#e7ffff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('ПОРТАЛ ПОБЕДЫ · E', 320, 278); ctx.textAlign = 'start';
  }
  enemies.forEach((e) => {
    const attacking = e.attackUntil > now; const distance = Math.max(1, Math.hypot(hero.x - e.x, hero.y - e.y));
    const force = attacking ? Math.sin((e.attackUntil - now) / 220 * Math.PI) * 4.5 : 0;
    const boss = e.kind === 'boss';
    const airborne = boss && e.leapStarted > 0 && now > e.leapStarted + 380 && now < e.leapUntil;
    if (airborne) {
      ctx.save(); ctx.translate(e.leapTargetX, e.leapTargetY);
      ctx.fillStyle = 'rgba(151,24,32,.22)'; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ff4655'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,170,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.moveTo(0, -12); ctx.lineTo(0, 12); ctx.stroke(); ctx.restore();
      return;
    }
    if (!boss) { ctx.fillStyle = '#171918'; ctx.fillRect(e.x + 1, e.y - 14, 26, 4); ctx.fillStyle = '#54292d'; ctx.fillRect(e.x + 3, e.y - 12, 22, 2); ctx.fillStyle = '#67d06f'; ctx.fillRect(e.x + 3, e.y - 12, 22 * Math.max(0, e.hp / e.maxHp), 2); }
    ctx.save();
    if (boss) { ctx.translate(e.x - 122 + (hero.x - e.x) / distance * force, e.y - 213 + (hero.y - e.y) / distance * force); ctx.scale(1.9, 1.9); }
    else { ctx.translate(e.x + 1 + (hero.x - e.x) / distance * force, e.y - 5 + (hero.y - e.y) / distance * force); ctx.scale(e.kind === 'goblin' ? .38 : .21, e.kind === 'goblin' ? .38 : .21); }
    if (e.kind === 'goblin' || boss) { drawGoblin(ctx, e, now, attacking || (boss && e.leapStarted > 0)); ctx.restore(); if (e.stunnedUntil > now) { ctx.fillStyle = '#ffe56b'; ctx.font = `bold ${boss ? 22 : 14}px monospace`; ctx.fillText('★ ★ ★', e.x - (boss ? 42 : 7), e.y - (boss ? 235 : 22) + Math.sin(now / 90) * 3); } return; }
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
  drawHero(ctx, hero, attackProgress, weapon, armor, facing, moving, now, health, profileName, false, swordUltimates.find((ultimate) => ultimate.owner === 1 && now < ultimate.until), bowUltimates.find((ultimate) => ultimate.owner === 1 && now < ultimate.rainStarted), glovesUltimates.find((ultimate) => ultimate.owner === 1 && ultimate.name.includes('титана') && !ultimate.landed));
  if (secondHero) drawHero(ctx, secondHero, attackProgress2, weapon2, armor, secondFacing, secondMoving, now, secondHealth, 'Игрок 2', true, swordUltimates.find((ultimate) => ultimate.owner === 2 && now < ultimate.until), bowUltimates.find((ultimate) => ultimate.owner === 2 && now < ultimate.rainStarted), glovesUltimates.find((ultimate) => ultimate.owner === 2 && ultimate.name.includes('титана') && !ultimate.landed));
  const fog = document.createElement('canvas'); fog.width = map.worldWidth; fog.height = map.worldHeight; const fogCtx = fog.getContext('2d'); if (fogCtx) { fogCtx.fillStyle = 'rgba(1,4,3,.94)'; fogCtx.fillRect(0, 0, map.worldWidth, map.worldHeight); fogCtx.globalCompositeOperation = 'destination-out'; explored.forEach((point) => { const gradient = fogCtx.createRadialGradient(point.x, point.y, 160, point.x, point.y, 190); gradient.addColorStop(0, 'rgba(0,0,0,1)'); gradient.addColorStop(1, 'rgba(0,0,0,0)'); fogCtx.fillStyle = gradient; fogCtx.beginPath(); fogCtx.arc(point.x, point.y, 190, 0, Math.PI * 2); fogCtx.fill(); }); ctx.drawImage(fog, 0, 0); }
  ctx.restore();
  drawMinimap(ctx, map, level, hero, enemies, chestDrops, openedChests, explored);
  const boss = enemies.find((enemy) => enemy.kind === 'boss');
  if (boss) {
    ctx.fillStyle = '#251914'; ctx.fillRect(151, 6, 338, 31); ctx.fillStyle = '#6c482b'; ctx.fillRect(156, 9, 328, 25); ctx.fillStyle = '#171012'; ctx.fillRect(162, 12, 316, 19);
    ctx.fillStyle = '#87939a'; ctx.beginPath(); ctx.moveTo(151, 7); ctx.lineTo(139, 1); ctx.lineTo(146, 17); ctx.fill(); ctx.beginPath(); ctx.moveTo(489, 7); ctx.lineTo(501, 1); ctx.lineTo(494, 17); ctx.fill();
    ctx.fillStyle = '#69ad68'; ctx.beginPath(); ctx.moveTo(157, 12); ctx.lineTo(128, 6); ctx.lineTo(153, 25); ctx.fill(); ctx.beginPath(); ctx.moveTo(483, 12); ctx.lineTo(512, 6); ctx.lineTo(487, 25); ctx.fill();
    ctx.fillStyle = '#e8e4bd'; ctx.beginPath(); ctx.moveTo(166, 24); ctx.lineTo(174, 37); ctx.lineTo(180, 23); ctx.fill(); ctx.beginPath(); ctx.moveTo(460, 23); ctx.lineTo(466, 37); ctx.lineTo(474, 24); ctx.fill();
    ctx.fillStyle = '#d7bd63'; ctx.fillRect(146, 17, 9, 9); ctx.fillRect(485, 17, 9, 9);
    ctx.fillStyle = '#f0d7b0'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('ВЕЛИКИЙ ГОБЛИН', 320, 20); ctx.textAlign = 'start';
    ctx.fillStyle = '#35191d'; ctx.fillRect(170, 24, 300, 7); ctx.fillStyle = '#ef3949'; ctx.fillRect(170, 24, 300 * Math.max(0, boss.hp / boss.maxHp), 7);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(172, 25, 296 * Math.max(0, boss.hp / boss.maxHp), 2);
  }
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
}

export function DungeonGame({ paused = false, enemyMultiplier = 1, profileName, players = 1, initialSave, tutorial = false, saveRequest = 0, onSaveSnapshot }: { paused?: boolean; enemyMultiplier?: number; profileName: string; players?: 1 | 2; initialSave?: GameSave | null; tutorial?: boolean; saveRequest?: number; onSaveSnapshot?: (save: GameSave) => void }) {
  const startingLevel = initialSave?.level ?? (tutorial ? 0 : 1); const firstMap = initialSave?.map ?? (tutorial ? getTutorialLevel() : getLevel(startingLevel)); const startingPoint = initialSave?.hero ?? (tutorial ? { x: 75, y: 320 } : firstMap.round ? { x: 35, y: 322 } : getRouteStart());
  const currentMap = useRef(firstMap);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hero = useRef<Point>(startingPoint);
  const facing = useRef<Point>({ x: 1, y: 0 });
  const hero2 = useRef<Point>(initialSave?.hero2 ?? (firstMap.round ? { x: 65, y: 322 } : { ...startingPoint, y: startingPoint.y + 32 }));
  const facing2 = useRef<Point>({ x: 1, y: 0 });
  const enemies = useRef<Enemy[]>(initialSave?.enemies ?? createEnemies(firstMap, enemyMultiplier));
  const keys = useRef(new Set<string>());
  const projectiles = useRef<Projectile[]>([]);
  const superFists = useRef<SuperFist[]>([]);
  const swordUltimates = useRef<SwordUltimate[]>([]);
  const bowUltimates = useRef<BowUltimate[]>([]);
  const staffUltimates = useRef<StaffUltimate[]>([]);
  const glovesUltimates = useRef<GlovesUltimate[]>([]);
  const waves = useRef<MagicWave[]>([]);
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
  const itemPicker = useRef<1 | 2>(1);
  const handledSaveRequest = useRef(saveRequest);
  const nextFootstepAt = useRef(0);
  const ambushAt = useRef(-1);
  const tutorialStep = useRef(0);
  const explored = useRef<Point[]>(initialSave?.explored ?? [{ ...startingPoint }]);
  const exploredLevel = useRef(startingLevel);
  const [health, setHealth] = useState(initialSave?.health ?? 10);
  const [health2, setHealth2] = useState(initialSave?.health2 ?? 10);
  const [coins, setCoins] = useState(initialSave?.coins ?? 0);
  const [inventory, setInventory] = useState<Weapon[]>(initialSave?.inventory ?? []);
  const [inventory2, setInventory2] = useState<Weapon[]>(initialSave?.inventory2 ?? []);
  const [inventoryCapacity, setInventoryCapacity] = useState(initialSave?.inventoryCapacity ?? 10);
  const [inventoryCapacity2, setInventoryCapacity2] = useState(initialSave?.inventoryCapacity2 ?? 10);
  const [inventoryOwner, setInventoryOwner] = useState<1 | 2>(1);
  const [showInventory, setShowInventory] = useState(false);
  const [openedChests, setOpenedChests] = useState<number[]>(initialSave?.openedChests ?? []);
  const [loot, setLoot] = useState<Point | null>(initialSave?.loot ?? null);
  const [droppedItem, setDroppedItem] = useState<Weapon | null>(initialSave?.droppedItem ?? null);
  const [choiceItem, setChoiceItem] = useState<Weapon | null>(null);
  const [chestDrops, setChestDrops] = useState<LootDrop[]>(() => initialSave?.chestDrops ?? firstMap.chests.map(() => getRandomLoot(startingLevel)));
  const [weapon, setWeapon] = useState<Weapon | null>(initialSave?.weapon ?? null);
  const [weapon2, setWeapon2] = useState<Weapon | null>(initialSave?.weapon2 ?? null);
  const [armor, setArmor] = useState<Weapon | null>(initialSave?.armor ?? null);
  const [armorHealth, setArmorHealth] = useState(initialSave?.armorHealth ?? 0);
  const armorHealthRef = useRef(initialSave?.armorHealth ?? 0);
  const [level, setLevel] = useState(startingLevel);
  const [dead, setDead] = useState(false);
  const [victory, setVictory] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [superReloading, setSuperReloading] = useState(false);
  const [superReloading2, setSuperReloading2] = useState(false);
  const [teammateFallen, setTeammateFallen] = useState(false);
  const [message, setMessage] = useState(tutorial ? 'ОБУЧЕНИЕ: двигайся клавишами WASD. Второй игрок использует стрелки.' : 'Найди старый сундук в северо-восточной части зала.');

  const restart = () => {
    hero.current = getRouteStart(); facing.current = { x: 1, y: 0 };
    hero2.current = { ...getRouteStart(), y: getRouteStart().y + 32 }; facing2.current = { x: 1, y: 0 };
    rerollLevel(1);
    const map = getLevel(1); currentMap.current = map; explored.current = [{ ...getRouteStart() }]; enemies.current = createEnemies(map, enemyMultiplier);
    ambushAt.current = Math.random() < .1 ? performance.now() + 3000 : -1;
    keys.current.clear(); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; readyAt.current = 0; readyAt2.current = 0; attackUntil2.current = 0; healReadyAt.current = 0; healReadyAt2.current = 0; superReadyAt.current = 0; superReadyAt2.current = 0; setReloading(false); setSuperReloading(false); setSuperReloading2(false); setHealth(10); setHealth2(10); setCoins(0); setInventory([]); setInventory2([]); setInventoryCapacity(10); setInventoryCapacity2(10); setInventoryOwner(1); setShowInventory(false); setOpenedChests([]); setLoot(null); setDroppedItem(null); setChoiceItem(null); setChestDrops(map.chests.map(() => getRandomLoot(1)));
    armorHealthRef.current = 0; setWeapon(null); setWeapon2(null); setArmor(null); setArmorHealth(0); setLevel(1); setDead(false); setTeammateFallen(false); setVictory(false); setMessage('Найди сундук и приготовься к бою.');
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyH', 'KeyL', 'KeyQ', 'KeyI', 'KeyE', 'Period', 'Quote', 'Comma', 'Semicolon', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (event.code === 'KeyI' && !event.repeat) { keys.current.clear(); setInventoryOwner(1); setShowInventory((current) => inventoryOwner === 1 ? !current : true); return; }
      if (players === 2 && event.code === 'Quote' && !event.repeat) { keys.current.clear(); setInventoryOwner(2); setShowInventory((current) => inventoryOwner === 2 ? !current : true); return; }
      if (players === 2 && event.code === 'KeyH' && !event.repeat) {
        const now = performance.now(); const distance = Math.hypot(hero.current.x - hero2.current.x, hero.current.y - hero2.current.y);
        if (health <= 0) { setMessage('Павший первый игрок не может лечить тиммейта.'); return; }
        if (distance > 80) { setMessage('Подойди ближе к тиммейту, чтобы вылечить его.'); return; }
        if (health2 >= 10) { setMessage('У тиммейта уже полное здоровье.'); return; }
        if (now < healReadyAt.current) { setMessage(`Лечение будет готово через ${Math.ceil((healReadyAt.current - now) / 1000)} сек.`); return; }
        healReadyAt.current = now + 5000; setHealth2((current) => Math.min(10, Math.max(3, current + 3))); setTeammateFallen(false); setMessage(health2 <= 0 ? 'Первый игрок поднял тиммейта с 3 HP!' : 'Первый игрок восстановил тиммейту 3 HP!'); return;
      }
      if (players === 2 && event.code === 'KeyL' && !event.repeat) {
        const now = performance.now(); const distance = Math.hypot(hero.current.x - hero2.current.x, hero.current.y - hero2.current.y);
        if (health2 <= 0) { setMessage('Павший второй игрок не может лечить тиммейта.'); return; }
        if (distance > 80) { setMessage('Второму игроку нужно подойти ближе для лечения.'); return; }
        if (health >= 10) { setMessage('У первого игрока уже полное здоровье.'); return; }
        if (now < healReadyAt2.current) { setMessage(`Лечение второго игрока будет готово через ${Math.ceil((healReadyAt2.current - now) / 1000)} сек.`); return; }
        healReadyAt2.current = now + 5000; setHealth((current) => Math.min(10, Math.max(3, current + 3))); setTeammateFallen(false); setMessage(health <= 0 ? 'Второй игрок поднял первого с 3 HP!' : 'Второй игрок восстановил первому 3 HP!'); return;
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
          enemies.current.forEach((enemy) => { const ex = enemy.x + (enemy.kind === 'boss' ? 0 : 14) - origin.x, ey = enemy.y + (enemy.kind === 'boss' ? -100 : 16) - origin.y; const forward = ex * direction.x + ey * direction.y; const side = Math.abs(ex * -direction.y + ey * direction.x); if (forward > 0 && forward < (enemy.kind === 'boss' ? 180 : 80) && side < (enemy.kind === 'boss' ? 135 : 48)) { enemy.hp -= current.damage; enemy.flash = 12; } });
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
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [health, health2, inventoryOwner, players]);

  useEffect(() => { weaponRef.current = weapon; }, [weapon]);
  useEffect(() => { weapon2Ref.current = weapon2; }, [weapon2]);
  useEffect(() => { if (saveRequest > handledSaveRequest.current) { handledSaveRequest.current = saveRequest; onSaveSnapshot?.({ level, players, health, health2, coins, inventory, inventory2, inventoryCapacity, inventoryCapacity2, weapon, weapon2, armor, armorHealth, map: currentMap.current, hero: { ...hero.current }, hero2: { ...hero2.current }, enemies: enemies.current.map((enemy) => ({ ...enemy })), openedChests: [...openedChests], chestDrops: chestDrops.map((drop) => ({ rarity: { ...drop.rarity }, item: { ...drop.item } })), loot: loot ? { ...loot } : null, droppedItem: droppedItem ? { ...droppedItem } : null, explored: explored.current.map((point) => ({ ...point })), savedAt: Date.now() }); } }, [armor, armorHealth, chestDrops, coins, droppedItem, health, health2, inventory, inventory2, inventoryCapacity, inventoryCapacity2, level, loot, onSaveSnapshot, openedChests, players, saveRequest, weapon, weapon2]);
  useEffect(() => { setMusicDanger(health === 1 && !dead); return () => setMusicDanger(false); }, [dead, health]);
  useEffect(() => { ambushAt.current = level > 0 && level < 6 && Math.random() < .1 ? performance.now() + 3000 : -1; }, [level]);
  useEffect(() => { if (exploredLevel.current !== level) { exploredLevel.current = level; explored.current = [{ ...hero.current }, ...(players === 2 ? [{ ...hero2.current }] : [])]; } }, [level, players]);

  const acceptItem = () => {
    if (!choiceItem) return;
    const secondPicker = itemPicker.current === 2; const targetInventory = secondPicker ? inventory2 : inventory; const targetCapacity = secondPicker ? inventoryCapacity2 : inventoryCapacity;
    if (targetInventory.length >= targetCapacity) { setMessage(`Рюкзак ${secondPicker ? 'второго' : 'первого'} игрока заполнен: ${targetCapacity}/${targetCapacity}.`); return; }
    if (secondPicker) setInventory2((current) => [...current, choiceItem]); else setInventory((current) => [...current, choiceItem]);
    if (choiceItem.type === 'armor') { const durability = choiceItem.durability ?? 5; armorHealthRef.current = durability; setArmorHealth(durability); setArmor(choiceItem); setMessage(`${choiceItem.name} надета. Прочность: ${durability}.`); }
    else if (itemPicker.current === 2) { setWeapon2(choiceItem); setMessage(`Второй игрок получил «${choiceItem.name}». Урон: ${choiceItem.damage}.`); }
    else { setWeapon(choiceItem); setMessage(`Первый игрок получил «${choiceItem.name}». Урон: ${choiceItem.damage}.`); }
    setLoot(null); setDroppedItem(null); setChoiceItem(null);
  };

  const equipInventoryItem = (item: Weapon) => {
    if (item.type === 'armor') { const durability = item.durability ?? 5; armorHealthRef.current = durability; setArmorHealth(durability); setArmor(item); setMessage(`${item.name} надета из рюкзака.`); }
    else if (inventoryOwner === 2) { setWeapon2(item); setMessage(`Второй игрок экипировал ${item.name}.`); }
    else { setWeapon(item); setMessage(`${item.name} экипирован из рюкзака.`); }
    setShowInventory(false);
  };

  const upgradeInventory = () => { const capacity = inventoryOwner === 2 ? inventoryCapacity2 : inventoryCapacity; const nextCapacity = capacity === 10 ? 20 : 30; const cost = capacity === 10 ? 100 : 250; if (capacity >= 30) return; if (coins < cost) { setMessage(`Для улучшения рюкзака нужно ${cost} осколков.`); return; } setCoins((current) => current - cost); if (inventoryOwner === 2) setInventoryCapacity2(nextCapacity); else setInventoryCapacity(nextCapacity); setMessage(`Рюкзак ${inventoryOwner === 2 ? 'второго' : 'первого'} игрока улучшен до ${nextCapacity} мест!`); };

  const rejectItem = () => { if (choiceItem) setMessage(`${choiceItem.name} оставлен.`); setLoot(null); setDroppedItem(null); setChoiceItem(null); };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    ctx.imageSmoothingEnabled = false; let frame = 0; let last = performance.now();
    const loop = (now: number) => {
      const map = currentMap.current; const dt = Math.min((now - last) / 16.67, 2); last = now; const p = hero.current; const speed = 3 * dt;
      [p, ...(players === 2 ? [hero2.current] : [])].forEach((viewer) => { if (!explored.current.some((point) => Math.hypot(point.x - viewer.x, point.y - viewer.y) < 54)) explored.current.push({ x: viewer.x, y: viewer.y }); });
      if (paused || dead || victory || choiceItem || showInventory) { drawScene(ctx, map, p, enemies.current, projectiles.current, superFists.current, swordUltimates.current, bowUltimates.current, staffUltimates.current, glovesUltimates.current, waves.current, now, openedChests, chestDrops, 0, loot, droppedItem, level, weapon, weapon2, armor, facing.current, false, health, superReloading, profileName, players === 2 ? hero2.current : null, facing2.current, false, health2, superReloading2, 0, explored.current); frame = requestAnimationFrame(loop); return; }
      if (ambushAt.current > 0 && now >= ambushAt.current) {
        ambushAt.current = -1;
        const spawns: Array<Point & { kind: EnemyKind }> = [];
        for (let index = 0; index < 10; index++) {
          for (let attempt = 0; attempt < 80; attempt++) {
            const angle = Math.random() * Math.PI * 2; const radius = 76 + Math.random() * 54;
            const x = p.x + Math.cos(angle) * radius; const y = p.y + Math.sin(angle) * radius;
            const outsideRoute = level !== 0 && !isInsideFourWayRoute(x + 14, y + 14);
            const hitsWall = map.walls.slice(4).some((wall) => x + 28 > wall.x && x < wall.x + wall.w && y + 28 > wall.y && y < wall.y + wall.h);
            const hitsCart = map.carts.some((cart) => x + 28 > cart.x - 5 && x < cart.x + 45 && y + 28 > cart.y && y < cart.y + 36);
            if (!outsideRoute && !hitsWall && !hitsCart && spawns.every((spawn) => Math.hypot(spawn.x - x, spawn.y - y) > 16)) { spawns.push({ x, y, kind: index % 3 === 2 ? 'goblin' : 'slime' }); break; }
          }
        }
        while (spawns.length < 10 && spawns.length > 0) { const base = spawns[spawns.length % Math.max(1, spawns.length)]; spawns.push({ ...base, kind: spawns.length % 3 === 2 ? 'goblin' : 'slime' }); }
        enemies.current.push(...createEnemies({ ...map, enemies: spawns }, 1));
        setMessage('ЗАСАДА! Вокруг героя появились 10 дополнительных монстров!');
      }
      let dx = 0, dy = 0; if (health > 0) { if (keys.current.has('KeyA') || players === 1 && keys.current.has('ArrowLeft')) dx -= speed; if (keys.current.has('KeyD') || players === 1 && keys.current.has('ArrowRight')) dx += speed;
      if (keys.current.has('KeyW') || players === 1 && keys.current.has('ArrowUp')) dy -= speed; if (keys.current.has('KeyS') || players === 1 && keys.current.has('ArrowDown')) dy += speed; }
      if (dx || dy) { const length = Math.hypot(dx, dy); facing.current = { x: dx / length, y: dy / length }; }
      const nx = Math.max(34, Math.min(map.worldWidth - 60, p.x + dx)); const ny = Math.max(34, Math.min(map.worldHeight - 64, p.y + dy));
      const outsideArena = map.round && Math.hypot(nx + 12 - 320, ny + 14 - 336) > 306;
      const outsideRoute = level !== 0 && !map.round && !isInsideFourWayRoute(nx + 12, ny + 14);
      const blockedByCart = map.carts.some((cart) => nx + 24 > cart.x - 5 && nx < cart.x + 45 && ny + 28 > cart.y && ny < cart.y + 36);
      const blocked = outsideArena || outsideRoute || blockedByCart || map.walls.slice(4).some((w) => nx + 24 > w.x && nx < w.x + w.w && ny + 28 > w.y && ny < w.y + w.h); if (!blocked) { p.x = nx; p.y = ny; if ((dx || dy) && now >= nextFootstepAt.current) { playFootstep(); nextFootstepAt.current = now + 280; } }
      let dx2 = 0, dy2 = 0; const p2 = hero2.current;
      if (players === 2 && health2 > 0) {
        if (keys.current.has('ArrowLeft')) dx2 -= speed; if (keys.current.has('ArrowRight')) dx2 += speed; if (keys.current.has('ArrowUp')) dy2 -= speed; if (keys.current.has('ArrowDown')) dy2 += speed;
        if (dx2 || dy2) { const length = Math.hypot(dx2, dy2); facing2.current = { x: dx2 / length, y: dy2 / length }; }
        const nx2 = Math.max(34, Math.min(map.worldWidth - 60, p2.x + dx2)); const ny2 = Math.max(34, Math.min(map.worldHeight - 64, p2.y + dy2));
        const blocked2 = map.round && Math.hypot(nx2 + 12 - 320, ny2 + 14 - 336) > 306 || level !== 0 && !map.round && !isInsideFourWayRoute(nx2 + 12, ny2 + 14) || map.carts.some((cart) => nx2 + 24 > cart.x - 5 && nx2 < cart.x + 45 && ny2 + 28 > cart.y && ny2 < cart.y + 36) || map.walls.slice(4).some((wall) => nx2 + 24 > wall.x && nx2 < wall.x + wall.w && ny2 + 28 > wall.y && ny2 < wall.y + wall.h);
        if (!blocked2) { p2.x = nx2; p2.y = ny2; }
      }
      const attacking = now < attackUntil.current;
      if (attacking) enemies.current.forEach((e) => {
        const ex = e.x - p.x, ey = e.y - p.y, distance = Math.hypot(ex, ey);
        const inFront = distance > 0 && (ex * facing.current.x + ey * facing.current.y) / distance > 0.25;
        const range = weapon?.type === 'staff' ? 190 : 50 + (e.kind === 'boss' ? 100 : 0);
        if (weapon?.type !== 'bow' && weapon?.type !== 'staff' && distance < range && inFront && e.flash <= 0) { e.hp -= weapon?.damage || 1; e.flash = 12; }
      });
      const attacking2 = players === 2 && health2 > 0 && now < attackUntil2.current;
      if (attacking2) enemies.current.forEach((enemy) => { const ex = enemy.x - p2.x, ey = enemy.y - p2.y, distance = Math.hypot(ex, ey); const inFront = distance > 0 && (ex * facing2.current.x + ey * facing2.current.y) / distance > .25; const range = weapon2?.type === 'staff' ? 190 : 50 + (enemy.kind === 'boss' ? 100 : 0); if (weapon2?.type !== 'bow' && weapon2?.type !== 'staff' && distance < range && inFront && enemy.flash <= 0) { enemy.hp -= weapon2?.damage || 1; enemy.flash = 12; } });
      projectiles.current = projectiles.current.filter((arrow) => {
        arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt;
        const hitsWall = map.walls.some((wall) => arrow.x > wall.x && arrow.x < wall.x + wall.w && arrow.y > wall.y && arrow.y < wall.y + wall.h);
        const target = enemies.current.find((e) => Math.hypot(e.x + (e.kind === 'boss' ? 0 : 14) - arrow.x, e.y + (e.kind === 'boss' ? -100 : 16) - arrow.y) < (e.kind === 'boss' ? 115 : 10));
        if (target) { target.hp -= arrow.damage; target.flash = 12; return false; }
        const insideArena = !map.round || Math.hypot(arrow.x - 320, arrow.y - 336) < 336;
        return !hitsWall && insideArena && arrow.x > 0 && arrow.x < map.worldWidth && arrow.y > 0 && arrow.y < map.worldHeight;
      });
      superFists.current = superFists.current.filter((fist) => {
        fist.x += fist.vx * dt; fist.y += fist.vy * dt;
        const targets = enemies.current.filter((e) => !fist.hitTargets.includes(e) && !(e.kind === 'boss' && e.leapStarted > 0 && now < e.leapUntil) && Math.hypot(e.x + (e.kind === 'boss' ? 0 : 14) - fist.x, e.y + (e.kind === 'boss' ? -100 : 16) - fist.y) < (e.kind === 'boss' ? 145 : 42));
        targets.forEach((target) => { target.hp -= fist.damage; target.flash = 12; fist.hitTargets.push(target); });
        if (targets.length) setMessage(`Суперкулак нанёс по 10 урона ${targets.length === 1 ? 'врагу' : 'врагам'}!`);
        const cameraX = Math.max(0, Math.min(map.worldWidth - WIDTH, p.x - WIDTH / 2)); const cameraY = Math.max(0, Math.min(map.worldHeight - HEIGHT, p.y - HEIGHT / 2));
        return fist.x > cameraX - 64 && fist.x < cameraX + WIDTH + 64 && fist.y > cameraY - 64 && fist.y < cameraY + HEIGHT + 64;
      });
      swordUltimates.current = swordUltimates.current.filter((ultimate) => {
        if (!ultimate.damageApplied && now >= ultimate.impactAt) { ultimate.damageApplied = true; const targets = enemies.current.filter((enemy) => Math.hypot(enemy.x - ultimate.x, enemy.y - ultimate.y) <= 64 + (enemy.kind === 'boss' ? 90 : 0)); targets.forEach((enemy) => { enemy.hp -= ultimate.name.includes('Теневой') ? 8 : 5; enemy.flash = 12; if (ultimate.name.includes('Стальной')) { const distance = Math.max(1, Math.hypot(enemy.x - ultimate.x, enemy.y - ultimate.y)); enemy.x += (enemy.x - ultimate.x) / distance * 35; enemy.y += (enemy.y - ultimate.y) / distance * 35; } if (ultimate.name.includes('вождя')) enemy.stunnedUntil = now + 900; }); setMessage(targets.length ? `Ульта меча поразила ${targets.length === 1 ? 'врага' : 'врагов'}!` : 'Камни вырвались из земли!'); }
        return now < ultimate.until;
      });
      bowUltimates.current = bowUltimates.current.filter((ultimate) => {
        while (now >= ultimate.nextArrowAt && ultimate.nextArrowAt < ultimate.until) { for (let i = 0; i < 5; i++) ultimate.arrows.push({ x: ultimate.x - 60 + Math.random() * 120, y: ultimate.y - 60 + Math.random() * 120, started: ultimate.nextArrowAt, impactAt: ultimate.nextArrowAt + 300, damaged: false }); ultimate.nextArrowAt += 200; }
        ultimate.arrows.forEach((arrow) => { if (!arrow.damaged && now >= arrow.impactAt) { arrow.damaged = true; enemies.current.filter((enemy) => Math.hypot(enemy.x - arrow.x, enemy.y - arrow.y) < (ultimate.name.includes('Солнечный') ? 27 : 16) + (enemy.kind === 'boss' ? 90 : 0)).forEach((enemy) => { enemy.hp -= ultimate.name.includes('Пламенный') || ultimate.name.includes('Небесный') ? 2 : 1.5; enemy.flash = 12; if (ultimate.name.includes('Ледяной')) enemy.stunnedUntil = now + 650; if (ultimate.name.includes('Охотничий')) enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + 250); }); } });
        ultimate.arrows = ultimate.arrows.filter((arrow) => now < arrow.impactAt + 300); return now < ultimate.until + 300;
      });
      staffUltimates.current = staffUltimates.current.filter((ultimate) => {
        while (now >= ultimate.nextPulseAt && ultimate.pulseIndex < 3) {
          const baseDamage = ultimate.pulseIndex === 0 ? 3 : ultimate.pulseIndex === 1 ? 5 : ultimate.kills; const damage = ultimate.name.includes('пламени') ? baseDamage + 1 : ultimate.name.includes('звёзд') && ultimate.pulseIndex === 2 ? baseDamage + 3 : baseDamage; ultimate.pulses.push({ started: ultimate.nextPulseAt, damage });
          enemies.current.forEach((enemy) => { const ex = enemy.x - ultimate.x, ey = enemy.y - ultimate.y; const forward = ex * ultimate.dx + ey * ultimate.dy; const side = Math.abs(ex * -ultimate.dy + ey * ultimate.dx); if (forward > 0 && forward < 180 && side < 55 && !(enemy.kind === 'boss' && enemy.leapStarted > 0)) { const wasAlive = enemy.hp > 0; enemy.hp -= damage; enemy.flash = 12; enemy.stunnedUntil = Math.max(enemy.stunnedUntil, now + (ultimate.name.includes('Грозовой') ? 1500 : 1100)); if (ultimate.pulseIndex < 2 && wasAlive && enemy.hp <= 0) ultimate.kills++; } });
          ultimate.pulseIndex++; ultimate.nextPulseAt += 600; setMessage(ultimate.pulseIndex === 3 ? `Третья волна нанесла ${damage} урона — столько врагов убили первые две!` : `Волна посоха ${ultimate.pulseIndex}: ${damage} урона и оглушение!`);
        }
        ultimate.pulses = ultimate.pulses.filter((pulse) => now < pulse.started + 520); return now < ultimate.until;
      });
      glovesUltimates.current = glovesUltimates.current.filter((ultimate) => {
        const titan = ultimate.name.includes('титана');
        if (titan && !ultimate.landed && now >= ultimate.nextHitAt) { ultimate.landed = true; const tx = Math.max(34, Math.min(map.worldWidth - 60, ultimate.titanTargetX)); const ty = Math.max(34, Math.min(map.worldHeight - 64, ultimate.titanTargetY)); const ownerHero = ultimate.owner === 2 ? p2 : p; ownerHero.x = tx; ownerHero.y = ty; ultimate.titanTargetX = tx; ultimate.titanTargetY = ty; enemies.current.filter((enemy) => Math.hypot(enemy.x - tx, enemy.y - ty) <= 16 + (enemy.kind === 'boss' ? 90 : 0)).forEach((enemy) => { enemy.hp -= 15; enemy.flash = 12; }); setMessage('Перчатки титана: прыжок через стену и удар на 15 HP!'); }
        if (!titan) while (now >= ultimate.nextHitAt && ultimate.hitIndex < 10) { const finalHit = ultimate.hitIndex === 9; enemies.current.forEach((enemy) => { const ex = enemy.x - ultimate.x, ey = enemy.y - ultimate.y; const forward = ex * ultimate.dx + ey * ultimate.dy; const side = Math.abs(ex * -ultimate.dy + ey * ultimate.dx); if (forward > 0 && forward < 105 && side < 55) { const fireBonus = ultimate.name.includes('Огненные') ? .5 : 0; enemy.hp -= (finalHit ? ultimate.damage * 2 : ultimate.damage) + fireBonus; enemy.flash = 12; if (ultimate.name.includes('Грозовые') && ultimate.hitIndex % 3 === 2) enemy.stunnedUntil = now + 700; if (finalHit) { enemy.x += ultimate.dx * 28; enemy.y += ultimate.dy * 28; } } }); if (ultimate.name.includes('Теневые')) { const ownerHero = ultimate.owner === 2 ? p2 : p; ownerHero.x = Math.max(34, Math.min(map.worldWidth - 60, ownerHero.x + ultimate.dx * 5)); ownerHero.y = Math.max(34, Math.min(map.worldHeight - 64, ownerHero.y + ultimate.dy * 5)); } ultimate.hitIndex++; ultimate.nextHitAt += 100; }
        return now < ultimate.until;
      });
      waves.current = waves.current.filter((wave) => now < wave.until);
      const showTeammateFallen = () => { setTeammateFallen(true); window.setTimeout(() => setTeammateFallen(false), 3200); };
      const damageHero = (amount: number, hitMessage?: string, second = false) => {
        playHurt();
        if (armor && armorHealthRef.current > 0) {
          const nextArmor = Math.max(0, armorHealthRef.current - amount); armorHealthRef.current = nextArmor; setArmorHealth(nextArmor);
          if (nextArmor === 0) { setArmor(null); setMessage('Броня приняла удар и сломалась!'); } else if (hitMessage) setMessage(`${hitMessage} Броня получила ${amount} урона.`);
        } else if (second) setHealth2((current) => { const next = Math.max(0, current - amount); if (current > 0 && next === 0) { if (health <= 0) { setDead(true); keys.current.clear(); } else showTeammateFallen(); } if (hitMessage) setMessage(`${hitMessage} Второй игрок получил ${amount} урона.`); return next; });
        else setHealth((current) => { const next = Math.max(0, current - amount); if (current > 0 && next === 0) { if (players === 1 || health2 <= 0) { setDead(true); keys.current.clear(); setMessage('Тьма поглотила героя…'); } else showTeammateFallen(); } else if (hitMessage) setMessage(`${hitMessage} Получено ${amount} урона.`); return next; });
      };
      enemies.current.forEach((e) => {
        e.flash--; const distance1 = health > 0 ? Math.hypot(p.x - e.x, p.y - e.y) : Infinity; const distance2 = players === 2 && health2 > 0 ? Math.hypot(p2.x - e.x, p2.y - e.y) : Infinity; const targetsSecond = distance2 < distance1; const targetHero = targetsSecond ? p2 : p; const ex = targetHero.x - e.x, ey = targetHero.y - e.y, distance = Math.hypot(ex, ey);
        if (e.stunnedUntil > now) return;
        if (e.kind === 'boss' && e.leapStarted > 0) {
          if (now < e.leapUntil) return;
          e.x = e.leapTargetX; e.y = e.leapTargetY; e.leapStarted = 0; e.leapUntil = 0; e.nextLeapAt = now + 4500; e.attackUntil = now + 220;
          const hitSecond = players === 2 && Math.hypot(p2.x + 12 - e.x, p2.y + 14 - e.y) <= 80; if (Math.hypot(p.x + 12 - e.x, p.y + 14 - e.y) <= 80 || hitSecond) damageHero(e.power, 'Босс обрушился с неба и попал по герою!', hitSecond);
          else setMessage('Ты успел покинуть зону падения босса!');
          return;
        }
        if (e.kind === 'boss' && e.hp < e.maxHp / 2 && distance >= 192 && now >= e.nextLeapAt) {
          e.leapStarted = now; e.leapUntil = now + 1450; e.leapTargetX = targetHero.x; e.leapTargetY = targetHero.y; e.attackUntil = now + 380; setMessage('Босс прыгнул! Уходи из красного круга!'); return;
        }
        const contactDistance = e.kind === 'boss' ? 65 : 14;
        if (distance > contactDistance) {
          const enemySpeed = e.speed * dt; const dx = ex / distance; const dy = ey / distance;
          const wallGap = 32;
          const canMoveTo = (x: number, y: number) => {
            const outsideArena = map.round && Math.hypot(x + 14 - 320, y + 14 - 336) > 306;
            const outsideRoute = level !== 0 && !map.round && !isInsideFourWayRoute(x + 14, y + 14);
            const hitsWall = map.walls.slice(4).some((w) => x + 15 > w.x - wallGap && x - 3 < w.x + w.w + wallGap && y + 15 > w.y - wallGap && y - 3 < w.y + w.h + wallGap);
            const hitsCart = map.carts.some((cart) => x + 15 > cart.x - 5 - wallGap && x - 3 < cart.x + 45 + wallGap && y + 15 > cart.y - wallGap && y - 3 < cart.y + 36 + wallGap);
            return !outsideArena && !outsideRoute && !hitsWall && !hitsCart;
          };
          const directions = [{ x: dx, y: dy }, { x: -dy, y: dx }, { x: dy, y: -dx }, { x: dx * .7 - dy * .7, y: dy * .7 + dx * .7 }, { x: dx * .7 + dy * .7, y: dy * .7 - dx * .7 }];
          const next = directions.map((direction) => ({ x: e.x + direction.x * enemySpeed, y: e.y + direction.y * enemySpeed })).filter((point) => canMoveTo(point.x, point.y)).sort((a, b) => Math.hypot(targetHero.x - a.x, targetHero.y - a.y) - Math.hypot(targetHero.x - b.x, targetHero.y - b.y))[0];
          if (next) { e.x = next.x; e.y = next.y; }
        }
        const attackInterval = e.kind === 'boss' ? 1600 : 700;
        if (distance < (e.kind === 'boss' ? 75 : 16) && Math.floor(now / attackInterval) !== Math.floor((now - 17) / attackInterval)) {
          e.attackUntil = now + 220;
          damageHero(e.power, undefined, targetsSecond);
        }
      });
      const defeated = enemies.current.filter((e) => e.hp <= 0); enemies.current = enemies.current.filter((e) => e.hp > 0); if (defeated.length) { const reward = defeated.reduce((sum, e) => sum + (e.kind === 'boss' ? 100 : e.kind === 'goblin' ? 10 : 5), 0); setCoins((c) => c + reward); setMessage(defeated.some((e) => e.kind === 'boss') ? 'Великий гоблин повержен! Получено 100 осколков.' : defeated.some((e) => e.kind === 'goblin') ? 'Гоблин повержен и оставил 10 осколков.' : 'Слизень оставил несколько осколков.'); }
      if (level === 0) {
        const progressX = Math.max(p.x, players === 2 ? p2.x : p.x);
        const steps = [{ x: 330, text: 'Обойди телегу и пройди через пролом. Можно двигаться по диагонали.' }, { x: 590, text: 'Подойди к сундуку и нажми E. Второй игрок использует Ю.' }, { x: 900, text: 'Враг! SPACE — атака первого игрока, Ж — атака второго.' }, { x: 1190, text: 'Используй ульту: Q у первого игрока, Б у второго.' }, { x: 1500, text: 'Рюкзак: I у первого, Э у второго. У ворот нажми E или Ю.' }];
        if (tutorialStep.current < steps.length && progressX >= steps[tutorialStep.current].x) { setMessage(steps[tutorialStep.current].text); tutorialStep.current++; }
      }
      const secondInteracts = players === 2 && keys.current.has('Period'); const interactionHero = secondInteracts ? p2 : p;
      const nearChest = map.chests.findIndex((chest, index) => !openedChests.includes(index) && Math.hypot(chest.x + 24 - interactionHero.x, chest.y + 20 - interactionHero.y) < 75);
      if ((keys.current.has('KeyE') || secondInteracts) && nearChest >= 0 && !loot) { const chest = map.chests[nearChest]; const drop = chestDrops[nearChest]; itemPicker.current = secondInteracts ? 2 : 1; if (!secondInteracts) keys.current.delete('KeyE'); setOpenedChests((current) => [...current, nearChest]); setDroppedItem(drop.item); setLoot({ x: chest.x + 8, y: chest.y + 48 }); setMessage(`${drop.rarity.name} сундук: выпал предмет «${drop.item.name}»!`); }
      const playerOnePicks = loot && droppedItem && Math.hypot(loot.x - p.x, loot.y - p.y) < 42; const playerTwoPicks = loot && droppedItem && players === 2 && keys.current.has('Period') && Math.hypot(loot.x - p2.x, loot.y - p2.y) < 52;
      if (playerOnePicks || playerTwoPicks) { itemPicker.current = playerTwoPicks || itemPicker.current === 2 && !playerOnePicks ? 2 : 1; keys.current.clear(); setChoiceItem(droppedItem); }
      const nearFirstLevelPortal = level === 1 && p.x < 100 && Math.abs(p.y + 14 - getRouteStart().y) < 75; const secondNearFirstPortal = players === 2 && level === 1 && p2.x < 100 && Math.abs(p2.y + 14 - getRouteStart().y) < 75;
      if (keys.current.has('KeyE') && nearFirstLevelPortal || keys.current.has('Period') && secondNearFirstPortal) {
        keys.current.delete(secondNearFirstPortal && keys.current.has('Period') ? 'Period' : 'KeyE'); rerollLevel(6); const portalMap = getLevel(6); currentMap.current = portalMap; setLevel(6); setOpenedChests([]); setChestDrops([]); setLoot(null); setDroppedItem(null); setChoiceItem(null); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; hero.current = { x: 35, y: 322 }; hero2.current = { x: 65, y: 322 }; enemies.current = createEnemies(portalMap, enemyMultiplier); setMessage('Портал перенёс тебя на шестой уровень: Круг гоблинов.');
      }
      const bossDefeated = level === 6 && !enemies.current.some((enemy) => enemy.kind === 'boss'); const nearVictoryPortal = bossDefeated && Math.hypot(p.x - 320, p.y - 336) < 70; const secondNearVictoryPortal = players === 2 && bossDefeated && Math.hypot(p2.x - 320, p2.y - 336) < 70;
      if (keys.current.has('KeyE') && nearVictoryPortal || keys.current.has('Period') && secondNearVictoryPortal) { keys.current.clear(); setVictory(true); setMessage('Великий гоблин повержен. Подземелье спасено!'); }
      const routeExit = level === 0 ? { x: map.worldWidth - 70, y: 336 } : getRouteExit(); const nearExit = !map.round && Math.abs(p.x - routeExit.x) < 80 && Math.abs(p.y + 14 - routeExit.y) < 75; const secondNearExit = players === 2 && !map.round && Math.abs(p2.x - routeExit.x) < 80 && Math.abs(p2.y + 14 - routeExit.y) < 75;
      if (keys.current.has('KeyE') && nearExit || keys.current.has('Period') && secondNearExit) {
        keys.current.delete(secondNearExit && keys.current.has('Period') ? 'Period' : 'KeyE');
        if (level === 6) { setVictory(true); keys.current.clear(); setMessage('Все шесть уровней пройдены! Пепельное сердце спасено.'); }
        else { const next = level + 1; rerollLevel(next); const nextMap = getLevel(next); currentMap.current = nextMap; setLevel(next); setOpenedChests([]); setChestDrops(nextMap.chests.map(() => getRandomLoot(next))); setLoot(null); setDroppedItem(null); projectiles.current = []; superFists.current = []; swordUltimates.current = []; bowUltimates.current = []; staffUltimates.current = []; glovesUltimates.current = []; waves.current = []; hero.current = nextMap.round ? { x: 35, y: 322 } : getRouteStart(); hero2.current = nextMap.round ? { x: 65, y: 322 } : { ...getRouteStart(), y: getRouteStart().y + 32 }; enemies.current = createEnemies(nextMap, enemyMultiplier); setMessage(`Уровень ${next}: ${nextMap.name}. Враги стали сильнее!`); }
      }
      const attackProgress = attacking ? Math.max(0, (attackUntil.current - now) / 180) : 0;
      const attackProgress2 = attacking2 ? Math.max(0, (attackUntil2.current - now) / 180) : 0;
      drawScene(ctx, map, p, enemies.current, projectiles.current, superFists.current, swordUltimates.current, bowUltimates.current, staffUltimates.current, glovesUltimates.current, waves.current, now, openedChests, chestDrops, attackProgress, loot, droppedItem, level, weapon, weapon2, armor, facing.current, Boolean(dx || dy), health, superReloading, profileName, players === 2 ? p2 : null, facing2.current, Boolean(dx2 || dy2), health2, superReloading2, attackProgress2, explored.current); frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, [armor, chestDrops, choiceItem, dead, droppedItem, enemyMultiplier, health, health2, level, loot, openedChests, paused, players, profileName, showInventory, superReloading, superReloading2, victory, weapon, weapon2]);

  const visibleInventory = inventoryOwner === 2 ? inventory2 : inventory; const visibleCapacity = inventoryOwner === 2 ? inventoryCapacity2 : inventoryCapacity;
  return <section className="game-shell">
    <div className="hud">{armor && <span>🛡{armorHealth}</span>}<b>{weapon ? `${weapon.type === 'bow' ? '🏹' : weapon.type === 'staff' ? '✦' : weapon.type === 'gloves' ? '✊' : '⚔'} ${weapon.name.toUpperCase()} · ${weapon.damage}` : `ОСКОЛКИ ${coins}`}</b><span className={reloading ? 'reload busy' : 'reload'}>{reloading ? 'ПЕРЕЗАРЯДКА' : 'ГОТОВО'}</span><span>🎒 I {inventory.length}/{inventoryCapacity}{players === 2 ? ` · Э ${inventory2.length}/${inventoryCapacity2}` : ''}</span><span>LV {level}/6</span></div>
    <div className="canvas-stage"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      {teammateFallen && <div className="teammate-fallen">ВАШ ТИММЕЙТ ПАЛ</div>}
      {showInventory && <div className="inventory-panel"><div className="inventory-title"><div><small>РЮКЗАК · ИГРОК {inventoryOwner}</small><strong>{visibleInventory.length}/{visibleCapacity} МЕСТ</strong></div><button onClick={() => { keys.current.clear(); setShowInventory(false); }}>✕</button></div><div className="inventory-grid">{Array.from({ length: visibleCapacity }, (_, index) => { const item = visibleInventory[index]; return <button key={index} className={`inventory-slot ${item ? 'filled' : ''}`} onClick={() => item && equipInventoryItem(item)} title={item?.name}>{item ? <><span>{item.type === 'bow' ? '🏹' : item.type === 'staff' ? '🔮' : item.type === 'gloves' ? '✊' : item.type === 'armor' ? '🛡️' : '⚔️'}</span><small>{item.name}</small><b>{item.type === 'armor' ? `🛡${item.durability}` : `⚔${item.damage}`}</b></> : <i>{index + 1}</i>}</button>; })}</div><div className="inventory-footer"><span>ОСКОЛКИ: {coins}</span>{visibleCapacity < 30 ? <button onClick={upgradeInventory}>УЛУЧШИТЬ ДО {visibleCapacity === 10 ? 20 : 30} · {visibleCapacity === 10 ? 100 : 250}</button> : <b>МАКСИМУМ: 30</b>}</div></div>}
      {choiceItem && <div className="loot-choice"><div className="loot-icon">{choiceItem.type === 'bow' ? '🏹' : choiceItem.type === 'staff' ? '🔮' : choiceItem.type === 'gloves' ? '✊' : choiceItem.type === 'armor' ? '🛡️' : '⚔️'}</div><small>НАЙДЕН ПРЕДМЕТ</small><strong>{choiceItem.name}</strong><p>{choiceItem.type === 'armor' ? `Прочность: ${choiceItem.durability}` : `Урон: ${choiceItem.damage}`}</p><div><button onClick={acceptItem}>В РЮКЗАК</button><button className="secondary" onClick={rejectItem}>ОСТАВИТЬ</button></div></div>}
      {(dead || victory) && <div className="death-screen"><strong>{victory ? 'ПОЗДРАВЛЯЕМ!' : 'ТЫ ПАЛ'}</strong><p>{victory ? 'Великий гоблин повержен — все шесть подземелий пройдены!' : 'Пепельное сердце погасло'}</p><button onClick={restart}>{victory ? 'СЫГРАТЬ ЕЩЁ' : 'НАЧАТЬ ЗАНОВО'}</button></div>}
    </div><div className="dialogue"><i>✦</i><p>{message}</p></div>
  </section>;
}
