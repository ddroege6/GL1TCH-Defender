'use strict';

(function () {
  class DeathScene extends Phaser.Scene {
    constructor() { super('Death'); }

    init(data) { this.stats = data || {}; }

    create() {
      const { width: W, height: H } = this.scale.gameSize;

      this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.55).setDepth(1);

      const t = [
        `RUN OVER`,
        ``,
        `Wave:    ${this.stats.wave ?? 0}`,
        `Time:    ${this.stats.timeS ?? 0}s`,
        `Secured: ${this.stats.secured ?? 0}`,
        `Corrupt: ${this.stats.corruptPct ?? 0}%`,
        ``,
        `Press R to Retry or H for Home`
      ].join('\n');

      this.add.text(W/2, H/2, t, {
        fontFamily: 'monospace', fontSize: '26px', color: '#ffffff', align: 'center'
      }).setOrigin(0.5).setDepth(2);

      this.input.keyboard.once('keydown-R', () => this.scene.start('Play'));
      this.input.keyboard.once('keydown-H', () => this.scene.start('Home'));
      this.input.once('pointerdown', () => this.scene.start('Home'));
    }
  }
  window.DeathScene = DeathScene;
})();
