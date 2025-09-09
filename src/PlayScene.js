'use strict';

(function () {
  class PlayScene extends Phaser.Scene {
    constructor() {
      super('PlayScene');

      // Wave/difficulty (Wave 1 applied in create)
      this.wave = 1;
      this.waveTime = 60;
      this.corruptTickMs = 1200;
      this.corruptChance = 0.12;
      this.enemyIntervalMs = 2800;
      this.enemySpeed = 70;
      this.maxEnemies = 8;

      // Abilities
      this.blinkCooldownMs = 2000;
      this.blinkDistance  = 120;
      this.blinkInvulnMs  = 250;
      this.cleanseRadius  = 82;

      // runtime
      this.timers = [];
      this.gameOver = false;
      this.blinkReadyAt = 0;
      this.invulnUntil = 0;

      // UI
      this.hud = null;
      this.blinkMeter = null;
      this.blinkLabel = null;
      this._blinkWasReady = true;

      // Scoring/flow
      this.score = 0;
      this._noCorruptSince = null;

      // Input state
      this.keys = null;
      this.pad  = null;
      this.cleanseHeldEvt = false; // keyboard/gamepad hold flag

      // Pointer Tap/Hold
      this.pointerHold = false;
      this.pointerDownAt = 0;
      this.pointerHoldTimer = null;
      this.TAP_MS = 250; // < TAP_MS => blink, >= TAP_MS => cleanse while held

      // Cleanup stack
      this._cleanupFns = [];
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Difficulty curve
    _applyWaveTuning(wave) {
      const clamp = Phaser.Math.Clamp;
      const ease  = Phaser.Math.Easing.Quadratic.InOut;
      const t = clamp((wave - 1) / 9, 0, 1);

      this.corruptTickMs   = Math.round(Phaser.Math.Linear(1200, 520,  ease(t)));
      this.corruptChance   = Phaser.Math.Linear(0.12, 0.28, t);
      this.enemyIntervalMs = Math.round(Phaser.Math.Linear(2800, 1000, ease(t)));
      this.enemySpeed      = Math.round(Phaser.Math.Linear(70,   140,  t));
      this.maxEnemies      = Math.round(Phaser.Math.Linear(8,    22,   t));
      this.cleanseRadius   = Math.round(Phaser.Math.Linear(82,   68,   t));
      this.blinkCooldownMs = 2000;
      this.waveTime        = Math.round(Phaser.Math.Linear(60,   45,   t));
    }

    // ───────────────────────────────────────────────────────────────────────────
    // Blink UI helpers
    _getBlinkProgress() {
      const now = this.time.now || 0;
      if (!this.blinkReadyAt) return 1;
      const remaining = this.blinkReadyAt - now;
      return Phaser.Math.Clamp(1 - remaining / this.blinkCooldownMs, 0, 1);
    }
    _blinkUIPos() {
      const W = this.scale.gameSize.width;
      return { x: W - 52, y: 52 };
    }
    _renderBlinkUI() {
      if (!this.blinkMeter) return;
      const { x, y } = this._blinkUIPos();
      const g = this.blinkMeter; g.clear();
      const R_OUT = 30, R_IN = 22;
      const ready = (this.time.now >= (this.blinkReadyAt || 0));
      const p = this._getBlinkProgress();

      g.fillStyle(0x1f2937, 0.6); g.slice(x,y,R_OUT,-Math.PI,Math.PI,true); g.fill();
      g.fillStyle(0x0b0f14, 1);   g.slice(x,y,R_IN,-Math.PI,Math.PI,true); g.fill();

      if (p > 0) {
        const start = -Math.PI/2, end = start + p * Math.PI * 2;
        g.fillStyle(ready ? 0x22d3ee : 0x94a3b8, 0.95);
        g.beginPath(); g.moveTo(x,y); g.arc(x,y,R_OUT,start,end,false); g.lineTo(x,y); g.closePath(); g.fill();
        g.fillStyle(0x0b0f14, 1); g.slice(x,y,R_IN,-Math.PI,Math.PI,true); g.fill();
      }
      if (this.blinkLabel) {
        this.blinkLabel.setPosition(x, y - R_OUT - 14);
        this.blinkLabel.setColor(ready ? '#22d3ee' : '#9ab3c9');
        this.blinkLabel.setText(ready ? 'BLINK READY' : 'BLINK…');
      }
    }

    // Wave helpers
    _seedsForWave(w) { return Math.min(6, 2 + Math.floor((w - 1) / 2)); }
    _ensureCorruption(minSeeds = 1) { if (this.grid.corruptedTiles().length < minSeeds) this.grid.randomEdgeSpawn(minSeeds); }

    // Map rebuild (called on create and every 5 waves)
    _rebuildMap() {
      this.grid.regenerate();
      // Rebind player and enemies to the new static walls
      this.physics.world.colliders.destroy(); // clear previous colliders
      this.physics.add.collider(this.player, this.grid.walls);
      this.enemies.children.iterate(e => { if (e) this.physics.add.collider(e, this.grid.walls); });
      this.physics.add.overlap(this.player, this.enemies, () => {
        if (this.time.now < this.invulnUntil) return;
        this._gameOver();
      });
    }

    // ───────────────────────────────────────────────────────────────────────────
    create() {
      // Reset runtime flags on fresh start
      this.gameOver = false;
      this.cleanseHeldEvt = false;
      this.pointerHold = false;
      this.pointerDownAt = 0;
      if (this.pointerHoldTimer) { this.pointerHoldTimer.remove(false); this.pointerHoldTimer = null; }
      this._cleanupFns.length = 0;

      const W = this.scale.gameSize.width, H = this.scale.gameSize.height;

      // Grid
      this.grid = new window.Grid(this);

      // Difficulty
      this._applyWaveTuning(1);

      // Player (force display size & physics body, independent of PNG pixels)
      const dSize = window.GD_SPRITES.defender;
      this.player = this.physics.add.image(W * 0.5, H * 0.5, 'defenderTex')
        .setDepth(10)
        .setCollideWorldBounds(true);
      this.player.setDisplaySize(dSize, dSize);
      {
        const r = Math.floor(dSize / 2) - 2;
        const off = (dSize / 2 - r);
        this.player.body.setCircle(r, off, off);
      }
      this.player.setDrag(650, 650).setMaxVelocity(220, 220);

      // Enemies group
      this.enemies = this.add.group();

      // Colliders
      this.physics.add.collider(this.player, this.grid.walls);

      // HUD + Blink UI
      this.hud = this.add.text(12, 8, '', { fontFamily: 'monospace', fontSize: 16, color: '#9ad9ff' })
        .setScrollFactor(0).setDepth(20);
      this.blinkMeter = this.add.graphics().setDepth(26).setScrollFactor(0);
      this.blinkLabel = this.add.text(0, 0, 'BLINK…', { fontFamily: 'monospace', fontSize: 12, color: '#9ab3c9' })
        .setDepth(27).setScrollFactor(0).setOrigin(0.5);
      this._renderBlinkUI();

      // Initial corruption + timers
      this.grid.randomEdgeSpawn(this._seedsForWave(1));
      this._resetTimers();

      // Lose condition (overlap)
      this.physics.add.overlap(this.player, this.enemies, () => {
        if (this.time.now < this.invulnUntil) return;
        this._gameOver();
      });

      // INPUT
      this._setupInput();

      // Clean up listeners/timers on scene shutdown/destroy
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._cleanup());
      this.events.once(Phaser.Scenes.Events.DESTROY, () => this._cleanup());
    }

    _setupInput() {
      const K = Phaser.Input.Keyboard.KeyCodes;

      this.keys = this.input.keyboard.addKeys({
        up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
        W: K.W, A: K.A, S: K.S, D: K.D,
        BLINK: K.SPACE, CLEANSE: K.SHIFT, CLEANSE2: K.E
      });

      // Prevent browser from stealing SPACE/SHIFT
      this.input.keyboard.addCapture([K.SPACE, K.SHIFT]);

      // Blink (Space)
      const onBlink = () => this._tryBlink();
      this.keys.BLINK.on('down', onBlink, this);
      this._cleanupFns.push(() => this.keys.BLINK.off('down', onBlink, this));

      // Cleanse (hold Shift or E)
      const onCleanseDown = () => { this.cleanseHeldEvt = true; };
      const onCleanseUp   = () => { this.cleanseHeldEvt = false; };
      this.keys.CLEANSE.on('down', onCleanseDown, this);
      this.keys.CLEANSE.on('up',   onCleanseUp,   this);
      this.keys.CLEANSE2.on('down', onCleanseDown, this);
      this.keys.CLEANSE2.on('up',   onCleanseUp,   this);
      this._cleanupFns.push(() => {
        this.keys.CLEANSE.off('down', onCleanseDown, this);
        this.keys.CLEANSE.off('up',   onCleanseUp,   this);
        this.keys.CLEANSE2.off('down', onCleanseDown, this);
        this.keys.CLEANSE2.off('up',   onCleanseUp,   this);
      });

      // Pointer: LMB = Blink, Hold LMB ≥ TAP_MS = Cleanse, RMB = Cleanse while down
      const onPointerDown = (p) => {
        if (p.rightButtonDown()) { this.pointerHold = true; return; }
        if (p.leftButtonDown() || p.pointerType === 'touch') {
          this.pointerDownAt = this.time.now;
          if (this.pointerHoldTimer) { this.pointerHoldTimer.remove(false); }
          this.pointerHold = false;
          this.pointerHoldTimer = this.time.addEvent({
            delay: this.TAP_MS,
            callback: () => {
              if (this.input.activePointer && this.input.activePointer.isDown) {
                this.pointerHold = true; // start cleansing after threshold
              }
            },
            callbackScope: this
          });
        }
      };
      const onPointerUp = (p) => {
        if (this.pointerHoldTimer) { this.pointerHoldTimer.remove(false); this.pointerHoldTimer = null; }
        if (this.pointerHold || p.rightButtonReleased()) { this.pointerHold = false; this.pointerDownAt = 0; return; }
        const dt = this.time.now - (this.pointerDownAt || 0);
        this.pointerDownAt = 0;
        if (dt < this.TAP_MS) this._tryBlink();
      };
      this.input.on('pointerdown', onPointerDown, this);
      this.input.on('pointerup',   onPointerUp,   this);
      this._cleanupFns.push(() => {
        this.input.off('pointerdown', onPointerDown, this);
        this.input.off('pointerup',   onPointerUp,   this);
      });

      // Gamepad: A = Blink, RT/R2 = Cleanse hold
      const onPadConnected = pad => { this.pad = pad; };
      this.input.gamepad.once('connected', onPadConnected, this);
      if (this.input.gamepad.total) this.pad = this.input.gamepad.pad1;
      this._cleanupFns.push(() => this.input.gamepad.off('connected', onPadConnected, this));

      const onPadDown = (pad, button, index) => {
        if (index === 0) this._tryBlink();       // A / Cross
        if (index === 7) this.cleanseHeldEvt = true; // RT / R2
      };
      const onPadUp = (pad, button, index) => {
        if (index === 7) this.cleanseHeldEvt = false;
      };
      this.input.gamepad.on('down', onPadDown, this);
      this.input.gamepad.on('up',   onPadUp,   this);
      this._cleanupFns.push(() => {
        this.input.gamepad.off('down', onPadDown, this);
        this.input.gamepad.off('up',   onPadUp,   this);
      });
    }

    _cleanup() {
      this.timers.forEach(t => t.remove(false));
      this.timers.length = 0;
      this._cleanupFns.forEach(fn => { try { fn(); } catch {} });
      this._cleanupFns.length = 0;
      this.cleanseHeldEvt = false;
      this.pointerHold = false;
      if (this.pointerHoldTimer) { this.pointerHoldTimer.remove(false); this.pointerHoldTimer = null; }
    }

    _resetTimers() {
      this.timers.forEach(t => t.remove(false));
      this.timers = [];
      this._setTimer(() => this.grid.spread(this.corruptChance), this.corruptTickMs, true);
      this._setTimer(() => { if (this.enemies.getLength() < this.maxEnemies) window.spawnEnemy(this, this.grid, this.enemySpeed); }, this.enemyIntervalMs, true);
      this._setTimer(() => this._tickWaveTimer(), 1000, true);
      this._setTimer(() => { if (this.grid.corruptedTiles().length === 0 && !this.gameOver) this.grid.randomEdgeSpawn(1); }, 4000, true); // watchdog
    }
    _setTimer(fn, delay, loop=false){ this.timers.push(this.time.addEvent({ delay, callback: fn, callbackScope: this, loop })); }

    _tickWaveTimer() { if (!this.gameOver && --this.waveTime <= 0) this._nextWave(); }

    _nextWave() {
      this.wave++;
      if ((this.wave - 1) % 5 === 0) { // reconfigure map
        this._flashBanner('RECONFIGURING GRID…');
        this.enemies.clear(true, true);
        this._rebuildMap();
      }
      this._applyWaveTuning(this.wave);
      this._resetTimers();
      this.grid.randomEdgeSpawn(this._seedsForWave(this.wave)); // always seed a new wave
      this._flashBanner(`WAVE ${this.wave}`);
    }

    _flashBanner(text) {
      const W = this.scale.gameSize.width;
      const banner = this.add.text(W / 2, 70, text, { fontFamily: 'monospace', fontSize: 28, color: '#a6f1ff' })
        .setOrigin(0.5).setDepth(30);
      this.tweens.add({ targets: banner, alpha: { from: 1, to: 0 }, duration: 1300, onComplete: () => banner.destroy() });
    }

    _gameOver() {
      if (this.gameOver) return;
      this.gameOver = true;

      this._cleanup();
      this.enemies.clear(true, true);

      const W = this.scale.gameSize.width, H = this.scale.gameSize.height;
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(40);
      const msg = this.add.text(W / 2, H / 2 - 16, 'SYSTEM BREACH', { fontFamily: 'monospace', fontSize: 32, color: '#ff6bbf' })
        .setOrigin(0.5).setDepth(50);
      const sub = this.add.text(W / 2, H / 2 + 28, 'Click/Tap or press R/Space to restart', {
        fontFamily: 'monospace', fontSize: 16, color: '#a6f1ff', align: 'center'
      }).setOrigin(0.5).setDepth(50);

      const doRestart = () => { dim.destroy(); msg.destroy(); sub.destroy(); this.scene.restart(); };
      this.input.once('pointerdown', doRestart, this);
      this.input.keyboard?.once('keydown-R', doRestart, this);
      this.input.keyboard?.once('keydown-SPACE', doRestart, this);
      this.input.gamepad?.once('down', () => doRestart(), this);
    }

    // ---- Movement helpers ----
    _keyboardVector() {
      const k = this.keys;
      const x = (k.D.isDown || k.right.isDown) - (k.A.isDown || k.left.isDown);
      const y = (k.S.isDown || k.down.isDown)  - (k.W.isDown || k.up.isDown);
      const v = new Phaser.Math.Vector2(x, y);
      return v.lengthSq() > 0 ? v.normalize() : v;
    }
    _gamepadVector() {
      const p = this.pad;
      if (!p) return new Phaser.Math.Vector2(0,0);
      const v = new Phaser.Math.Vector2(p.axes.length ? p.axes[0].getValue() : 0, p.axes.length > 1 ? p.axes[1].getValue() : 0);
      return (v.length() >= 0.1) ? v.normalize() : new Phaser.Math.Vector2(0,0);
    }

    update() {
      if (this.gameOver) return;

      // Movement
      const vgp = this._gamepadVector();
      const vkb = this._keyboardVector();
      const v = (vgp.length() > 0.05 ? vgp : vkb);
      this.player.setVelocity(v.x * 180, v.y * 180);

      // Cleanse?
      const kbHold = this.keys?.CLEANSE.isDown || this.keys?.CLEANSE2.isDown;
      const gpHold = this.pad && (this.pad.rightTrigger > 0.2);
      const doCleanse = this.cleanseHeldEvt || this.pointerHold || kbHold || gpHold;
      if (doCleanse) {
        const ring = this.add.circle(this.player.x, this.player.y, this.cleanseRadius, 0x23b58b, 0.06).setDepth(2);
        this.tweens.add({ targets: ring, alpha: 0, duration: 160, onComplete: () => ring.destroy() });
        this.grid.cleanseCircle(this.player.x, this.player.y, this.cleanseRadius, 12);
      }

      // Enemies
      window.updateEnemies(this, this.player);

      // HUD / lose
      const sec = Phaser.Math.Clamp(this.waveTime, 0, 999);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      const corruptPct = Math.round(this.grid.corruptedRatio() * 100);
      this.hud.setText(`WAVE ${this.wave} | ${mm}:${ss} | Corrupt: ${corruptPct}% | Secured: ${this.score}`);
      if (corruptPct >= 70) this._gameOver();

      // Win/flow beats
      const corruptedNow = this.grid.corruptedTiles().length;
      if (corruptedNow === 0) {
        if (this._noCorruptSince == null) this._noCorruptSince = this.time.now;
        if (this.time.now - this._noCorruptSince > 2000) {
          this._noCorruptSince = null;
          this.score += 1;
          this._flashBanner('SECTOR SECURED +1');
          this.grid.randomEdgeSpawn(this._seedsForWave(this.wave));
        }
      } else {
        this._noCorruptSince = null;
      }
      if (corruptedNow === 0 && this.enemies.getLength() > 0) this._ensureCorruption(1);

      // Blink UI + tiny flash when ready
      const nowReady = this.time.now >= (this.blinkReadyAt || 0);
      if (nowReady && !this._blinkWasReady) {
        this._blinkWasReady = true;
        const { x, y } = this._blinkUIPos();
        const flash = this.add.circle(x, y, 18, 0x22d3ee, 0.35).setDepth(28);
        this.tweens.add({ targets: flash, alpha: 0, scale: 2.0, duration: 220, onComplete: () => flash.destroy() });
      } else if (!nowReady) {
        this._blinkWasReady = false;
      }
      this._renderBlinkUI();
    }

    _tryBlink() {
      if (this.time.now < this.blinkReadyAt) return;
      const mv = this._gamepadVector().length() > 0.05 ? this._gamepadVector() : this._keyboardVector();
      const dir = (mv.length() >= 0.1) ? mv : new Phaser.Math.Vector2(1, 0);
      this._blink(dir);
    }

    _blink(dir) {
      const half = window.GD_SPRITES.defender / 2;
      const nx = this.player.x + dir.x * this.blinkDistance;
      const ny = this.player.y + dir.y * this.blinkDistance;
      const minX = half, minY = half;
      const maxX = this.scale.gameSize.width  - half;
      const maxY = this.scale.gameSize.height - half;

      this.player.setPosition(
        Phaser.Math.Clamp(nx, minX, maxX),
        Phaser.Math.Clamp(ny, minY, maxY)
      );
      this.invulnUntil  = this.time.now + this.blinkInvulnMs;
      this.blinkReadyAt = this.time.now + this.blinkCooldownMs;

      const trail = this.add.circle(this.player.x, this.player.y, 14, 0xa9fff0, 0.4).setDepth(4);
      this.tweens.add({ targets: trail, alpha: 0, scale: 1.9, duration: 220, onComplete: () => trail.destroy() });
    }
  }

  window.PlayScene = PlayScene;
})();
