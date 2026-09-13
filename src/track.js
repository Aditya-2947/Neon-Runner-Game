// src/track.js - Procedural Track, Obstacles, and Coins Generator

// Track configuration
export const LANE_WIDTH = 3.5; // Width of each lane
export const LANE_X_POSITIONS = [-LANE_WIDTH, 0, LANE_WIDTH]; // Left (-3.5), Center (0), Right (3.5)
export const SEGMENT_LENGTH = 50; // Length of each road segment in units
export const INITIAL_SAFE_SEGMENTS = 3; // Number of initial obstacle-free segments

// Shared Geometries and Materials to maximize performance and avoid garbage collection stutters
let laneGeom, borderGeom, rockGeom, pillarGeom, barGeom, pitGeom, fireGeom, sparkGeom, coinGeom;
let floorMat, borderMat, rockMat, pillarMat, barMat, firePitMat, fireCoreMat, sparkMat, coinMat;
// Power-up geometries and materials
let shieldGeom, magnetGeom, overdriveGeom, empGeom, riskCoinGeom;
let shieldMat, magnetMat, overdriveMat, empMat, riskCoinMat;

function initSharedAssets() {
    if (laneGeom) return; // Already initialized

    // Geometries
    laneGeom = new THREE.BoxGeometry(LANE_WIDTH - 0.2, 0.5, SEGMENT_LENGTH);
    borderGeom = new THREE.BoxGeometry(0.15, 0.6, SEGMENT_LENGTH);
    rockGeom = new THREE.DodecahedronGeometry(1.0, 1);
    pillarGeom = new THREE.CylinderGeometry(0.1, 0.1, 2.5, 5);
    barGeom = new THREE.CylinderGeometry(0.12, 0.12, LANE_WIDTH - 0.4, 6);
    pitGeom = new THREE.BoxGeometry(LANE_WIDTH - 0.6, 0.2, 3.5);
    fireGeom = new THREE.BoxGeometry(LANE_WIDTH - 1.0, 0.15, 3.0);
    sparkGeom = new THREE.ConeGeometry(0.2, 0.6, 4);
    coinGeom = new THREE.TorusGeometry(0.4, 0.12, 6, 12);

    // Materials
    floorMat = new THREE.MeshPhongMaterial({ color: 0x110c28, shininess: 40, flatShading: true });
    borderMat = new THREE.MeshBasicMaterial({ color: 0xbd00ff });
    rockMat = new THREE.MeshPhongMaterial({ color: 0x444054, flatShading: true, shininess: 10 });
    pillarMat = new THREE.MeshPhongMaterial({ color: 0x2d2b38, flatShading: true });
    barMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    firePitMat = new THREE.MeshPhongMaterial({ color: 0x1f1c2c });
    fireCoreMat = new THREE.MeshBasicMaterial({ color: 0xff4d00 });
    sparkMat = new THREE.MeshBasicMaterial({ color: 0xffa600 });
    coinMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100, emissive: 0xaa6600, flatShading: true });

    // Power-up geometries (created once, shared)
    shieldGeom = new THREE.IcosahedronGeometry(0.5, 0);
    magnetGeom = new THREE.SphereGeometry(0.4, 6, 6);
    overdriveGeom = new THREE.OctahedronGeometry(0.5, 0);
    empGeom = new THREE.RingGeometry(0.3, 0.5, 8);
    riskCoinGeom = new THREE.TorusGeometry(0.5, 0.15, 6, 12);

    // Power-up materials
    shieldMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.8 });
    magnetMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    overdriveMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    empMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    riskCoinMat = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: 120, emissive: 0xaaaaff, flatShading: true });
}

