import Phaser from 'phaser';

import { ALLY_TYPES, ENEMY_TYPES } from './unitsConfig';

export default class GameScene extends Phaser.Scene {
    preload() {
        this.load.image('bg_stage1', '/src/assets/backgrounds/sangsu.jpg');
        this.load.spritesheet('ally_basic', '/src/assets/units/normal.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('ally_tank', '/src/assets/units/tanker.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('ally_ranger', '/src/assets/units/shooter.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('enemy_dog', '/src/assets/units/dog.png', { frameWidth: 100, frameHeight: 100 });
    }

    constructor() {
        super('GameScene');
        this.allies = [];
        this.enemies = [];
        this.money = 0;
        this.maxMoney = 1000;
        this.incomeRate = 10;
        this.isGameOver = false;
        this.enemySpawnTimer = 0;
        this.level = 1;

        // Cannon
        this.cannonCooldown = 15000; // 15 seconds
        this.lastCannonTime = -15000;
        this.baseMaxHp = 1000;
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Background Image
        this.add.image(400, 240, 'bg_stage1').setDisplaySize(800, 480).setDepth(-10).setAlpha(0.7).set

        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, 800);
            const y = Phaser.Math.Between(0, 400);
            this.add.circle(x, y, Phaser.Math.Between(1, 4), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.4));
        }

        // Ground
        const angleRad = Phaser.Math.DegToRad(5);
        const fieldDepth = 300;
        const visibleHeight = Math.abs(fieldDepth * Math.sin(angleRad));

        //this.add.rectangle(400, 525, 800, 150, 0x16213e).setDepth(0);
        // Field visually thickened to represent depth from the 5-degree angle
        //this.add.rectangle(400, 450, 800, visibleHeight * 2, 0x0f3460).setDepth(1);

        this.playerBase = {
            rect: this.add.rectangle(60, 390, 60, 120, 0x0f3460).setStrokeStyle(4, 0x43d8c9).setDepth(450),
            hp: this.baseMaxHp,
            maxHp: this.baseMaxHp,
            isAlly: true
        };

        this.enemyBase = {
            rect: this.add.rectangle(740, 390, 60, 120, 0xe94560).setStrokeStyle(4, 0xffb8b8).setDepth(450),
            hp: 2000,
            maxHp: 2000,
            isAlly: false
        };

