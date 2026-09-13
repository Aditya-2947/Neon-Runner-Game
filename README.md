# ⚡ Neon Run: Elimination | 3D Endless Runner

A high-octane, cyberpunk-themed 3D endless runner game built with **Three.js**, **Vanilla JavaScript (ES6 Modules)**, and the **Web Audio API**. Race against AI opponents in an elimination championship where only the last runner standing claims victory.

---

## 🎮 Play & Controls

### Keyboard Controls
| Action | Key Mappings | Description |
| :--- | :--- | :--- |
| **Move Left / Right** | <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> | Switch between the 3 track lanes |
| **Jump** | <kbd>W</kbd>, <kbd>↑</kbd>, or <kbd>Space</kbd> | Leap over gaps, boulders, and fire pits |
| **Slide** | <kbd>S</kbd>, <kbd>↓</kbd>, or <kbd>Shift</kbd> | Crouch and slide under overhead low beams |

### Touch / Mobile Controls
- **Swipe Left / Right**: Switch lanes
- **Swipe Up**: Jump
- **Swipe Down**: Slide

---

## ✨ Key Features

- **🏆 Real-Time Elimination Battle Royale**: Compete against 4, 6, or 9 AI bot competitors. As hazards strike, runners are eliminated in real-time.
- **🛣️ Procedural Curved Endless Track**: Infinitely generating track segments with sinusoidal winding curves, procedural obstacles, gaps, and collectible coins.
- **🤖 Intelligent Bot AI**: Opponent bots scan the road ahead, calculate evasive maneuvers (lane switches, jumping, sliding), and make probabilistic mistakes that increase with speed.
- **👁️ Post-Death Spectator Mode**: If eliminated, switch to spectator mode to watch the remaining AI bots battle for 1st place.
- **🎵 Zero-Asset Procedural Audio Synthesizer**: Complete retro-synthwave soundtrack and dynamic sound effects generated on-the-fly using the Web Audio API.
- **💥 Dynamic Particle Engine**: Explosion bursts upon hazard collisions, runner foot trail dust, and sparkling coin pickups.
- **🎨 Customization & Aesthetics**: Cyberpunk synthwave palette, custom runner names, color selection, retro wireframe horizon sun, and glassmorphic HUD.

---

## 📁 Project Architecture

```
simple game/
├── index.html          # HTML5 entry point & UI overlays
├── style.css           # Futuristic glassmorphism & responsive CSS
├── README.md           # Quickstart and overview
├── DOCUMENTATION.md    # In-depth technical architecture & API reference
└── src/
    ├── game.js         # Main game loop, state manager & Three.js scene
    ├── track.js        # Procedural track generator, curving & collision queries
    ├── runner.js       # Player physics, animation & autonomous Bot AI
    └── audio.js        # Web Audio API real-time sound & music synthesizer
```

---

## 🚀 How to Run Locally

You can run this game using any local static HTTP server:

### Option 1: Python HTTP Server
```bash
# Python 3
python -m http.server 8000
```
Then navigate to `http://localhost:8000` in your web browser.

### Option 2: Node.js `npx serve` or `live-server`
```bash
npx serve .
```

### Option 3: VS Code Live Server
Right-click `index.html` and click **"Open with Live Server"**.

---

## 📖 In-Depth Documentation

For complete technical specifications, class references, coordinate math, and AI behavior logic, see **[DOCUMENTATION.md](DOCUMENTATION.md)**.
