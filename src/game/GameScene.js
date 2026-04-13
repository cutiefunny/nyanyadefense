import Phaser from 'phaser';

import UnitManager from './UnitManager';
import EffectManager from './EffectManager';
import SkillManager from './SkillManager';

import { ALLY_TYPES, ENEMY_TYPES } from './unitsConfig';
import { STAGE_CONFIG } from './stagesConfig';

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

        // Load Boss Assets (Support boss.png, boss2.png, boss3.png, etc.)
        Object.keys(unitImages).forEach(path => {
            const match = path.match(/boss(\d*)\.png$/);
            if (match) {
                const suffix = match[1];
                const key = `enemy_boss${suffix}`;
                this.load.spritesheet(key, unitImages[path], { frameWidth: 200, frameHeight: 200 });
            }
        });
        
        const leaderUrl = unitImages['../assets/units/leader.png'];
        if (leaderUrl) this.load.spritesheet('ally_leader', leaderUrl, { frameWidth: 100, frameHeight: 100 });
    }

    init(data) {
        this.stage = data?.stage || 1;
        this.isGameOver = false;
        this.isPaused = false; // Start unpaused for now, or true if App handles start
        this.money = 200; // Starting gold
        this.totalMoneyEarned = 200;
        this.level = 1;
        this.enemyLevel = 1;
        this.totalEnemyExp = 0;
        this.stageTime = 0;
        this.processedEvents = new Set();
        this.gameSpeed = 1;
        
        // Reset timeScale if it was changed
        this.time.timeScale = 1;
    }


    constructor() {
        super('GameScene');
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

        // Dynamically create animations for ALL units including potential stage bosses
        const allUnitKeys = [
            ...Object.keys(ALLY_TYPES).map(k => `ally_${k}`),
            ...ENEMY_TYPES.map(e => `enemy_${e.type}`),
            'ally_leader',
            'enemy_boss',
            'enemy_boss2',
            'enemy_boss3'
        ];

        allUnitKeys.forEach(key => this.createUnitAnimations(key));

        this.totalMoneyEarned = 0;
        this.level = 1;
        this.enemyLevel = 1;
        this.totalEnemyExp = 0;
        this.isGameOver = false;
        this.enemySpawnTimer = 0;
        this.allyAutoSpawnTimer = 0;

        this.sys.game.events.emit('game-ready', this);
    }

    createUnitAnimations(key) {
        if (!this.textures.exists(key) || this.anims.exists(`${key}_idle`)) return;

        const isBossSprite = key.includes('boss');
        const frameConfig = isBossSprite ? { walk: [0, 1], attack: [0, 1], hurt: [0, 1] } : { walk: [1, 2], attack: [3, 3], hurt: [4, 4] };

        this.anims.create({ key: `${key}_idle`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: `${key}_walk`, frames: this.anims.generateFrameNumbers(key, { start: frameConfig.walk[0], end: frameConfig.walk[1] }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: `${key}_attack`, frames: this.anims.generateFrameNumbers(key, { start: frameConfig.attack[0], end: frameConfig.attack[1] }), frameRate: 8, repeat: 0 });
        this.anims.create({ key: `${key}_hurt`, frames: this.anims.generateFrameNumbers(key, { start: frameConfig.hurt[0], end: frameConfig.hurt[1] }), frameRate: 8, repeat: 0 });
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

    setAutoMode(val) {
        this.isAutoMode = val;
    }

    setAutoBuy(val) {
        this.isAutoBuy = val;
    }

    setGameSpeed(val) {
        this.gameSpeed = val;
        // Also update Phaser's internal timeScale for tweens and particles
        this.time.timeScale = val;
    }

    instantWin() {
        if (this.isGameOver) return;
        const enemyBoss = this.unitManager.enemies.find(e => e.isBoss);
        if (enemyBoss) {
            enemyBoss.takeDamage(enemyBoss.hp + 9999, true);
        }
    }

    changeStage(stageNum) {
        this.stage = stageNum;
        const config = STAGE_CONFIG[stageNum];
        if (!config) return;

        const textureKey = config.background;
        if (this.textures.exists(textureKey)) {
            this.bg.setTexture(textureKey);
            const scale = 800 / this.bg.width;
            this.bg.setScale(scale);
        }
        // Update all existing units to match the new stage's scale multiplier
        this.unitManager.updateAllUnitScales();
        
        // Reset stage timer and processed events
        this.stageTime = 0;
        this.processedEvents.clear();
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

        // Apply game speed multiplier to delta for custom logic
        const scaledDelta = delta * this.gameSpeed;
        this.stageTime += scaledDelta;

        this.processStageEvents();
        
        this.sys.game.events.emit('update-money', Math.floor(this.money));

        const cannonProgress = this.skillManager.getCannonProgress();
        this.sys.game.events.emit('update-cannon', cannonProgress);

        // Auto Buy AI
        if (this.isAutoBuy && !this.isGameOver) {
            this.updateAutoBuyLogic(scaledDelta);
        }

        // Auto spawn enemies
        this.enemySpawnTimer += scaledDelta;
        
        const config = STAGE_CONFIG[this.stage];
        const spawnRateMultiplier = config?.traits?.spawnRateMultiplier || 1.0;
        
        // 수정: 적의 스폰 속도는 플레이어의 level이 아닌 enemyLevel(난이도)에 비례하도록 변경하며, 스테이지 특성을 반영합니다.
        const baseSpawnDelay = Math.max(800, 4000 - this.enemyLevel * 350);
        const spawnDelay = baseSpawnDelay / spawnRateMultiplier;
        
        if (this.enemySpawnTimer > spawnDelay) {
            this.spawnEnemy();
            this.enemySpawnTimer = 0;
        }

        // Auto spawn allies (minions)
        this.allyAutoSpawnTimer += scaledDelta;
        const allySpawnDelay = 5000; // Every 5 seconds
        if (this.allyAutoSpawnTimer > allySpawnDelay) {
            this.spawnAlly('normal', true);
            this.allyAutoSpawnTimer = 0;
        }

        // Auto Fire Skills in Auto Mode
        if (this.isAutoMode) {
            this.fireShouting();
        }

        // Delegate unit logic update
        const gameResult = this.unitManager.updateUnits(time, scaledDelta);
        if (gameResult) {
            if (gameResult === 'victory') {
                const config = STAGE_CONFIG[this.stage];
                
                // Add reward to global gold immediately on victory
                const currentGlobal = this.registry.get('globalGold') || 0;
                this.registry.set('globalGold', currentGlobal + (config.clearReward || 0));

                if (config && config.nextStage) {
                    this.scene.pause();
                    this.sys.game.events.emit('stage-clear', { stage: this.stage, reward: config.clearReward });
                } else {
                    this.isGameOver = true;
                    this.sys.game.events.emit('game-over', 'victory');
                }
            } else {

                this.isGameOver = true;
                this.sys.game.events.emit('game-over', gameResult);
            }
        }
    }

    processStageEvents() {
        const config = STAGE_CONFIG[this.stage];
        if (!config || !config.events) return;

        config.events.forEach((event, index) => {
            const eventId = `${this.stage}_${index}`;
            if (this.processedEvents.has(eventId)) return;

            if (this.stageTime >= (event.time || 0)) {
                this.processedEvents.add(eventId);
                this.handleEvent(event);
            }
        });
    }

    handleEvent(event) {
        switch (event.type) {
            case 'warning':
                this.sys.game.events.emit('stage-event', { type: 'warning', message: event.message });
                // Also show a temporary text in the middle of the screen
                const text = this.add.text(400, 200, event.message, {
                    fontSize: '32px',
                    fill: '#ff0000',
                    fontStyle: 'bold',
                    stroke: '#000',
                    strokeThickness: 6
                }).setOrigin(0.5);
                
                this.tweens.add({
                    targets: text,
                    alpha: 0,
                    y: 150,
                    duration: 3000,
                    onComplete: () => text.destroy()
                });
                break;
            case 'spawn_swarm':
                const count = event.details?.count || 5;
                for (let i = 0; i < count; i++) {
                    this.time.delayedCall(i * 200, () => this.spawnEnemy());
                }
                break;
        }
    }

    updateAutoBuyLogic(delta) {
        // Run AI decision roughly every 0.5s to avoid spamming
        this.autoBuyTimer = (this.autoBuyTimer || 0) + delta;
        if (this.autoBuyTimer < 500) return;
        this.autoBuyTimer = 0;

        const tankerCount = this.unitManager.allies.filter(a => a.typeKey === 'tanker').length;
        const shooterCount = this.unitManager.allies.filter(a => a.typeKey === 'shooter').length;
        const normalCount = this.unitManager.allies.filter(a => a.typeKey === 'normal').length;
        const totalCount = tankerCount + shooterCount + normalCount;

        // Efficiency/Strategic Logic:
        // 1. Tanker Check: Need at least 1 tanker per 5 units, or if enemy is close
        const leader = this.unitManager.allies.find(a => a.isBoss);
        let enemyNear = false;
        if (leader) {
            enemyNear = this.unitManager.enemies.some(e => Math.abs(e.x - leader.x) < 300);
        }

        if (this.money >= ALLY_TYPES.tanker.cost && (tankerCount < 1 || (enemyNear && tankerCount < totalCount / 3))) {
            this.spawnAlly('tanker');
        } 
        // 2. Shooter Check: Maintain a good ratio for DPS
        else if (this.money >= ALLY_TYPES.shooter.cost && (shooterCount < normalCount || shooterCount < 2)) {
            this.spawnAlly('shooter');
        }
    }

    proceedToNextStage() {
        const currentConfig = STAGE_CONFIG[this.stage];
        if (currentConfig && currentConfig.nextStage) {
            // 보상 지급 (전투용 캐쉬)
            if (currentConfig.clearReward) {
                this.addMoney(currentConfig.clearReward);
            }



            const nextStageNum = currentConfig.nextStage;
            this.changeStage(nextStageNum);
            this.sys.game.events.emit('stage-up', nextStageNum);
            
            // Clear existing units
            this.unitManager.clearField();
            
            this.unitManager.spawnBoss(false); // Spawn Next Stage Boss
            
            // Heal the ally leader and reset position
            const leader = this.unitManager.allies.find(a => a.isBoss);
            if (leader) {
                leader.hp = leader.maxHp;
                leader.x = 50; 
                
                // Ensure states are reset when moving to next stage
                leader.isDragging = false;
                delete leader.targetX;
                leader.stunRemainingTime = 0;
                leader.buffRemainingTime = 0;
                
                if (leader.isSprite) {
                    leader.clearTint();
                    leader.setScale(leader.baseScale * this.unitManager.getStageScaleMultiplier());
                }
            }
            
            this.scene.resume();
        }
    }
}