export class TrackSegment {
    constructor(scene, zPosition, type = 'straight', safe = false, trackManager) {
        initSharedAssets(); // Ensure assets are ready

        this.scene = scene;
        this.z = zPosition;
        this.type = type; // 'straight', 'gap'
        this.safe = safe;
        this.trackManager = trackManager;
        
        this.container = new THREE.Group();
        // Position the segment along the track's curve
        const curveX = this.trackManager ? this.trackManager.getTrackCenterX(this.z) : 0;
        this.container.position.set(curveX, 0, this.z);
        this.scene.add(this.container);

        this.floorMeshes = [];
        this.obstacles = [];
        this.coins = [];
        this.powerUps = [];
        
        // Define gap status per lane (0 = normal floor, 1 = gap)
        this.laneGaps = [false, false, false];
        if (this.type === 'gap' && !this.safe) {
            // Pick 1 or 2 random lanes to have a gap
            const gapCount = Math.random() < 0.7 ? 1 : 2;
            const gapLanes = [];
            while (gapLanes.length < gapCount) {
                const laneIdx = Math.floor(Math.random() * 3);
                if (!gapLanes.includes(laneIdx)) {
                    gapLanes.push(laneIdx);
                    this.laneGaps[laneIdx] = true;
                }
            }
        }

        this.createFloor();
        if (!this.safe) {
            this.spawnContents();
        }
    }

    createFloor() {
        for (let i = 0; i < 3; i++) {
            const laneX = LANE_X_POSITIONS[i];
            
            // Draw lane borders (left and right edge of each lane)
            const leftBorder = new THREE.Mesh(borderGeom, borderMat);
            leftBorder.position.set(laneX - LANE_WIDTH/2, 0.05, 0);
            this.container.add(leftBorder);
            this.floorMeshes.push(leftBorder);
            
            if (i === 2) { // Add rightmost border for the last lane
                const rightBorder = new THREE.Mesh(borderGeom, borderMat);
                rightBorder.position.set(laneX + LANE_WIDTH/2, 0.05, 0);
                this.container.add(rightBorder);
                this.floorMeshes.push(rightBorder);
            }

            // Draw lane floors
            if (!this.laneGaps[i]) {
                const floor = new THREE.Mesh(laneGeom, floorMat);
                floor.position.set(laneX, -0.25, 0);
                
                // Add Grid Lines to lanes
                const gridHelper = new THREE.GridHelper(SEGMENT_LENGTH, 10, 0x00f3ff, 0x221a4f);
                gridHelper.rotation.x = Math.PI / 2;
                gridHelper.position.set(laneX, 0.01, 0);
                gridHelper.material.opacity = 0.15;
                gridHelper.material.transparent = true;

                this.container.add(floor);
                this.container.add(gridHelper);
                
                this.floorMeshes.push(floor);
                this.floorMeshes.push(gridHelper);
            }
        }
    }

    spawnContents() {
        const sectorsZ = [-15, 0, 15]; // Z positions relative to the segment center
        const globalDistance = this.trackManager ? Math.abs(this.trackManager.nextSegmentZ) : 0;
        
        // Catch-up hazard density: subtle increase in obstacles directly ahead of race leader
        let obstacleChance = 0.35;
        if (this.trackManager && this.trackManager.leaderZ !== undefined) {
            const distFromLeader = Math.abs(this.z - this.trackManager.leaderZ);
            if (distFromLeader < 100) {
                obstacleChance += 0.05;
            }
        }
        
        sectorsZ.forEach((relZ) => {
            const spawnChance = Math.random();
            
            if (spawnChance < obstacleChance) {
                // Check for compound hazards at higher distances
                if (globalDistance > 1000 && Math.random() < 0.25) {
                    this.spawnCompoundHazard(relZ);
                } else {
                    this.spawnObstacle(relZ, globalDistance);
                }
            } else if (spawnChance < 0.65) {
                this.spawnCoins(relZ);
            } else if (spawnChance < 0.70) {
                // ~5% chance for a power-up
                this.spawnPowerUp(relZ);
            }
        });
    }

