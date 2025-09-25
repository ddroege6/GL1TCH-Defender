'use strict';

(function () {
  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
      // --- Art assets (use whatever paths you keep in /assets) ---
      // Background for Home screen
      this.load.image('home_bg', 'assets/GL1TCH cover new.png');

      // Tiles
      this.load.image('tile_path_clean',    'assets/tile_path_clean.png');
      this.load.image('tile_path_corrupt',  'assets/tile_path_corrupt.png');
      this.load.image('tile_path_cleansed', 'assets/tile_path_cleansed.png');

      // Optional rack tile (falls back to generated if missing)
      this.load.image('rack_tile', 'assets/rack_tile.png');

      // Characters (falls back to generated if missing)
      this.load.image('defender', 'assets/defender.png');
      this.load.image('virus',    'assets/virus.png');
    }

    create() {
      // Go straight to Home
      this.scene.start('HomeScene');
    }
  }

  window.BootScene = BootScene;
})();
