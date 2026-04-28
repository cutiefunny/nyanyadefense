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
        this.enemySpawnCount = 0;
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

    spawnAlly(typeKey, yOffsetBase = 270, extraSpecs = {}) {
        const specs = ALLY_TYPES[typeKey];
        if (!specs) return null;

        const angleRad = Phaser.Math.DegToRad(5);
        const zOffset = Phaser.Math.Between(-150, 150);
        const yOffset = zOffset * Math.sin(angleRad);

        const unitLevels = this.scene.registry.get('unitLevels') || {};
        const level = unitLevels[typeKey] || 1;
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
            hp: specs.hp * healerLevelBonus,
            damage: specs.damage * healerLevelBonus,
            defense: finalDefense,
            cooldown: finalCooldown
        };

        const spriteKey = 'ally_' + typeKey;
        const ally = new Unit(this.scene, 0, yOffsetBase + yOffset, spriteKey, finalSpecs, true, this);

        
        this.allies.push(ally);
        return ally;
    }

    spawnEnemy(level, yOffsetBase = 270) {
        this.enemySpawnCount++;
        const enemyCount = ENEMY_TYPES.length;
        let typeChoice = 0;

        if (level >= 3 && this.enemySpawnCount % 5 === 0 && enemyCount >= 2) {
            typeChoice = Math.min(3, enemyCount - 1);
        } else {
            const rand = Phaser.Math.Between(1, 100);
            if (level >= 5 && enemyCount >= 3 && rand > 60 && rand <= 85) {
                typeChoice = 2;
            } else if (level >= 3 && enemyCount >= 2 && rand > 70) {
                typeChoice = 1;
            }
        }

        const specs = { ...(ENEMY_TYPES[typeChoice] || ENEMY_TYPES[0]) };
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
        const zOffset = Phaser.Math.Between(-150, 150);
        const yOffset = zOffset * Math.sin(angleRad);

        const spriteKey = 'enemy_' + specs.type;
        const enemy = new Unit(this.scene, 800, yOffsetBase + yOffset, spriteKey, specs, false, this);

        this.enemies.push(enemy);
        return enemy;
    }

    spawnBoss(isAlly) {
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
            spriteKey = 'ally_leader';
        } else {
            if (stageConfig.boss.isCustom) {
                specs = { 
                    ...stageConfig.boss,
                    attackCooldown: stageConfig.boss.cooldown || BOSS_CONFIG.boss.attackCooldown,
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

        const yOffset = 270;
        const boss = new Unit(this.scene, isAlly ? 50 : 750, yOffset, spriteKey, specs, isAlly, this);


        // Breathing animation effect
        this.addBreathingEffect(boss);

        if (isAlly) this.allies.push(boss);
        else this.enemies.push(boss);

        return boss;
    }

    clearField() {
        for (let i = this.allies.length - 1; i >= 0; i--) {
            const ally = this.allies[i];
            if (!ally.isBoss) {
                if (ally.shadow) ally.shadow.destroy();
                ally.destroy();
                this.allies.splice(i, 1);
            }
        }
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (enemy.shadow) enemy.shadow.destroy();
            if (enemy.hpBarBg) enemy.hpBarBg.destroy();
            if (enemy.hpBarFill) enemy.hpBarFill.destroy();
            enemy.destroy();
            this.enemies.splice(i, 1);
        }
    }

    getEnemyBoss() {
        return this.enemies.find(e => e.isBoss);
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

            this.scene.sound.play('ouch' + Phaser.Math.Between(1, 2), { volume: 0.5 });
            this.effectManager.playDeathEffect(unit);

            if (!isAlly && unit.reward) {
                this.scene.gainGlobalExp(unit.reward, unit.x, unit.y);
            }

            if (unit.isBoss) return isAlly ? 'defeat' : 'victory';
            
        }

        return null;
    }
}
