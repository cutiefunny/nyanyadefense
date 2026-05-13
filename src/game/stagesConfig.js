export const STAGE_CONFIG = {
    1: {
        name: '상수역 1번 출구',
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
            isBoss: true,
            range: 30,
            cooldown: 1500,
            bossDescription: '특별한 능력은 없는 기본 들개지만, 방심은 금물!'
        },

        clearReward: 1500,
        scaleMultiplier: 1.0,
        nextStage: 2,
        events: [],
        traits: {
            enemySpeedMultiplier: 0.9,
            spawnRateMultiplier: 0.7,
            description: '홍대병자의 시작 지점은 홍대입구역 9번 출구가 아니다!'
        }
    },
    2: {
        name: '근육고양이잡화점',
        background: 'bg_stage2',
        boss: {
            isCustom: true,
            type: 'boss2',
            spriteKey: 'enemy_boss2',
            hp: 10000,
            damage: 30,
            w: 120,
            scale: 0.6,
            reward: 2000,
            isBoss: true,
            hasSplash: true,
            range: 40,
            cooldown: 2000,
            bossDescription: '강한 맷집과 범위공격 능력을 지닌 불독을 조심해라!'
        },
        clearReward: 3500,
        scaleMultiplier: 1.2,
        nextStage: 3,
        events: [],
        traits: {
            enemySpeedMultiplier: 1.0,
            spawnRateMultiplier: 1.0,
            description: '2022년에 시작 된 상수동의 쓸모 없는 소품점이다!'
        }
    },
    3: {
        name: '근육고양이롹앤롤',
        background: 'bg_stage3',
        boss: {
            isCustom: true,
            type: 'boss3',
            spriteKey: 'enemy_boss3',
            hp: 10000,
            damage: 0,
            w: 120,
            scale: 0.6,
            reward: 5000,
            isBoss: true,
            hasSplash: false,
            range: 0,
            cooldown: 5000,
            bossDescription: '10초간 들개들을 광폭화 시키는 헤비메탈 콘서트를 조심하라!'
        },
        clearReward: 10000,
        scaleMultiplier: 1.5,
        nextStage: 4,
        events: [
            {
                type: 'warning',
                time: 10000,
                message: 'We will rock you!!'
            }
        ],
        traits: {
            enemySpeedMultiplier: 1.0,
            spawnRateMultiplier: 1.0,
            description: '롹앤롤 굿즈를 판매하는 역시나 쓸모 없는 소품점이다!'
        }
    },
    4: {
        name: '크로스핏칸',
        background: 'bg_stage4',
        boss: {
            isCustom: true,
            type: 'boss4',
            spriteKey: 'enemy_boss4',
            hp: 20000,
            damage: 40,
            w: 150,
            scale: 0.5,
            reward: 15000,
            isBoss: true,
            cooldown: 800, // fast attack
            hasSplash: true,
            range: 70,
            bossDescription: '크로스핏으로 단련되어 강력한 범위공격력을 지닌 불테리어에 맞서라!'
        },
        clearReward: 30000,
        scaleMultiplier: 1.0,
        nextStage: 5,
        events: [
            {

            }
        ],
        traits: {
            enemySpeedMultiplier: 1.2,
            spawnRateMultiplier: 1.0,
            description: '홍대 지역 유일의 크로스핏 박스다!'
        }
    },
    5: {
        name: '겨울이 머무는 집',
        background: 'bg_stage5',
        boss: {
            isCustom: true,
            type: 'boss5',
            spriteKey: 'enemy_boss5',
            hp: 15000,
            damage: 50,
            w: 200,
            scale: 0.7,
            range: 300,
            reward: 50000,
            isBoss: true,
            cooldown: 1200,
            hasSplash: true,
            bossDescription: '그들은 나쁘지 않지만, 그래도 들개들의 편이다. 5마리의 겨울이들을 쓰러뜨려라!'
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

            }
        ]),
        traits: {
            enemySpeedMultiplier: 1.2,
            spawnRateMultiplier: 0.8,
            description: '상수동에서 거대한 사모예드를 본 적이 있다면, 바로 여기서 출발한 아이들이다.'
        }
    },
    6: {
        name: '상상마당',
        background: 'bg_stage6',
        boss: {
            isCustom: true,
            type: 'boss6',
            spriteKey: 'enemy_boss6',
            hp: 50000,
            damage: 300,
            range: 800,
            w: 183,
            scale: 0.8,
            reward: 100000,
            isBoss: true,
            cooldown: 3000,
            speed: 0.1,
            isKnockbackImmune: true,
            yOffset: 290,
            bossDescription: '레드로드의 지배자인 깨비는 파동 공격을 구사하는 강력한 보스다!'
        },
        clearReward: 30000,
        scaleMultiplier: 0.8,
        nextStage: 7,
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
            description: '명실상부한 홍대의 중심 상상마당이다! 이 곳은 단 하나의 보스가 지키고 있지만 공략이 쉽지 않을 것!'
        }
    },
    7: {
        name: '홍문관',
        background: 'bg_stage7',
        boss: {
            isCustom: true,
            type: 'boss7',
            spriteKey: 'enemy_boss7',
            hp: 20000,
            damage: 50,
            range: 800,
            w: 200,
            scale: 0.5,
            reward: 200000,
            isBoss: true,
            cooldown: 3000,
            isKnockbackImmune: true,
            yOffset: 290,
            bossDescription: '미대생 말티즈는 목에 걸린 그림통에서 강력한 수류탄을 발사한다!'
        },
        clearReward: 500000,
        scaleMultiplier: 0.7,
        nextStage: 8,
        events: [
            {

            }
        ],
        traits: {
            enemySpeedMultiplier: 1.0,
            spawnRateMultiplier: 0.5,
            description: '입구가 이 정도라면, 홍익대학교는 얼마나 크고 화려한 곳일까? 라고 생각만 하자!'
        }
    },
    8: {
        name: '당인리 발전소',
        background: 'bg_stage8',
        objective: 'survival',
        survivalTime: 120,
        boss: null,
        clearReward: 1000000,
        scaleMultiplier: 1.0,
        nextStage: 9,
        traits: {
            description: '상수동의 최남단이자 한강의 관문인 당인리 발전소는 현재 동네 반려견들의 집회 장소가 되었다!'
        }
    },
    9: {
        name: '도토리 캐리커쳐',
        background: 'bg_stage9',
        boss: {
            isCustom: true,
            type: 'boss9',
            spriteKey: 'enemy_boss9',
            hp: 30000,
            damage: 80,
            w: 120,
            scale: 0.7,
            reward: 100000,
            isBoss: true,
            range: 30,
            cooldown: 1500,
            yOffset: 290,
            bossDescription: '도토리의 거대 근육다람쥐를 쓰러뜨려라!'
        },
        clearReward: 1500000,
        scaleMultiplier: 0.8,
        nextStage: 10,
        events: [],
        traits: {
            enemySpeedMultiplier: 1.2,
            spawnRateMultiplier: 1.2,
            description: '도토리 캐리커쳐 홍대 2호점이다!'
        }
    },
    10: {
        name: '멘헤라 공원',
        background: 'bg_stage10',
        objective: 'survival',
        survivalTime: 120,
        boss: null,
        clearReward: 3000000,
        scaleMultiplier: 0.7,
        nextStage: null,
        traits: {
            description: '멘헤라 공원에 진입했다. 치와와들의 엄청난 러쉬를 버텨내라!'
        }
    }
};
