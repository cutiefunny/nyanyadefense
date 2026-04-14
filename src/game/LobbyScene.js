import Phaser from 'phaser';
import { ALLY_TYPES } from './unitsConfig';
import lobby_bg from '../assets/lobby_bg.png';
import lobby_cat from '../assets/lobby_cat.png';

const bgImages = import.meta.glob('../assets/backgrounds/stage*.jpg', { eager: true, import: 'default' });

export default class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
        this.tab = 'MAIN'; // Default tab is now the cat base
    }

    init(data) {
        // 내부 탭 전환이 아닌 경우(외부에서 씬 시작)에만 MAIN으로 리셋
        if (!data?.keepTab) {
            this.tab = 'MAIN';
        }

        this.loadPersistentData();
    }

    loadPersistentData() {
        // Device ID
        let deviceId = localStorage.getItem('nyanya_deviceId');
        if (!deviceId) {
            deviceId = 'user-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('nyanya_deviceId', deviceId);
        }
        this.registry.set('deviceId', deviceId);

        // Global XP (stored as globalGold)
        let savedXp = localStorage.getItem('nyanya_xp');
        if (savedXp === null) {
            savedXp = 0;
            localStorage.setItem('nyanya_xp', savedXp);
        }
        this.registry.set('globalGold', parseInt(savedXp));

        // Unit Levels
        let savedLevels = localStorage.getItem('nyanya_unitLevels');
        if (savedLevels) {
            try {
                this.registry.set('unitLevels', JSON.parse(savedLevels));
            } catch (e) {
                this.setDefaultLevels();
            }
        } else {
            this.setDefaultLevels();
        }

        // Listen for registry changes for certain keys to auto-save
        // (Remove existing listeners first to prevent duplicates on restart)
        this.registry.events.off('changedata-globalGold');
        this.registry.events.off('changedata-unitLevels');

        const onGoldChange = (parent, value) => {
            localStorage.setItem('nyanya_xp', value);
            // 씬이 활성화된 상태일 때만 텍스트 업데이트 (렌더링 에러 방지)
            if (this.scene.isActive() && this.goldText) {
                this.goldText.setText(`XP: ${Math.floor(value)}`);
            }
        };

        const onLevelsChange = (parent, value) => {
            localStorage.setItem('nyanya_unitLevels', JSON.stringify(value));
        };

        this.registry.events.on('changedata-globalGold', onGoldChange);
        this.registry.events.on('changedata-unitLevels', onLevelsChange);

        // 씬이 정지되거나 shutdown될 때 리스너 해제
        this.events.once('shutdown', () => {
            this.registry.events.off('changedata-globalGold', onGoldChange);
            this.registry.events.off('changedata-unitLevels', onLevelsChange);
        });
    }

    setDefaultLevels() {
        const defaultLevels = {
            normal: 1,
            tanker: 1,
            shooter: 1
        };
        this.registry.set('unitLevels', defaultLevels);
        localStorage.setItem('nyanya_unitLevels', JSON.stringify(defaultLevels));
    }

    preload() {
        this.load.image('lobby_bg', lobby_bg);
        this.load.image('lobby_cat', lobby_cat);
        // Load stage backgrounds for previews
        Object.keys(bgImages).forEach(path => {
            const match = path.match(/stage(\d+)\.jpg$/);
            if (match) {
                this.load.image(`bg_stage${match[1]}`, bgImages[path]);
            }
        });
    }

    create() {
        this.renderBackground();

        if (this.tab === 'MAIN') {
            this.renderMainScreen();
        } else if (this.tab === 'UPGRADE') {
            this.renderUpgradeTab();
        } else if (this.tab === 'BATTLE') {
            this.renderBattleTab();
        }

        this.renderHeader();
        this.sys.game.events.emit('lobby-ready');
    }

    renderBackground() {
        const bg = this.add.image(400, 150, 'lobby_bg');
        const scale = Math.max(800 / bg.width, 300 / bg.height);
        bg.setScale(scale).setAlpha(0.8);
    }

    renderHeader() {
        const gold = this.registry.get('globalGold');
        const headerY = 25;

        // XP/Gold display at top right
        this.add.rectangle(650, headerY, 250, 30, 0x000000, 0.5).setOrigin(0.5);
        this.goldText = this.add.text(760, headerY, `XP: ${Math.floor(gold)}`, {
            fontSize: '20px',
            fontFamily: 'Arial Black',
            fill: '#fbd46d'
        }).setOrigin(1, 0.5);

        this.add.text(20, headerY, 'NYANYA BASE', {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0, 0.5);
    }

    renderMainScreen() {
        // Mascot cat on the LEFT as requested (leaving space for buttons on right)
        const mascot = this.add.image(200, 180, 'lobby_cat');
        mascot.setScale(0.4);

        // Speech bubble
        const bubble = this.add.graphics();
        bubble.fillStyle(0x000000, 0.6);
        bubble.fillRoundedRect(100, 50, 250, 60, 15);
        bubble.lineStyle(2, 0xffffff, 1);
        bubble.strokeRoundedRect(100, 50, 250, 60, 15);

        this.add.text(225, 80, '김냐냐씨와 함께\n상수동을 되찾아달라냥!', {
            fontSize: '16px',
            fontFamily: 'Arial Black',
            fill: '#ffffff',
            align: 'center'
        }).setOrigin(0.5);

        // Buttons on the RIGHT as requested
        const btnX = 620;
        const btnConfigs = [
            { text: '전투개시!!', tab: 'BATTLE' },
            { text: '파워업', tab: 'UPGRADE' },
            { text: '캐릭터 편성', tab: 'MAIN' }
        ];

        btnConfigs.forEach((config, i) => {
            const y = 90 + i * 70;
            const btnRect = this.add.rectangle(btnX, y, 280, 55, 0xfbd46d)
                .setStrokeStyle(4, 0x000000)
                .setInteractive({ useHandCursor: true });

            const btnText = this.add.text(btnX, y, config.text, {
                fontSize: '28px',
                fontFamily: 'Arial Black',
                fill: '#000000'
            }).setOrigin(0.5);

            btnRect.on('pointerover', () => btnRect.setFillStyle(0xffea00).setScale(1.05));
            btnRect.on('pointerout', () => btnRect.setFillStyle(0xfbd46d).setScale(1.0));
            btnRect.on('pointerdown', () => {
                if (config.tab === 'MAIN') return;
                this.tab = config.tab;
                this.scene.restart({ keepTab: true });
            });
        });
    }

    renderUpgradeTab() {
        this.add.rectangle(400, 150, 800, 300, 0x000000, 0.7);

        const title = this.add.text(400, 60, '냥코 파워업', {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            fill: '#fbd46d',
            stroke: '#000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const types = ['normal', 'tanker', 'shooter'];
        const levels = this.registry.get('unitLevels');
        const gold = this.registry.get('globalGold');

        types.forEach((type, i) => {
            const x = 400;
            const y = 120 + i * 50;
            const level = levels[type];
            const cost = level * 100;

            const bar = this.add.rectangle(x, y, 600, 40, 0xfbd46d, 0.9)
                .setStrokeStyle(3, 0x000000);

            this.add.text(x - 280, y, type.toUpperCase(), {
                fontSize: '20px',
                fontFamily: 'Arial Black',
                fill: '#000000'
            }).setOrigin(0, 0.5);

            this.add.text(x - 20, y, `Lv. ${level}`, {
                fontSize: '20px',
                fontFamily: 'Arial Black',
                fill: '#000000'
            }).setOrigin(0, 0.5);

            const canAfford = gold >= cost;
            const upgradeBtn = this.add.rectangle(x + 230, y, 120, 30, canAfford ? 0xe74c3c : 0x95a5a6)
                .setStrokeStyle(2, 0x000000)
                .setInteractive({ useHandCursor: true });

            this.add.text(x + 230, y, `UP ${cost}`, {
                fontSize: '14px',
                fontFamily: 'Arial Black',
                fill: '#ffffff'
            }).setOrigin(0.5);

            upgradeBtn.on('pointerdown', () => {
                if (gold >= cost) {
                    this.registry.set('globalGold', gold - cost);
                    levels[type]++;
                    this.registry.set('unitLevels', levels);
                    this.scene.restart({ keepTab: true });
                }
            });
        });

        const backBtn = this.add.text(400, 275, '< 돌아가기', {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.tab = 'MAIN';
            this.scene.restart({ keepTab: true });
        });
    }

    renderBattleTab() {
        this.add.rectangle(400, 150, 800, 300, 0x000000, 0.7);
        const title = this.add.text(400, 60, '스테이지 선택', {
            fontSize: '32px',
            fontFamily: 'Arial Black',
            fill: '#fbd46d',
            stroke: '#000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const stages = [1, 2, 3];
        stages.forEach((s, i) => {
            const x = 200 + i * 200;
            const y = 160;

            // Background image preview
            const bgKey = `bg_stage${s}`;
            if (this.textures.exists(bgKey)) {
                this.add.image(x, y, bgKey).setDisplaySize(160, 100).setAlpha(0.6);
            }

            const card = this.add.rectangle(x, y, 160, 100, 0xffffff, 0.2)
                .setStrokeStyle(4, 0x000000)
                .setInteractive({ useHandCursor: true });

            this.add.text(x, y - 10, `STAGE ${s}`, {
                fontSize: '24px',
                fontFamily: 'Arial Black',
                fill: '#000000',
                stroke: '#fff',
                strokeThickness: 2
            }).setOrigin(0.5);

            this.add.text(x, y + 25, '전투개시!!', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                fill: '#e74c3c',
                stroke: '#fff',
                strokeThickness: 2
            }).setOrigin(0.5);

            card.on('pointerover', () => card.setAlpha(1.0).setScale(1.05));
            card.on('pointerout', () => card.setAlpha(0.2).setScale(1.0));
            card.on('pointerdown', () => {
                this.scene.start('GameScene', { stage: s });
            });
        });

        const backBtn = this.add.text(400, 275, '< 돌아가기', {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.tab = 'MAIN';
            this.scene.restart({ keepTab: true });
        });
    }
}
