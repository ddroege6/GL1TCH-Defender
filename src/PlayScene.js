'use strict';

(function () {

  // ----------------------------- Tunables -----------------------------
  const TILE = 24;

  const ARENA_PADDING = 8;
  const WAVE_DURATION_S = 50;

  // racks layout (2x12 tiles each), 6 columns top and 6 bottom
  const RACK_W_TILES = 2;
  const RACK_H_TILES = 12;
  const TOP_ROW_Y_F = 0.28;
  const BOT_ROW_Y_F = 0.68;
  const SIDE_MARGIN_F = 0.08;
  const EXTRA_AISLE_F = 0.04;

  // dispersion pacing (slower & smoother than before)
  const DISP_CURVE_DECAY = 0.985;     // higher = slower growth
  const DISP_PER_WAVE_MIN = 2;        // minimum pieces per wave
  const DISP_TWEEN_MS = 650;

  // corruption cadence (seeded, tile-by-tile)
  const SPREAD_TICK_MS = 750;

  // player/enemy
  const PLAYER_DISPLAY = 36;
  const PLAYER_BODY_W = 16;
  const PLAYER_BODY_H = 20;
  const PLAYER_SPEED  = 180;

  const ENEMY_DISPLAY = 26;
  const ENEMY_BODY_W  = 14;
  const ENEMY_BODY_H  = 16;
  const ENEMY_SPEED   = 95;

  const CLEANSE_RADIUS  = 58;
  const CLEANSE_RATE_MS = 120;

  class PlayScene extends Phaser.Scene {
    constructor() { super('Play'); }

    init() {
      this.wave = 1;
      this.securedCount = 0;
      this.dead = false;
      this.waveEndsAt = this.time.now + WAVE_DURATION_S * 1000;

      this.rackTiles = [];
      this.initialRackCount = 0;
      this.cumulativeDispersed = 0;

      this.isCleansing = false;
      this.nextCleanseAt = 0;
      this.sceneStartTime = this.time.now;
    }

    create() {
      const { width: W, height: H } = this.scale.gameSize;
      this.physics.world.setBounds(0, 0, W, H);

      // ----- grid with seeded spread -----
      this.grid = new window.Grid(this, {
        tileSize: TILE,
        textures: {
          clean:    'tile_path_clean',
          corrupt:  'tile_path_corrupt',
          cleansed: 'tile_path_cleansed',
        },
        depthFloor: -10,
        depthOverlay: -3,
      });
      this.grid.regenerate({ initialBlobs: 2 });

      // spread timer (tile-by-tile from seeds)
      this.spreadTimer = this.time.addEvent({
        delay: SPREAD_TICK_MS, loop: true,
        callback: () => {
          // slightly scale with wave for pressure
          const steps = 1 + Math.floor(this.wave / 3);
          const budget = 8 + this.wave * 2;
          this.grid.slowSpreadTick(steps, budget, 0.05);
        }
      });

      // ----- racks -----
      this._buildRacks();

      // ----- player -----
      this.player = this.physics.add.image(W * 0.50, H * 0.50, 'defender')
        .setDepth(5).setOrigin(0.5).setDisplaySize(PLAYER_DISPLAY, PLAYER_DISPLAY)
        .setCollideWorldBounds(true);
      this.player.body.setSize(PLAYER_BODY_W, PLAYER_BODY_H, true);

      // ----- input -----
      this._setupInput();

      // ----- enemies -----
      this.enemies = this.physics.add.group();
      this._topUpEnemies(true);
      this.enemyTopUpTimer = this.time.addEvent({
        delay: 1800, loop: true, callback: () => this._topUpEnemies(false),
      });

      // debris (dynamic while tweening)
      this.debrisDynamic = this.physics.add.group({ allowGravity: false });
      this.physics.add.collider(this.player,  this.debrisDynamic);
      this.physics.add.collider(this.enemies, this.debrisDynamic);

      // collisions
      this.physics.add.collider(this.player,  this.rackGroup);
      this.physics.add.collider(this.enemies, this.rackGroup);
      this.physics.add.overlap (this.player,  this.enemies, this._onPlayerHit, null, this);
      this.physics.add.collider(this.player,  this.enemies, this._onPlayerHit, null, this);

      // HUD + cleanse ring
      this._buildHud();
      this.cleanseGfx = this.add.graphics().setDepth(6).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.enemyTopUpTimer?.destroy();
        this.spreadTimer?.destroy();
        this.tweens.killAll();
      });
    }

    // --------------------------- layout ---------------------------
    _buildRacks() {
      const { width: W, height: H } = this.scale.gameSize;

      this.rackGroup = this.physics.add.staticGroup();
      this.rackTiles.length = 0;

      const tex = this.textures.exists('rack_tile') ? 'rack_tile' : 'tile_path_clean';
      const tint= this.textures.exists('rack_tile') ? 0xffffff : 0x16384e;

      const spawnColumn = (cx, cy) => {
        const rackW = RACK_W_TILES * TILE;
        const rackH = RACK_H_TILES * TILE;
        const x0 = Math.round(cx - rackW / 2);
        const y0 = Math.round(cy - rackH / 2);

        for (let ty = 0; ty < RACK_H_TILES; ty++) {
          for (let tx = 0; tx < RACK_W_TILES; tx++) {
            const x = x0 + tx * TILE + TILE / 2;
            const y = y0 + ty * TILE + TILE / 2;
            const s = this.physics.add.staticImage(x, y, tex)
              .setOrigin(0.5).setDisplaySize(TILE, TILE).setDepth(2).setTint(tint).setAlpha(0.98);
            s.refreshBody();                // make static body exactly 24x24
            this.rackGroup.add(s);
            this.rackTiles.push(s);
          }
        }
      };

      const xs = (() => {
        const left  = W * SIDE_MARGIN_F;
        const right = W * (1 - SIDE_MARGIN_F);
        const usable = right - left;
        const spacing = usable / 7; // 6 cols -> 7 gaps
        const out = [];
        for (let i = 1; i <= 6; i++) out.push(left + i * spacing + (i - 3.5) * (W * EXTRA_AISLE_F / 6));
        return out;
      })();

      xs.forEach(x => spawnColumn(x, H * TOP_ROW_Y_F));
      xs.forEach(x => spawnColumn(x, H * BOT_ROW_Y_F));

      this.initialRackCount = this.rackTiles.length;
      this.cumulativeDispersed = 0;
    }

    // --------------------------- input ---------------------------
    _setupInput() {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyE    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
      this.keySHIFT= this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
      this.keySPACE= this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

      this.input.on('pointerdown', () => this._startCleansing());
      this.input.on('pointerup',   () => this._stopCleansing());
      this.keyE.on('down',         () => this._startCleansing());
      this.keyE.on('up',           () => this._stopCleansing());
      this.keySHIFT.on('down',     () => this._startCleansing());
      this.keySHIFT.on('up',       () => this._stopCleansing());
    }

    // --------------------------- HUD ---------------------------
    _buildHud() {
      this.hud = {};
      this.hud.text = this.add.text(12, 8, '', {
        fontFamily: 'monospace', fontSize: '18px', color: '#a7e8ff'
      }).setDepth(50).setScrollFactor(0);

      this.blinkReadyAt = 0;
      this.blinkCooldownMs = 1400;
      this.hudRing = this.add.graphics().setDepth(50).setScrollFactor(0);
      this._drawBlinkRing(1);
    }
    _drawBlinkRing(alpha) {
      const { width: W } = this.scale.gameSize;
      const x = W - 42, y = 40, r = 20;
      const g = this.hudRing;
      g.clear();
      g.lineStyle(4, 0x61dafb, 0.85);
      g.strokeCircle(x, y, r);
      g.beginPath();
      g.arc(x, y, r, -Math.PI/2, -Math.PI/2 + Math.PI*2*alpha, false);
      g.strokePath();
      g.closePath();
    }

    // --------------------------- loop ---------------------------
    update(time) {
      if (this.dead) return;

      // movement
      const vx = (this.keyD.isDown || this.cursors.right.isDown) - (this.keyA.isDown || this.cursors.left.isDown);
      const vy = (this.keyS.isDown || this.cursors.down.isDown)  - (this.keyW.isDown || this.cursors.up.isDown);
      const v  = new Phaser.Math.Vector2(vx, vy).normalize().scale(PLAYER_SPEED);
      this.player.setVelocity(v.x, v.y);
      if (v.x < -0.01) this.player.setFlipX(true);
      else if (v.x > 0.01) this.player.setFlipX(false);

      // blink
      const ready = time >= this.blinkReadyAt;
      if (Phaser.Input.Keyboard.JustDown(this.keySPACE) && ready) {
        const dir = v.lengthSq() > 0 ? v.clone().normalize() : new Phaser.Math.Vector2(1, 0);
        const dist = 160;
        const nx = Phaser.Math.Clamp(this.player.x + dir.x * dist, ARENA_PADDING, this.scale.gameSize.width  - ARENA_PADDING);
        const ny = Phaser.Math.Clamp(this.player.y + dir.y * dist, ARENA_PADDING, this.scale.gameSize.height - ARENA_PADDING);
        this.player.setPosition(nx, ny);
        this.player.body.reset(nx, ny);
        this.blinkReadyAt = time + this.blinkCooldownMs;
      }
      const cd = Math.max(0, this.blinkReadyAt - time);
      this._drawBlinkRing(1 - cd / this.blinkCooldownMs);

      // cleanse (hold)
      if (this.isCleansing) {
        this._showCleanseFill(this.player.x, this.player.y);
        if (time >= this.nextCleanseAt) {
          const cleaned = this.grid.cleanseAt(this.player.x, this.player.y, CLEANSE_RADIUS);
          this.securedCount += cleaned;
          this.nextCleanseAt = time + CLEANSE_RATE_MS;
        }
      }

      // enemy AI + facing
      this.enemies.children.iterate((e) => {
        if (!e || !e.active) return;
        const dir = new Phaser.Math.Vector2(this.player.x - e.x, this.player.y - e.y).normalize();
        e.setVelocity(dir.x * ENEMY_SPEED, dir.y * ENEMY_SPEED);
        if (e.body.velocity.x < -0.01) e.setFlipX(true);
        else if (e.body.velocity.x > 0.01) e.setFlipX(false);
      });

      // waves
      if (time >= this.waveEndsAt) {
        this._onWaveEnd();
        this.waveEndsAt = time + WAVE_DURATION_S * 1000;
      }

      // HUD
      const remain = Math.max(0, Math.ceil((this.waveEndsAt - time) / 1000));
      this.hud.text.setText(
        `WAVE ${this.wave} | 00:${remain.toString().padStart(2,'0')} | Corrupt: ${this.grid.percentCorrupt()}% | Secured: ${this.securedCount}`
      );
    }

    // cleanse visuals
    _startCleansing() { this.isCleansing = true;  this.nextCleanseAt = 0; }
    _stopCleansing()  {
      this.isCleansing = false;
      const g = this.cleanseGfx;
      this.tweens.killTweensOf(g);
      this.tweens.add({ targets: g, alpha: 0, duration: 180, ease: 'Sine.easeOut', onComplete: () => { g.clear(); g.setVisible(false); }});
    }
    _showCleanseFill(x, y) {
      const g = this.cleanseGfx;
      g.clear();
      g.fillStyle(0x61dafb, 0.18);
      g.fillCircle(x, y, CLEANSE_RADIUS);
      g.setAlpha(1).setVisible(true);
    }

    // enemies
    _capForWave() { return Math.min(8 + this.wave * 2, 42); }
    _topUpEnemies(force) {
      const { width: W, height: H } = this.scale.gameSize;
      const need = this._capForWave() - this.enemies.countActive(true);
      if (!force && need <= 0) return;
      for (let i = 0; i < Math.max(0, need); i++) {
        const side = Phaser.Math.Between(0, 3);
        let x, y;
        if (side === 0) { x = -30;            y = 40 + Math.random() * (H - 80); }
        if (side === 1) { x = W + 30;         y = 40 + Math.random() * (H - 80); }
        if (side === 2) { x = 40 + Math.random() * (W - 80); y = -30; }
        if (side === 3) { x = 40 + Math.random() * (W - 80); y = H + 30; }

        const e = this.enemies.create(x, y, 'virus')
          .setOrigin(0.5).setDisplaySize(ENEMY_DISPLAY, ENEMY_DISPLAY)
          .setDepth(4).setCollideWorldBounds(true);
        e.body.setSize(ENEMY_BODY_W, ENEMY_BODY_H, true);
      }
    }

    // waves / rack dispersion (slower + smooth)
    _onWaveEnd() {
      this.wave += 1;

      const delta = this._tilesToDisperseThisWave();
      if (delta > 0) this._disperseRackTiles(delta);

      this._topUpEnemies(true);
    }

    _tilesToDisperseThisWave() {
      // cumulative target = initial * (1 - decay^wave)
      const targetCumulative = Math.floor(this.initialRackCount * (1 - Math.pow(DISP_CURVE_DECAY, this.wave)));
      const delta = Math.max(0, targetCumulative - this.cumulativeDispersed);
      return Math.max(delta, (this.wave > 1 ? DISP_PER_WAVE_MIN : 0));
    }

    _disperseRackTiles(count) {
      const { width: W, height: H } = this.scale.gameSize;
      const pool = this.rackTiles.filter(s => s.active && s.visible);
      if (pool.length === 0) return;

      Phaser.Utils.Array.Shuffle(pool);
      const take = Math.min(count, pool.length);

      for (let i = 0; i < take; i++) {
        const s = pool[i];
        this.rackGroup.remove(s);
        s.disableBody(true, true);

        const tex = this.textures.exists('rack_tile') ? 'rack_tile' : 'tile_path_clean';
        const d = this.debrisDynamic.create(s.x, s.y, tex)
          .setOrigin(0.5).setDisplaySize(TILE, TILE).setDepth(4)
          .setBounce(0.2).setCollideWorldBounds(true);

        const pad = ARENA_PADDING + TILE;
        const tx = Phaser.Math.Between(pad, W - pad);
        const ty = Phaser.Math.Between(pad, H - pad);

        this.tweens.add({
          targets: d, x: tx, y: ty, duration: DISP_TWEEN_MS, ease: 'Sine.easeInOut',
          onComplete: () => this._convertDebrisToStatic(d)
        });

        this.cumulativeDispersed += 1;
      }

      this.physics.add.collider(this.player,  this.rackGroup);
      this.physics.add.collider(this.enemies, this.rackGroup);
    }

    _convertDebrisToStatic(dyn) {
      const x = dyn.x, y = dyn.y;
      const tex = dyn.texture.key;
      this.debrisDynamic.remove(dyn, true, true);

      const s = this.physics.add.staticImage(x, y, tex)
        .setOrigin(0.5).setDisplaySize(TILE, TILE).setDepth(2).setAlpha(0.98);
      s.refreshBody();
      this.rackGroup.add(s);
      this.rackTiles.push(s);
    }

    // death + score save
    _onPlayerHit() {
      if (this.dead) return;
      this.dead = true;
      this.player.setVelocity(0, 0);
      this._stopCleansing();

      const stats = {
        wave: this.wave,
        timeS: Math.round((this.time.now - this.sceneStartTime) / 1000),
        secured: this.securedCount,
        corruptPct: this.grid.percentCorrupt()
      };

      // persist simple high score fields
      try {
        const key = 'gl1tch:best';
        const prev = JSON.parse(localStorage.getItem(key) || '{}');
        const best = {
          bestSecured: Math.max(prev.bestSecured || 0, stats.secured),
          bestWave:    Math.max(prev.bestWave || 0, stats.wave),
          longestTime: Math.max(prev.longestTime || 0, stats.timeS),
        };
        localStorage.setItem(key, JSON.stringify(best));
      } catch {}

      this.scene.start('Death', stats);
    }
  }

  window.PlayScene = PlayScene;
})();
