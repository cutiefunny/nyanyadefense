import Phaser from 'phaser';

export default class UnitSkillHandler {
    static handleUpdate(unit, time, delta) {
        if (!unit.active || unit.hp <= 0) return;

        // 1. Tanker Super Armor (Hidden Skill)
        if (unit.typeKey === 'tanker' && unit.specs.level >= 5) {
            this.handleTankerSuperArmor(unit, delta);
        }

        // 2. Dash Logic (Normal / Raccoon level 5)
        if ((unit.typeKey === 'normal' || unit.typeKey === 'raccoon') && unit.specs.level >= 5) {
            this.handleDash(unit, time, delta);
        }

        // 3. Healer Aura (Level 5)
        if (unit.typeKey === 'healer' && unit.specs.level >= 5) {
            this.handleHealerAura(unit, delta);
        }

        // 4. Boss 3 Skill (Heavy Metal)
        if (unit.isBoss && !unit.isAlly && unit.typeKey === 'boss3') {
            this.handleBoss3Skill(unit, delta);
        }

        // 5. Boss 7 Shotgun
        if (unit.isBoss && !unit.isAlly && unit.typeKey === 'boss7') {
            this.handleBoss7Shotgun(unit, time);
        }
    }

    static handleTankerSuperArmor(unit, delta) {
        if (unit.superArmorTimer > 0) {
            unit.superArmorTimer -= delta;
            unit.stunRemainingTime = 0;
            if (unit.hitFlashTimer <= 0) {
                unit.setTint(0xf1c40f); // Golden tint
            }
            if (unit.superArmorTimer <= 0) {
                unit.clearTint();
            }
        }
    }

    static handleDash(unit, time, delta) {
        if (unit.dashCooldown > 0) {
            unit.dashCooldown -= delta;
        }

        const opponents = unit.isAlly ? unit.unitManager.enemies : unit.unitManager.allies;
        const target = unit.cachedTarget;
        
        if (!unit.isDashing && unit.dashCooldown <= 0 && target) {
            const minDist = Math.abs(unit.x - target.x) - (unit.logicWidth / 2 + target.logicWidth / 2);
            if (minDist <= 100 && minDist > unit.attackRange + 10) {
                unit.isDashing = true;
                unit.dashCooldown = 3000;
                const dashDist = minDist - unit.attackRange / 2;
                let dashTargetX = unit.x + (unit.isAlly ? dashDist : -dashDist);

                if (unit.isAlly) {
                    const enemyBoss = unit.unitManager.getEnemyBoss();
                    if (enemyBoss) dashTargetX = Math.min(dashTargetX, enemyBoss.x);
                }

                unit.scene.tweens.add({
                    targets: unit,
                    x: dashTargetX,
                    duration: 150,
                    ease: 'Cubic.easeOut',
                    onComplete: () => { unit.isDashing = false; }
                });
                unit.scene.sound.play('hit1', { volume: 0.3, rate: 2 });
            }
        }
    }

    static handleHealerAura(unit, delta) {
        unit.auraHealTimer = (unit.auraHealTimer || 0) + delta;
        if (unit.auraHealTimer >= 500) {
            const healAmount = 2 * (500 / 1000);
            const allies = unit.unitManager.allies;
            const multiplier = unit.unitManager.getStageScaleMultiplier();

            unit.auraHealEffectTimer = (unit.auraHealEffectTimer || 0) + 500;
            const shouldShowText = unit.auraHealEffectTimer >= 1000;
            if (shouldShowText) unit.auraHealEffectTimer = 0;

            allies.forEach(ally => {
                if (ally.active && ally.hp > 0) {
                    const dx = unit.x - ally.x;
                    const dy = unit.y - ally.y;
                    const rangeX = 50 * multiplier;
                    const rangeY = 40 * multiplier;
                    const isInside = (dx * dx) / (rangeX * rangeX) + (dy * dy) / (rangeY * rangeY) <= 1;

                    if (isInside) {
                        ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
                        if (shouldShowText) {
                            unit.scene.showFloatingText("+2", ally.x, ally.y - 30, "#2ecc71");
                        }
                    }
                }
            });
            unit.auraHealTimer -= 500;
        }
    }

    static handleBoss3Skill(unit, delta) {
        unit.skillTimer = (unit.skillTimer || 0) + delta;
        if (unit.skillTimer >= 30000) {
            unit.skillTimer = 0;
            unit.useHeavyMetalSkill();
        }
    }

    static handleBoss7Shotgun(unit, time) {
        unit.lastShotgunTime = unit.lastShotgunTime || 0;
        if (time - unit.lastShotgunTime >= 2000) {
            const target = unit.unitManager.allies.find(a => {
                if (!a.active || a.hp <= 0) return false;
                const dist = Math.abs(unit.x - a.x) - (unit.logicWidth / 2 + a.logicWidth / 2);
                return dist <= 60;
            });

            if (target) {
                unit.fireShotgun(target, unit.attackDamage);
                unit.lastShotgunTime = time;
            }
        }
    }
}
