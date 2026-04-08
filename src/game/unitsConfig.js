export const ALLY_TYPES = {
    basic: { cost: 30, hp: 100, speed: 1.2, damage: 20, range: 10, cooldown: 1000, color: 0x43d8c9, w: 30, h: 30, name: 'Basic Square' },
    tank: { cost: 150, hp: 500, speed: 0.6, damage: 15, range: 15, cooldown: 1500, color: 0x3498db, w: 45, h: 45, name: 'Tank Block' },
    ranger: { cost: 20, hp: 60, speed: 1.0, damage: 10, range: 180, cooldown: 800, color: 0x9b59b6, w: 20, h: 40, name: 'Ranger Pillar' }
};

export const ENEMY_TYPES = [
    { type: 'weak', hp: 60, speed: -0.8, damage: 10, range: 10, cooldown: 1200, color: 0xe94560, w: 40, h: 40 },
    { type: 'tank', hp: 300, speed: -0.4, damage: 15, range: 15, cooldown: 1800, color: 0xbdc3c7, w: 45, h: 45 },
    { type: 'runner', hp: 40, speed: -2.0, damage: 25, range: 10, cooldown: 600, color: 0xe67e22, w: 20, h: 20 }
];
