/**
 * Map definition and generation for Backrooms Level 0
 */
class BackroomsMap {
    constructor() {
        this.cellSize = 4; // 4 meters per grid cell
        this.wallHeight = 3.2; // 3.2 meters high ceiling
        this.width = 25;
        this.height = 25;

        // Custom handcrafted layout for Level 0
        // # = Wall, . = Walkable, C = Pillar, P = Player, E = Exit Door,
        // K = Keycard, A = Almond Water, B = Battery, M = Monster Spawn
        this.asciiMap = [
            "#########################",
            "#P...#.......#.....#....#",
            "#.##.#.#####.#.###.#.##.#",
            "#.#..#.#...#.#.#.#...#..#",
            "#.#.##.#.#.#.#.#.#####.##",
            "#...#....#.#...#...A....#",
            "###.#.####.#######.####.#",
            "#...#....#.......#....#.#",
            "#.######.###.###.####.#.#",
            "#.#....#...#.#.#....#.#.#",
            "#.#.##.###.#.#.####.#.#.#",
            "#...#K...#...#....#...#A#",
            "#.######.#.C...C..#.#####",
            "#.#......#........#.....#",
            "#.#.####.#.C...C..###.#.#",
            "#...#..#.#........#...#B#",
            "#####.##.##########.###.#",
            "#.....#........#....#...#",
            "#.#####.######.#.####.###",
            "#.#K..#......#...#......#",
            "#.#.####.###.#####.####.#",
            "#.#....#...#.#M..#.#K...#",
            "#.####.###.#.###.#.##.###",
            "#....A...#...#...#.....E#",
            "#########################"
        ];

        this.grid = [];
        this.playerSpawn = { x: 1, z: 1 };
        this.monsterSpawn = { x: 13, z: 21 };
        this.exitDoor = { x: 23, z: 23 };
        this.keycards = [];
        this.almondWaters = [];
        this.batteries = [];
        this.hazards = [];
        this.memoryFragments = [];
        this.weaponSpawns = [];
        this.awmSpawns = [];
        this.ammoCaches = [];
        this.lockers = [];
        this.pillars = [];
        this.lights = [];

        this.parse();
    }

    parse() {
        this.height = this.asciiMap.length;
        this.width = this.asciiMap[0].length;

        for (let z = 0; z < this.height; z++) {
            this.grid[z] = [];
            const row = this.asciiMap[z];
            for (let x = 0; x < this.width; x++) {
                const char = row[x] || '#';
                let cellType = 0; // 0 = empty

                if (char === '#') {
                    cellType = 1; // Wall
                } else if (char === 'C') {
                    cellType = 2; // Pillar
                    this.pillars.push({ x, z });
                } else if (char === 'P') {
                    this.playerSpawn = { x, z };
                } else if (char === 'M') {
                    this.monsterSpawn = { x, z };
                } else if (char === 'E') {
                    this.exitDoor = { x, z };
                } else if (char === 'K') {
                    this.keycards.push({ x, z });
                } else if (char === 'A') {
                    this.almondWaters.push({ x, z });
                } else if (char === 'B') {
                    this.batteries.push({ x, z });
                }

                this.grid[z][x] = cellType;
            }
        }

        // Two concealed breaks connect the three formerly isolated maze regions.
        // The Smiler spawn sits in the east annex, so leaving these walls closed
        // made the chase impossible even when its AI was working correctly.
        this.grid[20][14] = 0;
        this.grid[17][6] = 0;

        // Generate ceiling fluorescent light positions at regular walkable intervals
        for (let z = 1; z < this.height - 1; z += 2) {
            for (let x = 1; x < this.width - 1; x += 2) {
                if (this.isWalkable(x, z)) {
                    // Random light characteristics: normal, flicker, or burnt out
                    const rand = Math.random();
                    let state = 'normal';
                    if (rand < 0.22) state = 'flicker';
                    else if (rand < 0.35) state = 'dark'; // Dark scary zone

                    this.lights.push({
                        x, z,
                        worldX: x * this.cellSize,
                        worldZ: z * this.cellSize,
                        state: state
                    });
                }
            }
        }

        const reserved = [
            this.playerSpawn, this.monsterSpawn, this.exitDoor,
            ...this.keycards, ...this.almondWaters, ...this.batteries
        ];
        this.hazards = this.pickSpecialCells(9, reserved, 16);
        this.memoryFragments = this.pickSpecialCells(6, [...reserved, ...this.hazards], 9);
        const reservedLoot = [...reserved, ...this.hazards, ...this.memoryFragments];
        this.weaponSpawns = this.pickSpecialCells(1, reservedLoot, 9);
        this.awmSpawns = this.pickSpecialCells(1, [...reservedLoot, ...this.weaponSpawns], 9);
        this.ammoCaches = this.pickSpecialCells(4, [...reservedLoot, ...this.weaponSpawns, ...this.awmSpawns], 9);
        this.lockers = this.pickSpecialCells(4, [...reservedLoot, ...this.weaponSpawns, ...this.awmSpawns, ...this.ammoCaches], 16);
    }

