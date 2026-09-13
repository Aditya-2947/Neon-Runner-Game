// src/runner.js - Player and AI Bot Runners

import { LANE_X_POSITIONS, LANE_WIDTH } from './track.js?t=20260704214800';

// Base Runner Class
export class Runner {
    constructor(scene, name, color, isPlayer = false) {
        this.scene = scene;
        this.name = name;
        this.color = color;
        this.isPlayer = isPlayer;
        
        // Position and Lane state
        this.lane = 1; // Start in Center lane
        this.targetX = LANE_X_POSITIONS[this.lane];
        
        this.x = this.targetX;
        this.y = 0;
        this.z = 0; // Starts at track origin
        
        // Physics
        this.vy = 0;
        this.gravity = -20.0; // units/sec^2
        this.jumpForce = 9.0; // units/sec
        
        // States
        this.isJumping = false;
        this.isSliding = false;
        this.slideDuration = 0.55; // seconds
        this.slideTimeRemaining = 0;
        this.isEliminated = false;
        this.eliminationReason = ""; // "rock", "low_beam", "fire_pit", "gap"
        
        // Distance and Score tracking
        this.distanceRun = 0;
        this.coinsCollected = 0;
        
        // Power-up state
        this.activeEffects = { shield: false, magnet: false, overdrive: false };
        this.effectTimers = { magnet: 0, overdrive: 0 };
        this.shieldMesh = null;
        
        // Dash state
        this.stamina = 100;
        this.maxStamina = 100;
        this.staminaRegenRate = 15;
        this.isDashing = false;
        this.dashDuration = 0.3;
        this.dashTimeRemaining = 0;
        this.dashCost = 35;
        
        this.createMesh();
    }

    createMesh() {
        this.mesh = new THREE.Group();
        
        // Low-poly blocky cyberpunk robot design
        const runnerColor = new THREE.Color(this.color);
        const metalMat = new THREE.MeshPhongMaterial({
            color: runnerColor,
            shininess: 80,
            flatShading: true
        });
        
        const darkMetalMat = new THREE.MeshPhongMaterial({
            color: 0x1f1f2e,
            shininess: 30,
            flatShading: true
        });

        const glowMat = new THREE.MeshBasicMaterial({
            color: this.isPlayer ? 0xffffff : runnerColor
        });

        // Torso / Body (Chunky square chest)
        const bodyGeom = new THREE.BoxGeometry(0.8, 1.0, 0.6);
        this.torso = new THREE.Mesh(bodyGeom, metalMat);
        this.torso.position.y = 0.9;
        this.mesh.add(this.torso);

        // Head
        const headGeom = new THREE.BoxGeometry(0.5, 0.5, 0.45);
        this.head = new THREE.Mesh(headGeom, darkMetalMat);
        this.head.position.set(0, 1.7, 0.05);
        
        // Visor / Eyes (Glowing stripe)
        const visorGeom = new THREE.BoxGeometry(0.4, 0.1, 0.1);
        const visor = new THREE.Mesh(visorGeom, glowMat);
        visor.position.set(0, 0.05, 0.22);
        this.head.add(visor);
        
        this.mesh.add(this.head);

        // Limbs setup (grouped for easy rotations)
        const limbGeom = new THREE.BoxGeometry(0.2, 0.6, 0.2);

        // Left Arm
        this.leftArm = new THREE.Mesh(limbGeom, metalMat);
        this.leftArm.position.set(-0.55, 1.0, 0);
        this.mesh.add(this.leftArm);

        // Right Arm
        this.rightArm = new THREE.Mesh(limbGeom, metalMat);
        this.rightArm.position.set(0.55, 1.0, 0);
        this.mesh.add(this.rightArm);

        // Left Leg
        this.leftLeg = new THREE.Mesh(limbGeom, darkMetalMat);
        this.leftLeg.position.set(-0.25, 0.3, 0);
        this.mesh.add(this.leftLeg);

        // Right Leg
        this.rightLeg = new THREE.Mesh(limbGeom, darkMetalMat);
        this.rightLeg.position.set(0.25, 0.3, 0);
        this.mesh.add(this.rightLeg);

        // Enable shadows
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        this.scene.add(this.mesh);
    }

