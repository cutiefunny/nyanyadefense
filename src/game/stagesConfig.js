export const STAGE_CONFIG = {
    1: {
        background: 'bg_stage1',
        boss: {
            isCustom: true,
            type: 'dog',
            spriteKey: 'enemy_dog',
            hp: 1500,
            damage: 15,
            w: 80,
            scale: 0.8,
            reward: 800,
            isBoss: true
        },

        clearReward: 1500,
        scaleMultiplier: 1.0,
        nextStage: 2,
        events: [],
        traits: {
            enemySpeedMultiplier: 0.9,
            spawnRateMultiplier: 0.7,
            description: 'Easy starter stage.'
        }
    },
    2: {
        background: 'bg_stage2',
        boss: {
            isCustom: true,
            type: 'boss2',
            spriteKey: 'enemy_boss2',
            hp: 12000,
            damage: 40,
            w: 120,
            scale: 0.6,
            reward: 2000,
            isBoss: true
        },
        clearReward: 3500,
        scaleMultiplier: 1.2,
        nextStage: 3,
        events: [],
        traits: {
            enemySpeedMultiplier: 1.2,
            spawnRateMultiplier: 1.5,
            description: 'Increased enemy speed and spawn rate. Mercenaries and Power-ups are highly recommended.'
        }
    },
    3: {
        background: 'bg_stage3',
        boss: {
            isCustom: true,
            type: 'boss3',
            spriteKey: 'enemy_boss3',
            hp: 40000,
            damage: 90,
            w: 120,
            scale: 0.6,
            reward: 5000,
            isBoss: true
        },
        clearReward: 10000,
        scaleMultiplier: 1.5,
        nextStage: 4,
        events: [
            {
                type: 'warning',
                time: 10000,
                message: 'Massive enemies detected!'
            }
        ],
        traits: {
            enemySpeedMultiplier: 1.0,
            spawnRateMultiplier: 2.0,
            description: 'Final battle. Enemies are relentless and numerous. Maximum Power-ups required!'
        }
    },
    4: {
        background: 'bg_stage4',
        boss: {
            isCustom: true,
            type: 'boss4',
            spriteKey: 'enemy_boss4',
            hp: 250000,
            damage: 350,
            w: 150,
            scale: 0.5,
            reward: 15000,
            isBoss: true,
            cooldown: 800 // fast attack
        },
        clearReward: 30000,
        scaleMultiplier: 1.0,
        nextStage: 5,
        events: [
            {
                type: 'warning',
                time: 5000,
                message: 'EXTREME STAGE: BOSS REVENGE'
            }
        ],
        traits: {
            enemySpeedMultiplier: 1.3,
            spawnRateMultiplier: 3.0,
            description: 'The final, extreme challenge. The ultimate boss has arrived. You need maxed out power-ups and a solid strategy!'
        }
    },
    5: {
        background: 'bg_stage5',
        boss: {
            isCustom: true,
            type: 'boss5',
            spriteKey: 'enemy_boss5',
            hp: 80000,
            damage: 80,
            w: 200,
            scale: 0.7,
            range: 300,
            reward: 50000,
            isBoss: true,
            cooldown: 1200
        },
        clearReward: 100000,
        scaleMultiplier: 0.8,
        nextStage: 6,
        events: Array.from({ length: 5 }, (_, i) => ({
            type: 'spawn_boss',
            time: 0,
            details: { x: 240 + (i * (560 / 4)) } // 70% of 800px spread from 240 to 800
        })).concat([
            {
                type: 'warning',
                time: 5000,
                message: 'BOSS RUSH: 5 POWERFUL BOSSES DETECTED!'
            }
        ]),
        traits: {
            enemySpeedMultiplier: 1.2,
            spawnRateMultiplier: 0.8,
            description: 'Boss Rush Mode. 5 powerful bosses await you from the start. Can you break through their line?'
        }
    },
    6: {
        background: 'bg_stage6',
        boss: {
            isCustom: true,
            type: 'boss6',
            spriteKey: 'enemy_boss6',
            hp: 200000,
            damage: 300,
            range: 800,
            w: 183,
            scale: 0.8,
            reward: 100000,
            isBoss: true,
            cooldown: 3000,
            isKnockbackImmune: true,
            yOffset: 290
        },
        clearReward: 300000,
        scaleMultiplier: 0.8,
        nextStage: null,
        events: [
            {
                type: 'warning',
                time: 3000,
                message: '레드로드의 보스, 깨비를 잡아라!'
            }
        ],
        traits: {
            enemySpeedMultiplier: 1.5,
            spawnRateMultiplier: 1.0,
            description: '궁극의 보스전. 적 부하 유닛 없이 오직 보스만 등장합니다. 모든 화력을 쏟아부으세요!'
        }
    }
};
