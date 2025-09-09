'use strict';

(function () {
  /** MOBILE VIRTUAL JOYSTICK + BUTTONS (unchanged for phones) */
  class VirtualJoystick {
    constructor(scene, x, y) {
      this.scene = scene;
      this.base = scene.add.circle(x, y, 48, 0x0a2038, 0.55).setScrollFactor(0);
      this.knob = scene.add.circle(x, y, 24, 0x184a7a, 0.9).setScrollFactor(0);
      this.pointerId = null;
      this.dir = new Phaser.Math.Vector2(0, 0);
      this.magnitude = 0;

      const zone = scene.add.zone(x, y, 140, 140).setOrigin(0.5).setInteractive().setScrollFactor(0);
      zone.on('pointerdown', (p) => { if (this.pointerId === null) { this.pointerId = p.id; this._update(p); } });
      zone.on('pointermove', (p) => { if (p.id === this.pointerId) this._update(p); });
      zone.on('pointerup',   (p) => { if (p.id === this.pointerId) this._reset(); });
      zone.on('pointerout',  (p) => { if (p.id === this.pointerId) this._reset(); });
      this.zone = zone;
    }
    _update(p) {
      const dx = p.x - this.base.x, dy = p.y - this.base.y;
      const v = new Phaser.Math.Vector2(dx, dy);
      const max = 40;
      if (v.length() > max) v.setLength(max);
      this.knob.setPosition(this.base.x + v.x, this.base.y + v.y);
      this.magnitude = Phaser.Math.Clamp(v.length() / max, 0, 1);
      this.dir = v.length() > 0.01 ? v.clone().normalize() : new Phaser.Math.Vector2(0, 0);
    }
    _reset() {
      this.pointerId = null;
      this.knob.setPosition(this.base.x, this.base.y);
      this.dir.set(0, 0); this.magnitude = 0;
    }
    getVector() { return { dir: this.dir, mag: this.magnitude }; }
  }

  class ActionButton {
    constructor(scene, x, y, key) {
      this.scene = scene;
      this.sprite = scene.add.image(x, y, key).setScrollFactor(0).setInteractive({ useHandCursor: false });
      this.down = false;
      this.sprite.on('pointerdown', () => { this.down = true; });
      this.sprite.on('pointerup',   () => { this.down = false; });
      this.sprite.on('pointerout',  () => { this.down = false; });
    }
    isDown() { return this.down; }
    setAlpha(a) { this.sprite.setAlpha(a); return this; }
  }

  /** DESKTOP KEYBOARD CONTROLS */
  class KeyboardControls {
    constructor(scene) {
      this.scene = scene;
      // Arrow keys + WASD
      this.cursors = scene.input.keyboard.createCursorKeys();
      this.keys = scene.input.keyboard.addKeys({
        W: 'W', A: 'A', S: 'S', D: 'D',
        E: 'E', SPACE: 'SPACE', SHIFT: 'SHIFT'
      });
    }
    getVector() {
      let x = 0, y = 0;
      if (this.cursors.left.isDown || this.keys.A.isDown) x -= 1;
      if (this.cursors.right.isDown || this.keys.D.isDown) x += 1;
      if (this.cursors.up.isDown || this.keys.W.isDown) y -= 1;
      if (this.cursors.down.isDown || this.keys.S.isDown) y += 1;

      const v = new Phaser.Math.Vector2(x, y);
      if (v.length() > 0) v.normalize();
      return { dir: v, mag: v.length() };
    }
    cleanseDown() { return this.keys.E.isDown; }          // hold to cleanse
    blinkPressed() {                                      // tap to blink
      return Phaser.Input.Keyboard.JustDown(this.keys.SPACE) ||
             Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    }
  }

  /** OPTIONAL GAMEPAD (Phaser’s built-in Gamepad plugin) */
  class GamepadControls {
    constructor(scene) {
      this.scene = scene;
      this.pad = null;
      scene.input.gamepad.on('connected', (pad) => { if (!this.pad) this.pad = pad; });
      scene.input.gamepad.on('disconnected', (pad) => { if (this.pad && this.pad.index === pad.index) this.pad = null; });
    }
    hasPad() { return !!this.pad; }
    getVector() {
      if (!this.pad) return { dir: new Phaser.Math.Vector2(0,0), mag: 0 };
      const ax = this.pad.axes.length > 0 ? this.pad.axes[0].getValue() : 0; // left stick X
      const ay = this.pad.axes.length > 1 ? this.pad.axes[1].getValue() : 0; // left stick Y
      const v = new Phaser.Math.Vector2(ax, ay);
      const dead = 0.15;
      if (Math.abs(v.x) < dead) v.x = 0;
      if (Math.abs(v.y) < dead) v.y = 0;
      if (v.length() > 1) v.normalize();
      return { dir: v, mag: v.length() };
    }
    cleanseDown() {
      if (!this.pad) return false;
      // A (Xbox) / Cross (PS) = button 0
      return this.pad.buttons[0]?.pressed === true;
    }
    blinkPressed() {
      if (!this.pad) return false;
      // B (Xbox) / Circle (PS) = button 1
      return this.pad.buttons[1]?.pressed === true && this._edge('b1');
    }
    _edge(key) {
      // simple one-frame edge detector
      this._states ||= {};
      const now = this.pad.buttons[1]?.pressed === true;
      const prev = this._states[key] || false;
      this._states[key] = now;
      return now && !prev;
    }
  }

  window.VirtualJoystick = VirtualJoystick;
  window.ActionButton = ActionButton;
  window.KeyboardControls = KeyboardControls;
  window.GamepadControls = GamepadControls;
})();
