import Phaser from 'phaser';

import UnitManager from './UnitManager';
import EffectManager from './EffectManager';
import SkillManager from './SkillManager';

import bg_stage1_img from '../assets/backgrounds/sangsu.jpg';
import { ALLY_TYPES, ENEMY_TYPES } from './unitsConfig';

// Vite dynamic glob import for all unit png files
const unitImages = import.meta.glob('../assets/units/*.png', { eager: true, import: 'default' });

export default class GameScene extends Phaser.Scene {
    preload() {
        this.load.image('bg_stage1', bg_stage1_img);

        // Dynamically load all ally and enemy sprite sheets
        Object.keys(ALLY_TYPES).forEach(key => {
            const imgUrl = unitImages[`../assets/units/${key}.png`];
            if (imgUrl) this.load.spritesheet(`ally_${key}`, imgUrl, { frameWidth: 100, frameHeight: 100 });
        });

        ENEMY_TYPES.forEach(enemy => {
            const imgUrl = unitImages[`../assets/units/${enemy.type}.png`];
            if (imgUrl) this.load.spritesheet(`enemy_${enemy.type}`, imgUrl, { frameWidth: 100, frameHeight: 100 });
        });
    }

    constructor() {
        super('GameScene');
        this.money = 0;
        this.maxMoney = 1000;
        this.incomeRate = 10;
        this.isGameOver = false;
        this.enemySpawnTimer = 0;
        this.allyAutoSpawnTimer = 0;
        this.level = 1;
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Background Image
        const bg = this.add.image(400, 300, 'bg_stage1').setOrigin(0.5, 1).setDepth(-10).setAlpha(0.7);
        // Scale to fit width while maintaining aspect ratio
        const scale = 800 / bg.width;
        bg.setScale(scale);

        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, 800);
            const y = Phaser.Math.Between(0, 400);
            this.add.circle(x, y, Phaser.Math.Between(1, 4), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.4));
        }

        // Ground
        const angleRad = Phaser.Math.DegToRad(5);
        const fieldDepth = 300;
        const visibleHeight = Math.abs(fieldDepth * Math.sin(angleRad));

        this.playerBase = { isAlly: true };
        this.enemyBase = { isAlly: false };

        this.effectManager = new EffectManager(this);
        this.unitManager = new UnitManager(this, this.effectManager);
        this.skillManager = new SkillManager(this, this.unitManager);

        // Dynamically create animations for loaded allies
        Object.keys(ALLY_TYPES).forEach(key => {
            if (this.textures.exists(`ally_${key}`) && !this.anims.exists(`ally_${key}_idle`)) {
                this.anims.create({ key: `ally_${key}_idle`, frames: this.anims.generateFrameNumbers(`ally_${key}`, { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
                this.anims.create({ key: `ally_${key}_walk`, frames: this.anims.generateFrameNumbers(`ally_${key}`, { start: 1, end: 2 }), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `ally_${key}_attack`, frames: this.anims.generateFrameNumbers(`ally_${key}`, { start: 3, end: 3 }), frameRate: 10, repeat: 0 });
                this.anims.create({ key: `ally_${key}_hurt`, frames: this.anims.generateFrameNumbers(`ally_${key}`, { start: 4, end: 4 }), frameRate: 10, repeat: 0 });
            }
        });

        // Dynamically create animations for loaded enemies
        ENEMY_TYPES.forEach(enemy => {
            const key = enemy.type;
            if (this.textures.exists(`enemy_${key}`) && !this.anims.exists(`enemy_${key}_idle`)) {
                this.anims.create({ key: `enemy_${key}_idle`, frames: this.anims.generateFrameNumbers(`enemy_${key}`, { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
                this.anims.create({ key: `enemy_${key}_walk`, frames: this.anims.generateFrameNumbers(`enemy_${key}`, { start: 1, end: 2 }), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `enemy_${key}_attack`, frames: this.anims.generateFrameNumbers(`enemy_${key}`, { start: 3, end: 3 }), frameRate: 10, repeat: 0 });
                this.anims.create({ key: `enemy_${key}_hurt`, frames: this.anims.generateFrameNumbers(`enemy_${key}`, { start: 4, end: 4 }), frameRate: 10, repeat: 0 });
            }
        });

        this.money = 0;
        this.level = 1;
        this.isGameOver = false;
        this.enemySpawnTimer = 0;
        this.allyAutoSpawnTimer = 0;

        this.sys.game.events.emit('game-ready', this);
    }

    spawnAlly(typeKey, isAuto = false) {
        if (this.isGameOver) return;
        
        // Cost check logic remains in GameScene as it controls money
        // Hardcoded mapping removed. Look up directly from ALLY_TYPES.
        const cost = ALLY_TYPES[typeKey]?.cost || Infinity;

        if (isAuto || this.money >= cost) {
            if (!isAuto) this.money -= cost;
            this.unitManager.spawnAlly(typeKey);
        }
    }

    spawnEnemy() {
        if (this.isGameOver) return;
        this.unitManager.spawnEnemy(this.level);
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
        return false; // Heals logic removed for now as bases don't have HP
    }

    fireCannon() {
        if (this.isGameOver) return false;
        return this.skillManager.fireCannon();
    }

    update(time, delta) {
        if (this.isGameOver) return;

        if (this.money < this.maxMoney) {
            this.money += (this.incomeRate * delta / 1000);
            if (this.money > this.maxMoney) this.money = this.maxMoney;
        }
        this.sys.game.events.emit('update-money', Math.floor(this.money));

        const cannonProgress = this.skillManager.getCannonProgress();
        this.sys.game.events.emit('update-cannon', cannonProgress);

        // Auto spawn enemies
        this.enemySpawnTimer += delta;
        const spawnDelay = Math.max(800, 4000 - this.level * 350);
        if (this.enemySpawnTimer > spawnDelay) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }

        // Auto spawn allies (minions)
        this.allyAutoSpawnTimer += delta;
        const allySpawnDelay = 5000; // Every 5 seconds
        if (this.allyAutoSpawnTimer > allySpawnDelay) {
            this.spawnAlly('normal', true);
            this.allyAutoSpawnTimer = 0;
        }

        // Delegate unit logic update
        const gameResult = this.unitManager.updateUnits(time, delta);
        if (gameResult) {
            this.isGameOver = true;
            this.sys.game.events.emit('game-over', gameResult);
        }
    }
}
