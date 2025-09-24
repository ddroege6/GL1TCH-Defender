'use strict';

(function () {
  class HomeScene extends Phaser.Scene {
    constructor() { super('Home'); }

    create() {
      const { width: W, height: H } = this.scale.gameSize;

      this.add.text(W/2, H*0.28, 'GL1TCH DEFENSE', {
        fontFamily: 'monospace', fontSize: '40px', color: '#a7e8ff'
      }).setOrigin(0.5);

      // best stats from localStorage
      let best = { bestSecured: 0, bestWave: 0, longestTime: 0 };
      try { best = Object.assign(best, JSON.parse(localStorage.getItem('gl1tch:best') || '{}')); } catch {}

      const lines = [
        `Best Secured: ${best.bestSecured}`,
        `Best Wave:    ${best.bestWave}`,
        `Longest Time: ${best.longestTime}s`,
        ``,
        `WASD / Arrows to move`,
        `Hold E or Shift (or mouse) to Cleanse`,
        `Space to Blink`,
        ``,
        `Press ENTER or CLICK to start`
      ];
      this.add.text(W/2, H*0.52, lines.join('\n'), {
        fontFamily: 'monospace', fontSize: '20px', color: '#9cc9e3', align: 'center'
      }).setOrigin(0.5);

      const start = () => this.scene.start('Play');
      this.input.keyboard.once('keydown-ENTER', start);
      this.input.once('pointerdown', start);
    }
  }
  window.HomeScene = HomeScene;
})();
