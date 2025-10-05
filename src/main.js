'use strict';

(function () {
  const BASE_W = 1280;
  const BASE_H = 720;

  window.addEventListener('load', () => {
    const config = {
      type: Phaser.AUTO,
      width: BASE_W,
      height: BASE_H,
      backgroundColor: '#0b1118',
      render: { pixelArt: true, antialias: false, roundPixels: true, powerPreference: 'high-performance' },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
      physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
      // ✅ keyboard + mouse + touch + controller
      input: { keyboard: true, mouse: true, touch: true, gamepad: true },
      scene: []
    };

    const game = new Phaser.Game(config);

    const addIf = (key, ctor, autoStart = false) => {
      if (ctor && !game.scene.keys[key]) game.scene.add(key, ctor, autoStart);
    };

    // Register scenes deterministically; Boot preloads art then shows Home
    addIf('BootScene',  window.BootScene,  false);
    addIf('HomeScene',  window.HomeScene,  false);
    addIf('PlayScene',  window.PlayScene,  false);

    game.scene.start('BootScene');

    // Prevent mobile rubber-banding while touching the canvas
    document.body.addEventListener('touchmove', (e) => {
      if (e.target && e.target.tagName === 'CANVAS') e.preventDefault();
    }, { passive: false });
  });
})();
