/**
 * Main Backrooms Level 0 Game Engine
 */
class BackroomsGame {
    constructor() {
        this.container = document.getElementById('game-container');
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Game State
        this.isRunning = false;
        this.isGameOver = false;
        this.isVictory = false;
        this.sanity = 100;
        this.staminaMax = 96;
        this.stamina = this.staminaMax;
        this.battery = 100;
        this.keysFound = 0;
        this.keysRequired = 3;
        this.memoriesFound = 0;
        this.memoriesRequired = 0;
        this.almondWaterCount = 1; // Start with 1 can
        this.flashlightOn = true;
        this.isSprinting = false;
        this.sprintLatched = false;
        this.isXRayMode = false;
        this.infiniteStamina = false;
        this.jumpHeight = 0;
        this.jumpVelocity = 0;
        this.isGrounded = true;
        this.headBobOffset = 0;
        this.hazardHintShown = false;
        this.manilaHintShown = false;
        this.isGodMode = false;
        this.isInvincible = false;
        this.noClip = false;
        this.canFly = false;
        this.isFastMode = false;
        this.cheatMenuOpen = false;
        this.infiniteAmmo = false;
        this.gunOwned = false;
        this.awmOwned = false;
        this.m7Owned = false;
        this.m7Magazine = 20;
        this.m7Reserve = 80;
        this.m7ReloadEnd = 0;
        this.m7ReloadStart = 0;
        this.ammo = 0;
        this.selectedSlot = 1;
        this.shotCooldown = 0;
        this.lastM7ShotAt = -Infinity;
        this.smilersDefeated = 0;
        this.isPlayerHidden = false;
        this.isAiming = false;
        this.isAimToggled = false;
        this.isRightMouseHeld = false;
        this.isLeftMouseHeld = false;
        this.isCrouching = false;
        this.isSliding = false;
        this.slideTimer = 0;
        this.slideCooldown = 0;
        this.slideJumpGrace = 0;
        this.slideSpeed = 0;
        this.slideRequested = false;
        this.slideDirection = new THREE.Vector3(1, 0, 0);
        this.slideJumpMomentum = new THREE.Vector3();
        this.currentEyeHeight = 1.7;
        this.weaponRecoil = 0;
        this.recoilPitch = 0;
        this.muzzleFlashTimer = 0;
        this.shotFlashTimer = 0;
        this.lockerPositions = [];
        this.peekOffset = 0;
        this.appliedPeekX = 0;
        this.appliedPeekZ = 0;
        this.appliedPeekY = 0;

        // Timing
        this.clock = new THREE.Clock();
        this.timeElapsed = 0;

        // Controls & Input
        this.keys = {};
        this.mouseMove = { x: 0, y: 0 };
        this.isPointerLocked = false;
        this.mouseLookFallback = false;
        this.isDesktopHost = new URLSearchParams(window.location.search).has('desktop');
        this.lastFreeMouseX = null;
        this.lastFreeMouseY = null;
        this.headBobTimer = 0;

        // Core systems
        this.audio = new BackroomsAudio();
        this.map = new BackroomsMap();
        this.memoriesRequired = this.map.memoryFragments.length;
        this.hazardWorldPositions = this.map.hazards.map(cell => this.map.gridToWorld(cell.x, cell.z));
        this.textures = {};
        this.items = [];
        this.lightMeshes = [];
        this.entities = [];
        this.entityAudioTimer = 0;
        this.visualSeed = Math.random() * 10000;
        this.renderTimer = 0;
        this.targetFps = 45;
        this.comfortMode = true;
        this.lightRefreshTimer = 0;

        this.init();
    }

