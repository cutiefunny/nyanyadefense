export default class SkillManager {
    constructor(scene, unitManager) {
        this.scene = scene;
        this.unitManager = unitManager;
        
        this.cannonCooldown = 15000; // 15 seconds
        this.lastCannonTime = -15000;
    }

    useShouting() {
        if (this.scene.time.now - this.lastCannonTime >= this.cannonCooldown) {
            this.lastCannonTime = this.scene.time.now;

            const leader = this.unitManager.allies.find(u => u.isBoss && u.isAlly);
            if (leader) {
                // 1. Animation: Show 6th frame (index 5) for 1 second
                leader.setFrame(5);
                leader.isShouting = true;
                
                this.scene.time.delayedCall(1000, () => {
                    leader.isShouting = false;
                    if (leader.active) leader.setFrame(0);
                });

                // 2. Shout Ring Effect (Expands from leader)
                const shoutRing = this.scene.add.circle(leader.x, leader.y - leader.displayHeight/2, 10, 0xffffff, 0.4).setDepth(3000);
                this.scene.tweens.add({
                    targets: shoutRing,
                    radius: 150,
                    alpha: 0,
                    duration: 600,
                    ease: 'Cubic.easeOut',
                    onComplete: () => shoutRing.destroy()
                });

                // 3. Buff Logic: 150px radius allies
                this.unitManager.allies.forEach(ally => {
                    const dist = Phaser.Math.Distance.Between(leader.x, leader.y, ally.x, ally.y);
                    if (dist <= 150) {
                        ally.buffRemainingTime = 10000; // 10 seconds
                    }
                });

                // 3. Screen visual
                this.scene.cameras.main.flash(500, 255, 255, 255, 0.2);
                this.scene.cameras.main.shake(500, 0.005);
            }
            return true;
        }
        return false;
    }

    getCannonProgress() {
        const time = this.scene.time.now;
        const ready = (time - this.lastCannonTime >= this.cannonCooldown);
        return ready ? 100 : Math.floor(((time - this.lastCannonTime) / this.cannonCooldown) * 100);
    }
}