    applyPowerUp(type) {
        if (type === 'shield') {
            this.activeEffects.shield = true;
            // Create orbiting shield visual
            if (!this.shieldMesh) {
                const geom = new THREE.IcosahedronGeometry(1.2, 0);
                const mat = new THREE.MeshBasicMaterial({ 
                    color: new THREE.Color(this.color), 
                    wireframe: true, transparent: true, opacity: 0.4 
                });
                this.shieldMesh = new THREE.Mesh(geom, mat);
                this.mesh.add(this.shieldMesh);
                this.shieldMesh.position.y = 0.8;
            }
        } else if (type === 'magnet') {
            this.activeEffects.magnet = true;
            this.effectTimers.magnet = 5.0;
        } else if (type === 'overdrive') {
            this.activeEffects.overdrive = true;
            this.effectTimers.overdrive = 4.0;
        }
        // EMP is handled externally by game controller
    }

    updateEffects(deltaTime) {
        // Magnet timer
        if (this.activeEffects.magnet) {
            this.effectTimers.magnet -= deltaTime;
            if (this.effectTimers.magnet <= 0) {
                this.activeEffects.magnet = false;
            }
        }
        // Overdrive timer
        if (this.activeEffects.overdrive) {
            this.effectTimers.overdrive -= deltaTime;
            if (this.effectTimers.overdrive <= 0) {
                this.activeEffects.overdrive = false;
            }
        }
        // Shield visual rotation
        if (this.shieldMesh) {
            this.shieldMesh.rotation.y += deltaTime * 3;
            this.shieldMesh.rotation.x += deltaTime * 1.5;
        }
        // Dash timer
        if (this.isDashing) {
            this.dashTimeRemaining -= deltaTime;
            if (this.dashTimeRemaining <= 0) {
                this.isDashing = false;
            }
        }
        // Stamina regen
        if (!this.isDashing && this.stamina < this.maxStamina) {
            this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * deltaTime);
        }
    }

    dash() {
        if (this.isEliminated || this.isDashing || this.stamina < this.dashCost) return false;
        this.isDashing = true;
        this.dashTimeRemaining = this.dashDuration;
        this.stamina -= this.dashCost;
        return true;
    }

    jump() {
        if (this.isEliminated || this.isJumping || this.isSliding) return false;
        
        this.isJumping = true;
        this.vy = this.jumpForce;
        
        // Modify arm pose for jump
        this.leftArm.rotation.x = -Math.PI * 0.8;
        this.rightArm.rotation.x = -Math.PI * 0.8;
        return true;
    }

    slide() {
        if (this.isEliminated || this.isJumping || this.isSliding) return false;
        
        this.isSliding = true;
        this.slideTimeRemaining = this.slideDuration;
        
        // Squash mesh visually to indicate slide
        this.mesh.scale.set(1.0, 0.4, 1.3);
        // Put runner close to floor
        return true;
    }

    moveLeft() {
        if (this.isEliminated || this.lane === 0) return false;
        this.lane--;
        this.targetX = LANE_X_POSITIONS[this.lane];
        return true;
    }

    moveRight() {
        if (this.isEliminated || this.lane === 2) return false;
        this.lane++;
        this.targetX = LANE_X_POSITIONS[this.lane];
        return true;
    }

    update(deltaTime, speed, trackManager) {
        if (this.isEliminated) {
            // If eliminated due to gap, continue falling down
            if (this.eliminationReason === "gap") {
                this.y += this.vy * deltaTime;
                this.vy += this.gravity * deltaTime;
                this.mesh.position.y = this.y;
                this.mesh.rotation.x += deltaTime * 5;
                this.mesh.rotation.y += deltaTime * 3;
            }
            return;
        }

        // 1. Forward movement (Negative Z)
        // Add a slight forward boost during jumps so the character can clear rocks/fire pits at very slow base speeds
        const forwardSpeed = this.isJumping ? Math.max(5.2, speed) : speed;
        this.z -= forwardSpeed * deltaTime;
        this.distanceRun = Math.floor(Math.abs(this.z));

        // 2. Adjust target X dynamically based on the track's curve at current Z position
        const trackX = trackManager ? trackManager.getTrackCenterX(this.z) : 0;
        this.targetX = LANE_X_POSITIONS[this.lane] + trackX;

        // 3. Lateral lane shifting (X Interpolation)
        this.x = THREE.MathUtils.lerp(this.x, this.targetX, 1 - Math.exp(-15 * deltaTime));
        this.mesh.position.x = this.x;

        // Add subtle tilt while shifting lanes
        // Relative shift from the lane center to make tilt work on curved track
        const relShift = this.targetX - this.x;
        this.mesh.rotation.z = relShift * 0.12;
        this.mesh.rotation.y = Math.PI + (relShift * 0.1);

        // 4. Jump physics (Y update)
        if (this.isJumping) {
            this.y += this.vy * deltaTime;
            this.vy += this.gravity * deltaTime;
            
            if (this.y <= 0) {
                this.y = 0;
                this.vy = 0;
                this.isJumping = false;
                
                // Reset arm rotations
                this.leftArm.rotation.x = 0;
                this.rightArm.rotation.x = 0;
            }
        }
        this.mesh.position.y = this.y;

        // 5. Slide duration check
        if (this.isSliding) {
            this.slideTimeRemaining -= deltaTime;
            if (this.slideTimeRemaining <= 0) {
                this.isSliding = false;
                // Reset scale back to normal
                this.mesh.scale.set(1.0, 1.0, 1.0);
            }
        }

        // 6. Apply Position to 3D Mesh
        this.mesh.position.z = this.z;

        // 7. Running Limbs Animation (if not jumping/sliding)
        if (!this.isJumping && !this.isSliding) {
            const swingSpeed = speed * 0.75;
            const swingAngle = Math.sin(this.z * 0.3) * 0.8;
            
            // Swing legs in opposite directions
            this.leftLeg.rotation.x = swingAngle;
            this.rightLeg.rotation.x = -swingAngle;
            
            // Swing arms in opposite direction to legs
            this.leftArm.rotation.x = -swingAngle * 0.8;
            this.rightArm.rotation.x = swingAngle * 0.8;
            
            // Subtle body bounce
            this.torso.position.y = 0.9 + Math.abs(Math.sin(this.z * 0.6)) * 0.05;
        } else if (this.isSliding) {
            // Sliding pose (limbs back)
            this.leftLeg.rotation.x = Math.PI / 3;
            this.rightLeg.rotation.x = Math.PI / 3;
            this.leftArm.rotation.x = -Math.PI / 3;
            this.rightArm.rotation.x = -Math.PI / 3;
            this.torso.position.y = 0.5;
        }
    }

    getBoundingBox() {
        // Return AABB based on position and size
        let runnerHeight = 1.8;
        let runnerWidth = 1.0;
        let runnerLength = 0.6;
        let yOffset = 0.9;

        if (this.isSliding) {
            runnerHeight = 0.75;
            yOffset = 0.375;
            runnerLength = 1.2;
        }

        return {
            minX: this.x - runnerWidth/2,
            maxX: this.x + runnerWidth/2,
            minY: this.y + (yOffset - runnerHeight/2),
            maxY: this.y + (yOffset + runnerHeight/2),
            minZ: this.z - runnerLength/2,
            maxZ: this.z + runnerLength/2
        };
    }

    eliminate(reason) {
        if (this.isEliminated) return false;
        // Shield absorbs one hit
        if (this.activeEffects.shield) {
            this.activeEffects.shield = false;
            if (this.shieldMesh) {
                this.mesh.remove(this.shieldMesh);
                this.shieldMesh = null;
            }
            return "shield_absorbed"; // Hit absorbed
        }
        // Dash grants invulnerability
        if (this.isDashing) return "dash_dodged";
        
        this.isEliminated = true;
        this.eliminationReason = reason;
        
        if (reason === "gap") {
            this.vy = -1.0;
        }
        return "eliminated";
    }

    destroy() {
        this.mesh.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach((mat) => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        this.scene.remove(this.mesh);
    }
}

