// Critter config for the home page — placeholder sprites; swap once drawn.
// Lives in its own file (not inline) because the pages' CSP is script-src 'self':
// an inline block is silently dropped, and the critters never appear.
// Frame paths resolve relative to critters.js (assets/js/) — see that file.
//
// HIDDEN FOR NOW — the bouncing placeholder critters (cat + frog) are turned
// off. critters.js no-ops on an empty list, so no layers spawn and nothing
// animates. To bring them back, restore the array below (and draw real sprites).
window.CRITTERS = [];

/* Kept for a one-line restore:
window.CRITTERS = [
    { id: 'cat', anchor: 'background', motion: 'sway', size: 88,
      at: { right: '4vw', bottom: '5vh' },
      frames: ['../critters/cat-placeholder.svg'] },
    { id: 'frog', anchor: 'edge', target: '.drawn-frame', corner: 'top-right',
      motion: 'bob', size: 42,
      frames: ['../critters/frog-placeholder.svg'] }
];
*/
