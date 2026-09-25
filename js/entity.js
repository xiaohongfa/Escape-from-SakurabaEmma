/**
 * Backrooms Entity AI (The Smiler)
 */
class BackroomsEntity {
    constructor(scene, map, audio, textureMap, spawnCell = map.monsterSpawn) {
        this.scene = scene;
        this.map = map;
        this.audio = audio;
        this.textureMap = textureMap;

        // Position & Movement
        const spawnWorld = this.map.gridToWorld(spawnCell.x, spawnCell.z);
        this.position = new THREE.Vector3(spawnWorld.x, 1.6, spawnWorld.z);
        this.velocity = new THREE.Vector3();
        this.speed = 2.4;
        this.chaseSpeed = 4.8;
        this.state = 'PATROL'; // PATROL, INVESTIGATE, CHASE
        // Whole-number units keep the pistol at three hits and the M7 at ten.
        this.maxHealth = 30;
        this.health = this.maxHealth;
        this.isDead = false;
        this.respawnTimer = 0;
        this.hitFlashTimer = 0;
        this.deathPoseTimer = 0;
        this.slowTimer = 0;
        this.pathRepathTimer = 0;
        this.pathWaypoint = null;
        this.hiddenSearchTimer = 0;
        this.isXRayEnabled = false;

        this.patrolTarget = null;
        this.investigateTarget = null;
        this.changeTargetTimer = 0;
        this.stateTimer = 0;
        this.glitchOffset = new THREE.Vector3();
        this.visualUpdateTimer = 0;

        this.initMesh();
    }

    initMesh() {
        // Create 3D billboard sprite for The Smiler
        const smilerTex = this.textureMap['smiler'] || null;
        this.defaultTexture = smilerTex;
        this.hitTexture = this.textureMap['smiler_hit'] || smilerTex;
        this.defeatTexture = this.textureMap['smiler_defeated'] || smilerTex;
        const mat = new THREE.SpriteMaterial({
            map: smilerTex,
            transparent: true,
            color: 0xffffff,
            depthWrite: false
        });

        this.sprite = new THREE.Sprite(mat);
        this.sprite.scale.set(2.45, 2.6, 1);
        this.sprite.position.copy(this.position);
        this.scene.add(this.sprite);
    }

    update(delta, playerPos, isPlayerSprinting, otherEntities = [], isPlayerHidden = false) {
        if (this.isDead) {
            this.deathPoseTimer -= delta;
            if (this.deathPoseTimer <= 0 && this.sprite.parent) this.scene.remove(this.sprite);
            this.respawnTimer -= delta;
            if (this.respawnTimer <= 0) {
                this.respawnElsewhere(playerPos, otherEntities);
                return 'RESPAWNED';
            }
            return 'DEAD';
        }

        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= delta;
            if (this.hitFlashTimer <= 0) {
                this.sprite.material.map = this.defaultTexture;
                this.sprite.material.color.setHex(this.isXRayEnabled ? 0xffd7f5 : 0xffffff);
            }
        }
        this.slowTimer = Math.max(0, this.slowTimer - delta);
        let distToPlayer = this.position.distanceTo(playerPos);
        const manilaWorld = this.map.gridToWorld(this.map.manilaRoom.x, this.map.manilaRoom.z);
        const playerInManila = Math.hypot(playerPos.x - manilaWorld.x, playerPos.z - manilaWorld.z) < 5.8;
        if (playerInManila && this.state !== 'PATROL') {
            this.state = 'PATROL';
            this.investigateTarget = null;
            this.pathWaypoint = null;
            this.chooseNewPatrolTarget();
        }

        // State Machine
        this.stateTimer += delta;
        this.changeTargetTimer -= delta;