// Bot AI Runner class
const BOT_PROFILES = {
    cautious:   { dodgeMod: +0.03, reactionMod: +8, speedMod: -0.04 },
    aggressive: { dodgeMod: -0.02, reactionMod: -4, speedMod: +0.06 },
    erratic:    { dodgeMod: 0, reactionMod: 0, speedMod: 0, randomizeDodge: true }
};

export class BotRunner extends Runner {
    constructor(scene, name, color, baseDifficulty = 0.95) {
        super(scene, name, color, false);
        
        // AI parameters
        this.successRate = baseDifficulty;
        this.scanInterval = 0.12;
        this.scanTimer = Math.random() * this.scanInterval;
        
        // AI Dodge state
        this.upcomingObstacleHandled = null;
        this.dodgeDecisionMade = false;
        this.dodgeSuccessful = true;
        
        // Personal speed offsets
        this.speedOffset = (Math.random() - 0.5) * 0.08;
        
        // Stun state (for EMP)
        this.stunned = false;
        this.stunTimer = 0;
        
        // Bot profile (Phase 3)
        this.botProfile = 'normal';
        this.profileData = null;
    }

    setProfile(profileName) {
        this.botProfile = profileName;
        this.profileData = BOT_PROFILES[profileName] || null;
        if (this.profileData) {
            this.speedOffset += this.profileData.speedMod;
        }
    }

