'use strict';

/**
 * HomeScene — image-backed main menu with calibratable invisible hotspots.
 *
 * Calibration (click-to-corner, no dragging):
 *  - Press C to start calibration.
 *  - Click PLAY top-left, then PLAY bottom-right.
 *  - Click RESET top-left, then RESET bottom-right.
 *  - Press ENTER to save. Press C to cancel, Z to restart steps.
 *
 * Hotspots saved to localStorage as normalized rects relative to source image:
 *   { cx, cy, w, h }  (center x/y and width/height in [0..1] of the source image)
 */

(function () {
  class HomeScene extends Phaser.Scene {
    constructor() {
      super('HomeScene');
    }

    create() {
      // Pick a texture key that contains the menu image
      const key = this._pickMenuTextureKey();
      const src = this.textures.get(key).getSourceImage();
      this.menuKey = key;
      this.srcW = src.width;
      this.srcH = src.height;

      // Background image, we will fit it using "contain"
      this.bg = this.add.image(0, 0, this.menuKey).setOrigin(0.5).setDepth(0);

      // Load hotspots or defaults
      this.hotspots = this._loadHotspots() || {
        // sensible defaults roughly centered over the on-screen buttons in the art
        play:  { cx: 0.500, cy: 0.620, w: 0.185, h: 0.090 },
        reset: { cx: 0.500, cy: 0.705, w: 0.130, h: 0.070 },
      };

      // Invisible interactive zones that will be positioned by _layout
      this.playZone  = this.add.zone(0, 0, 10, 10).setOrigin(0.5).setInteractive({ useHandCursor: true });
      this.resetZone = this.add.zone(0, 0, 10, 10).setOrigin(0.5).setInteractive({ useHandCursor: true });

      this.playZone.on('pointerup',  () => { if (!this.calib) this._startGame(); });
      this.resetZone.on('pointerup', () => { if (!this.calib) this._resetStats(); });

      // Key shortcuts
      this.input.keyboard.on('keydown-ENTER', () => { if (!this.calib) this._startGame(); });
      this.input.keyboard.on('keydown-R',     () => { if (!this.calib) this._resetStats(); });
      this.input.keyboard.on('keydown-C',     () => this._toggleCalibration());

      // UI hint
      this.hint = this.add.text(10, 10, 'Press C to calibrate menu hotspots', {
        fontFamily: 'monospace', fontSize: 14, color: '#a7e8ff', backgroundColor: '#0b1820'
      }).setDepth(5).setAlpha(0.85);

      // Layout now and on resize
      this.scale.on('resize', () => this._layout());
      this._layout();
    }

    /* ---------------- Layout / Fit ---------------- */
    _layout() {
      const W = this.scale.gameSize.width;
      const H = this.scale.gameSize.height;

      // "Contain" fit (no cropping, letterboxes if needed)
      const s = Math.min(W / this.srcW, H / this.srcH);
      this.scaleFactor = s;

      this.bg.setPosition(W * 0.5, H * 0.5).setScale(s);

      // Update interactive zones from normalized rects
      const pr = this._toSceneRect(this.hotspots.play);
      this.playZone.setPosition(pr.x, pr.y).setSize(pr.w, pr.h);

      const rr = this._toSceneRect(this.hotspots.reset);
      this.resetZone.setPosition(rr.x, rr.y).setSize(rr.w, rr.h);

      // Redraw calibration overlay if active
      if (this.calib) this._drawCalibration();
    }

    _toSceneRect(nr) {
      // normalized {cx,cy,w,h} in source-image space -> scene rect {x,y,w,h}
      const W = this.scale.gameSize.width, H = this.scale.gameSize.height, s = this.scaleFactor;
      const cxSrc = nr.cx * this.srcW, cySrc = nr.cy * this.srcH;
      const wSrc  = nr.w  * this.srcW, hSrc  = nr.h  * this.srcH;

      const x = (cxSrc - this.srcW * 0.5) * s + W * 0.5;
      const y = (cySrc - this.srcH * 0.5) * s + H * 0.5;
      return { x, y, w: wSrc * s, h: hSrc * s };
    }

    _toNormalizedRect(sr) {
      // scene rect {x,y,w,h} -> normalized {cx,cy,w,h} in source-image space
      const W = this.scale.gameSize.width, H = this.scale.gameSize.height, s = this.scaleFactor;
      const cxSrc = (sr.x - W * 0.5) / s + this.srcW * 0.5;
      const cySrc = (sr.y - H * 0.5) / s + this.srcH * 0.5;
      const wSrc  = sr.w / s,        hSrc = sr.h / s;
      return {
        cx: Phaser.Math.Clamp(cxSrc / this.srcW, 0, 1),
        cy: Phaser.Math.Clamp(cySrc / this.srcH, 0, 1),
        w:  Phaser.Math.Clamp(wSrc  / this.srcW, 0, 1),
        h:  Phaser.Math.Clamp(hSrc  / this.srcH, 0, 1),
      };
    }

    _pickMenuTextureKey() {
      const keys = this.textures.getTextureKeys().filter(k => k !== '__DEFAULT' && k !== '__MISSING');
      if (!keys.length) return null;
      const prefer = ['main', 'menu', 'home', 'cover', 'title', 'gl1tch', 'defender'];
      let best = keys[0], bestScore = -Infinity;

      for (const k of keys) {
        const img = this.textures.get(k).getSourceImage?.(); if (!img) continue;
        const name = k.toLowerCase();
        const weight = prefer.some(p => name.includes(p)) ? 2 : 1;
        const score = img.width * img.height * weight;
        if (score > bestScore) { bestScore = score; best = k; }
      }
      return best;
    }

    /* ---------------- Calibration (click-to-corner) ---------------- */
    _toggleCalibration() {
      if (this.calib) {
        // Exit calibration
        this.calib.overlay.destroy();
        this.calib.gfx.destroy();
        this.input.keyboard.off('keydown-ENTER', this._saveCalibration, this);
        this.input.keyboard.off('keydown-Z', this._restartCalibration, this);
        this.calib = null;

        // Re-enable hotspots
        this.playZone.setInteractive({ useHandCursor: true });
        this.resetZone.setInteractive({ useHandCursor: true });
        this._layout();
        return;
      }

      // Enter calibration
      // Disable hotspots while calibrating to avoid clicks leaking through
      this.playZone.disableInteractive();
      this.resetZone.disableInteractive();

      const W = this.scale.gameSize.width, H = this.scale.gameSize.height;

      // Fullscreen overlay to guarantee we receive all clicks
      const overlay = this.add.zone(W * 0.5, H * 0.5, W, H)
        .setOrigin(0.5)
        .setInteractive()
        .setDepth(40);

      const gfx = this.add.graphics().setDepth(41);

      this.calib = {
        overlay, gfx,
        step: 0, // 0: PLAY TL, 1: PLAY BR, 2: RESET TL, 3: RESET BR
        points: [], // stores scene-space click points
        playRect: null, resetRect: null
      };

      overlay.on('pointerup', (p) => this._calibClick(p), this);
      this.input.keyboard.on('keydown-ENTER', this._saveCalibration, this);
      this.input.keyboard.on('keydown-Z', this._restartCalibration, this);

      this._drawCalibration();
    }

    _restartCalibration() {
      if (!this.calib) return;
      this.calib.step = 0;
      this.calib.points.length = 0;
      this.calib.playRect = null;
      this.calib.resetRect = null;
      this._drawCalibration();
    }

    _calibClick(pointer) {
      if (!this.calib) return;

      const x = pointer.x, y = pointer.y;
      this.calib.points.push({ x, y });
      this.calib.step++;

      // When we have two points, form a rect for the current target
      if (this.calib.points.length === 2) {
        const tl = this.calib.points[0], br = this.calib.points[1];
        const cx = (tl.x + br.x) * 0.5;
        const cy = (tl.y + br.y) * 0.5;
        const w  = Math.abs(br.x - tl.x);
        const h  = Math.abs(br.y - tl.y);
        const rect = { x: cx, y: cy, w, h };

        if (this.calib.step <= 2) { // finished PLAY
          this.calib.playRect = rect;
        } else {                     // finished RESET
          this.calib.resetRect = rect;
        }
        this.calib.points.length = 0; // ready for next pair
      }

      this._drawCalibration();
    }

    _saveCalibration() {
      if (!this.calib) return;
      if (!this.calib.playRect || !this.calib.resetRect) return;

      // Convert scene-space rects to normalized source-image rects
      const playNorm  = this._toNormalizedRect(this.calib.playRect);
      const resetNorm = this._toNormalizedRect(this.calib.resetRect);
      this.hotspots = { play: playNorm, reset: resetNorm };
      this._saveHotspots(this.hotspots);

      // Exit calibration
      this._toggleCalibration();

      // Small toast
      const t = this.add.text(this.scale.gameSize.width * 0.5, this.scale.gameSize.height * 0.08,
        'Hotspots saved', { fontFamily: 'monospace', fontSize: 16, color: '#a7e8ff', backgroundColor: '#0b1820' })
        .setOrigin(0.5).setDepth(50).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 0.95, yoyo: true, hold: 700, duration: 180, onComplete: () => t.destroy() });
    }

    _drawCalibration() {
      if (!this.calib) return;
      const g = this.calib.gfx;
      const W = this.scale.gameSize.width, H = this.scale.gameSize.height;

      g.clear();

      // Header strip
      g.fillStyle(0x000000, 0.55).fillRect(0, 0, W, 34);
      const steps = [
        'Calibration: Click PLAY top-left',
        'Calibration: Click PLAY bottom-right',
        'Calibration: Click RESET top-left',
        'Calibration: Click RESET bottom-right'
      ];
      const msg = (this.calib.step < 4) ? steps[this.calib.step] : 'Press ENTER to save, C to cancel';
      this._label(g, 10, 9, msg);

      // Draw current zones for reference
      const pr = this._toSceneRect(this.hotspots.play);
      const rr = this._toSceneRect(this.hotspots.reset);
      g.lineStyle(2, 0x29d5ff, 0.9).strokeRect(pr.x - pr.w/2, pr.y - pr.h/2, pr.w, pr.h);
      g.lineStyle(2, 0xffa500, 0.9).strokeRect(rr.x - rr.w/2, rr.y - rr.h/2, rr.w, rr.h);
      this._label(g, pr.x - pr.w/2 + 4, pr.y - pr.h/2 + 4, 'PLAY');
      this._label(g, rr.x - rr.w/2 + 4, rr.y - rr.h/2 + 4, 'RESET');

      // Draw the rectangles being defined
      if (this.calib.playRect) {
        const r = this.calib.playRect;
        g.lineStyle(2, 0x00ff9c, 1).strokeRect(r.x - r.w/2, r.y - r.h/2, r.w, r.h);
      }
      if (this.calib.resetRect) {
        const r = this.calib.resetRect;
        g.lineStyle(2, 0xff6a85, 1).strokeRect(r.x - r.w/2, r.y - r.h/2, r.w, r.h);
      }

      // Draw click points
      if (this.calib.points.length) {
        g.fillStyle(0xffffff, 1);
        for (const p of this.calib.points) g.fillCircle(p.x, p.y, 3);
      }
    }

    _label(gfx, x, y, text) {
      // simple label bg + text; using bitmap-like blocks for speed
      const w = text.length * 7 + 8, h = 16;
      gfx.fillStyle(0x0b1820, 0.85).fillRect(x - 2, y - 2, w, h);
      // Phaser.Graphics can't draw text directly; hint bar is enough for guidance
    }

    /* ---------------- Actions ---------------- */
    _startGame() {
      this.scene.start('PlayScene');
    }

    _resetStats() {
      try { localStorage.removeItem('gl1tch:best'); } catch {}
      const t = this.add.text(this.scale.gameSize.width * 0.5, this.scale.gameSize.height * 0.92,
        'Stats reset', { fontFamily: 'monospace', fontSize: 16, color: '#a7e8ff', backgroundColor: '#0b1820' })
        .setOrigin(0.5).setDepth(10).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 0.95, yoyo: true, hold: 550, duration: 180, onComplete: () => t.destroy() });
    }

    /* ---------------- Storage ---------------- */
    _saveHotspots(hs) {
      try { localStorage.setItem('gl1tch:menuHotspots', JSON.stringify(hs)); } catch {}
    }

    _loadHotspots() {
      try {
        const raw = localStorage.getItem('gl1tch:menuHotspots');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.play && parsed.reset) return parsed;
      } catch {}
      return null;
    }
  }

  window.HomeScene = HomeScene;
})();
