export const ALLY_TYPES = {
    normal: { cost: 30, hp: 100, speed: 1.2, damage: 10, range: 10, cooldown: 1000, color: 0x43d8c9, w: 30, h: 30, name: 'Normal Cat', bonusKnockback: 0, scale: 0.5 },
    tanker: { cost: 150, hp: 500, speed: 0.6, damage: 15, range: 15, cooldown: 1500, color: 0x3498db, w: 45, h: 45, name: 'Tanker Cat', bonusKnockback: 0.2, scale: 0.7, isKnockbackImmune: true },
    shooter: { cost: 50, hp: 60, speed: 1.0, damage: 10, range: 180, cooldown: 800, color: 0x9b59b6, w: 20, h: 40, name: 'Shooter Cat', bonusKnockback: -0.1, scale: 0.5 }
};

export const ENEMY_TYPES = [
    { type: 'dog', hp: 120, speed: -0.8, damage: 12, range: 10, cooldown: 1200, color: 0xe94560, w: 40, h: 40, bonusKnockback: 0, scale: 0.6 },
    { type: 'tank', hp: 300, speed: -0.4, damage: 15, range: 15, cooldown: 1800, color: 0xbdc3c7, w: 45, h: 45, bonusKnockback: 0.3, scale: 0.7, isKnockbackImmune: true },
    { type: 'runner', hp: 40, speed: -2.0, damage: 25, range: 10, cooldown: 600, color: 0xe67e22, w: 20, h: 20, bonusKnockback: -0.1, scale: 0.5 }
];
