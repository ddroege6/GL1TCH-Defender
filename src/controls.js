'use strict';

(function () {
  // Lightweight placeholders so including this file never causes errors.
  class VirtualJoystick {
    constructor() {}
    destroy() {}
    get dir() { return new Phaser.Math.Vector2(0, 0); }
    get magnitude() { return 0; }
  }
  class ActionButton {
    constructor() {}
    isDown() { return false; }
    destroy() {}
  }
  class KeyboardControls {
    constructor(scene) { this.keys = scene.input.keyboard.addKeys('W,A,S,D'); }
    getVector() {
      const k=this.keys; let x=0,y=0;
      if (k.A.isDown) x-=1; if (k.D.isDown) x+=1; if (k.W.isDown) y-=1; if (k.S.isDown) y+=1;
      return new Phaser.Math.Vector2(x,y).normalize();
    }
  }
  class GamepadControls {
    constructor(scene){ this.scene=scene; this.pad=null;
      if (scene.input.gamepad) {
        if (scene.input.gamepad.total) this.pad=scene.input.gamepad.getPad(0);
        scene.input.gamepad.on('connected',(p)=>{ if(!this.pad) this.pad=p; });
        scene.input.gamepad.on('disconnected',(p)=>{ if(this.pad && this.pad.index===p.index) this.pad=null; });
      }
    }
    getVector(){
      if (!this.pad) return new Phaser.Math.Vector2(0,0);
      const x=this.pad.axes[0]?.getValue()||0, y=this.pad.axes[1]?.getValue()||0;
      return new Phaser.Math.Vector2(x,y).normalize();
    }
    pressedOnce(i){
      if (!this.pad) return false;
      this._states ||= {};
      const now = this.pad.buttons[i]?.pressed===true;
      const prev = !!this._states[i]; this._states[i]=now; return now && !prev;
    }
  }
  window.VirtualJoystick = VirtualJoystick;
  window.ActionButton = ActionButton;
  window.KeyboardControls = KeyboardControls;
  window.GamepadControls = GamepadControls;
})();
