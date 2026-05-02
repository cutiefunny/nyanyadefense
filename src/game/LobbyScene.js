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
        if (data?.tab) {
            this.tab = data.tab;
        } else if (!data?.keepTab) {
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
        const defaultSkillLevels = { shout_cooldown: 1, shout_duration: 1, normal_cooldown: 1, deck_slots: 1 };
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
                this.registry.set('stageClears', { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
            }
        } else {
            this.registry.set('stageClears', { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        }

        // Leader Perks: { level: perkId }
        let savedPerks = localStorage.getItem('nyanya_leaderPerks');
        if (savedPerks) {
            try {
                this.registry.set('leaderPerks', JSON.parse(savedPerks));
            } catch (e) {
                this.registry.set('leaderPerks', {});
            }
        } else {
            this.registry.set('leaderPerks', {});
        }

        let savedSquad = localStorage.getItem('nyanya_squad');
        let parsedSquad = { inventory: [], deck: [null] };
        if (savedSquad) {
            try {
                parsedSquad = JSON.parse(savedSquad);
            } catch (e) {
                parsedSquad = { inventory: [], deck: [null] };
            }
        }
        if (!Array.isArray(parsedSquad.inventory)) {
            const oldInv = parsedSquad.inventory || {};
            const newInv = [];
            Object.keys(oldInv).forEach(type => {
                const count = oldInv[type] || 0;
                for (let i = 0; i < count; i++) {
                    newInv.push({ type, level: 1 });
                }
            });
            parsedSquad.inventory = newInv;
        }
        if (parsedSquad.deck && parsedSquad.deck.length > 0 && typeof parsedSquad.deck[0] === 'string') {
            parsedSquad.deck = parsedSquad.deck.map(t => t ? { type: t, level: 1 } : null);
        }
        this.registry.set('squad', parsedSquad);

        const onGoldChange = (parent, value) => {
            // 씬이 활성화된 상태일 때만 텍스트 업데이트 (렌더링 에러 방지)
            if (this.scene.isActive() && this.goldText) {
                this.goldText.setText(`${Math.floor(value)} 냥`);
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
            const defaultSkillLevels = { shout_cooldown: 1, shout_duration: 1, normal_cooldown: 1, deck_slots: 1 };
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
        } else if (this.tab === 'GACHA') {
            this.renderGachaTab();
        }

        this.renderHeader();
        this.checkHiddenSkillNotifications();
        this.sys.game.events.emit('lobby-ready');
        this.sys.game.events.emit('tab-changed', this.tab);
    }

    checkHiddenSkillNotifications() {
        const unitLevels = this.registry.get('unitLevels') || {};
        if (unitLevels.tanker >= 5) {
            const seen = localStorage.getItem('nyanya_hiddenSkillSeen_tanker');
            if (!seen) {
                this.sys.game.events.emit('show-hidden-skill', {
                    unitName: '탱크',
                    skillName: '슈퍼아머',
                    desc: '데미지를 입을 때마다 0.1초간 슈퍼아머가 발동합니다.'
                });
                localStorage.setItem('nyanya_hiddenSkillSeen_tanker', 'true');
            }
        }
        if (unitLevels.normal >= 5) {
            const seen = localStorage.getItem('nyanya_hiddenSkillSeen_normal');
            if (!seen) {
                this.sys.game.events.emit('show-hidden-skill', {
                    unitName: '비실이',
                    skillName: '기습 대시',
                    desc: '적과의 거리가 가까워지면 순식간에 거리를 좁힙니다.'
                });
                localStorage.setItem('nyanya_hiddenSkillSeen_normal', 'true');
            }
        }
        if (unitLevels.shooter >= 5) {
            const seen = localStorage.getItem('nyanya_hiddenSkillSeen_shooter');
            if (!seen) {
                this.sys.game.events.emit('show-hidden-skill', {
                    unitName: '턱시도',
                    skillName: '수류탄 투척',
                    desc: '공격 10회마다 강력한 광역 데미지를 입히는 수류탄을 던집니다.'
                });
                localStorage.setItem('nyanya_hiddenSkillSeen_shooter', 'true');
            }
        }
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
        this.goldText = this.add.text(760, headerY, `${Math.floor(gold)} 냥`, {
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
            { text: '부대 편성', tab: 'SQUAD' },
            { text: '뽑기 상점', tab: 'GACHA' }
        ];

        btnConfigs.forEach((config, i) => {
            const y = 65 + i * 60;
            const btnRect = this.add.rectangle(btnX, y, 280, 50, 0xfbd46d)
                .setStrokeStyle(4, 0x000000)
                .setInteractive({ useHandCursor: true });

            const btnText = this.add.text(btnX, y, config.text, {
                fontSize: '24px',
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

        const squad = this.registry.get('squad') || { inventory: [] };
        const invCards = squad.inventory || [];
        const leaderCards = invCards.filter(c => c.type === 'leader').length;
        const normalCards = invCards.filter(c => c.type === 'normal').length;
        const slotColors = { normal: 0x43d8c9, leader: 0xfbd46d };

        // Draw Leader card below list
        const lX = 160;
        const lY = 210;
        const leaderCardBg = this.add.rectangle(lX, lY, 56, 48, slotColors.leader, 0.85)
            .setStrokeStyle(this.selectedUpgradeCard === 'leader' ? 3 : 1, this.selectedUpgradeCard === 'leader' ? 0xf1c40f : 0xffffff)
            .setInteractive({ useHandCursor: true });
        this.add.sprite(lX, lY - 8, 'ally_leader', 0).setDisplaySize(32, 32);
        this.add.text(lX, lY + 14, `x${leaderCards}`, { fontSize: '11px', fontFamily: 'Arial Black', fill: '#ffffff' }).setOrigin(0.5);

        leaderCardBg.on('pointerdown', () => {
            this.selectedUpgradeCard = this.selectedUpgradeCard === 'leader' ? null : 'leader';
            this.scene.restart({ keepTab: true });
        });

        if (this.selectedUpgradeCard === 'leader' && leaderCards > 0) {
            const lSellBtn = this.add.rectangle(lX, lY + 38, 56, 18, 0xe74c3c)
                .setStrokeStyle(1, 0xffffff).setInteractive({ useHandCursor: true });
            this.add.text(lX, lY + 38, '판매', { fontSize: '11px', fontFamily: 'Arial Black', fill: '#fff' }).setOrigin(0.5);

            lSellBtn.on('pointerdown', () => {
                const input = window.prompt(`판매할 장수를 입력하세요 (최대 ${leaderCards}장)`, "1");
                if (input !== null) {
                    const sellCount = parseInt(input);
                    if (!isNaN(sellCount) && sellCount > 0 && sellCount <= leaderCards) {
                        const pricePerCard = (BOSS_CONFIG.leader.cost || 1000);
                        const totalRefund = pricePerCard * sellCount;
                        const currentGold = this.registry.get('globalGold') || 0;
                        this.registry.set('globalGold', currentGold + totalRefund);

                        let removed = 0;
                        for (let j = invCards.length - 1; j >= 0; j--) {
                            if (invCards[j].type === 'leader' && removed < sellCount) {
                                invCards.splice(j, 1);
                                removed++;
                            }
                        }
                        this.saveSquad(squad);
                        this.selectedUpgradeCard = null;
                        this.cameras.main.flash(300, 255, 251, 109);
                        this.scene.restart({ keepTab: true });
                    } else {
                        alert("잘못된 수량입니다.");
                    }
                }
            });
        }

        // Draw Normal card below list
        const nX = 240;
        const nY = 210;
        const normalCardBg = this.add.rectangle(nX, nY, 56, 48, slotColors.normal, 0.85)
            .setStrokeStyle(this.selectedUpgradeCard === 'normal' ? 3 : 1, this.selectedUpgradeCard === 'normal' ? 0xf1c40f : 0xffffff)
            .setInteractive({ useHandCursor: true });
        this.add.sprite(nX, nY - 8, 'ally_normal', 0).setDisplaySize(32, 32);
        this.add.text(nX, nY + 14, `x${normalCards}`, { fontSize: '11px', fontFamily: 'Arial Black', fill: '#ffffff' }).setOrigin(0.5);

        normalCardBg.on('pointerdown', () => {
            this.selectedUpgradeCard = this.selectedUpgradeCard === 'normal' ? null : 'normal';
            this.scene.restart({ keepTab: true });
        });

        if (this.selectedUpgradeCard === 'normal' && normalCards > 0) {
            const nSellBtn = this.add.rectangle(nX, nY + 38, 56, 18, 0xe74c3c)
                .setStrokeStyle(1, 0xffffff).setInteractive({ useHandCursor: true });
            this.add.text(nX, nY + 38, '판매', { fontSize: '11px', fontFamily: 'Arial Black', fill: '#fff' }).setOrigin(0.5);

            nSellBtn.on('pointerdown', () => {
                const input = window.prompt(`판매할 장수를 입력하세요 (최대 ${normalCards}장)`, "1");
                if (input !== null) {
                    const sellCount = parseInt(input);
                    if (!isNaN(sellCount) && sellCount > 0 && sellCount <= normalCards) {
                        const pricePerCard = (ALLY_TYPES.normal.cost || 200);
                        const totalRefund = pricePerCard * sellCount;
                        const currentGold = this.registry.get('globalGold') || 0;
                        this.registry.set('globalGold', currentGold + totalRefund);

                        let removed = 0;
                        for (let j = invCards.length - 1; j >= 0; j--) {
                            if (invCards[j].type === 'normal' && removed < sellCount) {
                                invCards.splice(j, 1);
                                removed++;
                            }
                        }
                        this.saveSquad(squad);
                        this.selectedUpgradeCard = null;
                        this.cameras.main.flash(300, 255, 251, 109);
                        this.scene.restart({ keepTab: true });
                    } else {
                        alert("잘못된 수량입니다.");
                    }
                }
            });
        }

        // 2. Skills Column
        const skillTypes = [
            { id: 'normal_cooldown', name: '비실이 생산속도 증가' },
            { id: 'deck_slots', name: '출격 슬롯 추가' }
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

        const squad = this.registry.get('squad') || { inventory: [] };
        const invCards = squad.inventory || [];

        items.forEach((item, i) => {
            const y = i * itemHeight + 26; // relative to container
            const id = type === 'unit' ? item : item.id;
            
            let cardCount = 0;
            if (id === 'leader' || id === 'normal') {
                cardCount = invCards.filter(c => c.type === id).length;
            }

            let name = type === 'unit' ? (item === 'leader' ? '김냐냐(Leader)' : ALLY_TYPES[item].name) : item.name;
            const level = levels[id] || 1;

            let upgradeCost = 0;
            let neededCards = 0;
            if (type === 'unit') {
                if (id === 'leader' || id === 'normal') {
                    neededCards = Math.pow(2, level - 1);
                } else {
                    const spec = ALLY_TYPES[item];
                    let basePrice = 200;
                    if (spec && spec.cost > 0) basePrice = spec.cost;

                    let rating = 5;
                    if (item === 'tanker' || item === 'shooter') rating = 9;

                    const ratingWeight = rating / 7;
                    const adjustedBase = basePrice * ratingWeight;
                    upgradeCost = Math.floor(adjustedBase * 6 * Math.pow(1.7, level - 1));
                }
            } else {
                if (id === 'shout_cooldown' || id === 'normal_cooldown') {
                    upgradeCost = Math.floor(2000 * Math.pow(1.5, level - 1));
                } else if (id === 'deck_slots') {
                    upgradeCost = Math.floor(10000 * Math.pow(2, level - 1));
                } else {
                    upgradeCost = Math.floor(800 * Math.pow(1.3, level - 1));
                }
            }

            const canAfford = (id === 'leader' || id === 'normal') && type === 'unit' 
                ? cardCount >= neededCards 
                : gold >= upgradeCost;

            const bg = this.add.rectangle(0, y, 370, 48, 0x1a1a2e, 0.8)
                .setStrokeStyle(2, type === 'unit' ? 0xfbd46d : 0x43d8c9, 0.5);
            container.add(bg);

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

            const btnText = this.add.text(135, y, (id === 'leader' || id === 'normal') && type === 'unit' ? `UP ${neededCards}장` : `UP ${upgradeCost}`, {
                fontSize: '11px', fontFamily: 'Arial Black', fill: '#fff'
            }).setOrigin(0.5);

            container.add(upgradeBtn);
            container.add(btnText);

            upgradeBtn.on('pointerdown', () => {
                const currentGold = this.registry.get('globalGold');
                if ((id === 'leader' || id === 'normal') && type === 'unit') {
                    if (cardCount >= neededCards) {
                        let removed = 0;
                        for (let j = invCards.length - 1; j >= 0; j--) {
                            if (invCards[j].type === id && removed < neededCards) {
                                invCards.splice(j, 1);
                                removed++;
                            }
                        }
                        this.saveSquad(squad);

                        if (id === 'leader') {
                            const currentLevels = this.registry.get('unitLevels');
                            const newLevel = (currentLevels[id] || 1) + 1;
                            this.sys.game.events.emit('show-leader-skill-tree', {
                                level: newLevel,
                                cost: 0
                            });
                            return;
                        }

                        const registryKey = 'unitLevels';
                        const currentLevels = { ...this.registry.get(registryKey) };
                        currentLevels[id] = (currentLevels[id] || 1) + 1;
                        this.registry.set(registryKey, currentLevels);
                        localStorage.setItem(`nyanya_${registryKey}`, JSON.stringify(currentLevels));

                        if (id === 'normal' && currentLevels.normal === 5) {
                            this.checkHiddenSkillNotifications();
                        }

                        this.scene.restart({ keepTab: true });
                    }
                } else if (currentGold >= upgradeCost) {

                    this.registry.set('globalGold', currentGold - upgradeCost);

                    const registryKey = type === 'unit' ? 'unitLevels' : 'skillLevels';
                    const currentLevels = { ...this.registry.get(registryKey) };

                    currentLevels[id] = (currentLevels[id] || 1) + 1;

                    if (id === 'deck_slots') {
                        const squad = this.registry.get('squad');
                        squad.deck.push(null);
                        this.saveSquad(squad);
                    }

                    this.registry.set(registryKey, currentLevels);
                    localStorage.setItem(`nyanya_${registryKey}`, JSON.stringify(currentLevels));

                    // Trigger notification check immediately if reaching level 5
                    if (id === 'normal' && currentLevels.normal === 5) {
                        this.checkHiddenSkillNotifications();
                    }
                    if (id === 'tanker' && currentLevels.tanker === 5) {
                        this.checkHiddenSkillNotifications();
                    }
                    if (id === 'shooter' && currentLevels.shooter === 5) {
                        this.checkHiddenSkillNotifications();
                    }

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

        const stageClears = this.registry.get('stageClears') || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        if (this.stagePage === undefined) this.stagePage = 0;
        const totalStages = [1, 2, 3, 4, 5, 6];
        
        // Pagination arrows
        if (this.stagePage > 0) {
            const leftArrow = this.add.text(30, 220, '◀', {
                fontSize: '32px', fontFamily: 'Arial Black', fill: '#fbd46d', stroke: '#000', strokeThickness: 5
            }).setOrigin(0.5).setDepth(5000).setInteractive({ useHandCursor: true });
            leftArrow.on('pointerdown', (pointer, localX, localY, event) => {
                if (event) event.stopPropagation();
                this.stagePage--;
                this.scene.restart({ keepTab: true });
            });
        }

        if ((this.stagePage + 1) * 5 < totalStages.length) {
            const rightArrow = this.add.text(770, 220, '▶', {
                fontSize: '32px', fontFamily: 'Arial Black', fill: '#fbd46d', stroke: '#000', strokeThickness: 5
            }).setOrigin(0.5).setDepth(5000).setInteractive({ useHandCursor: true });
            rightArrow.on('pointerdown', (pointer, localX, localY, event) => {
                if (event) event.stopPropagation();
                this.stagePage++;
                this.scene.restart({ keepTab: true });
            });
        }

        const visibleStages = totalStages.slice(this.stagePage * 5, (this.stagePage + 1) * 5);
        visibleStages.forEach((s, i) => {
            const x = 80 + i * 160;
            const y = 160;

            // Unlock logic: Stage 1 is always open. Stage N is open if Stage N-1 clear count > 0.
            const isLocked = s > 1 && (stageClears[s - 1] || 0) <= 0;
            const clears = stageClears[s] || 0;

            // Background image preview
            const bgKey = `bg_stage${s}`;
            if (this.textures.exists(bgKey)) {
                this.add.image(x, y, bgKey).setDisplaySize(150, 100).setAlpha(isLocked ? 0.2 : 0.6);
            }

            const card = this.add.rectangle(x, y, 150, 100, 0xffffff, isLocked ? 0.1 : 0.2)
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
        const squad = this.registry.get('squad') || { deck: [null] };
        const deckSlots = squad.deck;

        this.add.text(400, 225, '현재 출격 부대', {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            fill: '#aaaaaa'
        }).setOrigin(0.5);

        for (let i = 0; i < deckSlots.length; i++) {
            const x = 400 + (i - (deckSlots.length - 1) / 2) * 45;
            const y = 248;
            const cardObj = deckSlots[i];
            const unitType = cardObj?.type;

            this.add.rectangle(x, y, 40, 40, 0x000000, 0.3).setStrokeStyle(1, 0xffffff, 0.3);

            if (unitType && this.textures.exists(`ally_${unitType}`)) {
                this.add.sprite(x, y - 5, `ally_${unitType}`, 0).setDisplaySize(28, 28);
                this.add.text(x, y + 12, `Lv.${cardObj.level}`, {
                    fontSize: '9px', fontFamily: 'Arial Black', fill: '#fbd46d'
                }).setOrigin(0.5);
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

        this.add.text(400, 45, '부대 편성 (보유 카드 / 출격 덱)', {
            fontSize: '24px',
            fontFamily: 'Arial Black',
            fill: '#fbd46d',
            stroke: '#000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const squad = JSON.parse(JSON.stringify(this.registry.get('squad') || { inventory: [], deck: [] }));
        const invCards = squad.inventory || [];
        const deckSlots = squad.deck || [null];
        const slotColors = { normal: 0x43d8c9, tanker: 0x3498db, shooter: 0x9b59b6, healer: 0xff88aa };

        // ─── Left Side: Inventory Cards ───
        const invLeftX = 50;
        const invSectionY = 85;
        this.add.text(150, invSectionY, '[ 보유 유닛 카드 (동일 🌟 클릭:합치기) ]', {
            fontSize: '12px', fontFamily: 'Arial Black', fill: '#aaa'
        }).setOrigin(0.5);

        // Auto Merge Button
        const autoMergeBtn = this.add.rectangle(340, invSectionY, 70, 24, 0x2980b9)
            .setStrokeStyle(1, 0xffffff).setInteractive({ useHandCursor: true });
        this.add.text(340, invSectionY, '자동합성', {
            fontSize: '11px', fontFamily: 'Arial Black', fill: '#fff'
        }).setOrigin(0.5);

        autoMergeBtn.on('pointerdown', () => {
            let merged = false;
            let hasPairs = true;
            while(hasPairs) {
                hasPairs = false;
                for(let i=0; i<invCards.length; i++) {
                    if (invCards[i].type === 'leader' || invCards[i].type === 'normal') continue;
                    for(let j=i+1; j<invCards.length; j++) {
                        if (invCards[j].type === 'leader' || invCards[j].type === 'normal') continue;
                        if(invCards[i].type === invCards[j].type && invCards[i].level === invCards[j].level) {
                            invCards[i].level += 1;
                            invCards.splice(j, 1);
                            hasPairs = true;
                            merged = true;
                            break;
                        }
                    }
                    if(hasPairs) break;
                }
            }
            if (merged) {
                squad.inventory = invCards;
                this.saveSquad(squad);
                this.scene.restart({ keepTab: true });
            }
        });

        const maxCols = 5;
        const gridSpacingX = 64;
        const gridSpacingY = 55;

        let displayIndex = 0;
        for (let i = 0; i < invCards.length; i++) {
            const card = invCards[i];
            if (card.type === 'leader' || card.type === 'normal') continue;
            
            const row = Math.floor(displayIndex / maxCols);
            const col = displayIndex % maxCols;
            const x = invLeftX + 32 + col * gridSpacingX;
            const y = invSectionY + 40 + row * gridSpacingY;
            displayIndex++;

            const isSelected = (this.selectedCardIndex === i);

            // Card background box
            const cardBg = this.add.rectangle(x, y, 56, 48, slotColors[card.type] || 0x333333, 0.85)
                .setStrokeStyle(isSelected ? 3 : 1, isSelected ? 0xf1c40f : 0xffffff)
                .setInteractive({ useHandCursor: true });

            if (this.textures.exists(`ally_${card.type}`)) {
                this.add.sprite(x, y - 8, `ally_${card.type}`, 0).setDisplaySize(32, 32);
            }
            this.add.text(x, y + 14, `${card.level}★`, {
                fontSize: '11px', fontFamily: 'Arial Black', fill: isSelected ? '#f1c40f' : '#ffffff'
            }).setOrigin(0.5);

            // Card Click Event (Selection & Merge)
            cardBg.on('pointerdown', () => {
                if (this.selectedCardIndex === undefined) {
                    this.selectedCardIndex = i;
                    this.scene.restart({ keepTab: true });
                } else if (this.selectedCardIndex === i) {
                    this.selectedCardIndex = undefined;
                    this.scene.restart({ keepTab: true });
                } else {
                    const selectedCard = invCards[this.selectedCardIndex];
                    if (selectedCard && selectedCard.type === card.type) {
                        if (selectedCard.level !== card.level) {
                            // Can only merge same level cards
                            this.cameras.main.shake(100, 0.01);
                            this.selectedCardIndex = i;
                            this.scene.restart({ keepTab: true });
                            return;
                        }
                        // Merge!
                        card.level += 1;
                        
                        // Emit hidden skills triggers
                        if (card.level >= 5) {
                            if (card.type === 'tanker' && !localStorage.getItem('nyanya_hiddenSkillSeen_tanker')) {
                                this.sys.game.events.emit('show-hidden-skill', {
                                    unitName: '탱크',
                                    skillName: '금강불괴 (슈퍼아머)',
                                    desc: '데미지를 입을 때마다 0.2초간 모든 데미지와 상태이상을 무시하는 슈퍼아머가 발동합니다.'
                                });
                                localStorage.setItem('nyanya_hiddenSkillSeen_tanker', 'true');
                            } else if (card.type === 'shooter' && !localStorage.getItem('nyanya_hiddenSkillSeen_shooter')) {
                                this.sys.game.events.emit('show-hidden-skill', {
                                    unitName: '턱시도',
                                    skillName: '수류탄 투척',
                                    desc: '공격 10회마다 강력한 광역 데미지를 입히는 수류탄을 던집니다.'
                                });
                                localStorage.setItem('nyanya_hiddenSkillSeen_shooter', 'true');
                            } else if (card.type === 'normal' && !localStorage.getItem('nyanya_hiddenSkillSeen_normal')) {
                                this.sys.game.events.emit('show-hidden-skill', {
                                    unitName: '삼색이',
                                    skillName: '순간 대시',
                                    desc: '적과의 거리가 멀면 순간적으로 돌진하여 공격 사거리에 진입합니다.'
                                });
                                localStorage.setItem('nyanya_hiddenSkillSeen_normal', 'true');
                            } else if (card.type === 'healer' && !localStorage.getItem('nyanya_hiddenSkillSeen_healer')) {
                                this.sys.game.events.emit('show-hidden-skill', {
                                    unitName: '점박이',
                                    skillName: '대천사의 자비 (보호막)',
                                    desc: '치유 시 대상의 최대 체력을 초과한 회복량은 3초 동안 유지되는 보호막으로 전환됩니다.'
                                });
                                localStorage.setItem('nyanya_hiddenSkillSeen_healer', 'true');
                            }
                        }

                        invCards.splice(this.selectedCardIndex, 1);
                        this.selectedCardIndex = undefined;
                        squad.inventory = invCards;
                        this.saveSquad(squad);
                        this.scene.restart({ keepTab: true });
                    } else {
                        // Switch Selection
                        this.selectedCardIndex = i;
                        this.scene.restart({ keepTab: true });
                    }
                }
            });
        }

        // ─── Right Side: Current Deck ───
        const rightPanelCenterX = 600;
        const deckSectionY = 85;

        this.add.text(rightPanelCenterX, deckSectionY, `[ 출격 덱 (${deckSlots.length}슬롯) (클릭:해제) ]`, {
            fontSize: '13px', fontFamily: 'Arial Black', fill: '#e74c3c'
        }).setOrigin(0.5);

        for (let i = 0; i < deckSlots.length; i++) {
            const row = Math.floor(i / 5);
            const col = i % 5;
            const x = rightPanelCenterX - 130 + col * 65;
            const y = deckSectionY + 40 + row * 55;
            const cardObj = deckSlots[i];
            const unitType = cardObj?.type;

            const slotBg = this.add.rectangle(x, y, 56, 48, unitType ? (slotColors[unitType] || 0x333333) : 0x222222, 0.9)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });

            slotBg.on('pointerdown', () => {
                if (this.selectedCardIndex !== undefined) {
                    const selectedCard = invCards[this.selectedCardIndex];
                    const prevInSlot = deckSlots[i];

                    // Place selected card into this slot
                    deckSlots[i] = selectedCard;
                    
                    if (prevInSlot) {
                        // Swap: put previous card into the same inventory slot
                        invCards[this.selectedCardIndex] = prevInSlot;
                    } else {
                        // Just remove from inventory
                        invCards.splice(this.selectedCardIndex, 1);
                    }

                    this.selectedCardIndex = undefined;
                    squad.deck = deckSlots;
                    squad.inventory = invCards;
                    this.saveSquad(squad);
                    this.scene.restart({ keepTab: true });
                } else if (unitType) {
                    // Normal behavior: remove from deck
                    invCards.push(cardObj);
                    deckSlots[i] = null;
                    squad.deck = deckSlots;
                    squad.inventory = invCards;
                    this.saveSquad(squad);
                    this.scene.restart({ keepTab: true });
                }
            });

            if (unitType) {
                if (this.textures.exists(`ally_${unitType}`)) {
                    this.add.sprite(x, y - 5, `ally_${unitType}`, 0).setDisplaySize(32, 32);
                }
                this.add.text(x, y + 14, `${cardObj.level}★`, {
                    fontSize: '11px', fontFamily: 'Arial Black', fill: '#fbd46d'
                }).setOrigin(0.5);
            } else {
                this.add.text(x, y, '＋', {
                    fontSize: '20px', fontFamily: 'Arial Black', fill: '#555'
                }).setOrigin(0.5);
            }
        }

        // ─── Deploy & Sell Buttons for Selected Card ───
        if (this.selectedCardIndex !== undefined && invCards[this.selectedCardIndex]) {
            const selectedCard = invCards[this.selectedCardIndex];
            const deployY = 275;

            // Deploy Button (Left)
            const deployBtn = this.add.rectangle(130, deployY, 130, 30, 0x27ae60)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            
            this.add.text(130, deployY, `덱에 배치`, {
                fontSize: '14px', fontFamily: 'Arial Black', fill: '#fff'
            }).setOrigin(0.5);

            deployBtn.on('pointerdown', () => {
                const emptyIdx = deckSlots.findIndex(s => s === null);
                if (emptyIdx !== -1) {
                    deckSlots[emptyIdx] = selectedCard;
                    invCards.splice(this.selectedCardIndex, 1);
                    this.selectedCardIndex = undefined;
                    squad.deck = deckSlots;
                    squad.inventory = invCards;
                    this.saveSquad(squad);
                    this.scene.restart({ keepTab: true });
                }
            });

            // Sell Button (Right)
            const spec = ALLY_TYPES[selectedCard.type] || { cost: 200 };
            const refundAmount = (spec.cost || 200) * Math.pow(2, selectedCard.level - 1);

            const bigSellBtn = this.add.rectangle(270, deployY, 130, 30, 0xc0392b)
                .setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true });
            
            this.add.text(270, deployY, `판매 (${refundAmount} 냥)`, {
                fontSize: '11px', fontFamily: 'Arial Black', fill: '#fff'
            }).setOrigin(0.5);

            bigSellBtn.on('pointerdown', () => {
                const currentGold = this.registry.get('globalGold') || 0;
                this.registry.set('globalGold', currentGold + refundAmount);
                
                invCards.splice(this.selectedCardIndex, 1);
                this.selectedCardIndex = undefined;
                squad.inventory = invCards;
                this.saveSquad(squad);
                this.cameras.main.flash(200, 255, 251, 109, true);
                this.scene.restart({ keepTab: true });
            });
        }

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

    renderGachaTab() {
        this.add.rectangle(400, 150, 800, 300, 0x000000, 0.7);

        this.add.text(400, 45, '뽑기 상점 (GACHA)', {
            fontSize: '28px', fontFamily: 'Arial Black', fill: '#fbd46d', stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5);

        const currentGold = this.registry.get('globalGold') || 0;
        
        // 1 Pull Button
        const pull1Cost = 1000;
        const btn1 = this.add.rectangle(250, 160, 200, 80, currentGold >= pull1Cost ? 0x3498db : 0x7f8c8d)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: currentGold >= pull1Cost });
        this.add.text(250, 145, '1회 뽑기', { fontSize: '24px', fontFamily: 'Arial Black', fill: '#fff' }).setOrigin(0.5);
        this.add.text(250, 175, `${pull1Cost} 냥`, { fontSize: '16px', fontFamily: 'Arial Black', fill: '#f1c40f' }).setOrigin(0.5);

        // 10 Pull Button
        const pull10Cost = 10000;
        const btn10 = this.add.rectangle(550, 160, 200, 80, currentGold >= pull10Cost ? 0xe74c3c : 0x7f8c8d)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: currentGold >= pull10Cost });
        this.add.text(550, 145, '10연속 뽑기', { fontSize: '24px', fontFamily: 'Arial Black', fill: '#fff' }).setOrigin(0.5);
        this.add.text(550, 175, `${pull10Cost} 냥`, { fontSize: '16px', fontFamily: 'Arial Black', fill: '#f1c40f' }).setOrigin(0.5);

        const performGacha = (count, cost) => {
            if (currentGold < cost) return;
            this.registry.set('globalGold', currentGold - cost);
            
            const stageClears = this.registry.get('stageClears') || {};
            const maxClearedStage = Object.keys(stageClears).reduce((max, s) => stageClears[s] > 0 ? Math.max(max, parseInt(s)) : max, 0);
            const unlockedTypes = ['leader', 'normal', 'shooter', 'tanker', 'healer'].filter(t => t === 'leader' || (ALLY_TYPES[t] && (ALLY_TYPES[t].unlockStage || 0) <= maxClearedStage));
            
            let squad = this.registry.get('squad') || { inventory: [], deck: [] };
            if (!Array.isArray(squad.inventory)) squad.inventory = [];
            
            const drawnCards = [];
            for(let i=0; i<count; i++) {
                const randomType = Phaser.Utils.Array.GetRandom(unlockedTypes);
                squad.inventory.push({ type: randomType, level: 1 });
                drawnCards.push(randomType);
            }
            this.saveSquad(squad);
            
            btn1.disableInteractive();
            btn10.disableInteractive();

            const overlay = this.add.rectangle(400, 150, 800, 300, 0x000000, 0.85).setDepth(4000);
            
            const startX = count === 1 ? 400 : 160;
            const startY = count === 1 ? 150 : 100;
            const spaceX = count === 1 ? 0 : 120;
            const spaceY = count === 1 ? 0 : 110;

            drawnCards.forEach((type, index) => {
                const col = index % 5;
                const row = Math.floor(index / 5);
                const targetX = startX + col * spaceX;
                const targetY = startY + row * spaceY;

                const card = this.add.container(400, 150).setDepth(4001);
                card.setScale(0);

                const cardBg = this.add.rectangle(0, 0, 90, 100, 0x2c3e50).setStrokeStyle(3, 0xfbd46d);
                const spriteName = type === 'leader' ? 'ally_leader' : `ally_${type}`;
                const cardSprite = this.add.sprite(0, -15, spriteName, 0).setDisplaySize(48, 48);
                
                const nameStr = type === 'leader' ? '김냐냐' : (ALLY_TYPES[type] ? ALLY_TYPES[type].name : type);
                const nameText = this.add.text(0, 30, nameStr, { fontSize: '14px', fontFamily: 'Arial Black', fill: '#ffffff' }).setOrigin(0.5);

                card.add([cardBg, cardSprite, nameText]);

                this.tweens.add({
                    targets: card,
                    x: targetX,
                    y: targetY,
                    scaleX: 1,
                    scaleY: 1,
                    angle: 720,
                    duration: 600,
                    delay: index * 150,
                    ease: 'Back.easeOut',
                    onStart: () => {
                        try { this.sound.play('hit1', { volume: 0.2, rate: 2 }); } catch(e){}
                    }
                });

                const glow = this.add.circle(targetX, targetY, 60, 0xfbd46d, 0.6).setDepth(4000).setScale(0);
                this.tweens.add({
                    targets: glow,
                    scale: 1.5,
                    alpha: 0,
                    duration: 800,
                    delay: index * 150 + 500,
                    onStart: () => {
                        this.cameras.main.shake(100, 0.005);
                        try { this.sound.play('hit3', { volume: 0.3 }); } catch(e){}
                    }
                });
            });

            this.time.delayedCall(count * 150 + 1000, () => {
                const continueText = this.add.text(400, 270, '화면을 터치하여 계속...', {
                    fontSize: '18px', fontFamily: 'Arial Black', fill: '#fbd46d'
                }).setOrigin(0.5).setDepth(4001);

                this.tweens.add({
                    targets: continueText,
                    alpha: 0.2,
                    yoyo: true,
                    repeat: -1,
                    duration: 800
                });

                const closeZone = this.add.zone(400, 150, 800, 300).setInteractive().setDepth(5000);
                closeZone.once('pointerdown', () => {
                    this.scene.restart({ keepTab: true });
                });
            });
        };

        btn1.on('pointerdown', () => performGacha(1, pull1Cost));
        btn10.on('pointerdown', () => performGacha(10, pull10Cost));

        const backBtn = this.add.text(400, 275, '< 돌아가기', {
            fontSize: '24px', fontFamily: 'Arial Black', fill: '#ffffff', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.tab = 'MAIN';
            this.scene.restart({ keepTab: true });
        });
    }
}
