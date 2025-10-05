'use strict';

(function () {
  // Simple, robust asset preloader. Adjust GL1TCH_ASSET_BASE / GL1TCH_ASSET_MAP if your files differ.
  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
      const BASE = (window.GL1TCH_ASSET_BASE || 'assets').replace(/\/+$/, '');
      const MAP = Object.assign({
        defender: 'defender.png',
        virus: 'virus.png',
        rack_tile: 'rack_tile.png',
        tile_path_clean: 'tile_path_clean.png',
        tile_path_corrupt: 'tile_path_corrupt.png',
        tile_path_cleansed: 'tile_path_cleansed.png',
      }, (window.GL1TCH_ASSET_MAP || {}));

      const w = this.scale.gameSize.width, h = this.scale.gameSize.height;
      const txt = this.add.text(w/2, h/2, 'Loading… 0%', { fontFamily:'monospace', fontSize:16, color:'#a8e1ff' }).setOrigin(0.5);
      this.load.on('progress', p => txt.setText(`Loading… ${Math.round(p*100)}%`));
      this.load.on('loaderror', f => console.warn('[Boot] Failed:', f.key, f.src));
      this.load.once('complete', () => this.scene.start('HomeScene'));

      this.load.setPath(BASE);
      for (const [key, file] of Object.entries(MAP)) this.load.image(key, file);
    }
  }

  window.BootScene = BootScene;
})();
