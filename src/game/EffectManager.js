export default class EffectManager {
    constructor(scene) {
        this.scene = scene;
    }

    playHitEffect(target, damage) {
        const targetVisual = target.rect || target;
        if (!targetVisual || !targetVisual.active) return;

        // 1. Spawning a hit spark particle
        const spark = this.scene.add.star(
            targetVisual.x + (Math.random() - 0.5) * 30,
            targetVisual.y - 30 + (Math.random() - 0.5) * 30,
            4, 3, 10, 0xffeb3b
        ).setDepth(3000);

        this.scene.tweens.add({
            targets: spark,
            scale: Math.random() * 1.5 + 1,
            alpha: 0,
            angle: Phaser.Math.Between(-90, 90),
            duration: 150,
            onComplete: () => spark.destroy()
        });

        // 2. Vibration (Position & Angle Shake)
        const originalX = targetVisual.x;
        const dir = Math.random() > 0.5 ? 1 : -1;
        
        this.scene.tweens.add({
            targets: targetVisual,
            x: originalX + (dir * 4),
            angle: dir * 6,
            yoyo: true,
            duration: 40,
            onComplete: () => {
                if (targetVisual.active) {
                    targetVisual.x = originalX;
                    targetVisual.angle = 0;
                }
            }
        });

        // 4. Subtle screen shake for heavy hits
        if (damage >= 20) {
            this.scene.cameras.main.shake(40, 0.002);
        }

        // Play hurt animation if applicable
        if (target.isSprite && target.active && target.hp > 0) {
            const hurtKey = `${target.spriteKey}_hurt`;
            const idleKey = `${target.spriteKey}_idle`;
            target.play(hurtKey, true);
            target.once(`animationcomplete-${hurtKey}`, () => {
                if (target.active && target.hp > 0) target.play(idleKey, true);
            });
        } else if (!target.isSprite) {
            this.scene.tweens.add({
                targets: targetVisual,
                alpha: 0.5,
                duration: 100,
                yoyo: true,
            });
        }
    }

    createProjectile(startX, startY, target, isAlly) {
        let projectileType = isAlly ? 0x43d8c9 : 0xe94560;
        const proj = this.scene.add.circle(startX, startY, 4, projectileType).setDepth(2000);
        this.scene.tweens.add({
            targets: proj,
            x: target.rect ? target.rect.x : target.x,
            y: target.rect ? target.rect.y : target.y,
            duration: 150,
            onComplete: () => proj.destroy()
        });
    }

    playAttackAnimation(unit, isAlly) {
        if (unit.isSprite) {
            const attackKey = `${unit.spriteKey}_attack`;
            const idleKey = `${unit.spriteKey}_idle`;
            unit.play(attackKey, true);
            unit.once(`animationcomplete-${attackKey}`, () => {
                if (unit.active && unit.hp > 0) unit.play(idleKey, true);
            });
        } else {
            this.scene.tweens.add({
                targets: unit,
                x: unit.x + (isAlly ? 8 : -8),
                duration: 80,
                yoyo: true,
            });
        }
    }

    playDeathEffect(unit) {
        if (unit.hpBarBg) this.scene.add.tween({ targets: unit.hpBarBg, alpha: 0, duration: 200, onComplete: () => unit.hpBarBg.destroy() });
        if (unit.hpBarFill) this.scene.add.tween({ targets: unit.hpBarFill, alpha: 0, duration: 200, onComplete: () => unit.hpBarFill.destroy() });
        if (unit.shadow) this.scene.add.tween({ targets: unit.shadow, alpha: 0, duration: 200, onComplete: () => unit.shadow.destroy() });
        
        this.scene.add.tween({
            targets: unit,
            alpha: 0,
            scale: 1.5,
            duration: 200,
            onComplete: () => unit.destroy()
        });
    }
}
