'use strict';

/**
 * Very small tile engine used by PlayScene.
 * - States: 0=clean, 1=corrupt, 2=cleansed
 * - Renders each tile as a 24x24 Image (fast enough for ~1.5k tiles)
 * - Supports slow seeded corruption spread (BFS-like), cleansing, % metrics.
 */
(function () {

  const STATE = { CLEAN: 0, CORRUPT: 1, CLEANSED: 2 };

  class Grid {
    /**
     * @param {Phaser.Scene} scene
     * @param {{tileSize:number, textures:{clean:string,corrupt:string,cleansed:string}, depthFloor?:number, depthOverlay?:number}} opts
     */
    constructor(scene, opts) {
      this.scene = scene;
      this.size = opts.tileSize;
      this.tex = opts.textures;
      this.depthFloor = opts.depthFloor ?? -10;
      this.depthOverlay = opts.depthOverlay ?? -3;

      const W = scene.scale.gameSize.width;
      const H = scene.scale.gameSize.height;

      this.cols = Math.floor(W / this.size);
      this.rows = Math.floor(H / this.size);

      // tile state & sprites
      this.state = new Array(this.rows * this.cols).fill(STATE.CLEAN);
      this.sprites = new Array(this.rows * this.cols);

      // corruption bookkeeping
      this.corruptCount = 0;
      this.seeds = [];   // { frontier:Set<number> }
      this._buildSprites();
    }

    // --------------- construction / helpers ----------------
    _idx(c, r) { return r * this.cols + c; }
    _inBounds(c, r) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
    _tileCenterX(c) { return c * this.size + this.size / 2; }
    _tileCenterY(r) { return r * this.size + this.size / 2; }

    _buildSprites() {
      const s = this.size;
      const add = (c, r, tex) => {
        const img = this.scene.add.image(this._tileCenterX(c), this._tileCenterY(r), tex)
          .setOrigin(0.5).setDepth(this.depthFloor).setDisplaySize(s, s).setAlpha(1);
        return img;
      };

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const i = this._idx(c, r);
          this.sprites[i] = add(c, r, this.tex.clean);
        }
      }
    }

    _setState(c, r, newState) {
      if (!this._inBounds(c, r)) return false;
      const i = this._idx(c, r);
      const old = this.state[i];
      if (old === newState) return false;

      this.state[i] = newState;
      if (old === STATE.CORRUPT && newState !== STATE.CORRUPT) this.corruptCount--;
      if (old !== STATE.CORRUPT && newState === STATE.CORRUPT) this.corruptCount++;

      const img = this.sprites[i];
      const tex =
        newState === STATE.CLEAN    ? this.tex.clean :
        newState === STATE.CORRUPT  ? this.tex.corrupt :
                                      this.tex.cleansed;
      img.setTexture(tex);
      return true;
    }

    _forEachInCircle(x, y, radius, fn) {
      const s = this.size;
      const c0 = Math.max(0, Math.floor((x - radius) / s));
      const r0 = Math.max(0, Math.floor((y - radius) / s));
      const c1 = Math.min(this.cols - 1, Math.floor((x + radius) / s));
      const r1 = Math.min(this.rows - 1, Math.floor((y + radius) / s));
      const r2 = radius * radius;

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const dx = this._tileCenterX(c) - x;
          const dy = this._tileCenterY(r) - y;
          if (dx * dx + dy * dy <= r2) fn(c, r);
        }
      }
    }

    // --------------- public API ----------------

    regenerate({ initialBlobs = 2 } = {}) {
      // reset
      this.state.fill(STATE.CLEAN);
      this.corruptCount = 0;
      this.seeds.length = 0;
      for (let i = 0; i < this.sprites.length; i++) {
        this.sprites[i].setTexture(this.tex.clean);
      }

      // create initial seeds (1-2 tiles) near edges to feel like ingress points
      for (let s = 0; s < initialBlobs; s++) {
        const edge = Phaser.Math.Between(0, 3);
        const c = edge === 0 ? 1 : edge === 1 ? this.cols - 2 : Phaser.Math.Between(2, this.cols - 3);
        const r = edge === 2 ? 1 : edge === 3 ? this.rows - 2 : Phaser.Math.Between(2, this.rows - 3);

        const front = new Set();
        const i0 = this._idx(c, r);
        front.add(i0);
        this._setState(c, r, STATE.CORRUPT);
        this.seeds.push({ frontier: front });
      }
    }

    /** Percent of corrupt tiles rounded to integer */
    percentCorrupt() {
      const total = this.cols * this.rows;
      return Math.min(100, Math.round((this.corruptCount / total) * 100));
    }

    /**
     * Slowly expands each seed 1 step at a time. Called by a timer in PlayScene.
     * @param {number} stepsPerSeed - tiles to corrupt per seed per tick (default 1..2)
     * @param {number} maxBudget    - hard cap tiles to corrupt this tick (keeps frame time consistent)
     * @param {number} chanceNewSeed- 0..1 probability to add a fresh ingress near edges
     */
    slowSpreadTick(stepsPerSeed = 1, maxBudget = 18, chanceNewSeed = 0.06) {
      let budget = maxBudget;

      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const seed of this.seeds) {
        let corruptThisSeed = 0;

        // snapshot of current frontier
        const candidates = Array.from(seed.frontier.values());
        if (candidates.length === 0) continue;

        // expand from a random subset of frontier
        Phaser.Utils.Array.Shuffle(candidates);
        for (let idx = 0; idx < candidates.length && corruptThisSeed < stepsPerSeed && budget > 0; idx++) {
          const i = candidates[idx];
          const c = i % this.cols;
          const r = (i / this.cols) | 0;

          // try 4-neighbors
          Phaser.Utils.Array.Shuffle(dirs);
          for (const [dc, dr] of dirs) {
            const nc = c + dc, nr = r + dr;
            if (!this._inBounds(nc, nr)) continue;
            const ni = this._idx(nc, nr);
            if (this.state[ni] !== STATE.CLEAN) continue;

            // corrupt neighbor
            this._setState(nc, nr, STATE.CORRUPT);
            seed.frontier.add(ni);
            corruptThisSeed++;
            budget--;
            if (budget <= 0 || corruptThisSeed >= stepsPerSeed) break;
          }
        }
      }

      // occasionally add a new ingress near edges to keep late-game pressure up
      if (Math.random() < chanceNewSeed) {
        const edge = Phaser.Math.Between(0, 3);
        const c = edge === 0 ? 1 : edge === 1 ? this.cols - 2 : Phaser.Math.Between(2, this.cols - 3);
        const r = edge === 2 ? 1 : edge === 3 ? this.rows - 2 : Phaser.Math.Between(2, this.rows - 3);
        const front = new Set([this._idx(c, r)]);
        this._setState(c, r, STATE.CORRUPT);
        this.seeds.push({ frontier: front });
      }
    }

    /**
     * Cleanses a circular area. Returns number of corrupt tiles cleansed.
     */
    cleanseAt(x, y, radius) {
      let cleaned = 0;
      this._forEachInCircle(x, y, radius, (c, r) => {
        const i = this._idx(c, r);
        if (this.state[i] === STATE.CORRUPT) {
          this._setState(c, r, STATE.CLEANSED);
          cleaned++;
        }
      });
      return cleaned;
    }

    /** Utility used by older code paths; not used by PlayScene now. */
    spawnCorruptionBlobs(count = 1, minTiles = 1, maxTiles = 2) {
      for (let k = 0; k < count; k++) {
        const c0 = Phaser.Math.Between(1, this.cols - 2);
        const r0 = Phaser.Math.Between(1, this.rows - 2);
        const tiles = Phaser.Math.Between(minTiles, maxTiles);
        const front = new Set([this._idx(c0, r0)]);
        this._setState(c0, r0, STATE.CORRUPT);
        this.seeds.push({ frontier: front });

        // prime a tiny patch
        for (let t = 0; t < tiles; t++) this.slowSpreadTick(1, 1, 0);
      }
    }
  }

  window.Grid = Grid;

})();
