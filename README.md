<img width="1536" height="1024" alt="Image" src="https://github.com/user-attachments/assets/374623bf-8202-4523-84b6-e6224fb802ab" />

# GL1TCH DEFENDER
_A neon, top-down arcade defense built with Phaser 3._

Corruption spreads across a synthetic grid while glitch-viruses hunt you. **Blink** to reposition. **Cleanse** to push back the spread. Secure sectors, survive waves, and keep the system from falling past 70% corruption.

---

## ▶️ Play / Run Locally
1) Open the folder in **VS Code**.  
2) Install the **Live Server** extension.  
3) Right-click `index.html` → **Open with Live Server**.  
   - Local URL will look like `http://127.0.0.1:5500/`.

> If you see a black screen, open DevTools → **Console** and check for missing asset paths (see Troubleshooting).

---

## 🎮 Controls

### Keyboard & Mouse (desktop)
- **Move:** `WASD` or Arrow Keys  
- **Blink:** `Space` or **Left-click (quick tap)**  
- **Cleanse (hold):** `Shift` or `E` or **Right-click**  
  - **Left-click & hold ≥ 250ms** also cleanses (no blink)

### Gamepad
- **Move:** Left Stick  
- **Blink:** **A / Cross**  
- **Cleanse (hold):** **RT / R2**

### Touch (experimental)
- **Tap:** Blink  
- **Press & hold:** Cleanse while held  
> Mobile movement UI is WIP. For now, pair a controller for the best mobile experience.

---

## 🕹️ Game Loop
- Each **wave** seeds new corruption and ramps difficulty.  
- **Corruption spreads** over time; cleanse tiles inside your aura to roll it back.  
- **Sector secured**: when all corruption is cleared, you score +1 and new seeds spawn.  
- **Lose** at **70% corruption** or on direct enemy contact.  
- Every **5 waves**, the “motherboard” layout reconfigures to keep runs fresh.

---

## Play Online
- https://ddroege6.github.io/GL1TCH-Defender/
