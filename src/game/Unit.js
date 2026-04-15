import Phaser from 'phaser';

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
        if (isAlly) this.setFlipX(true);
        
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
        this.bonusKnockback = specs.bonusKnockback || 0;
        this.isKnockbackImmune = specs.isKnockbackImmune || false;
        this.stunRemainingTime = 0;
        this.buffRemainingTime = 0;
        this.hitFlashTimer = 0;
        this.retreatTimer = 0; // 보스 생존용 후퇴 타이머
        this.isBoss = specs.isBoss || false;
        this.reward = specs.reward || 0;

        // Visuals
        this.spriteKey = spriteKey;
        this.isSprite = true; // For compatibility with older checks
        
        this.shadow = scene.add.ellipse(x, y, isAlly ? 40 : 40, 12, 0x000000, 0.25).setDepth(this.depth - 0.1);
        if (this.isBoss) {
            this.shadow.setSize(isAlly ? 80 : 120, 16);
            this.createHPBar();
        }
    }

    createHPBar() {
        const barW = this.isAlly ? 80 : 120;
        const barY = this.y - this.displayHeight - 15;
        // Background with thin border effect using overlap
        this.hpBarBg = this.scene.add.rectangle(this.x, barY, barW + 4, 12, 0x000000).setDepth(2000);
        this.hpBarFill = this.scene.add.rectangle(this.x - barW / 2, barY, barW, 8, this.isAlly ? 0x2ecc71 : 0xe74c3c).setDepth(2001).setOrigin(0, 0.5);
    }

    update(time, delta, opponents) {
        if (this.hp <= 0) return 'dead';

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

        // Handle Stun
        if (this.stunRemainingTime > 0) {
            this.stunRemainingTime -= delta;
            desiredMove = 0;
            target = null;
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

        // Handle Attack
        if (target && minDist <= this.attackRange) {
            this.handleAttack(time, target);
        }

        // Handle Buffs
        this.updateBuffs(delta);

        // Update UI
        this.updateUI();

        return null;
    }

    findTarget(opponents) {
        let target = null;
        let minDist = Infinity;
        const halfW = this.logicWidth / 2;

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
                // Simplified AI: Just move forward unless an enemy is in range
                else if (target && minDist <= this.attackRange) {
                    desiredMove = 0;
                } else {
                    desiredMove = 1;
                }
            } else {
                desiredMove = 0;
            }
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
        let moveAmount = this.speed * (delta / 16) * desiredMove;
        
        // Map bounds
        if (desiredMove === -1) {
            // 수정: 경계를 100에서 20으로 변경하여 보스(초기 x=50)가 정상 이동 가능하게 함
            if (this.isAlly && this.x + moveAmount < 20) moveAmount = 0;
            if (!this.isAlly && this.x + moveAmount > 780) moveAmount = 0;
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
            target.takeDamage(currentDamage, this.isAlly);
            this.lastAttackTime = time;

            this.scene.sound.play('hit' + Phaser.Math.Between(1, 3), { volume: 0.5 });

            // Knockback Logic: Bosses are ALWAYS immune to knockback
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

            // [수정] 원거리 유닛도 투사체 없이 즉시 피격 (요청 사항)
            // if (this.attackRange > 20 && this.typeKey !== 'shooter' && !this.isBoss) {
            //     this.effectManager.createProjectile(this.x, this.y, target, this.isAlly);
            // }

            this.effectManager.playAttackAnimation(this, this.isAlly);

            if (this.typeKey === 'shooter') {
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

    takeDamage(amount, fromAlly) {
        const finalDamage = Math.max(1, amount - this.defense);
        this.hp -= finalDamage;
        this.hitFlashTimer = 100; // 0.1s white flash
        this.setTint(0xffffff);
        
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
    }

    destroy() {
        if (this.shadow) this.shadow.destroy();
        if (this.hpBarBg) this.hpBarBg.destroy();
        if (this.hpBarFill) this.hpBarFill.destroy();
        if (this.breathingTween) this.breathingTween.stop();
        super.destroy();
    }
}