    stun(duration = 2.0) {
        this.stunned = true;
        this.stunTimer = duration;
    }

    updateAI(deltaTime, currentSpeed, trackManager, playerZ = 0) {
        if (this.isEliminated) return;
        
        // Stun check
        if (this.stunned) {
            this.stunTimer -= deltaTime;
            if (this.stunTimer <= 0) {
                this.stunned = false;
            }
            if (this.mesh) {
                this.mesh.visible = Math.random() > 0.3;
            }
            return;
        } else if (this.mesh) {
            this.mesh.visible = true;
        }
        
        this.scanTimer += deltaTime;
        if (this.scanTimer >= this.scanInterval) {
            this.scanTimer = 0;
            this.makeDecision(currentSpeed, trackManager, playerZ);
        }
    }

    makeDecision(currentSpeed, trackManager, playerZ = 0) {
        // Retrieve upcoming obstacles and road structure ahead of bot's current z position
        const activeObstacles = trackManager.getActiveObstacles();
        const lookaheadDistance = 45 + ((this.profileData && this.profileData.reactionMod) || 0);
        
        // Find obstacles in the current lane that are ahead
        const obstaclesInLane = activeObstacles.filter((obs) => {
            return obs.lane === this.lane && 
                   obs.worldZ < this.z &&
                   obs.worldZ > this.z - lookaheadDistance;
        });

        // Sort by proximity
        obstaclesInLane.sort((a, b) => b.worldZ - a.worldZ);

        // Also check if there's an upcoming GAP in this lane
        let upcomingGap = null;
        const checkSteps = 8;
        const stepSize = 5;
        for (let i = 1; i <= checkSteps; i++) {
            const checkZ = this.z - (i * stepSize);
            if (!trackManager.hasFloorAt(this.x, checkZ)) {
                upcomingGap = {
                    type: 'gap',
                    worldZ: checkZ,
                    lane: this.lane
                };
                break;
            }
        }

        // Choose which hazard to address first (closest)
        let hazard = null;
        if (obstaclesInLane.length > 0 && upcomingGap) {
            hazard = (obstaclesInLane[0].worldZ > upcomingGap.worldZ) ? obstaclesInLane[0] : upcomingGap;
        } else {
            hazard = obstaclesInLane[0] || upcomingGap;
        }

        if (!hazard) {
            this.upcomingObstacleHandled = null;
            this.dodgeDecisionMade = false;
            return;
        }

        // Hazard ID key
        const hazardId = hazard.type + '_' + Math.round(hazard.worldZ);
        
        // If it's a new hazard we haven't decided on yet
        if (this.upcomingObstacleHandled !== hazardId) {
            this.upcomingObstacleHandled = hazardId;
            this.dodgeDecisionMade = true;
            
            // Base success rate adjusted for speed
            const speedFactor = Math.max(0, (currentSpeed - 12) / 25);
            let dynamicSuccessRate = this.successRate - (speedFactor * 0.05);
            
            // Profile modifier
            if (this.profileData) {
                dynamicSuccessRate += this.profileData.dodgeMod;
            }
            
            // Rubber-banding: trailing bots get a boost, leading bots get a penalty
            const distBehind = this.z - playerZ; // positive = trailing
            if (distBehind > 30) {
                dynamicSuccessRate += 0.03;
            } else if (distBehind < -30) {
                dynamicSuccessRate -= 0.03;
            }
            
            dynamicSuccessRate = Math.max(0.80, Math.min(0.99, dynamicSuccessRate));
            
            // Erratic profile: add random spread
            if (this.profileData && this.profileData.randomizeDodge) {
                dynamicSuccessRate += (Math.random() - 0.5) * 0.2;
            }
            
            this.dodgeSuccessful = Math.random() < dynamicSuccessRate;
        }

        // If we decided to fail this dodge, do nothing!
        if (!this.dodgeSuccessful) return;

        // Reaction Distance check
        const reactionDist = 18 + (currentSpeed * 0.45) + ((this.profileData && this.profileData.reactionMod) || 0);
        const distanceToHazard = Math.abs(this.z - hazard.worldZ);

        if (distanceToHazard <= reactionDist) {
            // Decide response: Switch lanes or Jump/Slide
            // Let's check if adjacent lanes are safer
            const leftLaneIndex = this.lane - 1;
            const rightLaneIndex = this.lane + 1;
            
            let canMoveLeft = leftLaneIndex >= 0;
            let canMoveRight = rightLaneIndex <= 2;

            // Verify if adjacent lanes have floor or upcoming obstacles
            if (canMoveLeft) {
                const leftX = LANE_X_POSITIONS[leftLaneIndex];
                const hasFloor = trackManager.hasFloorAt(leftX, hazard.worldZ);
                const hasObstacle = activeObstacles.some(obs => obs.lane === leftLaneIndex && Math.abs(obs.worldZ - hazard.worldZ) < 5);
                if (!hasFloor || hasObstacle) canMoveLeft = false;
            }

            if (canMoveRight) {
                const rightX = LANE_X_POSITIONS[rightLaneIndex];
                const hasFloor = trackManager.hasFloorAt(rightX, hazard.worldZ);
                const hasObstacle = activeObstacles.some(obs => obs.lane === rightLaneIndex && Math.abs(obs.worldZ - hazard.worldZ) < 5);
                if (!hasFloor || hasObstacle) canMoveRight = false;
            }

            // Decide path
            if (canMoveLeft && canMoveRight) {
                // Pick randomly
                Math.random() < 0.5 ? this.moveLeft() : this.moveRight();
            } else if (canMoveLeft) {
                this.moveLeft();
            } else if (canMoveRight) {
                this.moveRight();
            } else {
                // Can't switch lanes! Must jump or slide
                if (hazard.type === 'rock' || hazard.type === 'fire_pit' || hazard.type === 'gap' || hazard.type === 'sliding_rock') {
                    // Jump!
                    const jumpDelayZ = hazard.type === 'gap' ? 12 : 14;
                    if (distanceToHazard <= jumpDelayZ + (currentSpeed * 0.1)) {
                        this.jump();
                    }
                } else if (hazard.type === 'low_beam' || hazard.type === 'sliding_beam') {
                    // Slide!
                    this.slide();
                }
            }
        }
    }
}
