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
const itemImages = import.meta.glob('../assets/items/*.png', { eager: true, import: 'default' });

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
                const fWidth = 200; // All bosses use 200x200 except mortar
                const fHeight = 200;
                this.load.spritesheet(key, unitImages[path], { frameWidth: fWidth, frameHeight: fHeight });
            }
        });

        const leaderUrl = unitImages['../assets/units/leader.png'];
        if (leaderUrl) this.load.spritesheet('ally_leader', leaderUrl, { frameWidth: 100, frameHeight: 100 });

        const mouseUrl = unitImages['../assets/units/mouse.png'];
        if (mouseUrl) this.load.spritesheet('bg_mouse', mouseUrl, { frameWidth: 100, frameHeight: 65 });

        const canonUrl = unitImages['../assets/units/canon.png'];
        if (canonUrl) this.load.spritesheet('ally_mortar', canonUrl, { frameWidth: 200, frameHeight: 200 });

        const shieldUrl = itemImages['../assets/items/shield.png'];
        if (shieldUrl) this.load.image('item_shield', shieldUrl);
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
        let squad = this.registry.get('squad') || { inventory: [], deck: [null] };
        if (!Array.isArray(squad.inventory)) squad.inventory = [];
        if (squad.deck && squad.deck.length > 0 && typeof squad.deck[0] === 'string') {
            squad.deck = squad.deck.map(t => t ? { type: t, level: 1 } : null);
        }
        this.deck = squad.deck;
        this.spawnedDeckIndices = new Set();
        this.mortarGroupIndices = []; // Array of arrays: [[0,1,2], ...]
        this.tankerComboIndices = []; // Array of arrays: [[0,1], ...]

        const usedIndices = new Set();

        // Check for 3 consecutive shooters in the deck
        for (let i = 0; i <= this.deck.length - 3; i++) {
            if (!usedIndices.has(i) && !usedIndices.has(i+1) && !usedIndices.has(i+2) &&
                this.deck[i]?.type === 'shooter' && 
                this.deck[i+1]?.type === 'shooter' && 
                this.deck[i+2]?.type === 'shooter') {
                const group = [i, i+1, i+2];
                this.mortarGroupIndices.push(group);
                group.forEach(idx => usedIndices.add(idx));
                i += 2; // Skip to next possible group
            }
        }
        // Flatten for registry/UI compatibility
        this.registry.set('mortarGroupIndices', this.mortarGroupIndices.flat());

        // Check for 2 consecutive tankers in the deck
        for (let i = 0; i <= this.deck.length - 2; i++) {
            if (!usedIndices.has(i) && !usedIndices.has(i+1) &&
                this.deck[i]?.type === 'tanker' && 
                this.deck[i+1]?.type === 'tanker') {
                const group = [i, i+1];
                this.tankerComboIndices.push(group);
                group.forEach(idx => usedIndices.add(idx));
                i += 1; // Skip to next possible group
            }
        }
        // Flatten for registry/UI compatibility
        this.registry.set('tankerComboIndices', this.tankerComboIndices.flat());

        this.deckAutoSpawnTimer = 0;
        this.mouseSpawnTimer = 0;
        this.currentMouse = null;

        // Reset timeScale or apply passed speed
        this.time.timeScale = this.gameSpeed;
        this.runGold = 0;
    }


    constructor() {
        super('GameScene');
    }


    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Create a simple circle texture for particles
        const circleGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        circleGraphics.fillStyle(0xffffff);
        circleGraphics.fillCircle(8, 8, 8);
        circleGraphics.generateTexture('circle_particle', 16, 16);

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
        if (this.stage !== 5) {
            this.unitManager.spawnBoss(false); // Enemy Boss
        }

        // Spawn Mortar Groups if exist (Merge 3 shooters into 1 Mortar)
        this.mortarGroupIndices.forEach(indices => {
            const cardObj = this.deck[indices[0]];
            
            // Spawn only ONE unit for the 3-unit combo
            const mortar = this.unitManager.spawnAlly(cardObj.type, 270, { 
                deckIndex: indices[0], 
                level: cardObj.level || 1,
                isMortarMode: true,
                spriteKey: 'ally_mortar'
            });

            if (mortar) {
                mortar.x = 50;
                mortar.maxHp *= 3;
                mortar.hp = mortar.maxHp;
                mortar.attackDamage *= 3;
            }

            // Mark all three as spawned and notify UI
            indices.forEach(idx => {
                this.spawnedDeckIndices.add(idx);
                this.sys.game.events.emit('deck-unit-spawned', idx);
            });
            
            // Show a special notification
            this.showFloatingText('박격포병 배치!', 400, 150, '#9b59b6');
        });

        // Spawn Tanker Combos if exist
        this.tankerComboIndices.forEach(indices => {
            const idx1 = indices[0];
            const idx2 = indices[1];
            const card1 = this.deck[idx1];
            const card2 = this.deck[idx2];

            // Calculate defense based on levels
            const getDefense = (type, level) => {
                const specs = ALLY_TYPES[type];
                let def = specs.defense || 0;
                if (type === 'tanker') def += (level - 1) * 2;
                return def;
            };

            const def1 = getDefense('tanker', card1.level || 1);
            const def2 = getDefense('tanker', card2.level || 1);

            const tank = this.unitManager.spawnAlly('tanker', 270, {
                deckIndex: idx1, // Use first index
                level: Math.max(card1.level || 1, card2.level || 1),
                isDoubleDoorTank: true,
                defense1: def1,
                defense2: def2
            });

            if (tank) {
                tank.maxHp *= 2;
                tank.hp = tank.maxHp;
            }
            
            this.spawnedDeckIndices.add(idx1);
            this.spawnedDeckIndices.add(idx2);
            this.sys.game.events.emit('deck-unit-spawned', idx1);
            this.sys.game.events.emit('deck-unit-spawned', idx2);

            this.showFloatingText('양문형 탱크 배치!', 400, 120, '#3498db');
        });

        // Enable Drag to move for Ally Leader
        leader.setInteractive({ draggable: true });
        leader.on('dragstart', () => {
            leader.isDragging = true;
        });
        leader.on('drag', (pointer, dragX, dragY) => {
            const enemyBoss = this.unitManager.getEnemyBoss();
            if (enemyBoss) {
                leader.targetX = Math.min(dragX, enemyBoss.x);
            } else {
                leader.targetX = dragX;
            }
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
            'ally_mortar'
        ];

        // Add stage-specific bosses to animation keys
        Object.keys(STAGE_CONFIG).forEach(stageId => {
            const boss = STAGE_CONFIG[stageId].boss;
            if (boss && boss.spriteKey) {
                allUnitKeys.push(boss.spriteKey);
            }
        });

        allUnitKeys.forEach(key => this.createUnitAnimations(key));

        if (this.textures.exists('bg_mouse') && !this.anims.exists('bg_mouse_walk')) {
            this.anims.create({ key: 'bg_mouse_walk', frames: this.anims.generateFrameNumbers('bg_mouse', { start: 0, end: 1 }), frameRate: 8, repeat: -1 });
        }

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
        const isMortar = key === 'ally_mortar';
        
        let frameConfig;
        if (key === 'enemy_boss6') {
            // New boss6 mapping: 0: idle, 1: attack, 2: hurt
            frameConfig = { walk: [0, 0], attack: [1, 1], hurt: [2, 2] };
        } else if (isBossSprite) {
            frameConfig = { walk: [0, 1], attack: [0, 1], hurt: [0, 1] };
        } else if (isMortar) {
            // Mortar: Frame 0 = idle/walk, Frame 1 = attack, Frame 2 = hurt
            frameConfig = { walk: [0, 0], attack: [1, 1], hurt: [2, 2] };
        } else {
            frameConfig = { walk: [1, 2], attack: [3, 3], hurt: [4, 4] };
        }

        this.anims.create({ key: `${key}_idle`, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 0 }), frameRate: 1, repeat: -1 });
        this.anims.create({ key: `${key}_walk`, frames: this.anims.generateFrameNumbers(key, { start: frameConfig.walk[0], end: frameConfig.walk[1] }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: `${key}_attack`, frames: this.anims.generateFrameNumbers(key, { start: frameConfig.attack[0], end: frameConfig.attack[1] }), frameRate: 8, repeat: 0 });
        this.anims.create({ key: `${key}_hurt`, frames: this.anims.generateFrameNumbers(key, { start: frameConfig.hurt[0], end: frameConfig.hurt[1] }), frameRate: 8, repeat: 0 });
    }

    spawnMouse() {
        if (this.isGameOver) return;

        // Ensure only one mouse at a time (Limit: 2마리 이상 동시에 돌아다니지 않게)
        if (this.currentMouse && this.currentMouse.active) return;

        // Ground Area: y is roughly 250 to 290 based on unit spawn logic.
        const startX = Phaser.Math.Between(50, 750);
        const startY = Phaser.Math.Between(250, 290);

        const stageMultiplier = this.unitManager.getStageScaleMultiplier();
        const mouse = this.add.sprite(startX, startY, 'bg_mouse').setOrigin(0.3, 1).setScale(0.3 * stageMultiplier);
        this.currentMouse = mouse;
        const shadow = this.add.ellipse(startX, startY, 30 * stageMultiplier, 8 * stageMultiplier, 0x000000, 0.2).setDepth(mouse.depth - 0.1);

        if (this.anims.exists('bg_mouse_walk')) {
            mouse.play({ key: 'bg_mouse_walk', frameRate: 12, repeat: -1 });
        }

        mouse.setDepth(startY - 5);
        mouse.setInteractive({ useHandCursor: true });

        // Wandering logic
        let moveCount = 0;
        const maxMoves = Phaser.Math.Between(4, 7);

        const moveRandomly = () => {
            if (!mouse.active || this.isGameOver) return;

            if (moveCount >= maxMoves) {
                // Run away off screen
                const exitLeft = mouse.x < 400;
                const exitX = exitLeft ? -50 : 850;
                mouse.setFlipX(!exitLeft);
                if (mouse.anims.currentAnim && !mouse.anims.isPlaying) {
                    mouse.play({ key: 'bg_mouse_walk', frameRate: 16, repeat: -1 });
                }

                this.tweens.add({
                    targets: [mouse, shadow],
                    x: exitX,
                    duration: 2000,
                    onComplete: () => {
                        if (mouse.active) mouse.destroy();
                        if (shadow.active) shadow.destroy();
                    }
                });
                return;
            }

            // Pick a new random point (X only now)
            const targetX = Phaser.Math.Between(50, 750);
            const dist = Math.abs(targetX - mouse.x);

            // Adjust facing
            mouse.setFlipX(targetX > mouse.x);

            if (mouse.anims.currentAnim && !mouse.anims.isPlaying) {
                mouse.play({ key: 'bg_mouse_walk', frameRate: 12, repeat: -1 });
            }

            const speed = 100; // pixels per second
            const duration = (dist / speed) * 1000;

            this.tweens.add({
                targets: [mouse, shadow],
                x: targetX,
                duration: duration,
                ease: 'Linear',
                onComplete: () => {
                    if (!mouse.active) return;
                    moveCount++;
                    // Pause for a bit
                    mouse.stop();
                    // Optional: set to idle frame if there's one, or just freeze at frame 0
                    mouse.setFrame(0);

                    this.time.delayedCall(Phaser.Math.Between(500, 1500), moveRandomly);
                }
            });
        };

        // Start wandering
        moveRandomly();

        mouse.once('pointerdown', () => {
            if (!mouse.active) return;

            const leader = this.unitManager.allies.find(u => u.isBoss && u.isAlly && u.hp > 0);
            if (leader) {
                const healAmount = leader.maxHp * 0.25;
                leader.hp = Math.min(leader.maxHp, leader.hp + healAmount);

                const healText = this.add.text(leader.x, leader.y - leader.displayHeight - 10, `+25% HP`, {
                    fontSize: '20px', fontFamily: 'Arial Black', fill: '#2ecc71', stroke: '#000', strokeThickness: 3
                }).setOrigin(0.5).setDepth(3000);

                this.tweens.add({
                    targets: healText,
                    y: healText.y - 30,
                    alpha: 0,
                    duration: 1200,
                    ease: 'Sine.easeOut',
                    onComplete: () => healText.destroy()
                });
            }

            // Mouse clicked effect
            this.effectManager.hitEmitter.emitParticleAt(mouse.x, mouse.y - 32, 6);
            this.sound.play('hit1', { volume: 0.3 });

            mouse.disableInteractive();
            this.tweens.killTweensOf([mouse, shadow]); // Stop movement immediately
            this.tweens.add({
                targets: [mouse, shadow],
                scaleX: 0,
                scaleY: 0,
                duration: 100,
                onComplete: () => {
                    if (mouse.active) mouse.destroy();
                    if (shadow.active) shadow.destroy();
                }
            });
        });
    }

    spawnAlly(typeKey) {
        if (this.isGameOver) return;
        this.unitManager.spawnAlly(typeKey);
    }

    spawnDeckUnit(index) {
        if (this.isGameOver || this.spawnedDeckIndices.has(index)) return;

        const cardObj = this.deck[index];
        if (cardObj && cardObj.type) {
            this.unitManager.spawnAlly(cardObj.type, 270, { deckIndex: index, level: cardObj.level || 1 });
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
        this.sys.game.events.emit('game-over', 'retreat', this.runGold || 0);
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

        const intAmount = Math.floor(amount);
        this.runGold = (this.runGold || 0) + intAmount;
        
        const currentGlobal = this.registry.get('globalGold') || 0;
        this.registry.set('globalGold', currentGlobal + intAmount);

        // Visual indicator
        this.showFloatingText(`+${intAmount} 냥`, x, y, '#fbd46d');
    }

    showFloatingText(text, x, y, color = '#ff0000', isDescending = false) {
        if (!this.active) return;
        const floatingText = this.add.text(x, y, text, {
            fontSize: '18px',
            fill: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            fontFamily: 'Arial'
        }).setOrigin(0.5).setDepth(5000);

        this.tweens.add({
            targets: floatingText,
            y: isDescending ? y + 50 : y - 50,
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
            if (this.stage !== 5 && this.stage !== 6) {
                this.spawnEnemy();
            }
            this.enemySpawnTimer = 0;
        }

        // Auto spawn allies (minions) - ONLY Normal Cats (비실이)
        this.allyAutoSpawnTimer += scaledDelta;

        // Auto spawn mouse (Active Play Benefit)
        this.mouseSpawnTimer += scaledDelta;
        if (this.mouseSpawnTimer >= 10000) {
            this.mouseSpawnTimer -= 10000;
            // 50% chance to attempt spawn
            if (Math.random() < 0.5) {
                this.spawnMouse();
            }
        }

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
                const nextIdx = this.deck.findIndex((card, idx) => card !== null && card.type !== undefined && !this.spawnedDeckIndices.has(idx));
                if (nextIdx !== -1) {
                    this.spawnDeckUnit(nextIdx);
                }
                this.deckAutoSpawnTimer = 0;
            }
        }

        // Emit HP updates for allies periodically (every 100ms)
        if (!this.hpUpdateTimer) this.hpUpdateTimer = 0;
        this.hpUpdateTimer += scaledDelta;
        if (this.hpUpdateTimer >= 100) {
            const allyHPs = {};
            this.unitManager.allies.forEach(ally => {
                if (ally.deckIndex !== undefined) {
                    const hpPercent = Math.max(0, ally.hp / ally.maxHp);
                    allyHPs[ally.deckIndex] = hpPercent;
                }
            });
            this.sys.game.events.emit('update-ally-hps', allyHPs);
            this.hpUpdateTimer = 0;
        }

        // Delegate unit logic update (Pass custom battleTime for speed control)
        const gameResult = this.unitManager.updateUnits(this.battleTime, scaledDelta);
        if (gameResult && !this.isGameOver) {
            if (gameResult === 'victory') {
                const config = STAGE_CONFIG[this.stage];
                // Add reward to global gold immediately on victory
                const stageClearsBefore = this.registry.get('stageClears') || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                const clearCount = stageClearsBefore[this.stage] || 0;
                const clearRewardMultiplier = 1 + (clearCount * 0.02);

                const currentGlobal = this.registry.get('globalGold') || 0;
                const finalReward = Math.floor((config.clearReward || 0) * clearRewardMultiplier);

                this.registry.set('globalGold', currentGlobal + finalReward);

                // Update clear counts (Clone object to trigger registry change event)
                const stageClears = { ...stageClearsBefore };
                stageClears[this.stage] = clearCount + 1;
                this.registry.set('stageClears', stageClears);

                // Draw 1 random unlocked unit card
                let rewardLevel = 1;
                let rewardCount = 1;
                const maxClearedStage = Object.keys(stageClears).reduce((max, s) => stageClears[s] > 0 ? Math.max(max, parseInt(s)) : max, 0);
                const unlockedTypes = ['leader', ...Object.keys(ALLY_TYPES)].filter(t => t === 'leader' || (ALLY_TYPES[t] && (ALLY_TYPES[t].unlockStage || 0) <= maxClearedStage));
                
                const newlyUnlocked = Object.entries(ALLY_TYPES).find(([key, spec]) => spec.unlockStage === this.stage);
                let drawnCardKey = '';
                
                if (unlockedTypes.length > 0) {
                    const randomType = (clearCount === 0 && newlyUnlocked) ? newlyUnlocked[0] : Phaser.Utils.Array.GetRandom(unlockedTypes);
                    let squad = this.registry.get('squad') || { inventory: [], deck: [] };
                    if (!Array.isArray(squad.inventory)) squad.inventory = [];
                    
                    if (this.stage === 2) rewardLevel = Phaser.Math.Between(1, 2);
                    else if (this.stage === 3) rewardLevel = 2;
                    else if (this.stage === 4) rewardLevel = Phaser.Math.Between(2, 3);
                    else if (this.stage === 5) rewardLevel = 3;

                    if (randomType === 'leader' || randomType === 'normal') {
                        rewardCount = Math.pow(2, rewardLevel - 1);
                        for (let i = 0; i < rewardCount; i++) {
                            squad.inventory.push({ type: randomType, level: 1 });
                        }
                        rewardLevel = 1; 
                    } else {
                        rewardCount = 1;
                        squad.inventory.push({ type: randomType, level: rewardLevel });
                    }

                    this.registry.set('squad', squad);
                    localStorage.setItem('nyanya_squad', JSON.stringify(squad));
                    drawnCardKey = randomType;
                }

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

                if (config && config.nextStage) {
                    this.time.delayedCall(200, () => { 
                        this.time.timeScale = 1;
                        this.scene.pause();
                        this.sys.game.events.emit('stage-clear', { stage: this.stage, reward: finalReward, drawnCard: drawnCardKey, drawnCardLevel: rewardLevel, drawnCardCount: rewardCount });
                    });
                } else {
                    this.time.delayedCall(200, () => { 
                        this.time.timeScale = 1;
                        this.sys.game.events.emit('game-over', 'victory', finalReward, drawnCardKey, rewardLevel, rewardCount);
                    });
                }
            } else {
                // Defeat UI (Minimized Production for Performance)
                this.isGameOver = true;
                // this.time.timeScale = 0.5; // 슬로우 모션 제거
                this.effectManager.playDefeatEffect();

                this.time.delayedCall(200, () => { // 빠르게 모달 발생 (800 -> 200)
                    this.time.timeScale = 1;
                    this.sys.game.events.emit('game-over', gameResult, this.runGold || 0);
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
            case 'spawn_boss':
                this.unitManager.spawnBoss(false, event.details?.x);
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
