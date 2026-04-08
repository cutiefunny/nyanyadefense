import Phaser from 'phaser';

export const ALLY_TYPES = {
    basic: { cost: 50, hp: 100, speed: 1.2, damage: 20, range: 10, cooldown: 1000, color: 0x43d8c9, w: 30, h: 30, name: 'Basic Square' },
    tank: { cost: 150, hp: 500, speed: 0.6, damage: 15, range: 15, cooldown: 1500, color: 0x3498db, w: 45, h: 45, name: 'Tank Block' },
    ranger: { cost: 200, hp: 60, speed: 1.0, damage: 35, range: 180, cooldown: 800, color: 0x9b59b6, w: 20, h: 40, name: 'Ranger Pillar' }
};

const ENEMY_TYPES = [
    { type: 'weak', hp: 60, speed: -0.8, damage: 10, range: 10, cooldown: 1200, color: 0xe94560, w: 30, h: 30 },
    { type: 'tank', hp: 300, speed: -0.4, damage: 15, range: 15, cooldown: 1800, color: 0xbdc3c7, w: 45, h: 45 },
    { type: 'runner', hp: 40, speed: -2.0, damage: 25, range: 10, cooldown: 600, color: 0xe67e22, w: 20, h: 20 }
];

export default class GameScene extends Phaser.Scene {
    preload() {
        this.load.spritesheet('ally_basic', '/src/assets/units/normal.png', { frameWidth: 100, frameHeight: 100 });
        this.load.spritesheet('ally_tank', '/src/assets/units/tanker.png', { frameWidth: 100, frameHeight: 100 });
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
        
        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, 800);
            const y = Phaser.Math.Between(0, 400);
            this.add.circle(x, y, Phaser.Math.Between(1, 4), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.4));
        }

        // Ground
        const angleRad = Phaser.Math.DegToRad(5);
        const fieldDepth = 300;
        const visibleHeight = Math.abs(fieldDepth * Math.sin(angleRad));

        this.add.rectangle(400, 525, 800, 150, 0x16213e).setDepth(0);
        // Field visually thickened to represent depth from the 5-degree angle
        this.add.rectangle(400, 450, 800, visibleHeight * 2, 0x0f3460).setDepth(1);

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
            if (typeKey === 'basic' || typeKey === 'tank') {
                const spriteKey = 'ally_' + typeKey;
                ally = this.add.sprite(100, 450 + yOffset, spriteKey).setOrigin(0.5, 1).setFlipX(true);
                if (typeKey === 'basic') {
                    ally.setScale(0.5);
                } else if (typeKey === 'tank') {
                    ally.setScale(0.7);
                }
                ally.play(spriteKey + '_walk');
                ally.isSprite = true;
                ally.spriteKey = spriteKey;
            } else {
                ally = this.add.rectangle(100, 450 + yOffset - specs.h/2, specs.w, specs.h, specs.color).setStrokeStyle(2, 0xffffff);
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
        const enemy = this.add.sprite(700, 450 + yOffset, spriteKey).setOrigin(0.5, 1).setScale(0.5);
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
                    const dist = Math.abs(unit.x - opp.x) - (unitW/2 + oppW/2);
                    if ((isAlly && opp.x > unit.x) || (!isAlly && opp.x < unit.x)) {
                        if (dist < minDist) {
                            minDist = dist;
                            target = opp;
                        }
                    }
                });

                const targetBaseW = targetBase.rect.width;
                const distToBase = Math.abs(unit.x - targetBase.rect.x) - (unitW/2 + targetBaseW/2);
                if ((isAlly && targetBase.rect.x > unit.x) || (!isAlly && targetBase.rect.x < unit.x)) {
                    if (distToBase < minDist) {
                        minDist = distToBase;
                        target = targetBase;
                    }
                }

                if (target && minDist <= unit.attackRange) {
                    // Attack stance tracking
                    if (unit.isSprite) {
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

                        if (target.isSprite && target.active && target.hp > 0) {
                            const hurtKey = `${target.spriteKey}_hurt`;
                            const idleKey = `${target.spriteKey}_idle`;
                            target.play(hurtKey, true);
                            target.once(`animationcomplete-${hurtKey}`, () => {
                                if (target.active && target.hp > 0) target.play(idleKey, true);
                            });
                        } else {
                            this.tweens.add({
                                targets: target.rect || target,
                                alpha: 0.5,
                                duration: 100,
                                yoyo: true,
                            });
                        }

                        let projectileType = isAlly ? 0x43d8c9 : 0xe94560;
                        if (unit.attackRange > 20) {
                            // ranged visual
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
                } else {
                    // Move
                    unit.x += unit.speed * (delta / 16);
                    if (unit.isSprite) {
                        const walkKey = `${unit.spriteKey}_walk`;
                        if (!unit.anims.currentAnim || unit.anims.currentAnim.key !== walkKey) {
                            unit.play(walkKey, true);
                        }
                    }
                }
            }
        });

        this.playerHpText.setText(`${Math.max(0, Math.floor(this.playerBase.hp))}/${this.playerBase.maxHp}`);
        this.enemyHpText.setText(`${Math.max(0, Math.floor(this.enemyBase.hp))}/${this.enemyBase.maxHp}`);
    }
}
