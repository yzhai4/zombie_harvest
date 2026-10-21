/*
 * CampActorSprites
 * ----------------
 * A tiny, self-contained pixel actor renderer for the camp prototype.
 *
 * The art is original procedural SVG data. It intentionally has no image
 * requests, no game-state dependency, and no mutable world state. The
 * renderer returns a complete 16x24 SVG with a shared foot anchor at (8, 23)
 * so the same collider can be used for every direction and action.
 */
(function installCampActorSprites(root) {
  'use strict';

  const DIRECTIONS = Object.freeze(['up', 'down', 'left', 'right']);
  const ACTIONS = Object.freeze(['idle', 'walk', 'work', 'attack', 'hurt', 'rest']);
  const KINDS = Object.freeze(['player', 'npc', 'zombie']);
  const FRAME_COUNT = 4;
  const VIEWBOX = '0 0 16 24';
  const cache = new Map();

  const PALETTES = Object.freeze({
    player: Object.freeze({
      farmer: Object.freeze({ outline: '#1d2830', skin: '#e1a479', hair: '#49362e', cloth: '#d9a94f', clothDark: '#9c6c35', accent: '#7fa15b', tool: '#b8c2bc' })
    }),
    npc: Object.freeze({
      default: Object.freeze({ outline: '#1d2830', skin: '#d99a74', hair: '#3b302f', cloth: '#6d9b72', clothDark: '#41634f', accent: '#b6d36d', tool: '#b8c2bc' }),
      carpenter: Object.freeze({ outline: '#242b30', skin: '#d99a74', hair: '#51382d', cloth: '#b87743', clothDark: '#70422b', accent: '#f0c85b', tool: '#c4cbd0' }),
      doctor: Object.freeze({ outline: '#1d2830', skin: '#e0aa84', hair: '#5d4038', cloth: '#d8e3d3', clothDark: '#88a18e', accent: '#d86767', tool: '#dce6e4' }),
      commander: Object.freeze({ outline: '#202530', skin: '#d9a078', hair: '#302a32', cloth: '#5b6e9c', clothDark: '#354263', accent: '#e2c368', tool: '#c7d0d6' }),
      guard: Object.freeze({ outline: '#1c2930', skin: '#cc8d6b', hair: '#332a2c', cloth: '#526f80', clothDark: '#324858', accent: '#d6bb63', tool: '#b9c5cc' }),
      sergeant: Object.freeze({ outline: '#1d252d', skin: '#d89d77', hair: '#42372f', cloth: '#896d54', clothDark: '#554332', accent: '#d9a94f', tool: '#c4cbd0' }),
      radio: Object.freeze({ outline: '#20262c', skin: '#e0a47c', hair: '#3d3130', cloth: '#9168a7', clothDark: '#593d6b', accent: '#8ee2e5', tool: '#c9d0ca' }),
      quartermaster: Object.freeze({ outline: '#202a30', skin: '#d59670', hair: '#46352c', cloth: '#8b9e6d', clothDark: '#526345', accent: '#e7b66d', tool: '#c4b58e' }),
      cook: Object.freeze({ outline: '#22282f', skin: '#dfaa83', hair: '#46312b', cloth: '#c77969', clothDark: '#82483f', accent: '#f1dfc0', tool: '#e7e1ca' })
    }),
    zombie: Object.freeze({
      normal: Object.freeze({ outline: '#20242c', skin: '#76916f', skinDark: '#4f6958', cloth: '#6b5b6f', clothDark: '#473d50', accent: '#cadb9e', eye: '#e5bb58' }),
      runner: Object.freeze({ outline: '#292126', skin: '#b46d53', skinDark: '#75443e', cloth: '#7f4f55', clothDark: '#4c303b', accent: '#ffd36f', eye: '#f1c75e' }),
      brute: Object.freeze({ outline: '#272231', skin: '#806c9e', skinDark: '#56476f', cloth: '#554c76', clothDark: '#342d4e', accent: '#e3c3ff', eye: '#e2abff' })
    })
  });

  function safeKey(value) {
    return String(value || 'default').trim().toLowerCase();
  }

  function safeFacing(value) {
    return DIRECTIONS.includes(value) ? value : 'down';
  }

  function safeAction(value) {
    return ACTIONS.includes(value) ? value : 'idle';
  }

  function safeFrame(value) {
    const number = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
    return ((number % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
  }

  function paletteFor(kind, key) {
    const group = PALETTES[kind] || PALETTES.npc;
    const normalized = safeKey(key);
    if (group[normalized]) return group[normalized];
    // NPC IDs often contain their role (for example npc-carpenter-01).
    const role = Object.keys(group).find(name => normalized.includes(name));
    return group[role] || group.default || Object.values(group)[0];
  }

  function createCanvas() {
    return { rects: [], attrs: [] };
  }

  function rect(canvas, x, y, width, height, fill, options = {}) {
    if (!fill || width <= 0 || height <= 0) return;
    const values = [x, y, width, height].map(Number);
    if (values.some(value => !Number.isFinite(value))) return;
    canvas.rects.push(`<rect x="${values[0]}" y="${values[1]}" width="${values[2]}" height="${values[3]}" fill="${fill}"${options.opacity ? ` opacity="${options.opacity}"` : ''}/>`.replace(/\s+/g, ' '));
  }

  function transformX(facing, x, width = 1) {
    return facing === 'right' ? 16 - x - width : x;
  }

  function bodyRect(canvas, facing, x, y, width, height, fill, options) {
    rect(canvas, transformX(facing, x, width), y, width, height, fill, options);
  }

  function line(canvas, facing, x1, y1, x2, y2, fill, options = {}) {
    // All art is pixel aligned. A short horizontal/vertical run is more
    // readable than a diagonal SVG line after nearest-neighbour scaling.
    if (y1 === y2) {
      const x = Math.min(x1, x2);
      bodyRect(canvas, facing, x, y1, Math.abs(x2 - x1) + 1, 1, fill, options);
    } else if (x1 === x2) {
      const y = Math.min(y1, y2);
      bodyRect(canvas, facing, x1, y, 1, Math.abs(y2 - y1) + 1, fill, options);
    }
  }

  function animationOffset(action, frame) {
    if (action === 'walk') return frame % 2 === 0 ? 0 : 1;
    if (action === 'idle') return frame === 1 ? -1 : frame === 3 ? 1 : 0;
    if (action === 'hurt') return frame < 2 ? -1 : 0;
    return 0;
  }

  function drawHumanoid(canvas, kind, palette, facing, action, frame, key, appearance = {}) {
    const offset = animationOffset(action, frame);
    const outline = palette.outline;
    const side = facing === 'left' || facing === 'right';
    const seated = action === 'rest';
    const hurt = action === 'hurt';
    const cloth = hurt ? '#b45151' : palette.cloth;
    const clothDark = palette.clothDark;
    const skin = hurt ? '#e06a6a' : palette.skin;
    const hair = palette.hair;
    const accent = palette.accent;
    const equipment = appearance.equipment || {};
    const hairStyle = appearance.hairStyle || 'short';
    const bodyType = appearance.bodyType || 'standard';
    const equipmentColor = palette.tool || '#c4cbd0';

    // Shadow keeps the sprite grounded without changing the collider.
    rect(canvas, 4, 22, 8, 1, '#10171b', { opacity: '0.42' });

    if (seated) {
      bodyRect(canvas, facing, 4, 7, 8, 2, outline);
      bodyRect(canvas, facing, 5, 8, 6, 6, cloth);
      bodyRect(canvas, facing, 5, 13, 6, 2, clothDark);
      bodyRect(canvas, facing, 4, 15, 3, 3, cloth);
      bodyRect(canvas, facing, 9, 15, 3, 3, cloth);
      bodyRect(canvas, facing, 3, 18, 4, 2, outline);
      bodyRect(canvas, facing, 9, 18, 4, 2, outline);
      bodyRect(canvas, facing, 5, 3, 6, 4, skin);
      bodyRect(canvas, facing, 4, 4, 8, 3, hair);
      drawHeadStyle(canvas, facing, hairStyle, hair, accent);
      if (facing === 'down') {
        bodyRect(canvas, facing, 5, 6, 1, 1, outline);
        bodyRect(canvas, facing, 10, 6, 1, 1, outline);
      }
      bodyRect(canvas, facing, 6, 14, 4, 1, accent);
      return;
    }

    // Head and neck. Up has a hair/back-of-head block; down has two tiny eyes.
    bodyRect(canvas, facing, side ? 5 : 4, 2 + offset, side ? 6 : 8, 1, outline);
    bodyRect(canvas, facing, side ? 5 : 4, 3 + offset, side ? 6 : 8, 4, skin);
    bodyRect(canvas, facing, side ? 5 : 4, 3 + offset, side ? 6 : 8, 1, hair);
    bodyRect(canvas, facing, side ? 5 : 4, 4 + offset, side ? 1 : 2, 2, hair);
    if (facing === 'up') bodyRect(canvas, facing, 5, 4 + offset, 6, 2, hair);
    drawHeadStyle(canvas, facing, hairStyle, hair, accent, offset);
    if (facing === 'down') {
      bodyRect(canvas, facing, 5, 5 + offset, 1, 1, outline);
      bodyRect(canvas, facing, 10, 5 + offset, 1, 1, outline);
    }
    bodyRect(canvas, facing, side ? 7 : 6, 7 + offset, side ? 3 : 4, 2, skin);

    // Torso and belt.
    bodyRect(canvas, facing, side ? 5 : 3, 8 + offset, side ? 7 : bodyType === 'broad' ? 11 : 10, 7, outline);
    bodyRect(canvas, facing, side ? 6 : 4, 9 + offset, side ? 5 : bodyType === 'broad' ? 9 : 8, 5, cloth);
    bodyRect(canvas, facing, side ? 6 : 4, 13 + offset, side ? 5 : 8, 2, clothDark);
    bodyRect(canvas, facing, side ? 8 : 5, 10 + offset, side ? 2 : 3, 2, accent);

    // Arms: the active hand and tool tell the player what a worker is doing.
    const armY = action === 'attack' ? 9 + (frame < 2 ? -1 : 1) : 10 + offset;
    if (side) {
      bodyRect(canvas, facing, 4, armY, 3, 2, skin);
      bodyRect(canvas, facing, 10, armY + (action === 'work' ? 1 : 0), 2, 3, skin);
    } else {
      bodyRect(canvas, facing, 2, armY, 2, 4, skin);
      bodyRect(canvas, facing, 12, armY, 2, 4, skin);
    }

    // Legs keep the bottom-most pixel at y=23 in every pose.
    const step = action === 'walk' ? (frame % 2 === 0 ? -1 : 1) : 0;
    bodyRect(canvas, facing, side ? 6 : 4, 15 + offset, 3, 5, clothDark);
    bodyRect(canvas, facing, side ? 9 : 9, 15 + offset, 3, 5, clothDark);
    bodyRect(canvas, facing, side ? 5 + step : 3 + step, 20, 4, 3, outline);
    bodyRect(canvas, facing, side ? 9 - step : 9 - step, 20, 4, 3, outline);

    if (action === 'work') {
      const toolX = side ? 12 : 13;
      const toolY = frame % 2 === 0 ? 7 : 10;
      line(canvas, facing, toolX, toolY, toolX, 18, palette.tool || '#c4cbd0');
      bodyRect(canvas, facing, toolX - 1, toolY - 1, 3, 2, palette.tool || '#c4cbd0');
      bodyRect(canvas, facing, toolX - 1, 18, 3, 1, outline);
    }
    if (action === 'attack') {
      const weapon = palette.tool || '#c4cbd0';
      const swing = frame < 2 ? 0 : 2;
      if (side) {
        line(canvas, facing, 10, 8 - swing, 14, 12 + swing, weapon);
        bodyRect(canvas, facing, 13, 11 + swing, 2, 2, accent);
      } else {
        line(canvas, facing, 7 + swing, 8, 12 - swing, 4, weapon);
        bodyRect(canvas, facing, 11 - swing, 3, 2, 2, accent);
      }
    }
    if (kind === 'npc' && safeKey(key).includes('radio')) {
      bodyRect(canvas, facing, side ? 3 : 11, 11 + offset, 2, 3, palette.tool || '#c9d0ca');
      bodyRect(canvas, facing, side ? 3 : 11, 10 + offset, 2, 1, accent);
    }
    drawNpcEquipment(canvas, facing, action, frame, equipment, accent, equipmentColor, clothDark, offset);
  }

  function drawHeadStyle(canvas, facing, style, hair, accent, offset = 0) {
    if (style === 'spiky') {
      bodyRect(canvas, facing, 4, 1 + offset, 2, 2, hair);
      bodyRect(canvas, facing, 7, 0 + offset, 2, 3, hair);
      bodyRect(canvas, facing, 10, 1 + offset, 2, 2, hair);
    } else if (style === 'bun') {
      bodyRect(canvas, facing, 3, 2 + offset, 2, 4, hair);
      bodyRect(canvas, facing, 10, 0 + offset, 3, 3, hair);
    } else if (style === 'tie') {
      bodyRect(canvas, facing, 4, 2 + offset, 2, 6, hair);
      bodyRect(canvas, facing, 10, 2 + offset, 2, 5, hair);
    } else if (style === 'braid') {
      bodyRect(canvas, facing, 3, 3 + offset, 2, 8, hair);
      bodyRect(canvas, facing, 2, 10 + offset, 2, 2, hair);
    } else if (style === 'long') {
      bodyRect(canvas, facing, 3, 3 + offset, 2, 7, hair);
      bodyRect(canvas, facing, 11, 3 + offset, 2, 7, hair);
    } else if (style === 'cropped') {
      bodyRect(canvas, facing, 5, 2 + offset, 6, 1, hair);
    } else if (style === 'sidePart') {
      bodyRect(canvas, facing, 4, 2 + offset, 4, 1, hair);
      bodyRect(canvas, facing, 10, 3 + offset, 2, 2, hair);
    } else if (style === 'hood') {
      bodyRect(canvas, facing, 3, 1 + offset, 10, 2, '#433c56');
    } else if (style === 'beanie') {
      bodyRect(canvas, facing, 4, 1 + offset, 8, 2, '#41515d');
    } else if (style === 'headscarf') {
      bodyRect(canvas, facing, 4, 1 + offset, 8, 2, '#e7e1ca');
    }
    if (style === 'redScarf') bodyRect(canvas, facing, 4, 8 + offset, 8, 1, accent);
  }

  function drawNpcEquipment(canvas, facing, action, frame, equipment, accent, metal, clothDark, offset) {
    const tool = equipment.tool || equipment.weapon || 'none';
    const back = equipment.back;
    const head = equipment.head;
    if (back === 'radioPack') {
      bodyRect(canvas, facing, 1, 9 + offset, 2, 6, '#53656b');
      bodyRect(canvas, facing, 1, 7 + offset, 1, 3, accent);
    } else if (back === 'medicalPack') {
      bodyRect(canvas, facing, 1, 10 + offset, 2, 5, '#e4ece3');
      bodyRect(canvas, facing, 1, 11 + offset, 2, 1, '#d86767');
    } else if (back === 'cargoPack' || back === 'fieldPack' || back === 'toolRoll' || back === 'smallPack' || back === 'basket') {
      bodyRect(canvas, facing, 1, 10 + offset, 2, 5, clothDark);
    }
    if (head === 'helmet') bodyRect(canvas, facing, 3, 1 + offset, 10, 2, '#8d9ca0');
    if (head === 'beanie') bodyRect(canvas, facing, 4, 1 + offset, 8, 2, '#41515d');
    if (head === 'hood') bodyRect(canvas, facing, 3, 1 + offset, 10, 5, '#433c56', { opacity: '0.88' });
    if (head === 'headscarf') bodyRect(canvas, facing, 4, 1 + offset, 8, 2, '#e7e1ca');
    if (tool === 'hammer') {
      line(canvas, facing, 13, 8, 13, 18, metal);
      bodyRect(canvas, facing, 11, 7, 4, 2, '#d59152');
    } else if (tool === 'medkit') {
      bodyRect(canvas, facing, 12, 11, 3, 3, '#e4ece3');
      bodyRect(canvas, facing, 13, 11, 1, 3, '#d86767');
      bodyRect(canvas, facing, 12, 12, 3, 1, '#d86767');
    } else if (tool === 'rifle') {
      line(canvas, facing, 11, 8, 11, 19, metal);
      bodyRect(canvas, facing, 10, 8, 3, 2, '#3b464c');
    } else if (tool === 'shield') {
      bodyRect(canvas, facing, 1, 10, 3, 5, '#79d0df');
      bodyRect(canvas, facing, 2, 11, 1, 3, '#314d5b');
    } else if (tool === 'spear') {
      line(canvas, facing, 13, 5, 13, 20, metal);
      bodyRect(canvas, facing, 12, 4, 3, 2, '#ee8a78');
    } else if (tool === 'flashlight') {
      bodyRect(canvas, facing, 12, 10, 2, 4, metal);
      bodyRect(canvas, facing, 13, 10, 2, 1, '#ffd45c');
    } else if (tool === 'ledger') {
      bodyRect(canvas, facing, 12, 10, 3, 4, '#e7b66d');
      bodyRect(canvas, facing, 13, 11, 1, 1, '#7f6043');
    } else if (tool === 'ladle') {
      line(canvas, facing, 13, 8, 13, 18, '#e7e1ca');
      bodyRect(canvas, facing, 12, 7, 3, 2, '#f1dfc0');
    } else if (tool === 'clipboard') {
      bodyRect(canvas, facing, 12, 10, 3, 4, '#e2c368');
      bodyRect(canvas, facing, 13, 9, 1, 1, '#5b6e9c');
    } else if (equipment.offhand === 'compass' || equipment.offhand === 'whistle' || equipment.offhand === 'headset') {
      bodyRect(canvas, facing, 1, 11 + offset, 2, 2, accent);
    }
  }

  function drawZombie(canvas, palette, facing, action, frame) {
    const offset = animationOffset(action, frame);
    const side = facing === 'left' || facing === 'right';
    const outline = palette.outline;
    const skin = action === 'hurt' ? '#cf655f' : palette.skin;
    const skinDark = palette.skinDark;
    const cloth = palette.cloth;
    const clothDark = palette.clothDark;
    const eye = palette.eye || palette.accent;
    const lurch = action === 'attack' ? (frame < 2 ? -1 : 1) : 0;

    rect(canvas, 3, 22, 10, 1, '#10171b', { opacity: '0.48' });
    if (action === 'rest') {
      bodyRect(canvas, facing, 3, 10, 10, 3, outline);
      bodyRect(canvas, facing, 4, 11, 8, 5, cloth);
      bodyRect(canvas, facing, 3, 16, 4, 3, skinDark);
      bodyRect(canvas, facing, 9, 16, 4, 3, skinDark);
      bodyRect(canvas, facing, 4, 3, 8, 5, skin);
      bodyRect(canvas, facing, 3, 3, 10, 2, outline);
      bodyRect(canvas, facing, 5, 6, 1, 1, eye);
      bodyRect(canvas, facing, 10, 6, 1, 1, eye);
      return;
    }

    const headX = side ? 5 : 3;
    const headWidth = side ? 7 : 10;
    bodyRect(canvas, facing, headX, 2 + offset, headWidth, 1, outline);
    bodyRect(canvas, facing, headX, 3 + offset, headWidth, 5, skin);
    bodyRect(canvas, facing, headX - (side ? 0 : 1), 3 + offset, headWidth + (side ? 0 : 2), 1, outline);
    bodyRect(canvas, facing, side ? 5 : 3, 7 + offset, side ? 6 : 10, 2, skinDark);
    if (facing === 'down') {
      bodyRect(canvas, facing, 5, 5 + offset, 2, 1, eye);
      bodyRect(canvas, facing, 9, 5 + offset, 2, 1, eye);
    } else if (facing === 'up') {
      bodyRect(canvas, facing, 5, 4 + offset, 6, 2, skinDark);
    } else {
      bodyRect(canvas, facing, 10, 5 + offset, 1, 1, eye);
    }

    bodyRect(canvas, facing, side ? 4 : 2, 9 + offset, side ? 8 : 12, 7, outline);
    bodyRect(canvas, facing, side ? 5 : 3, 10 + offset, side ? 6 : 10, 5, cloth);
    bodyRect(canvas, facing, side ? 5 : 3, 14 + offset, side ? 6 : 10, 2, clothDark);

    const armY = action === 'attack' ? 9 + lurch : 11 + offset;
    bodyRect(canvas, facing, side ? 3 : 1, armY, side ? 3 : 3, 3, skin);
    bodyRect(canvas, facing, side ? 11 : 12, armY + (action === 'attack' ? -1 : 1), side ? 3 : 3, 3, skin);
    const step = action === 'walk' ? (frame % 2 === 0 ? -1 : 1) : 0;
    bodyRect(canvas, facing, side ? 5 : 3, 16 + offset, 4, 5, skinDark);
    bodyRect(canvas, facing, side ? 9 : 9, 16 + offset, 4, 5, skinDark);
    bodyRect(canvas, facing, side ? 4 + step : 2 + step, 20, 5, 3, outline);
    bodyRect(canvas, facing, side ? 9 - step : 9 - step, 20, 5, 3, outline);

    if (action === 'attack') {
      bodyRect(canvas, facing, side ? 12 : 11, 7 + lurch, 3, 2, skin);
      bodyRect(canvas, facing, side ? 13 : 12, 6 + lurch, 2, 1, eye);
    }
    if (action === 'hurt') {
      bodyRect(canvas, facing, side ? 6 : 5, 11, 2, 2, '#f2d28e');
      bodyRect(canvas, facing, side ? 9 : 9, 13, 2, 1, '#f2d28e');
    }
  }

  function render(options = {}) {
    const kind = KINDS.includes(options.kind) ? options.kind : 'npc';
    const key = safeKey(options.key || (kind === 'player' ? 'farmer' : kind === 'zombie' ? 'normal' : 'default'));
    const facing = safeFacing(options.facing);
    const action = safeAction(options.action);
    const frame = safeFrame(options.frame);
    const appearance = options.appearance || {};
    const equipmentKey = kind === 'npc' ? JSON.stringify({ revision: appearance.revision || 1, hair: appearance.hair, hairStyle: appearance.hairStyle, equipment: appearance.equipment || {} }) : '';
    const cacheKey = `${kind}|${key}|${facing}|${action}|${frame}|${equipmentKey}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const canvas = createCanvas();
    const palette = { ...paletteFor(kind, key), ...(appearance.palette || {}), ...(appearance.skin ? { skin: appearance.skin } : {}), ...(appearance.hair ? { hair: appearance.hair } : {}) };
    if (kind === 'zombie') drawZombie(canvas, palette, facing, action, frame);
    else drawHumanoid(canvas, kind, palette, facing, action, frame, key, appearance);

    const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="16" height="24" shape-rendering="crispEdges" data-actor-kind="${kind}" data-actor-key="${key}" data-facing="${facing}" data-action="${action}" data-frame="${frame}">${canvas.rects.join('')}</svg>`;
    cache.set(cacheKey, markup);
    return markup;
  }

  const api = Object.freeze({
    render,
    directions: DIRECTIONS,
    actions: ACTIONS,
    kinds: KINDS,
    frameCount: FRAME_COUNT,
    clearCache() { cache.clear(); }
  });
  root.CampActorSprites = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

