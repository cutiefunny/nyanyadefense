import Phaser from 'phaser';
import LEADER_SKILL_TREE from './leaderSkillTree.json';
import UnitSkillHandler from './UnitSkillHandler';
import ITEM_CONFIG from './itemsConfig.json';

export default class Unit extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, spriteKey, specs, isAlly, unitManager) {
        super(scene, x, y, spriteKey);
        scene.add.existing(this);
        this.unitManager = unitManager;
        this.effectManager = unitManager.effectManager;
        this.init(x, y, spriteKey, specs, isAlly);
    }

    init(x, y, spriteKey, specs, isAlly) {
        this.setPosition(x, y);
        this.setTexture(spriteKey);
        this.setAlpha(1);
        this.clearTint();
        this.setAngle(0);
        this.setActive(true);
        this.setVisible(true);

        this.isAlly = isAlly;
        this.specs = specs;
        this.typeKey = specs.type || specs.typeKey;

        // Basic properties
        this.setOrigin(0.5, 1);
        const multiplier = this.unitManager.getStageScaleMultiplier();
        this.baseScale = specs.scale || (isAlly ? 0.5 : 0.6);
        this.setScale(this.baseScale * multiplier);
        this.setDepth(y);

        this.baseWidth = specs.w;
        this.logicWidth = this.baseWidth * multiplier;

        // Stats
        this.hp = specs.hp;
        this.maxHp = specs.hp;
        this.speed = specs.speed;
        this.attackDamage = specs.damage;
        this.attackRange = specs.range;
        this.attackCooldown = specs.cooldown;
        this.defense = specs.defense || 0;

        this.lastAttackTime = 0;
        this.attackCount = 0;
        this.bonusKnockback = specs.bonusKnockback || 0;
        this.isKnockbackImmune = specs.isKnockbackImmune || false;
        this.stunRemainingTime = 0;
        this.buffRemainingTime = 0;
        this.catnipRemainingTime = 0;
        this.hitFlashTimer = 0;
        this.retreatTimer = 0; // 보스 생존용 후퇴 타이머
        this.isBoss = specs.isBoss || false;
        this.reward = specs.reward || 0;
        this.lastHitByEnemyTime = 0;
        this.deckIndex = specs.deckIndex;
        this.superArmorTimer = 0; // Hidden skill timer for tanker
        this.dashCooldown = 0; // Hidden skill for normal unit
        this.isDashing = false;
        this.targetCheckTimer = 0;
        this.cachedTarget = null;
        this.isDragging = false;
        this.targetX = undefined;

        this.isMortarMode = specs.isMortarMode || false;
        this.isSuperMortar = specs.isSuperMortar || false;
        if (this.isMortarMode) {
            this.speed = 0;
            this.attackRange = 800; // Screen-wide range
            this.attackCooldown = 5000; // 5 seconds
            this.isKnockbackImmune = true;
        }

        this.setFlipX(false);
        if (isAlly && !this.isMortarMode) this.setFlipX(true);

        this.hasSplash = specs.hasSplash || false;

        this.isDoubleDoorTank = specs.isDoubleDoorTank || false;
        if (this.isDoubleDoorTank) {
            this.defense = (specs.defense1 + specs.defense2) / 2 + 3;
            this.isKnockbackImmune = true;
            this.baseScale *= 1.2; // Slightly larger
            this.setScale(this.baseScale * multiplier);
            this.setTint(0x3498db); // Distinct color
            this.createShield();
        }

        // Apply Leader Perks if applicable
        if (this.isBoss && this.isAlly) {
            this.applyLeaderPerks();
        }

        // Visuals
        this.spriteKey = spriteKey;
        this.isSprite = true; // For compatibility with older checks

        const shadowW = this.displayWidth * (this.isBoss ? 1.5 : (this.isMortarMode ? 1.5 : 1.2));
        const shadowH = shadowW * 0.3;

        if (!this.shadow) {
            this.shadow = this.scene.add.ellipse(x, y, shadowW, shadowH, 0x000000, 0.4);
        }
        this.shadow.setActive(true).setVisible(true).setPosition(x, y).setAlpha(0.4);
        this.shadow.width = shadowW;
        this.shadow.height = shadowH;
        if (this.shadow.geom) {
            this.shadow.geom.width = shadowW;
            this.shadow.geom.height = shadowH;
        }
        this.shadow.setDepth(this.depth - 0.1);
        
        if (this.isBoss) {
            this.createHPBar();
        } else {
            // Hide HP bar if reused from a boss
            if (this.hpBarBg) this.hpBarBg.setVisible(false);
            if (this.hpBarFill) this.hpBarFill.setVisible(false);
        }

        // Healer Aura (Hidden Skill: 장판힐) Range Graphic
        if (this.typeKey === 'healer' && this.specs.level >= 5 && isAlly) {
            const multiplier = this.unitManager.getStageScaleMultiplier();
            const auraW = 100 * multiplier;
            const auraH = 40 * multiplier;
            if (!this.auraGraphic) {
                this.auraGraphic = this.scene.add.ellipse(x, y, auraW, auraH, 0x2ecc71, 0.2);
            }
            this.auraGraphic.setActive(true).setVisible(true).setPosition(x, y).setSize(auraW, auraH).setDepth(this.depth - 0.2);
            
            if (this.auraTween) this.auraTween.stop();
            this.auraTween = this.scene.tweens.add({
                targets: this.auraGraphic,
                alpha: 0.1,
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 1000,
                yoyo: true,
                repeat: -1
            });
        }

        // Initialize skill timer for boss3 to trigger after 10s (30s threshold - 20s initial)
        if (this.typeKey === 'boss3' && !this.isAlly) {
            this.skillTimer = 20000;
        }
    }

    createHPBar() {
        const barW = this.isAlly ? 80 : 120;
        const barY = this.y - this.displayHeight - 15;
        if (!this.hpBarBg) {
            this.hpBarBg = this.scene.add.rectangle(this.x, barY, barW + 4, 12, 0x000000);
            this.hpBarFill = this.scene.add.rectangle(this.x - barW / 2, barY, barW, 8, this.isAlly ? 0x2ecc71 : 0xe74c3c).setOrigin(0, 0.5);
        }
        this.hpBarBg.setActive(true).setVisible(true).setPosition(this.x, barY).setSize(barW + 4, 12).setDepth(2000);
        this.hpBarFill.setActive(true).setVisible(true).setPosition(this.x - barW / 2, barY).setSize(barW, 8).setFillStyle(this.isAlly ? 0x2ecc71 : 0xe74c3c).setDepth(2001);
    }

    createShield() {
        // Position it in front of the tank (right side for allies)
        const shieldX = this.x + 25;
        const shieldY = this.y - 35;
        if (!this.shieldGraphic) {
            this.shieldGraphic = this.scene.add.image(shieldX, shieldY, 'item_shield');
        }
        this.shieldGraphic.setActive(true).setVisible(true).setPosition(shieldX, shieldY).setDepth(this.depth + 1);

        // Scale the shield appropriately
        const multiplier = this.unitManager.getStageScaleMultiplier();
        this.shieldGraphic.setScale(0.8 * multiplier);
    }

    update(time, delta, opponents) {
        if (this.hp <= 0) return 'dead';

        // Update Shield Position
        if (this.shieldGraphic) {
            const offsetX = this.flipX ? (this.displayWidth / 2) : -(this.displayWidth / 2);
            this.shieldGraphic.x = this.x + offsetX;
            this.shieldGraphic.y = this.y - this.displayHeight / 2;
            this.shieldGraphic.setDepth(this.depth + 1);
        }

        // Update Flash Effect
        if (this.hitFlashTimer > 0) {
            this.hitFlashTimer -= delta;
            if (this.hitFlashTimer <= 0) this.clearTint();
        }

        // Update Retreat Timer
        if (this.retreatTimer > 0) {
            this.retreatTimer -= delta;
        }

        if (this.targetCheckTimer === undefined) this.targetCheckTimer = 0;
        this.targetCheckTimer -= delta;

        let target = this.cachedTarget;
        
        // 캐시된 타겟이 죽거나 비활성화되었으면 초기화
        if (target && (!target.active || target.hp <= 0)) {
            target = null;
        }

        // 타겟이 없거나 탐색 주기(250ms)가 지났으면 새로 탐색
        if (!target || this.targetCheckTimer <= 0) {
            target = this.findTarget(opponents);
            this.cachedTarget = target;
            this.targetCheckTimer = 250;
        }

        let minDist = Infinity;
        if (target) {
            // 거리가 음수가 되지 않도록 최소값 0 보정
            minDist = Math.max(0, Math.abs(this.x - target.x) - (this.logicWidth / 2 + target.logicWidth / 2));
        }

        let desiredMove = this.getDesiredMove(target, minDist);

        // --- Unit Skills (Decoupled to UnitSkillHandler) ---
        UnitSkillHandler.handleUpdate(this, time, delta);

        // Handle Stun & Dash movement constraints
        if (this.stunRemainingTime > 0) {
            this.stunRemainingTime -= delta;
            desiredMove = 0;
            target = null;
        }
        if (this.isDashing) {
            desiredMove = 0;
        }

        // Handle Movement
        let actuallyMoving = false;
        if (desiredMove !== 0) {
            actuallyMoving = this.handleMovement(delta, desiredMove, target, minDist);
        } else if (this.isBoss && this.isAlly) {
            this.setFlipX(true);
        }

        // Handle Animation State
        this.updateAnimation(actuallyMoving, target, minDist);

        // Update Buffs & UI (Before early return for mortars)
        this.updateBuffs(delta);
        this.updateUI();

        // Heavy Metal Speed Buff Calculation
        const isHeavyMetal = this.isAlly && (this.scene.heavyMetalRemainingTime > 0);

        // Handle Attack
        let canAttack = true;
        if (this.isBoss && this.isAlly && this.scene.isAutoMode && !this.isDragging) {
            const tankers = this.unitManager.allies.filter(a => a.typeKey === 'tanker' && a.hp > 0);
            const isAnyTankerHit = tankers.some(t => t.hp < t.maxHp || (this.scene.time.now - (t.lastHitByEnemyTime || 0) < 3000));
            if (tankers.length > 0 && !isAnyTankerHit) {
                canAttack = false;
            }
        }

        const heavyMetalEffect = ITEM_CONFIG.heavy_metal?.effects || {};

        if (this.isMortarMode) {
            const currentCooldown = isHeavyMetal ? (this.attackCooldown / (heavyMetalEffect.attackSpeedMultiplier || 2.0)) : this.attackCooldown;
            if (time - this.lastAttackTime >= currentCooldown) {
                this.lastAttackTime = time;
                if (target) {
                    this.throwMortar(target, this.attackDamage);
                    this.play(`${this.spriteKey}_attack`, true);
                    
                    // Recoil Effect
                    const originalX = this.x;
                    this.scene.tweens.add({
                        targets: this,
                        x: originalX - 10,
                        duration: 100,
                        yoyo: true,
                        ease: 'Power1',
                        onComplete: () => { this.x = originalX; }
                    });

                    this.scene.time.delayedCall(300, () => {
                        if (this.active && this.hp > 0) {
                            this.play(`${this.spriteKey}_idle`, true);
                        }
                    });
                }
            }
            return null;
        }

        if (canAttack && target && minDist <= this.attackRange) {
            this.handleAttack(time, target);
        }

        // Limit ally position
        if (this.isAlly && this.hp > 0) {
            const enemyBoss = this.unitManager.getEnemyBoss();
            if (enemyBoss) {
                const stopX = enemyBoss.x - enemyBoss.logicWidth / 2;
                if (this.x > stopX) this.x = stopX;
            }
        }

        return null;
    }

    findTarget(opponents) {
        if (this.typeKey === 'healer') {
            // Healers target the ally with the lowest HP fraction who is NOT at full hp
            let woundedAlly = null;
            let lowestHpRatio = 1;

            const allies = this.unitManager.allies;
            for (let j = 0; j < allies.length; j++) {
                const ally = allies[j];
                if (ally === this || ally.hp <= 0) continue;

                const dist = Math.abs(this.x - ally.x);
                if (dist <= this.attackRange) {
                    const ratio = ally.hp / ally.maxHp;
                    if (ratio < 0.99 && ratio < lowestHpRatio) {
                        lowestHpRatio = ratio;
                        woundedAlly = ally;
                    }
                }
            }
            return woundedAlly; // Can be null if everyone is full
        }

        let target = null;
        let minDist = Infinity;
        const halfW = this.logicWidth / 2;

        if (!this.isAlly) {
            const doubleDoorTank = opponents.find(opp => opp.isDoubleDoorTank && opp.hp > 0);
            if (doubleDoorTank) {
                const distToTank = Math.max(0, Math.abs(this.x - doubleDoorTank.x) - (halfW + doubleDoorTank.logicWidth / 2));
                if (distToTank <= this.attackRange + 100) { // If within reach or close enough to prioritize
                    return doubleDoorTank;
                }
            }
        }

        for (let j = 0; j < opponents.length; j++) {
            const opp = opponents[j];
            // 거리가 음수가 되지 않도록 최소값을 0으로 보정
            const dist = Math.max(0, Math.abs(this.x - opp.x) - (halfW + opp.logicWidth / 2));

            if ((this.isAlly && opp.x > this.x) || (!this.isAlly && opp.x < this.x)) {
                if (dist < minDist) {
                    minDist = dist;
                    target = opp;
                }
            }
        }
        return target;
    }

    getDesiredMove(target, minDist) {
        let desiredMove = 1;

        if (this.isBoss && this.isAlly) {
            if (this.isDragging && this.targetX !== undefined) {
                const diff = this.targetX - this.x;
                if (Math.abs(diff) > 5) {
                    desiredMove = diff > 0 ? 1 : -1;
                    if (target && minDist <= this.attackRange) {
                        if ((desiredMove === 1 && target.x > this.x) || (desiredMove === -1 && target.x < this.x)) {
                            desiredMove = 0;
                        }
                    }
                } else {
                    desiredMove = 0;
                }
            } else if (this.scene.isAutoMode) {
                // Survival AI: If retreatTimer is active, move back
                if (this.retreatTimer > 0) {
                    desiredMove = -1;
                }
                else {
                    const tankers = this.unitManager.allies.filter(a => a.typeKey === 'tanker' && a.hp > 0);
                    const frontTanker = tankers.length > 0 ? tankers.reduce((prev, curr) => (curr.x > prev.x ? curr : prev)) : null;
                    const isAnyTankerHit = tankers.some(t => t.hp < t.maxHp || (this.scene.time.now - (t.lastHitByEnemyTime || 0) < 3000));

                    if (frontTanker && !isAnyTankerHit) {
                        // Follow behavior: stay behind the front-most tanker
                        const followDist = 50;
                        const targetX = frontTanker.x - followDist;
                        const diff = targetX - this.x;

                        if (Math.abs(diff) > 10) {
                            desiredMove = diff > 0 ? 1 : -1;
                        } else {
                            desiredMove = 0;
                        }
                    } else if (target && minDist <= this.attackRange) {
                        // Engaged behavior
                        desiredMove = 0;
                    } else {
                        // Normal advance
                        desiredMove = 1;
                    }
                }
            } else {
                desiredMove = 0;
            }
        } else if (this.typeKey === 'healer') {
            // Healer AI: Follow the front-most combat unit
            const combatAllies = this.unitManager.allies.filter(a => a.active && a.hp > 0 && a.typeKey !== 'healer' && !a.isBoss);
            if (combatAllies.length > 0) {
                const frontAlly = combatAllies.reduce((prev, curr) => (curr.x > prev.x ? curr : prev));
                const followDist = 80;
                const targetX = frontAlly.x - followDist;
                const diff = targetX - this.x;

                if (Math.abs(diff) > 20) {
                    desiredMove = diff > 0 ? 1 : -1;
                } else {
                    desiredMove = 0;
                }
            } else {
                desiredMove = 1; // Advance if no one to follow
            }
        } else if (this.isMortarMode) {
            desiredMove = 0;
        } else if (target) {
            if (this.typeKey === 'shooter') {
                if (minDist < 120) desiredMove = -1;
                else if (minDist > 160) desiredMove = 1;
                else desiredMove = 0;
            } else if (minDist <= this.attackRange) {
                desiredMove = 0;
            }
        }
        return desiredMove;
    }

    handleMovement(delta, desiredMove, target, minDist) {
        let currentSpeed = this.speed;
        if (this.buffRemainingTime > 0 && !this.isAlly) {
            currentSpeed *= 2;
        }
        if (this.isAlly && this.scene.heavyMetalRemainingTime > 0) {
            const heavyMetalEffect = ITEM_CONFIG.heavy_metal?.effects || {};
            currentSpeed *= (heavyMetalEffect.moveSpeedMultiplier || 2.0);
        }
        if (this.catnipRemainingTime > 0) {
            const catnipEffect = ITEM_CONFIG.catnip?.effects || {};
            currentSpeed *= (catnipEffect.moveSpeedMultiplier || 2.0);
        }
        let moveAmount = currentSpeed * (delta / 16) * desiredMove;

        // Map bounds & Boss-relative constraints
        if (desiredMove === -1) {
            // 수정: 경계를 100에서 20으로 변경하여 보스(초기 x=50)가 정상 이동 가능하게 함
            if (this.isAlly && this.x + moveAmount < 20) moveAmount = 0;
            if (!this.isAlly && this.x + moveAmount > 780) moveAmount = 0;
        } else if (desiredMove === 1 && this.isAlly) {
            // 아군은 적 보스보다 더 오른쪽에 위치하면 안 됨 (보스의 왼쪽 끝 경계선 기준)
            const enemyBoss = this.unitManager.getEnemyBoss();
            if (enemyBoss) {
                const stopX = enemyBoss.x - enemyBoss.logicWidth / 2;
                if (this.x + moveAmount > stopX) {
                    moveAmount = Math.max(0, stopX - this.x);
                }
            }
        }

        if (moveAmount !== 0) {
            this.x += moveAmount;
            if (this.typeKey === 'shooter') {
                this.setFlipX(true);
            } else {
                this.setFlipX(moveAmount > 0);
            }
            return true;
        }
        return false;
    }

    updateAnimation(actuallyMoving, target, minDist) {
        const walkKey = `${this.spriteKey}_walk`;
        const idleKey = `${this.spriteKey}_idle`;

        if (actuallyMoving) {
            if (!this.anims.currentAnim || this.anims.currentAnim.key !== walkKey) {
                this.play(walkKey, true);
            }
        } else if (target && minDist <= this.attackRange) {
            if (this.anims.currentAnim && this.anims.currentAnim.key === walkKey) {
                this.play(idleKey, true);
            }
        }
    }

    handleAttack(time, target) {
        let currentDamage = this.attackDamage;
        let currentCooldown = this.attackCooldown;
        if (this.buffRemainingTime > 0) {
            currentDamage *= 1.1;
            currentCooldown *= 0.5;
        }

        if (this.isAlly && this.scene.heavyMetalRemainingTime > 0) {
            const heavyMetalEffect = ITEM_CONFIG.heavy_metal?.effects || {};
            currentDamage *= (heavyMetalEffect.damageMultiplier || 1.1);
            currentCooldown /= (heavyMetalEffect.attackSpeedMultiplier || 2.0);
        }

        if (this.catnipRemainingTime > 0) {
            const catnipEffect = ITEM_CONFIG.catnip?.effects || {};
            currentDamage *= (catnipEffect.damageMultiplier || 2.0);
            currentCooldown /= (catnipEffect.attackSpeedMultiplier || 2.0);
        }

        if (time - this.lastAttackTime >= currentCooldown) {
            this.lastAttackTime = time;
            this.effectManager.playAttackAnimation(this, this.isAlly);

            if (this.typeKey === 'healer') {
                // Healing Logic
                target.hp = Math.min(target.maxHp, target.hp + currentDamage);

                // Show a green heal effect
                const healText = this.scene.add.text(target.x, target.y - 40, `+${Math.floor(currentDamage)}`, {
                    fontSize: '16px', fontFamily: 'Arial Black', fill: '#2ecc71'
                }).setOrigin(0.5).setDepth(3000);

                this.scene.tweens.add({
                    targets: healText,
                    y: healText.y - 30,
                    alpha: 0,
                    duration: 800,
                    onComplete: () => healText.destroy()
                });

                // Play a heal sound if available (reuse hit for now or just silent)
            } else if (this.typeKey === 'boss7') {
                this.throwGrenade(target, currentDamage);
            } else if (this.typeKey === 'boss6') {
                this.fireWavePattern();
            } else {
                // Normal Damage & Knockback
                let damageToApply = currentDamage;
                if (this.critChance && Math.random() <= this.critChance) {
                    damageToApply *= 2;
                    if (this.scene.showFloatingText) {
                        this.scene.showFloatingText('CRITICAL!', this.x, this.y - 60, '#ff1111');
                    }
                }
                target.takeDamage(damageToApply, this.isAlly);

                if (this.hasSplash) {
                    // Splash Suppression: If target is Double Door Tank, reduce splash range and damage
                    let splashRange = target.isDoubleDoorTank ? 10 : 30;
                    let splashDamageMult = target.isDoubleDoorTank ? 0.2 : 0.5;

                    // Special range for Boss 4
                    if (this.typeKey === 'boss4' && !this.isAlly) {
                        splashRange = 50;
                        splashDamageMult = 0.5;
                    }

                    this.applySplashDamage(target.x, target.y, damageToApply * splashDamageMult, splashRange, 0, target);
                    
                    // Splash visual
                    const splashColor = 0xffaa00;
                    const opponents = this.isAlly ? this.unitManager.enemies : this.unitManager.allies;
                    opponents.forEach(opp => {
                        if (opp !== target && opp.active && opp.hp > 0 && Math.abs(target.x - opp.x) <= splashRange) {
                            const circle = this.scene.add.circle(opp.x, opp.y - 20, 15, splashColor, 0.6).setDepth(3000);
                            this.scene.tweens.add({
                                targets: circle,
                                alpha: 0,
                                scale: 1.5,
                                duration: 200,
                                onComplete: () => circle.destroy()
                            });
                        }
                    });
                }

                if (Math.random() < 0.1) {
                    this.scene.sound.play('hit' + Phaser.Math.Between(1, 3), { volume: 0.5 });
                }

                let knockbackChance = 0.10 + this.bonusKnockback;
                if (this.buffRemainingTime > 0) knockbackChance *= 6; // 500% increase = 6x

                // If buffed, ignore knockback immunity for normal tankers, but Double-Door tankers and bosses stay immune
                const isDoubleDoor = target.isDoubleDoorTank || false;
                const isSuperArmor = (target.typeKey === 'tanker' && target.specs.level >= 5) || (target.superArmorTimer > 0);
                const targetImmune = this.buffRemainingTime > 0 ? (target.isBoss || isDoubleDoor || isSuperArmor) : (target.isKnockbackImmune || target.isBoss);
                
                if (!targetImmune && Math.random() <= knockbackChance) {
                    target.stunRemainingTime = 400;
                    
                    // Normal tankers (who have isKnockbackImmune) only move 10% of the distance
                    let kbDistance = 40;
                    if (this.buffRemainingTime > 0 && target.isKnockbackImmune) {
                        kbDistance = 4;
                    }
                    
                    this.scene.tweens.add({
                        targets: target,
                        x: target.x + (this.isAlly ? kbDistance : -kbDistance),
                        duration: 200,
                        ease: 'Cubic.easeOut'
                    });
                }
            }

            if (this.typeKey === 'shooter') {
                this.attackCount++;
                if (this.specs.level >= 5 && this.attackCount % 20 === 0) {
                    this.throwGrenade(target, currentDamage);
                }

                this.scene.tweens.add({
                    targets: this,
                    x: this.x - (this.isAlly ? 8 : -8),
                    duration: 50,
                    yoyo: true,
                    ease: 'Cubic.easeOut'
                });
            }
        }
    }

    fireWavePattern() {
        const startX = this.x - 40;
        const groundY = this.y - 45;
        const totalRange = 400; // 50% of 800px screen
        const waveCount = 8;
        const waveSpacing = totalRange / waveCount;

        // Play a charge sound or initial burst sound
        this.scene.sound.play('hit3', { volume: 0.6, rate: 0.8 });

        for (let i = 0; i < waveCount; i++) {
            this.scene.time.delayedCall(i * 30, () => {
                if (!this.scene) return;

                const waveX = startX - (i * waveSpacing);
                if (waveX < startX - totalRange) return;

                // Visual wave (ground shockwave)
                const wave = this.scene.add.ellipse(waveX, groundY, 20, 80, 0x00d2ff, 0.6)
                    .setDepth(this.depth + 1);

                this.scene.tweens.add({
                    targets: wave,
                    width: 60,
                    alpha: 0,
                    duration: 500,
                    ease: 'Cubic.easeOut',
                    onComplete: () => wave.destroy()
                });

                // Damage allies in the wave range
                const allies = this.unitManager.allies;
                allies.forEach(ally => {
                    if (ally.active && ally.hp > 0 && Math.abs(ally.x - waveX) < 30) {
                        let currentDamageMult = 0.4;

                        this.applySplashDamage(waveX, groundY, this.attackDamage * 0.4, 30);
                    }
                });

                // Small ground dust/particles
                if (i % 2 === 0) {
                    this.scene.sound.play('hit1', { volume: 0.2, rate: 1.5 });
                }
            });
        }
    }

    throwGrenade(target, damage) {
        const startY = this.isBoss ? (this.y - this.displayHeight * 0.6) : (this.y - 40);
        const grenade = this.effectManager.spawnProjectile(this.effectManager.grenadePool, this.x, startY, 6, 0x333333);
        if (!grenade) return;
        
        grenade.setDepth(2001);
        const targetX = target.x;
        const targetY = target.y - 20;

        // Parabolic trajectory
        this.scene.tweens.add({
            targets: grenade,
            x: targetX,
            duration: 600,
            ease: 'Linear'
        });

        this.scene.tweens.add({
            targets: grenade,
            y: targetY - 120,
            duration: 300,
            yoyo: true,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.effectManager.recycleProjectile(this.effectManager.grenadePool, grenade);
                this.explodeGrenade(targetX, targetY, damage);
            }
        });
    }

    explodeGrenade(x, y, baseDamage) {
        if (!this.scene || !this.active) return;

        // Visual effect
        const explosion = this.scene.add.circle(x, y, 10, 0xff6600, 1).setDepth(3000);
        this.scene.tweens.add({
            targets: explosion,
            radius: 70,
            alpha: 0,
            duration: 300,
            ease: 'Cubic.easeOut',
            onComplete: () => { if (explosion.active) explosion.destroy(); }
        });

        // Flash and shake
        this.scene.cameras.main.shake(100, 0.005);
        this.scene.sound.play('grenade', { volume: 0.7 });

        // Damage logic
        const damage = baseDamage * 3;
        const splashRange = 80;
        this.applySplashDamage(x, y, damage, splashRange, 30);
    }

    throwMortar(target, damage) {
        this.scene.sound.play('canon', { volume: 0.6 });
        const shellColor = this.isSuperMortar ? 0xff2222 : 0x333333;
        const trailColor = this.isSuperMortar ? 0xff4444 : 0x888888;
        const mortar = this.effectManager.spawnProjectile(this.effectManager.mortarPool, this.x, this.y - 40, this.isSuperMortar ? 12 : 8, shellColor);
        if (!mortar) return;
        
        mortar.setDepth(2001);
        const targetX = target.x;
        const targetY = target.y - 10;

        // Visual trail
        const particles = this.scene.add.particles(0, 0, 'circle_particle', {
            speed: 5,
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 600,
            follow: mortar,
            tint: trailColor
        }).setDepth(2000);

        // Parabolic trajectory
        this.scene.tweens.add({
            targets: mortar,
            x: targetX,
            duration: 1000,
            ease: 'Linear'
        });

        this.scene.tweens.add({
            targets: mortar,
            y: targetY - 250, // Higher arc for mortar
            duration: 500,
            yoyo: true,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.effectManager.recycleProjectile(this.effectManager.mortarPool, mortar);
                particles.destroy();
                this.explodeMortar(targetX, targetY, damage);
            }
        });
    }

    explodeMortar(x, y, baseDamage) {
        if (!this.scene || !this.active) return;

        // Visual effect - larger explosion
        const explosionColor = this.isSuperMortar ? 0xff2222 : 0xffaa00;
        const explosion = this.scene.add.circle(x, y, 15, explosionColor, 1).setDepth(3000);
        this.scene.tweens.add({
            targets: explosion,
            radius: this.isSuperMortar ? 150 : 100,
            alpha: 0,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => { if (explosion.active) explosion.destroy(); }
        });

        // Flash and shake
        this.scene.cameras.main.shake(150, 0.008);
        this.scene.sound.play('boom', { volume: 0.7 });

        // Damage logic
        const damageMult = this.isSuperMortar ? 10 : 5;
        const damage = baseDamage * damageMult;
        const splashRange = this.isSuperMortar ? 130 : 100;
        this.applySplashDamage(x, y, damage, splashRange, 50);
    }

    fireShotgun(target, damage) {
        if (!this.scene || !this.active) return;

        this.scene.sound.play('canon', { volume: 0.8, rate: 1.2 });
        this.scene.cameras.main.shake(150, 0.012);

        // Muzzle Flash
        const flash = this.scene.add.circle(this.x + (this.isAlly ? 40 : -40), this.y - 45, 35, 0xffaa00, 1).setDepth(3001);
        this.scene.tweens.add({
            targets: flash,
            scale: 2.5,
            alpha: 0,
            duration: 150,
            onComplete: () => flash.destroy()
        });

        // Powerful Visual: multiple pellets with trails
        const pelletCount = 18;
        const startX = this.x + (this.isAlly ? 40 : -40);
        const startY = this.y - 45;

        for (let i = 0; i < pelletCount; i++) {
            const pellet = this.effectManager.spawnProjectile(this.effectManager.pelletPool, startX, startY, 4, 0xffffff, 1);
            if (!pellet) continue;
            
            pellet.setDepth(3000);
            const angle = Phaser.Math.FloatBetween(-0.8, 0.8);
            const dist = Phaser.Math.FloatBetween(100, 180);
            const targetX = startX + (this.isAlly ? 1 : -1) * Math.cos(angle) * dist;
            const targetY = startY + Math.sin(angle) * dist;
            
            this.scene.tweens.add({
                targets: pellet,
                x: targetX,
                y: targetY,
                alpha: 0,
                scale: 0.2,
                duration: 400,
                ease: 'Power2',
                onComplete: () => this.effectManager.recycleProjectile(this.effectManager.pelletPool, pellet)
            });
            
            // Bullet trail line
            const line = this.scene.add.line(0, 0, startX, startY, targetX, targetY, 0xffdd00, 0.3).setOrigin(0).setDepth(2999);
            this.scene.tweens.add({
                targets: line,
                alpha: 0,
                duration: 250,
                onComplete: () => line.destroy()
            });
        }

        // Damage all units in 75px range
        const range = 75;
        const shotgunDamage = damage * 2.0;
        this.applySplashDamage(this.x, this.y, shotgunDamage, range, 120);
    }

    takeDamage(amount, fromAlly, isSplash = false) {
        // 슈퍼아머 발동 중에는 데미지 무시
        if (this.superArmorTimer > 0) return;

        const finalDamage = Math.max(1, amount - this.defense);
        this.hp -= finalDamage;

        // Track damage for global summary
        if (this.isAlly) {
            this.unitManager.allyDamageTaken += finalDamage;
        } else {
            this.unitManager.enemyDamageTaken += finalDamage;
        }
        this.hitFlashTimer = 100; // 0.1s white flash
        this.setTint(0xffffff);

        if (!fromAlly) {
            this.lastHitByEnemyTime = this.scene.time.now;
        }

        // 아군 유닛 공통: 스플래시 대미지(웨이브/폭발) 피격 시 뒤로 밀림 연출
        const isGlobalImmune = this.isAlly && (this.scene.heavyMetalRemainingTime > 0);
        if (isSplash && this.isAlly && !isGlobalImmune) {
            // 양문형 탱커는 밀려나는 대신 제자리에서 잠시 멈춤
            if (this.isDoubleDoorTank) {
                this.effectManager.playBlockEffect(this);
                if (Math.random() < 0.1) {
                    this.scene.sound.play('hit3', { volume: 0.4, rate: 1.2 });
                }
                this.stunRemainingTime = 300; // 0.3초간 제자리 멈춤
            } else {
                this.scene.tweens.add({
                    targets: this,
                    x: this.x - 50,
                    duration: 200,
                    ease: 'Cubic.easeOut'
                });
            }
        }

        // Hidden Skill: Tanker Super Armor
        if (this.typeKey === 'tanker' && this.specs.level >= 5) {
            this.superArmorTimer = 100; // 0.5s -> 0.1s Super Armor
        }

        // 보스 생존 AI: 체력이 50% 이하일 때 집중 포화를 당하면 후퇴 결정
        if (this.isBoss && this.isAlly && this.hp < this.maxHp * 0.5 && this.retreatTimer <= 0) {
            // 다른 아군이 전장에 있을 때만 후퇴 (어그로 넘기기)
            const otherAlly = this.unitManager.allies.find(a => a !== this && a.active && a.hp > 0);
            if (otherAlly) {
                this.retreatTimer = 2000; // 2초간 후퇴
            }
        }

        const hurtKey = `${this.spriteKey}_hurt`;
        if (this.scene.anims.exists(hurtKey)) {
            this.play(hurtKey, true);
        }

        this.effectManager.playHitEffect(this, amount);
    }

    useHeavyMetalSkill() {
        if (!this.scene) return;
        const messages = ['헤비메탈!', '나락도 락이다!', 'Rock will never die!', 'Rock you!'];
        const message = Phaser.Utils.Array.GetRandom(messages);
        this.scene.showFloatingText(message, this.x, this.y - 200, '#e74c3c');
        this.scene.sound.play('boss3_skill', { volume: 1.0 });
        this.scene.cameras.main.shake(500, 0.01);

        const enemies = this.unitManager.enemies;
        enemies.forEach(enemy => {
            if (enemy.active && enemy.hp > 0) {
                enemy.buffRemainingTime = 10000; // 10 seconds
            }
        });
    }

    updateBuffs(delta) {
        if (this.isShouting) return;

        if (this.catnipRemainingTime > 0) {
            this.catnipRemainingTime -= delta;
        }

        const isHeavyMetal = this.isAlly && (this.scene.heavyMetalRemainingTime > 0);
        const isCatnip = this.catnipRemainingTime > 0;
        
        if (this.buffRemainingTime > 0) {
            this.buffRemainingTime -= delta;
            const multiplier = this.unitManager.getStageScaleMultiplier();
            const ratio = Math.max(0, this.buffRemainingTime / 10000);
            this.setScale(this.baseScale * multiplier * (1 + 0.1 * ratio));
            
            if (this.hitFlashTimer <= 0) {
                if (isCatnip) {
                    this.setTint(0xff00ff); // Magenta for catnip
                } else if (isHeavyMetal) {
                    this.setTint(0xff4444);
                } else {
                    const greenBlue = Math.floor(136 + (255 - 136) * (1 - ratio));
                    this.setTint(Phaser.Display.Color.GetColor(255, greenBlue, greenBlue));
                }
            }

            if (this.buffRemainingTime <= 0) {
                this.setScale(this.baseScale * multiplier);
                if (this.hitFlashTimer <= 0 && !isHeavyMetal && !isCatnip) this.clearTint();
            }
        } else if (isCatnip) {
            if (this.hitFlashTimer <= 0) this.setTint(0xff00ff);
        } else if (isHeavyMetal) {
            if (this.hitFlashTimer <= 0) this.setTint(0xff4444);
        } else {
            const baseScaleFull = this.baseScale * this.unitManager.getStageScaleMultiplier();
            if (Math.abs(this.scaleX - baseScaleFull) > 0.01) {
                this.setScale(baseScaleFull);
            }
            if (this.hitFlashTimer <= 0 && this.isTinted) this.clearTint();
        }
    }

    updateUI() {
        if (this.isBoss && this.hpBarBg && this.hpBarFill) {
            const barY = this.y - this.displayHeight - 15;
            const barW = this.isAlly ? 80 : 120;

            this.hpBarBg.x = this.x;
            this.hpBarBg.y = barY;
            this.hpBarFill.x = this.x - barW / 2;
            this.hpBarFill.y = barY;
            this.hpBarFill.width = Math.max(0, barW * (this.hp / this.maxHp));
        }

        if (this.shadow) {
            this.shadow.x = this.x;
            this.shadow.y = this.y;
        }

        if (this.auraGraphic) {
            this.auraGraphic.x = this.x;
            this.auraGraphic.y = this.y;
            this.auraGraphic.setDepth(this.depth - 0.2);
        }
    }

    applyLeaderPerks() {
        const rawPerks = this.scene.registry.get('leaderPerks') || {};
        const perks = {
            shouting: typeof rawPerks.shouting === 'number' ? rawPerks.shouting : 0,
            dealing: typeof rawPerks.dealing === 'number' ? rawPerks.dealing : 0,
            tanking: typeof rawPerks.tanking === 'number' ? rawPerks.tanking : 0
        };

        // Collect all effect values
        const effects = {
            hp_mult: 0,
            dmg_mult: 0,
            speed_mult: 0,
            defense_add: 0,
            crit_chance_add: 0,
            all_stat_mult: 0,
            hp_regen_add: 0,
            has_splash: 0,
            attack_cooldown_mult: 0
        };

        Object.keys(LEADER_SKILL_TREE).forEach(branch => {
            const level = perks[branch];
            for (let i = 0; i < level; i++) {
                if (LEADER_SKILL_TREE[branch][i]) {
                    Object.entries(LEADER_SKILL_TREE[branch][i].effect).forEach(([key, val]) => {
                        if (effects[key] !== undefined) effects[key] += val;
                    });
                }
            }
        });

        // Apply stat bonuses
        const totalStatMult = 1 + effects.all_stat_mult;

        this.maxHp = Math.floor(this.maxHp * (1 + effects.hp_mult) * totalStatMult);
        this.hp = this.maxHp;
        this.attackDamage = Math.floor(this.attackDamage * (1 + effects.dmg_mult) * totalStatMult);
        this.speed = this.speed * (1 + effects.speed_mult) * totalStatMult;
        this.defense += effects.defense_add;
        this.attackCooldown = this.attackCooldown * (1 + effects.attack_cooldown_mult);

        // Crit logic (simplified: just store it for handleAttack)
        this.critChance = effects.crit_chance_add;
        this.hpRegen = effects.hp_regen_add;
        this.hasSplash = effects.has_splash > 0;
    }

    applySplashDamage(centerX, centerY, damage, splashRange, knockbackDist = 0, excludeUnit = null) {
        const opponents = this.isAlly ? this.unitManager.enemies : this.unitManager.allies;
        const tankers = opponents.filter(opp => opp.active && opp.hp > 0 && opp.isDoubleDoorTank);

        opponents.forEach(opp => {
            if (opp !== excludeUnit && opp.active && opp.hp > 0) {
                const dist = Math.abs(centerX - opp.x);
                if (dist <= splashRange) {
                    let finalDamage = damage;
                    
                    // Protection logic: if a Double Door Tank is between the explosion center and the opponent
                    const isProtected = tankers.some(tank => {
                        if (tank === opp) return false;
                        return (centerX > tank.x && opp.x < tank.x) || (centerX < tank.x && opp.x > tank.x);
                    });
                    
                    if (isProtected) finalDamage *= 0.2;

                    opp.takeDamage(finalDamage, this.isAlly, true);

                    // Knockback logic
                    if (knockbackDist > 0) {
                        const isGlobalImmune = opp.isAlly && (this.scene.heavyMetalRemainingTime > 0);
                        const isSuperArmor = (opp.typeKey === 'tanker' && opp.specs.level >= 5) || (opp.superArmorTimer > 0);
                        const isKnockbackImmune = opp.isKnockbackImmune || opp.isBoss || opp.isDoubleDoorTank || isSuperArmor || isGlobalImmune;
                        
                        if (!isKnockbackImmune) {
                            this.scene.tweens.add({
                                targets: opp,
                                x: opp.x + (this.isAlly ? knockbackDist : -knockbackDist),
                                duration: 200,
                                ease: 'Cubic.easeOut'
                            });
                        }
                    }
                }
            }
        });
    }

    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        if (this.shadow) this.shadow.setVisible(false);
        if (this.hpBarBg) this.hpBarBg.setVisible(false);
        if (this.hpBarFill) this.hpBarFill.setVisible(false);
        if (this.shieldGraphic) this.shieldGraphic.setVisible(false);
        if (this.auraGraphic) this.auraGraphic.setVisible(false);
        
        if (this.auraTween) this.auraTween.stop();
        if (this.breathingTween) this.breathingTween.stop();
    }

    destroy() {
        if (this.shadow) this.shadow.destroy();
        if (this.hpBarBg) this.hpBarBg.destroy();
        if (this.hpBarFill) this.hpBarFill.destroy();
        if (this.shieldGraphic) this.shieldGraphic.destroy();
        if (this.auraTween) this.auraTween.stop();
        if (this.auraGraphic) this.auraGraphic.destroy();
        if (this.breathingTween) this.breathingTween.stop();
        super.destroy();
    }
}
