import Phaser from 'phaser';
import { ALLY_TYPES, ENEMY_TYPES } from './unitsConfig';

export default class UnitManager {
    constructor(scene, effectManager) {
        this.scene = scene;
        this.effectManager = effectManager;
        this.allies = [];
        this.enemies = [];
    }

    spawnAlly(typeKey, yOffsetBase = 270) {
        const specs = ALLY_TYPES[typeKey];
        if (!specs) return null;

        const angleRad = Phaser.Math.DegToRad(5);
        const zOffset = Phaser.Math.Between(-150, 150);
        const yOffset = zOffset * Math.sin(angleRad);

        let ally;
        const spriteKey = 'ally_' + typeKey;

        if (this.scene.textures.exists(spriteKey)) {
            ally = this.scene.add.sprite(0, yOffsetBase + yOffset, spriteKey).setOrigin(0.5, 1).setFlipX(true);
            ally.setScale(specs.scale || 0.5);
            
            // Check if walk animation exists
            if (this.scene.anims.exists(spriteKey + '_walk')) {
                ally.play(spriteKey + '_walk');
            }
            ally.isSprite = true;
            ally.spriteKey = spriteKey;
        } else {
            ally = this.scene.add.rectangle(100, 450 + yOffset - specs.h / 2, specs.w, specs.h, specs.color).setStrokeStyle(2, 0xffffff);
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
            lastAttackTime: 0,
            bonusKnockback: specs.bonusKnockback || 0,
            isKnockbackImmune: specs.isKnockbackImmune || false,
            stunRemainingTime: 0
        });

        ally.hpBarBg = this.scene.add.rectangle(ally.x, ally.y - 60, 40, 6, 0x000000).setDepth(2000);
        ally.hpBarFill = this.scene.add.rectangle(ally.x - 20, ally.y - 60, 40, 4, 0x2ecc71).setDepth(2001).setOrigin(0, 0.5);
        ally.shadow = this.scene.add.ellipse(ally.x, ally.y, 40, 12, 0x000000, 0.25).setDepth(ally.depth - 0.1);