    spawnObstacle(relZ, globalDistance = 0) {
        let types = ['rock', 'low_beam', 'fire_pit'];
        // Add sliding variants after 800m
        if (globalDistance > 800) {
            types.push('sliding_rock', 'sliding_beam');
        }
        const type = types[Math.floor(Math.random() * types.length)];
        const laneIndex = Math.floor(Math.random() * 3);
        
        if (this.laneGaps[laneIndex]) return;

        const laneX = LANE_X_POSITIONS[laneIndex];
        let obstacleMesh = new THREE.Group();
        let colliderHeight = 1.0;
        let colliderWidth = 2.0;
        let colliderLength = 2.0;
        let yPos = 0;

        if (type === 'rock') {
            const rock = new THREE.Mesh(rockGeom, rockMat);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            rock.scale.set(1.2, 1, 1.2);
            obstacleMesh.add(rock);
            
            yPos = 0.6;
            colliderHeight = 1.2;
            colliderWidth = 1.8;
            colliderLength = 1.8;

        } else if (type === 'low_beam') {
            const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
            leftPillar.position.set(-LANE_WIDTH/2 + 0.2, 1.25, 0);
            
            const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
            rightPillar.position.set(LANE_WIDTH/2 - 0.2, 1.25, 0);
            
            const bar = new THREE.Mesh(barGeom, barMat);
            bar.rotation.z = Math.PI / 2;
            bar.position.set(0, 1.8, 0);
            
            obstacleMesh.add(leftPillar);
            obstacleMesh.add(rightPillar);
            obstacleMesh.add(bar);

            yPos = 1.8;
            colliderHeight = 1.0;
            colliderWidth = LANE_WIDTH;
            colliderLength = 0.8;

        } else if (type === 'fire_pit') {
            const pit = new THREE.Mesh(pitGeom, firePitMat);
            obstacleMesh.add(pit);
            
            const fire = new THREE.Mesh(fireGeom, fireCoreMat);
            fire.position.y = 0.1;
            obstacleMesh.add(fire);

            for (let j = 0; j < 4; j++) {
                const spark = new THREE.Mesh(sparkGeom, sparkMat);
                spark.position.set(
                    (Math.random() - 0.5) * (LANE_WIDTH - 1.5),
                    0.3,
                    (Math.random() - 0.5) * 2
                );
                spark.rotation.x = Math.random() * 0.4 - 0.2;
                spark.rotation.z = Math.random() * 0.4 - 0.2;
                obstacleMesh.add(spark);
            }

            yPos = 0.1;
            colliderHeight = 0.7;
            colliderWidth = LANE_WIDTH - 0.6;
            colliderLength = 3.5;
        }

        obstacleMesh.position.set(laneX, yPos, relZ);
        this.container.add(obstacleMesh);

        this.obstacles.push({
            mesh: obstacleMesh,
            type: type,
            lane: laneIndex,
            relZ: relZ,
            localYPos: yPos,
            width: colliderWidth,
            height: colliderHeight,
            length: colliderLength,
            sliding: (type === 'sliding_rock' || type === 'sliding_beam'),
            slidingDir: Math.random() < 0.5 ? 1 : -1,
            slidingSpeed: 2.5 + Math.random() * 1.5,
            slidingMinX: LANE_X_POSITIONS[0],
            slidingMaxX: LANE_X_POSITIONS[2]
        });

        // Risk coins: occasionally spawn high-value coins in same lane as obstacle
        if (Math.random() < 0.2) {
            this.spawnRiskCoins(relZ - 3, laneIndex);
        }
    }

    spawnCompoundHazard(relZ) {
        // Compound: coordinated obstacles across multiple lanes
        const patterns = [
            // low_beam lane 0 + rock lane 1
            [{ type: 'low_beam', lane: 0 }, { type: 'rock', lane: 1 }],
            // rock lane 1 + fire_pit lane 2
            [{ type: 'rock', lane: 1 }, { type: 'fire_pit', lane: 2 }],
            // low_beam lane 0 + low_beam lane 2 (force center or slide)
            [{ type: 'low_beam', lane: 0 }, { type: 'low_beam', lane: 2 }],
        ];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];

