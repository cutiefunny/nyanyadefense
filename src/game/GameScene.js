import Phaser from 'phaser';

import UnitManager from './UnitManager';
import EffectManager from './EffectManager';
import SkillManager from './SkillManager';

import { ALLY_TYPES, ENEMY_TYPES } from './unitsConfig';

import hit1_sound from '../assets/sounds/Hit1.wav';
import hit2_sound from '../assets/sounds/Hit2.wav';
import hit3_sound from '../assets/sounds/Hit3.wav';

import ouch1_sound from '../assets/sounds/Ouch1.mp3';
import ouch2_sound from '../assets/sounds/Ouch2.mp3';

import bgm_level1 from '../assets/sounds/level1.mp3';

// Vite dynamic glob import for all unit png files
const unitImages = import.meta.glob('../assets/units/*.png', { eager: true, import: 'default' });
const bgImages = import.meta.glob('../assets/backgrounds/stage*.jpg', { eager: true, import: 'default' });

export default class GameScene extends Phaser.Scene {
    preload() {
        Object.keys(bgImages).forEach(path => {
            const match = path.match(/stage(\d+)\.jpg$/);
            if (match) {
                this.load.image(`bg_stage${match[1]}`, bgImages[path]);
            }
        });

        this.load.audio('hit1', hit1_sound);
        this.load.audio('hit2', hit2_sound);
        this.load.audio('hit3', hit3_sound);

        this.load.audio('ouch1', ouch1_sound);
        this.load.audio('ouch2', ouch2_sound);

        this.load.audio('bgm_level1', bgm_level1);

        // Dynamically load all ally and enemy sprite sheets
        Object.keys(ALLY_TYPES).forEach(key => {
            const imgUrl = unitImages[`../assets/units/${key}.png`];
            if (imgUrl) this.load.spritesheet(`ally_${key}`, imgUrl, { frameWidth: 100, frameHeight: 100 });
        });

        ENEMY_TYPES.forEach(enemy => {
            const imgUrl = unitImages[`../assets/units/${enemy.type}.png`];
            if (imgUrl) this.load.spritesheet(`enemy_${enemy.type}`, imgUrl, { frameWidth: 100, frameHeight: 100 });
        });

        // Load Boss Assets
        const bossUrl = unitImages['../assets/units/boss.png'];
        if (bossUrl) this.load.spritesheet('enemy_boss', bossUrl, { frameWidth: 200, frameHeight: 200 });
        
        const leaderUrl = unitImages['../assets/units/leader.png'];
        if (leaderUrl) this.load.spritesheet('ally_leader', leaderUrl, { frameWidth: 100, frameHeight: 100 });
    }

