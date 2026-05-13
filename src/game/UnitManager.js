import Phaser from 'phaser';
import { ALLY_TYPES, ENEMY_TYPES, BOSS_CONFIG } from './unitsConfig';
import { STAGE_CONFIG } from './stagesConfig';
import Unit from './Unit';

export default class UnitManager {
    constructor(scene, effectManager) {
        this.scene = scene;
        this.effectManager = effectManager;
        this.allies = [];
        this.enemies = [];
        this.activeEnemyBosses = [];
        this.unitPool = [];
        this.enemySpawnCount = 0;
        this.allyDamageTaken = 0;
        this.enemyDamageTaken = 0;
    }

    getStageScaleMultiplier() {
        const config = STAGE_CONFIG[this.scene.stage];
        return config ? config.scaleMultiplier : 1.0;
    }

    updateAllUnitScales() {
        const multiplier = this.getStageScaleMultiplier();
        [...this.allies, ...this.enemies].forEach(unit => {
            if (unit.isSprite) {
                // Stop breathing tween if exists to prevent it from overriding vertical scale
                if (unit.breathingTween) {
                    unit.breathingTween.stop();
                    unit.breathingTween = null;
                }

                unit.setScale(unit.baseScale * multiplier);
                unit.logicWidth = (unit.baseWidth || 0) * multiplier;

                // Restart breathing for bosses
                if (unit.isBoss) {
                    this.addBreathingEffect(unit);
                }
            }
        });
    }

