
import { ALLY_TYPES, ENEMY_TYPES, BOSS_CONFIG } from '../src/game/unitsConfig.js';
import { STAGE_CONFIG } from '../src/game/stagesConfig.js';
import fs from 'fs';

class HeadlessSimulator {
    constructor(stageId, iterations = 20) {
        this.stageId = stageId;
        this.config = STAGE_CONFIG[stageId];
        this.iterations = iterations;
    }

    run() {
        let results = [];
        for (let i = 0; i < this.iterations; i++) {
            results.push(this.simulate());
        }

        const clearRate = (results.filter(r => r.victory).length / this.iterations) * 100;
        const avgTime = results.reduce((acc, r) => acc + r.time, 0) / this.iterations;
        
        return {
            stage: this.stageId,
            clearRate: clearRate.toFixed(1) + '%',
            avgTime: (avgTime / 1000).toFixed(1) + 's',
            details: results
        };
    }

    simulate() {
        let time = 0;
        const dt = 16.6; // ms
        const maxTime = 180000; // 3 minutes limit for auto battle

        // Player Stats
        const playerLevel = Math.max(1, (this.stageId - 1) * 2);
        const playerGrowth = 1 + (playerLevel - 1) * 0.2;
        
        let playerUnits = [{ 
            type: 'leader', 
            hp: BOSS_CONFIG.leader.hp * playerGrowth, 
            maxHp: BOSS_CONFIG.leader.hp * playerGrowth,
            damage: BOSS_CONFIG.leader.damage * playerGrowth, 
            range: BOSS_CONFIG.leader.range,
            cooldown: BOSS_CONFIG.leader.cooldown,
            nextAttack: 0,
            x: 50,
            isBoss: true
        }];

        // Enemy Stats
        const enemyLevel = (this.stageId - 1) * 3 + 1;
        const enemyScale = (1 + (enemyLevel * 0.1));
        const bossConfig = this.config.boss;
        
        let enemyUnits = [{
            type: 'boss',
            hp: bossConfig.hp * enemyScale,
            maxHp: bossConfig.hp * enemyScale,
            damage: bossConfig.damage * enemyScale,
            range: bossConfig.range,
            cooldown: bossConfig.cooldown,
            nextAttack: 0,
            x: 750,
            isBoss: true
        }];

        let nextAllySpawn = 0;
        let nextEnemySpawn = 0;
        let nextDeckSpawn = 0;
        let nextShouting = 0;
        let shoutingEndTime = 0;

        const baseAllyDelay = 4000;
        const allySpawnDelay = Math.max(800, baseAllyDelay - (playerLevel - 1) * 300);
        const enemySpawnDelay = Math.max(800, 4000 - enemyLevel * 350) / (this.config.traits.spawnRateMultiplier || 1.0);
        const deckSpawnDelay = 1000; // 1s auto deploy
        const shoutingCooldown = 15000;
        const shoutingDuration = 10000;

        // Mock Deck: 3 units based on stage level
        const unlockedTypes = Object.keys(ALLY_TYPES).filter(k => (ALLY_TYPES[k].unlockStage || 0) < this.stageId);
        const deck = Array(3).fill(null).map(() => unlockedTypes[Math.floor(Math.random() * unlockedTypes.length)] || 'normal');
        let deckSpawnIndex = 0;

        while (time < maxTime) {
            time += dt;

            // --- Spawning ---
            // 1. Minion Allies
            if (time >= nextAllySpawn) {
                const specs = ALLY_TYPES['normal'];
                playerUnits.push({
                    type: 'normal',
                    hp: specs.hp * playerGrowth,
                    damage: specs.damage * playerGrowth,
                    range: specs.range,
                    cooldown: specs.cooldown,
                    nextAttack: time + specs.cooldown,
                    x: 0
                });
                nextAllySpawn += allySpawnDelay;
            }

            // 2. Deck Allies (Auto Mode)
            if (time >= nextDeckSpawn && deckSpawnIndex < deck.length) {
                const type = deck[deckSpawnIndex];
                const specs = ALLY_TYPES[type];
                playerUnits.push({
                    type: type,
                    hp: specs.hp * playerGrowth,
                    damage: specs.damage * playerGrowth,
                    range: specs.range,
                    cooldown: specs.cooldown,
                    nextAttack: time + specs.cooldown,
                    x: 0,
                    bonusKnockback: specs.bonusKnockback || 0
                });
                deckSpawnIndex++;
                nextDeckSpawn += deckSpawnDelay;
            }

            // 3. Enemies
            if (time >= nextEnemySpawn) {
                const enemyType = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
                enemyUnits.push({
                    type: enemyType.type,
                    hp: enemyType.hp * enemyScale,
                    damage: enemyType.damage * enemyScale,
                    range: enemyType.range,
                    cooldown: enemyType.cooldown,
                    nextAttack: time + enemyType.cooldown,
                    x: 800
                });
                nextEnemySpawn += enemySpawnDelay;
            }

            // 4. Skills (Auto Mode)
            if (time >= nextShouting) {
                shoutingEndTime = time + shoutingDuration;
                nextShouting = time + shoutingCooldown;
            }

            // --- Movement ---
            const allySpeed = 1.2 * (dt / 16.6);
            const enemySpeed = 0.8 * (this.config.traits.enemySpeedMultiplier || 1.0) * (dt / 16.6);

            playerUnits.forEach(u => {
                if (u.isBoss) return; // Leader stays at 50
                // Find nearest enemy
                let nearestEnemy = null;
                let minDist = Infinity;
                enemyUnits.forEach(e => {
                    const d = Math.abs(e.x - u.x);
                    if (d < minDist) { minDist = d; nearestEnemy = e; }
                });
                if (!nearestEnemy || minDist > u.range) u.x += allySpeed;
            });

            enemyUnits.forEach(u => {
                if (u.isBoss) return; // Boss stays at 750
                let nearestPlayer = null;
                let minDist = Infinity;
                playerUnits.forEach(p => {
                    const d = Math.abs(p.x - u.x);
                    if (d < minDist) { minDist = d; nearestPlayer = p; }
                });
                if (!nearestPlayer || minDist > u.range) u.x -= enemySpeed;
            });

            // --- Combat ---
            const isBuffed = time < shoutingEndTime;

            playerUnits.forEach(u => {
                if (time >= u.nextAttack) {
                    let target = enemyUnits.find(e => Math.abs(e.x - u.x) <= u.range + 10);
                    if (target) {
                        target.hp -= u.damage;
                        u.nextAttack = time + u.cooldown;

                        // Knockback logic
                        let kbChance = 0.1 + (u.bonusKnockback || 0);
                        if (isBuffed) kbChance *= 6;
                        if (!target.isBoss && Math.random() < kbChance) {
                            target.x += 40; // Push back
                            if (target.x > 800) target.x = 800;
                        }
                    }
                }
            });

            enemyUnits.forEach(u => {
                if (time >= u.nextAttack) {
                    let target = playerUnits.find(p => Math.abs(p.x - u.x) <= u.range + 10);
                    if (target) {
                        target.hp -= u.damage;
                        u.nextAttack = time + u.cooldown;
                    }
                }
            });

            // --- Cleanup ---
            playerUnits = playerUnits.filter(u => u.hp > 0);
            enemyUnits = enemyUnits.filter(u => u.hp > 0);

            // Victory/Defeat
            if (!enemyUnits.some(u => u.isBoss)) return { victory: true, time: time };
            if (!playerUnits.some(u => u.isBoss)) return { victory: false, time: time };
        }

        return { victory: false, time: maxTime };
    }
}

const summary = [];
console.log("--- Headless Auto-Battle Simulation Start ---");
for (let s = 1; s <= 7; s++) {
    const sim = new HeadlessSimulator(s, 20);
    const report = sim.run();
    summary.push(report);
    console.log(`Stage ${s} [${STAGE_CONFIG[s].name}]: Clear Rate: ${report.clearRate}, Avg Time: ${report.avgTime}`);
}

fs.writeFileSync('./simulation_results.json', JSON.stringify(summary, null, 2));
console.log("--- Simulation Complete! Results saved to simulation_results.json ---");
