// src/game.js - Main Game Orchestrator and Three.js Engine

import { audio } from './audio.js?t=20260704214800';
import { TrackManager, LANE_X_POSITIONS } from './track.js?t=20260704214800';
import { Runner, BotRunner } from './runner.js?t=20260704214800';

// Feature flags for Phase 2 systems
const GAME_CONFIG = {
    enableShield: true,
    enableMagnet: true,
    enableOverdrive: true,
    enableEMP: true,
    enableCompoundHazards: true,
    enableSlidingHazards: true,
    enableRiskCoins: true,
    enableDash: true,
    compoundHazardDistanceThreshold: 1000,
    slidingHazardDistanceThreshold: 800,
};

class GameController {
    constructor() {
        // Game States: 'START', 'COUNTDOWN', 'PLAYING', 'GAME_OVER'
        this.gameState = 'START';
        
        // Three.js Core
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // Game Systems
        this.trackManager = null;
        this.player = null;
        this.runners = []; // Player + Bots
        
        // Difficulty and Speed (2x running speed)
        this.baseSpeed = 16.0;
        this.currentSpeed = this.baseSpeed;
        this.maxSpeed = 40.0;
        this.timeElapsed = 0;
        this.lastSpeedMilestone = 0;
        
        // Particle Engine
        this.particles = [];

        // Camera Shake
        this.cameraShake = { intensity: 0, duration: 0, elapsed: 0 };
        
        // Slow-Mo Effect
        this.slowMo = { active: false, multiplier: 0.3, duration: 0.4, elapsed: 0 };
        
        // Combo System
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.comboWindow = 2.0;
        this.lastComboTime = 0;
        this.nearMissScore = 0;
        this.nearMissedObstacles = new Set();

        // DOM elements
        this.dom = {
            startScreen: document.getElementById('start-screen'),
            hud: document.getElementById('hud'),
            gameOverScreen: document.getElementById('game-over-screen'),
            startBtn: document.getElementById('start-btn'),
            retryBtn: document.getElementById('retry-btn'),
            botCount: document.getElementById('bot-count'),
            colorBtns: document.querySelectorAll('.color-btn'),
            
            // HUD
            hudDistance: document.getElementById('hud-distance'),
            hudRunners: document.getElementById('hud-runners-count'),
            hudCoins: document.getElementById('hud-coins'),
            hudSpeed: document.getElementById('hud-speed'),
            leaderboardList: document.getElementById('leaderboard-list'),
            announcement: document.getElementById('announcement-banner'),
            countdownOverlay: document.getElementById('countdown-overlay'),
            countdownNumber: document.getElementById('countdown-number'),
            
            // Game Over
            endTitle: document.getElementById('end-title'),
            endSubtitle: document.getElementById('end-subtitle'),
            summaryRank: document.getElementById('summary-rank'),
            summaryDistance: document.getElementById('summary-distance'),
            summaryCoins: document.getElementById('summary-coins'),
            summaryTime: document.getElementById('summary-time'),
            spectateBtn: document.getElementById('spectate-btn'),
            comboBox: document.getElementById('combo-box'),
            hudCombo: document.getElementById('hud-combo'),
            staminaFill: document.getElementById('stamina-bar-fill'),
            victoryQuitContainer: document.getElementById('victory-quit-container'),
            victoryQuitBtn: document.getElementById('victory-quit-btn'),
            quitMenuBtn: document.getElementById('quit-menu-btn')
        };
        
        // Track ranking deltas for 3D UI
        this.prevRanks = new Map();
        this.hasWon = false; // Player victory run flag
        
        // Configs
        this.selectedColor = '#00f3ff';
        this.isSpectating = false;
        
        this.initThree();
        this.setupEvents();
        this.animate();
    }

    initThree() {
        const canvas = document.getElementById('game-canvas');
        
        // Create Scene with space cyberpunk theme colors
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x07050f);
        // Exponential fog makes track elements fade into neon darkness
        this.scene.fog = new THREE.FogExp2(0x07050f, 0.0065);

        // Perspective Camera
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        // WebGL Renderer (optimized: shadows disabled for 60fps performance on all devices)
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = false;

        // Ambient & Directional Lights
        const ambientLight = new THREE.AmbientLight(0x19143a, 1.3);
        this.scene.add(ambientLight);

        // Neon Pink and Blue hemisphere lighting adds premium rim highlights
        const hemiLight = new THREE.HemisphereLight(0xff00ff, 0x0000ff, 0.7);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        // Dynamic directional light (no shadow mapping overhead)
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        this.dirLight.position.set(20, 40, 20);
        this.scene.add(this.dirLight);

        // Build scenic environment accents: glowing grid landscape
        this.createEnvironmentGrid();

        // Add glowing retro synthwave sun in the far distance
        const sunGroup = new THREE.Group();
        sunGroup.position.set(0, 10, -450); // horizon Z offset
        
