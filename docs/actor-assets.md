# CampActorSprites

`dist/actor-sprites.js` is an original, procedural SVG actor renderer for the
camp game. It has no remote requests and does not read or write `WorldFacts`.
It can be loaded before the game bundle and is exposed as:

```js
globalThis.CampActorSprites.render({
  kind: 'player',       // player | npc | zombie
  key: 'farmer',        // role, NPC id, or zombie type
  facing: 'down',       // up | down | left | right
  action: 'walk',       // idle | walk | work | attack | hurt | rest
  frame: 1              // 0..3; values wrap deterministically
});
```

The return value is a complete SVG string with a `16 24` viewBox. Every
direction and action keeps the same foot anchor at `(8, 23)`, so changing the
visual frame never changes the actor collider. NPC keys containing a known
role (for example `npc-carpenter-01`) select that role palette. Zombie keys
select `normal`, `runner`, or `brute` palettes.

The current art is authored in this file as small pixel primitives. It is
intended as a license-safe baseline while the game remains a single static
site. If external art is added later, preserve the same API and keep a
machine-readable credit file with the selected asset licenses.

