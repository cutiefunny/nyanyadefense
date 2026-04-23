import Phaser from 'phaser';
import { ALLY_TYPES, BOSS_CONFIG } from './unitsConfig';
import lobby_bg from '../assets/lobby_bg.png';
import lobby_cat from '../assets/lobby_cat.jpg';

const bgImages = import.meta.glob('../assets/backgrounds/stage*.jpg', { eager: true, import: 'default' });
const unitImages = import.meta.glob('../assets/units/*.png', { eager: true, import: 'default' });

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

        // Skill Levels
        let savedSkillLevels = localStorage.getItem('nyanya_skillLevels');
        const defaultSkillLevels = { shout_cooldown: 1, shout_duration: 1, normal_cooldown: 1 };
        if (savedSkillLevels) {
            try {
                this.registry.set('skillLevels', { ...defaultSkillLevels, ...JSON.parse(savedSkillLevels) });
            } catch (e) {
                this.registry.set('skillLevels', defaultSkillLevels);
            }
        } else {
            this.registry.set('skillLevels', defaultSkillLevels);
        }

        // Unit Levels
        let savedUnitLevels = localStorage.getItem('nyanya_unitLevels');
        const defaultUnitLevels = { leader: 1, normal: 1, tanker: 1, shooter: 1, healer: 1 };
        if (savedUnitLevels) {
            try {
                this.registry.set('unitLevels', { ...defaultUnitLevels, ...JSON.parse(savedUnitLevels) });
            } catch (e) {
                this.registry.set('unitLevels', defaultUnitLevels);
            }
        } else {
            this.registry.set('unitLevels', defaultUnitLevels);
        }

        // Stage Clears
        let savedClears = localStorage.getItem('nyanya_stageClears');
        if (savedClears) {
            try {
                this.registry.set('stageClears', JSON.parse(savedClears));
            } catch (e) {
                this.registry.set('stageClears', { 1: 0, 2: 0, 3: 0 });
            }
        } else {
            this.registry.set('stageClears', { 1: 0, 2: 0, 3: 0 });
        }

        // Squad (deck) data: { inventory: { normal: 2, tanker: 1, ... }, deck: ['normal','tanker',null,null,null] }
        let savedSquad = localStorage.getItem('nyanya_squad');
        if (savedSquad) {
            try {
                this.registry.set('squad', JSON.parse(savedSquad));
            } catch (e) {
                this.registry.set('squad', { inventory: {}, deck: [null, null, null, null, null] });
            }
        } else {
            this.registry.set('squad', { inventory: {}, deck: [null, null, null, null, null] });
        }

        const onGoldChange = (parent, value) => {
            // 씬이 활성화된 상태일 때만 텍스트 업데이트 (렌더링 에러 방지)
            if (this.scene.isActive() && this.goldText) {
                this.goldText.setText(`XP: ${Math.floor(value)}`);
            }
        };

        this.registry.events.on('changedata-globalGold', onGoldChange);

        // 씬이 정지되거나 shutdown될 때 UI 리스너만 해제
        this.events.once('shutdown', () => {
            this.registry.events.off('changedata-globalGold', onGoldChange);
        });
    }

    setDefaultLevels() {
        if (!this.registry.get('unitLevels')) {
            const defaultLevels = { leader: 1, normal: 1, tanker: 1, shooter: 1 };
            this.registry.set('unitLevels', defaultLevels);
            localStorage.setItem('nyanya_unitLevels', JSON.stringify(defaultLevels));
        }
        if (!this.registry.get('skillLevels')) {
            const defaultSkillLevels = { shout_cooldown: 1, shout_duration: 1, normal_cooldown: 1 };
            this.registry.set('skillLevels', defaultSkillLevels);
            localStorage.setItem('nyanya_skillLevels', JSON.stringify(defaultSkillLevels));
        }
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

        // Load ally spritesheets for UI thumbnails
        Object.keys(ALLY_TYPES).forEach(key => {
            const imgUrl = unitImages[`../assets/units/${key}.png`];
            if (imgUrl) {
                this.load.spritesheet(`ally_${key}`, imgUrl, { frameWidth: 100, frameHeight: 100 });
            }
        });
        const leaderUrl = unitImages['../assets/units/leader.png'];
        if (leaderUrl) this.load.spritesheet('ally_leader', leaderUrl, { frameWidth: 100, frameHeight: 100 });
    }

    create() {
        this.renderBackground();

        if (this.tab === 'MAIN') {
            this.renderMainScreen();
        } else if (this.tab === 'UPGRADE') {
            this.renderUpgradeTab();
        } else if (this.tab === 'BATTLE') {
            this.renderBattleTab();
        } else if (this.tab === 'SQUAD') {
            this.renderSquadTab();
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

        const debugText = this.add.text(20, headerY, 'NYANYA BASE', {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            fill: '#ffffff',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(0, 0.5).setInteractive();

        let clickCount = 0;
        debugText.on('pointerdown', () => {
            clickCount++;
            if (clickCount >= 10) {
                this.sys.game.events.emit('toggle-dev-menu');
                clickCount = 0;
                // 시각적 피드백 (반짝임)
                this.tweens.add({
                    targets: debugText,
                    alpha: 0,
                    duration: 50,
                    yoyo: true,
                    repeat: 5
                });
            }
        });
    }

    renderMainScreen() {
        // Mascot cat on the LEFT as requested (leaving space for buttons on right)
        const mascot = this.add.image(200, 180, 'lobby_cat');
        mascot.setScale(0.4);

        // Speech bubble
        const bubble = this.add.graphics();
        bubble.fillStyle(0x000000, 0.6);
        bubble.fillRoundedRect(75, 220, 250, 60, 15);
        bubble.lineStyle(2, 0xffffff, 1);
        bubble.strokeRoundedRect(75, 220, 250, 60, 15);

        this.add.text(200, 250, '김냐냐씨와 함께\n상수동을 되찾아달라냥!', {
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
            { text: '부대 편성', tab: 'SQUAD' }
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
                this.tab = config.tab;
                this.scene.restart({ keepTab: true });
            });
        });
    }

    renderUpgradeTab() {
        this.add.rectangle(400, 150, 800, 300, 0x000000, 0.7);

        // ─── Headers ───
        this.add.text(200, 45, '유닛 업그레이드', {
            fontSize: '24px', fontFamily: 'Arial Black', fill: '#fbd46d', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        this.add.text(600, 45, '스킬 업그레이드', {
            fontSize: '24px', fontFamily: 'Arial Black', fill: '#43d8c9', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        // ─── Scrollable Setup ───
        const visibleHeight = 180;
        const listY = 75;

        // No mask needed if items fit
        // 1. Core Units Column
        const unitTypes = ['leader', 'normal'];
        this.renderScrollableList(unitTypes, 200, listY, visibleHeight, 'unit', null);

        // 2. Skills Column
        const skillTypes = [
            { id: 'shout_cooldown', name: '함성 쿨타임 단축' },
            { id: 'shout_duration', name: '함성 지속시간 연장' },
            { id: 'normal_cooldown', name: '비실이 생산속도 증가' } 
        ];
        this.renderScrollableList(skillTypes, 600, listY, visibleHeight, 'skill', null);

        const backBtn = this.add.text(400, 275, '< 돌아가기', {
            fontSize: '24px', fontFamily: 'Arial Black', fill: '#ffffff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.tab = 'MAIN';
            this.scene.restart({ keepTab: true });
        });
    }

    renderScrollableList(items, centerX, startY, visibleHeight, type, mask) {
        const container = this.add.container(centerX, startY);
        if (mask) container.setMask(mask);

        const levels = type === 'unit' ? this.registry.get('unitLevels') : this.registry.get('skillLevels');
        const gold = this.registry.get('globalGold');
        const itemHeight = 52;

        // ─── Drag to scroll logic ───
        // Calculate contentHeight early to place hitArea behind items
        const contentHeight = items.length * itemHeight;
        if (contentHeight > visibleHeight) {
            const trackX = centerX + 185;
            const scrollTrack = this.add.rectangle(trackX, startY + visibleHeight / 2, 6, visibleHeight, 0xffffff, 0.2);
            const handleHeight = (visibleHeight / contentHeight) * visibleHeight;
            const scrollHandle = this.add.rectangle(trackX, startY + handleHeight / 2, 6, handleHeight, 0xffffff, 0.6);

            const hitArea = this.add.rectangle(centerX, startY + visibleHeight / 2, 380, visibleHeight, 0x000, 0)
                .setInteractive({ draggable: true });
            
            let startYPos = 0;
            hitArea.on('dragstart', () => {
                startYPos = container.y;
            });
            hitArea.on('drag', (pointer, dragX, dragY) => {
                let newY = startYPos + (dragY - (startY + visibleHeight / 2));
                const minY = startY - (contentHeight - visibleHeight);
                const maxY = startY;
                if (newY < minY) newY = minY;
                if (newY > maxY) newY = maxY;
                container.y = newY;

                // Update scrollbar handle position
                const scrollPercent = (startY - container.y) / (contentHeight - visibleHeight);
                scrollHandle.y = startY + (handleHeight / 2) + scrollPercent * (visibleHeight - handleHeight);
            });
        }

        items.forEach((item, i) => {
            const y = i * itemHeight + 26; // relative to container
            const id = type === 'unit' ? item : item.id;
            const name = type === 'unit' ? (item === 'leader' ? '김냐냐(Leader)' : ALLY_TYPES[item].name) : item.name;
            const level = levels[id] || 1;
            
            let upgradeCost = 0;
            if (type === 'unit') {
                const spec = (item === 'leader') ? BOSS_CONFIG.leader : ALLY_TYPES[item];
                
                // Weight base price by rating (1-10)
                let basePrice = 200;
                if (item === 'leader') basePrice = 500;
                else if (spec && spec.cost > 0) basePrice = spec.cost;

                let rating = 5; // standard
                if (item === 'leader') rating = 7;
                else if (item === 'tanker' || item === 'shooter') rating = 9;
                else if (item === 'normal') rating = 5;

                const ratingWeight = rating / 7; // Average at 7
                const adjustedBase = basePrice * ratingWeight;
                upgradeCost = Math.floor(adjustedBase * 6 * Math.pow(1.7, level - 1));
            } else {
                // Skills
                if (id === 'shout_cooldown' || id === 'normal_cooldown') {
                    // Rating 10/10 - High cost, High scaling
                    upgradeCost = Math.floor(2000 * Math.pow(1.5, level - 1));
                } else {
                    // Rating 6/10 - Moderate cost
                    upgradeCost = Math.floor(800 * Math.pow(1.3, level - 1));
                }
            }

            const canAfford = gold >= upgradeCost;

            const bg = this.add.rectangle(0, y, 370, 48, 0x1a1a2e, 0.8)
                .setStrokeStyle(2, type === 'unit' ? 0xfbd46d : 0x43d8c9, 0.5);
            container.add(bg);

            // Icon/Thumb
            if (type === 'unit') {
                const thumb = this.add.sprite(-165, y, `ally_${id}`, 0).setDisplaySize(32, 32);
                container.add(thumb);
            }

            const nameText = this.add.text(type === 'unit' ? -145 : -175, y, name, {
                fontSize: '16px', fontFamily: 'Arial Black', fill: '#ffffff'
            }).setOrigin(0, 0.5);
            container.add(nameText);

            const lvText = this.add.text(40, y, `Lv. ${level}`, {
                fontSize: '16px', fontFamily: 'Arial Black', fill: type === 'unit' ? '#fbd46d' : '#43d8c9'
            }).setOrigin(0, 0.5);
            container.add(lvText);

            const upgradeBtn = this.add.rectangle(135, y, 90, 30, canAfford ? 0xe74c3c : 0x95a5a6)
                .setStrokeStyle(2, 0x000000)
                .setInteractive({ useHandCursor: true });
            
            const btnText = this.add.text(135, y, `UP ${upgradeCost}`, {
                fontSize: '11px', fontFamily: 'Arial Black', fill: '#fff'
            }).setOrigin(0.5);
            
            container.add(upgradeBtn);
            container.add(btnText);

            upgradeBtn.on('pointerdown', () => {
                const currentGold = this.registry.get('globalGold');
                if (currentGold >= upgradeCost) {
                    this.registry.set('globalGold', currentGold - upgradeCost);
                    
                    const registryKey = type === 'unit' ? 'unitLevels' : 'skillLevels';
                    const currentLevels = { ...this.registry.get(registryKey) };
                    
                    currentLevels[id] = (currentLevels[id] || 1) + 1;
                    
                    this.registry.set(registryKey, currentLevels);
                    localStorage.setItem(`nyanya_${registryKey}`, JSON.stringify(currentLevels));
                    
                    this.scene.restart({ keepTab: true });
                }
            });
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

        const stageClears = this.registry.get('stageClears') || { 1: 0, 2: 0, 3: 0 };
        const stages = [1, 2, 3];
        stages.forEach((s, i) => {
            const x = 200 + i * 200;
            const y = 160;

            // Unlock logic: Stage 1 is always open. Stage N is open if Stage N-1 clear count > 0.
            const isLocked = s > 1 && (stageClears[s - 1] || 0) <= 0;
            const clears = stageClears[s] || 0;

            // Background image preview
            const bgKey = `bg_stage${s}`;
            if (this.textures.exists(bgKey)) {
                this.add.image(x, y, bgKey).setDisplaySize(160, 100).setAlpha(isLocked ? 0.2 : 0.6);
            }

            const card = this.add.rectangle(x, y, 160, 100, 0xffffff, isLocked ? 0.1 : 0.2)
                .setStrokeStyle(4, isLocked ? 0x444444 : 0x000000);

            if (isLocked) {
                this.add.text(x, y - 10, `STAGE ${s}`, {
                    fontSize: '24px',
                    fontFamily: 'Arial Black',
                    fill: '#444444'
                }).setOrigin(0.5);
                this.add.text(x, y + 25, 'LOCKED', {
                    fontSize: '18px',
                    fontFamily: 'Arial Black',
                    fill: '#ff0000'
                }).setOrigin(0.5);
            } else {
                card.setInteractive({ useHandCursor: true });

                this.add.text(x, y - 10, `STAGE ${s}`, {
                    fontSize: '24px',
                    fontFamily: 'Arial Black',
                    fill: '#000000',
                    stroke: '#fff',
                    strokeThickness: 2
                }).setOrigin(0.5);

                this.add.text(x, y + 20, '전투개시!!', {
                    fontSize: '16px',
                    fontFamily: 'Arial Black',
                    fill: '#e74c3c',
                    stroke: '#fff',
                    strokeThickness: 2
                }).setOrigin(0.5);

                // Clear Count Display
                this.add.text(x, y + 42, `Cleared: ${clears} times`, {
                    fontSize: '12px',
                    fontFamily: 'Arial Black',
                    fill: '#333333'
                }).setOrigin(0.5);

                card.on('pointerover', () => card.setAlpha(1.0).setScale(1.05));
                card.on('pointerout', () => card.setAlpha(0.2).setScale(1.0));
                card.on('pointerdown', () => {
                    this.scene.start('GameScene', { stage: s });
                });
            }
        });

        // ─── Current Deck Display ───
        const squad = this.registry.get('squad') || { deck: [null, null, null, null, null] };
        const deckSlots = squad.deck;

        this.add.text(400, 225, '현재 출격 부대', {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            fill: '#aaaaaa'
        }).setOrigin(0.5);

        for (let i = 0; i < 5; i++) {
            const x = 400 + (i - 2) * 45;
            const y = 248;
            const unitType = deckSlots[i];

            this.add.rectangle(x, y, 40, 40, 0x000000, 0.3).setStrokeStyle(1, 0xffffff, 0.3);

            if (unitType && this.textures.exists(`ally_${unitType}`)) {
                this.add.sprite(x, y, `ally_${unitType}`, 0).setDisplaySize(32, 32);
            }
        }

        const backBtn = this.add.text(400, 285, '< 돌아가기', {
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

    saveSquad(squad) {
        this.registry.set('squad', squad);
        localStorage.setItem('nyanya_squad', JSON.stringify(squad));
    }

    renderSquadTab() {
        this.add.rectangle(400, 150, 800, 300, 0x000000, 0.7);

        this.add.text(400, 50, '부대 편성', {
            fontSize: '28px',
            fontFamily: 'Arial Black',
            fill: '#fbd46d',
            stroke: '#000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const gold = this.registry.get('globalGold');
        const squad = JSON.parse(JSON.stringify(this.registry.get('squad'))); // deep clone
        const unitTypes = ['shooter', 'tanker', 'healer'];
        const unitLevels = this.registry.get('unitLevels');
        const stageClearsDict = this.registry.get('stageClears') || {};
        const maxClearedStage = Object.keys(stageClearsDict).reduce((max, s) => stageClearsDict[s] > 0 ? Math.max(max, parseInt(s)) : max, 0);

        unitTypes.forEach((type, i) => {
            const x = 165; // Card X
            const y = 110 + i * 45;
            const level = unitLevels[type] || 1;
            const spec = ALLY_TYPES[type];
            const isUnlocked = (spec.unlockStage || 0) <= maxClearedStage;
            const owned = squad.inventory[type] || 0;
            
            // Hiring/Upgrade Costs Logic
            const baseHiringCost = spec.cost || 200;
            const currentHiringCost = baseHiringCost * Math.pow(2, level - 1);
            const upgradeCost = currentHiringCost * 5;
            
            const canBuy = isUnlocked && gold >= currentHiringCost;
            const canUpgrade = isUnlocked && gold >= upgradeCost;

            // Card bg
            this.add.rectangle(x, y, 320, 34, isUnlocked ? 0x1a1a2e : 0x000000, isUnlocked ? 0.9 : 0.6)
                .setStrokeStyle(2, isUnlocked ? 0x555555 : 0x333333);

            // Thumbnail
            if (this.textures.exists(`ally_${type}`)) {
                const thumb = this.add.sprite(x - 142, y, `ally_${type}`, 0).setDisplaySize(28, 28);
                if (!isUnlocked) thumb.setTint(0x333333);
            }

            // Name + Lv
            const nameStr = isUnlocked ? `${spec.name} (Lv.${level})` : `??? (스테이지 ${spec.unlockStage} 클리어 시 해금)`;
            this.add.text(x - 122, y, nameStr, {
                fontSize: isUnlocked ? '11px' : '10px', 
                fontFamily: 'Arial Black', 
                fill: isUnlocked ? '#ffffff' : '#666666'
            }).setOrigin(0, 0.5);

            if (isUnlocked) {
                // Buy button
                if (currentHiringCost > 0) {
                    const buyBtn = this.add.rectangle(x + 55, y, 60, 24, canBuy ? 0x2ecc71 : 0x555555)
                        .setStrokeStyle(1, 0x000000)
                        .setInteractive({ useHandCursor: canBuy });
                    this.add.text(x + 55, y, `고용:${currentHiringCost}`, {
                        fontSize: '10px', fontFamily: 'Arial Black', fill: '#fff'
                    }).setOrigin(0.5);

                    if (canBuy) {
                        buyBtn.on('pointerdown', () => {
                            squad.inventory[type] = (squad.inventory[type] || 0) + 1;
                            this.registry.set('globalGold', gold - currentHiringCost);
                            this.saveSquad(squad);
                            this.scene.restart({ keepTab: true });
                        });
                    }
                    
                    this.add.text(x - 10, y, `보유:${owned}`, {
                        fontSize: '10px', fontFamily: 'Arial Black', fill: '#fbd46d'
                    }).setOrigin(0.5);
                }

                // Upgrade button
                const upgradeBtn = this.add.rectangle(x + 120, y, 65, 24, canUpgrade ? 0xe74c3c : 0x555555)
                    .setStrokeStyle(1, 0x000000)
                    .setInteractive({ useHandCursor: canUpgrade });
                this.add.text(x + 120, y, `UP:${upgradeCost}`, {
                    fontSize: '10px', fontFamily: 'Arial Black', fill: '#fff'
                }).setOrigin(0.5);

                if (canUpgrade) {
                    upgradeBtn.on('pointerdown', () => {
                        this.registry.set('globalGold', gold - upgradeCost);
                        unitLevels[type]++;
                        this.registry.set('unitLevels', { ...unitLevels });
                        localStorage.setItem('nyanya_unitLevels', JSON.stringify(unitLevels));
                        this.scene.restart({ keepTab: true });
                    });
                }
            }
        });

        // ─── DECK: 5 Slots ───
        this.add.text(550, 80, '[ 출격 덱 (5슬롯) ]', {
            fontSize: '16px', fontFamily: 'Arial Black', fill: '#e74c3c'
        }).setOrigin(0.5);

        const deckSlots = squad.deck || [null, null, null, null, null];
        const slotColors = { normal: 0x43d8c9, tanker: 0x3498db, shooter: 0x9b59b6, healer: 0xff88aa };

        for (let i = 0; i < 5; i++) {
            const x = 430 + (i % 5) * 55;
            const y = 120;
            const unitType = deckSlots[i];

            const slotBg = this.add.rectangle(x, y, 48, 48, unitType ? (slotColors[unitType] || 0x333333) : 0x222222, 0.9)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });

            if (unitType) {
                const spec = ALLY_TYPES[unitType];
                if (this.textures.exists(`ally_${unitType}`)) {
                    this.add.sprite(x, y, `ally_${unitType}`, 0).setDisplaySize(40, 40);
                } else {
                    this.add.text(x, y - 5, spec?.name?.charAt(0) || '?', {
                        fontSize: '18px', fontFamily: 'Arial Black', fill: '#fff'
                    }).setOrigin(0.5);
                }
                this.add.text(x, y + 15, unitType.slice(0, 3), {
                    fontSize: '9px', fontFamily: 'Arial Black', fill: '#ddd'
                }).setOrigin(0.5);

                // Click to remove from deck
                slotBg.on('pointerdown', () => {
                    squad.inventory[unitType] = (squad.inventory[unitType] || 0) + 1;
                    deckSlots[i] = null;
                    squad.deck = deckSlots;
                    this.saveSquad(squad);
                    this.scene.restart({ keepTab: true });
                });
            } else {
                this.add.text(x, y, '＋', {
                    fontSize: '20px', fontFamily: 'Arial Black', fill: '#555'
                }).setOrigin(0.5);
            }
        }

        // ─── Inventory -> Deck assign buttons ───
        this.add.text(550, 165, '[ 배치 가능 유닛 ]', {
            fontSize: '14px', fontFamily: 'Arial Black', fill: '#aaa'
        }).setOrigin(0.5);

        const availableTypes = ['normal', 'tanker', 'shooter', 'healer'].filter(t => (squad.inventory[t] || 0) > 0);
        availableTypes.forEach((type, i) => {
            const x = 430 + i * 75;
            const y = 200;
            const spec = ALLY_TYPES[type];
            const count = squad.inventory[type];

            const assignBtn = this.add.rectangle(x, y, 65, 50, slotColors[type] || 0x333333, 0.8)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });

            if (this.textures.exists(`ally_${type}`)) {
                this.add.sprite(x, y - 6, `ally_${type}`, 0).setDisplaySize(36, 36);
            } else {
                this.add.text(x, y - 10, spec.name.split(' ')[0], {
                    fontSize: '11px', fontFamily: 'Arial Black', fill: '#fff'
                }).setOrigin(0.5);
            }

            this.add.text(x, y + 12, `x${count}`, {
                fontSize: '12px', fontFamily: 'Arial Black', fill: '#fbd46d'
            }).setOrigin(0.5);

            assignBtn.on('pointerdown', () => {
                // Find first empty slot
                const emptyIdx = deckSlots.findIndex(s => s === null);
                if (emptyIdx !== -1 && count > 0) {
                    deckSlots[emptyIdx] = type;
                    squad.inventory[type] = count - 1;
                    squad.deck = deckSlots;
                    this.saveSquad(squad);
                    this.scene.restart({ keepTab: true });
                }
            });

            // Return (Sell) Button
            const refundAmount = Math.floor((spec.cost || 200) * Math.pow(2, (unitLevels[type] || 1) - 1) / 2);
            const sellBtn = this.add.rectangle(x + 25, y - 20, 22, 22, 0xee0000, 1.0)
                .setStrokeStyle(1.5, 0xffffff)
                .setInteractive({ useHandCursor: true })
                .setDepth(10);
            
            const sellIcon = this.add.text(x + 25, y - 20, 'X', { 
                fontSize: '14px', fontFamily: 'Arial Black', fill: '#ffffff' 
            }).setOrigin(0.5).setDepth(11);
            
            sellBtn.on('pointerover', () => {
                sellBtn.setFillStyle(0xff0000);
                sellBtn.setScale(1.2);
            });
            sellBtn.on('pointerout', () => {
                sellBtn.setFillStyle(0xee0000);
                sellBtn.setScale(1.0);
            });
            
            sellBtn.on('pointerdown', (pointer, localX, localY, event) => {
                if (event) event.stopPropagation();
                
                // Immediate sell without confirmation as requested
                squad.inventory[type]--;
                const currentGold = this.registry.get('globalGold');
                this.registry.set('globalGold', currentGold + refundAmount);
                this.saveSquad(squad);
                
                // Add a little flash effect before restart
                this.cameras.main.flash(200, 255, 251, 109, true); 
                this.scene.restart({ keepTab: true });
            });
        });

        // Back button
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