        pattern.forEach((item) => {
            if (this.laneGaps[item.lane]) return;
            const laneX = LANE_X_POSITIONS[item.lane];
            let obstacleMesh = new THREE.Group();
            let colliderHeight = 1.0, colliderWidth = 2.0, colliderLength = 2.0, yPos = 0;

            if (item.type === 'rock') {
                const rock = new THREE.Mesh(rockGeom, rockMat);
                rock.rotation.set(Math.random(), Math.random(), Math.random());
                rock.scale.set(1.2, 1, 1.2);
                obstacleMesh.add(rock);
                yPos = 0.6; colliderHeight = 1.2; colliderWidth = 1.8; colliderLength = 1.8;
            } else if (item.type === 'low_beam') {
                const leftP = new THREE.Mesh(pillarGeom, pillarMat);
                leftP.position.set(-LANE_WIDTH/2 + 0.2, 1.25, 0);
                const rightP = new THREE.Mesh(pillarGeom, pillarMat);
                rightP.position.set(LANE_WIDTH/2 - 0.2, 1.25, 0);
                const bar = new THREE.Mesh(barGeom, barMat);
                bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.8, 0);
                obstacleMesh.add(leftP, rightP, bar);
                yPos = 1.8; colliderHeight = 1.0; colliderWidth = LANE_WIDTH; colliderLength = 0.8;
            } else if (item.type === 'fire_pit') {
                const pit = new THREE.Mesh(pitGeom, firePitMat);
                const fire = new THREE.Mesh(fireGeom, fireCoreMat);
                fire.position.y = 0.1;
                obstacleMesh.add(pit, fire);
                yPos = 0.1; colliderHeight = 0.7; colliderWidth = LANE_WIDTH - 0.6; colliderLength = 3.5;
            }

            obstacleMesh.position.set(laneX, yPos, relZ);
            this.container.add(obstacleMesh);
            this.obstacles.push({
                mesh: obstacleMesh, type: item.type, lane: item.lane, relZ: relZ,
                localYPos: yPos, width: colliderWidth, height: colliderHeight, length: colliderLength,
                sliding: false, slidingDir: 0, slidingSpeed: 0,
                slidingMinX: 0, slidingMaxX: 0
            });
        });
    }

    spawnPowerUp(relZ) {
        const laneIndex = Math.floor(Math.random() * 3);
        if (this.laneGaps[laneIndex]) return;

        const types = ['shield', 'magnet', 'overdrive', 'emp'];
        const type = types[Math.floor(Math.random() * types.length)];
        const laneX = LANE_X_POSITIONS[laneIndex];

        let geom, mat;
        if (type === 'shield')    { geom = shieldGeom;    mat = shieldMat; }
        else if (type === 'magnet')    { geom = magnetGeom;    mat = magnetMat; }
        else if (type === 'overdrive') { geom = overdriveGeom; mat = overdriveMat; }
        else                           { geom = empGeom;       mat = empMat; }

        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(laneX, 1.2, relZ);
        this.container.add(mesh);

        this.powerUps.push({
            mesh: mesh,
            type: type,
            lane: laneIndex,
            relZ: relZ,
            collected: false,
            radius: 1.3
        });
    }

    spawnRiskCoins(relZ, laneIndex) {
        if (this.laneGaps[laneIndex]) return;
        const laneX = LANE_X_POSITIONS[laneIndex];
        const value = 2 + Math.floor(Math.random() * 4); // 2x-5x

        const mesh = new THREE.Mesh(riskCoinGeom, riskCoinMat);
        mesh.position.set(laneX, 1.0, relZ);
        mesh.scale.setScalar(1.2);
        this.container.add(mesh);

        this.coins.push({
            mesh: mesh,
            collected: false,
            lane: laneIndex,
            relZ: relZ,
            radius: 0.6,
            value: value
        });
    }

    spawnCoins(relZ) {
        const laneIndex = Math.floor(Math.random() * 3);
        if (this.laneGaps[laneIndex]) return;

        const laneX = LANE_X_POSITIONS[laneIndex];
        const coinSpacing = 2.5;
        for (let i = -1; i <= 1; i++) {
            const coinMesh = new THREE.Mesh(coinGeom, coinMat);
            const coinY = 0.8;
            const coinZ = relZ + (i * coinSpacing);

            coinMesh.position.set(laneX, coinY, coinZ);
            this.container.add(coinMesh);

            this.coins.push({
                mesh: coinMesh,
                collected: false,
                lane: laneIndex,
                relZ: coinZ,
                radius: 0.5
            });
        }
    }

    destroy() {
        // Since geometries and materials are shared globally, we MUST NOT dispose them.
        // Simply remove the group from the Three.js scene.
        this.scene.remove(this.container);
    }
}

