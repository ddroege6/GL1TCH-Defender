'use strict';

(function () {
  const STORAGE_KEY = 'gl1tch:best';

  const readBest = () => {
    let best = { bestWave: 0, bestSecured: 0, longestTime: 0 };
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) best = Object.assign(best, JSON.parse(raw)); } catch {}
    return best;
  };
  const clearBest = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };
  const mmss = (s) => { const m=Math.floor((s||0)/60), sec=Math.floor((s||0)%60); return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };

  class HomeScene extends Phaser.Scene {
    constructor() { super('HomeScene'); }

    create() {
      this.cameras.main.setBackgroundColor('#0b1118');
      this.W = this.scale.gameSize.width; this.H = this.scale.gameSize.height;

      // UI frame
      this.frame = this.add.graphics(); this._drawFrame();

      // Title
      this.title = this.add.text(this.W/2, this.H*0.18, 'GL1TCH DEFENDER', {
        fontFamily:'monospace', fontSize:42, color:'#7be4ff', stroke:'#03222e', strokeThickness:6
      }).setOrigin(0.5);

      // Best stats
      this.add.text(this.W/2, this.H*0.30, 'BEST STATS', { fontFamily:'monospace', fontSize:18, color:'#9cd6ff' }).setOrigin(0.5);
      this.stats = this.add.text(this.W/2, this.H*0.36, '', { fontFamily:'monospace', fontSize:16, color:'#a8e1ff' }).setOrigin(0.5);
      this._refreshBest();

      // Buttons
      const makeBtn = (label, y, cb) => {
        const x=this.W/2, w=220, h=46;
        const r = this.add.rectangle(x,y,w,h,0x0b2733,0.92).setStrokeStyle(3,0x1e87a5,1).setOrigin(0.5).setInteractive({useHandCursor:true});
        const t = this.add.text(x,y,label,{ fontFamily:'monospace', fontSize:20, color:'#dff7ff' }).setOrigin(0.5).setInteractive({useHandCursor:true});
        const hoverOn=()=>r.setFillStyle(0x103a47,0.96), hoverOff=()=>r.setFillStyle(0x0b2733,0.92);
        [r,t].forEach(o=>{ o.on('pointerover',hoverOn); o.on('pointerout',hoverOff); o.on('pointerdown',cb); o.on('pointerup',cb); });
        return {r,t};
      };
      this.btnPlay  = makeBtn('PLAY',        this.H*0.52, () => this._startGame());
      this.btnReset = makeBtn('RESET STATS', this.H*0.60, () => this._resetStats());
      this.btnSet   = makeBtn('SETTINGS',    this.H*0.68, () => this._openSettings());

      // Hints
      this.add.text(10, 8, 'Enter/A: Play   •   R/X: Reset   •   S/Y: Settings', { fontFamily:'monospace', fontSize:13, color:'#9cc9e3' });

      // Keyboard
      this.input.keyboard.on('keydown-ENTER', () => this._startGame());
      this.input.keyboard.on('keydown-SPACE', () => this._startGame());
      this.input.keyboard.on('keydown-R',     () => this._resetStats());
      this.input.keyboard.on('keydown-S',     () => this._openSettings());

      // ✅ Gamepad support for menu
      this.pad = null; this.prevPad = new Array(16).fill(false);
      if (this.input.gamepad) {
        if (this.input.gamepad.total) this.pad = this.input.gamepad.getPad(0);
        this.input.gamepad.on('connected',    (p)=>{ if(!this.pad) this.pad=p; });
        this.input.gamepad.on('disconnected', (p)=>{ if(this.pad && this.pad.index===p.index) this.pad=null; });
      }

      this.scale.on('resize', () => this._layout()); this._layout();
    }

    update() {
      if (!this.pad) return;
      const now=(i)=>!!(this.pad.buttons[i] && this.pad.buttons[i].pressed);
      const edge=(i)=>{ this._ps||(this._ps={}); const n=now(i),p=!!this._ps[i]; this._ps[i]=n; return n && !p; };
      if (edge(0) || edge(9)) this._startGame(); // A or Start
      if (edge(2)) this._resetStats();          // X
      if (edge(3)) this._openSettings();        // Y
    }

    _startGame() {
      if (this.settingsOpen) return;
      const mgr=this.game.scene;
      if (!mgr.keys['PlayScene'] && window.PlayScene) mgr.add('PlayScene', window.PlayScene, false);
      mgr.stop('HomeScene'); mgr.start('PlayScene');
    }

    _resetStats() {
      clearBest(); this._refreshBest();
      const t = this.add.text(this.W/2, this.H*0.86, 'Stats reset', { fontFamily:'monospace', fontSize:16, color:'#a7e8ff', backgroundColor:'#0b1118' })
        .setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets:t, alpha:0.95, yoyo:true, hold:600, duration:180, onComplete:()=>t.destroy() });
    }

    _openSettings() {
      if (this.settingsOpen) return;
      const c = this.add.container(this.W/2, this.H/2).setDepth(50);
      this.settings = c; this.settingsOpen = true;
      const p=this.add.rectangle(0,0,520,360,0x08141b,0.96).setStrokeStyle(3,0x1e87a5,1); c.add(p);
      c.add(this.add.text(0,-140,'SETTINGS',{fontFamily:'monospace',fontSize:24,color:'#9cd6ff'}).setOrigin(0.5));
      c.add(this.add.text(0,-90,'Settings are coming soon.\n(Placeholder)',{fontFamily:'monospace',fontSize:16,color:'#cbe9ff',align:'center',wordWrap:{width:460}}).setOrigin(0.5));
      const back=this.add.text(0,140,'Back',{fontFamily:'monospace',fontSize:18,color:'#dff7ff',backgroundColor:'#0b2733'})
        .setPadding(8,6,8,6).setOrigin(0.5).setInteractive({useHandCursor:true});
      back.on('pointerdown',()=>this._closeSettings()); back.on('pointerup',()=>this._closeSettings()); c.add(back);
      this.input.keyboard.once('keydown-ESC', ()=>this._closeSettings());
    }

    _closeSettings() { if (!this.settingsOpen) return; this.settingsOpen=false; this.settings.destroy(); }

    _refreshBest() {
      const b = readBest();
      this.stats.setText([
        `Highest Wave:              ${b.bestWave||0}`,
        `Most Corruption Cleared:   ${b.bestSecured||0}`,
        `Longest Life:              ${mmss(b.longestTime||0)}`
      ].join('\n'));
    }

    _layout() {
      this.W=this.scale.gameSize.width; this.H=this.scale.gameSize.height; this._drawFrame();
      this.title.setPosition(this.W/2,this.H*0.18); this.stats.setPosition(this.W/2,this.H*0.36);
      const ys=[0.52,0.60,0.68]; [this.btnPlay,this.btnReset,this.btnSet].forEach((b,i)=>{ b.r.setPosition(this.W/2,this.H*ys[i]); b.t.setPosition(b.r.x,b.r.y); });
    }

    _drawFrame() {
      const g=this.frame, W=this.scale.gameSize.width, H=this.scale.gameSize.height;
      g.clear(); g.lineStyle(3,0x1e87a5,0.9); g.strokeRect(10.5,10.5,W-21,H-21);
      g.lineStyle(1,0x15313d,0.7);
      for (let x=18;x<W;x+=18) g.lineBetween(x,10,x,H-10);
      for (let y=18;y<H;y+=18) g.lineBetween(10,y,W-10,y);
      g.alpha=0.15;
    }
  }

  window.HomeScene = HomeScene;
})();