    pickSpecialCells(count, forbidden, spacingSq) {
        const candidates = [];
        for (let z = 1; z < this.height - 1; z++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (!this.isWalkable(x, z)) continue;
                if (forbidden.some(pos => (pos.x - x) ** 2 + (pos.z - z) ** 2 < 9)) continue;
                candidates.push({ x, z, order: Math.random() });
            }
        }
        candidates.sort((a, b) => a.order - b.order);

        const picked = [];
        for (const cell of candidates) {
            if (picked.some(pos => (pos.x - cell.x) ** 2 + (pos.z - cell.z) ** 2 < spacingSq)) continue;
            picked.push({ x: cell.x, z: cell.z });
            if (picked.length >= count) break;
        }
        return picked;
    }

    isWalkable(gx, gz) {
        if (gx < 0 || gx >= this.width || gz < 0 || gz >= this.height) return false;
        return this.grid[gz][gx] === 0;
    }

    hasClearShot(from, to) {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const steps = Math.ceil(Math.hypot(dx, dz) / 0.45);
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cell = this.worldToGrid(from.x + dx * t, from.z + dz * t);
            if (!this.isWalkable(cell.x, cell.z)) return false;
        }
        return true;
    }

    getChaseWaypoint(from, to) {
        const start = this.worldToGrid(from.x, from.z);
        const goal = this.worldToGrid(to.x, to.z);
        if (!this.isWalkable(start.x, start.z) || !this.isWalkable(goal.x, goal.z)) return null;
        if (start.x === goal.x && start.z === goal.z) return new THREE.Vector3(to.x, from.y, to.z);

        const indexOf = (x, z) => z * this.width + x;
        const total = this.width * this.height;
        const parent = new Int32Array(total);
        parent.fill(-1);
        const queue = new Int32Array(total);
        let head = 0;
        let tail = 0;
        const startIndex = indexOf(start.x, start.z);
        const goalIndex = indexOf(goal.x, goal.z);
        queue[tail++] = startIndex;
        parent[startIndex] = startIndex;
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        while (head < tail && parent[goalIndex] === -1) {
            const current = queue[head++];
            const x = current % this.width;
            const z = Math.floor(current / this.width);
            for (const [dx, dz] of directions) {
                const nx = x + dx;
                const nz = z + dz;
                if (!this.isWalkable(nx, nz)) continue;
                const next = indexOf(nx, nz);
                if (parent[next] !== -1) continue;
                parent[next] = current;
                queue[tail++] = next;
            }
        }
        if (parent[goalIndex] === -1) return null;

        let step = goalIndex;
        while (parent[step] !== startIndex && step !== startIndex) step = parent[step];
        const waypoint = this.gridToWorld(step % this.width, Math.floor(step / this.width));
        return new THREE.Vector3(waypoint.x, from.y, waypoint.z);
    }

    worldToGrid(wx, wz) {
        return {
            x: Math.round(wx / this.cellSize),
            z: Math.round(wz / this.cellSize)
        };
    }

    gridToWorld(gx, gz) {
        return {
            x: gx * this.cellSize,
            z: gz * this.cellSize
        };
    }

    /**
     * Circle-wall collision detection and sliding response
     */
    collideAndSlide(pos, radius = 0.5) {
        const gx = Math.floor(pos.x / this.cellSize);
        const gz = Math.floor(pos.z / this.cellSize);

        // Check 3x3 surrounding cells
        for (let oz = -1; oz <= 1; oz++) {
            for (let ox = -1; ox <= 1; ox++) {
                const cx = gx + ox;
                const cz = gz + oz;

                if (cx < 0 || cx >= this.width || cz < 0 || cz >= this.height) continue;

                const isWall = this.grid[cz][cx] === 1;
                const isPillar = this.grid[cz][cx] === 2;

                if (isWall || isPillar) {
                    const minX = cx * this.cellSize - this.cellSize / 2;
                    const maxX = cx * this.cellSize + this.cellSize / 2;
                    const minZ = cz * this.cellSize - this.cellSize / 2;
                    const maxZ = cz * this.cellSize + this.cellSize / 2;

                    // Nearest point on AABB
                    const closestX = Math.max(minX, Math.min(pos.x, maxX));
                    const closestZ = Math.max(minZ, Math.min(pos.z, maxZ));

                    const distX = pos.x - closestX;
                    const distZ = pos.z - closestZ;
                    const distSq = distX * distX + distZ * distZ;

                    if (distSq < radius * radius && distSq > 0.000001) {
                        const dist = Math.sqrt(distSq);
                        const pushDist = radius - dist;
                        pos.x += (distX / dist) * pushDist;
                        pos.z += (distZ / dist) * pushDist;
                    }
                }
            }
        }
    }
}

window.BackroomsMap = BackroomsMap;
