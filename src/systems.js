'use strict';

(function () {
  const TILE = 24;
  const State = { CLEAN: 0, CORRUPTED: 1, CLEANSED: 2 };

  // Sprite display sizes (in screen pixels). Change freely.
  const SPRITES = { defender: 40, virus: 28 };

  // ── Maze generation (connected, widened corridors + a few loops)
  function buildConnectedMaze(cols, rows) {
    const WALL = 1, PATH = 0;
    if (cols % 2 === 0) cols -= 1;
    if (rows % 2 === 0) rows -= 1;

    const g = Array.from({ length: rows }, () => Array(cols).fill(WALL));
    const inBounds = (x, y) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;

    let cx = (Math.floor(Math.random() * ((cols - 1) / 2)) * 2) + 1;
    let cy = (Math.floor(Math.random() * ((rows - 1) / 2)) * 2) + 1;

    const stack = [[cx, cy]];
    g[cy][cx] = PATH;
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]];

    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      Phaser.Utils.Array.Shuffle(dirs);
      let carved = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        if (g[ny][nx] === WALL) {
          g[y + dy / 2][x + dx / 2] = PATH;
          g[ny][nx] = PATH;
          stack.push([nx, ny]);
          carved = true;
          break;
        }
      }
      if (!carved) stack.pop();
    }

    // Widen single-file passages to 2 tiles
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        if (g[y][x] !== PATH) continue;
        const left=g[y][x-1]===PATH, right=g[y][x+1]===PATH, up=g[y-1][x]===PATH, down=g[y+1][x]===PATH;
        if ((left||right) && !(up||down)) g[y-1][x] = PATH;
        else if ((up||down) && !(left||right)) g[y][x-1] = PATH;
      }
    }

    // Add some loops
    const openings = Math.floor((cols * rows) / 120);
    for (let i = 0; i < openings; i++) {
      const rx = Phaser.Math.Between(2, cols - 3);
      const ry = Phaser.Math.Between(2, rows - 3);
      const n =
        (g[ry][rx - 1] === PATH) + (g[ry][rx + 1] === PATH) +
        (g[ry - 1][rx] === PATH) + (g[ry + 1][rx] === PATH);
      if (g[ry][rx] === WALL && n >= 2) g[ry][rx] = PATH;
    }

    return { WALL, PATH, grid: g, cols, rows };
  }

  // Helper to force-fit any PNG to our tile size
  function fitToTile(go) { go.setDisplaySize(TILE, TILE).setOrigin(0, 0); }

  class Grid {
    constructor(scene) {
      this.scene = scene;
      this.originX = 0;
      this.originY = 0;
      this.cols = 0;
      this.rows = 0;

      this.WALL = 1;
      this.PATH = 0;
      this.maze = null;

      this.pathStates = null; // CLEAN/CORRUPTED/CLEANSED for path tiles
      this.tiles = [];        // {x,y,img}
      this.walls = null;      // static physics group

      this.regenerate();
    }

    destroy() {
      if (this.walls) { this.walls.clear(true, true); this.walls.destroy(); this.walls = null; }
      for (const t of this.tiles) { try { t.img.destroy(); } catch {} }
      this.tiles.length = 0;
    }

    regenerate() {
      this.destroy();

      const W = this.scene.scale.gameSize.width;
      const H = this.scene.scale.gameSize.height;

      this.cols = Math.floor(W / TILE);
      this.rows = Math.floor(H / TILE);

      const { WALL, PATH, grid, cols, rows } = buildConnectedMaze(this.cols, this.rows);
      this.WALL = WALL; this.PATH = PATH;
      this.maze = grid; this.cols = cols; this.rows = rows;

      this.originX = Math.floor((W - this.cols * TILE) / 2);
      this.originY = Math.floor((H - this.rows * TILE) / 2);

      this.walls = this.scene.physics.add.staticGroup();
      this.pathStates = Array.from({ length: this.rows }, () => Array(this.cols).fill(State.CLEAN));

      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const wx = this.originX + x * TILE;
          const wy = this.originY + y * TILE;

          if (this.maze[y][x] === WALL) {
            const wall = this.walls.create(wx, wy, 'tileWall').setOrigin(0, 0);
            wall.setDisplaySize(TILE, TILE);
            wall.refreshBody();
          } else {
            const img = this.scene.add.image(wx, wy, 'tilePathClean');
            fitToTile(img);
            this.tiles.push({ x, y, img });
          }
        }
      }
      this.walls.refresh();
    }

    inBounds(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
    isPath(x, y)   { return this.inBounds(x, y) && this.maze[y][x] === this.PATH; }

    setState(x, y, val) {
      if (!this.isPath(x, y)) return;
      this.pathStates[y][x] = val;
      const tile = this.tiles.find(t => t.x === x && t.y === y);
      if (!tile) return;
      const img = tile.img;
      if (val === State.CLEAN)         img.setTexture('tilePathClean');
      else if (val === State.CORRUPTED) img.setTexture('tilePathCorrupt');
      else                              img.setTexture('tilePathCleansed');
    }

    getState(x, y) { return this.isPath(x, y) ? this.pathStates[y][x] : null; }

    tileAtWorld(x, y) {
      const tx = Math.floor((x - this.originX) / TILE);
      const ty = Math.floor((y - this.originY) / TILE);
      return { tx, ty, valid: this.isPath(tx, ty) };
    }

    randomEdgeSpawn(count = 2) {
      const cands = [];
      for (let y = 1; y < this.rows - 1; y++) {
        for (let x = 1; x < this.cols - 1; x++) {
          const edge = (x === 1 || y === 1 || x === this.cols - 2 || y === this.rows - 2);
          if (edge && this.isPath(x, y)) cands.push([x, y]);
        }
      }
      Phaser.Utils.Array.Shuffle(cands);
      for (let i = 0; i < count && i < cands.length; i++) {
        const [x, y] = cands[i];
        this.setState(x, y, State.CORRUPTED);
      }
    }

    spread(chance = 0.2) {
      const toCorrupt = [];
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.getState(x, y) === State.CORRUPTED) {
            for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
              const nx = x + dx, ny = y + dy;
              if (!this.isPath(nx, ny)) continue;
              if (this.getState(nx, ny) === State.CLEAN && Math.random() < chance) toCorrupt.push([nx, ny]);
            }
          }
        }
      }
      for (const [cx, cy] of toCorrupt) this.setState(cx, cy, State.CORRUPTED);
    }

    cleanseCircle(cx, cy, radius, maxPerTick = 8) {
      const r2 = radius * radius;
      let changed = 0;
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (this.getState(x, y) !== State.CORRUPTED) continue;
          const px = this.originX + x * TILE + TILE / 2;
          const py = this.originY + y * TILE + TILE / 2;
          const dx = px - cx, dy = py - cy;
          if (dx * dx + dy * dy <= r2) {
            this.setState(x, y, State.CLEAN);
            if (++changed >= maxPerTick) return changed;
          }
        }
      }
      return changed;
    }

    corruptedRatio() {
      let c = 0, tot = 0;
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          if (!this.isPath(x, y)) continue;
          tot++;
          if (this.getState(x, y) === State.CORRUPTED) c++;
        }
      }
      return tot > 0 ? (c / tot) : 0;
    }

    corruptedTiles() {
      const arr = [];
      for (let y = 0; y < this.rows; y++)
        for (let x = 0; x < this.cols; x++)
          if (this.getState(x, y) === State.CORRUPTED) arr.push([x, y]);
      return arr;
    }
  }

  function spawnEnemy(scene, grid, speed = 85) {
    const choices = grid.corruptedTiles();
    if (choices.length === 0) return null;

    const [tx, ty] = Phaser.Utils.Array.GetRandom(choices);
    const wx = grid.originX + tx * TILE + TILE / 2;
    const wy = grid.originY + ty * TILE + TILE / 2;

    const e = scene.physics.add.image(wx, wy, 'virusTex')
      .setDepth(5)
      .setCollideWorldBounds(true);

    // Force display size (independent of PNG pixels)
    e.setDisplaySize(SPRITES.virus, SPRITES.virus);

    // Physics body: circle centered inside the display size
    const r = Math.floor(SPRITES.virus / 2) - 2;
    const off = (SPRITES.virus / 2 - r);
    e.body.setCircle(r, off, off);

    e.setData('speed', speed);
    e.setData('alive', true);

    scene.enemies.add(e);
    scene.physics.add.collider(e, grid.walls);
    return e;
  }

  function updateEnemies(scene, player) {
    scene.enemies.children.iterate((e) => {
      if (!e || !e.getData('alive')) return;
      const spd = e.getData('speed');
      const v = new Phaser.Math.Vector2(player.x - e.x, player.y - e.y);
      if (v.lengthSq() > 1e-3) v.normalize().scale(spd);
      e.setVelocity(v.x, v.y);
    });
  }

  window.GD_CONST = { TILE, State };
  window.GD_SPRITES = SPRITES;
  window.Grid = Grid;
  window.spawnEnemy = spawnEnemy;
  window.updateEnemies = updateEnemies;
})();
