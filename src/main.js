'use strict';

// If your scenes are global (window.BootScene / window.PlayScene), just reference them here.
// If you are using modules, import them instead.
const scenes = [window.BootScene, window.PlayScene];

// Recommended base size; we'll use RESIZE mode so the canvas adapts to the window.
const BASE_W = 1280;
const BASE_H = 720;

const config = {
  type: Phaser.AUTO,
  width: BASE_W,
  height: BASE_H,
  backgroundColor: '#0b1118',

  // Crisp pixel art + performance-friendly renderer
  render: {
    pixelArt: true,       // nearest-neighbor scaling
    antialias: false,
    roundPixels: true,
    powerPreference: 'high-performance',
  },

  // Make the game fill the browser window while keeping your scene code responsive.
  // Your scenes already use this.scale.gameSize.*, so they adapt automatically.
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,       // set true temporarily if you want to visualize bodies
    },
  },

  fps: {
    target: 60,
    min: 30,
    forceSetTimeOut: true, // better battery behavior on laptops
  },

  input: {
    keyboard: true,
    gamepad: true,
    mouse: true,
    touch: true,
  },

  scene: scenes,
};

window.addEventListener('load', () => {
  // Create the game instance.
  const game = new Phaser.Game(config);

  // Optional: prevent browser touch scrolling on mobile while interacting with the canvas.
  document.body.addEventListener('touchmove', (e) => {
    if (e.target && e.target.tagName === 'CANVAS') e.preventDefault();
  }, { passive: false });

  // Optional: handle DPR changes live (e.g., when moving a window between monitors).
  const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  if (mediaQuery && mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', () => {
      game.renderer.resize(game.scale.gameSize.width, game.scale.gameSize.height);
    });
  }
});
