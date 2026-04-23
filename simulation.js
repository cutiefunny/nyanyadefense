
// Simulation parameters
const bossHP = 1500;
const bossDamage = 15;
const bossCooldown = 2000;
const leaderHP = 1500;
const leaderDamage = 25;
const leaderCooldown = 1500;
const leaderDefense = 2;

const catHP = 120;
const catDamage = 12;
const catCooldown = 1000;
const catSpawnRate = 4000;

const dogHP = 90;
const dogDamage = 10;
const dogCooldown = 1200;
const dogSpawnRate = 5214; // (4000 - 350) / 0.7

let time = 0;
let playerUnits = [{ type: 'leader', hp: leaderHP, nextAttack: leaderCooldown, x: 50 }];
let enemyUnits = [{ type: 'boss', hp: bossHP, nextAttack: bossCooldown, x: 750 }];

let nextCatSpawn = 0;
let nextDogSpawn = 0;

const speed = 1.2; // pixels per frame (approx)
const dogSpeed = 0.8 * 0.9; // speed * trait multiplier
const dt = 16.6; // ms per frame

console.log("Starting Stage 1 Simulation (No Upgrades)...");

while (time < 600000) { // Max 10 minutes
    time += dt;

    // Spawning
    if (time >= nextCatSpawn) {
        playerUnits.push({ type: 'cat', hp: catHP, nextAttack: time + catCooldown, x: 0 });
        nextCatSpawn += catSpawnRate;
    }
    if (time >= nextDogSpawn) {
        enemyUnits.push({ type: 'dog', hp: dogHP, nextAttack: time + dogCooldown, x: 800 });
        nextDogSpawn += dogSpawnRate;
    }

    // Movement
    playerUnits.forEach(u => {
        let nearestEnemy = enemyUnits.reduce((prev, curr) => (Math.abs(curr.x - u.x) < Math.abs(prev.x - u.x) ? curr : prev), enemyUnits[0]);
        if (nearestEnemy && Math.abs(nearestEnemy.x - u.x) > 20) {
            u.x += speed * (dt / 16);
        }
    });
    enemyUnits.forEach(u => {
        let nearestPlayer = playerUnits.reduce((prev, curr) => (Math.abs(curr.x - u.x) < Math.abs(prev.x - u.x) ? curr : prev), playerUnits[0]);
        if (u.type !== 'boss' && nearestPlayer && Math.abs(nearestPlayer.x - u.x) > 20) {
            u.x -= dogSpeed * (dt / 16);
        }
    });

    // Combat
    playerUnits.forEach(u => {
        if (time >= u.nextAttack) {
            let targets = enemyUnits.filter(e => Math.abs(e.x - u.x) <= 40); // Increased range for sim stability
            if (targets.length > 0) {
                let target = targets[0];
                target.hp -= u.type === 'leader' ? leaderDamage : catDamage;
                u.nextAttack = time + (u.type === 'leader' ? leaderCooldown : catCooldown);
            }
        }
    });

    enemyUnits.forEach(u => {
        if (time >= u.nextAttack) {
            let targets = playerUnits.filter(p => Math.abs(p.x - u.x) <= 40);
            if (targets.length > 0) {
                let target = targets[0];
                let dmg = u.type === 'boss' ? bossDamage : dogDamage;
                if (target.type === 'leader') dmg = Math.max(1, dmg - leaderDefense);
                target.hp -= dmg;
                u.nextAttack = time + (u.type === 'boss' ? bossCooldown : dogCooldown);
            }
        }
    });

    // Cleanup
    playerUnits = playerUnits.filter(u => u.hp > 0);
    enemyUnits = enemyUnits.filter(u => u.hp > 0);

    // Check Victory/Defeat
    if (!enemyUnits.some(u => u.type === 'boss')) {
        console.log(`Victory! Time: ${(time / 1000).toFixed(2)}s`);
        break;
    }
    if (!playerUnits.some(u => u.type === 'leader')) {
        console.log(`Defeat! Time: ${(time / 1000).toFixed(2)}s`);
        break;
    }
}