        this.allies.push(ally);
        return ally;
    }

    spawnEnemy(level, yOffsetBase = 270) {
        let typeChoice = 0; // basic
        const rand = Phaser.Math.Between(1, 100);
        if (level >= 3 && rand > 70) typeChoice = 1; // 30% chance heavy after lv3
        if (level >= 5 && rand > 60 && rand <= 85) typeChoice = 2; // 25% chance fast after lv5

        const specs = ENEMY_TYPES[typeChoice];

        const angleRad = Phaser.Math.DegToRad(5);
        const zOffset = Phaser.Math.Between(-150, 150);
        const yOffset = zOffset * Math.sin(angleRad);

        const spriteKey = 'enemy_' + specs.type;
        let enemy;

        if (this.scene.textures.exists(spriteKey)) {
            enemy = this.scene.add.sprite(800, yOffsetBase + yOffset, spriteKey).setOrigin(0.5, 1);
            enemy.setScale(specs.scale || 0.6);
            if (this.scene.anims.exists(spriteKey + '_walk')) {
                enemy.play(spriteKey + '_walk');
            }
            enemy.isSprite = true;
            enemy.spriteKey = spriteKey;
        } else {
            enemy = this.scene.add.rectangle(800, 450 + yOffset - specs.h / 2, specs.w, specs.h, specs.color).setStrokeStyle(2, 0xffffff);
        }

        enemy.setDepth(450 + yOffset);
        enemy.isAlly = false;
        enemy.logicWidth = specs.w;

        const scale = 1 + (level * 0.1); // difficulty scaling

        Object.assign(enemy, {
            hp: specs.hp * scale,
            maxHp: specs.hp * scale,
            speed: specs.speed,
            attackDamage: specs.damage * scale,
            attackRange: specs.range,
            attackCooldown: specs.cooldown,
            lastAttackTime: 0,
            bonusKnockback: specs.bonusKnockback || 0,
            isKnockbackImmune: specs.isKnockbackImmune || false,
            stunRemainingTime: 0
        });

        enemy.hpBarBg = this.scene.add.rectangle(enemy.x, enemy.y - 60, 40, 6, 0x000000).setDepth(2000);
        enemy.hpBarFill = this.scene.add.rectangle(enemy.x - 20, enemy.y - 60, 40, 4, 0xe74c3c).setDepth(2001).setOrigin(0, 0.5);
        enemy.shadow = this.scene.add.ellipse(enemy.x, enemy.y, 40, 12, 0x000000, 0.25).setDepth(enemy.depth - 0.1);

        this.enemies.push(enemy);
        return enemy;
    }

    updateUnits(time, delta) {
        let gameOverResult = null;

        [this.allies, this.enemies].forEach((group, isAllyIdx) => {
            const isAlly = isAllyIdx === 0;
            for (let i = group.length - 1; i >= 0; i--) {
                const unit = group[i];

                // Victory/Defeat detection
                if (isAlly && unit.x >= 780) {
                    gameOverResult = 'victory';
                }
                if (!isAlly && unit.x <= 20) {
                    gameOverResult = 'defeat';
                }

                if (unit.hp <= 0) {
                    this.effectManager.playDeathEffect(unit);
                    group.splice(i, 1);
                    continue;
                }

                let target = null;
                let minDist = Infinity;
                const opponents = isAlly ? this.enemies : this.allies;
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

                let desiredMove = 1; // Default: forward
                if (target) {
                    if (unit.typeKey === 'shooter') {
                        if (minDist < 120) desiredMove = -1; // Retreat
                        else if (minDist > 160) desiredMove = 1; // Advance
                        else desiredMove = 0; // Sweet spot
                    } else if (minDist <= unit.attackRange) {
                        desiredMove = 0; // Normal units stop and attack
                    }
                }

                // Handle Stun State
                if (unit.stunRemainingTime > 0) {
                    unit.stunRemainingTime -= delta;
                    desiredMove = 0;
                    target = null; // Prevent attack while stunned
                }

                // Handle Movement
                let actuallyMoving = false;
                if (desiredMove !== 0) {
                    let moveAmount = unit.speed * (delta / 16) * desiredMove;
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

                // Handle Attack
                if (target && minDist <= unit.attackRange) {
                    if (!actuallyMoving && unit.isSprite) {
                        const walkKey = `${unit.spriteKey}_walk`;
                        const idleKey = `${unit.spriteKey}_idle`;
                        if (unit.anims.currentAnim && unit.anims.currentAnim.key === walkKey) {
                            unit.play(idleKey, true);
                        }
                    }

                    if (time - unit.lastAttackTime >= unit.attackCooldown) {
                        target.hp -= unit.attackDamage;
                        unit.lastAttackTime = time;

                        this.effectManager.playHitEffect(target, unit.attackDamage);

                        // Knockback Logic
                        const knockbackChance = 0.10 + unit.bonusKnockback;
                        if (!target.isKnockbackImmune && Math.random() <= knockbackChance) {
                            target.stunRemainingTime = 400; // 0.4s stun
                            this.scene.tweens.add({
                                targets: target,
                                x: target.x + (isAlly ? 40 : -40), // Push away from attacker
                                duration: 200,
                                ease: 'Cubic.easeOut'
                            });
                        }

                        if (unit.attackRange > 20 && unit.typeKey !== 'shooter') {
                            this.effectManager.createProjectile(unit.x, unit.y, target, isAlly);
                        }

                        this.effectManager.playAttackAnimation(unit, isAlly);
                    }
                }

                // Update UI elements
                if (unit.hpBarBg && unit.hpBarFill) {
                    unit.hpBarBg.x = unit.x;
                    unit.hpBarBg.y = unit.y - 60;
                    unit.hpBarFill.x = unit.x - 20;
                    unit.hpBarFill.y = unit.y - 60;
                    unit.hpBarFill.width = Math.max(0, 40 * (unit.hp / unit.maxHp));
                }
                
                if (unit.shadow) {
                    unit.shadow.x = unit.x;
                    unit.shadow.y = unit.y;
                }
            }
        });

        return gameOverResult;
    }
}
