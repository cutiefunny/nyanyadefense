import LEADER_SKILL_TREE from './leaderSkillTree.json';

export default class SkillManager {
    constructor(scene, unitManager) {
        this.scene = scene;
        this.unitManager = unitManager;

        this.cannonCooldown = 15000; // 15 seconds
        this.lastCannonTime = -20000; // Ready after 10s (if 30s cooldown)
    }

    updateConfig() {
        const skillLevels = this.scene.registry.get('skillLevels') || { shout_cooldown: 1, shout_duration: 1 };
        const currentCooldown = Math.max(5000, 15000 - (skillLevels.shout_cooldown - 1) * 1000);
        
        const rawPerks = this.scene.registry.get('leaderPerks') || {};
        const perks = {
            shouting: typeof rawPerks.shouting === 'number' ? rawPerks.shouting : 0,
            dealing: typeof rawPerks.dealing === 'number' ? rawPerks.dealing : 0,
            tanking: typeof rawPerks.tanking === 'number' ? rawPerks.tanking : 0
        };
        
        let perkEffects = { shout_cooldown_mult: 0 };
        Object.keys(LEADER_SKILL_TREE).forEach(branch => {
            const level = perks[branch];
            for (let i = 0; i < level; i++) {
                if (LEADER_SKILL_TREE[branch][i] && LEADER_SKILL_TREE[branch][i].effect) {
                    const eff = LEADER_SKILL_TREE[branch][i].effect;
                    if (eff.shout_cooldown_mult) perkEffects.shout_cooldown_mult += eff.shout_cooldown_mult;
                }
            }
        });

        const itemDeck = this.scene.registry.get('itemDeck') || [];
        const hasHeavyMetal = itemDeck.includes('heavy_metal');

        this.cannonCooldown = hasHeavyMetal ? 30000 : currentCooldown * (1 + perkEffects.shout_cooldown_mult);
        return { hasHeavyMetal, currentCooldown, perkEffects };
    }

    useShouting() {
        const { hasHeavyMetal, currentCooldown, perkEffects } = this.updateConfig();
        const skillLevels = this.scene.registry.get('skillLevels') || { shout_cooldown: 1, shout_duration: 1 };
        const currentDuration = 10000 + (skillLevels.shout_duration - 1) * 2000;
        const currentRange = 250; 

        let perkEffectsFull = {
            shout_range_mult: 0,
            shout_duration_add: 0,
        };

        const rawPerks = this.scene.registry.get('leaderPerks') || {};
        Object.keys(LEADER_SKILL_TREE).forEach(branch => {
            const level = (typeof rawPerks[branch] === 'number') ? rawPerks[branch] : 0;
            for (let i = 0; i < level; i++) {
                if (LEADER_SKILL_TREE[branch][i] && LEADER_SKILL_TREE[branch][i].effect) {
                    const eff = LEADER_SKILL_TREE[branch][i].effect;
                    if (eff.shout_range_mult) perkEffectsFull.shout_range_mult += eff.shout_range_mult;
                    if (eff.shout_duration_add) perkEffectsFull.shout_duration_add += eff.shout_duration_add;
                }
            }
        });

        const finalDuration = hasHeavyMetal ? 10000 : currentDuration + perkEffectsFull.shout_duration_add;
        const finalRange = currentRange * (1 + perkEffectsFull.shout_range_mult);
        const finalCooldown = this.cannonCooldown;

        if (this.scene.battleTime - this.lastCannonTime >= finalCooldown) {
            this.lastCannonTime = this.scene.battleTime;            
            const leader = this.unitManager.allies.find(u => u.isBoss && u.isAlly);
            if (leader) {
                const currentFullScale = leader.baseScale * this.unitManager.getStageScaleMultiplier();
                leader.setFrame(6);
                leader.isShouting = true;
                
                this.scene.tweens.add({
                    targets: leader,
                    scaleX: currentFullScale * 1.2,
                    scaleY: currentFullScale * 1.2,
                    duration: 500,
                    yoyo: true,
                    ease: 'Back.easeOut',
                    onComplete: () => {
                        leader.isShouting = false;
                        if (leader.active) {
                            leader.setFrame(0);
                            leader.setScale(currentFullScale);
                        }
                    }
                });

                if (hasHeavyMetal) {
                    this.scene.heavyMetalRemainingTime = finalDuration;
                    const messages = ['헤비메탈!', '나락도 락이다!', 'Rock will never die!', 'Rock you!', 'YEAHHHHH!'];
                    const message = Phaser.Utils.Array.GetRandom(messages);
                    this.scene.showFloatingText(message, leader.x, leader.y - 150, '#43d8c9');
                    this.scene.sound.play('boss3_skill', { volume: 0.8 });
                    this.scene.cameras.main.shake(500, 0.01);

                    // Show visual shockwave similar to boss
                    const circle = this.scene.add.circle(leader.x, leader.y - 50, 10, 0x43d8c9, 0.5).setDepth(3000);
                    this.scene.tweens.add({
                        targets: circle,
                        radius: 300,
                        alpha: 0,
                        duration: 800,
                        ease: 'Power2',
                        onComplete: () => circle.destroy()
                    });
                } else {
                    const effectColor = 0xff1111;
                    const shoutRing = this.scene.add.circle(leader.x, leader.y - leader.displayHeight / 2, 10, effectColor, 0)
                        .setOrigin(0.5)
                        .setDepth(3000)
                        .setStrokeStyle(8, effectColor, 1);

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
            }
            return true;
        }
        return false;
    }

    getCannonProgress() {
        this.updateConfig();
        const time = this.scene.battleTime;
        const ready = (time - this.lastCannonTime >= this.cannonCooldown);
        return ready ? 100 : Math.floor(((time - this.lastCannonTime) / this.cannonCooldown) * 100);
    }

    getCannonSeconds() {
        const time = this.scene.battleTime;
        const remainingMs = Math.max(0, this.cannonCooldown - (time - this.lastCannonTime));
        return Math.ceil(remainingMs / 1000);
    }
}
