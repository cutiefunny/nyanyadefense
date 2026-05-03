import Phaser from 'phaser';
import LEADER_SKILL_TREE from './leaderSkillTree.json';

export default class Unit extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, spriteKey, specs, isAlly, unitManager) {
        super(scene, x, y, spriteKey);
        scene.add.existing(this);

        this.unitManager = unitManager;
        this.effectManager = unitManager.effectManager;
        this.isAlly = isAlly;
        this.specs = specs;
        this.typeKey = specs.type || specs.typeKey;

        // Basic properties
        this.setOrigin(0.5, 1);
        const multiplier = unitManager.getStageScaleMultiplier();
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
        this.hitFlashTimer = 0;
        this.retreatTimer = 0; // 보스 생존용 후퇴 타이머
        this.isBoss = specs.isBoss || false;
        this.reward = specs.reward || 0;
        this.lastHitByEnemyTime = 0;
        this.deckIndex = specs.deckIndex;
        this.superArmorTimer = 0; // Hidden skill timer for tanker
        this.dashCooldown = 0; // Hidden skill for normal unit
        this.isDashing = false;

        this.isMortarMode = specs.isMortarMode || false;
        if (this.isMortarMode) {
            this.speed = 0;
            this.attackRange = 800; // Screen-wide range
            this.attackCooldown = 5000; // 5 seconds
            this.isKnockbackImmune = true;
        }

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

        this.shadow = scene.add.ellipse(x, y, isAlly ? 40 : 40, 12, 0x000000, 0.25).setDepth(this.depth - 0.1);
        if (this.isBoss) {
            this.shadow.setSize(isAlly ? 80 : 120, 16);
            this.createHPBar();
        }

