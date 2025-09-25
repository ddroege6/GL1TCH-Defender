'use strict';

(function () {
  class HomeScene extends Phaser.Scene {
    constructor() { super('HomeScene'); }

    create() {
      const W = this.scale.gameSize.width;
      const H = this.scale.gameSize.height;

      // ---- Find a cover-like texture key no matter how it was named ----------
      const coverKey = this._pickCoverKey();

      // Space we want the art to fill (top area; footer lives below)
      const footerHeight = Math.max(120, Math.round(H * 0.16));
      const availH = H - footerHeight;

      if (coverKey) {
        const img = this.add.image(W / 2, 0, coverKey).setOrigin(0.5, 0);
        // Contain (no cropping)
        const src = this.textures.get(coverKey).getSourceImage();
        const s = Math.min(W / src.width, availH / src.height);
        img.setDisplaySize(src.width * s, src.height * s);
      } else {
        // Graceful fallback if nothing was preloaded
        this.add.rectangle(W / 2, 0, W, availH, 0x0b1118, 1).setOrigin(0.5, 0);
      }

      // ---- Glass footer -------------------------------------------------------
      const glass = this.add.rectangle(
        W / 2, H - footerHeight / 2, W, footerHeight,
        0x0b1118, 0.88
      ).setStrokeStyle(1, 0x2a3d4b, 0.9);

      // Layout: [Stats | Buttons | Controls]
      const pad = 24;
      const colW = (W - pad * 2) / 3;
      const baseY = H - footerHeight + 16;

      // --- STATS (left) -------------------------------------------------------
      const bestDefault = { bestSecured: 0, bestWave: 0, longestTime: 0 };
      let best = bestDefault;
      try { best = Object.assign(bestDefault, JSON.parse(localStorage.getItem('gl1tch:best') || '{}')); } catch {}

      this.add.text(pad + 6, baseY, 'STATS', {
        fontFamily: 'monospace', fontSize: '16px', color: '#bfeaff'
      }).setOrigin(0, 0);

      this.add.text(pad + 6, baseY + 22, [
        `Most Secured: ${best.bestSecured || 0}`,
        `Best Wave:    ${best.bestWave || 0}`,
        `Longest Time: ${best.longestTime || 0}s`,
      ].join('\n'), {
        fontFamily: 'monospace', fontSize: '14px', color: '#9cc9e3'
      }).setOrigin(0, 0);

      // --- Buttons (center) ---------------------------------------------------
      const makeBtn = (x, y, label, onClick, w = 220, h = 44) => {
        const bg = this.add.rectangle(x, y, w, h, 0x0d3a47, 0.9)
          .setStrokeStyle(2, 0x69d2f1, 1)
          .setInteractive({ useHandCursor: true });
        const txt = this.add.text(x, y, label, {
          fontFamily: 'monospace', fontSize: '18px', color: '#c7f2ff'
        }).setOrigin(0.5);
        bg.on('pointerover', () => bg.setFillStyle(0x0f4b5a, 0.95));
        bg.on('pointerout',  () => bg.setFillStyle(0x0d3a47, 0.90));
        bg.on('pointerup', onClick);
      };

      const centerX = pad + colW * 1.5;
      makeBtn(centerX, baseY + 32, 'Start', () => this.scene.start('PlayScene'));
      makeBtn(centerX, baseY + 78, 'Reset stats', () => {
        localStorage.removeItem('gl1tch:best');
        this.scene.restart();
      }, 160, 34);

      // --- CONTROLS (right) ---------------------------------------------------
      const rightX = pad + colW * 3 - 6; // inside padding, right aligned
      this.add.text(rightX, baseY, 'CONTROLS', {
        fontFamily: 'monospace', fontSize: '16px', color: '#bfeaff', align: 'right'
      }).setOrigin(1, 0);

      this.add.text(rightX, baseY + 22, [
        'WASD / Arrows to move',
        'Hold E or Shift (or mouse) to Cleanse',
        'Space to Blink',
      ].join('\n'), {
        fontFamily: 'monospace', fontSize: '14px', color: '#9cc9e3', align: 'right'
      }).setOrigin(1, 0);

      // Keyboard start shortcut
      this.input.keyboard.once('keydown-ENTER', () => this.scene.start('PlayScene'));
    }

    _pickCoverKey() {
      // Accept anything that looks like a cover/home splash
      const keys = this.textures.getTextureKeys()
        .filter(k => k && k !== '__DEFAULT' && k !== '__MISSING');

      // Prefer likely names
      const prefer = keys.find(k => /cover|splash|home|gl1tch/i.test(k));
      if (prefer) return prefer;

      // Otherwise choose the largest image so it’s probably the poster art
      let bestKey = null, bestArea = 0;
      for (const k of keys) {
        const src = this.textures.get(k).getSourceImage?.();
        if (!src || !src.width || !src.height) continue;
        const area = src.width * src.height;
        if (area > bestArea) { bestArea = area; bestKey = k; }
      }
      return bestKey;
    }
  }

  window.HomeScene = HomeScene;
})();
