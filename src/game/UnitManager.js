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

    spawnAlly(typeKey, yOffsetBase = 270) {
        const specs = ALLY_TYPES[typeKey];
        if (!specs) return null;

        const angleRad = Phaser.Math.DegToRad(5);
        const zOffset = Phaser.Math.Between(-150, 150);
        const yOffset = zOffset * Math.sin(angleRad);

        const spriteKey = 'ally_' + typeKey;
        const ally = new Unit(this.scene, 0, yOffsetBase + yOffset, spriteKey, { ...specs, typeKey }, true, this);
        
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
        const scale = 1 + (level * 0.1);
        specs.hp *= scale;
        specs.damage *= scale;

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

        const x = isAlly ? 50 : 750;
        const y = 270;

        const boss = new Unit(this.scene, x, y, spriteKey, specs, isAlly, this);
        boss.isBoss = true;

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
            if (unit.isBoss) return isAlly ? 'defeat' : 'victory';
            
            if (!isAlly && unit.reward) {
                this.scene.addMoney(unit.reward);
            } else if (isAlly && !unit.isBoss) {
                this.scene.addEnemyExp(50);
            }
            
            this.scene.sound.play('ouch' + Phaser.Math.Between(1, 2), { volume: 0.5 });
            this.effectManager.playDeathEffect(unit);
            
            const group = isAlly ? this.allies : this.enemies;
            group.splice(index, 1);
            unit.destroy();
        }
        return null;
    }
}