    constructor() {
        super('GameScene');
        this.money = 0;
        this.totalMoneyEarned = 0;
        this.isGameOver = false;
        this.enemySpawnTimer = 0;
        this.allyAutoSpawnTimer = 0;
        this.level = 1;
        this.stage = 1;
        this.enemyLevel = 1;
        this.totalEnemyExp = 0;
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Play BGM
        this.bgm = this.sound.add('bgm_level1', { loop: true, volume: 0.3 });
        // this.bgm.play();

        // Background Image
        this.bg = this.add.image(400, 300, `bg_stage${this.stage}`).setOrigin(0.5, 1).setDepth(-10).setAlpha(0.7);
        // Scale to fit width while maintaining aspect ratio
        const scale = 800 / this.bg.width;
        this.bg.setScale(scale);

        for (let i = 0; i < 50; i++) {
            const x = Phaser.Math.Between(0, 800);
            const y = Phaser.Math.Between(0, 400);
            this.add.circle(x, y, Phaser.Math.Between(1, 4), 0xffffff, Phaser.Math.FloatBetween(0.1, 0.4));
        }

        // Ground
        const angleRad = Phaser.Math.DegToRad(5);
        const fieldDepth = 300;
        const visibleHeight = Math.abs(fieldDepth * Math.sin(angleRad));

        this.effectManager = new EffectManager(this);
        this.unitManager = new UnitManager(this, this.effectManager);
        this.skillManager = new SkillManager(this, this.unitManager);

        // Spawn Bosses (Objective Units)
        const leader = this.unitManager.spawnBoss(true); // Ally Leader
        this.unitManager.spawnBoss(false); // Enemy Boss

        // Enable Drag to move for Ally Leader
        leader.setInteractive({ draggable: true });
        leader.on('dragstart', () => {
            leader.isDragging = true;
        });
        leader.on('drag', (pointer, dragX, dragY) => {
            leader.targetX = dragX;
        });
        leader.on('dragend', () => {
            leader.isDragging = false;
            delete leader.targetX;
        });

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

        // Add Boss/Leader specific animations
        if (this.textures.exists('ally_leader') && !this.anims.exists('ally_leader_idle')) {
            this.anims.create({ key: 'ally_leader_idle', frames: this.anims.generateFrameNumbers('ally_leader', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'ally_leader_walk', frames: this.anims.generateFrameNumbers('ally_leader', { start: 1, end: 2 }), frameRate: 6, repeat: -1 });
            this.anims.create({ key: 'ally_leader_attack', frames: this.anims.generateFrameNumbers('ally_leader', { start: 3, end: 3 }), frameRate: 10, repeat: 0 });
            this.anims.create({ key: 'ally_leader_hurt', frames: this.anims.generateFrameNumbers('ally_leader', { start: 4, end: 4 }), frameRate: 10, repeat: 0 });
        }

        if (this.textures.exists('enemy_boss') && !this.anims.exists('enemy_boss_idle')) {
            this.anims.create({ key: 'enemy_boss_idle', frames: this.anims.generateFrameNumbers('enemy_boss', { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
            this.anims.create({ key: 'enemy_boss_walk', frames: this.anims.generateFrameNumbers('enemy_boss', { start: 1, end: 1 }), frameRate: 6, repeat: -1 });
            this.anims.create({ key: 'enemy_boss_attack', frames: this.anims.generateFrameNumbers('enemy_boss', { start: 1, end: 1 }), frameRate: 10, repeat: 0 });
            this.anims.create({ key: 'enemy_boss_hurt', frames: this.anims.generateFrameNumbers('enemy_boss', { start: 1, end: 1 }), frameRate: 10, repeat: 0 });
        }

        this.totalMoneyEarned = 0;
        this.level = 1;
        this.enemyLevel = 1;
        this.totalEnemyExp = 0;
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

    changeStage(stageNum) {
        this.stage = stageNum;
        const textureKey = `bg_stage${stageNum}`;
        if (this.textures.exists(textureKey)) {
            this.bg.setTexture(textureKey);
            const scale = 800 / this.bg.width;
            this.bg.setScale(scale);
        }
    }

    spawnEnemy() {
        if (this.isGameOver) return;
        this.unitManager.spawnEnemy(this.enemyLevel);
    }

    addMoney(amount) {
        if (this.isGameOver) return;
        this.money += amount;
        this.totalMoneyEarned += amount;
        
        // Automatic Level Up Logic (LoL style)
        // For example, level 2 requires 100 total money, level 3 requires 300, etc.
        const requiredMoneyForNextLevel = 100 + (this.level * this.level * 50);
        
        if (this.totalMoneyEarned >= requiredMoneyForNextLevel) {
            this.level += 1;
            this.sys.game.events.emit('level-up', this.level);
        }
    }

    addEnemyExp(amount) {
        if (this.isGameOver) return;
        this.totalEnemyExp += amount;
        
        const requiredExpForNextLevel = 100 + (this.enemyLevel * this.enemyLevel * 50);
        
        if (this.totalEnemyExp >= requiredExpForNextLevel) {
            this.enemyLevel += 1;
        }
    }

    healBase() {
        return false; // Heals logic removed for now as bases don't have HP
    }

    fireShouting() {
        if (this.isGameOver) return false;
        return this.skillManager.useShouting();
    }

    update(time, delta) {
        if (this.isGameOver) return;
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
            if (gameResult === 'victory' && this.stage === 1) {
                this.scene.pause();
                this.sys.game.events.emit('stage-clear', { stage: 1, reward: 500 });
            } else {
                this.isGameOver = true;
                this.sys.game.events.emit('game-over', gameResult);
            }
        }
    }

    proceedToNextStage() {
        if (this.stage === 1) {
            this.changeStage(2);
            this.sys.game.events.emit('stage-up', 2);
            
            // Clear existing units
            this.unitManager.clearField();
            
            this.unitManager.spawnBoss(false); // Spawn Stage 2 Boss
            
            // Heal the ally leader and reset position
            const leader = this.unitManager.allies.find(a => a.isBoss);
            if (leader) {
                leader.hp = leader.maxHp;
                leader.x = 50; 
            }
            
            this.scene.resume();
        }
    }
}
