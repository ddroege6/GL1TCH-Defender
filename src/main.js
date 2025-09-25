'use strict';

// Scenes are exposed on window.* by each file below.
const scenes = [window.BootScene, window.HomeScene, window.PlayScene, window.DeathScene];

// Base canvas size; we use RESIZE so your scene code stays responsive.
const BASE_W = 1280;
const BASE_H = 720;

const config = {
  type: Phaser.AUTO,
  width: BASE_W,
  height: BASE_H,
  backgroundColor: '#0b1118',

  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },

  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },

  input: { keyboard: true, mouse: true, touch: true, gamepad: false },

  scene: scenes,
};

window.addEventListener('load', () => {
  const game = new Phaser.Game(config);

  // Prevent mobile rubber-banding while touching the canvas.
  document.body.addEventListener(
    'touchmove',
    (e) => { if (e.target && e.target.tagName === 'CANVAS') e.preventDefault(); },
    { passive: false }
  );

  // Handle live DPR changes.
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq && mq.addEventListener?.('change', () => {
    game.renderer.resize(game.scale.gameSize.width, game.scale.gameSize.height);
  });
});