        // Detection check:
        // 1. If player is sprinting, hearing radius is 18m
        // 2. Direct line-of-sight / proximity within 10m triggers chase
        const hearingDist = isPlayerSprinting ? 18.0 : 7.0;
        const canHearPlayer = distToPlayer < hearingDist;
        if (playerInManila) {
            // The quiet pocket is a short refuge from the hunting loop.
        } else if (isPlayerHidden && this.state === 'CHASE') {
            this.state = 'INVESTIGATE';
            this.investigateTarget = playerPos.clone();
            this.pathWaypoint = null;
        } else if (!isPlayerHidden && (distToPlayer < 9.0 || (canHearPlayer && distToPlayer < 14.0))) {
            if (this.state !== 'CHASE') {
                this.state = 'CHASE';
                // Trigger quick flicker / screech
            }
        } else if (!isPlayerHidden && canHearPlayer) {
            this.state = 'INVESTIGATE';
            this.investigateTarget = playerPos.clone();
        } else if (!isPlayerHidden && this.state === 'CHASE' && distToPlayer > 18.0) {
            // Player lost the monster
            this.state = 'PATROL';
            this.chooseNewPatrolTarget();
        }

        // Behavior execution
        let targetPos = null;
        let currentSpeed = this.speed;

        if (this.state === 'CHASE') {
            targetPos = playerPos;
            currentSpeed = this.chaseSpeed;
        } else if (this.state === 'INVESTIGATE') {
            targetPos = this.investigateTarget;
            currentSpeed = this.speed * 1.2;
        } else {
            // PATROL
            currentSpeed = this.speed;
            if (!this.patrolTarget || this.changeTargetTimer <= 0 || this.position.distanceTo(this.patrolTarget) < 1.0) {
                this.chooseNewPatrolTarget();
            }
            targetPos = this.patrolTarget;
        }

        if (targetPos) {
            if (this.state === 'CHASE' || this.state === 'INVESTIGATE') {
                this.pathRepathTimer -= delta;
                if (!this.pathWaypoint || this.pathRepathTimer <= 0 || this.position.distanceTo(this.pathWaypoint) < 0.85) {
                    this.pathWaypoint = this.map.getChaseWaypoint(this.position, targetPos, true) || targetPos.clone();
                    this.pathRepathTimer = 0.35;
                }
                targetPos = this.pathWaypoint;
            }
            const dir = new THREE.Vector3().subVectors(targetPos, this.position);
            dir.y = 0;
            if (dir.lengthSq() > 0.01) {
                dir.normalize();
                const slowFactor = this.slowTimer > 0 ? 0.42 : 1;
                this.velocity.copy(dir).multiplyScalar(currentSpeed * slowFactor * delta);
                const previousX = this.position.x;
                const previousZ = this.position.z;
                this.position.add(this.velocity);
                this.map.collideAndSlide(this.position, 0.6);
                if (Math.hypot(this.position.x - manilaWorld.x, this.position.z - manilaWorld.z) < 6.0) {
                    this.position.x = previousX;
                    this.position.z = previousZ;
                    this.pathWaypoint = null;
                    this.chooseNewPatrolTarget();
                }
            }
        }

        // Update subtle sprite jitter at 12 Hz instead of allocating random values every frame.
        this.visualUpdateTimer -= delta;
        if (this.visualUpdateTimer <= 0) {
            this.glitchOffset.set(
                (Math.random() - 0.5) * 0.08,
                Math.sin(Date.now() * 0.005) * 0.15 + (Math.random() - 0.5) * 0.05,
                0
            );
            this.sprite.position.copy(this.position).add(this.glitchOffset);
            this.visualUpdateTimer = 1 / 12;
        } else {
            this.sprite.position.copy(this.position).add(this.glitchOffset);
        }

        distToPlayer = this.position.distanceTo(playerPos);
        if (isPlayerHidden && distToPlayer < 1.6) {
            this.hiddenSearchTimer += delta;
            if (this.hiddenSearchTimer >= 2.4) {
                this.state = 'PATROL';
                this.hiddenSearchTimer = 0;
                this.pathWaypoint = null;
                this.chooseNewPatrolTarget();
            }
        } else {
            this.hiddenSearchTimer = 0;
        }

        // Check if caught player. A locker buys a short escape window while the Smiler searches.
        if (!isPlayerHidden && !playerInManila && distToPlayer < 1.3) {
            return 'CAUGHT';
        }

