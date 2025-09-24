'use strict';

(function () {
  class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
      // --- Core tiles (already in your project) ---
      this.load.image('tile_path_clean',    'assets/tile_path_clean.png');
      this.load.image('tile_path_cleansed', 'assets/tile_path_cleansed.png');
      this.load.image('tile_path_corrupt',  'assets/tile_path_corrupt.png');

      // Optional: explicit rack tile artwork (recommended). If missing, code will fall back.
      this.load.image('rack_tile', 'assets/rack_tile.png');

      // --- Sprites / UI (large PNGs are fine; we size in code) ---
      this.load.image('defender',  'assets/defender.png');
      this.load.image('virus',     'assets/virus.png');
      this.load.image('btn_blink', 'assets/btn_blink.png');
      this.load.image('btn_clean', 'assets/btn_clean.png');
    }

    create() {
      // Go to Home if present; otherwise straight to Play.
      const hasHome = !!this.scene.manager.keys['Home'];
      this.scene.start(hasHome ? 'Home' : 'Play');
    }
  }

  window.BootScene = BootScene;
})();
