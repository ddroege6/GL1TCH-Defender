'use strict';

(function () {
  // Only check that assets exist (not dimensions). Tiles will be scaled at render time.
  const ASSETS = [
    { key: 'tilePathClean',    path: 'assets/tile_path_clean.png'     },
    { key: 'tilePathCorrupt',  path: 'assets/tile_path_corrupt.png'   },
    { key: 'tilePathCleansed', path: 'assets/tile_path_cleansed.png'  },
    { key: 'tileWall',         path: 'assets/tile_wall.png'           },
    { key: 'defenderTex',      path: 'assets/defender.png'            },
    { key: 'virusTex',         path: 'assets/virus.png'               },
    // Optional mobile buttons
    { key: 'btnA',             path: 'assets/btn_blink.png',  optional: true },
    { key: 'btnB',             path: 'assets/btn_clean.png',  optional: true },
  ];

  class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
      // Helpful error logs
      this.load.on('loaderror', (file) => {
        console.error(`[ASSET ERROR] Could not load: ${file.key} (${file.src})`);
      });

      // Load everything (add cache-buster while iterating)
      const v = Date.now();
      for (const a of ASSETS) this.load.image(a.key, `${a.path}?v=${v}`);
    }

    create() {
      // If any required asset didn’t load, generate safe fallback so we never black-screen.
      const missing = [];
      for (const a of ASSETS) {
        if (a.optional) continue;
        if (!this.textures.exists(a.key)) missing.push(a.key);
      }
      if (missing.length) {
        console.warn('[BootScene] Missing assets, generating fallbacks for:', missing);
        this._generateFallbackArt(missing);
      }
      this.scene.start('PlayScene');
    }

    _generateFallbackArt(keys) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      const mk = (key, w, h, draw) => { g.clear(); draw(g); g.generateTexture(key, w, h); };

      if (keys.includes('tilePathClean'))
        mk('tilePathClean', 24, 24, gg => { gg.fillStyle(0x0f172a,1); gg.fillRect(0,0,24,24); });
      if (keys.includes('tilePathCorrupt'))
        mk('tilePathCorrupt', 24, 24, gg => { gg.fillStyle(0x552255,1); gg.fillRect(0,0,24,24); });
      if (keys.includes('tilePathCleansed'))
        mk('tilePathCleansed', 24, 24, gg => { gg.fillStyle(0x0f332c,1); gg.fillRect(0,0,24,24); });
      if (keys.includes('tileWall'))
        mk('tileWall', 24, 24, gg => {
          gg.fillStyle(0x0b1220,1); gg.fillRect(0,0,24,24);
          gg.lineStyle(2,0x17324d,1);
          gg.moveTo(2,6); gg.lineTo(22,6);
          gg.moveTo(2,12); gg.lineTo(22,12);
          gg.moveTo(2,18); gg.lineTo(22,18);
          gg.strokePath();
        });

      if (keys.includes('defenderTex'))
        mk('defenderTex', 40, 40, gg => {
          gg.fillStyle(0xcffaf6,1); gg.fillCircle(20,20,11);
          gg.lineStyle(3,0x5ff3e6,1); gg.strokeCircle(20,20,13);
          gg.lineStyle(4,0x22d3ee,1); gg.beginPath();
          gg.arc(20,20,15, Phaser.Math.DegToRad(210), Phaser.Math.DegToRad(330)); gg.strokePath();
        });

      if (keys.includes('virusTex'))
        mk('virusTex', 32, 32, gg => {
          gg.fillStyle(0xff2fb3,1); gg.beginPath();
          const cx=16,cy=16; for (let i=0;i<10;i++){ const a=i*(Math.PI*2/10); const r=(i%2===0)?12:7; const x=cx+Math.cos(a)*r; const y=cy+Math.sin(a)*r; (i?gg.lineTo(x,y):gg.moveTo(x,y)); }
          gg.closePath(); gg.fillPath();
        });
    }
  }
  window.BootScene = BootScene;
})();