        // Healer Aura (Hidden Skill: 장판힐) Range Graphic
        if (this.typeKey === 'healer' && this.specs.level >= 5 && isAlly) {
            const auraW = 100 * multiplier;
            const auraH = 40 * multiplier;
            this.auraGraphic = this.scene.add.ellipse(x, y, auraW, auraH, 0x2ecc71, 0.2).setDepth(this.depth - 0.2);
            this.scene.tweens.add({
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
        // Background with thin border effect using overlap
        this.hpBarBg = this.scene.add.rectangle(this.x, barY, barW + 4, 12, 0x000000).setDepth(2000);
        this.hpBarFill = this.scene.add.rectangle(this.x - barW / 2, barY, barW, 8, this.isAlly ? 0x2ecc71 : 0xe74c3c).setDepth(2001).setOrigin(0, 0.5);
    }

    createShield() {
        // Position it in front of the tank (right side for allies)
        const shieldX = this.x + 25;
        const shieldY = this.y - 35;
        this.shieldGraphic = this.scene.add.image(shieldX, shieldY, 'item_shield')
            .setDepth(this.depth + 1);

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

        let target = this.findTarget(opponents);
        let minDist = Infinity;
        if (target) {
            minDist = Math.abs(this.x - target.x) - (this.logicWidth / 2 + target.logicWidth / 2);
        }

        let desiredMove = this.getDesiredMove(target, minDist);

        // Handle Super Armor (Hidden Skill)
        if (this.superArmorTimer > 0) {
            this.superArmorTimer -= delta;
            this.stunRemainingTime = 0; // Clear stun while super armor is active
            if (this.hitFlashTimer <= 0) {
                this.setTint(0xf1c40f); // Golden tint for super armor
            }
            if (this.superArmorTimer <= 0) {
                this.clearTint();
            }
        }

        // Handle Dash logic (Normal unit level 5)
        if (this.dashCooldown > 0) {
            this.dashCooldown -= delta;
        }
        if (this.typeKey === 'normal' && !this.isBoss && !this.isDashing && this.dashCooldown <= 0 && target && minDist <= 100 && minDist > this.attackRange + 10) {
            if (this.specs.level >= 5) {
                this.isDashing = true;
                this.dashCooldown = 3000; // 3s cooldown
                const dashDist = minDist - this.attackRange / 2;
                let dashTargetX = this.x + (this.isAlly ? dashDist : -dashDist);

                // Limit dash target for allies
                if (this.isAlly) {
                    const enemyBoss = this.unitManager.getEnemyBoss();
                    if (enemyBoss) dashTargetX = Math.min(dashTargetX, enemyBoss.x);
                }

                this.scene.tweens.add({
                    targets: this,
                    x: dashTargetX,
                    duration: 150,
                    ease: 'Cubic.easeOut',
                    onComplete: () => { this.isDashing = false; }
                });
                this.scene.sound.play('hit1', { volume: 0.3, rate: 2 }); // Whoosh sound
            }
        }

        // Handle Stun
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

        // Boss 3 Guitar Playing Animation (Heavy Metal Skill)
        if (this.typeKey === 'boss3' && this.isBoss && !this.isAlly && this.buffRemainingTime > 0) {
            this.guitarTimer = (this.guitarTimer || 0) + delta;
            if (this.guitarTimer >= 100) {
                this.guitarTimer = 0;
                // Alternate between frame 0 and 1
                const nextFrame = (this.frame.name == 0) ? 1 : 0;
                this.setFrame(nextFrame);
            }
        }

        // Handle Attack
        let canAttack = true;
        if (this.isBoss && this.isAlly && this.scene.isAutoMode && !this.isDragging) {
            const tankers = this.unitManager.allies.filter(a => a.typeKey === 'tanker' && a.hp > 0);
            const isAnyTankerHit = tankers.some(t => t.hp < t.maxHp || (this.scene.time.now - (t.lastHitByEnemyTime || 0) < 3000));
            if (tankers.length > 0 && !isAnyTankerHit) {
                canAttack = false;
            }
        }

        if (this.isMortarMode) {
            if (time - this.lastAttackTime >= this.attackCooldown) {
                this.lastAttackTime = time;
                if (target) {
                    this.throwMortar(target, this.attackDamage);
                    this.play(`${this.spriteKey}_attack`, true);

                    // Recoil Effect: Move back slightly and return
                    const originalX = this.x;
                    this.scene.tweens.add({
                        targets: this,
                        x: originalX - 10,
                        duration: 100,
                        yoyo: true,
                        ease: 'Power1',
                        onComplete: () => {
                            this.x = originalX;
                        }
                    });

                    // Return to idle after 0.3 seconds
                    this.scene.time.delayedCall(300, () => {
                        if (this.active && this.hp > 0) {
                            this.play(`${this.spriteKey}_idle`, true);
                        }
                    });
                }
            }
            return;
        }

        if (canAttack && target && minDist <= this.attackRange) {
            this.handleAttack(time, target);
        }

        // Handle Buffs
        this.updateBuffs(delta);

        // Handle Boss Skills (롹시코기 Stage 3 Boss)
        if (this.isBoss && !this.isAlly && this.typeKey === 'boss3') {
            this.skillTimer = (this.skillTimer || 0) + delta;
            if (this.skillTimer >= 30000) {
                this.skillTimer = 0;
                console.log('[Boss Skill] Triggering Heavy Metal');
                this.useHeavyMetalSkill();
            }
        }

        // Limit ally position to be no further than enemy boss (적 보스보다 더 오른쪽에 위치 금지)
        if (this.isAlly && this.hp > 0) {
            const enemyBoss = this.unitManager.getEnemyBoss();
            if (enemyBoss) {
                const stopX = enemyBoss.x - enemyBoss.logicWidth / 2;
                if (this.x > stopX) {
                    this.x = stopX;
                }
            }
        }

        // Handle Healer Aura (Hidden Skill: 장판힐)
        if (this.typeKey === 'healer' && this.specs.level >= 5 && this.hp > 0) {
            const healAmount = 2 * (delta / 1000);
            const allies = this.unitManager.allies;
            const multiplier = this.unitManager.getStageScaleMultiplier();

            // Timer to show floating text for all healed units once per second
            this.auraHealEffectTimer = (this.auraHealEffectTimer || 0) + delta;
            const shouldShowText = this.auraHealEffectTimer >= 1000;
            if (shouldShowText) this.auraHealEffectTimer = 0;

            allies.forEach(ally => {
                if (ally.active && ally.hp > 0) {
                    const dx = this.x - ally.x;
                    const dy = this.y - ally.y;

                    // Elliptical distance check scaled by stage multiplier
                    const rangeX = 50 * multiplier;
                    const rangeY = 40 * multiplier;
                    const isInside = (dx * dx) / (rangeX * rangeX) + (dy * dy) / (rangeY * rangeY) <= 1;

                    if (isInside) {
                        ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);

                        // Show floating text for ALL units being healed, periodically
                        if (shouldShowText) {
                            this.scene.showFloatingText("+2", ally.x, ally.y - 30, "#2ecc71");
                        }
                    }
                }
            });
        }

        // Update UI
        this.updateUI();

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
                const distToTank = Math.abs(this.x - doubleDoorTank.x) - (halfW + doubleDoorTank.logicWidth / 2);
                if (distToTank <= this.attackRange + 100) { // If within reach or close enough to prioritize
                    return doubleDoorTank;
                }
            }
        }