    async init() {
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        await this.loadTextures();
        this.buildWorld();
        this.setupEntity();
        this.setupEvents();
        this.setupUI();

        // Start render loop
        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        this.renderer.setSize(this.width, this.height);
        // A 1x render buffer keeps GPU work predictable on high-DPI laptops.
        this.renderer.setPixelRatio(1);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);
    }

    setupScene() {
        this.scene = new THREE.Scene();
        // Eerie Backrooms fog (dense yellowish-brown liminal haze)
        this.scene.fog = new THREE.FogExp2(0x221c0e, 0.045);
        this.scene.background = new THREE.Color(0x18140a);

        // Low ambient sickly yellow light
        this.ambientLight = new THREE.AmbientLight(0x403720, 0.7);
        this.scene.add(this.ambientLight);
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 100);

        // Spawn player in map grid coordinates
        const spawnWorld = this.map.gridToWorld(this.map.playerSpawn.x, this.map.playerSpawn.z);
        this.camera.position.set(spawnWorld.x, 1.7, spawnWorld.z);
        this.camera.rotation.order = 'YXZ';
        // Face into the maze's open corridor instead of the outer boundary wall.
        this.camera.rotation.y = -Math.PI / 2;

        // Camera flashlight
        this.flashlight = new THREE.SpotLight(0xfffae0, 2.5, 20, Math.PI / 4, 0.4, 1.2);
        this.flashlight.position.set(0, -0.1, 0);
        this.camera.add(this.flashlight);
        this.flashlightTarget = new THREE.Object3D();
        this.flashlightTarget.position.set(0, 0, -5);
        this.camera.add(this.flashlightTarget);
        this.flashlight.target = this.flashlightTarget;

        this.scene.add(this.camera);

        this.pistolViewModel = this.createPistolModel();
        this.pistolViewModel.position.set(0.34, -0.3, -0.58);
        this.pistolViewModel.rotation.y = Math.PI;
        this.pistolViewModel.visible = false;
        this.camera.add(this.pistolViewModel);
        this.awmViewModel = this.createAwmModel();
        this.awmViewModel.position.set(0, -0.27, -0.68);
        this.awmViewModel.rotation.y = Math.PI;
        this.awmViewModel.visible = false;
        this.camera.add(this.awmViewModel);
        this.m7ViewModel = this.createM7Model();
        this.m7ViewModel.position.set(0.37, -0.22, -1.1);
        this.m7ViewModel.rotation.y = 0.28;
        this.m7ViewModel.visible = false;
        this.camera.add(this.m7ViewModel);
        this.shotRaycaster = new THREE.Raycaster();
    }

    createM7Model(isPickup = false) {
        const group = new THREE.Group();
        const body = new THREE.MeshStandardMaterial({ color: 0x232a25, roughness: 0.48, metalness: 0.45 });
        const rail = new THREE.MeshStandardMaterial({ color: 0x111614, roughness: 0.38, metalness: 0.64 });
        const steel = new THREE.MeshStandardMaterial({ color: 0x525b54, roughness: 0.46, metalness: 0.6 });
        const grip = new THREE.MeshStandardMaterial({ color: 0x1b211d, roughness: 0.85, metalness: 0.08 });
        const box = (width, height, depth, x, y, z, material) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
            mesh.position.set(x, y, z);
            group.add(mesh);
            return mesh;
        };
        box(0.27, 0.18, 0.54, 0, 0, 0, body);                 // Receiver
        box(0.24, 0.14, 0.78, 0, 0, -0.64, body);           // Long ventilated handguard
        box(0.25, 0.045, 1.19, 0, 0.12, -0.28, rail);      // Top accessory rail
        box(0.19, 0.11, 0.46, 0, -0.005, 0.48, grip);      // Folding stock
        box(0.25, 0.2, 0.07, 0, -0.015, 0.72, grip);       // Butt pad
        const magazine = box(0.15, 0.34, 0.2, 0, -0.26, 0.01, grip);
        magazine.rotation.x = -0.09;
        group.userData.magazine = magazine;
        const pistolGrip = box(0.13, 0.29, 0.16, 0, -0.25, 0.31, grip);
        pistolGrip.rotation.x = -0.21;
        const foregrip = box(0.1, 0.22, 0.13, 0, -0.19, -0.69, grip);
        foregrip.rotation.x = -0.34;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.57, 8), steel);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.005, -1.27);
        group.add(barrel);
        const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.42, 10), rail);
        suppressor.rotation.x = Math.PI / 2;
        suppressor.position.set(0, 0.005, -1.64);
        group.add(suppressor);
        box(0.1, 0.065, 0.18, 0, 0.18, 0.12, rail);        // Holographic sight base
        box(0.035, 0.17, 0.07, -0.085, 0.29, 0.12, rail);
        box(0.035, 0.17, 0.07, 0.085, 0.29, 0.12, rail);
        box(0.205, 0.034, 0.07, 0, 0.38, 0.12, steel);
        for (let i = 0; i < 3; i++) {
            box(0.012, 0.055, 0.09, -0.126, 0.005, -0.44 - i * 0.18, steel);
        }
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 6, 4),
            new THREE.MeshBasicMaterial({ color: 0xffc253, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending })
        );
        flash.position.set(0, 0.005, -1.88);
        flash.visible = false;
        group.add(flash);
        group.userData.muzzleFlash = flash;
        if (!isPickup) {
            const sleeveMaterial = new THREE.MeshStandardMaterial({ color: 0x252c33, roughness: 0.92 });
            const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xc9927b, roughness: 0.93 });
            const segment = (start, end, radius, material, parent = group) => {
                const a = new THREE.Vector3(...start);
                const b = new THREE.Vector3(...end);
                const direction = b.clone().sub(a);
                const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.84, radius, direction.length(), 8), material);
                mesh.position.copy(a).add(b).multiplyScalar(0.5);
                mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
                parent.add(mesh);
            };
            const hand = (x, y, z, radius, parent = group) => {
                const palm = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 7), skinMaterial);
                palm.position.set(x, y, z);
                palm.scale.set(1, 0.85, 0.7);
                parent.add(palm);
            };
            segment([-0.48, -0.88, 0.55], [-0.08, -0.25, -0.69], 0.115, sleeveMaterial);
            const reloadHand = new THREE.Group();
            group.add(reloadHand);
            group.userData.reloadHand = reloadHand;
            segment([-0.06, -0.8, 0.58], [-0.2, -0.2, 0.33], 0.12, sleeveMaterial, reloadHand);
            hand(-0.08, -0.17, -0.69, 0.1); // Support hand wraps the foregrip.
            hand(-0.2, -0.16, 0.33, 0.082, reloadHand); // Trigger hand holds the pistol grip.
        }
        return group;
    }

    createPistolModel() {
        const pistol = new THREE.Group();
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x24282d, roughness: 0.35, metalness: 0.65 });
        const wornSteel = new THREE.MeshStandardMaterial({ color: 0x777c78, roughness: 0.5, metalness: 0.7 });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.34), darkMetal);
        const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.075, 0.28), wornSteel);
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.23, 0.15), darkMetal);
        const sight = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.08), wornSteel);
        barrel.position.set(0, 0.025, -0.28);
        grip.position.set(0, -0.15, 0.08);
        grip.rotation.x = -0.12;
        sight.position.set(0, 0.09, -0.17);
        pistol.add(frame, barrel, grip, sight);
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.085, 6, 4),
            new THREE.MeshBasicMaterial({ color: 0xffc253, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
        );
        flash.position.set(0, 0.03, -0.48);
        flash.visible = false;
        pistol.add(flash);
        pistol.userData.muzzleFlash = flash;
        return pistol;
    }

    createAwmModel() {
        const awm = new THREE.Group();
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x20262b, roughness: 0.4, metalness: 0.62 });
        const steel = new THREE.MeshStandardMaterial({ color: 0x81877f, roughness: 0.5, metalness: 0.68 });
        const stockMat = new THREE.MeshStandardMaterial({ color: 0x51463a, roughness: 0.8, metalness: 0.08 });
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.16, 0.52), darkMetal);
        const stock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.34), stockMat);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.045, 0.92, 8), steel);
        const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8), darkMetal);
        const scopeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 8), new THREE.MeshBasicMaterial({ color: 0x4a9da4 }));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.045, -0.53);
        stock.position.set(0, -0.025, 0.34);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.16, -0.08);
        scopeLens.rotation.x = Math.PI / 2;
        scopeLens.position.set(0, 0.16, -0.255);
        awm.add(receiver, stock, barrel, scope, scopeLens);
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 6, 4),
            new THREE.MeshBasicMaterial({ color: 0xffb642, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
        );
        flash.position.set(0, 0.045, -1.02);
        flash.visible = false;
        awm.add(flash);
        awm.userData.muzzleFlash = flash;
        return awm;
    }

    async loadTextures() {
        const texLoader = new THREE.TextureLoader();
        const assets = window.GAME_ASSETS || {};

        const loadTex = (key) => {
            return new Promise((resolve) => {
                const src = assets[key] || (key === 'smiler_hit' ? 'assets/images/smiler-hit.png'
                    : key === 'smiler_defeated' ? 'assets/images/smiler-defeated.png' : `assets/textures/${key}.jpg`);
                texLoader.load(src, (tex) => {
                    this.textures[key] = tex;
                    resolve(tex);
                }, undefined, () => {
                    console.warn(`Fallback texture for ${key}`);
                    resolve(null);
                });
            });
        };

        await Promise.all([
            loadTex('wall'),
            loadTex('carpet'),
            loadTex('ceiling'),
            loadTex('exit_door'),
            loadTex('smiler'),
            loadTex('smiler_hit'),
            loadTex('smiler_defeated'),
            loadTex('almond_water'),
            loadTex('keycard'),
            loadTex('battery')
        ]);

        // Configure tiling
        if (this.textures.carpet) {
            this.textures.carpet.wrapS = THREE.RepeatWrapping;
            this.textures.carpet.wrapT = THREE.RepeatWrapping;
            this.textures.carpet.repeat.set(25, 25);
        }
        if (this.textures.ceiling) {
            this.textures.ceiling.wrapS = THREE.RepeatWrapping;
            this.textures.ceiling.wrapT = THREE.RepeatWrapping;
            this.textures.ceiling.repeat.set(25, 25);
        }
    }

    buildWorld() {
        const cs = this.map.cellSize;
        const wh = this.map.wallHeight;
        const totalW = this.map.width * cs;
        const totalH = this.map.height * cs;

        // 1. Floor (Damp carpet)
        const floorGeo = new THREE.PlaneGeometry(totalW, totalH, this.map.width, this.map.height);
        this.addSurfaceColorVariation(floorGeo, totalW, totalH, 0.76, 1.12, [1.04, 0.98, 0.88]);
        const floorMat = new THREE.MeshStandardMaterial({
            map: this.textures.carpet,
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.1
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(totalW / 2 - cs / 2, 0, totalH / 2 - cs / 2);
        this.scene.add(floorMesh);

        // 2. Ceiling (Drop acoustic tiles with fluorescent diffusers)
        const ceilGeo = new THREE.PlaneGeometry(totalW, totalH, this.map.width, this.map.height);
        this.addSurfaceColorVariation(ceilGeo, totalW, totalH, 0.9, 1.04, [1.0, 0.99, 0.94]);
        const ceilMat = new THREE.MeshStandardMaterial({
            map: this.textures.ceiling,
            vertexColors: true,
            roughness: 0.8,
            metalness: 0.05
        });
        const ceilMesh = new THREE.Mesh(ceilGeo, ceilMat);
        ceilMesh.rotation.x = Math.PI / 2;
        ceilMesh.position.set(totalW / 2 - cs / 2, wh, totalH / 2 - cs / 2);
        this.scene.add(ceilMesh);

        // 3. Walls
        const wallGeo = new THREE.BoxGeometry(cs, wh, cs);
        const wallMat = new THREE.MeshStandardMaterial({
            map: this.textures.wall,
            color: 0xf2e3a2,
            roughness: 0.85,
            metalness: 0.05
        });

        // Pillar material
        const pillarGeo = new THREE.BoxGeometry(cs * 0.45, wh, cs * 0.45);
        const wallPositions = [];
        const pillarPositions = [];

        for (let z = 0; z < this.map.height; z++) {
            for (let x = 0; x < this.map.width; x++) {
                const cell = this.map.grid[z][x];
                const wx = x * cs;
                const wz = z * cs;

                if (cell === 1) {
                    wallPositions.push(wx, wz);
                } else if (cell === 2) {
                    pillarPositions.push(wx, wz);
                }
            }
        }

        // Instance repeated static geometry so the maze draws in two calls instead of hundreds.
        const instanceAnchor = new THREE.Object3D();
        const addInstances = (geometry, positions, shadeRange) => {
            if (!positions.length) return;
            const instances = new THREE.InstancedMesh(geometry, wallMat, positions.length / 2);
            for (let i = 0; i < positions.length; i += 2) {
                const x = positions[i] / cs;
                const z = positions[i + 1] / cs;
                instanceAnchor.position.set(positions[i], wh / 2, positions[i + 1]);
                instanceAnchor.updateMatrix();
                instances.setMatrixAt(i / 2, instanceAnchor.matrix);
                const shade = this.visualNoise(x, z, 17.3);
                const tint = shadeRange[0] + shade * (shadeRange[1] - shadeRange[0]);
                const manilaTint = Math.hypot(x - this.map.manilaRoom.x, z - this.map.manilaRoom.z) < 3.8;
                instances.setColorAt(i / 2, new THREE.Color(
                    tint * (manilaTint ? 0.94 : 1),
                    tint * (manilaTint ? 0.84 : 0.985 + shade * 0.025),
                    tint * (manilaTint ? 0.68 : 0.91 + shade * 0.06)
                ));
            }
            instances.instanceMatrix.needsUpdate = true;
            if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
            this.scene.add(instances);
        };
        addInstances(wallGeo, wallPositions, [0.9, 1.08]);
        addInstances(pillarGeo, pillarPositions, [0.82, 1.13]);
        this.addArchitecturalTrim();
        this.addDoorwayFrames();
        this.addArcadeHall();
        this.addMapDetails();
        this.addSurfaceWear();
        this.addObstacles();
        this.addLockers();

        // 4. Exit Door at exit coordinate
        const exitCoord = this.map.exitDoor;
        const exitWx = exitCoord.x * cs;
        const exitWz = exitCoord.y !== undefined ? exitCoord.y * cs : exitCoord.z * cs;
        const doorGeo = new THREE.PlaneGeometry(cs * 0.8, wh * 0.85);
        const doorMat = new THREE.MeshBasicMaterial({
            map: this.textures.exit_door,
            side: THREE.DoubleSide
        });
        const doorMesh = new THREE.Mesh(doorGeo, doorMat);
        doorMesh.position.set(exitWx, wh * 0.425, exitWz - cs * 0.45);
        this.scene.add(doorMesh);

        // Exit emergency sign light
        const exitLight = new THREE.PointLight(0x22ff66, 1.5, 6);
        exitLight.position.set(exitWx, wh - 0.5, exitWz - cs * 0.3);
        this.scene.add(exitLight);

        // 5. Ceiling Fluorescent Lights. Keep the full layout as data, but only
        // create eight real point lights to keep the WebGL light shader small.
        this.ceilingLightCandidates = [];
        this.map.lights.forEach(lt => {
            if (lt.state === 'dark') return; // Broken dark light
            this.ceilingLightCandidates.push(lt);
        });
        this.addCeilingFixtures();
        const activeLightCount = Math.min(8, this.ceilingLightCandidates.length);
        for (let i = 0; i < activeLightCount; i++) {
            const light = new THREE.PointLight(0xfff6cf, 1.2, 9, 1.5);
            this.scene.add(light);
            this.lightMeshes.push({ light, baseIntensity: 1.2, state: 'normal', flickerSeed: Math.random() * 100 });
        }
        this.refreshActiveLights();

        // 6. Spawn Collectibles
        this.spawnItems();
    }

    addArchitecturalTrim() {
        const cs = this.map.cellSize;
        const faces = [];
        for (let z = 1; z < this.map.height - 1; z++) {
            for (let x = 1; x < this.map.width - 1; x++) {
                if (this.map.grid[z][x] !== 1) continue;
                if (this.map.isWalkable(x, z - 1)) faces.push({ x, z: z - 0.5, turn: 0 });
                if (this.map.isWalkable(x, z + 1)) faces.push({ x, z: z + 0.5, turn: 0 });
                if (this.map.isWalkable(x - 1, z)) faces.push({ x: x - 0.5, z, turn: Math.PI / 2 });
                if (this.map.isWalkable(x + 1, z)) faces.push({ x: x + 0.5, z, turn: Math.PI / 2 });
            }
        }
        if (!faces.length) return;
        const trim = new THREE.InstancedMesh(
            new THREE.BoxGeometry(cs, 0.16, 0.07),
            new THREE.MeshStandardMaterial({ color: 0xb9a96d, roughness: 0.94 }),
            faces.length
        );
        const anchor = new THREE.Object3D();
        faces.forEach((face, index) => {
            anchor.position.set(face.x * cs, 0.11, face.z * cs);
            anchor.rotation.set(0, face.turn, 0);
            anchor.updateMatrix();
            trim.setMatrixAt(index, anchor.matrix);
        });
        trim.instanceMatrix.needsUpdate = true;
        this.scene.add(trim);

        // Sparse sockets make the wall surfaces read like the dated retail/office rooms.
        const socketFaces = faces.filter((face, index) => index % 11 === 4);
        const sockets = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.17, 0.14, 0.025),
            new THREE.MeshStandardMaterial({ color: 0xc7b879, roughness: 0.92 }),
            socketFaces.length
        );
        socketFaces.forEach((face, index) => {
            anchor.position.set(face.x * cs, 0.43, face.z * cs);
            anchor.rotation.set(0, face.turn, 0);
            anchor.updateMatrix();
            sockets.setMatrixAt(index, anchor.matrix);
        });
        sockets.instanceMatrix.needsUpdate = true;
        this.scene.add(sockets);
    }

    addCeilingFixtures() {
        const lights = this.map.lights;
        if (!lights.length) return;
        const frame = new THREE.InstancedMesh(
            new THREE.BoxGeometry(2.05, 0.09, 0.57),
            new THREE.MeshStandardMaterial({ color: 0x797869, roughness: 0.58, metalness: 0.35 }),
            lights.length
        );
        const diffuser = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1.88, 0.035, 0.45),
            new THREE.MeshBasicMaterial({ color: 0xfff5c8 }),
            lights.length
        );
        const anchor = new THREE.Object3D();
        lights.forEach((light, index) => {
            anchor.rotation.set(0, (light.x + light.z) % 3 === 0 ? Math.PI / 2 : 0, 0);
            anchor.position.set(light.worldX, this.map.wallHeight - 0.065, light.worldZ);
            anchor.updateMatrix();
            frame.setMatrixAt(index, anchor.matrix);
            anchor.position.y -= 0.062;
            anchor.updateMatrix();
            diffuser.setMatrixAt(index, anchor.matrix);
            const brightness = light.state === 'dark' ? 0.22 : light.state === 'flicker' ? 0.74 : light.state === 'manila' ? 0.63 : 1;
            diffuser.setColorAt(index, new THREE.Color(brightness, brightness * (light.state === 'manila' ? 0.68 : 0.98), brightness * (light.state === 'manila' ? 0.42 : 0.86)));
        });
        frame.instanceMatrix.needsUpdate = true;
        diffuser.instanceMatrix.needsUpdate = true;
        if (diffuser.instanceColor) diffuser.instanceColor.needsUpdate = true;
        this.scene.add(frame, diffuser);
    }

    addDoorwayFrames() {
        const openings = [];
        for (const room of this.map.openRooms) {
            for (let x = room.x0; x <= room.x1; x++) {
                if (this.map.isWalkable(x, room.z0) && this.map.isWalkable(x, room.z0 - 1)) openings.push({ x, z: room.z0 - 0.5, turn: 0 });
                if (this.map.isWalkable(x, room.z1) && this.map.isWalkable(x, room.z1 + 1)) openings.push({ x, z: room.z1 + 0.5, turn: 0 });
            }
            for (let z = room.z0; z <= room.z1; z++) {
                if (this.map.isWalkable(room.x0, z) && this.map.isWalkable(room.x0 - 1, z)) openings.push({ x: room.x0 - 0.5, z, turn: Math.PI / 2 });
                if (this.map.isWalkable(room.x1, z) && this.map.isWalkable(room.x1 + 1, z)) openings.push({ x: room.x1 + 0.5, z, turn: Math.PI / 2 });
            }
        }
        if (!openings.length) return;
        const material = new THREE.MeshStandardMaterial({ color: 0xcfc28a, roughness: 0.93 });
        const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 2.95, 0.2), material, openings.length * 2);
        const lintels = new THREE.InstancedMesh(new THREE.BoxGeometry(3.8, 0.17, 0.2), material, openings.length);
        const anchor = new THREE.Object3D();
        openings.forEach((opening, index) => {
            for (let side = 0; side < 2; side++) {
                const lateral = side ? 1.9 : -1.9;
                anchor.position.set(opening.x * this.map.cellSize + Math.cos(opening.turn) * lateral, 1.48,
                    opening.z * this.map.cellSize - Math.sin(opening.turn) * lateral);
                anchor.rotation.set(0, opening.turn, 0);
                anchor.updateMatrix();
                posts.setMatrixAt(index * 2 + side, anchor.matrix);
            }
            anchor.position.set(opening.x * this.map.cellSize, 3.02, opening.z * this.map.cellSize);
            anchor.updateMatrix();
            lintels.setMatrixAt(index, anchor.matrix);
        });
        posts.instanceMatrix.needsUpdate = true;
        lintels.instanceMatrix.needsUpdate = true;
        this.scene.add(posts, lintels);
    }

    addArcadeHall() {
        // A long, open arcade inspired by the supplied Level 0 hall reference.
        const room = this.map.openRooms[0];
        const count = room.x1 - room.x0 - 1;
        const arch = new THREE.Shape();
        arch.moveTo(-2, 0);
        arch.lineTo(-2, this.map.wallHeight);
        arch.lineTo(2, this.map.wallHeight);
        arch.lineTo(2, 0);
        arch.lineTo(1.5, 0);
        arch.lineTo(1.5, 1.48);
        arch.absarc(0, 1.48, 1.5, 0, Math.PI, false);
        arch.lineTo(-1.5, 0);
        arch.closePath();
        const facades = new THREE.InstancedMesh(
            new THREE.ExtrudeGeometry(arch, { depth: 0.16, bevelEnabled: false, curveSegments: 10 }),
            new THREE.MeshStandardMaterial({ color: 0xd1c39a, roughness: 0.95, side: THREE.DoubleSide }),
            count
        );
        const recesses = new THREE.InstancedMesh(
            new THREE.BoxGeometry(2.96, 2.88, 0.025),
            new THREE.MeshStandardMaterial({ color: 0xabb7a0, roughness: 0.96 }),
            count
        );
        const halfWalls = new THREE.InstancedMesh(
            new THREE.BoxGeometry(2.98, 1.02, 0.12),
            new THREE.MeshStandardMaterial({ color: 0xd5c8a7, roughness: 0.94 }),
            count
        );
        const anchor = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            const x = (room.x0 + i + 1) * this.map.cellSize;
            const boundaryZ = (room.z1 + 0.5) * this.map.cellSize;
            anchor.position.set(x, 0, boundaryZ - 0.2);
            anchor.rotation.set(0, 0, 0);
            anchor.updateMatrix();
            facades.setMatrixAt(i, anchor.matrix);
            anchor.position.set(x, 1.44, boundaryZ - 0.015);
            anchor.updateMatrix();
            recesses.setMatrixAt(i, anchor.matrix);
            anchor.position.set(x, 0.51, boundaryZ - 0.25);
            anchor.updateMatrix();
            halfWalls.setMatrixAt(i, anchor.matrix);
            const shade = 0.82 + this.visualNoise(i, room.z1, 453) * 0.18;
            recesses.setColorAt(i, new THREE.Color(shade, shade, shade * 0.92));
        }
        for (const mesh of [facades, recesses, halfWalls]) mesh.instanceMatrix.needsUpdate = true;
        if (recesses.instanceColor) recesses.instanceColor.needsUpdate = true;
        this.scene.add(facades, recesses, halfWalls);
    }

    visualNoise(x, z, salt = 0) {
        const value = Math.sin((x + this.visualSeed + salt) * 127.1 + (z - this.visualSeed) * 311.7) * 43758.5453;
        return value - Math.floor(value);
    }

    addLockers() {
        const positions = this.map.lockers || [];
        if (!positions.length) return;
        const body = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1.35, 2.35, 1.05),
            new THREE.MeshStandardMaterial({ color: 0x565b56, roughness: 0.78, metalness: 0.28 }),
            positions.length
        );
        const doors = new THREE.InstancedMesh(
            new THREE.BoxGeometry(0.92, 2.0, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x77796d, roughness: 0.66, metalness: 0.35 }),
            positions.length
        );
        const anchor = new THREE.Object3D();
        this.lockerPositions = positions.map((cell, index) => {
            const world = this.map.gridToWorld(cell.x, cell.z);
            anchor.position.set(world.x, 1.18, world.z);
            anchor.rotation.set(0, this.visualNoise(cell.x, cell.z, 121) > 0.5 ? Math.PI / 2 : 0, 0);
            anchor.updateMatrix();
            body.setMatrixAt(index, anchor.matrix);
            const facing = anchor.rotation.y;
            anchor.position.set(world.x + Math.sin(facing) * 0.56, 1.18, world.z + Math.cos(facing) * 0.56);
            anchor.scale.set(1, 1, 1);
            anchor.updateMatrix();
            doors.setMatrixAt(index, anchor.matrix);
            return new THREE.Vector3(world.x, 0, world.z);
        });
        body.instanceMatrix.needsUpdate = true;
        doors.instanceMatrix.needsUpdate = true;
        this.scene.add(body, doors);
    }

    addSurfaceColorVariation(geometry, width, height, minShade, maxShade, tint) {
        const positions = geometry.attributes.position;
        const colors = new Float32Array(positions.count * 3);
        for (let i = 0; i < positions.count; i++) {
            const x = Math.round((positions.getX(i) + width / 2) / this.map.cellSize);
            const z = Math.round((positions.getY(i) + height / 2) / this.map.cellSize);
            const shade = minShade + this.visualNoise(x, z, 4.9) * (maxShade - minShade);
            colors[i * 3] = shade * tint[0];
            colors[i * 3 + 1] = shade * tint[1];
            colors[i * 3 + 2] = shade * tint[2];
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    addMapDetails() {
        const cs = this.map.cellSize;
        const puddleGeo = new THREE.CircleGeometry(1, 12);
        const puddleMat = new THREE.MeshStandardMaterial({
            color: 0x8da8a0,
            roughness: 0.22,
            metalness: 0.12,
            transparent: true,
            opacity: 0.68,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const puddles = new THREE.InstancedMesh(puddleGeo, puddleMat, this.map.hazards.length);
        const anchor = new THREE.Object3D();
        this.map.hazards.forEach((cell, index) => {
            const world = this.map.gridToWorld(cell.x, cell.z);
            const size = 0.78 + this.visualNoise(cell.x, cell.z, 33) * 0.38;
            anchor.position.set(world.x, 0.025, world.z);
            anchor.rotation.set(-Math.PI / 2, 0, this.visualNoise(cell.z, cell.x, 37) * Math.PI);
            anchor.scale.set(size * 1.25, size * 0.8, 1);
            anchor.updateMatrix();
            puddles.setMatrixAt(index, anchor.matrix);
            puddles.setColorAt(index, new THREE.Color(0.64 + size * 0.12, 0.78 + size * 0.08, 0.72 + size * 0.1));
        });
        if (this.map.hazards.length) {
            puddles.instanceMatrix.needsUpdate = true;
            if (puddles.instanceColor) puddles.instanceColor.needsUpdate = true;
            this.scene.add(puddles);
        }

        // Short exposed ceiling pipes add depth while staying in one instanced draw call.
        const pipeCells = [];
        const blocked = [];
        for (let z = 2; z < this.map.height - 2; z++) {
            for (let x = 2; x < this.map.width - 2; x++) {
                if (!this.map.isWalkable(x, z)) continue;
                const alongX = this.map.isWalkable(x - 1, z) && this.map.isWalkable(x + 1, z);
                const alongZ = this.map.isWalkable(x, z - 1) && this.map.isWalkable(x, z + 1);
                if (!alongX && !alongZ) continue;
                if (this.visualNoise(x, z, 51) < 0.77) continue;
                if (blocked.some(pos => (pos.x - x) ** 2 + (pos.z - z) ** 2 < 16)) continue;
                pipeCells.push({ x, z, alongX });
                blocked.push({ x, z });
            }
        }

        if (pipeCells.length) {
            const pipeGeo = new THREE.CylinderGeometry(0.075, 0.075, cs * 0.82, 6);
            const pipeMat = new THREE.MeshStandardMaterial({ color: 0x716b53, roughness: 0.68, metalness: 0.48 });
            const pipes = new THREE.InstancedMesh(pipeGeo, pipeMat, pipeCells.length);
            pipeCells.forEach((cell, index) => {
                const world = this.map.gridToWorld(cell.x, cell.z);
                anchor.position.set(world.x, this.map.wallHeight - 0.22, world.z);
                anchor.rotation.set(cell.alongX ? 0 : Math.PI / 2, 0, cell.alongX ? Math.PI / 2 : 0);
                anchor.scale.set(1, 1, 1);
                anchor.updateMatrix();
                pipes.setMatrixAt(index, anchor.matrix);
            });
            pipes.instanceMatrix.needsUpdate = true;
            this.scene.add(pipes);
        }
    }

    addSurfaceWear() {
        const cs = this.map.cellSize;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const stain = ctx.createRadialGradient(64, 64, 8, 64, 64, 63);
        stain.addColorStop(0, 'rgba(41, 33, 17, 0.72)');
        stain.addColorStop(0.48, 'rgba(52, 44, 24, 0.48)');
        stain.addColorStop(0.82, 'rgba(46, 37, 19, 0.18)');
        stain.addColorStop(1, 'rgba(46, 37, 19, 0)');
        ctx.fillStyle = stain;
        ctx.fillRect(0, 0, 128, 128);
        const stainTexture = new THREE.CanvasTexture(canvas);
        stainTexture.encoding = THREE.sRGBEncoding;
        const stainMaterial = new THREE.MeshBasicMaterial({
            map: stainTexture, transparent: true, depthWrite: false,
            side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1
        });
        const wallCanvas = document.createElement('canvas');
        wallCanvas.width = wallCanvas.height = 128;
        const wallCtx = wallCanvas.getContext('2d');
        const damp = wallCtx.createRadialGradient(64, 56, 3, 64, 64, 70);
        damp.addColorStop(0, 'rgba(50, 42, 24, 0.6)');
        damp.addColorStop(0.7, 'rgba(52, 43, 25, 0.22)');
        damp.addColorStop(1, 'rgba(52, 43, 25, 0)');
        wallCtx.fillStyle = damp;
        wallCtx.fillRect(0, 0, 128, 128);
        wallCtx.strokeStyle = 'rgba(42, 34, 20, 0.36)';
        wallCtx.lineWidth = 3;
        for (let i = 0; i < 7; i++) {
            const x = 25 + i * 13;
            wallCtx.beginPath();
            wallCtx.moveTo(x, 18 + (i % 3) * 11);
            wallCtx.bezierCurveTo(x - 7, 45, x + 5, 67, x - 3, 82 + (i % 4) * 8);
            wallCtx.stroke();
        }
        const wallTexture = new THREE.CanvasTexture(wallCanvas);
        wallTexture.encoding = THREE.sRGBEncoding;
        const wallStainMaterial = new THREE.MeshBasicMaterial({
            map: wallTexture, transparent: true, depthWrite: false,
            side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1
        });

        const floorCells = [];
        const debrisCells = [];
        const wallFaces = [];
        const sides = [
            { dx: 1, dz: 0, angle: Math.PI / 2 },
            { dx: -1, dz: 0, angle: -Math.PI / 2 },
            { dx: 0, dz: 1, angle: 0 },
            { dx: 0, dz: -1, angle: Math.PI }
        ];
        for (let z = 1; z < this.map.height - 1; z++) {
            for (let x = 1; x < this.map.width - 1; x++) {
                if (this.map.isWalkable(x, z)) {
                    if (this.visualNoise(x, z, 203) < 0.48) floorCells.push({ x, z });
                    if (this.visualNoise(x, z, 211) < 0.34) debrisCells.push({ x, z });
                } else if (this.map.grid[z][x] === 1) {
                    sides.forEach((side, index) => {
                        if (this.map.isWalkable(x + side.dx, z + side.dz)) {
                            wallFaces.push({ x, z, side, index });
                        }
                    });
                }
            }
        }

        const anchor = new THREE.Object3D();
        if (floorCells.length) {
            const floorStains = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), stainMaterial, floorCells.length);
            floorCells.forEach(({ x, z }, index) => {
                const offsetX = (this.visualNoise(x, z, 213) - 0.5) * 1.7;
                const offsetZ = (this.visualNoise(x, z, 214) - 0.5) * 1.7;
                anchor.position.set(x * cs + offsetX, 0.016, z * cs + offsetZ);
                anchor.rotation.set(-Math.PI / 2, 0, this.visualNoise(x, z, 215) * Math.PI * 2);
                anchor.scale.set(0.9 + this.visualNoise(x, z, 216) * 1.9, 0.7 + this.visualNoise(x, z, 217) * 1.5, 1);
                anchor.updateMatrix();
                floorStains.setMatrixAt(index, anchor.matrix);
            });
            floorStains.instanceMatrix.needsUpdate = true;
            floorStains.frustumCulled = false;
            this.scene.add(floorStains);
        }

        if (wallFaces.length) {
            const trim = new THREE.InstancedMesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0x4e4837, roughness: 0.95 }),
                wallFaces.length
            );
            wallFaces.forEach(({ x, z, side }, index) => {
                anchor.position.set(x * cs + side.dx * (cs / 2 + 0.035), 0.065, z * cs + side.dz * (cs / 2 + 0.035));
                anchor.rotation.set(0, side.angle, 0);
                anchor.scale.set(cs - 0.07, 0.13, 0.08);
                anchor.updateMatrix();
                trim.setMatrixAt(index, anchor.matrix);
            });
            trim.instanceMatrix.needsUpdate = true;
            trim.frustumCulled = false;
            this.scene.add(trim);

            const wornFaces = wallFaces.filter(({ x, z, index }) => this.visualNoise(x, z, 230 + index) < 0.24);
            if (wornFaces.length) {
                const wallStains = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), wallStainMaterial, wornFaces.length);
                wornFaces.forEach(({ x, z, side, index }, i) => {
                    const along = (this.visualNoise(x, z, 235 + index) - 0.5) * 1.45;
                    const acrossX = side.dz ? along : 0;
                    const acrossZ = side.dx ? along : 0;
                    anchor.position.set(
                        x * cs + side.dx * (cs / 2 + 0.014) + acrossX,
                        1.1 + this.visualNoise(x, z, 239 + index) * 0.95,
                        z * cs + side.dz * (cs / 2 + 0.014) + acrossZ
                    );
                    anchor.rotation.set(0, side.angle, 0);
                    anchor.scale.set(0.8 + this.visualNoise(x, z, 243 + index) * 1.6, 0.7 + this.visualNoise(x, z, 247 + index) * 1.5, 1);
                    anchor.updateMatrix();
                    wallStains.setMatrixAt(i, anchor.matrix);
                });
                wallStains.instanceMatrix.needsUpdate = true;
                wallStains.frustumCulled = false;
                this.scene.add(wallStains);
            }
        }

        if (debrisCells.length) {
            const debris = new THREE.InstancedMesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshStandardMaterial({ color: 0xb4a789, roughness: 1 }),
                debrisCells.length * 2
            );
            debrisCells.forEach(({ x, z }, cellIndex) => {
                for (let piece = 0; piece < 2; piece++) {
                    const salt = 260 + piece * 5;
                    anchor.position.set(
                        x * cs + (this.visualNoise(x, z, salt) - 0.5) * 2.7,
                        0.018,
                        z * cs + (this.visualNoise(x, z, salt + 1) - 0.5) * 2.7
                    );
                    anchor.rotation.set(0, this.visualNoise(x, z, salt + 2) * Math.PI * 2, 0);
                    anchor.scale.set(0.08 + this.visualNoise(x, z, salt + 3) * 0.3, 0.025, 0.06 + this.visualNoise(x, z, salt + 4) * 0.22);
                    anchor.updateMatrix();
                    debris.setMatrixAt(cellIndex * 2 + piece, anchor.matrix);
                }
            });
            debris.instanceMatrix.needsUpdate = true;
            debris.frustumCulled = false;
            this.scene.add(debris);
        }
    }

    addObstacles() {
        const obstacles = this.map.obstacles;
        const crates = obstacles.filter(item => item.kind === 'crates');
        const cabinets = obstacles.filter(item => item.kind === 'cabinet');
        const barrels = obstacles.filter(item => item.kind === 'barrel');
        const box = new THREE.BoxGeometry(1, 1, 1);
        const anchor = new THREE.Object3D();
        const crateCanvas = document.createElement('canvas');
        crateCanvas.width = crateCanvas.height = 128;
        const crateCtx = crateCanvas.getContext('2d');
        crateCtx.fillStyle = '#9a7b50';
        crateCtx.fillRect(0, 0, 128, 128);
        crateCtx.strokeStyle = '#58452e';
        crateCtx.lineWidth = 5;
        for (let y = 5; y < 128; y += 40) {
            crateCtx.beginPath();
            crateCtx.moveTo(0, y);
            crateCtx.lineTo(128, y + 2);
            crateCtx.stroke();
        }
        crateCtx.strokeStyle = 'rgba(63, 48, 30, 0.48)';
        crateCtx.lineWidth = 2;
        for (let x = 17; x < 128; x += 29) {
            crateCtx.beginPath();
            crateCtx.moveTo(x, 0);
            crateCtx.lineTo(x + 8, 128);
            crateCtx.stroke();
        }
        const crateTexture = new THREE.CanvasTexture(crateCanvas);
        crateTexture.encoding = THREE.sRGBEncoding;

        if (crates.length) {
            const crateMesh = new THREE.InstancedMesh(
                box,
                new THREE.MeshStandardMaterial({ map: crateTexture, roughness: 0.93 }),
                crates.length * 2
            );
            crates.forEach((item, index) => {
                anchor.rotation.set(0, 0, 0);
                anchor.position.set(item.x, 0.37, item.z);
                anchor.scale.set(1.1, 0.74, 1.05);
                anchor.updateMatrix();
                crateMesh.setMatrixAt(index * 2, anchor.matrix);
                anchor.position.set(item.x + 0.08, 0.98, item.z - 0.05);
                anchor.scale.set(0.78, 0.45, 0.78);
                anchor.updateMatrix();
                crateMesh.setMatrixAt(index * 2 + 1, anchor.matrix);
                const shade = 0.82 + this.visualNoise(item.cellX, item.cellZ, 310) * 0.25;
                const color = new THREE.Color(shade, shade * 0.92, shade * 0.75);
                crateMesh.setColorAt(index * 2, color);
                crateMesh.setColorAt(index * 2 + 1, color);
            });
            crateMesh.instanceMatrix.needsUpdate = true;
            if (crateMesh.instanceColor) crateMesh.instanceColor.needsUpdate = true;
            crateMesh.frustumCulled = false;
            this.scene.add(crateMesh);
        }

        if (cabinets.length) {
            const cabinetMesh = new THREE.InstancedMesh(
                box,
                new THREE.MeshStandardMaterial({ color: 0x646a63, roughness: 0.78, metalness: 0.25 }),
                cabinets.length
            );
            const cabinetDoors = new THREE.InstancedMesh(
                box,
                new THREE.MeshStandardMaterial({ color: 0x818579, roughness: 0.72, metalness: 0.3 }),
                cabinets.length
            );
            cabinets.forEach((item, index) => {
                anchor.rotation.set(0, 0, 0);
                anchor.position.set(item.x, item.height / 2, item.z);
                anchor.scale.set(item.halfX * 2, item.height, item.halfZ * 2);
                anchor.updateMatrix();
                cabinetMesh.setMatrixAt(index, anchor.matrix);
                const longAlongX = item.halfX > item.halfZ;
                const towardCenter = longAlongX
                    ? (item.z > item.cellZ * this.map.cellSize ? -1 : 1)
                    : (item.x > item.cellX * this.map.cellSize ? -1 : 1);
                anchor.position.set(
                    item.x + (longAlongX ? 0 : towardCenter * (item.halfX + 0.027)),
                    item.height / 2,
                    item.z + (longAlongX ? towardCenter * (item.halfZ + 0.027) : 0)
                );
                anchor.rotation.set(0, longAlongX ? 0 : Math.PI / 2, 0);
                anchor.scale.set(1.45, 1.83, 0.045);
                anchor.updateMatrix();
                cabinetDoors.setMatrixAt(index, anchor.matrix);
            });
            cabinetMesh.instanceMatrix.needsUpdate = true;
            cabinetDoors.instanceMatrix.needsUpdate = true;
            cabinetMesh.frustumCulled = false;
            cabinetDoors.frustumCulled = false;
            this.scene.add(cabinetMesh, cabinetDoors);
        }

        if (barrels.length) {
            const barrelMesh = new THREE.InstancedMesh(
                new THREE.CylinderGeometry(0.41, 0.42, 1.1, 10),
                new THREE.MeshStandardMaterial({ color: 0x6d4935, roughness: 0.84, metalness: 0.32 }),
                barrels.length
            );
            const barrelBands = new THREE.InstancedMesh(
                new THREE.CylinderGeometry(0.435, 0.435, 0.075, 10),
                new THREE.MeshStandardMaterial({ color: 0x353a34, roughness: 0.7, metalness: 0.48 }),
                barrels.length * 2
            );
            barrels.forEach((item, index) => {
                anchor.rotation.set(0, 0, 0);
                anchor.scale.set(1, 1, 1);
                anchor.position.set(item.x, 0.55, item.z);
                anchor.updateMatrix();
                barrelMesh.setMatrixAt(index, anchor.matrix);
                for (let band = 0; band < 2; band++) {
                    anchor.position.y = band === 0 ? 0.22 : 0.87;
                    anchor.updateMatrix();
                    barrelBands.setMatrixAt(index * 2 + band, anchor.matrix);
                }
            });
            barrelMesh.instanceMatrix.needsUpdate = true;
            barrelBands.instanceMatrix.needsUpdate = true;
            barrelMesh.frustumCulled = false;
            barrelBands.frustumCulled = false;
            this.scene.add(barrelMesh, barrelBands);
        }
    }

    spawnItems() {
        const cs = this.map.cellSize;

        // Keycards
        this.map.keycards.forEach((pos, idx) => {
            const world = this.map.gridToWorld(pos.x, pos.z);
            const spriteMat = new THREE.SpriteMaterial({
                map: this.textures.keycard,
                color: 0xffffff
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(0.8, 0.8, 1);
            sprite.position.set(world.x, 0.7, world.z);
            this.scene.add(sprite);

            this.items.push({
                type: 'keycard',
                mesh: sprite,
                pos: sprite.position.clone(),
                baseY: sprite.position.y,
                collected: false
            });
        });

        // Almond Water
        this.map.almondWaters.forEach(pos => {
            const world = this.map.gridToWorld(pos.x, pos.z);
            const spriteMat = new THREE.SpriteMaterial({
                map: this.textures.almond_water,
                color: 0xffffff
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(0.9, 0.9, 1);
            sprite.position.set(world.x, 0.8, world.z);
            this.scene.add(sprite);

            this.items.push({
                type: 'almond_water',
                mesh: sprite,
                pos: sprite.position.clone(),
                baseY: sprite.position.y,
                collected: false
            });
        });

        // Batteries
        this.map.batteries.forEach(pos => {
            const world = this.map.gridToWorld(pos.x, pos.z);
            const spriteMat = new THREE.SpriteMaterial({
                map: this.textures.battery,
                color: 0xffffff
            });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.scale.set(0.65, 0.65, 1);
            sprite.position.set(world.x, 0.6, world.z);
            this.scene.add(sprite);

            this.items.push({
                type: 'battery',
                mesh: sprite,
                pos: sprite.position.clone(),
                baseY: sprite.position.y,
                collected: false
            });
        });

        const memories = this.map.memoryFragments;
        if (memories.length) {
            const geometry = new THREE.OctahedronGeometry(0.22, 0);
            const material = new THREE.MeshBasicMaterial({ color: 0x72ffe0 });
            const shards = new THREE.InstancedMesh(geometry, material, memories.length);
            const anchor = new THREE.Object3D();
            memories.forEach((cell, instanceId) => {
                const world = this.map.gridToWorld(cell.x, cell.z);
                anchor.position.set(world.x, 0.85, world.z);
                anchor.rotation.set(0.2, this.visualNoise(cell.x, cell.z, 65) * Math.PI, 0.2);
                anchor.scale.setScalar(1);
                anchor.updateMatrix();
                shards.setMatrixAt(instanceId, anchor.matrix);
                shards.setColorAt(instanceId, new THREE.Color().setHSL(0.43 + this.visualNoise(cell.z, cell.x, 71) * 0.12, 0.88, 0.64));
                this.items.push({
                    type: 'memory',
                    mesh: shards,
                    instanceId,
                    pos: new THREE.Vector3(world.x, 0.85, world.z),
                    collected: false
                });
            });
            shards.instanceMatrix.needsUpdate = true;
            if (shards.instanceColor) shards.instanceColor.needsUpdate = true;
            this.scene.add(shards);
        }

        const weaponCell = this.map.weaponSpawns[0];
        if (weaponCell) {
            const world = this.map.gridToWorld(weaponCell.x, weaponCell.z);
            const pickup = this.createPistolModel();
            pickup.position.set(world.x, 0.42, world.z);
            pickup.rotation.y = this.visualNoise(weaponCell.x, weaponCell.z, 91) * Math.PI * 2;
            pickup.scale.setScalar(0.82);
            this.scene.add(pickup);
            this.items.push({ type: 'gun', mesh: pickup, pos: new THREE.Vector3(world.x, 0.42, world.z), baseY: 0.42, collected: false });
        }

        const awmCell = this.map.awmSpawns[0];
        if (awmCell) {
            const world = this.map.gridToWorld(awmCell.x, awmCell.z);
            const pickup = this.createAwmModel();
            pickup.position.set(world.x, 0.48, world.z);
            pickup.rotation.y = this.visualNoise(awmCell.x, awmCell.z, 125) * Math.PI * 2;
            pickup.scale.setScalar(0.88);
            this.scene.add(pickup);
            this.items.push({ type: 'awm', mesh: pickup, pos: new THREE.Vector3(world.x, 0.48, world.z), baseY: 0.48, collected: false });
        }

        for (const cell of this.map.m7Spawns) {
            const world = this.map.gridToWorld(cell.x, cell.z);
            const pickup = this.createM7Model(true);
            pickup.position.set(world.x, 0.66, world.z);
            pickup.rotation.y = this.visualNoise(cell.x, cell.z, 143) * Math.PI * 2;
            this.scene.add(pickup);
            this.items.push({ type: 'm7', mesh: pickup, pos: new THREE.Vector3(world.x, 0.66, world.z), baseY: 0.66, collected: false });
        }

        const caches = this.map.ammoCaches;
        if (caches.length) {
            const geometry = new THREE.BoxGeometry(0.34, 0.2, 0.24);
            const material = new THREE.MeshStandardMaterial({ color: 0xc99b3e, roughness: 0.62, metalness: 0.25 });
            const ammoBoxes = new THREE.InstancedMesh(geometry, material, caches.length);
            const anchor = new THREE.Object3D();
            caches.forEach((cell, instanceId) => {
                const world = this.map.gridToWorld(cell.x, cell.z);
                anchor.position.set(world.x, 0.2, world.z);
                anchor.rotation.set(0, this.visualNoise(cell.z, cell.x, 99) * Math.PI, 0);
                anchor.scale.setScalar(1);
                anchor.updateMatrix();
                ammoBoxes.setMatrixAt(instanceId, anchor.matrix);
                ammoBoxes.setColorAt(instanceId, new THREE.Color().setHSL(0.105 + this.visualNoise(cell.x, cell.z, 103) * 0.035, 0.62, 0.43));
                this.items.push({
                    type: 'ammo',
                    mesh: ammoBoxes,
                    instanceId,
                    pos: new THREE.Vector3(world.x, 0.2, world.z),
                    collected: false
                });
            });
            ammoBoxes.instanceMatrix.needsUpdate = true;
            if (ammoBoxes.instanceColor) ammoBoxes.instanceColor.needsUpdate = true;
            this.scene.add(ammoBoxes);
        }
    }

    setupEntity() {
        const playerSpawn = this.map.playerSpawn;
        const chosenSpawns = [this.map.monsterSpawn];
        const desiredSpawns = [
            { x: 9, z: 4 },
            { x: 19, z: 8 },
            { x: 5, z: 17 },
            { x: 21, z: 20 },
            { x: 17, z: 4 },
            { x: 2, z: 11 },
            { x: 11, z: 13 },
            { x: 20, z: 15 },
            { x: 12, z: 6 },
            { x: 4, z: 21 },
            { x: 21, z: 3 },
            { x: 14, z: 20 },
            { x: 7, z: 11 },
            { x: 18, z: 12 },
            { x: 10, z: 18 },
            { x: 23, z: 12 },
            { x: 2, z: 7 },
            { x: 17, z: 23 },
            { x: 13, z: 2 }
        ];
        const minFromPlayerSq = 6 * 6;
        const minBetweenSmilersSq = 3 * 3;

        for (const desired of desiredSpawns) {
            const candidates = [];
            for (let z = 1; z < this.map.height - 1; z++) {
                for (let x = 1; x < this.map.width - 1; x++) {
                    if (!this.map.isWalkable(x, z)) continue;
                    if (this.map.isManilaRoom(x, z)) continue;
                    const playerDx = x - playerSpawn.x;
                    const playerDz = z - playerSpawn.z;
                    if (playerDx * playerDx + playerDz * playerDz < minFromPlayerSq) continue;
                    if (chosenSpawns.some(spawn => {
                        const dx = x - spawn.x;
                        const dz = z - spawn.z;
                        return dx * dx + dz * dz < minBetweenSmilersSq;
                    })) continue;

                    const dx = x - desired.x;
                    const dz = z - desired.z;
                    candidates.push({ x, z, score: dx * dx + dz * dz });
                }
            }
            candidates.sort((a, b) => a.score - b.score);
            if (candidates.length) {
                // Choose among a few nearby cells so each new game varies slightly.
                const pool = candidates.slice(0, Math.min(4, candidates.length));
                chosenSpawns.push(pool[Math.floor(Math.random() * pool.length)]);
            }
        }

        this.entities = chosenSpawns.map(spawn =>
            new BackroomsEntity(this.scene, this.map, this.audio, this.textures, spawn)
        );
    }

    setupEvents() {
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.width, this.height);
        });

        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI' && !e.repeat && this.isRunning && !this.isGameOver && !this.isVictory) {
                this.toggleCheatMenu();
                return;
            }
            if (e.code === 'Escape' && this.mouseLookFallback && !this.cheatMenuOpen && this.isRunning) {
                const pauseOverlay = document.getElementById('pause-overlay');
                const paused = pauseOverlay && pauseOverlay.style.display === 'flex';
                if (pauseOverlay) pauseOverlay.style.display = paused ? 'none' : 'flex';
                if (paused) this.audio.resume(); else this.audio.suspend();
                return;
            }
            if (this.cheatMenuOpen) {
                if (e.code === 'Escape') this.toggleCheatMenu();
                return;
            }
            if (document.getElementById('pause-overlay')?.style.display === 'flex') return;
            const wasDown = !!this.keys[e.code];
            this.keys[e.code] = true;
            if (this.isRunning && (e.code === 'KeyV' || e.code === 'ControlLeft' || e.code === 'ControlRight') && !wasDown && !e.repeat) {
                this.slideRequested = true;
            }

            const number = e.code.startsWith('Digit') ? Number(e.code.slice(5))
                : e.code.startsWith('Numpad') ? Number(e.code.slice(6)) : 0;
            if (number >= 1 && number <= 5 && !e.repeat) this.selectSlot(number);

            if (e.code === 'Space') {
                e.preventDefault();
                if (!e.repeat) this.jump();
            }
            if (e.code === 'KeyR' && !e.repeat && this.isRunning) {
                if (this.selectedSlot === 5) this.reloadM7();
                else if (this.selectedSlot === 2 || this.selectedSlot === 4) {
                    this.isAimToggled = !this.isAimToggled;
                    this.isAiming = this.isAimToggled || this.isRightMouseHeld;
                }
            }
            if (e.code === 'KeyK' && !e.repeat) {
                this.toggleXRayAndStamina();
            } else if (e.code === 'KeyL' && !e.repeat) {
                this.toggleGodMode();
            } else if (e.code === 'KeyF') {
                this.toggleFlashlight();
            } else if (e.code === 'KeyG') {
                this.interact();
            } else if (e.code === 'KeyM') {
                this.toggleMinimap();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        document.addEventListener('mousedown', (e) => {
            const pauseOverlay = document.getElementById('pause-overlay');
            const canAct = this.isRunning && !this.isGameOver && !this.isVictory && !this.cheatMenuOpen
                && pauseOverlay?.style.display !== 'flex'
                && (e.target === this.container || this.container.contains(e.target));
            if (e.button === 0 && canAct) {
                this.isLeftMouseHeld = true;
                this.useSelectedSlot();
            }
            if (e.button === 2 && canAct && (this.selectedSlot === 2 || this.selectedSlot === 4 || this.selectedSlot === 5)) {
                this.isRightMouseHeld = true;
                this.isAiming = true;
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isLeftMouseHeld = false;
                this.audio.endM7Burst();
            }
            if (e.button === 2) {
                this.isRightMouseHeld = false;
                this.isAiming = this.isAimToggled;
            }
        });
        document.addEventListener('contextmenu', (e) => { if (this.isRunning) e.preventDefault(); });
        window.addEventListener('blur', () => {
            this.keys = {};
            this.slideRequested = false;
            this.sprintLatched = false;
            this.isRightMouseHeld = false;
            this.isLeftMouseHeld = false;
            this.isAimToggled = false;
            this.isAiming = false;
            this.audio.suspend();
            if (this.isDesktopHost && this.isRunning && !this.cheatMenuOpen) {
                const pauseOverlay = document.getElementById('pause-overlay');
                if (pauseOverlay) pauseOverlay.style.display = 'flex';
                if (document.pointerLockElement === this.container) document.exitPointerLock();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.audio.suspend();
            else if (this.isRunning && (this.isPointerLocked || this.mouseLookFallback) && !this.cheatMenuOpen) this.audio.resume();
        });

        document.addEventListener('mousemove', (e) => {
            const unlockedLook = this.mouseLookFallback && this.isRunning && !this.cheatMenuOpen
                && document.getElementById('pause-overlay')?.style.display !== 'flex'
                && (e.target === this.container || this.container.contains(e.target));
            if (!this.isPointerLocked && !unlockedLook) return;
            const sensitivity = 0.0022;
            const dx = this.isPointerLocked ? e.movementX : (this.lastFreeMouseX === null ? 0 : e.clientX - this.lastFreeMouseX);
            const dy = this.isPointerLocked ? e.movementY : (this.lastFreeMouseY === null ? 0 : e.clientY - this.lastFreeMouseY);
            this.camera.rotation.y -= dx * sensitivity;
            this.camera.rotation.x -= dy * sensitivity;
            this.camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.camera.rotation.x));
            this.lastFreeMouseX = e.clientX;
            this.lastFreeMouseY = e.clientY;
        });
        this.container.addEventListener('mouseleave', () => { this.lastFreeMouseX = null; this.lastFreeMouseY = null; });

        this.container.addEventListener('click', () => {
            if (!this.isRunning && !this.isGameOver && !this.isVictory) {
                this.startGame();
            } else if (this.isRunning && !this.isPointerLocked && !this.cheatMenuOpen) {
                this.requestMouseLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = (document.pointerLockElement === this.container);
            if (this.isPointerLocked) this.mouseLookFallback = false;
            const pauseOverlay = document.getElementById('pause-overlay');
            if (this.cheatMenuOpen) {
                if (pauseOverlay) pauseOverlay.style.display = 'none';
                this.audio.suspend();
            } else if (this.isRunning && !this.isPointerLocked && !this.mouseLookFallback && !this.isGameOver && !this.isVictory) {
                if (pauseOverlay) pauseOverlay.style.display = 'flex';
                this.audio.suspend();
            } else if (pauseOverlay) {
                pauseOverlay.style.display = 'none';
                if (this.isRunning && (this.isPointerLocked || this.mouseLookFallback)) this.audio.resume();
            }
        });
        document.addEventListener('pointerlockerror', () => this.handleMouseLockFailure());
    }

    setupUI() {
        this.hudSanity = document.getElementById('hud-sanity');
        this.hudStamina = document.getElementById('hud-stamina');
        this.hudBattery = document.getElementById('hud-battery');
        this.hudKeys = document.getElementById('hud-keys');
        this.hudAlmond = document.getElementById('hud-almond');
        this.hotbar = document.getElementById('hotbar');
        this.hotbarSlots = [1, 2, 3, 4, 5].map(slot => document.getElementById(`hotbar-slot-${slot}`));
        this.hotbarDetails = [1, 2, 3, 4, 5].map(slot => document.getElementById(`hotbar-detail-${slot}`));
        this.promptText = document.getElementById('interaction-prompt');
        this.vhsDate = document.getElementById('vhs-date');
        this.vhsTape = document.getElementById('vhs-tape');
        this.setupBarkVolumeControls();
        this.setupFrameRateControls();
        this.setupComfortControls();
        this.setupM7AudioControls();
        this.setupCheatWheel();
        document.querySelectorAll('[data-death-preview]').forEach(button => {
            button.addEventListener('click', () => this.audio.playDeathCall(Number(button.dataset.deathPreview)));
        });
        this.syncWeaponUI();
    }

    setupFrameRateControls() {
        let saved = 45;
        try { saved = Number(localStorage.getItem('gameFpsLimit')) || 45; } catch (_) {}
        this.targetFps = [30, 45, 60, 90, 120].includes(saved) ? saved : 45;
        document.querySelectorAll('.fps-select').forEach(select => {
            select.value = String(this.targetFps);
            select.addEventListener('change', () => {
                this.targetFps = Number(select.value);
                this.renderTimer = 0;
                document.querySelectorAll('.fps-select').forEach(other => { other.value = select.value; });
                try { localStorage.setItem('gameFpsLimit', select.value); } catch (_) {}
            });
        });
    }

    setupComfortControls() {
        try { this.comfortMode = localStorage.getItem('gameComfortMode') !== 'off'; } catch (_) {}
        document.body.classList.toggle('comfort-mode', this.comfortMode);
        document.querySelectorAll('.comfort-mode-checkbox').forEach(input => {
            input.checked = this.comfortMode;
            input.addEventListener('change', () => {
                this.comfortMode = input.checked;
                document.body.classList.toggle('comfort-mode', this.comfortMode);
                document.querySelectorAll('.comfort-mode-checkbox').forEach(other => { other.checked = this.comfortMode; });
                try { localStorage.setItem('gameComfortMode', this.comfortMode ? 'on' : 'off'); } catch (_) {}
            });
        });
    }

    setupM7AudioControls() {
        document.querySelectorAll('.m7-shot-select').forEach(select => {
            select.value = this.audio.m7ShotVariant;
            select.addEventListener('change', () => {
                this.audio.setM7ShotVariant(select.value);
                document.querySelectorAll('.m7-shot-select').forEach(other => { other.value = select.value; });
            });
        });
        document.querySelectorAll('[data-m7-preview]').forEach(button => {
            button.addEventListener('click', () => this.audio.playM7Preview(button.dataset.m7Preview));
        });
    }

    setupCheatWheel() {
        document.querySelectorAll('[data-cheat]').forEach(input => {
            input.addEventListener('change', () => this.setCheat(input.dataset.cheat, input.checked));
        });
        this.syncCheatWheel();
    }

    toggleCheatMenu() {
        this.cheatMenuOpen = !this.cheatMenuOpen;
        const menu = document.getElementById('cheat-menu');
        if (menu) menu.style.display = this.cheatMenuOpen ? 'flex' : 'none';
        this.keys = {};
        this.slideRequested = false;
        if (this.cheatMenuOpen) {
            this.audio.suspend();
            const pauseOverlay = document.getElementById('pause-overlay');
            if (pauseOverlay) pauseOverlay.style.display = 'none';
            if (document.pointerLockElement === this.container) document.exitPointerLock();
        } else {
            this.requestMouseLock();
        }
    }

    requestMouseLock() {
        this.mouseLookFallback = false;
        this.lastFreeMouseX = null;
        this.lastFreeMouseY = null;
        try {
            const request = this.container.requestPointerLock();
            if (request && request.catch) request.catch(() => this.handleMouseLockFailure());
        } catch (_) {
            this.handleMouseLockFailure();
        }
    }

    handleMouseLockFailure() {
        if (!this.isRunning || this.cheatMenuOpen || this.isGameOver || this.isVictory) return;
        const pauseOverlay = document.getElementById('pause-overlay');
        if (this.isDesktopHost) {
            if (pauseOverlay) pauseOverlay.style.display = 'flex';
            this.audio.suspend();
            this.showNotification('鼠标锁定失败，点击“继续探索”重试');
        } else {
            this.mouseLookFallback = true;
            if (pauseOverlay) pauseOverlay.style.display = 'none';
            this.audio.resume();
        }
    }

    setupBarkVolumeControls() {
        let savedVolume = 140;
        try {
            const storedValue = localStorage.getItem('smilerBarkVolume');
            if (storedValue !== null) {
                const stored = Number(storedValue);
                if (Number.isFinite(stored)) savedVolume = THREE.MathUtils.clamp(stored, 0, 200);
            }
        } catch (_) {}
        this.audio.setBarkVolume(savedVolume);
        document.querySelectorAll('.smiler-volume-slider').forEach(slider => {
            slider.value = String(savedVolume);
            slider.addEventListener('input', () => {
                const value = Number(slider.value);
                this.audio.setBarkVolume(value);
                document.querySelectorAll('.smiler-volume-slider').forEach(other => { other.value = String(value); });
                document.querySelectorAll('.smiler-volume-value').forEach(label => { label.innerText = `${value}%`; });
            });
        });
        document.querySelectorAll('.smiler-volume-value').forEach(label => { label.innerText = `${savedVolume}%`; });
    }

    startGame() {
        this.isRunning = true;
        this.audio.init();
        this.audio.resume();
        this.requestMouseLock();
        document.getElementById('start-screen').style.display = 'none';
    }

    resumeFromPause() {
        const pauseOverlay = document.getElementById('pause-overlay');
        if (pauseOverlay) pauseOverlay.style.display = 'none';
        this.requestMouseLock();
    }

    toggleFlashlight() {
        if (this.battery <= 0) return;
        this.flashlightOn = !this.flashlightOn;
        this.flashlight.visible = this.flashlightOn;
        this.audio.playClick();
    }

    toggleMinimap() {
        const minimap = document.getElementById('minimap-canvas');
        if (minimap) {
            minimap.style.display = minimap.style.display === 'none' ? 'block' : 'none';
        }
    }

    toggleXRayAndStamina() {
        const enabled = !(this.isXRayMode && this.infiniteStamina && this.infiniteAmmo);
        this.setCheat('xray', enabled);
        this.setCheat('stamina', enabled);
        this.setCheat('ammo', enabled);
        this.audio.playClick();
        this.showNotification(enabled
            ? 'K 模式：已获得手枪、AWM 与 M7 · Smiler 透视 · 无限体力与子弹（按 5 切换 M7）'
            : 'K 模式已关闭：恢复普通体力与弹药');
    }

    toggleGodMode() {
        const enabled = !(this.isInvincible && this.noClip && this.canFly && this.isFastMode);
        for (const cheat of ['invincible', 'noclip', 'fly', 'speed']) this.setCheat(cheat, enabled);
        this.audio.playClick();
        this.showNotification(enabled
            ? 'L 模式：无敌、穿墙、飞行、极速 (Space 上升 / Ctrl 下降)'
            : 'L 模式已关闭');
    }

    setCheat(cheat, enabled) {
        if (cheat === 'xray') {
            this.isXRayMode = enabled;
            for (const entity of this.entities) entity.setXRay(enabled);
        } else if (cheat === 'stamina') {
            this.infiniteStamina = enabled;
            if (enabled) this.stamina = this.staminaMax;
        } else if (cheat === 'ammo') {
            this.infiniteAmmo = enabled;
            if (enabled) {
                this.gunOwned = true;
                this.awmOwned = true;
                this.m7Owned = true;
                this.ammo = Math.max(this.ammo, 20);
                if (this.selectedSlot !== 2 && this.selectedSlot !== 4 && this.selectedSlot !== 5) this.selectSlot(2);
            }
        } else if (cheat === 'invincible') {
            this.isInvincible = enabled;
            if (enabled) this.sanity = 100;
        } else if (cheat === 'noclip') {
            this.noClip = enabled;
        } else if (cheat === 'fly') {
            this.canFly = enabled;
            this.jumpHeight = 0;
            this.jumpVelocity = 0;
            this.isGrounded = true;
            if (enabled) this.camera.position.y = Math.max(1.7, this.camera.position.y);
        } else if (cheat === 'speed') {
            this.isFastMode = enabled;
        }
        this.isGodMode = this.isInvincible && this.noClip && this.canFly && this.isFastMode;
        this.syncCheatWheel();
        this.syncWeaponUI();
    }

    syncCheatWheel() {
        const values = {
            xray: this.isXRayMode, stamina: this.infiniteStamina, ammo: this.infiniteAmmo,
            invincible: this.isInvincible, noclip: this.noClip, fly: this.canFly, speed: this.isFastMode
        };
        document.querySelectorAll('[data-cheat]').forEach(input => {
            input.checked = !!values[input.dataset.cheat];
        });
    }

    selectSlot(slot) {
        if (slot === 2 && !this.gunOwned) {
            this.showNotification('先在地图里找到手枪，再按 [2] 装备');
            return;
        }
        if (slot === 4 && !this.awmOwned) {
            this.showNotification('先找到地图里的 AWM，再按 [4] 装备');
            return;
        }
        if (slot === 5 && !this.m7Owned) {
            this.showNotification('先找到地图里的 M7，再按 [5] 装备');
            return;
        }
        if (slot !== 2 && slot !== 4 && slot !== 5) {
            this.isAimToggled = false;
            this.isRightMouseHeld = false;
            this.isAiming = false;
        }
        if (this.selectedSlot === 5 && slot !== 5) this.audio.endM7Burst();
        this.selectedSlot = slot;
        this.pistolViewModel.visible = this.gunOwned && slot === 2;
        this.awmViewModel.visible = this.awmOwned && slot === 4;
        this.m7ViewModel.visible = this.m7Owned && slot === 5;
        this.syncWeaponUI();
        this.audio.playClick();
    }

    syncWeaponUI() {
        if (!this.hotbarSlots) return;
        this.hotbarSlots.forEach((element, index) => {
            if (element) element.classList.toggle('selected', index + 1 === this.selectedSlot);
        });
        if (this.hotbarDetails[1]) {
            this.hotbarDetails[1].innerText = this.gunOwned
                ? (this.infiniteAmmo ? '弹药 ∞' : `弹药 ${this.ammo}`)
                : '地图拾取';
        }
        if (this.hotbarDetails[2]) this.hotbarDetails[2].innerText = `x${this.almondWaterCount}`;
        if (this.hotbarDetails[3]) this.hotbarDetails[3].innerText = this.awmOwned
            ? (this.infiniteAmmo ? '弹药 ∞ · 一枪击杀' : `弹药 ${this.ammo} · 一枪击杀`)
            : '地图拾取';
        if (this.hotbarDetails[4]) this.hotbarDetails[4].innerText = this.m7Owned
            ? (this.infiniteAmmo ? '弹匣 ∞' : (this.m7ReloadEnd ? '换弹中…' : `${this.m7Magazine}/20 · 备弹 ${this.m7Reserve}`))
            : '地图拾取';
    }

    useSelectedSlot() {
        if (this.selectedSlot === 2 || this.selectedSlot === 4 || this.selectedSlot === 5) {
            this.shoot();
        } else if (this.selectedSlot === 3) {
            this.drinkAlmondWater();
        }
    }

    drinkAlmondWater() {
        if (this.almondWaterCount <= 0) {
            this.showNotification('杏仁水已经喝完');
            return;
        }
        if (this.sanity >= 98 && this.stamina >= 95) {
            this.showNotification('理智和体力都很充足，留着杏仁水吧');
            return;
        }
        this.almondWaterCount--;
        this.sanity = Math.min(100, this.sanity + 40);
        this.stamina = Math.min(this.staminaMax, this.stamina + 60);
        this.audio.playDrink();
        this.syncWeaponUI();
        this.showNotification('🥤 饮用了杏仁水，精神值和体力恢复！');
    }

    reloadM7() {
        if (!this.m7Owned || this.m7ReloadEnd || this.m7Magazine >= 20 || (this.m7Reserve <= 0 && !this.infiniteAmmo)) return;
        this.m7ReloadStart = performance.now();
        this.m7ReloadEnd = this.m7ReloadStart + 2300;
        this.audio.stopM7Gunfire();
        this.audio.playM7Reload();
        this.syncWeaponUI();
        this.showNotification('M7 换弹中…');
        setTimeout(() => {
            const needed = 20 - this.m7Magazine;
            const loaded = this.infiniteAmmo ? needed : Math.min(needed, this.m7Reserve);
            this.m7Magazine += loaded;
            if (!this.infiniteAmmo) this.m7Reserve -= loaded;
            this.m7ReloadEnd = 0;
            this.syncWeaponUI();
        }, 2300);
    }

    shoot() {
        if (this.isPlayerHidden) {
            this.showNotification('躲藏时无法射击，按 [G] 离开储物柜');
            return;
        }
        const isAwm = this.selectedSlot === 4;
        const isM7 = this.selectedSlot === 5;
        if (isAwm ? !this.awmOwned : isM7 ? !this.m7Owned : !this.gunOwned) {
            this.showNotification(isAwm ? '还没有 AWM，先在地图里找到它' : isM7 ? '还没有 M7，先在地图里找到它' : '还没有手枪，先找到地图里的枪');
            return;
        }
        if (isM7 && this.m7ReloadEnd) return;
        const now = performance.now();
        if (now < this.shotCooldown) return;
        if (isM7) {
            // Carry the original cadence across render frames. Restarting a 90 ms
            // timer on every frame-quantized shot made 45 FPS behave like 112 ms.
            const continuingBurst = now - this.lastM7ShotAt < 200;
            this.shotCooldown = continuingBurst
                ? Math.max(now + 8, this.shotCooldown + 90)
                : now + 90;
        } else {
            this.lastM7ShotAt = -Infinity;
            this.shotCooldown = now + (isAwm ? 900 : 320);
        }
        if (!this.infiniteAmmo && (isM7 ? this.m7Magazine <= 0 : this.ammo <= 0)) {
            this.showNotification(isM7 ? 'M7 弹匣空了，按 [R] 换弹' : '弹药用完了，去找黄色弹药箱');
            this.audio.playClick();
            return;
        }
        if (!this.infiniteAmmo) {
            if (isM7) this.m7Magazine--;
            else this.ammo--;
        }
        if (isM7) this.lastM7ShotAt = now;

        // Resolve the shot through the visible crosshair before the camera kick changes its pitch.
        this.camera.updateMatrixWorld(true);
        this.shotRaycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        this.shotRaycaster.far = isAwm ? 90 : isM7 ? 55 : 32;
        const shotOrigin = this.camera.position.clone();
        const targets = this.entities.filter(entity => !entity.isDead).map(entity => entity.sprite);
        const hit = this.shotRaycaster.intersectObjects(targets, false)[0];

        if (isM7) {
            this.audio.playM7Shot();
            if (!this.infiniteAmmo && this.m7Magazine === 0) this.audio.endM7Burst(0.09);
        }
        else this.audio.playGunshot(isAwm);
        this.weaponRecoil = isAwm ? 0.68 : isM7 ? 0.27 : 0.38;
        this.muzzleFlashTimer = isAwm ? 0.14 : 0.09;
        const shotFlash = document.getElementById('shot-flash');
        if (shotFlash) {
            shotFlash.classList.remove('show');
            void shotFlash.offsetWidth;
            shotFlash.classList.add('show');
        }
        const flash = isAwm ? this.awmViewModel.userData.muzzleFlash : isM7 ? this.m7ViewModel.userData.muzzleFlash : this.pistolViewModel.userData.muzzleFlash;
        if (flash) flash.visible = true;
        const crosshair = document.querySelector('.crosshair');
        if (crosshair) crosshair.classList.add('firing');
        clearTimeout(this.crosshairFireTimeout);
        this.crosshairFireTimeout = setTimeout(() => crosshair && crosshair.classList.remove('firing'), 110);
        const kick = isAwm ? 0.09 : isM7 ? 0.023 : 0.045;
        this.recoilPitch = Math.min(0.22, this.recoilPitch + kick);
        this.camera.rotation.x = Math.max(-Math.PI / 2.2, this.camera.rotation.x - kick);
        for (const entity of this.entities) entity.hearGunshot(shotOrigin, 36);
        if (hit) {
            const entity = this.entities.find(candidate => candidate.sprite === hit.object);
            if (entity && this.map.hasClearShot(shotOrigin, hit.point)) {
                if (crosshair) crosshair.classList.add('hit');
                clearTimeout(this.hitMarkerTimeout);
                this.hitMarkerTimeout = setTimeout(() => crosshair && crosshair.classList.remove('hit'), 180);
                const killed = entity.takeDamage(isAwm ? entity.maxHealth : isM7 ? 3 : 10, shotOrigin);
                this.audio.playHitConfirm(killed);
                if (killed) {
                    this.smilersDefeated++;
                    this.showKillConfirmation();
                    this.showNotification(`Smiler 被击倒！累计 ${this.smilersDefeated} 次；12 秒后会在别处复活`);
                } else {
                    this.showNotification(`命中并减速 2.1 秒 · Smiler 生命 ${entity.health}/${entity.maxHealth}`);
                }
            }
        }
        this.syncWeaponUI();
    }

    showKillConfirmation() {
        const marker = document.getElementById('kill-confirmation');
        if (!marker) return;
        marker.classList.remove('show');
        void marker.offsetWidth;
        marker.classList.add('show');
        marker.innerText = `☠  击杀 Smiler  ·  ${this.smilersDefeated}`;
        clearTimeout(this.killMarkerTimeout);
        this.killMarkerTimeout = setTimeout(() => marker.classList.remove('show'), 1300);
    }

    jump() {
        if (!this.isRunning || this.isGameOver || this.isVictory || this.canFly || !this.isGrounded) return;
        const canSlideJump = this.isSliding || this.slideJumpGrace > 0;
        if (this.isCrouching && !canSlideJump) return;
        if (canSlideJump) {
            this.slideJumpMomentum.copy(this.slideDirection).multiplyScalar(Math.max(4.8, this.slideSpeed * 0.9));
            this.isSliding = false;
            this.audio.stopSlide();
            this.slideTimer = 0;
            this.slideJumpGrace = 0;
            this.slideCooldown = 0.35;
            this.isCrouching = false;
        }
        this.jumpVelocity = 5.5;
        this.isGrounded = false;
        if (!this.infiniteStamina) this.stamina = Math.max(0, this.stamina - 4);
        this.audio.playJump();
    }

    interact() {
        if (this.isPlayerHidden) {
            this.isPlayerHidden = false;
            this.showNotification('离开储物柜；Smiler 可能还在附近搜索');
            return;
        }

        const nearbyLocker = this.lockerPositions.find(pos => pos.distanceTo(this.camera.position) < 2.0);
        if (nearbyLocker) {
            this.isPlayerHidden = true;
            this.isSprinting = false;
            this.peekOffset = 0;
            const indicator = document.getElementById('peek-indicator');
            if (indicator) indicator.style.opacity = '0';
            this.camera.rotation.z = 0;
            this.showNotification('躲进储物柜了，按 [G] 离开；别在它面前久留');
            return;
        }

        // 1. Try drinking almond water if player presses E and no item is nearby
        // Check if an item is nearby
        let pickedItem = false;
        const playerPos = this.camera.position;

        for (const item of this.items) {
            if (!item.collected && item.pos.distanceTo(playerPos) < 2.0) {
                item.collected = true;
                if (item.type === 'memory' || item.type === 'ammo') {
                    const hidden = new THREE.Object3D();
                    hidden.position.copy(item.pos);
                    hidden.scale.setScalar(0);
                    hidden.updateMatrix();
                    item.mesh.setMatrixAt(item.instanceId, hidden.matrix);
                    item.mesh.instanceMatrix.needsUpdate = true;
                } else {
                    this.scene.remove(item.mesh);
                }
                this.audio.playPickup();
                pickedItem = true;

                if (item.type === 'keycard') {
                    this.keysFound++;
                    this.showNotification(`🔑 获得门禁芯片！(${this.keysFound}/${this.keysRequired})`);
                } else if (item.type === 'almond_water') {
                    this.almondWaterCount++;
                    this.showNotification('🥫 获得杏仁水！按 [G] 饮用');
                } else if (item.type === 'battery') {
                    this.battery = Math.min(100, this.battery + 60);
                    this.showNotification('🔋 获得9V电池！手电筒电量充盈');
                } else if (item.type === 'memory') {
                    this.sanity = Math.min(100, this.sanity + 14);
                    this.stamina = Math.min(this.staminaMax, this.stamina + 24);
                    this.memoriesFound++;
                    this.showNotification(`✦ 记忆微光 ${this.memoriesFound}/${this.memoriesRequired}：理智与体力恢复！`);
                } else if (item.type === 'gun') {
                    this.gunOwned = true;
                    this.ammo = Math.max(this.ammo, 10);
                    this.selectSlot(2);
                    this.showNotification('🔫 捡到手枪！按 [2] 装备，左键射击；枪声会引来附近 Smiler');
                } else if (item.type === 'awm') {
                    this.awmOwned = true;
                    this.ammo = Math.max(this.ammo, 5);
                    this.selectSlot(4);
                    this.showNotification('🎯 捡到 AWM！按 [4] 装备，右键开镜，一枪击倒 Smiler');
                } else if (item.type === 'm7') {
                    this.m7Owned = true;
                    this.m7Reserve = Math.max(this.m7Reserve, 80);
                    this.selectSlot(5);
                    this.showNotification('🔫 捡到 M7！按 [5] 装备，按住左键射击，R 换弹；10 发击倒 Smiler');
                } else if (item.type === 'ammo') {
                    this.ammo = Math.min(90, this.ammo + 8);
                    this.m7Reserve = Math.min(160, this.m7Reserve + 20);
                    this.showNotification(`🟨 手枪/AWM 弹药 +8 · M7 备弹 +20`);
                }
                this.syncWeaponUI();
                break;
            }
        }

        // Check Exit Door
        const exitCoord = this.map.exitDoor;
        const exitWorld = this.map.gridToWorld(exitCoord.x, exitCoord.z);
        const distToExit = new THREE.Vector2(playerPos.x - exitWorld.x, playerPos.z - exitWorld.z).length();

        if (distToExit < 2.8) {
            if (this.keysFound >= this.keysRequired) {
                this.triggerVictory();
                return;
            } else {
                this.showNotification(`⚠️ 门禁受锁！还需 ${this.keysRequired - this.keysFound} 个芯片`);
            }
        }

        // If no nearby item was picked and player pressed E, drink almond water
        if (!pickedItem && this.almondWaterCount > 0 && (this.sanity < 90 || this.stamina < 70)) {
            this.almondWaterCount--;
            this.sanity = Math.min(100, this.sanity + 40);
            this.stamina = Math.min(this.staminaMax, this.stamina + 60);
            this.audio.playDrink();
            this.syncWeaponUI();
            this.showNotification('🥤 饮用了杏仁水，精神值大幅恢复！');
        }
    }

    showNotification(msg) {
        const notif = document.getElementById('game-notification');
        if (!notif) return;
        notif.innerText = msg;
        notif.style.opacity = '1';
        clearTimeout(this.notifTimeout);
        this.notifTimeout = setTimeout(() => {
            notif.style.opacity = '0';
        }, 2500);
    }

    updatePlayer(delta) {
        if (!this.isRunning || this.isGameOver || this.isVictory) return;
        this.camera.position.x -= this.appliedPeekX;
        this.camera.position.z -= this.appliedPeekZ;
        this.camera.position.y -= this.appliedPeekY;
        this.appliedPeekX = 0;
        this.appliedPeekZ = 0;
        this.appliedPeekY = 0;
        if (this.isPlayerHidden) {
            this.peekOffset = 0;
            this.isSprinting = false;
            this.camera.rotation.z = 0;
            return;
        }

        // Stamina & Sprinting
        const ctrlDown = this.keys['ControlLeft'] || this.keys['ControlRight'];
        const crouchDown = ctrlDown || this.keys['KeyV'];
        const slidePressed = this.slideRequested;
        this.slideRequested = false;
        this.slideCooldown = Math.max(0, this.slideCooldown - delta);
        this.slideJumpGrace = Math.max(0, this.slideJumpGrace - delta);
        const shiftDown = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        const hasMovementInput = this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['KeyS'] || this.keys['ArrowDown']
            || this.keys['KeyA'] || this.keys['ArrowLeft'] || this.keys['KeyD'] || this.keys['ArrowRight'];
        if (shiftDown && hasMovementInput && (this.infiniteStamina || this.stamina > 0)) this.sprintLatched = true;
        if (!hasMovementInput || this.isFastMode || (!this.infiniteStamina && this.stamina <= 0)) this.sprintLatched = false;
        const wantsSprint = !this.isFastMode && this.sprintLatched && (this.infiniteStamina || this.stamina > 0);
        let moveSpeed = this.isFastMode ? 14 : (crouchDown && !this.isSliding ? 2.0 : (wantsSprint ? 5.8 : 3.4));
        if (!this.isGrounded && this.slideJumpMomentum.lengthSq() > 0.05) moveSpeed = 1.8;
        this.isCrouching = !this.canFly && crouchDown && this.isGrounded && !this.isSliding;
        this.isSprinting = false;
        const inPuddle = this.hazardWorldPositions.some(world => {
            const dx = this.camera.position.x - world.x;
            const dz = this.camera.position.z - world.z;
            return dx * dx + dz * dz < 1.45 * 1.45;
        });
        const puddleSlowsPlayer = !this.canFly && inPuddle && this.isGrounded;
        if (puddleSlowsPlayer) {
            moveSpeed *= 0.62;
            this.stamina = Math.max(0, this.stamina - delta * 8);
            if (!this.hazardHintShown) {
                this.showNotification('湿滑积水会拖慢脚步并消耗体力，按 [Space] 跳过去！');
                this.hazardHintShown = true;
            }
        }

        const moveDir = new THREE.Vector3();
        if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDir.z -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDir.z += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir.x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.x += 1;

        const isMoving = moveDir.lengthSq() > 0.001;

        if (isMoving) moveDir.normalize();
        const yaw = this.camera.rotation.y;
        const desiredWorldDir = new THREE.Vector3(
            moveDir.x * Math.cos(yaw) + moveDir.z * Math.sin(yaw),
            0,
            -moveDir.x * Math.sin(yaw) + moveDir.z * Math.cos(yaw)
        );
        if (!isMoving) desiredWorldDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        desiredWorldDir.normalize();

        if (slidePressed && crouchDown && wantsSprint && isMoving && this.isGrounded && !this.canFly && !this.isSliding
            && this.slideCooldown <= 0 && (this.infiniteStamina || this.stamina >= 12)) {
            this.isSliding = true;
            this.isCrouching = false;
            this.slideTimer = 0.72;
            this.slideSpeed = 11.3;
            this.slideJumpGrace = 0;
            this.slideDirection.copy(desiredWorldDir);
            this.sprintLatched = false;
            if (!this.infiniteStamina) this.stamina = Math.max(0, this.stamina - 12);
            this.audio.playSlide();
        }

        if (this.isSliding) {
            // Mouse yaw and WASD continuously steer the short burst without killing its momentum.
            const slideYaw = Math.atan2(-this.slideDirection.x, -this.slideDirection.z);
            const targetSlideYaw = Math.atan2(-desiredWorldDir.x, -desiredWorldDir.z);
            const yawDifference = Math.atan2(Math.sin(targetSlideYaw - slideYaw), Math.cos(targetSlideYaw - slideYaw));
            const turnedYaw = slideYaw + THREE.MathUtils.clamp(yawDifference, -delta * 5.5, delta * 5.5);
            this.slideDirection.set(-Math.sin(turnedYaw), 0, -Math.cos(turnedYaw));
            const slideProgress = Math.max(0, this.slideTimer / 0.72);
            this.slideSpeed = 3.4 + 7.9 * slideProgress * slideProgress;
            this.audio.updateSlide(this.slideSpeed);
            const beforeSlideX = this.camera.position.x;
            const beforeSlideZ = this.camera.position.z;
            this.camera.position.x += this.slideDirection.x * this.slideSpeed * delta;
            this.camera.position.z += this.slideDirection.z * this.slideSpeed * delta;
            if (!this.noClip) this.map.collideAndSlide(this.camera.position, 0.45);
            this.isSprinting = true;
            if (!this.infiniteStamina) this.stamina = Math.max(0, this.stamina - delta * 14);
            this.headBobOffset = THREE.MathUtils.lerp(this.headBobOffset, 0, Math.min(1, delta * 12));
            this.slideTimer -= delta;
            const slideBlocked = Math.hypot(this.camera.position.x - beforeSlideX, this.camera.position.z - beforeSlideZ) < this.slideSpeed * delta * 0.25;
            if (slideBlocked) this.slideTimer = 0;
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                this.audio.stopSlide();
                this.slideCooldown = 0.48;
                this.slideJumpGrace = slideBlocked ? 0 : 0.14;
            }
        } else if (isMoving) {
            if (wantsSprint && !crouchDown) {
                this.isSprinting = true;
                this.stamina = Math.max(0, this.stamina - delta * 14);
            } else {
                this.stamina = Math.min(this.staminaMax, this.stamina + delta * 22);
            }

            // Head Bobbing & Footsteps
            const bobFrequency = this.isSprinting ? 14 : 9;
            const bobAmplitude = this.isSprinting ? 0.09 : 0.045;
            this.headBobTimer += delta * bobFrequency;

            const prevBobY = Math.sin(this.headBobTimer - delta * bobFrequency);
            const currBobY = Math.sin(this.headBobTimer);

            // Step sound on footfall (bob trough)
            if (this.isGrounded && prevBobY > -0.8 && currBobY <= -0.8) {
                this.audio.playFootstep(this.isSprinting);
            }

            this.headBobOffset = this.comfortMode ? 0 : Math.sin(this.headBobTimer) * bobAmplitude;

            // Transform movement direction relative to camera yaw
            const dx = (moveDir.x * Math.cos(yaw) + moveDir.z * Math.sin(yaw)) * moveSpeed * delta;
            const dz = (-moveDir.x * Math.sin(yaw) + moveDir.z * Math.cos(yaw)) * moveSpeed * delta;

            this.camera.position.x += dx;
            this.camera.position.z += dz;

            // Collision resolution
            if (!this.noClip) this.map.collideAndSlide(this.camera.position, 0.45);
        } else {
            this.stamina = Math.min(this.staminaMax, this.stamina + delta * 32);
            this.headBobOffset = THREE.MathUtils.lerp(this.headBobOffset, 0, delta * 8);
        }

        if (!this.isGrounded && this.slideJumpMomentum.lengthSq() > 0.05) {
            this.camera.position.x += this.slideJumpMomentum.x * delta;
            this.camera.position.z += this.slideJumpMomentum.z * delta;
            if (!this.noClip) this.map.collideAndSlide(this.camera.position, 0.45);
            this.slideJumpMomentum.multiplyScalar(Math.exp(-1.25 * delta));
            if (this.slideJumpMomentum.lengthSq() < 0.05) this.slideJumpMomentum.set(0, 0, 0);
        }

        const peekInput = (this.keys['KeyE'] ? 1 : 0) - (this.keys['KeyQ'] ? 1 : 0);
        const peekIndicator = document.getElementById('peek-indicator');
        if (peekIndicator) {
            peekIndicator.textContent = peekInput < 0 ? '← 左探头' : peekInput > 0 ? '右探头 →' : '';
            peekIndicator.style.opacity = peekInput ? '1' : '0';
        }
        this.peekOffset = THREE.MathUtils.lerp(this.peekOffset, peekInput * 0.95, Math.min(1, delta * 13));
        const baseX = this.camera.position.x;
        const baseZ = this.camera.position.z;
        const desiredPeekX = Math.cos(yaw) * this.peekOffset;
        const desiredPeekZ = -Math.sin(yaw) * this.peekOffset;
        const peekFraction = this.noClip ? 1 : this.map.clampPeekOffset(baseX, baseZ, desiredPeekX, desiredPeekZ, this.camera.position.y);
        this.camera.position.x += desiredPeekX * peekFraction;
        this.camera.position.z += desiredPeekZ * peekFraction;
        // Peeking moves only the viewpoint; body collision has already been resolved above.
        this.appliedPeekX = this.camera.position.x - baseX;
        this.appliedPeekZ = this.camera.position.z - baseZ;
        this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z,
            -this.peekOffset * peekFraction * (this.comfortMode ? 0.12 : 0.17), Math.min(1, delta * 10));

        const recoilRecovery = Math.min(this.recoilPitch, delta * 0.16);
        this.camera.rotation.x = Math.min(Math.PI / 2.2, this.camera.rotation.x + recoilRecovery);
        this.recoilPitch -= recoilRecovery;

        const targetFov = this.isAiming && this.selectedSlot === 4 && this.awmOwned ? 20
            : this.isAiming && this.selectedSlot === 5 && this.m7Owned ? (this.comfortMode ? 68 : 62)
            : this.isAiming ? (this.comfortMode ? 60 : 43)
            : (this.isSliding && !this.comfortMode ? 80 : 75);
        document.body.classList.toggle('aiming', this.isAiming);
        document.body.classList.toggle('awm-equipped', this.isAiming && this.selectedSlot === 4 && this.awmOwned);
        document.body.classList.toggle('m7-aiming', this.isAiming && this.selectedSlot === 5 && this.m7Owned);
        const nextFov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, delta * 10));
        if (Math.abs(nextFov - this.camera.fov) > 0.05) {
            this.camera.fov = nextFov;
            this.camera.updateProjectionMatrix();
        }
        this.weaponRecoil = Math.max(0, this.weaponRecoil - delta * 1.55);
        this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - delta);
        const reloadProgress = this.m7ReloadEnd ? THREE.MathUtils.clamp((performance.now() - this.m7ReloadStart) / 2300, 0, 1) : 0;
        const magazinePull = this.m7ReloadEnd
            ? (reloadProgress < 0.35 ? reloadProgress / 0.35 : reloadProgress < 0.65 ? 1 : (1 - reloadProgress) / 0.35)
            : 0;
        const reloadArc = this.m7ReloadEnd ? Math.sin(Math.PI * reloadProgress) : 0;
        this.m7ViewModel.userData.magazine.position.y = -0.26 - magazinePull * 0.38;
        if (this.m7ViewModel.userData.reloadHand) {
            this.m7ViewModel.userData.reloadHand.position.set(magazinePull * 0.18, -magazinePull * 0.28, -magazinePull * 0.18);
        }
        const activeWeapon = this.selectedSlot === 4 ? this.awmViewModel : this.selectedSlot === 5 ? this.m7ViewModel : this.pistolViewModel;
        if (activeWeapon) {
            const flash = activeWeapon.userData.muzzleFlash;
            if (flash) flash.visible = this.muzzleFlashTimer > 0;
            const restZ = this.selectedSlot === 5 ? -1.1 : -0.68;
            activeWeapon.position.z = THREE.MathUtils.lerp(activeWeapon.position.z, (this.isAiming ? restZ + 0.14 : restZ) + this.weaponRecoil * 0.35, Math.min(1, delta * 18));
            activeWeapon.rotation.x = THREE.MathUtils.lerp(activeWeapon.rotation.x,
                this.weaponRecoil * (this.selectedSlot === 4 ? 0.22 : 0.3) + (this.selectedSlot === 5 ? reloadArc * 0.22 : 0), Math.min(1, delta * 22));
            if (this.selectedSlot === 5) {
                activeWeapon.position.x = THREE.MathUtils.lerp(activeWeapon.position.x, this.isAiming ? 0 : 0.37, Math.min(1, delta * 16));
                activeWeapon.position.y = THREE.MathUtils.lerp(activeWeapon.position.y, (this.isAiming ? -0.29 : -0.22) - reloadArc * 0.1, Math.min(1, delta * 16));
                activeWeapon.rotation.y = THREE.MathUtils.lerp(activeWeapon.rotation.y, this.isAiming ? 0 : 0.28, Math.min(1, delta * 16));
                activeWeapon.rotation.z = THREE.MathUtils.lerp(activeWeapon.rotation.z, reloadArc * 0.14, Math.min(1, delta * 16));
            }
        }

        if (this.canFly) {
            const verticalInput = (this.keys['Space'] ? 1 : 0) - (crouchDown ? 1 : 0);
            this.camera.position.y = THREE.MathUtils.clamp(
                this.camera.position.y + verticalInput * moveSpeed * delta,
                0.35,
                this.map.wallHeight + 12
            );
            this.jumpHeight = 0;
            this.jumpVelocity = 0;
        } else if (!this.isGrounded) {
            this.jumpVelocity -= 20 * delta;
            this.jumpHeight += this.jumpVelocity * delta;
            if (this.jumpHeight <= 0) {
                this.jumpHeight = 0;
                this.jumpVelocity = 0;
                this.isGrounded = true;
                this.slideJumpMomentum.set(0, 0, 0);
            }
        }
        const airBob = this.comfortMode ? 0 : (this.isGrounded ? this.headBobOffset : Math.sin(this.headBobTimer) * 0.012);
        const targetEyeHeight = this.isSliding ? 0.82 : (this.isCrouching ? 1.12 : 1.7);
        this.currentEyeHeight = THREE.MathUtils.lerp(this.currentEyeHeight, targetEyeHeight, Math.min(1, delta * 12));
        if (!this.canFly) this.camera.position.y = this.currentEyeHeight + this.jumpHeight + airBob;
        this.appliedPeekY = Math.abs(this.peekOffset * peekFraction) * 0.2;
        this.camera.position.y += this.appliedPeekY;
        if (this.infiniteStamina) this.stamina = this.staminaMax;
        if (this.isInvincible) {
            this.sanity = 100;
            this.stamina = this.staminaMax;
        }

        // Battery drain
        if (this.flashlightOn) {
            this.battery = Math.max(0, this.battery - delta * 0.7);
            if (this.battery <= 0) {
                this.flashlightOn = false;
                this.flashlight.visible = false;
            }
        }

        // Sanity logic: drops in darkness or near entity
        let darkFactor = (!this.flashlightOn) ? 1.4 : 0.2;
        if (!this.isInvincible) this.sanity = Math.max(0, this.sanity - delta * 0.45 * darkFactor);
        const manila = this.map.manilaRoom;
        const manilaWorld = this.map.gridToWorld(manila.x, manila.z);
        const inManilaRoom = Math.hypot(this.camera.position.x - manilaWorld.x, this.camera.position.z - manilaWorld.z) < 5.8;
        if (inManilaRoom) {
            this.sanity = Math.min(100, this.sanity + delta * 0.85);
            if (!this.isSprinting && !this.isSliding) this.stamina = Math.min(this.staminaMax, this.stamina + delta * 5);
            if (!this.manilaHintShown) {
                this.showNotification('马尼拉房间：较暗的橙色灯光让人暂时平静，理智与体力缓慢恢复');
                this.manilaHintShown = true;
            }
        }

        // Heartbeat when low sanity
        if (this.sanity < 40) {
            if (!this.lastHeartbeat || Date.now() - this.lastHeartbeat > (this.sanity < 20 ? 650 : 1100)) {
                this.audio.playHeartbeat();
                this.lastHeartbeat = Date.now();
            }
        }

        if (this.sanity <= 0 && !this.isInvincible) {
            this.triggerGameOver('理智耗尽，陷入后室深渊...');
        }
        if (this.isRunning && this.isLeftMouseHeld && this.selectedSlot === 5) this.shoot();
    }

    updateLights(delta) {
        this.lightRefreshTimer -= delta;
        if (this.lightRefreshTimer <= 0) {
            this.refreshActiveLights();
            this.lightRefreshTimer = 0.5;
        }

        this.lightMeshes.forEach(item => {
            if (item.state === 'flicker') {
                if (this.comfortMode) {
                    item.light.intensity = item.baseIntensity * 0.9;
                    return;
                }
                const noise = Math.sin(Date.now() * 0.015 + item.flickerSeed);
                if (noise > 0.75) {
                    item.light.intensity = 0.05 + Math.random() * 0.2;
                } else {
                    item.light.intensity = item.baseIntensity * (0.85 + Math.random() * 0.3);
                }
            }
        });
    }

    refreshActiveLights() {
        if (!this.ceilingLightCandidates || !this.lightMeshes.length) return;
        const playerPos = this.camera.position;
        const nearest = this.ceilingLightCandidates
            .slice()
            .sort((a, b) => {
                const aDx = a.worldX - playerPos.x;
                const aDz = a.worldZ - playerPos.z;
                const bDx = b.worldX - playerPos.x;
                const bDz = b.worldZ - playerPos.z;
                return (aDx * aDx + aDz * aDz) - (bDx * bDx + bDz * bDz);
            });

        this.lightMeshes.forEach((item, index) => {
            const candidate = nearest[index];
            if (!candidate) {
                item.light.intensity = 0;
                return;
            }
            item.light.position.set(candidate.worldX, this.map.wallHeight - 0.15, candidate.worldZ);
            item.state = candidate.state;
            item.flickerSeed = candidate.x * 13 + candidate.z * 7;
            const tint = this.visualNoise(candidate.x, candidate.z, 81);
            const lightColor = candidate.state === 'manila' ? 0xffb66e : candidate.state === 'flicker'
                ? (tint > 0.5 ? 0xffe0a3 : 0xdce9ff)
                : (tint > 0.82 ? 0xffe9bd : 0xfff6cf);
            item.light.color.setHex(lightColor);
            item.light.intensity = item.baseIntensity * (candidate.state === 'manila' ? 0.62 : 1);
        });
    }

    updateItems(delta) {
        const time = Date.now() * 0.003;
        let memoryMatrixChanged = false;
        this.items.forEach(item => {
            if (!item.collected) {
                if (item.type === 'memory') {
                    const anchor = this.itemAnchor || (this.itemAnchor = new THREE.Object3D());
                    anchor.position.set(item.pos.x, item.pos.y + Math.sin(time + item.pos.x) * 0.12, item.pos.z);
                    anchor.rotation.set(0.2, time + item.pos.z, 0.2);
                    anchor.scale.setScalar(1);
                    anchor.updateMatrix();
                    item.mesh.setMatrixAt(item.instanceId, anchor.matrix);
                    memoryMatrixChanged = true;
                } else if (item.type === 'gun') {
                    item.mesh.position.y = item.baseY + Math.sin(time + item.pos.x) * 0.06;
                } else if (item.type !== 'ammo') {
                    // Bobbing item animation
                    item.mesh.position.y = item.baseY + Math.sin(time + item.pos.x) * 0.08;
                }
            }
        });
        if (memoryMatrixChanged) {
            const memoryItem = this.items.find(item => item.type === 'memory');
            if (memoryItem) memoryItem.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    updateUI() {
        if (this.hudSanity) this.hudSanity.style.width = `${Math.round(this.sanity)}%`;
        if (this.hudStamina) this.hudStamina.style.width = `${Math.round(this.stamina / this.staminaMax * 100)}%`;
        if (this.hudBattery) this.hudBattery.style.width = `${Math.round(this.battery)}%`;
        if (this.hudKeys) this.hudKeys.innerText = `${this.keysFound}/${this.keysRequired}`;
        if (this.hudAlmond) this.hudAlmond.innerText = `x${this.almondWaterCount}`;

        // Camcorder VHS timestamp update
        const mins = String(Math.floor(this.timeElapsed / 60)).padStart(2, '0');
        const secs = String(Math.floor(this.timeElapsed % 60)).padStart(2, '0');
        const frames = String(Math.floor((this.timeElapsed % 1) * 30)).padStart(2, '0');
        if (this.vhsTape) this.vhsTape.innerText = `REC 00:${mins}:${secs}:${frames}`;

        // Sanity vignette / glitch overlay
        const glitchOverlay = document.getElementById('sanity-vignette');
        if (glitchOverlay) {
            const terror = 1.0 - (this.sanity / 100);
            glitchOverlay.style.opacity = (terror * 0.8).toFixed(2);
        }

        // Interaction prompt
        const playerPos = this.camera.position;
        let prompt = '';
        for (const item of this.items) {
            if (!item.collected && item.pos.distanceTo(playerPos) < 2.0) {
                if (item.type === 'keycard') prompt = '按 [G] 拾取门禁芯片';
                else if (item.type === 'almond_water') prompt = '按 [G] 拾取杏仁水';
                else if (item.type === 'battery') prompt = '按 [G] 拾取9V电池';
                else if (item.type === 'memory') prompt = '按 [G] 收集记忆微光';
                else if (item.type === 'gun') prompt = '按 [G] 拾取手枪';
                else if (item.type === 'awm') prompt = '按 [G] 拾取 AWM 狙击枪';
                else if (item.type === 'ammo') prompt = '按 [G] 拾取弹药箱 (+8)';
                break;
            }
        }

        if (this.isPlayerHidden) {
            prompt = '躲藏中 · 按 [G] 离开储物柜';
        } else if (this.lockerPositions.some(pos => pos.distanceTo(playerPos) < 2.0)) {
            prompt = '按 [G] 躲进储物柜，暂时躲开 Smiler';
        }

        const exitCoord = this.map.exitDoor;
        const exitWorld = this.map.gridToWorld(exitCoord.x, exitCoord.z);
        if (new THREE.Vector2(playerPos.x - exitWorld.x, playerPos.z - exitWorld.z).length() < 3.0) {
            prompt = (this.keysFound >= this.keysRequired) ? '★ 按 [G] 卡入逃生出口 (NO-CLIP) ★' : `⚠️ 出口需 3 张门禁芯片 (${this.keysFound}/3)`;
        }

        if (this.promptText) {
            this.promptText.innerText = prompt;
            this.promptText.style.display = prompt ? 'block' : 'none';
        }

        // Draw Minimap
        this.drawMinimap();
    }

    drawMinimap() {
        const canvas = document.getElementById('minimap-canvas');
        if (!canvas || canvas.style.display === 'none') return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.fillStyle = 'rgba(10, 10, 8, 0.85)';
        ctx.fillRect(0, 0, w, h);

        const playerPos = this.camera.position.clone();
        playerPos.x -= this.appliedPeekX;
        playerPos.z -= this.appliedPeekZ;
        const cs = this.map.cellSize;
        const padding = 7;
        const cellW = (w - padding * 2) / this.map.width;
        const cellH = (h - padding * 2) / this.map.height;
        const pointFor = (worldX, worldZ) => ({
            x: padding + (worldX / cs + 0.5) * cellW,
            y: padding + (worldZ / cs + 0.5) * cellH
        });

        // Keep the full maze fixed so the marker reports the player's true map position.
        ctx.fillStyle = '#17160f';
        ctx.fillRect(0, 0, w, h);
        for (let z = 0; z < this.map.height; z++) {
            for (let x = 0; x < this.map.width; x++) {
                const cell = this.map.grid[z][x];
                if (cell > 0) {
                    ctx.fillStyle = cell === 2 ? '#b69c5d' : '#716548';
                    ctx.fillRect(padding + x * cellW, padding + z * cellH, Math.ceil(cellW), Math.ceil(cellH));
                }
            }
        }

        for (const obstacle of this.map.obstacles) {
            const marker = pointFor(obstacle.x, obstacle.z);
            const markerW = Math.max(2, obstacle.halfX * 2 / cs * cellW);
            const markerH = Math.max(2, obstacle.halfZ * 2 / cs * cellH);
            ctx.fillStyle = obstacle.kind === 'cabinet' ? '#9da394' : obstacle.kind === 'barrel' ? '#a06142' : '#bd9665';
            ctx.fillRect(marker.x - markerW / 2, marker.y - markerH / 2, markerW, markerH);
        }

        // Draw Exit
        const exitWorld = this.map.gridToWorld(this.map.exitDoor.x, this.map.exitDoor.z);
        const { x: ex, y: ez } = pointFor(exitWorld.x, exitWorld.z);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(ex - 3, ez - 3, 6, 6);

        // Nearby Smilers appear on radar; K mode reveals all of them.
        for (const entity of this.entities) {
            if (entity.isDead) continue;
            const distance = entity.position.distanceTo(playerPos);
            if (!this.isXRayMode && distance > 12) continue;
            const enemy = pointFor(entity.position.x, entity.position.z);
            ctx.fillStyle = '#ff4c45';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, 2.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // The arrow points along the camera's actual world-space facing direction.
        const player = pointFor(playerPos.x, playerPos.z);
        const yaw = this.camera.rotation.y;
        const directionX = -Math.sin(yaw);
        const directionY = -Math.cos(yaw);
        const angle = Math.atan2(directionY, directionX);
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#ff4e4e';
        ctx.beginPath();
        ctx.moveTo(7, 0);
        ctx.lineTo(-5, -4.5);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-5, 4.5);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(225, 211, 163, 0.55)';
        ctx.strokeRect(padding - 1, padding - 1, w - padding * 2 + 2, h - padding * 2 + 2);
    }

    triggerGameOver(reason) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.isRunning = false;
        this.audio.stopEntityBarks();
        document.exitPointerLock();
        this.audio.playDeathCall();
        this.audio.suspend();

        const screen = document.getElementById('game-over-screen');
        const reasonEl = document.getElementById('death-reason');
        if (reasonEl) reasonEl.innerText = reason;
        if (screen) screen.style.display = 'flex';
    }

    triggerVictory() {
        if (this.isVictory) return;
        this.isVictory = true;
        this.isRunning = false;
        this.audio.stopEntityBarks();
        document.exitPointerLock();
        this.audio.suspend();

        const screen = document.getElementById('victory-screen');
        const statsEl = document.getElementById('victory-stats');
        const mins = Math.floor(this.timeElapsed / 60);
        const secs = Math.floor(this.timeElapsed % 60);
        if (statsEl) {
            statsEl.innerText = `逃脱耗时: ${mins}分${secs}秒 | 剩余理智: ${Math.round(this.sanity)}%`;
        }
        if (screen) screen.style.display = 'flex';
    }

    animate() {
        requestAnimationFrame(this.animate);
        const delta = Math.min(this.clock.getDelta(), 0.1);
        const pauseOverlay = document.getElementById('pause-overlay');
        const isPaused = this.cheatMenuOpen || (pauseOverlay && pauseOverlay.style.display === 'flex');

        if (this.isRunning && !this.isGameOver && !this.isVictory && !isPaused) {
            this.timeElapsed += delta;
            this.updatePlayer(delta);
            this.updateLights(delta);
            this.updateItems(delta);

            for (const entity of this.entities) {
                const status = entity.update(delta, this.camera.position, this.isSprinting, this.entities, this.isPlayerHidden);
                if (status === 'RESPAWNED') {
                    this.showNotification('远处传来笑声……Smiler 已在迷宫另一处复活');
                }
                if (status === 'CAUGHT' && !this.isInvincible) {
                    this.triggerGameOver('被微笑者实体 (The Smiler) 捕获！');
                    break;
                }
            }

            this.entityAudioTimer -= delta;
            if (this.entityAudioTimer <= 0) {
                this.audio.updateEntityBarks(this.entities, this.camera);
                this.entityAudioTimer = 0.1;
            }

            this.updateUI();
        }

        // A 45 FPS cap reduces GPU power draw; also stop drawing while paused.
        if (this.isRunning && !this.isGameOver && !this.isVictory && !isPaused) {
            const now = performance.now();
            if (now - this.renderTimer >= 1000 / this.targetFps) {
                this.renderer.render(this.scene, this.camera);
                this.renderTimer = now;
            }
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new BackroomsGame();
});
