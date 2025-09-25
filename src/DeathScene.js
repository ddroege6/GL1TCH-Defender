'use strict';

(function () {
  const STORAGE_KEY = 'gl1tch:best';

  function readBest() {
    let best = { bestSecured: 0, bestWave: 0, longestTime: 0 };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) best = Object.assign(best, JSON.parse(raw));
    } catch {}
    return best;
  }

  function writeBest(best) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(best)); } catch {}
  }

  class DeathScene extends Phaser.Scene {
    constructor() { super('DeathScene'); }

    init(data) {
      this.final = {
        wave:    data?.wave    ?? 1,
        secured: data?.secured ?? 0,
        seconds: data?.seconds ?? 0,
      };
      // Update bests immediately
      const best = readBest();
      best.bestSecured = Math.max(best.bestSecured | 0, this.final.secured | 0);
      best.bestWave    = Math.max(best.bestWave    | 0, this.final.wave    | 0);
      best.longestTime = Math.max(best.longestTime | 0, this.final.seconds | 0);
      writeBest(best);
    }

    create() {
      const W = this.scale.gameSize.width;
      const H = this.scale.gameSize.height;

      const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setDepth(10);

      this.add.text(W / 2, H * 0.36, 'DEFEATED', {
        fontFamily: 'monospace', fontSize: 36, color: '#ffffff',
      }).setOrigin(0.5).setDepth(11);

      const lines = [
        `Wave:    ${this.final.wave}`,
        `Secured: ${this.final.secured}`,
        `Time:    ${this.final.seconds}s`,
      ];
      this.add.text(W / 2, H * 0.46, lines.join('\n'), {
        fontFamily: 'monospace', fontSize: 20, color: '#cfe9ff', align: 'center'
      }).setOrigin(0.5).setDepth(11);

      const makeButton = (x, y, label, cb) => {
        const r = this.add.rectangle(x, y, 180, 42, 0x0b2733, 0.9)
          .setStrokeStyle(2, 0x46dff0, 1).setDepth(11).setInteractive({ useHandCursor: true });
        const t = this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: 18, color: '#c9f7ff' })
          .setOrigin(0.5).setDepth(12);
        r.on('pointerover', () => r.setFillStyle(0x0e3443, 0.95));
        r.on('pointerout',  () => r.setFillStyle(0x0b2733, 0.90));
        r.on('pointerup', cb);
      };

      makeButton(W / 2 - 110, H * 0.64, 'Try Again', () => this.scene.start('PlayScene'));
      makeButton(W / 2 + 110, H * 0.64, 'Return Home', () => this.scene.start('HomeScene'));

      this.input.keyboard.once('keydown-ENTER', () => this.scene.start('PlayScene'));
      this.input.keyboard.once('keydown-ESC',   () => this.scene.start('HomeScene'));
    }
  }

  window.DeathScene = DeathScene;
})();
