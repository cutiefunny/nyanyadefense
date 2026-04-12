export const STAGE_CONFIG = {
    1: {
        background: 'bg_stage1',
        boss: {
            isCustom: true,
            type: 'dog',
            spriteKey: 'enemy_dog',
            hp: 1000,
            damage: 15,
            w: 80,
            scale: 0.8,
            reward: 500
        },
        clearReward: 500,
        scaleMultiplier: 1.0,
        nextStage: 2
    },
    2: {
        background: 'bg_stage2',
        boss: {
            isCustom: true,
            type: 'boss2',
            spriteKey: 'enemy_boss2',
            hp: 3000,
            damage: 30,
            w: 120,
            scale: 0.6,
            reward: 1000,
            isBoss: true
        },
        clearReward: 1000,
        scaleMultiplier: 1.1,
        nextStage: 3
    },
    3: {
        background: 'bg_stage3',
        boss: {
            isCustom: true,
            type: 'boss3',
            spriteKey: 'enemy_boss3',
            hp: 6000,
            damage: 50,
            w: 150,
            scale: 0.7,
            reward: 2000,
            isBoss: true
        },
        clearReward: 2000,
        scaleMultiplier: 1.2,
        nextStage: null
    }
};
