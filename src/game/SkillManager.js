export default class SkillManager {
    constructor(scene, unitManager) {
        this.scene = scene;
        this.unitManager = unitManager;

        this.cannonCooldown = 15000; // 15 seconds
        this.lastCannonTime = -15000;
    }

    useShouting() {
        const skillLevels = this.scene.registry.get('skillLevels') || { shout_cooldown: 1, shout_duration: 1, shout_range: 1 };
        
        // Stats based on level
        const currentCooldown = Math.max(5000, 15000 - (skillLevels.shout_cooldown - 1) * 1000);
        const currentDuration = 10000 + (skillLevels.shout_duration - 1) * 2000;
        const currentRange = 250; // Fixed range instead of being level-dependent

        if (this.scene.battleTime - this.lastCannonTime >= currentCooldown) {
            this.lastCannonTime = this.scene.battleTime;
            this.cannonCooldown = currentCooldown; // For getCannonProgress calculation

            const leader = this.unitManager.allies.find(u => u.isBoss && u.isAlly);
            if (leader) {
                // 1. Animation: Show 6th frame (index 5) for 1 second + Scale up effect
                leader.setFrame(5);
                leader.isShouting = true;

                // Leader gets 10% bigger during shout (yoyo back to original)
                this.scene.tweens.add({
                    targets: leader,
                    scaleX: leader.baseScale * 1.1,
                    scaleY: leader.baseScale * 1.1,
                    duration: 500,
                    yoyo: true,
                    ease: 'Quad.easeInOut',
                    onComplete: () => {
                        leader.isShouting = false;
                        if (leader.active) {
                            leader.setFrame(0);
                            leader.setScale(leader.baseScale);
                        }
                    }
                });

                // 2. Shout Ring Effect (Single impactful Red ring)
                const shoutRing = this.scene.add.circle(leader.x, leader.y - leader.displayHeight / 2, 10, 0xff1111, 0)
                    .setOrigin(0.5)
                    .setDepth(3000)
                    .setStrokeStyle(8, 0xff1111, 1);

                this.scene.tweens.add({
                    targets: shoutRing,
                    radius: 160,
                    alpha: 0,
                    duration: 1000, // Slower expansion as requested
                    ease: 'Cubic.easeOut',
                    onComplete: () => shoutRing.destroy()
                });

                // 3. Buff Logic: Allies within currentRange
                this.unitManager.allies.forEach(ally => {
                    const dist = Phaser.Math.Distance.Between(leader.x, leader.y, ally.x, ally.y);
                    if (dist <= currentRange) {
                        ally.buffRemainingTime = currentDuration; 
                    }
                });
            }
            return true;
        }
        return false;
    }

    getCannonProgress() {
        const time = this.scene.battleTime;
        const ready = (time - this.lastCannonTime >= this.cannonCooldown);
        return ready ? 100 : Math.floor(((time - this.lastCannonTime) / this.cannonCooldown) * 100);
    }
}