        const sunGeom = new THREE.CircleGeometry(55, 32);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xff0066, side: THREE.DoubleSide });
        const sunMesh = new THREE.Mesh(sunGeom, sunMat);
        sunGroup.add(sunMesh);

        // Dark retro slice grids typical of 80s artwork
        const sliceSpacing = 4.5;
        for (let y = -50; y < 15; y += sliceSpacing) {
            const slice = new THREE.Mesh(
                new THREE.BoxGeometry(120, 1.2, 1),
                new THREE.MeshBasicMaterial({ color: 0x07050f }) // matches space fog background
            );
            slice.position.set(0, y, 0.2); // offset forward to clip sun
            sunGroup.add(slice);
        }
        this.scene.add(sunGroup);
        this.sunGroup = sunGroup;

        // Instantiate Track
        this.trackManager = new TrackManager(this.scene);
    }

    createEnvironmentGrid() {
        // Spawn low-poly neon pyramids / floating prisms on sides of the track
        this.sceneryGroup = new THREE.Group();
        this.scene.add(this.sceneryGroup);

        const geom = new THREE.ConeGeometry(1.5, 4, 4);
        const wireGeom = new THREE.ConeGeometry(1.55, 4.05, 4);
        
        // Spawn 40 scenic items on the left and right borders of the track
        for (let i = 0; i < 30; i++) {
            const side = Math.random() < 0.5 ? -1 : 1;
            const x = (LANE_X_POSITIONS[2] + 8 + Math.random() * 20) * side;
            const z = -(i * 25) - 30;
            
            const matColor = Math.random() < 0.5 ? 0xbd00ff : 0x00f3ff;
            const mat = new THREE.MeshPhongMaterial({
                color: matColor,
                flatShading: true,
                shininess: 10
            });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(x, 1.5, z);
            mesh.rotation.y = Math.random() * Math.PI;
            mesh.scale.setScalar(0.7 + Math.random() * 1.5);
            
            // Wireframe overlay for glowing cyber look
            const wireMat = new THREE.MeshBasicMaterial({ color: matColor, wireframe: true, transparent: true, opacity: 0.3 });
            const wire = new THREE.Mesh(wireGeom, wireMat);
            mesh.add(wire);

            this.sceneryGroup.add(mesh);
        }
    }

    updateScenery(playerZ) {
        // Move scenery forward (recycle pyramids) as player advances
        this.sceneryGroup.children.forEach((mesh) => {
            // Since player runs in negative Z, if mesh is more positive than player.z + 50
            if (mesh.position.z > playerZ + 50) {
                // Recycle far ahead
                mesh.position.z -= 750;
                mesh.position.y = 1.0 + Math.random() * 2;
                mesh.scale.setScalar(0.7 + Math.random() * 1.5);
            }
        });
    }

    setupEvents() {
        // Resize handler
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Color buttons configuration
        this.dom.colorBtns.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                this.dom.colorBtns.forEach((b) => {
                    b.classList.remove('active');
                    b.style.boxShadow = 'none';
                });
                const color = btn.getAttribute('data-color');
                btn.classList.add('active');
                btn.style.boxShadow = `0 0 15px ${color}`;
                this.selectedColor = color;
            });
        });

        // Setup User action triggers
        this.dom.startBtn.addEventListener('click', () => {
            audio.init();
            this.startCountdown();
        });

        this.dom.retryBtn.addEventListener('click', () => {
            this.resetGame();
            this.startCountdown();
        });

        this.dom.spectateBtn.addEventListener('click', () => {
            this.isSpectating = true;
            this.dom.gameOverScreen.classList.remove('active');
            this.dom.hud.classList.add('active');
            this.gameState = 'PLAYING';
            this.clock.getDelta(); // reset clock delta to prevent jump
        });

        if (this.dom.victoryQuitBtn) {
            this.dom.victoryQuitBtn.addEventListener('click', () => {
                this.endGame();
            });
        }

        if (this.dom.quitMenuBtn) {
            this.dom.quitMenuBtn.addEventListener('click', () => {
                this.resetGame();
                this.dom.gameOverScreen.classList.remove('active');
                this.dom.hud.classList.remove('active');
                this.dom.startMenu.classList.add('active');
                this.gameState = 'START';
            });
        }

        // Input Keyboard mappings
        window.addEventListener('keydown', (e) => {
            if (this.gameState !== 'PLAYING' || !this.player || this.player.isEliminated) return;
            
            switch (e.key) {
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    if (this.player.moveLeft()) audio.playSlide(); // quick soft slide sound
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    if (this.player.moveRight()) audio.playSlide();
                    break;
                case 'ArrowUp':
                case 'w':
                case 'W':
                case ' ': // Space
                    if (this.player.jump()) audio.playJump();
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                case 'Shift':
                    if (this.player.slide()) audio.playSlide();
                    break;
                case 'e':
                case 'E':
                    if (GAME_CONFIG.enableDash && this.player.dash()) {
                        audio.playDash();
                    }
                    break;
                case 'q':
                case 'Q':
                case 'Escape':
                    if (this.hasWon) {
                        this.endGame();
                    }
                    break;
            }
        });

        // Touch & Swipe Controls
        let touchStartX = 0;
        let touchStartY = 0;
        const minSwipeDistance = 35; // px

        window.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            if (this.gameState !== 'PLAYING' || !this.player || this.player.isEliminated) return;

            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;

            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Determine if horizontal or vertical swipe was larger
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (Math.abs(diffX) > minSwipeDistance) {
                    if (diffX > 0) {
                        if (this.player.moveRight()) audio.playSlide();
                    } else {
                        if (this.player.moveLeft()) audio.playSlide();
                    }
                }
            } else {
                if (Math.abs(diffY) > minSwipeDistance) {
                    if (diffY < 0) {
                        if (this.player.jump()) audio.playJump();
                    } else {
                        if (this.player.slide()) audio.playSlide();
                    }
                }
            }
        }, { passive: true });
    }

    startCountdown() {
        this.gameState = 'COUNTDOWN';
        this.dom.startScreen.classList.remove('active');
        this.dom.gameOverScreen.classList.remove('active');
        this.dom.hud.classList.add('active');
        
        // Prepare runners list
        this.setupRunners();
        
        // Display 3-2-1 Go count
        let count = 3;
        this.dom.countdownOverlay.classList.add('active');
        this.dom.countdownNumber.innerText = count;
        this.dom.countdownNumber.className = 'pulse-animation';

        audio.playSpeedUp(); // Play entry chime

        const countdownInterval = setInterval(() => {
            count--;
            if (count > 0) {
                this.dom.countdownNumber.innerText = count;
                // Force animation retrigger
                this.dom.countdownNumber.classList.remove('pulse-animation');
                void this.dom.countdownNumber.offsetWidth; // trigger reflow
                this.dom.countdownNumber.classList.add('pulse-animation');
                audio.playJump(); // tick sound
            } else if (count === 0) {
                this.dom.countdownNumber.innerText = "GO!";
                this.dom.countdownNumber.classList.remove('pulse-animation');
                void this.dom.countdownNumber.offsetWidth;
                this.dom.countdownNumber.classList.add('pulse-animation');
                audio.playVictory();
            } else {
                clearInterval(countdownInterval);
                this.dom.countdownOverlay.classList.remove('active');
                this.gameState = 'PLAYING';
                this.clock.getDelta(); // Reset clock delta
            }
        }, 900);
    }

    setupRunners() {
        // Clear old runners
        this.runners.forEach((r) => r.destroy());
        this.runners = [];
        
        this.isSpectating = false;
        this.dom.spectateBtn.style.display = 'none';
        
        // Start background music loop
        audio.stopMusic();
        audio.startMusic();
        
        // 1. Create player with custom name
        const playerNameInput = document.getElementById('player-name');
        const playerName = playerNameInput ? (playerNameInput.value.trim() || "YOU") : "YOU";
        
        this.player = new Runner(this.scene, playerName + " (Player)", this.selectedColor, true);
        this.runners.push(this.player);

        // 2. Create Bots
        const count = parseInt(this.dom.botCount.value, 10);
        
        const botNames = [
            "Turbo Todd", "Swift Sarah", "Cyber Chase", "Rusty Rex", 
            "Apex Alex", "Gitchy Gaby", "Vector", "Helix", "Echo", "Quantum"
        ];
        const botColors = [
            "#ff007f", "#39ff14", "#ff9900", "#bd00ff", 
            "#ffff00", "#ff3333", "#ffffff", "#00ffff", "#e6a8ff", "#55ff00"
        ];

        // Shuffle names
        const names = [...botNames].sort(() => 0.5 - Math.random());
        const colors = [...botColors].sort(() => 0.5 - Math.random());

        for (let i = 0; i < count; i++) {
            const successRate = 0.91 + (Math.random() * 0.05);
            const bot = new BotRunner(this.scene, names[i], colors[i], successRate);
            
            // Assign bot profile: ~30% cautious, ~30% aggressive, ~40% erratic
            const profileRoll = Math.random();
            if (profileRoll < 0.3) bot.setProfile('cautious');
            else if (profileRoll < 0.6) bot.setProfile('aggressive');
            else bot.setProfile('erratic');
            
            // Space them out slightly on start
            bot.z = Math.random() * 4;
            bot.mesh.position.z = bot.z;
            
            // Random start lane
            bot.lane = Math.floor(Math.random() * 3);
            bot.targetX = LANE_X_POSITIONS[bot.lane];
            bot.x = bot.targetX;
            bot.mesh.position.x = bot.x;
            
            this.runners.push(bot);
        }

        this.currentSpeed = this.baseSpeed;
        this.timeElapsed = 0;
        this.lastSpeedMilestone = 0;
        
        this.trackManager.reset();
        this.updateLeaderboardUI();
    }

    resetGame() {
        // Clear particles
        this.particles.forEach((p) => this.scene.remove(p.mesh));
        this.particles = [];
        
        // Reset combo
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.lastComboTime = 0;
        this.nearMissScore = 0;
        this.nearMissedObstacles = new Set();
        this.prevRanks.clear();
        this.hasWon = false;
        if (this.dom.comboBox) this.dom.comboBox.style.display = 'none';
        if (this.dom.victoryQuitContainer) this.dom.victoryQuitContainer.style.display = 'none';
        
        // Reset shake and slowmo
        this.cameraShake = { intensity: 0, duration: 0, elapsed: 0 };
        this.slowMo = { active: false, multiplier: 0.3, duration: 0.4, elapsed: 0 };
    }

    // Camera Shake Effect
    triggerShake(intensity = 0.3, duration = 0.25) {
        this.cameraShake.intensity = intensity;
        this.cameraShake.duration = duration;
        this.cameraShake.elapsed = 0;
    }

    // Combo System
    incrementCombo() {
        this.comboCount++;
        this.lastComboTime = this.timeElapsed;
        const oldMult = this.comboMultiplier;
        
        if (this.comboCount >= 30) this.comboMultiplier = 8;
        else if (this.comboCount >= 15) this.comboMultiplier = 4;
        else if (this.comboCount >= 5) this.comboMultiplier = 2;
        else this.comboMultiplier = 1;
        
        // Update HUD
        if (this.dom.comboBox) {
            this.dom.comboBox.style.display = this.comboCount > 0 ? 'flex' : 'none';
        }
        if (this.dom.hudCombo) {
            this.dom.hudCombo.innerText = `${this.comboCount} (${this.comboMultiplier}x)`;
            this.dom.hudCombo.classList.remove('combo-pulse', 'combo-pop');
            void this.dom.hudCombo.offsetWidth;
            this.dom.hudCombo.classList.add(this.comboMultiplier > oldMult ? 'combo-pop' : 'combo-pulse');
        }
        
        // Play fanfare on tier up
        if (this.comboMultiplier > oldMult) {
            audio.playSpeedUp();
            this.showAnnouncement(`🔥 COMBO ${this.comboMultiplier}x MULTIPLIER!`);
        }
    }

    resetCombo() {
        this.comboCount = 0;
        this.comboMultiplier = 1;
        if (this.dom.comboBox) this.dom.comboBox.style.display = 'none';
        if (this.dom.hudCombo) this.dom.hudCombo.innerText = '0';
    }

    // Particle Burst System
    spawnExplosion(x, y, z, colorHex, count = 25, size = 0.2) {
        const geom = new THREE.BoxGeometry(size, size, size);
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });

        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(geom, mat);
            particle.position.set(x, y, z);
            
            // Add random velocities
            const vx = (Math.random() - 0.5) * 12;
            const vy = (Math.random() * 8) + 2;
            const vz = (Math.random() - 0.5) * 12;
            
            this.scene.add(particle);
            
            this.particles.push({
                mesh: particle,
                vx: vx,
                vy: vy,
                vz: vz,
                life: 1.0, // seconds
                maxLife: 1.0
            });
        }
    }

    // Runner foot trail dust particles
    spawnDust(x, z) {
        const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color: 0x5a5382, transparent: true, opacity: 0.6 });
        
        const particle = new THREE.Mesh(geom, mat);
        particle.position.set(x + (Math.random() - 0.5) * 0.4, 0.05, z);
        
        this.scene.add(particle);
        this.particles.push({
            mesh: particle,
            vx: (Math.random() - 0.5) * 2,
            vy: Math.random() * 2,
            vz: Math.random() * 2 + 1, // blow back relative to runner speed
            life: 0.4,
            maxLife: 0.4
        });
    }

    updateParticles(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            // Apply velocity
            p.mesh.position.x += p.vx * deltaTime;
            p.mesh.position.y += p.vy * deltaTime;
            p.mesh.position.z += p.vz * deltaTime;
            
            // Apply gravity to explosion particles
            if (p.maxLife >= 1.0) {
                p.vy += -9.8 * deltaTime; // gravity
            }

            // Fade out
            p.mesh.material.opacity = p.life / p.maxLife;
            p.mesh.scale.setScalar(p.life / p.maxLife);
        }
    }

    showAnnouncement(text, speedUp = false) {
        this.dom.announcement.innerText = text;
        this.dom.announcement.className = 'show';
        if (speedUp) {
            this.dom.announcement.classList.add('speed-up');
        }
        
        // Hide after 3 seconds
        setTimeout(() => {
            if (this.dom.announcement.innerText === text) {
                this.dom.announcement.className = '';
            }
        }, 3000);
    }

    handleCollisions() {
        const activeObstacles = this.trackManager.getActiveObstacles();
        const activeCoins = this.trackManager.getActiveCoins();

        this.runners.forEach((runner) => {
            if (runner.isEliminated) return;

            // Get runner's current bounds
            const rBounds = runner.getBoundingBox();

            // 1. Check Gaps (if runner is on ground level y <= 0.05 and not jumping)
            if (runner.y <= 0.05 && !runner.isJumping) {
                const floorExists = this.trackManager.hasFloorAt(runner.x, runner.z);
                if (!floorExists) {
                    const elimRes = runner.eliminate("gap");
                    if (elimRes === "shield_absorbed") {
                        audio.playShieldBreak();
                        this.spawnExplosion(runner.x, 0.4, runner.z, "#00f3ff", 20, 0.15);
                        if (runner.isPlayer) {
                            this.showAnnouncement("🛡️ SHIELD SAVED FROM GAP!");
                            this.triggerShake(0.25, 0.15);
                        }
                        return;
                    }
                    if (elimRes === "dash_dodged") return;

                    this.spawnExplosion(runner.x, 0, runner.z, runner.color, 12, 0.15);
                    audio.playElimination();
                    this.announceElimination(runner, "fell into a gap");
                    
                    if (runner.isPlayer) {
                        this.triggerShake(0.5, 0.3);
                        this.resetCombo();
                        this.handlePlayerDeath();
                    } else {
                        this.triggerShake(0.3, 0.25);
                    }
                    return;
                }
            }

            // 2. Check Obstacles
            activeObstacles.forEach((obs) => {
                // If the obstacle is further behind or too far ahead, skip checks
                if (Math.abs(runner.z - obs.worldZ) > 4) return;

                // Create AABB for obstacle
                // For low beams, width is track width and height is upper region.
                const obsMinX = obs.worldX - obs.width / 2;
                const obsMaxX = obs.worldX + obs.width / 2;
                const obsMinY = obs.localYPos - obs.height / 2;
                const obsMaxY = obs.localYPos + obs.height / 2;
                const obsMinZ = obs.worldZ - obs.length / 2;
                const obsMaxZ = obs.worldZ + obs.length / 2;

                // Box intersection check
                const intersectX = rBounds.maxX >= obsMinX && rBounds.minX <= obsMaxX;
                const intersectY = rBounds.maxY >= obsMinY && rBounds.minY <= obsMaxY;
                const intersectZ = rBounds.maxZ >= obsMinZ && rBounds.minZ <= obsMaxZ;

                if (intersectX && intersectY && intersectZ) {
                    // Collision!
                    const elimRes = runner.eliminate(obs.type);
                    if (elimRes === "shield_absorbed") {
                        audio.playShieldBreak();
                        this.spawnExplosion(runner.x, runner.y + 0.8, runner.z, "#00f3ff", 20, 0.15);
                        if (runner.isPlayer) {
                            this.showAnnouncement("🛡️ SHIELD BROKE!");
                            this.triggerShake(0.25, 0.15);
                        }
                        return;
                    }
                    if (elimRes === "dash_dodged") return;
                    
                    // Spawn dramatic colorful low-poly particle explosion
                    this.spawnExplosion(runner.x, runner.y + 0.8, runner.z, runner.color, 35, 0.2);
                    audio.playElimination();
                    
                    // Format obstacle name for user message
                    let hazardName = "obstacle";
                    if (obs.type === 'rock') hazardName = "a boulder";
                    if (obs.type === 'low_beam') hazardName = "a low beam";
                    if (obs.type === 'fire_pit') hazardName = "a fire pit";

                    this.announceElimination(runner, `hit ${hazardName}`);

                    // Camera shake and combo reset on elimination
                    if (runner.isPlayer) {
                        this.triggerShake(0.5, 0.3);
                        this.resetCombo();
                        this.handlePlayerDeath();
                    } else {
                        this.triggerShake(0.3, 0.25);
                    }
                }

                // Near-miss detection (player only)
                if (runner.isPlayer && !runner.isEliminated && !(intersectX && intersectY && intersectZ) && intersectZ) {
                    const NEAR_MISS_MARGIN = 0.5;
                    let isNearMiss = false;
                    
                    if (intersectX && !intersectY) {
                        // Cleared vertically (slide under beam, jump over pit)
                        const ySep = Math.max(obsMinY - rBounds.maxY, rBounds.minY - obsMaxY);
                        if (ySep > 0 && ySep < NEAR_MISS_MARGIN) isNearMiss = true;
                    } else if (!intersectX && intersectY) {
                        // Cleared laterally (lane dodge)
                        const xSep = Math.max(obsMinX - rBounds.maxX, rBounds.minX - obsMaxX);
                        if (xSep > 0 && xSep < NEAR_MISS_MARGIN) isNearMiss = true;
                    }
                    
                    if (isNearMiss) {
                        const obsId = `${obs.type}_${Math.round(obs.worldZ)}`;
                        if (!this.nearMissedObstacles.has(obsId)) {
                            this.nearMissedObstacles.add(obsId);
                            this.nearMissScore += 10;
                            this.incrementCombo();
                            audio.playNearMiss();
                            this.showAnnouncement('✨ NEAR MISS! +10');
                        }
                    }
                }
            });

            // 3. Check Coins (only player collects coins to simplify score)
            if (runner.isPlayer) {
                activeCoins.forEach((coinData) => {
                    const coin = coinData.coinObj;
                    if (coin.collected) return;

                    // Magnet effect: pull coins toward player
                    if (runner.activeEffects.magnet) {
                        const pullRadius = 8;
                        const dx = runner.x - coinData.worldX;
                        const dz = runner.z - coinData.worldZ;
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        if (dist < pullRadius && dist > 0.5) {
                            coin.mesh.position.x += (dx / dist) * 0.3;
                            coin.mesh.position.z += (dz / dist) * 0.3;
                            // Update world positions for collection check
                            coinData.worldX = coin.mesh.position.x + coinData.segment.container.position.x;
                            coinData.worldZ = coinData.segment.z + coin.relZ + (coin.mesh.position.z - coin.relZ);
                        }
                    }

                    // Simple radial distance check
                    const dx = runner.x - coinData.worldX;
                    const dy = runner.y + 0.8 - coinData.worldY;
                    const dz = runner.z - coinData.worldZ;
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

                    if (distance < 1.3) {
                        coin.collected = true;
                        coinData.segment.container.remove(coin.mesh);
                        
                        const coinValue = (coin.value || 1) * this.comboMultiplier;
                        runner.coinsCollected += coinValue;
                        this.dom.hudCoins.innerText = runner.coinsCollected;
                        
                        this.incrementCombo();
                        
                        audio.playCoin();
                        this.spawnExplosion(coinData.worldX, coinData.worldY, coinData.worldZ, "#ffd700", 12, 0.12);
                    }
                });

                // 4. Check Power-ups
                const activePowerUps = this.trackManager.getActivePowerUps();
                activePowerUps.forEach((puData) => {
                    const pu = puData.puObj;
                    if (pu.collected) return;

                    const dx = runner.x - puData.worldX;
                    const dy = (runner.y + 0.8) - puData.worldY;
                    const dz = runner.z - puData.worldZ;
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

                    if (distance < pu.radius) {
                        pu.collected = true;
                        puData.segment.container.remove(pu.mesh);

                        if (pu.type === 'emp') {
                            // EMP: stun all bots
                            this.runners.forEach((r) => {
                                if (r instanceof BotRunner && !r.isEliminated) {
                                    r.stun(2.5);
                                }
                            });
                            audio.playEMP();
                            this.showAnnouncement('⚡ EMP PULSE! Bots stunned!');
                        } else {
                            runner.applyPowerUp(pu.type);
                            audio.playPowerUp();
                            const puNames = { shield: '🛡️ SHIELD', magnet: '🧲 MAGNET', overdrive: '🔥 OVERDRIVE' };
                            this.showAnnouncement(`${puNames[pu.type] || pu.type} ACTIVATED!`);
                        }

                        this.spawnExplosion(puData.worldX, puData.worldY, puData.worldZ, "#ffffff", 20, 0.15);
                    }
                });

                // 5. Dash bot-bump: if player is dashing, check for adjacent bots
                if (GAME_CONFIG.enableDash && runner.isDashing) {
                    this.runners.forEach((bot) => {
                        if (bot === runner || bot.isEliminated || !(bot instanceof BotRunner)) return;
                        const bx = runner.x - bot.x;
                        const bz = runner.z - bot.z;
                        const bDist = Math.sqrt(bx*bx + bz*bz);
                        if (bDist < 2.0) {
                            bot.eliminate('bumped');
                            this.spawnExplosion(bot.x, bot.y + 0.8, bot.z, bot.color, 30, 0.2);
                            audio.playElimination();
                            this.announceElimination(bot, 'was bumped by the player');
                            this.triggerShake(0.4, 0.2);
                        }
                    });
                }
            }
        });
    }

    announceElimination(runner, reasonText) {
        const countRemaining = this.runners.filter((r) => !r.isEliminated).length;
        const msg = `⚡ ${runner.name} ${reasonText}! (${countRemaining} remaining)`;
        this.showAnnouncement(msg);
        this.updateLeaderboardUI();
    }

    handlePlayerDeath() {
        // Activate slow-mo effect before game over
        this.slowMo.active = true;
        this.slowMo.elapsed = 0;
    }

    updateLeaderboardUI() {
        // Sort active runners based on who is further ahead (which means smaller/more negative Z!)
        // Sort order: least z (closest to negative infinity) to greatest z
        const sortedRunners = [...this.runners].sort((a, b) => {
            if (a.isEliminated && !b.isEliminated) return 1;
            if (!a.isEliminated && b.isEliminated) return -1;
            
            if (a.isEliminated && b.isEliminated) {
                // If both eliminated, sort by distance run (larger distance = higher rank)
                return b.distanceRun - a.distanceRun;
            }
            // Both active: compare Z
            return a.z - b.z; // negative value comparison
        });

        // Regenerate leaderboard DOM list
        this.dom.leaderboardList.innerHTML = '';
        
        sortedRunners.forEach((runner, idx) => {
            const rank = idx + 1;
            const prevRank = this.prevRanks.get(runner.name);
            let rankDeltaHtml = '';
            if (prevRank !== undefined && !runner.isEliminated) {
                if (rank < prevRank) {
                    rankDeltaHtml = `<span class="rank-delta up">▲</span>`;
                } else if (rank > prevRank) {
                    rankDeltaHtml = `<span class="rank-delta down">▼</span>`;
                }
            }
            this.prevRanks.set(runner.name, rank);

            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            if (runner.isPlayer) item.classList.add('player');
            if (runner.isEliminated) item.classList.add('eliminated');

            const rankLabel = (runner.isPlayer && this.hasWon) ? `👑 1` : rank;
            item.innerHTML = `
                <div class="runner-rank-name">
                    <span class="runner-rank">${rankLabel}${rankDeltaHtml}</span>
                    <span class="runner-color-dot" style="background-color: ${runner.color}"></span>
                    <span class="runner-name">${runner.name}</span>
                </div>
                <div class="runner-dist">${runner.isEliminated ? 'OUT' : runner.distanceRun + 'm'}</div>
            `;
            this.dom.leaderboardList.appendChild(item);
        });

        // Update overall count
        const total = this.runners.length;
        const active = this.runners.filter((r) => !r.isEliminated).length;
        this.dom.hudRunners.innerText = (this.hasWon && !this.player.isEliminated)
            ? `👑 WINNER (1/${total})`
            : `${active} / ${total}`;
    }

    endGame() {
        audio.stopMusic(); // shut off background tracker

        this.gameState = 'GAME_OVER';
        this.dom.hud.classList.remove('active');
        this.dom.gameOverScreen.classList.add('active');
        if (this.dom.victoryQuitContainer) this.dom.victoryQuitContainer.style.display = 'none';

        // Determine Player Placement
        const total = this.runners.length;
        
        // Find player rank in sorted list
        const sorted = [...this.runners].sort((a, b) => {
            if (a.isEliminated && !b.isEliminated) return 1;
            if (!a.isEliminated && b.isEliminated) return -1;
            if (a.isEliminated && b.isEliminated) return b.distanceRun - a.distanceRun;
            return a.z - b.z;
        });

        const playerRank = sorted.findIndex((r) => r.isPlayer) + 1;
        
        // Formulate rank string: 1st, 2nd, 3rd, 4th, etc.
        let rankSuffix = "th";
        if (playerRank === 1) rankSuffix = "st";
        else if (playerRank === 2) rankSuffix = "nd";
        else if (playerRank === 3) rankSuffix = "rd";

        this.dom.summaryRank.innerText = `${playerRank}${rankSuffix} / ${total}`;
        
        this.dom.summaryDistance.innerText = `${this.player.distanceRun}m`;
        this.dom.summaryCoins.innerText = this.player.coinsCollected;
        this.dom.summaryTime.innerText = `${Math.floor(this.timeElapsed)}s`;

        // Check if any opponent bots are still alive so we can let them spectate
        const botsRemaining = this.runners.some((r) => !r.isPlayer && !r.isEliminated);
        const isChampion = playerRank === 1 || this.hasWon;
        
        if (isChampion) {
            this.dom.endTitle.innerText = "VICTORY!";
            this.dom.endTitle.className = "game-title victory";
            this.dom.endSubtitle.innerText = this.hasWon
                ? `CHAMPION! You outlasted everyone & reached ${this.player.distanceRun}m!`
                : "YOU ARE THE LAST RUNNER STANDING!";
            this.dom.spectateBtn.style.display = 'none';
            audio.playVictory();
        } else {
            this.dom.endTitle.innerText = "ELIMINATED!";
            this.dom.endTitle.className = "game-title eliminated";
            this.dom.endSubtitle.innerText = `Killed by ${this.player.eliminationReason || "falling"}`;
            
            // Show spectate button if there are bots running, and we are not already spectating
            this.dom.spectateBtn.style.display = (botsRemaining && !this.isSpectating) ? 'block' : 'none';
            
            // Play game over chord ONLY if this is the first time dying
            if (!this.isSpectating) {
                audio.playGameOver();
            }
        }
    }

    animate = () => {
        requestAnimationFrame(this.animate);
        
        const rawDelta = Math.min(this.clock.getDelta(), 0.1);
        let deltaTime = rawDelta;
        
        // Slow-mo effect on player elimination
        if (this.slowMo.active) {
            this.slowMo.elapsed += rawDelta;
            if (this.slowMo.elapsed >= this.slowMo.duration) {
                this.slowMo.active = false;
                this.endGame();
            }
            deltaTime = rawDelta * this.slowMo.multiplier;
        }
        
        if (this.gameState === 'PLAYING') {
            this.timeElapsed += deltaTime;

            // 1. Gradually increase track speed over distance (every 200m)
            const distanceMilestone = Math.floor(this.player.distanceRun / 200);
            if (distanceMilestone > this.lastSpeedMilestone) {
                this.lastSpeedMilestone = distanceMilestone;
                if (this.currentSpeed < this.maxSpeed) {
                    this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + 2.0);
                    audio.playSpeedUp();
                    
                    const speedMultiplierText = (this.currentSpeed / this.baseSpeed).toFixed(1);
                    this.showAnnouncement(`⚡ SPEED UP! MULTIPLIER: ${speedMultiplierText}x`, true);
                }
            }

            // Update stats
            this.dom.hudDistance.innerText = `${this.player.distanceRun}m`;
            this.dom.hudSpeed.innerText = `${(this.currentSpeed / this.baseSpeed).toFixed(1)}x`;

            // 2. Update all active runners (physics + animations + AI)
            this.runners.forEach((runner) => {
                // If it's a bot, update its AI scanner first
                if (runner instanceof BotRunner) {
                    const botSpeed = this.currentSpeed * (1.0 + runner.speedOffset);
                    runner.updateAI(deltaTime, botSpeed, this.trackManager, this.player.z);
                    runner.update(deltaTime, botSpeed, this.trackManager);
                } else {
                    // Overdrive speed boost for player
                    const playerSpeed = runner.activeEffects.overdrive 
                        ? this.currentSpeed * 1.4 
                        : this.currentSpeed;
                    runner.update(deltaTime, playerSpeed, this.trackManager);
                }

                // Update power-up effects and dash timers
                runner.updateEffects(deltaTime);

                // Periodic running dust trails
                if (!runner.isEliminated && !runner.isJumping && !runner.isSliding) {
                    if (Math.random() < 0.15) {
                        this.spawnDust(runner.x, runner.z);
                    }
                }
            });

            // 2b. Update sliding hazards
            this.trackManager.updateSlidingHazards(deltaTime);

            // 3. Collision and bounds calculations
            this.handleCollisions();

            // 4. Update track segments recycling relative to the leading active runner
            const leader = this.runners.filter(r => !r.isEliminated).sort((a,b) => a.z - b.z)[0] || this.player;
            this.trackManager.update(leader.z);

            // 5. Update floating decorative scenic prisms relative to leader
            this.updateScenery(leader.z);

            // 6. Check Win Condition (Endless Victory Run: keep running until death!)
            const activeRunners = this.runners.filter((r) => !r.isEliminated);
            if (this.isSpectating) {
                if (activeRunners.length === 0) {
                    this.endGame();
                }
            } else {
                if (activeRunners.length === 1 && activeRunners[0].isPlayer) {
                    if (!this.hasWon) {
                        this.hasWon = true;
                        audio.playVictory();
                        this.showAnnouncement('🏆 VICTORY! ALL RIVALS ELIMINATED! RUN TILL YOU DROP!');
                        if (this.dom.victoryQuitContainer) this.dom.victoryQuitContainer.style.display = 'block';
                        this.updateLeaderboardUI();
                    }
                    // Keep running endlessly until player hits an obstacle or gap!
                }
            }

            // 7. Update HUD Leaderboard every 15 frames for performance
            if (Math.random() < 0.08) {
                this.updateLeaderboardUI();
            }

            // 8. Combo decay check
            if (this.comboCount > 0 && this.timeElapsed - this.lastComboTime > this.comboWindow) {
                this.resetCombo();
            }
            
            // 9. Clean up old near-miss tracking
            if (this.nearMissedObstacles.size > 50) {
                this.nearMissedObstacles.clear();
            }
        }

        // Particle physics running constantly
        this.updateParticles(deltaTime);

        // Spin active coins and power-ups in track view
        this.trackManager.segments.forEach((seg) => {
            seg.coins.forEach((coin) => {
                if (!coin.collected) {
                    coin.mesh.rotation.y += deltaTime * 2.5;
                }
            });
            seg.powerUps.forEach((pu) => {
                if (!pu.collected) {
                    pu.mesh.rotation.y += deltaTime * 3;
                    pu.mesh.position.y = 1.2 + Math.sin(Date.now() * 0.003 + pu.relZ) * 0.3;
                }
            });
        });

        // Update stamina bar
        if (this.player && this.dom.staminaFill) {
            const pct = (this.player.stamina / this.player.maxStamina) * 100;
            this.dom.staminaFill.style.width = pct + '%';
        }

        // 8. Dynamic Camera follows the active player or leader (if spectating)
        if (this.player) {
            const camTarget = this.isSpectating ? (this.runners.filter(r => !r.isEliminated).sort((a,b) => a.z - b.z)[0] || this.player) : this.player;

            // Camera position: behind and slightly above target runner, softly lagging X adjustments
            const targetCamX = camTarget.x * 0.45;
            const targetCamY = camTarget.y + 4.2;
            const targetCamZ = camTarget.z + 10.5; // Offset behind (Positive is behind along -Z track)

            this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, 0.1);
            this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, 0.1);
            this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, 0.1);

            // Camera looks slightly ahead of target runner
            const lookTarget = new THREE.Vector3(
                camTarget.x * 0.25,
                camTarget.y * 0.4 + 0.8,
                camTarget.z - 12
            );
            this.camera.lookAt(lookTarget);

            // Apply camera shake
            if (this.cameraShake.intensity > 0) {
                this.cameraShake.elapsed += rawDelta;
                if (this.cameraShake.elapsed < this.cameraShake.duration) {
                    const decay = 1 - (this.cameraShake.elapsed / this.cameraShake.duration);
                    this.camera.position.x += (Math.random() - 0.5) * 2 * this.cameraShake.intensity * decay;
                    this.camera.position.y += (Math.random() - 0.5) * 2 * this.cameraShake.intensity * decay;
                } else {
                    this.cameraShake.intensity = 0;
                }
            }

            // Move the sun group to stay infinitely centered on the horizon Z
            if (this.sunGroup) {
                this.sunGroup.position.z = this.camera.position.z - 450;
            }

            // Keep directional light aligned near target so shadows don't clip
            this.dirLight.position.set(camTarget.x + 15, 25, camTarget.z + 15);
            this.dirLight.target = camTarget.mesh;
        }

        // Render Frame
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialise Game on load
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