        return 'ALIVE';
    }

    setXRay(enabled) {
        this.isXRayEnabled = enabled;
        this.sprite.material.depthTest = !enabled;
        this.sprite.material.color.setHex(enabled ? 0xffd7f5 : 0xffffff);
        this.sprite.renderOrder = enabled ? 10 : 0;
    }

    takeDamage(amount = 1, listenerPosition = null) {
        if (this.isDead) return false;
        this.health -= amount;
        if (this.health <= 0) {
            this.isDead = true;
            this.respawnTimer = 12;
            this.deathPoseTimer = 0.85;
            this.sprite.material.map = this.defeatTexture;
            this.sprite.material.color.setHex(0xffffff);
            if (this.audio && this.audio.playDeathCall) {
                const distance = listenerPosition ? this.position.distanceTo(listenerPosition) : null;
                this.audio.playDeathCall(null, distance);
            }
            return true;
        }
        this.slowTimer = Math.max(this.slowTimer, 2.1);
        this.hitFlashTimer = 0.38;
        this.sprite.material.map = this.hitTexture;
        this.sprite.material.color.setHex(0xffdddd);
        return false;
    }

    respawnElsewhere(playerPos, otherEntities) {
        const candidates = [];
        const previousCell = this.map.worldToGrid(this.position.x, this.position.z);
        for (let z = 1; z < this.map.height - 1; z++) {
            for (let x = 1; x < this.map.width - 1; x++) {
                if (!this.map.isWalkable(x, z) || this.map.isManilaRoom(x, z)) continue;
                const world = this.map.gridToWorld(x, z);
                const fromPlayer = (world.x - playerPos.x) ** 2 + (world.z - playerPos.z) ** 2;
                const fromPrevious = (x - previousCell.x) ** 2 + (z - previousCell.z) ** 2;
                const nearOther = otherEntities.some(entity => !entity.isDead && entity !== this &&
                    (entity.position.x - world.x) ** 2 + (entity.position.z - world.z) ** 2 < 18 * 18);
                if (fromPlayer > 27 * 27 && fromPrevious > 16 && !nearOther) candidates.push({ x, z, world });
            }
        }
        if (!candidates.length) {
            for (let z = 1; z < this.map.height - 1; z++) {
                for (let x = 1; x < this.map.width - 1; x++) {
                    if (!this.map.isWalkable(x, z)) continue;
                    const world = this.map.gridToWorld(x, z);
                    if ((world.x - playerPos.x) ** 2 + (world.z - playerPos.z) ** 2 > 18 * 18) candidates.push({ x, z, world });
                }
            }
        }
        const spawn = candidates[Math.floor(Math.random() * candidates.length)];
        if (!spawn) {
            this.respawnTimer = 1;
            return;
        }

        this.position.set(spawn.world.x, 1.6, spawn.world.z);
        this.velocity.set(0, 0, 0);
        this.health = this.maxHealth;
        this.isDead = false;
        this.deathPoseTimer = 0;
        this.slowTimer = 0;
        this.pathWaypoint = null;
        this.pathRepathTimer = 0;
        this.hiddenSearchTimer = 0;
        this.state = 'PATROL';
        this.patrolTarget = null;
        this.investigateTarget = null;
        this.changeTargetTimer = 0;
        this.sprite.material.color.setHex(this.isXRayEnabled ? 0xffd7f5 : 0xffffff);
        this.sprite.material.map = this.defaultTexture;
        this.sprite.position.copy(this.position);
        this.scene.add(this.sprite);
    }

    hearGunshot(playerPos, radius = 30) {
        if (this.isDead || this.position.distanceTo(playerPos) > radius) return;
        this.state = 'INVESTIGATE';
        this.investigateTarget = playerPos.clone();
        this.changeTargetTimer = 0;
    }

    chooseNewPatrolTarget() {
        this.changeTargetTimer = 8.0 + Math.random() * 6.0;
        // Pick random walkable cell
        const candidates = [];
        for (let z = 1; z < this.map.height - 1; z++) {
            for (let x = 1; x < this.map.width - 1; x++) {
                if (this.map.isWalkable(x, z) && !this.map.isManilaRoom(x, z)) {
                    candidates.push({ x, z });
                }
            }
        }

        if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            const world = this.map.gridToWorld(pick.x, pick.z);
            this.patrolTarget = new THREE.Vector3(world.x, 1.6, world.z);
        }
    }
}

window.BackroomsEntity = BackroomsEntity;
