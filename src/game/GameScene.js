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
        this.isPaused = false; 
        this.money = 200; 
        this.totalMoneyEarned = 200;
        this.level = 1;
        this.enemyLevel = (this.stage - 1) * 3 + 1; // Stage-based initial level
        this.stageTime = 0;
        this.battleTime = 0; // 게임 배속이 적용된 누적 시간
        this.processedEvents = new Set();
        this.gameSpeed = data?.speed || this.registry.get('gameSpeed') || 1;
        this.isAutoMode = true;
        this.isAutoBuy = true;
        
        // Load deck from squad data
        const squad = this.registry.get('squad') || { inventory: {}, deck: [null, null, null, null, null] };
        this.deck = squad.deck;
        this.spawnedDeckIndices = new Set();
        this.deckAutoSpawnTimer = 0;
        
        // Reset timeScale or apply passed speed
        this.time.timeScale = this.gameSpeed;
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

        this.level = 1;
        this.isGameOver = false;
        this.enemySpawnTimer = 0;
        this.allyAutoSpawnTimer = 0;
        this.spawnEnemy();
        this.spawnAlly('normal');

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

    spawnAlly(typeKey) {
        if (this.isGameOver) return;
        this.unitManager.spawnAlly(typeKey);
    }

    spawnDeckUnit(index) {
        if (this.isGameOver || this.spawnedDeckIndices.has(index)) return;
        
        const typeKey = this.deck[index];
        if (typeKey) {
            this.unitManager.spawnAlly(typeKey, 270, { deckIndex: index });
            this.spawnedDeckIndices.add(index);
            this.sys.game.events.emit('deck-unit-spawned', index);
        }
    }

    setAutoMode(val) {
        this.isAutoMode = val;
        // Reset timer when switching to auto mode to start spawning immediately or after a fresh second
        if (val) this.deckAutoSpawnTimer = 0;
    }

    setGameSpeed(val) {
        this.gameSpeed = val;
        // Also update Phaser's internal timeScale for tweens and particles
        this.time.timeScale = val;
    }

    retreat() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.sys.game.events.emit('game-over', 'defeat');
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

    // (Money removed, level system left alone as XP but deactivated from here if unused)

    // addEnemyExp removed to prevent enemy leveling during battle

    gainGlobalExp(amount, x = 400, y = 50) {
        if (this.isGameOver) return;
        
        const currentGlobal = this.registry.get('globalGold') || 0;
        this.registry.set('globalGold', currentGlobal + amount);
        
        // Visual indicator (optional but recommended for feedback)
        this.showFloatingText(`+${Math.floor(amount)} XP`, x, y, '#fbd46d');
    }

    showFloatingText(text, x, y, color) {
        const floatingText = this.add.text(x, y, text, {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            fill: color,
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5);

        this.tweens.add({
            targets: floatingText,
            y: y - 50,
            alpha: 0,
            duration: 1000,
            ease: 'Cubic.easeOut',
            onComplete: () => floatingText.destroy()
        });
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
        this.battleTime += scaledDelta;

        this.processStageEvents();
        
        const cannonProgress = this.skillManager.getCannonProgress();
        this.sys.game.events.emit('update-cannon', cannonProgress);

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

        // Auto spawn allies (minions) - ONLY Normal Cats (비실이)
        this.allyAutoSpawnTimer += scaledDelta;
        
        // Skill based spawn speed: Base 5000ms, decreases with level
        const skillLevels = this.registry.get('skillLevels') || { normal_cooldown: 1 };
        const baseAllyDelay = 4000;
        const allySpawnDelay = Math.max(800, baseAllyDelay - (skillLevels.normal_cooldown - 1) * 300);
        
        if (this.allyAutoSpawnTimer > allySpawnDelay) {
            this.spawnAlly('normal');
            this.allyAutoSpawnTimer = 0;
        }

        // Squad units (deck) are deployed manually via buttons.


        // Auto Fire Skills and Deploy Deck Units in Auto Mode
        if (this.isAutoMode) {
            this.fireShouting();

            // Auto spawn deck units every 1 second (game time)
            this.deckAutoSpawnTimer += scaledDelta;
            if (this.deckAutoSpawnTimer >= 1000) {
                const nextIdx = this.deck.findIndex((type, idx) => type !== null && !this.spawnedDeckIndices.has(idx));
                if (nextIdx !== -1) {
                    this.spawnDeckUnit(nextIdx);
                }
                this.deckAutoSpawnTimer = 0;
            }
        }

        // Delegate unit logic update (Pass custom battleTime for speed control)
        const gameResult = this.unitManager.updateUnits(this.battleTime, scaledDelta);
        if (gameResult && !this.isGameOver) {
            if (gameResult === 'victory') {
                const config = STAGE_CONFIG[this.stage];
                // Add reward to global gold immediately on victory
                const stageClearsBefore = this.registry.get('stageClears') || { 1: 0, 2: 0, 3: 0 };
                const clearCount = stageClearsBefore[this.stage] || 0;
                const clearRewardMultiplier = 1 + (clearCount * 0.02);
                
                const currentGlobal = this.registry.get('globalGold') || 0;
                const finalReward = Math.floor((config.clearReward || 0) * clearRewardMultiplier);
                
                this.registry.set('globalGold', currentGlobal + finalReward);

                // Update clear counts (Clone object to trigger registry change event)
                const stageClears = { ...stageClearsBefore };
                stageClears[this.stage] = clearCount + 1;
                this.registry.set('stageClears', stageClears);

                // Check for first time clear to show unlock notice
                if (clearCount === 0) {
                    const newlyUnlocked = Object.entries(ALLY_TYPES).find(([key, spec]) => spec.unlockStage === this.stage);
                    if (newlyUnlocked) {
                        this.sys.game.events.emit('unit-unlocked', {
                            key: newlyUnlocked[0],
                            name: newlyUnlocked[1].name,
                            stage: this.stage
                        });
                    }
                }

                // Start Victory UI (Minimized Production for Performance)
                this.isGameOver = true;
                // this.time.timeScale = 0.4; // 슬로우 모션 제거
                // this.effectManager.playVictoryCelebration(); // 연출 제거

                if (config && config.nextStage) {
                    this.time.delayedCall(200, () => { // 빠르게 모달 발생 (1000 -> 200)
                        this.time.timeScale = 1;
                        this.scene.pause();
                        this.sys.game.events.emit('stage-clear', { stage: this.stage, reward: finalReward });
                    });
                } else {
                    this.time.delayedCall(200, () => { // 빠르게 모달 발생 (1000 -> 200)
                        this.time.timeScale = 1;
                        this.sys.game.events.emit('game-over', 'victory', finalReward);
                    });
                }
            } else {
                // Defeat UI (Minimized Production for Performance)
                this.isGameOver = true;
                // this.time.timeScale = 0.5; // 슬로우 모션 제거
                this.effectManager.playDefeatEffect();
                
                this.time.delayedCall(200, () => { // 빠르게 모달 발생 (800 -> 200)
                    this.time.timeScale = 1;
                    this.sys.game.events.emit('game-over', gameResult);
                });
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

    proceedToNextStage() {
        const currentConfig = STAGE_CONFIG[this.stage];
        if (currentConfig && currentConfig.nextStage) {
            const nextStageNum = currentConfig.nextStage;
            this.changeStage(nextStageNum);
            this.sys.game.events.emit('stage-up', nextStageNum);
            
            // Clear existing units
            this.unitManager.clearField();
            
            this.unitManager.spawnBoss(false); // Spawn Next Stage Boss
            
            this.spawnEnemy();
            
            // Reset timers
            this.enemySpawnTimer = 0;
            this.allyAutoSpawnTimer = 0;
            
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

    shutdown() {
        // 씬 전환 시 모든 리소스를 정리합니다
        this.isGameOver = true;

        // BGM 정지
        if (this.bgm) {
            this.bgm.stop();
            this.bgm = null;
        }

        // 모든 유닛 파괴 (shadow, HP bar 포함)
        if (this.unitManager) {
            [...this.unitManager.allies, ...this.unitManager.enemies].forEach(unit => {
                unit.destroy();
            });
            this.unitManager.allies = [];
            this.unitManager.enemies = [];
        }

        // 진행 중인 모든 트윈 정지
        this.tweens.killAll();
    }
}
