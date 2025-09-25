# GL1TCH DEFENDER

*A fast, neon-soaked survival game built with **Phaser 3**.*

You’re an overworked IT in a cavernous server room. **Corruption** spreads tile-by-tile across the floor while **viruses** hunt you down. **Cleanse** the infected tiles to push the red wave back, **blink** to reposition through danger, weave through the server racks, and survive as long as you can.

Play the latest build:
**[https://ddroege6.github.io/GL1TCH-Defender/](https://ddroege6.github.io/GL1TCH-Defender/)**

---

## ✨ What’s the game now?

* **Pure Survival.** No base to protect—just you versus the spread. Stay alive and cleanse as much as possible.
* **Tile-by-tile Corruption.** Infection grows organically across a 24px grid; your cleanse aura replaces red tiles with safe ones.
* **Hunters.** Viruses retarget every few beats and swarm toward you. Contact = death.
* **Server Racks.** Two-wide rack columns create lanes and chokepoints. Between waves, some tiles scatter to new spots, reshaping the maze.
* **Quick Runs, Best Stats Saved.** Your best *Most Secured*, *Best Wave*, and *Longest Time* are recorded and shown on the title screen.

---

## 🎮 Controls

**Keyboard & Mouse**

* **Move:** `WASD` or Arrow Keys
* **Cleanse (hold):** `E` or `Shift` or **Left-click & hold**
* **Blink (short teleport):** `Space` or **Right-click** (quick tap)

> Tip: Hold cleanse to push back the corruption. Blink to escape corners or cut through lanes.

---

## 🕹️ How a run plays

1. **Corruption seeds** in a few places and begins to spread.
2. **You cleanse** tiles inside your soft aura (no hard edges; it fades nicely).
3. **Viruses spawn and hunt.** They bounce off racks and walls, regularly re-aiming at you.
4. **Wave timer ticks down.** When a wave ends, a portion of rack tiles **disperse** into new obstacles.
5. **You die on contact**—then choose **Retry** to jump right back in. Best stats persist between runs.

---

## ▶️ Run locally

**Quickest path (VS Code)**

1. Open the project folder in **VS Code**.
2. Install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server** (URL like `http://127.0.0.1:5500/`).

**Or, with a tiny server**

```bash
# from the project root
npx http-server -p 5500
# then open http://127.0.0.1:5500
```

---

## 🛠️ Tuning difficulty (optional)

Open `src/PlayScene.js` and edit the constants near the top:

* **Enemy pacing / caps**

  ```js
  ENEMIES: {
    speedMin: 60, speedMax: 110,
    spawnEvery: 1200, // ms
    retargetMS: 160
  },
  DIFFICULTY: {
    enemyCapStart: 6,
    enemyCapPerWave: 4
  }
  ```

* **Corruption behavior**

  ```js
  DIFFICULTY: {
    corruptionSeeds: 3,
    corruptionPerTick: 2,   // tiles grown per tick
    corruptionTickMS: 250   // growth cadence
  }
  ```

* **Rack layout & dispersal**

  ```js
  RACK_LAYOUT: { cols: 6, rows: 2, tilesHigh: 12, tilesWide: 2 }
  DIFFICULTY: {
    disperseStartPct: 0.04,     // portion of rack tiles to scatter Wave 2
    dispersePerWavePct: 0.02    // additional portion each wave after that
  }
  ```

* **Player feel**

  ```js
  PLAYER: {
    speed: 185,
    blinkDist: 180, blinkCooldown: 1.6,
    cleanseRadius: 72 // in px (3 tiles)
  }
  ```

---

## 🧰 Tech & structure

* **Engine:** Phaser 3 (vanilla, no build step)
* **Entry:** `index.html`
* **Scenes:** `src/BootScene.js`, `src/HomeScene.js`, `src/PlayScene.js`
* **Utilities:** `src/systems.js`, `src/controls.js`
* **Art:** Pixel sprites & tiles; cover art used on the title screen.

---

## ❓ Troubleshooting

* **Black screen?** Open DevTools → **Console**. Common causes:

  * Wrong file paths to images (check the `assets/` directory names).
  * Served from `file://` instead of a local server (use Live Server or `http-server`).
* **GitHub Pages shows an old build?** Wait a minute and hard-refresh (`Ctrl/Cmd+Shift+R`).
  If still stale, check the branch setting under **Settings → Pages** and that `index.html` is in the published branch.

---

## 📜 License & credits

* Code © 2025 Dylan Droege & contributors.
* Art assets © their respective owners (used with permission).
* This project is for learning and fun—feel free to fork and experiment.

---