export class TrackManager {
    constructor(scene) {
        this.scene = scene;
        this.segments = [];
        this.nextSegmentZ = 0;
        this.reset();
    }

    getTrackCenterX(z) {
        if (z > -100) return 0;
        return Math.sin((z + 100) * 0.007) * 7.5;
    }

    reset() {
        this.segments.forEach((seg) => seg.destroy());
        this.segments = [];
        this.nextSegmentZ = 0;

        for (let i = 0; i < INITIAL_SAFE_SEGMENTS; i++) {
            const seg = new TrackSegment(this.scene, this.nextSegmentZ, 'straight', true, this);
            this.segments.push(seg);
            this.nextSegmentZ -= SEGMENT_LENGTH;
        }

        for (let i = 0; i < 9; i++) {
            this.spawnNewSegment();
        }
    }

    spawnNewSegment() {
        const type = Math.random() < 0.25 ? 'gap' : 'straight';
        const seg = new TrackSegment(this.scene, this.nextSegmentZ, type, false, this);
        this.segments.push(seg);
        this.nextSegmentZ -= SEGMENT_LENGTH;
    }

    update(playerZ) {
        this.leaderZ = playerZ;
        if (this.segments.length > 0) {
            const oldestSeg = this.segments[0];
            if (playerZ < oldestSeg.z - 60) {
                oldestSeg.destroy();
                this.segments.shift();
                this.spawnNewSegment();
            }
        }
    }

    getActiveObstacles() {
        const list = [];
        this.segments.forEach((seg) => {
            seg.obstacles.forEach((obs) => {
                list.push({
                    ...obs,
                    worldX: obs.mesh.position.x + seg.container.position.x,
                    worldY: obs.mesh.position.y,
                    worldZ: seg.z + obs.relZ
                });
            });
        });
        return list;
    }

    getActivePowerUps() {
        const list = [];
        this.segments.forEach((seg) => {
            seg.powerUps.forEach((pu) => {
                if (!pu.collected) {
                    list.push({
                        segment: seg,
                        puObj: pu,
                        worldX: pu.mesh.position.x + seg.container.position.x,
                        worldY: pu.mesh.position.y,
                        worldZ: seg.z + pu.relZ
                    });
                }
            });
        });
        return list;
    }

    updateSlidingHazards(deltaTime) {
        this.segments.forEach((seg) => {
            seg.obstacles.forEach((obs) => {
                if (!obs.sliding) return;
                const mesh = obs.mesh;
                mesh.position.x += obs.slidingDir * obs.slidingSpeed * deltaTime;
                // Bounce between lane boundaries
                const worldX = mesh.position.x + seg.container.position.x;
                if (worldX > obs.slidingMaxX + 1 || worldX < obs.slidingMinX - 1) {
                    obs.slidingDir *= -1;
                }
            });
        });
    }

    getActiveCoins() {
        const list = [];
        this.segments.forEach((seg) => {
            seg.coins.forEach((coin) => {
                if (!coin.collected) {
                    list.push({
                        segment: seg,
                        coinObj: coin,
                        worldX: coin.mesh.position.x + seg.container.position.x,
                        worldY: coin.mesh.position.y,
                        worldZ: seg.z + coin.relZ
                    });
                }
            });
        });
        return list;
    }

    hasFloorAt(worldX, worldZ) {
        const seg = this.segments.find((s) => {
            const startZ = s.z + SEGMENT_LENGTH/2;
            const endZ = s.z - SEGMENT_LENGTH/2;
            return worldZ <= startZ && worldZ > endZ;
        });

        if (!seg) return true;
        
        const trackX = this.getTrackCenterX(worldZ);
        const relX = worldX - trackX;

        let laneIndex = 1;
        const threshold = LANE_WIDTH / 2;
        if (relX < -threshold) {
            laneIndex = 0;
        } else if (relX > threshold) {
            laneIndex = 2;
        }

        return !seg.laneGaps[laneIndex];
    }
}
