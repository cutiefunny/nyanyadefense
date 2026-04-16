export const ALLY_TYPES = {
    normal: { cost: 0, hp: 80, speed: 1.2, damage: 8, range: 10, cooldown: 1000, color: 0x43d8c9, w: 30, h: 30, name: 'Normal Cat', bonusKnockback: 0, scale: 0.5 },
    tanker: { cost: 500, hp: 1000, speed: 0.6, damage: 25, range: 15, cooldown: 1500, color: 0x3498db, w: 45, h: 45, name: 'Tanker Cat', bonusKnockback: 0.2, scale: 0.7, isKnockbackImmune: true, defense: 10 },
    shooter: { cost: 300, hp: 120, speed: 1.0, damage: 18, range: 180, cooldown: 800, color: 0x9b59b6, w: 20, h: 40, name: 'Shooter Cat', bonusKnockback: -0.1, scale: 0.5 }
};

export const ENEMY_TYPES = [
    { type: 'dog', hp: 150, speed: -0.8, damage: 15, range: 10, cooldown: 1200, color: 0xe94560, w: 40, h: 40, bonusKnockback: 0, scale: 0.65, reward: 25 },
    { type: 'wawa', hp: 120, speed: -2.0, damage: 12, range: 10, cooldown: 500, color: 0xffffff, w: 25, h: 25, bonusKnockback: 0, scale: 0.5, reward: 20 }
];

export const BOSS_CONFIG = {
    leader: { hp: 1500, speed: 1.2, damage: 25, range: 25, cooldown: 1500, w: 60, h: 60, isKnockbackImmune: true, scale: 0.7, reward: 0, isBoss: true, defense: 2 },
    boss: { hp: 8000, speed: 0, damage: 80, range: 30, cooldown: 2000, w: 100, h: 100, isKnockbackImmune: true, scale: 0.5, reward: 500, isBoss: true, defense: 5 }
};
