export default class SkillManager {
    constructor(scene, unitManager) {
        this.scene = scene;
        this.unitManager = unitManager;
        
        this.cannonCooldown = 15000; // 15 seconds
        this.lastCannonTime = -15000;

        // Cannon visual
        this.cannonBeam = this.scene.add.rectangle(400, 255, 800, 40, 0x43d8c9).setAlpha(0).setDepth(2000);
    }

    fireCannon() {
        if (this.scene.time.now - this.lastCannonTime >= this.cannonCooldown) {
            this.lastCannonTime = this.scene.time.now;

            // Visual effect
            this.cannonBeam.setAlpha(1);
            this.scene.tweens.add({
                targets: this.cannonBeam,
                alpha: 0,
                duration: 600,
                ease: 'Power2'
            });

            // Logic: Damage all enemies on screen.
            // In a real scenario we'd get them from unitManager
            const level = this.scene.level || 1;
            this.unitManager.enemies.forEach(enemy => {
                enemy.hp -= 200 + (level * 50);
            });

            this.scene.cameras.main.shake(300, 0.01);
            return true;
        }
        return false;
    }

    getCannonProgress() {
        const time = this.scene.time.now;
        const cannonReady = (time - this.lastCannonTime >= this.cannonCooldown);
        return cannonReady ? 100 : Math.floor(((time - this.lastCannonTime) / this.cannonCooldown) * 100);
    }
}
