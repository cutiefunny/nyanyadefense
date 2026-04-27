export default class EffectManager {
    constructor(scene) {
        this.scene = scene;
        
        // 1. Create a centralized Particle Emitter for performance (Avoid GC)
        this.hitEmitter = this.scene.add.particles(0, 0, '__white', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 200,
            gravityY: 200,
            blendMode: 'ADD',
            tint: [0xfff176, 0xffeb3b, 0xffc107],
            emitting: false
        }).setDepth(3000);
    }

    flashScreen(color = 0xffffff, duration = 100) {
        const flash = this.scene.add.rectangle(400, 150, 800, 300, color)
            .setAlpha(0)
            .setDepth(10000)
            .setScrollFactor(0);
        
        this.scene.tweens.add({
            targets: flash,
            alpha: 0.5,
            duration: duration / 2,
            yoyo: true,
            onComplete: () => flash.destroy()
        });
    }

    playVictoryCelebration() {
        this.flashScreen(0x43d8c9, 300);
    }

    playDefeatEffect() {
        this.flashScreen(0xe94560, 200); // 500 -> 200
        this.scene.cameras.main.shake(200, 0.005); // 500, 0.01 -> 200, 0.005
    }

    playHitEffect(target, damage) {
        const targetVisual = target.rect || target;
        if (!targetVisual || !targetVisual.active) return;

        // 2. Emit particles (Very cheap compared to creating new Stars/Tweens)
        this.hitEmitter.emitParticleAt(
            targetVisual.x + (Math.random() - 0.5) * 20,
            targetVisual.y - 30 + (Math.random() - 0.5) * 20,
            4
        );

        // 3. Vibration (Optimized shake)
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
        // Fade out UI elements
        const uiElements = [unit.hpBarBg, unit.hpBarFill, unit.shadow].filter(e => e);
        if (uiElements.length > 0) {
            this.scene.tweens.add({
                targets: uiElements,
                alpha: 0,
                duration: 250
            });
        }
        
        if (unit.isSprite) {
            unit.stop(); // Stop any playing animation
            // Use frame 4 (hurt) for normal units, frame 0 for bosses
            const deathFrame = unit.isBoss ? 0 : 4;
            try {
                unit.setFrame(deathFrame);
            } catch (e) {
                unit.setFrame(0);
            }
            unit.clearTint();
        }

        // isAlly faces right: falls left (-90 deg)
        // !isAlly faces left: falls right (90 deg)
        const fallAngle = unit.isAlly ? -90 : 90; 

        this.scene.tweens.add({
            targets: unit,
            alpha: 0,
            angle: fallAngle,
            y: unit.y + 20, // Feel like falling into the ground
            duration: 600,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                if (unit.active) unit.destroy();
            }
        });
    }

}
