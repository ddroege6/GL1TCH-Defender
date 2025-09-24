'use strict';

// If your scenes are exposed on window, just reference them here.
const scenes = [window.BootScene, window.HomeScene, window.PlayScene, window.DeathScene];

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
    arcade: { gravity: { y: 0 }, debug: false },
  },
  fps: { target: 60, min: 30, forceSetTimeOut: true },
  input: { keyboard: true, gamepad: true, mouse: true, touch: true },
  scene: scenes,
};

window.addEventListener('load', () => {
  const game = new Phaser.Game(config);

  // Prevent scroll on touch-canvas
  document.body.addEventListener('touchmove', (e) => {
    if (e.target && e.target.tagName === 'CANVAS') e.preventDefault();
  }, { passive: false });
});
