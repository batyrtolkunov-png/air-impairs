export type ControlAction = 'p1Up'|'p1Down'|'p1Left'|'p1Right'|'p1Attack'|'p1Interact'|'p1Ultimate'|'p1Inventory'|'p1Heal'|'p2Up'|'p2Down'|'p2Left'|'p2Right'|'p2Attack'|'p2Interact'|'p2Ultimate'|'p2Inventory'|'p2Heal';
export type KeyBindings = Record<ControlAction,string>;
export const DEFAULT_KEY_BINDINGS: KeyBindings = { p1Up:'KeyW',p1Down:'KeyS',p1Left:'KeyA',p1Right:'KeyD',p1Attack:'Space',p1Interact:'KeyE',p1Ultimate:'KeyQ',p1Inventory:'KeyI',p1Heal:'KeyH',p2Up:'ArrowUp',p2Down:'ArrowDown',p2Left:'ArrowLeft',p2Right:'ArrowRight',p2Attack:'Semicolon',p2Interact:'Period',p2Ultimate:'Comma',p2Inventory:'Quote',p2Heal:'KeyL' };
export const CONTROL_GROUPS: Array<{title:string;actions:Array<{id:ControlAction;label:string}>}> = [
  {title:'ИГРОК 1',actions:[['p1Up','Вверх'],['p1Down','Вниз'],['p1Left','Влево'],['p1Right','Вправо'],['p1Attack','Атака'],['p1Interact','Подбор / дверь'],['p1Ultimate','Ульта'],['p1Inventory','Рюкзак'],['p1Heal','Лечение']].map(([id,label])=>({id:id as ControlAction,label}))},
  {title:'ИГРОК 2',actions:[['p2Up','Вверх'],['p2Down','Вниз'],['p2Left','Влево'],['p2Right','Вправо'],['p2Attack','Атака'],['p2Interact','Подбор / дверь'],['p2Ultimate','Ульта'],['p2Inventory','Рюкзак'],['p2Heal','Лечение']].map(([id,label])=>({id:id as ControlAction,label}))},
];
export const CANONICAL_CONTROL_CODES: KeyBindings = {...DEFAULT_KEY_BINDINGS};
export function readableKey(code:string){return code.replace(/^Key/,'').replace(/^Digit/,'').replace('Arrow','СТРЕЛКА ').replace('Space','ПРОБЕЛ').replace('Semicolon','Ж / ;').replace('Period','Ю / .').replace('Comma','Б / ,').replace('Quote','Э / \'');}