        this.playerHpText = this.add.text(60, 310, `${this.baseMaxHp}`, { fontFamily: 'Outfit, sans-serif', fontSize: '24px', fill: '#43d8c9', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2000);
        this.enemyHpText = this.add.text(740, 310, '2000', { fontFamily: 'Outfit, sans-serif', fontSize: '24px', fill: '#e94560', fontStyle: 'bold' }).setOrigin(0.5).setDepth(2000);

        // Cannon visual
        this.cannonBeam = this.add.rectangle(400, 435, 800, 40, 0x43d8c9).setAlpha(0).setDepth(2000);

        if (!this.anims.exists('ally_basic_idle')) {
            this.anims.create({ key: 'ally_basic_idle', frames: this.anims.generateFrameNumbers('ally_basic', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'ally_basic_walk', frames: this.anims.generateFrameNumbers('ally_basic', { start: 1, end: 2 }), frameRate: 6, repeat: -1 });
            this.anims.create({ key: 'ally_basic_attack', frames: this.anims.generateFrameNumbers('ally_basic', { start: 3, end: 3 }), frameRate: 10, repeat: 0 });
            this.anims.create({ key: 'ally_basic_hurt', frames: this.anims.generateFrameNumbers('ally_basic', { start: 4, end: 4 }), frameRate: 10, repeat: 0 });
        }
        if (!this.anims.exists('ally_tank_idle')) {
            this.anims.create({ key: 'ally_tank_idle', frames: this.anims.generateFrameNumbers('ally_tank', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'ally_tank_walk', frames: this.anims.generateFrameNumbers('ally_tank', { start: 1, end: 2 }), frameRate: 6, repeat: -1 });
            this.anims.create({ key: 'ally_tank_attack', frames: this.anims.generateFrameNumbers('ally_tank', { start: 3, end: 3 }), frameRate: 10, repeat: 0 });
            this.anims.create({ key: 'ally_tank_hurt', frames: this.anims.generateFrameNumbers('ally_tank', { start: 4, end: 4 }), frameRate: 10, repeat: 0 });
        }
        if (!this.anims.exists('ally_ranger_idle')) {
            this.anims.create({ key: 'ally_ranger_idle', frames: this.anims.generateFrameNumbers('ally_ranger', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'ally_ranger_walk', frames: this.anims.generateFrameNumbers('ally_ranger', { start: 1, end: 2 }), frameRate: 6, repeat: -1 });
            this.anims.create({ key: 'ally_ranger_attack', frames: this.anims.generateFrameNumbers('ally_ranger', { start: 3, end: 3 }), frameRate: 10, repeat: 0 });
            this.anims.create({ key: 'ally_ranger_hurt', frames: this.anims.generateFrameNumbers('ally_ranger', { start: 4, end: 4 }), frameRate: 10, repeat: 0 });
        }
        if (!this.anims.exists('enemy_dog_idle')) {
            this.anims.create({ key: 'enemy_dog_idle', frames: this.anims.generateFrameNumbers('enemy_dog', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'enemy_dog_walk', frames: this.anims.generateFrameNumbers('enemy_dog', { start: 1, end: 2 }), frameRate: 6, repeat: -1 });
            this.anims.create({ key: 'enemy_dog_attack', frames: this.anims.generateFrameNumbers('enemy_dog', { start: 3, end: 3 }), frameRate: 10, repeat: 0 });
            this.anims.create({ key: 'enemy_dog_hurt', frames: this.anims.generateFrameNumbers('enemy_dog', { start: 4, end: 4 }), frameRate: 10, repeat: 0 });
        }

        this.allies = [];
        this.enemies = [];
        this.money = 0;
        this.level = 1;
        this.isGameOver = false;

        this.sys.game.events.emit('game-ready', this);
    }

    spawnAlly(typeKey) {
        const specs = ALLY_TYPES[typeKey];
        if (!specs || this.isGameOver) return;

        if (this.money >= specs.cost) {
            this.money -= specs.cost;
            const angleRad = Phaser.Math.DegToRad(5);
            const zOffset = Phaser.Math.Between(-150, 150);
            const yOffset = zOffset * Math.sin(angleRad);

            let ally;
            if (typeKey === 'basic' || typeKey === 'tank' || typeKey === 'ranger') {
                const spriteKey = 'ally_' + typeKey;
                ally = this.add.sprite(100, 450 + yOffset, spriteKey).setOrigin(0.5, 1).setFlipX(true);
                if (typeKey === 'basic') {
                    ally.setScale(0.5);
                } else if (typeKey === 'tank') {
                    ally.setScale(0.7);
                } else if (typeKey === 'ranger') {
                    ally.setScale(0.5);
                }
                ally.play(spriteKey + '_walk');
                ally.isSprite = true;
                ally.spriteKey = spriteKey;
            } else {
                ally = this.add.rectangle(100, 450 + yOffset - specs.h / 2, specs.w, specs.h, specs.color).setStrokeStyle(2, 0xffffff);
            }
            ally.setDepth(450 + yOffset);
            ally.isAlly = true;
            ally.typeKey = typeKey;
            ally.logicWidth = specs.w;
            Object.assign(ally, {
                hp: specs.hp,
                maxHp: specs.hp,
                speed: specs.speed,
                attackDamage: specs.damage,
                attackRange: specs.range,
                attackCooldown: specs.cooldown,
                lastAttackTime: 0
            });

            ally.hpBarBg = this.add.rectangle(ally.x, ally.y - 60, 40, 6, 0x000000).setDepth(2000);
            ally.hpBarFill = this.add.rectangle(ally.x - 20, ally.y - 60, 40, 4, 0x2ecc71).setDepth(2001).setOrigin(0, 0.5);

            this.allies.push(ally);
        }
    }

    spawnEnemy() {
        if (this.isGameOver) return;

        // Choose enemy type based on level
        let typeChoice = 0; // basic
        const rand = Phaser.Math.Between(1, 100);
        if (this.level >= 3 && rand > 70) typeChoice = 1; // 30% chance heavy after lv3
        if (this.level >= 5 && rand > 60 && rand <= 85) typeChoice = 2; // 25% chance fast after lv5

        const specs = ENEMY_TYPES[typeChoice];

        const angleRad = Phaser.Math.DegToRad(5);
        const zOffset = Phaser.Math.Between(-150, 150);
        const yOffset = zOffset * Math.sin(angleRad);

        const spriteKey = 'enemy_dog';
        const enemy = this.add.sprite(700, 450 + yOffset, spriteKey).setOrigin(0.5, 1).setScale(0.6);
        enemy.play(spriteKey + '_walk');
        enemy.setDepth(450 + yOffset);
        enemy.isAlly = false;
        enemy.logicWidth = specs.w;
        enemy.isSprite = true;
        enemy.spriteKey = spriteKey;

        const scale = 1 + (this.level * 0.1); // difficulty scaling

        Object.assign(enemy, {
            hp: specs.hp * scale,
            maxHp: specs.hp * scale,
            speed: specs.speed,
            attackDamage: specs.damage * scale,
            attackRange: specs.range,
            attackCooldown: specs.cooldown,
            lastAttackTime: 0
        });

        enemy.hpBarBg = this.add.rectangle(enemy.x, enemy.y - 60, 40, 6, 0x000000).setDepth(2000);
        enemy.hpBarFill = this.add.rectangle(enemy.x - 20, enemy.y - 60, 40, 4, 0xe74c3c).setDepth(2001).setOrigin(0, 0.5);

        this.enemies.push(enemy);
    }

    upgradeIncome() {
        const cost = 100 + this.level * 50;
        if (this.money >= cost && !this.isGameOver) {
            this.money -= cost;
            this.incomeRate += 5;
            this.maxMoney += 500; // Increase capacity too
            this.level += 1;
            this.sys.game.events.emit('level-up', this.level);
            return true;
        }
        return false;
    }

    healBase() {
        const cost = 100;
        if (this.money >= cost && this.playerBase.hp < this.playerBase.maxHp && !this.isGameOver) {
            this.money -= cost;
            this.playerBase.hp = Math.min(this.playerBase.maxHp, this.playerBase.hp + 200);

            // Healing effect
            const flash = this.add.rectangle(400, 300, 800, 600, 0x2ecc71).setAlpha(0.3).setDepth(2000);
            this.tweens.add({
                targets: flash,
                alpha: 0,
                duration: 500,
                onComplete: () => flash.destroy()
            });
            return true;
        }
        return false;
    }

    fireCannon() {
        if (this.time.now - this.lastCannonTime >= this.cannonCooldown && !this.isGameOver) {
            this.lastCannonTime = this.time.now;

            // Visual effect
            this.cannonBeam.setAlpha(1);
            this.tweens.add({
                targets: this.cannonBeam,
                alpha: 0,
                duration: 600,
                ease: 'Power2'
            });

            // Logic: Damage all enemies on screen
            this.enemies.forEach(enemy => {
                enemy.hp -= 200 + (this.level * 50);
            });

            this.cameras.main.shake(300, 0.01);
            return true;
        }
        return false;
    }

    update(time, delta) {
        if (this.isGameOver) return;

        if (this.playerBase.hp <= 0) {
            this.isGameOver = true;
            this.sys.game.events.emit('game-over', 'defeat');
            return;
        }

        if (this.enemyBase.hp <= 0) {
            this.isGameOver = true;
            this.sys.game.events.emit('game-over', 'victory');
            return;
        }

        if (this.money < this.maxMoney) {
            this.money += (this.incomeRate * delta / 1000);
            if (this.money > this.maxMoney) this.money = this.maxMoney;
        }
        this.sys.game.events.emit('update-money', Math.floor(this.money));

        const cannonReady = (time - this.lastCannonTime >= this.cannonCooldown);
        const cannonProgress = cannonReady ? 100 : Math.floor(((time - this.lastCannonTime) / this.cannonCooldown) * 100);
        this.sys.game.events.emit('update-cannon', cannonProgress);

        // Auto spawn enemies
        this.enemySpawnTimer += delta;
        // spawn faster as level increases, but don't spawn faster than 800ms
        const spawnDelay = Math.max(800, 4000 - this.level * 350);
        if (this.enemySpawnTimer > spawnDelay) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }

        // Unit logic
        [this.allies, this.enemies].forEach((group, isAllyIdx) => {
            const isAlly = isAllyIdx === 0;
            for (let i = group.length - 1; i >= 0; i--) {
                const unit = group[i];

                if (unit.hp <= 0) {
                    if (unit.hpBarBg) this.add.tween({ targets: unit.hpBarBg, alpha: 0, duration: 200, onComplete: () => unit.hpBarBg.destroy() });
                    if (unit.hpBarFill) this.add.tween({ targets: unit.hpBarFill, alpha: 0, duration: 200, onComplete: () => unit.hpBarFill.destroy() });
                    this.add.tween({
                        targets: unit,
                        alpha: 0,
                        scale: 1.5,
                        duration: 200,
                        onComplete: () => unit.destroy()
                    });
                    group.splice(i, 1);
                    continue;
                }

                let target = null;
                let minDist = Infinity;

                const opponents = isAlly ? this.enemies : this.allies;
                const targetBase = isAlly ? this.enemyBase : this.playerBase;

                const unitW = unit.logicWidth || unit.width || 0;
                opponents.forEach(opp => {
                    const oppW = opp.logicWidth || opp.width || 0;
                    const dist = Math.abs(unit.x - opp.x) - (unitW / 2 + oppW / 2);
                    if ((isAlly && opp.x > unit.x) || (!isAlly && opp.x < unit.x)) {
                        if (dist < minDist) {
                            minDist = dist;
                            target = opp;
                        }
                    }
                });

                const targetBaseW = targetBase.rect.width;
                const distToBase = Math.abs(unit.x - targetBase.rect.x) - (unitW / 2 + targetBaseW / 2);
                if ((isAlly && targetBase.rect.x > unit.x) || (!isAlly && targetBase.rect.x < unit.x)) {
                    if (distToBase < minDist) {
                        minDist = distToBase;
                        target = targetBase;
                    }
                }

                let desiredMove = 1; // Default: forward
                if (target) {
                    if (unit.typeKey === 'ranger') {
                        // Skirmish logic: stay between 110 and 170 units away
                        if (minDist < 110) desiredMove = -1; // Retreat
                        else if (minDist > 170) desiredMove = 1; // Advance
                        else desiredMove = 0; // Sweet spot
                    } else if (minDist <= unit.attackRange) {
                        desiredMove = 0; // Normal units stop and attack
                    }
                }

                // Handle Movement
                let actuallyMoving = false;
                if (desiredMove !== 0) {
                    let moveAmount = unit.speed * (delta / 16) * desiredMove;
                    // Clamp retreat to avoid going behind base
                    if (desiredMove === -1) {
                        if (isAlly && unit.x + moveAmount < 100) moveAmount = 0;
                        if (!isAlly && unit.x + moveAmount > 700) moveAmount = 0;
                    }

                    if (moveAmount !== 0) {
                        unit.x += moveAmount;
                        actuallyMoving = true;
                        if (unit.isSprite) {
                            const walkKey = `${unit.spriteKey}_walk`;
                            if (!unit.anims.currentAnim || unit.anims.currentAnim.key !== walkKey) {
                                unit.play(walkKey, true);
                            }
                        }
                    }
                }

                if (target && minDist <= unit.attackRange) {
                    // Attack stance tracking: if staying still, make sure idle is playing before attack
                    if (!actuallyMoving && unit.isSprite) {
                        const walkKey = `${unit.spriteKey}_walk`;
                        const idleKey = `${unit.spriteKey}_idle`;
                        if (unit.anims.currentAnim && unit.anims.currentAnim.key === walkKey) {
                            unit.play(idleKey, true);
                        }
                    }

                    // Perform Attack
                    if (time - unit.lastAttackTime >= unit.attackCooldown) {
                        target.hp -= unit.attackDamage;
                        unit.lastAttackTime = time;

                        const targetVisual = target.rect || target;

                        // 1. Spawning a hit spark particle
                        const spark = this.add.star(targetVisual.x + (Math.random() - 0.5) * 30, targetVisual.y - 30 + (Math.random() - 0.5) * 30, 4, 3, 10, 0xffeb3b).setDepth(3000);
                        this.tweens.add({
                            targets: spark,
                            scale: Math.random() * 1.5 + 1,
                            alpha: 0,
                            angle: Phaser.Math.Between(-90, 90),
                            duration: 150,
                            onComplete: () => spark.destroy()
                        });

                        // 2. Flash white quickly
                        if (target.isSprite && targetVisual.active) {
                            targetVisual.setTintFill(0xffffff);
                            this.time.delayedCall(40, () => {
                                if (targetVisual.active) targetVisual.clearTint();
                            });
                        }

                        // 3. Vibration (Wobble Angle)
                        this.tweens.add({
                            targets: targetVisual,
                            angle: (Math.random() > 0.5 ? 1 : -1) * 8,
                            yoyo: true,
                            duration: 50,
                            onComplete: () => {
                                if (targetVisual.active) targetVisual.angle = 0;
                            }
                        });

                        // 4. Subtle screen shake for heavy hits
                        if (unit.attackDamage >= 20) {
                            this.cameras.main.shake(40, 0.002);
                        }

                        if (target.isSprite && target.active && target.hp > 0) {
                            const hurtKey = `${target.spriteKey}_hurt`;
                            const idleKey = `${target.spriteKey}_idle`;
                            target.play(hurtKey, true);
                            target.once(`animationcomplete-${hurtKey}`, () => {
                                if (target.active && target.hp > 0) target.play(idleKey, true);
                            });
                        } else {
                            this.tweens.add({
                                targets: targetVisual,
                                alpha: 0.5,
                                duration: 100,
                                yoyo: true,
                            });
                        }

                        // Ranged visual: No projectile for 'ranger' (instant hitscan feel)
                        if (unit.attackRange > 20 && unit.typeKey !== 'ranger') {
                            // Standard projectile for other ranged units
                            let projectileType = isAlly ? 0x43d8c9 : 0xe94560;
                            const proj = this.add.circle(unit.x, unit.y, 4, projectileType).setDepth(2000);
                            this.tweens.add({
                                targets: proj,
                                x: target.rect ? target.rect.x : target.x,
                                y: target.rect ? target.rect.y : target.y,
                                duration: 150,
                                onComplete: () => proj.destroy()
                            });
                        }

                        // Attack animation vs lean tween
                        if (unit.isSprite) {
                            const attackKey = `${unit.spriteKey}_attack`;
                            const idleKey = `${unit.spriteKey}_idle`;
                            unit.play(attackKey, true);
                            unit.once(`animationcomplete-${attackKey}`, () => {
                                if (unit.active && unit.hp > 0) unit.play(idleKey, true);
                            });
                        } else {
                            this.tweens.add({
                                targets: unit,
                                x: unit.x + (isAlly ? 8 : -8),
                                duration: 80,
                                yoyo: true,
                            });
                        }
                    }
                }

                if (unit.hpBarBg && unit.hpBarFill) {
                    unit.hpBarBg.x = unit.x;
                    unit.hpBarBg.y = unit.y - 60;
                    unit.hpBarFill.x = unit.x - 20;
                    unit.hpBarFill.y = unit.y - 60;
                    unit.hpBarFill.width = Math.max(0, 40 * (unit.hp / unit.maxHp));
                }
            }
        });

        this.playerHpText.setText(`${Math.max(0, Math.floor(this.playerBase.hp))}/${this.playerBase.maxHp}`);
        this.enemyHpText.setText(`${Math.max(0, Math.floor(this.enemyBase.hp))}/${this.enemyBase.maxHp}`);
    }
}
