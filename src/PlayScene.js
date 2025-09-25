'use strict';

/**
 * GL1TCH Defense — PlayScene (polished w/ reliable contact death)
 * - Centered circular bodies for player/enemies
 * - Cleanse radius = 72px (3 tiles)
 * - Corrupt tiles are replaced when cleansed
 * - Proximity fallback check for contact kill (in case an overlap tick is missed)
 * - NEW: Retry button on defeat overlay
 */

window.PlayScene = new Phaser.Class({

  Extends: Phaser.Scene,

  initialize:
  function PlayScene() {
    Phaser.Scene.call(this, { key: 'PlayScene' });
  },

  /* ---------------- Tunables ---------------- */
  TILE: 24,

  PLAYER: {
    speed: 185,
    blinkDist: 180,
    blinkCooldown: 1.6,
    cleanseRadius: 72,            // 3 tiles
    displayW: 28, displayH: 28,
    bodyRadius: 16
  },

  ENEMIES: {
    speedMin: 60, speedMax: 110,
    spawnEvery: 1200,
    displayW: 20, displayH: 20,
    bodyRadius: 12,
    retargetMS: 160
  },

  DIFFICULTY: {
    waveTime: 30,
    enemyCapStart: 10,
    enemyCapPerWave: 10,
    disperseStartPct: 0.04,
    dispersePerWavePct: 0.02,
    corruptionSeeds: 3,
    corruptionPerTick: 2,
    corruptionTickMS: 250,
  },

  RACK_LAYOUT: {
    cols: 12, rows: 2,
    tilesHigh: 12,
    tilesWide: 2,                 // 2×12 columns
    xMarginPct: 0.12,
    topYPct: 0.30,
    rowGapPct: 0.38,
  },

  COLORS: {
    hud: '#a8e1ff',
    hudShadow: '#03131d',
    ringFill: 0x6fd0e5,
  },

  /* ---------------- Create ---------------- */
  create() {
    this.W = this.scale.gameSize.width;
    this.H = this.scale.gameSize.height;

    this._ensureFallbackTextures();
    this._buildFloor();

    // Groups
    this.rackGroup     = this.physics.add.staticGroup();
    this.obstacleGroup = this.physics.add.staticGroup();
    this.enemies       = this.physics.add.group({ collideWorldBounds: true });

    // State
    this.rackTiles = [];
    this.corruptTiles = new Set();    // "gx,gy"
    this.corruptFrontier = [];
    this.tileSprites = new Map();     // corrupt key -> sprite
    this.cleansedCount = 0;
    this.dead = false;

    this.wave = 1;
    this.waveTimeLeft = this.DIFFICULTY.waveTime;
    this.lastBlinkAt = -999;

    this.physics.world.setBounds(0, 0, this.W, this.H);

    // Map + seeds
    this._buildRacks();
    this._seedCorruption();

    // Player
    const defKey = this.textures.exists('defender') ? 'defender' : 'defender_fallback';
    this.player = this.physics.add.sprite(this.W * 0.5, this.H * 0.5, defKey)
      .setDepth(10)
      .setDisplaySize(this.PLAYER.displayW, this.PLAYER.displayH)
      .setCircle(this.PLAYER.bodyRadius)
      .setDrag(1000, 1000)
      .setMaxVelocity(this.PLAYER.speed)
      .setCollideWorldBounds(true);

    // Center the circular body after scaling (critical for accurate overlaps)
    this.player.body.setOffset(
      this.player.width  / 2 - this.PLAYER.bodyRadius,
      this.player.height / 2 - this.PLAYER.bodyRadius
    );

    // Precompute squared distance threshold for proximity kill (slightly forgiving)
    const extra = 2; // shrink a tad so visual touch kills
    const killR = this.PLAYER.bodyRadius + this.ENEMIES.bodyRadius - extra;
    this._killDist2 = killR * killR;

    // Input
    this.cursors  = this.input.keyboard.createCursorKeys();
    this.keys     = this.input.keyboard.addKeys('W,A,S,D,E,SHIFT,SPACE');
    this.pointer  = this.input.activePointer;
    this.prevRMB  = false;

    // Cleanse ring
    this.cleanseGfx = this.add.graphics().setDepth(6).setAlpha(0);

    // Collisions
    this.physics.add.collider(this.player,  this.rackGroup);
    this.physics.add.collider(this.player,  this.obstacleGroup);
    this.physics.add.collider(this.enemies, this.rackGroup);
    this.physics.add.collider(this.enemies, this.obstacleGroup);

    // Overlap-based contact kill
    this.physics.add.overlap(this.player, this.enemies, this._handleHit, null, this);

    // Timers
    this.time.addEvent({ delay: this.ENEMIES.spawnEvery,          loop: true, callback: () => this._maybeSpawnEnemy() });
    this.time.addEvent({ delay: this.DIFFICULTY.corruptionTickMS, loop: true, callback: () => this._spreadCorruptionTick() });
    this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => { if (--this.waveTimeLeft <= 0) this._nextWave(); }
    });
    this.time.addEvent({
      delay: this.ENEMIES.retargetMS, loop: true,
      callback: () => this._retargetEnemies()
    });

    this._buildHUD();
  },

  update() {
    if (this.dead) return;
    this._updateMovement();
    this._updateCleanse();

    // Fallback proximity kill (covers any rare missed overlap tick)
    this._checkProximityKills();

    this._updateHUD();
  },

  /* -------- Helper textures -------- */
  _ensureFallbackTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const rect = (key, w, h, fill, a = 1, stroke = false) => {
      if (this.textures.exists(key)) return;
      g.clear(); g.fillStyle(fill, a); g.fillRect(0, 0, w, h);
      if (stroke) { g.lineStyle(2, 0x0b1118, 0.4); g.strokeRect(0.5, 0.5, w - 1, h - 1); }
      g.generateTexture(key, w, h);
    };
    rect('rack_fallback', this.TILE, this.TILE, 0x103043, 1, true);
    rect('corrupt_fallback', this.TILE, this.TILE, 0xff6a85, 0.9, false);
    rect('clean_fallback', this.TILE, this.TILE, 0x1b242c, 1, false);
    rect('defender_fallback', this.TILE, this.TILE, 0x7bd3ff, 1, false);
    rect('virus_fallback', this.TILE, this.TILE, 0x2b2bff, 1, false);
  },

  /* -------- Floor -------- */
  _buildFloor() {
    const key = this.textures.exists('tile_path_clean') ? 'tile_path_clean' : 'clean_fallback';
    const src = this.textures.get(key).getSourceImage();
    const ts  = this.add.tileSprite(0, 0, this.W, this.H, key)
      .setOrigin(0, 0)
      .setDepth(0);
    ts.tileScaleX = this.TILE / src.width;
    ts.tileScaleY = this.TILE / src.height;
  },

  /* -------- Racks -------- */
  _buildRacks() {
    const T = this.TILE;
    const { cols, rows, tilesHigh, tilesWide, xMarginPct, topYPct, rowGapPct } = this.RACK_LAYOUT;

    const left  = this.W * xMarginPct;
    const right = this.W * (1 - xMarginPct);
    const span  = right - left;
    const stepX = cols > 1 ? span / (cols - 1) : 0;

    const rowYs = [];
    for (let r = 0; r < rows; r++) {
      rowYs.push(Phaser.Math.Clamp(this.H * (topYPct + r * rowGapPct), T * 2, this.H - T * 2));
    }

    const rackKey = this.textures.exists('rack_tile') ? 'rack_tile'
                  : (this.textures.exists('tile_path_clean') ? 'tile_path_clean' : 'rack_fallback');

    const addRack = (cx, cy) => {
      const yTop  = Math.round(cy - (tilesHigh / 2) * T);
      const xLeft = Math.round(cx - (tilesWide / 2) * T) + T / 2;

      for (let i = 0; i < tilesHigh; i++) {
        for (let j = 0; j < tilesWide; j++) {
          const x = xLeft + j * T;
          const y = yTop + i * T + T / 2;
          const tile = this.physics.add.staticImage(x, y, rackKey)
            .setOrigin(0.5)
            .setDisplaySize(T, T)
            .setDepth(2)
            .setAlpha(0.98);
          tile.refreshBody(); // tight 24×24
          this.rackGroup.add(tile);
          this.rackTiles.push(tile);
        }
      }
    };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        addRack(Math.round(left + c * stepX), rowYs[r]);
      }
    }
  },

  _disperseRackTilesForWave() {
    const total = this.rackTiles.length;
    if (!total) return;

    const base = this.DIFFICULTY.disperseStartPct;
    const inc  = this.DIFFICULTY.dispersePerWavePct;
    const pct  = Phaser.Math.Clamp(base + Math.max(0, this.wave - 2) * inc, 0, 0.35);

    let toMove = Math.max(1, Math.floor(total * pct));
    toMove = Math.min(toMove, total);

    const T = this.TILE;
    const rackKey = this.textures.exists('rack_tile') ? 'rack_tile'
                  : (this.textures.exists('tile_path_clean') ? 'tile_path_clean' : 'rack_fallback');

    const radius = T * 8;
    Phaser.Utils.Array.Shuffle(this.rackTiles).slice(0, toMove).forEach(staticTile => {
      const { x, y } = staticTile;
      staticTile.destroy();

      const sprite = this.add.image(x, y, rackKey).setOrigin(0.5).setDisplaySize(T, T).setDepth(2).setAlpha(0.98);
      const nx = Phaser.Math.Clamp(x + Phaser.Math.Between(-radius, radius), T * 2, this.W - T * 2);
      const ny = Phaser.Math.Clamp(y + Phaser.Math.Between(-radius, radius), T * 2, this.H - T * 2);

      this.tweens.add({
        targets: sprite,
        x: nx, y: ny,
        duration: Phaser.Math.Between(450, 900),
        ease: 'Sine.easeInOut',
        onComplete: () => {
          const ph = this.physics.add.staticImage(sprite.x, sprite.y, rackKey)
            .setOrigin(0.5).setDisplaySize(T, T).setDepth(2).setAlpha(0.98);
          ph.refreshBody();
          this.obstacleGroup.add(ph);
          sprite.destroy();
        }
      });
    });

    this.rackTiles = this.rackTiles.filter(t => t.active);
  },

  /* -------- Corruption (organic) -------- */
  _tileKey(px, py) {
    const gx = Math.floor(px / this.TILE);
    const gy = Math.floor(py / this.TILE);
    return `${gx},${gy}`;
  },

  _paintCorruptTile(px, py, seed = false) {
    const key = this._tileKey(px, py);
    if (this.corruptTiles.has(key)) return;

    const tex = this.textures.exists('tile_path_corrupt') ? 'tile_path_corrupt' : 'corrupt_fallback';
    const spr = this.add.image(
      Math.floor(px / this.TILE) * this.TILE + this.TILE / 2,
      Math.floor(py / this.TILE) * this.TILE + this.TILE / 2,
      tex
    ).setOrigin(0.5).setDisplaySize(this.TILE, this.TILE).setDepth(1).setAlpha(0.92);

    this.corruptTiles.add(key);
    this.tileSprites.set(key, spr);   // track sprite so we can replace it
    if (seed) this.corruptFrontier.push(key);
  },

  _seedCorruption() {
    for (let i = 0; i < this.DIFFICULTY.corruptionSeeds; i++) {
      const x = Phaser.Math.Between(this.TILE * 4, this.W - this.TILE * 4);
      const y = Phaser.Math.Between(this.TILE * 4, this.H - this.TILE * 4);
      this._paintCorruptTile(x, y, true);
    }
  },

  _spreadCorruptionTick() {
    const step = this.DIFFICULTY.corruptionPerTick;
    for (let i = 0; i < step; i++) {
      if (!this.corruptFrontier.length) break;

      const idx = Phaser.Math.Between(0, this.corruptFrontier.length - 1);
      const key = this.corruptFrontier.splice(idx, 1)[0];
      const [gx, gy] = key.split(',').map(Number);

      const candidates = [
        [gx + 1, gy, 0.75], [gx - 1, gy, 0.75], [gx, gy + 1, 0.75], [gx, gy - 1, 0.75],
        [gx + 1, gy + 1, 0.40], [gx - 1, gy + 1, 0.40], [gx + 1, gy - 1, 0.40], [gx - 1, gy - 1, 0.40],
      ];
      Phaser.Utils.Array.Shuffle(candidates);

      const growCount = Phaser.Math.Between(1, 3);
      let grown = 0;

      for (const [nx, ny, prob] of candidates) {
        if (grown >= growCount) break;
        if (Math.random() > prob) continue;

        const px = nx * this.TILE + this.TILE / 2;
        const py = ny * this.TILE + this.TILE / 2;
        if (px < 0 || py < 0 || px > this.W || py > this.H) continue;

        const nkey = `${nx},${ny}`;
        if (!this.corruptTiles.has(nkey)) {
          this._paintCorruptTile(px, py, false);
          this.corruptFrontier.push(nkey);
          grown++;
        }
      }

      if (grown === 0) this.corruptFrontier.push(key);
    }
  },

  /* -------- Enemies -------- */
  _enemyCapForWave() {
    return this.DIFFICULTY.enemyCapStart + (this.wave - 1) * this.DIFFICULTY.enemyCapPerWave;
  },

  _maybeSpawnEnemy() {
    if (this.dead) return;
    if (this.enemies.getChildren().length >= this._enemyCapForWave()) return;

    const margin = 40;
    let x, y;
    switch (Phaser.Math.Between(0, 3)) {
      case 0: x = margin; y = Phaser.Math.Between(margin, this.H - margin); break;
      case 1: x = this.W - margin; y = Phaser.Math.Between(margin, this.H - margin); break;
      case 2: x = Phaser.Math.Between(margin, this.W - margin); y = margin; break;
      default: x = Phaser.Math.Between(margin, this.W - margin); y = this.H - margin; break;
    }
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 200) return;

    const key = this.textures.exists('virus') ? 'virus' : 'virus_fallback';
    const e = this.enemies.create(x, y, key)
      .setDepth(5)
      .setDisplaySize(this.ENEMIES.displayW, this.ENEMIES.displayH)
      .setCircle(this.ENEMIES.bodyRadius)
      .setBounce(1, 1);

    // Center enemy circular body after scaling
    e.body.setOffset(
      e.width  / 2 - this.ENEMIES.bodyRadius,
      e.height / 2 - this.ENEMIES.bodyRadius
    );

    e.baseSpeed = Phaser.Math.Between(this.ENEMIES.speedMin, this.ENEMIES.speedMax);
    this._aimEnemy(e);
  },

  _retargetEnemies() {
    if (this.dead) return;
    this.enemies.getChildren().forEach(e => this._aimEnemy(e));
  },

  _aimEnemy(e) {
    if (!e || !e.active) return;
    const ang = Phaser.Math.Angle.Between(e.x, e.y, this.player.x, this.player.y)
              + Phaser.Math.FloatBetween(-0.20, 0.20);
    const spd = e.baseSpeed || Phaser.Math.Between(this.ENEMIES.speedMin, this.ENEMIES.speedMax);
    e.setVelocity(Math.cos(ang) * spd, Math.sin(ang) * spd);
    e.setFlipX(e.body.velocity.x < 0);
  },

  _handleHit(player, enemy) {
    if (this.dead || !player.active || !enemy.active) return;
    this._onPlayerDeath();
  },

  // Distance-based fallback (runs every frame)
  _checkProximityKills() {
    if (this.dead) return;
    const px = this.player.x, py = this.player.y;
    const list = this.enemies.getChildren();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.active) continue;
      const dx = e.x - px, dy = e.y - py;
      if (dx * dx + dy * dy <= this._killDist2) {
        this._onPlayerDeath();
        return;
      }
    }
  },

  /* -------- Movement / Cleanse / Blink -------- */
  _updateMovement() {
    const v = new Phaser.Math.Vector2(0, 0);
    const sp = this.PLAYER.speed;

    if (this.cursors.left.isDown || this.keys.A.isDown) v.x -= sp;
    if (this.cursors.right.isDown || this.keys.D.isDown) v.x += sp;
    if (this.cursors.up.isDown || this.keys.W.isDown) v.y -= sp;
    if (this.cursors.down.isDown || this.keys.S.isDown) v.y += sp;

    this.player.setVelocity(v.x, v.y);
    if (Math.abs(v.x) > 2) this.player.setFlipX(v.x < 0);

    // Blink (space or right mouse edge)
    const now = this.time.now / 1000;
    const rmbDown = (this.input.mousePointer && this.input.mousePointer.rightButtonDown())
      ? this.input.mousePointer.rightButtonDown()
      : false;

    const blinkPressed = Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || (rmbDown && !this.prevRMB);
    this.prevRMB = rmbDown;

    if (blinkPressed && (now - this.lastBlinkAt) >= this.PLAYER.blinkCooldown) {
      this.lastBlinkAt = now;
      const aim = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.pointer.worldX, this.pointer.worldY);
      const nx = Phaser.Math.Clamp(this.player.x + Math.cos(aim) * this.PLAYER.blinkDist, 20, this.W - 20);
      const ny = Phaser.Math.Clamp(this.player.y + Math.sin(aim) * this.PLAYER.blinkDist, 20, this.H - 20);
      this.player.setPosition(nx, ny);
    }
  },

  _updateCleanse() {
    const leftDown = this.input.activePointer.isDown && !(
      this.input.mousePointer && this.input.mousePointer.rightButtonDown && this.input.mousePointer.rightButtonDown()
    );
    const want = this.keys.E.isDown || this.keys.SHIFT.isDown || leftDown;

    const gfx = this.cleanseGfx;
    if (want) {
      gfx.clear();
      gfx.fillStyle(this.COLORS.ringFill, 0.18);
      gfx.fillCircle(this.player.x, this.player.y, this.PLAYER.cleanseRadius);
      if (gfx.alpha < 0.25) gfx.setAlpha(Phaser.Math.Linear(gfx.alpha, 0.25, 0.35));

      const r2 = this.PLAYER.cleanseRadius * this.PLAYER.cleanseRadius;
      const gxMin = Math.floor((this.player.x - this.PLAYER.cleanseRadius) / this.TILE);
      const gyMin = Math.floor((this.player.y - this.PLAYER.cleanseRadius) / this.TILE);
      const gxMax = Math.floor((this.player.x + this.PLAYER.cleanseRadius) / this.TILE);
      const gyMax = Math.floor((this.player.y + this.PLAYER.cleanseRadius) / this.TILE);

      const cleanseTex = this.textures.exists('tile_path_cleansed') ? 'tile_path_cleansed' : 'clean_fallback';

      for (let gx = gxMin; gx <= gxMax; gx++) {
        for (let gy = gyMin; gy <= gyMax; gy++) {
          const cx = gx * this.TILE + this.TILE / 2;
          const cy = gy * this.TILE + this.TILE / 2;
          const dx = cx - this.player.x, dy = cy - this.player.y;
          if (dx * dx + dy * dy <= r2) {
            const key = `${gx},${gy}`;
            if (this.corruptTiles.delete(key)) {
              const old = this.tileSprites.get(key);
              if (old) { old.destroy(); this.tileSprites.delete(key); }
              this.cleansedCount++;
              this.add.image(cx, cy, cleanseTex)
                .setOrigin(0.5).setDisplaySize(this.TILE, this.TILE).setDepth(1).setAlpha(0.85);
            }
          }
        }
      }
    } else {
      if (gfx.alpha > 0) { gfx.setAlpha(Math.max(0, gfx.alpha - 0.12)); if (gfx.alpha <= 0.01) gfx.clear(); }
    }
  },

  /* -------- Waves / HUD / Death -------- */
  _nextWave() {
    this.wave++;
    this.waveTimeLeft = this.DIFFICULTY.waveTime;
    this._disperseRackTilesForWave();
  },

  _onPlayerDeath() {
    this.dead = true;
    this.player.setTint(0xff3b3b).setVelocity(0, 0);

    try {
      const def = { bestSecured: 0, bestWave: 0, longestTime: 0 };
      const best = Object.assign(def, JSON.parse(localStorage.getItem('gl1tch:best') || '{}'));
      best.bestSecured = Math.max(best.bestSecured || 0, this.cleansedCount);
      best.bestWave    = Math.max(best.bestWave || 0, this.wave);
      const elapsed = (this.DIFFICULTY.waveTime * (this.wave - 1)) + (this.DIFFICULTY.waveTime - this.waveTimeLeft);
      best.longestTime = Math.max(best.longestTime || 0, elapsed);
      localStorage.setItem('gl1tch:best', JSON.stringify(best));
    } catch {}

    // Overlay
    this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x000000, 0.72).setDepth(100);
    this.add.text(this.W / 2, this.H / 2 - 40,
      `DEFEATED\nWave ${this.wave}\nCleansed: ${this.cleansedCount}`,
      { fontFamily: 'monospace', fontSize: 24, color: '#ffffff', align: 'center' }
    ).setOrigin(0.5).setDepth(101);

    // NEW: Retry button — restart this scene
    const retryBtn = this.add.text(this.W / 2, this.H / 2 + 26, 'Retry', {
      fontFamily: 'monospace', fontSize: 18, color: '#a8e1ff', backgroundColor: '#0b1118'
    }).setOrigin(0.5).setPadding(8, 6, 8, 6).setDepth(101).setInteractive({ useHandCursor: true });
    retryBtn.on('pointerup', () => this.scene.restart());

    // Existing: Return to Home
    const homeBtn = this.add.text(this.W / 2, this.H / 2 + 60, 'Return to Home', {
      fontFamily: 'monospace', fontSize: 18, color: '#a8e1ff', backgroundColor: '#0b1118'
    }).setOrigin(0.5).setPadding(8, 6, 8, 6).setDepth(101).setInteractive({ useHandCursor: true });
    homeBtn.on('pointerup', () => this.scene.start('HomeScene'));
  },

  _buildHUD() {
    this.hud = this.add.text(10, 6, '', {
      fontFamily: 'monospace', fontSize: 14, color: this.COLORS.hud,
      shadow: { color: this.COLORS.hudShadow, fill: true, offsetX: 1, offsetY: 1 }
    }).setDepth(50);
  },

  _updateHUD() {
    const sec = String(this.waveTimeLeft).padStart(2, '0');
    const corruptPct = Math.min(99, Math.round((this.corruptTiles.size / 2000) * 100));
    this.hud.setText(`WAVE ${this.wave} | 00:${sec} | Corrupt: ${corruptPct}% | Secured: ${this.cleansedCount}`);
  },

});