    addBreathingEffect(unit) {
        if (unit.breathingTween) unit.breathingTween.stop();
        unit.breathingTween = this.scene.tweens.add({
            targets: unit,
            scaleY: unit.scaleY * 1.05,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    getUnit(x, y, spriteKey, specs, isAlly) {
        let unit = this.unitPool.pop();
        if (unit) {
            unit.init(x, y, spriteKey, specs, isAlly);
        } else {
            unit = new Unit(this.scene, x, y, spriteKey, specs, isAlly, this);
        }
        return unit;
    }

    spawnAlly(typeKey, yOffsetBase = 270, extraSpecs = {}) {
        const specs = ALLY_TYPES[typeKey];
        if (!specs) return null;

        const angleRad = Phaser.Math.DegToRad(5);
        let zRange = 150;
        let yBaseAdjust = 0;
        if (this.scene.stage === 8) {
            zRange = 10; // Width 20px
            yBaseAdjust = 30; // 10 from previous + 20 more
        }
        const zOffset = Phaser.Math.Between(-zRange, zRange);
        const yOffset = zOffset * Math.sin(angleRad);

        const unitLevels = this.scene.registry.get('unitLevels') || {};
        const level = extraSpecs.level || unitLevels[typeKey] || 1;
        const levelBonus = 1 + (level - 1) * 0.2; // 20% HP/DMG bonus per level

        let finalDefense = specs.defense || 0;
        let finalCooldown = specs.cooldown;

        if (typeKey === 'tanker') {
            finalDefense += (level - 1) * 2; // +2 Defense per level
        } else if (typeKey === 'shooter') {
            // Increase attack speed by 5% per level (reduce cooldown)
            finalCooldown /= (1 + (level - 1) * 0.05);
        } else if (typeKey === 'healer') {
            // Increase heal speed by 10% per level
            finalCooldown /= (1 + (level - 1) * 0.1);
        }

        const healerLevelBonus = typeKey === 'healer' ? (1 + (level - 1) * 0.1) : levelBonus;

        const finalSpecs = {
            ...specs,
            ...extraSpecs,
            typeKey,
            level: level,
            hp: specs.hp * healerLevelBonus,
            damage: specs.damage * healerLevelBonus,
            defense: finalDefense,
            cooldown: finalCooldown
        };

        const spriteKey = extraSpecs.spriteKey || 'ally_' + typeKey;
        const ally = this.getUnit(0, yOffsetBase + yOffset + yBaseAdjust, spriteKey, finalSpecs, true);


        this.allies.push(ally);
        return ally;
    }

    spawnEnemy(level, yOffsetBase = 270) {
        this.enemySpawnCount++;
        const enemyCount = ENEMY_TYPES.length;
        let typeChoice = 0;

        let isBigWawa = false;
        if (this.scene.stage === 8) {
            typeChoice = ENEMY_TYPES.findIndex(e => e.type === 'gekko');
            if (typeChoice === -1) typeChoice = 0;
        } else if (this.scene.stage === 10) {
            typeChoice = ENEMY_TYPES.findIndex(e => e.type === 'wawa');
            if (typeChoice === -1) typeChoice = 0;

            // Intermittently spawn Big Chihuahua (approx every 15 enemies)
            if (this.enemySpawnCount > 0 && this.enemySpawnCount % 15 === 0) {
                isBigWawa = true;
            }
        } else if (level >= 3 && this.enemySpawnCount % 5 === 0 && enemyCount >= 2) {
            typeChoice = Math.min(3, enemyCount - 1);
        } else {
            const rand = Phaser.Math.Between(1, 100);
            if (level >= 5 && enemyCount >= 3 && rand > 60 && rand <= 85) {
                typeChoice = 2;
            } else if (level >= 3 && enemyCount >= 2 && rand > 70) {
                typeChoice = 1;
            }
        }

        // Validate choice against unlockStage (except for stage 8 which forces gekko)
        const chosenEnemy = ENEMY_TYPES[typeChoice] || ENEMY_TYPES[0];
        if (this.scene.stage !== 8 && chosenEnemy.unlockStage) {
            const stageClears = this.scene.registry.get('stageClears') || {};
            if (!(stageClears[chosenEnemy.unlockStage] > 0)) {
                typeChoice = 0; // Fallback to basic enemy if locked
            }
        }

        const specs = { ...(ENEMY_TYPES[typeChoice] || ENEMY_TYPES[0]) };

        if (isBigWawa) {
            specs.hp *= 5; // Much tougher
            specs.damage *= 2;
            specs.w *= 2;
            specs.h *= 2;
            specs.scale *= 2;
            specs.reward *= 10;
        }

        const stageConfig = STAGE_CONFIG[this.scene.stage];
        const traitMultiplier = stageConfig?.traits?.enemySpeedMultiplier || 1.0;

        const stageClears = this.scene.registry.get('stageClears') || { 1: 0, 2: 0, 3: 0 };
        const clearCount = stageClears[this.scene.stage] || 0;
        const clearBonus = 1 + (clearCount * 0.02);

        const scale = (1 + (level * 0.1)) * clearBonus;
        specs.hp *= scale;
        specs.damage *= scale;
        specs.reward = (specs.reward || 10) * clearBonus; // 보상도 10% 증가 (적 처치 보상)
        specs.speed *= traitMultiplier; // Apply stage trait

        const angleRad = Phaser.Math.DegToRad(5);
        let zRange = 150;
        let yBaseAdjust = 0;

        if (this.scene.stage === 8) {
            zRange = 10; // Width 20px (from -10 to 10)
            yBaseAdjust = 30; // Further lowered by 20px
        }

        const zOffset = Phaser.Math.Between(-zRange, zRange);
        const yOffset = zOffset * Math.sin(angleRad);

        const spriteKey = 'enemy_' + specs.type;
        const enemy = this.getUnit(800, yOffsetBase + yOffset + yBaseAdjust, spriteKey, specs, false);

        if (isBigWawa) {
            enemy.setTint(0xff8888); // Reddish tint to indicate power
            this.scene.showFloatingText('대왕 치와와 등장!!', 750, enemy.y - 80, '#ffcc00');
        }

        // If Heavy Metal (boss3 buff) is active, apply it to newly spawned enemies
        const boss3 = this.enemies.find(e => e.isBoss && e.typeKey === 'boss3' && e.active);
        if (boss3 && boss3.buffRemainingTime > 0) {
            enemy.buffRemainingTime = boss3.buffRemainingTime;
        }

        this.enemies.push(enemy);
        return enemy;
    }

    spawnBoss(isAlly, overrideX = null) {
        const stageConfig = STAGE_CONFIG[this.scene.stage];
        const type = isAlly ? 'leader' : 'boss';

        let specs;
        let spriteKey;

        if (isAlly) {
            specs = { ...BOSS_CONFIG.leader };
            const unitLevels = this.scene.registry.get('unitLevels') || {};
            const level = unitLevels['leader'] || 1;
            const levelBonus = 1 + (level - 1) * 0.2; // 20% bonus per level
            specs.hp *= levelBonus;
            specs.damage *= levelBonus;
            specs.level = level;
            spriteKey = 'ally_leader';
        } else {
            if (!stageConfig.boss) return null;
            if (stageConfig.boss.isCustom) {
                specs = {
                    ...BOSS_CONFIG.boss,
                    ...stageConfig.boss,
                    speed: 0
                };
                spriteKey = stageConfig.boss.spriteKey || 'enemy_boss';
            } else {
                specs = { ...BOSS_CONFIG.boss };
                if (stageConfig.boss.reward) specs.reward = stageConfig.boss.reward;
                spriteKey = 'enemy_boss';
            }
        }

        if (!isAlly) {
            const stageClears = this.scene.registry.get('stageClears') || { 1: 0, 2: 0, 3: 0 };
            const clearCount = stageClears[this.scene.stage] || 0;
            const clearBonus = 1 + (clearCount * 0.02);
            specs.hp *= clearBonus;
            specs.damage *= clearBonus;
        }

        let yOffset = specs.yOffset !== undefined ? specs.yOffset : 270;
        if (this.scene.stage === 8) {
            yOffset += 30;
        }
        const xPos = overrideX !== null ? overrideX : (isAlly ? 50 : 750);
        const boss = this.getUnit(xPos, yOffset, spriteKey, specs, isAlly);


        // Breathing animation effect
        this.addBreathingEffect(boss);

        if (isAlly) {
            this.allies.push(boss);
        } else {
            this.enemies.push(boss);
            this.activeEnemyBosses.push(boss);
        }

        return boss;
    }

    clearField() {
        for (let i = this.allies.length - 1; i >= 0; i--) {
            const ally = this.allies[i];
            if (!ally.isBoss) {
                ally.deactivate();
                this.unitPool.push(ally);
                this.allies.splice(i, 1);
            }
        }
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.deactivate();
            this.unitPool.push(enemy);
            this.enemies.splice(i, 1);
        }
        this.activeEnemyBosses = [];
    }

    getEnemyBoss() {
        return this.activeEnemyBosses.length > 0 ? this.activeEnemyBosses[0] : undefined;
    }

    updateUnits(time, delta) {
        let gameOverResult = null;

        // Update Allies
        for (let i = this.allies.length - 1; i >= 0; i--) {
            const result = this.handleUnitUpdate(this.allies[i], time, delta, this.enemies, i, true);
            if (result === 'victory') return 'victory';
            if (result === 'defeat') return 'defeat';
        }

        // Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const result = this.handleUnitUpdate(this.enemies[i], time, delta, this.allies, i, false);
            if (result === 'victory') return 'victory';
            if (result === 'defeat') return 'defeat';
        }

        return gameOverResult;
    }

    handleUnitUpdate(unit, time, delta, opponents, index, isAlly) {
        const updateResult = unit.update(time, delta, opponents);

        if (updateResult === 'dead') {
            const group = isAlly ? this.allies : this.enemies;
            group.splice(index, 1);

            if (!isAlly && unit.isBoss) {
                const bossIndex = this.activeEnemyBosses.indexOf(unit);
                if (bossIndex > -1) this.activeEnemyBosses.splice(bossIndex, 1);
            }

            this.scene.sound.play('ouch' + Phaser.Math.Between(1, 2), { volume: 0.5 });
            this.effectManager.playDeathEffect(unit);
            
            // Raccoon Respawn Logic
            if (isAlly && unit.specs && unit.specs.canRespawn && unit.deckIndex !== undefined) {
                const deckIndex = unit.deckIndex;
                const typeKey = unit.typeKey;
                const level = unit.specs.level;
                let timeLeft = 10;
                
                this.scene.sys.game.events.emit('unit-respawn-countdown', { index: deckIndex, timeLeft });

                this.scene.time.addEvent({
                    delay: 1000,
                    repeat: 9,
                    callback: () => {
                        timeLeft--;
                        this.scene.sys.game.events.emit('unit-respawn-countdown', { index: deckIndex, timeLeft });
                        
                        if (timeLeft <= 0) {
                            if (this.scene && this.scene.scene.isActive()) {
                                this.spawnAlly(typeKey, 270, { level: level, deckIndex: deckIndex });
                                this.scene.showFloatingText('부활!', 100, 270, '#8d6e63');
                                // Signal that respawn is complete
                                this.scene.sys.game.events.emit('unit-respawn-countdown', { index: deckIndex, timeLeft: -1 });
                            }
                        }
                    }
                });
            }

            if (!isAlly && unit.reward) {
                this.scene.gainGlobalExp(unit.reward, unit.x, unit.y);
            }

            if (unit.isBoss) {
                if (isAlly) return 'defeat';
                
                // 적 보스가 죽었을 때, 전장에 다른 적 보스가 더 있는지 확인
                if (this.activeEnemyBosses.length === 0) {
                    this.scene.sys.game.events.emit('boss-dead');
                    return 'victory';
                }
            }

        }

        return null;
    }

    recycleUnit(unit) {
        unit.deactivate();
        this.unitPool.push(unit);
    }
}
