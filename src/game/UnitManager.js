import Phaser from 'phaser';
import { ALLY_TYPES, ENEMY_TYPES, BOSS_CONFIG } from './unitsConfig';

export default class UnitManager {
    constructor(scene, effectManager) {
        this.scene = scene;
        this.effectManager = effectManager;
        this.allies = [];
        this.enemies = [];
        this.enemySpawnCount = 0;
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
            ally.baseScale = specs.scale || 0.5;
            
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
            stunRemainingTime: 0,
            buffRemainingTime: 0
        });

        ally.shadow = this.scene.add.ellipse(ally.x, ally.y, 40, 12, 0x000000, 0.25).setDepth(ally.depth - 0.1);

        this.allies.push(ally);
        return ally;
    }

    spawnEnemy(level, yOffsetBase = 270) {
        this.enemySpawnCount++;
        let typeChoice = 0; // basic
        
        // Income Lvl 3+ spawns wawa every 5th enemy
        if (level >= 3 && this.enemySpawnCount % 5 === 0) {
            typeChoice = 3; // wawa
        } else {
            const rand = Phaser.Math.Between(1, 100);
            if (level >= 3 && rand > 70) typeChoice = 1; // 30% chance heavy after lv3
            if (level >= 5 && rand > 60 && rand <= 85) typeChoice = 2; // 25% chance fast after lv5
        }

        const specs = ENEMY_TYPES[typeChoice];

        const angleRad = Phaser.Math.DegToRad(5);
        const zOffset = Phaser.Math.Between(-150, 150);
        const yOffset = zOffset * Math.sin(angleRad);

        const spriteKey = 'enemy_' + specs.type;
        let enemy;

        if (this.scene.textures.exists(spriteKey)) {
            enemy = this.scene.add.sprite(800, yOffsetBase + yOffset, spriteKey).setOrigin(0.5, 1);
            enemy.setScale(specs.scale || 0.6);
            enemy.baseScale = specs.scale || 0.6;
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
            stunRemainingTime: 0,
            buffRemainingTime: 0
        });

        enemy.shadow = this.scene.add.ellipse(enemy.x, enemy.y, 40, 12, 0x000000, 0.25).setDepth(enemy.depth - 0.1);

        this.enemies.push(enemy);
        return enemy;
    }

    spawnBoss(isAlly) {
        const type = isAlly ? 'leader' : 'boss';
        const specs = BOSS_CONFIG[type];
        const x = isAlly ? 50 : 750;
        const y = 270;
        
        const spriteKey = (isAlly ? 'ally_' : 'enemy_') + type;
        const boss = this.scene.add.sprite(x, y, spriteKey).setOrigin(0.5, 1);
        
        if (isAlly) {
            boss.setFlipX(true);
        }
        boss.setScale(specs.scale || 1.0);
        boss.baseScale = specs.scale || 1.0;
        boss.setFrame(0);
        boss.setDepth(450);
        boss.isSprite = true;
        boss.spriteKey = spriteKey;
        
        boss.isAlly = isAlly;
        boss.typeKey = type;
        boss.isBoss = true;
        boss.logicWidth = specs.w;
        
        Object.assign(boss, {
            hp: specs.hp,
            maxHp: specs.hp,
            speed: specs.speed || 0,
            attackDamage: specs.damage || 0,
            attackRange: specs.range || 0,
            attackCooldown: specs.cooldown,
            lastAttackTime: 0,
            isKnockbackImmune: true,
            stunRemainingTime: 0,
            buffRemainingTime: 0
        });

        boss.shadow = this.scene.add.ellipse(boss.x, boss.y, isAlly ? 80 : 120, 16, 0x000000, 0.25).setDepth(boss.depth - 0.1);

        // Breathing animation effect
        this.scene.tweens.add({
            targets: boss,
            scaleY: boss.scaleY * 1.05,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Boss HP Bar (Always visible)
        const barW = isAlly ? 80 : 120;
        const barY = boss.y - boss.displayHeight - 10;
        boss.hpBarBg = this.scene.add.rectangle(boss.x, barY, barW, 8, 0x000000).setDepth(2000);
        boss.hpBarFill = this.scene.add.rectangle(boss.x - barW/2, barY, barW, 6, isAlly ? 0x2ecc71 : 0xe74c3c).setDepth(2001).setOrigin(0, 0.5);

        if (isAlly) this.allies.push(boss);
        else this.enemies.push(boss);
        
        return boss;
    }

    updateUnits(time, delta) {
        let gameOverResult = null;
        const groupList = [this.allies, this.enemies];

        for (let g = 0; g < 2; g++) {
            const group = groupList[g];
            const isAlly = (g === 0);
            const opponents = isAlly ? this.enemies : this.allies;

            for (let i = group.length - 1; i >= 0; i--) {
                const unit = group[i];

                if (unit.hp <= 0) {
                    if (unit.isBoss) gameOverResult = isAlly ? 'defeat' : 'victory';
                    this.effectManager.playDeathEffect(unit);
                    group.splice(i, 1);
                    continue;
                }

                let target = null;
                let minDist = Infinity;
                const halfW = unit.logicWidth / 2;

                // Optimized Target Search (Using direct for loop)
                for (let j = 0; j < opponents.length; j++) {
                    const opp = opponents[j];
                    const dist = Math.abs(unit.x - opp.x) - (halfW + opp.logicWidth / 2);
                    
                    if ((isAlly && opp.x > unit.x) || (!isAlly && opp.x < unit.x)) {
                        if (dist < minDist) {
                            minDist = dist;
                            target = opp;
                        }
                    }
                }

                let desiredMove = 1; // Default: forward
                
                // Special handling for ally leader: Manual movement only
                if (unit.isBoss && unit.isAlly) {
                    if (unit.isDragging && unit.targetX !== undefined) {
                        const diff = unit.targetX - unit.x;
                        if (Math.abs(diff) > 5) {
                            desiredMove = diff > 0 ? 1 : -1;
                            // Collision check: stop if hitting an enemy while moving towards them
                            if (target && minDist <= unit.attackRange) {
                                if ((desiredMove === 1 && target.x > unit.x) || (desiredMove === -1 && target.x < unit.x)) {
                                    desiredMove = 0;
                                }
                            }
                        } else {
                            desiredMove = 0;
                        }
                    } else {
                        desiredMove = 0; // Idle by default
                    }
                } else if (target) {
                    if (unit.typeKey === 'shooter') {
                        if (minDist < 120) desiredMove = -1; // Retreat
                        else if (minDist > 160) desiredMove = 1; // Advance
                        else desiredMove = 0; // Sweet spot
                    } else if (minDist <= unit.attackRange) {
                        desiredMove = 0; 
                    }
                }

                // Handle Stun State
                if (unit.stunRemainingTime > 0) {
                    unit.stunRemainingTime -= delta;
                    desiredMove = 0;
                    target = null;
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
                            unit.setFlipX(moveAmount > 0);
                        }
                    } else if (unit.isBoss && unit.isAlly && unit.isSprite) {
                        // Face right when halted manually
                        unit.setFlipX(true);
                    }

                    if (actuallyMoving && unit.isSprite) {
                        const walkKey = `${unit.spriteKey}_walk`;
                        if (!unit.anims.currentAnim || unit.anims.currentAnim.key !== walkKey) {
                            unit.play(walkKey, true);
                        }
                    }
                } else if (unit.isBoss && unit.isAlly && unit.isSprite) {
                    // Face right when idle (not moving)
                    unit.setFlipX(true);
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

                    let currentDamage = unit.attackDamage;
                    let currentCooldown = unit.attackCooldown;
                    if (unit.buffRemainingTime > 0) {
                        currentDamage *= 1.1;
                        currentCooldown *= 0.5; // 50% faster (shorter cooldown)
                    }

                    if (time - unit.lastAttackTime >= currentCooldown) {
                        target.hp -= currentDamage;
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

                        if (unit.attackRange > 20 && unit.typeKey !== 'shooter' && !unit.isBoss) {
                            this.effectManager.createProjectile(unit.x, unit.y, target, isAlly);
                        }

                        this.effectManager.playAttackAnimation(unit, isAlly);
                    }
                }

                if (unit.buffRemainingTime > 0) {
                    unit.buffRemainingTime -= delta;
                    
                    if (unit.isSprite) {
                        const ratio = Math.max(0, unit.buffRemainingTime / 10000);
                        // Scale fades from 1.1x to 1.0x
                        unit.setScale(unit.baseScale * (1 + 0.1 * ratio));
                        
                        // Tint fades from Red (0xff8888) to White (0xffffff)
                        const greenBlue = Math.floor(136 + (255 - 136) * (1 - ratio));
                        unit.setTint(Phaser.Display.Color.GetColor(255, greenBlue, greenBlue));
                    }

                    if (unit.buffRemainingTime <= 0) {
                        if (unit.isSprite) {
                            unit.setScale(unit.baseScale);
                            unit.clearTint();
                        }
                    }
                }

                // Update UI elements
                if (unit.isBoss && unit.hpBarBg && unit.hpBarFill) {
                    const barY = unit.y - unit.displayHeight - 10;
                    unit.hpBarBg.x = unit.x;
                    unit.hpBarBg.y = barY;
                    unit.hpBarFill.x = unit.x - unit.hpBarBg.width / 2;
                    unit.hpBarFill.y = barY;
                    unit.hpBarFill.width = Math.max(0, unit.hpBarBg.width * (unit.hp / unit.maxHp));
                }

                if (unit.shadow) {
                    unit.shadow.x = unit.x;
                    unit.shadow.y = unit.y;
                }
            }
        }

        return gameOverResult;
    }
}
