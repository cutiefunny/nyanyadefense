import LEADER_SKILL_TREE from './leaderSkillTree.json';

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
        const currentRange = 250; 

        // Apply Leader Perks
        const rawPerks = this.scene.registry.get('leaderPerks') || {};
        const perks = {
            shouting: typeof rawPerks.shouting === 'number' ? rawPerks.shouting : 0,
            dealing: typeof rawPerks.dealing === 'number' ? rawPerks.dealing : 0,
            tanking: typeof rawPerks.tanking === 'number' ? rawPerks.tanking : 0
        };
        
        let perkEffects = {
            shout_range_mult: 0,
            shout_duration_add: 0,
            shout_cooldown_mult: 0
        };

        Object.keys(LEADER_SKILL_TREE).forEach(branch => {
            const level = perks[branch];
            for (let i = 0; i < level; i++) {
                if (LEADER_SKILL_TREE[branch][i] && LEADER_SKILL_TREE[branch][i].effect) {
                    const eff = LEADER_SKILL_TREE[branch][i].effect;
                    if (eff.shout_range_mult) perkEffects.shout_range_mult += eff.shout_range_mult;
                    if (eff.shout_duration_add) perkEffects.shout_duration_add += eff.shout_duration_add;
                    if (eff.shout_cooldown_mult) perkEffects.shout_cooldown_mult += eff.shout_cooldown_mult;
                }
            }
        });

        const finalCooldown = currentCooldown * (1 + perkEffects.shout_cooldown_mult);
        const finalDuration = currentDuration + perkEffects.shout_duration_add;
        const finalRange = currentRange * (1 + perkEffects.shout_range_mult);

        if (this.scene.battleTime - this.lastCannonTime >= finalCooldown) {
            this.lastCannonTime = this.scene.battleTime;
            this.cannonCooldown = finalCooldown; 
            
            const leader = this.unitManager.allies.find(u => u.isBoss && u.isAlly);
            if (leader) {
                // ... animation logic ...
                leader.setFrame(5);
                leader.isShouting = true;
                
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

                const shoutRing = this.scene.add.circle(leader.x, leader.y - leader.displayHeight / 2, 10, 0xff1111, 0)
                    .setOrigin(0.5)
                    .setDepth(3000)
                    .setStrokeStyle(8, 0xff1111, 1);

                this.scene.tweens.add({
                    targets: shoutRing,
                    radius: finalRange * 0.65, // Adjust visual ring to match range
                    alpha: 0,
                    duration: 1000, 
                    ease: 'Cubic.easeOut',
                    onComplete: () => shoutRing.destroy()
                });

                this.unitManager.allies.forEach(ally => {
                    const dist = Phaser.Math.Distance.Between(leader.x, leader.y, ally.x, ally.y);
                    if (dist <= finalRange) {
                        ally.buffRemainingTime = finalDuration; 
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