        for (let j = 0; j < opponents.length; j++) {
            const opp = opponents[j];
            const dist = Math.abs(this.x - opp.x) - (halfW + opp.logicWidth / 2);

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

                    const opponents = this.isAlly ? this.unitManager.enemies : this.unitManager.allies;
                    opponents.forEach(opp => {
                        if (opp !== target && opp.active && opp.hp > 0) {
                            const dist = Math.abs(target.x - opp.x);
                            if (dist <= splashRange) {
                                opp.takeDamage(damageToApply * splashDamageMult, this.isAlly);
                                // Splash visual
                                const circle = this.scene.add.circle(opp.x, opp.y - 20, 15, 0xffaa00, 0.6).setDepth(3000);
                                this.scene.tweens.add({
                                    targets: circle,
                                    alpha: 0,
                                    scale: 1.5,
                                    duration: 200,
                                    onComplete: () => circle.destroy()
                                });
                            }
                        }
                    });
                }

                this.scene.sound.play('hit' + Phaser.Math.Between(1, 3), { volume: 0.5 });

                const knockbackChance = 0.10 + this.bonusKnockback;
                if (!target.isKnockbackImmune && !target.isBoss && Math.random() <= knockbackChance) {
                    target.stunRemainingTime = 400;
                    this.scene.tweens.add({
                        targets: target,
                        x: target.x + (this.isAlly ? 40 : -40),
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

                        // 양문형 탱커 보호 로직: 해당 유닛보다 오른쪽에 양문형 탱커가 있다면 데미지 80% 감소 (20%만 적용)
                        const isProtected = allies.some(other =>
                            other !== ally &&
                            other.active &&
                            other.hp > 0 &&
                            other.isDoubleDoorTank &&
                            other.x > ally.x
                        );

                        if (isProtected && !ally.isDoubleDoorTank) {
                            currentDamageMult *= 0.2;
                        }

                        ally.takeDamage(this.attackDamage * currentDamageMult, this.isAlly, true);
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
        const grenade = this.scene.add.circle(this.x, this.y - 40, 6, 0x333333).setDepth(2001);
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
                if (grenade.active) grenade.destroy();
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
        this.scene.sound.play('hit' + Phaser.Math.Between(1, 3), { volume: 0.8, rate: 0.5 });

        // Damage logic
        const damage = baseDamage * 3;
        const splashRange = 80;
        const opponents = this.isAlly ? this.unitManager.enemies : this.unitManager.allies;

        opponents.forEach(opp => {
            if (opp.active && opp.hp > 0) {
                const dist = Math.abs(x - opp.x);
                if (dist <= splashRange) {
                    opp.takeDamage(damage, this.isAlly, true);
                    if (!opp.isKnockbackImmune && !opp.isBoss) {
                        this.scene.tweens.add({
                            targets: opp,
                            x: opp.x + (this.isAlly ? 30 : -30),
                            duration: 150,
                            ease: 'Cubic.easeOut'
                        });
                    }
                }
            }
        });
    }

    throwMortar(target, damage) {
        const mortar = this.scene.add.circle(this.x, this.y - 40, 8, 0x333333).setDepth(2001);
        const targetX = target.x;
        const targetY = target.y - 10;

        // Visual trail
        const particles = this.scene.add.particles(0, 0, 'circle_particle', {
            speed: 5,
            scale: { start: 0.3, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 600,
            follow: mortar,
            tint: 0x888888
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
                if (mortar.active) mortar.destroy();
                particles.destroy();
                this.explodeMortar(targetX, targetY, damage);
            }
        });
    }

    explodeMortar(x, y, baseDamage) {
        if (!this.scene || !this.active) return;

        // Visual effect - larger explosion
        const explosion = this.scene.add.circle(x, y, 15, 0xffaa00, 1).setDepth(3000);
        this.scene.tweens.add({
            targets: explosion,
            radius: 100,
            alpha: 0,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => { if (explosion.active) explosion.destroy(); }
        });

        // Flash and shake
        this.scene.cameras.main.shake(150, 0.008);
        this.scene.sound.play('hit' + Phaser.Math.Between(1, 3), { volume: 1.0, rate: 0.4 });

        // Damage logic - stronger than grenade
        const damage = baseDamage * 5;
        const splashRange = 100;
        const opponents = this.isAlly ? this.unitManager.enemies : this.unitManager.allies;

        opponents.forEach(opp => {
            if (opp.active && opp.hp > 0) {
                const dist = Math.abs(x - opp.x);
                if (dist <= splashRange) {
                    opp.takeDamage(damage, this.isAlly, true);
                    if (!opp.isKnockbackImmune && !opp.isBoss) {
                        this.scene.tweens.add({
                            targets: opp,
                            x: opp.x + (this.isAlly ? 50 : -50),
                            duration: 200,
                            ease: 'Cubic.easeOut'
                        });
                    }
                }
            }
        });
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
        if (isSplash && this.isAlly) {
            // 양문형 탱커는 추가적인 블록 이펙트 발생
            if (this.isDoubleDoorTank) {
                this.effectManager.playBlockEffect(this);
                this.scene.sound.play('hit3', { volume: 0.4, rate: 1.2 });
            }

            this.scene.tweens.add({
                targets: this,
                x: this.x - 50,
                duration: 200,
                ease: 'Cubic.easeOut'
            });
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
        this.scene.showFloatingText('헤비메탈 발동!', this.x, this.y - 120, '#e74c3c');
        this.scene.sound.play('hit3', { volume: 0.8, rate: 0.5 });
        this.scene.cameras.main.shake(500, 0.01);

        const enemies = this.unitManager.enemies;
        enemies.forEach(enemy => {
            if (enemy.active && enemy.hp > 0) {
                enemy.buffRemainingTime = 10000; // 10 seconds
            }
        });
    }

    updateBuffs(delta) {
        if (this.buffRemainingTime > 0) {
            this.buffRemainingTime -= delta;
            const multiplier = this.unitManager.getStageScaleMultiplier();
            const ratio = Math.max(0, this.buffRemainingTime / 10000);
            this.setScale(this.baseScale * multiplier * (1 + 0.1 * ratio));

            if (this.hitFlashTimer <= 0) {
                const greenBlue = Math.floor(136 + (255 - 136) * (1 - ratio));
                this.setTint(Phaser.Display.Color.GetColor(255, greenBlue, greenBlue));
            }

            if (this.buffRemainingTime <= 0) {
                this.setScale(this.baseScale * multiplier);
                if (this.hitFlashTimer <= 0) this.clearTint();
            }
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

    destroy() {
        if (this.shadow) this.shadow.destroy();
        if (this.hpBarBg) this.hpBarBg.destroy();
        if (this.hpBarFill) this.hpBarFill.destroy();
        if (this.shieldGraphic) this.shieldGraphic.destroy();
        if (this.auraGraphic) this.auraGraphic.destroy();
        if (this.breathingTween) this.breathingTween.stop();
        super.destroy();
    }
}
