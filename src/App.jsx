import { createSignal, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import Phaser from 'phaser';
import LobbyScene from './game/LobbyScene';
import GameScene from './game/GameScene';
import { ALLY_TYPES } from './game/unitsConfig';
import LEADER_SKILL_TREE from './game/leaderSkillTree.json';
import Guide from './components/Guide';
import TUTORIAL_CONFIG from './game/tutorialConfig.json';
import ITEM_CONFIG from './game/itemsConfig.json';
import TutorialOverlay from './components/TutorialOverlay';
import HiddenSkillModal from './components/HiddenSkillModal';
import SkillTreeModal from './components/SkillTreeModal';
import './App.css';

function App() {
  const [spawnedUnits, setSpawnedUnits] = createSignal({});
  const [respawnTimers, setRespawnTimers] = createSignal({}); // { deckIndex: timeLeft }
  const [deckUnits, setDeckUnits] = createSignal([]); // deck from squad
  const [itemDeck, setItemDeck] = createSignal([]); // item deck from registry
  const [level, setLevel] = createSignal(1);
  const [gameOver, setGameOver] = createSignal('');
  const [currentSceneKey, setCurrentSceneKey] = createSignal('LobbyScene');
  const [cannonProgress, setCannonProgress] = createSignal(0);
  const [cannonSeconds, setCannonSeconds] = createSignal(0);
  const [stageProgress, setStageProgress] = createSignal(0);
  const [showDevMenu, setShowDevMenu] = createSignal(false);
  const [stage, setStage] = createSignal(1);
  const [stageCleared, setStageCleared] = createSignal(null);
  const [isAutoMode, setIsAutoMode] = createSignal(true);
  const [gameSpeed, setGameSpeed] = createSignal(1);
  const [showGuide, setShowGuide] = createSignal(false);
  const [unlockedUnit, setUnlockedUnit] = createSignal(null);
  const [unlockedItem, setUnlockedItem] = createSignal(null);
  const [isRepeatMode, setIsRepeatMode] = createSignal(false);
  const [victoryReward, setVictoryReward] = createSignal(0);
  const [skillTreeData, setSkillTreeData] = createSignal(null);
  const [hiddenSkillData, setHiddenSkillData] = createSignal(null); // { level, cost }
  const [confirmReset, setConfirmReset] = createSignal(false);
  const [victoryDrawnCard, setVictoryDrawnCard] = createSignal('');
  const [victoryDrawnCardLevel, setVictoryDrawnCardLevel] = createSignal(1);
  const [victoryDrawnCardCount, setVictoryDrawnCardCount] = createSignal(1);
  const [mortarIndices, setMortarIndices] = createSignal([]);
  const [allyHPs, setAllyHPs] = createSignal({});
  const [completedTutorials, setCompletedTutorials] = createSignal(
    JSON.parse(localStorage.getItem('nyanya_completedTutorials') || '[]')
  );
  const [tutorialsDisabled, setTutorialsDisabled] = createSignal(
    localStorage.getItem('nyanya_tutorialsDisabled') === 'true'
  );
  const [activeTutorial, setActiveTutorial] = createSignal(null);
  const [currentTab, setCurrentTab] = createSignal('MAIN');
  let gameContainer;
  let gameInstance = null;
  let currentScene = null;

  const isTriggerMatched = (trigger, data) => {
    switch (trigger.type) {
      case 'game_start':
        return data.type === 'game_start';
      case 'scene_active':
        return currentSceneKey() === trigger.scene;
      case 'tab_active':
        return currentTab() === trigger.tab;
      case 'stage_cleared':
        return data.type === 'stage_cleared' && data.stage === trigger.stage;
      case 'card_merged':
        return data.type === 'card_merged';
      case 'mortar_detected':
        return data.type === 'mortar_detected';
      case 'tanker_combo_detected':
        return data.type === 'tanker_combo_detected';
      case 'stage_completed':
        const clears = JSON.parse(localStorage.getItem('nyanya_stageClears') || '{}');
        return !!clears[trigger.stage];
      case 'all':
        return trigger.conditions.every(cond => isTriggerMatched(cond, data));
      case 'any':
        return trigger.conditions.some(cond => isTriggerMatched(cond, data));
      default:
        return false;
    }
  };

  const checkTutorials = (triggerData = {}) => {
    if (activeTutorial() || tutorialsDisabled()) return;
    for (const tutorial of TUTORIAL_CONFIG) {
      if (completedTutorials().includes(tutorial.id)) {
        continue;
      }
      if (isTriggerMatched(tutorial.trigger, triggerData)) {
        console.log('Tutorial triggered!', tutorial.id);
        setActiveTutorial(tutorial);
        break;
      }
    }
  };

  onMount(() => {
    const handleKeyDown = (e) => {
      if (e.key === '`') {
        setShowDevMenu((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    if (!window.__phaserInputPatched && Phaser.Input && Phaser.Input.InputManager) {
      const originalTransform = Phaser.Input.InputManager.prototype.transformPointer;
      Phaser.Input.InputManager.prototype.transformPointer = function (pointer, pageX, pageY, wasMove) {
        originalTransform.call(this, pointer, pageX, pageY, wasMove);

        const isPortrait = window.matchMedia("(orientation: portrait) and (max-device-width: 1024px)").matches;
        if (isPortrait) {
          const px = pointer.x;
          const py = pointer.y;

          pointer.x = py * (800 / 300);
          pointer.y = 300 - (px * (300 / 800));

          pointer.position.set(pointer.x, pointer.y);
        }
      };
      window.__phaserInputPatched = true;
    }

    const config = {
      type: Phaser.AUTO,
      width: 800,
      height: 300,
      parent: gameContainer,
      backgroundColor: '#1a1a2e',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        orientation: Phaser.Scale.Orientation.ANY
      },
      scene: [LobbyScene, GameScene]
    };

    gameInstance = new Phaser.Game(config);

    // Initial check for game_start
    setTimeout(() => {
      checkTutorials({ type: 'game_start' });
    }, 1000);

    gameInstance.events.on('lobby-ready', () => {
      currentScene = null;  // stale 참조 해제
      setCurrentSceneKey('LobbyScene');
      setGameOver('');
      setStageCleared(null);
      setIsAutoMode(true);
      setSpawnedUnits({ normal: false, tanker: false, shooter: false });
      checkTutorials();
    });

    gameInstance.events.on('tab-changed', (tab) => {
      setCurrentTab(tab);
      checkTutorials();
    });

    gameInstance.events.on('game-ready', (scene) => {
      currentScene = scene;
      setCurrentSceneKey('GameScene');
      setGameOver('');
      setStage(scene.stage);
      // Load deck from squad data
      const squad = gameInstance.registry.get('squad') || { inventory: {}, deck: [null, null, null] };
      const deck = squad.deck || [null, null, null];
      setDeckUnits(deck);
      setItemDeck(gameInstance.registry.get('itemDeck') || [null]);

      const mIndices = gameInstance.registry.get('mortarGroupIndices') || [];
      const tIndices = gameInstance.registry.get('tankerComboIndices') || [];
      setMortarIndices(mIndices);

      // Initialize spawned status for each deck slot, including combo units
      const initSpawned = {};
      deck.forEach((_, idx) => {
        const isComboUnit = mIndices.includes(idx) || tIndices.includes(idx);
        initSpawned[idx] = isComboUnit;
      });
      setSpawnedUnits(initSpawned);

      checkTutorials({ type: 'scene_active', scene: 'GameScene' });
    });

    gameInstance.events.on('update-cannon', setCannonProgress);
    gameInstance.events.on('update-cannon-seconds', setCannonSeconds);
    gameInstance.events.on('update-stage-progress', setStageProgress);

    gameInstance.events.on('card-merged', () => {
      checkTutorials({ type: 'card_merged' });
    });

    gameInstance.events.on('mortar-detected', () => {
      checkTutorials({ type: 'mortar_detected' });
    });

    gameInstance.events.on('tanker-combo-detected', () => {
      checkTutorials({ type: 'tanker_combo_detected' });
    });

    gameInstance.events.on('level-up', (lvl) => {
      setLevel(lvl);
    });

    gameInstance.events.on('stage-up', (s) => {
      setStage(s);
      const initSpawned = {};
      deckUnits().forEach((_, idx) => initSpawned[idx] = false);
      setSpawnedUnits(initSpawned);
    });

    gameInstance.events.on('stage-clear', (data) => {
      setStageCleared(data);
      setShowGuide(false);
      setActiveTutorial(null);
      if (isRepeatMode()) {
        setTimeout(() => {
          if (stageCleared()) {
            const s = data.stage;
            if (gameInstance) {
              gameInstance.scene.stop('GameScene');
              gameInstance.scene.start('GameScene', { stage: s, speed: gameSpeed() });
              setStageCleared(null);
            }
          }
        }, 3000);
      }
      checkTutorials({ type: 'stage_cleared', stage: data.stage });
    });

    gameInstance.events.on('deck-unit-spawned', (idx) => {
      setSpawnedUnits(prev => ({ ...prev, [idx]: true }));
    });

    gameInstance.events.on('update-ally-hps', (hps) => {
      setAllyHPs(hps);
    });

    gameInstance.events.on('unit-respawn-countdown', (data) => {
      setRespawnTimers(prev => {
        const next = { ...prev };
        if (data.timeLeft < 0) {
          delete next[data.index];
        } else {
          next[data.index] = data.timeLeft;
        }
        return next;
      });
    });

    gameInstance.events.on('game-over', (result, reward = 0, drawnCard = '', drawnCardLevel = 1, drawnCardCount = 1) => {
      setGameOver(result);
      setVictoryReward(reward);
      setVictoryDrawnCard(drawnCard);
      setVictoryDrawnCardLevel(drawnCardLevel);
      setVictoryDrawnCardCount(drawnCardCount);
      setShowGuide(false);
      setActiveTutorial(null);
      if (result === 'victory' && isRepeatMode()) {
        setTimeout(() => {
          if (gameOver() === 'victory') {
            const s = stage();
            if (gameInstance) {
              gameInstance.scene.stop('GameScene');
              gameInstance.scene.start('GameScene', { stage: s, speed: gameSpeed() });
              setGameOver('');
            }
          }
        }, 3000);
      } else if (result !== 'victory' && isRepeatMode()) {
        // Stop repeat and return to lobby on defeat
        setTimeout(() => {
          if (gameOver() !== '' && gameOver() !== 'victory') {
            if (gameInstance) {
              gameInstance.scene.stop('GameScene');
              gameInstance.scene.start('LobbyScene', { tab: 'MAIN' });
            }
            setCurrentSceneKey('LobbyScene');
            setGameOver('');
            setIsRepeatMode(false);
          }
        }, 3000);
      }
    });

    gameInstance.events.on('toggle-dev-menu', () => {
      setShowDevMenu((prev) => !prev);
    });

    gameInstance.events.on('show-guide', () => {
      setShowGuide(true);
    });

    gameInstance.events.on('boss-dead', () => {
      setShowGuide(false);
      setActiveTutorial(null);
    });

    gameInstance.events.on('unit-unlocked', (info) => {
      setUnlockedUnit(info);
    });

    gameInstance.events.on('show-leader-skill-tree', (data) => {
      setSkillTreeData(data);
    });

    gameInstance.events.on('show-hidden-skill', (data) => {
      setHiddenSkillData(data);
    });

    // Registry Persistence (Global listeners)
    gameInstance.registry.events.on('changedata-globalGold', (parent, value) => {
      localStorage.setItem('nyanya_xp', value);
    });
    gameInstance.registry.events.on('changedata-unitLevels', (parent, value) => {
      localStorage.setItem('nyanya_unitLevels', JSON.stringify(value));
    });
    gameInstance.registry.events.on('changedata-stageClears', (parent, value) => {
      localStorage.setItem('nyanya_stageClears', JSON.stringify(value));
    });
    gameInstance.registry.events.on('changedata-squad', (parent, value) => {
      localStorage.setItem('nyanya_squad', JSON.stringify(value));
      if (currentSceneKey() === 'GameScene') {
        setDeckUnits(value.deck || [null, null, null]);
        if (gameInstance) {
          setMortarIndices(gameInstance.registry.get('mortarGroupIndices') || []);
        }
      }
    });
    gameInstance.registry.events.on('changedata-itemDeck', (parent, value) => {
      setItemDeck(value || [null]);
    });
    gameInstance.registry.events.on('changedata-leaderPerks', (parent, value) => {
      localStorage.setItem('nyanya_leaderPerks', JSON.stringify(value));
    });

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameInstance) {
        gameInstance.destroy(true);
      }
    });
  });

  const handleItemUse = (itemId, idx) => {
    if (gameInstance && currentSceneKey() === 'GameScene' && itemId) {
      const scene = gameInstance.scene.getScene('GameScene');
      if (scene && scene.useItem) {
        const itemUsed = scene.useItem(itemId, idx);
        if (itemUsed) {
          const newDeck = [...itemDeck()];
          const item = ITEM_CONFIG[itemId];
          if (item.type === 'consumable') {
            newDeck[idx] = null;
            setItemDeck(newDeck);
            gameInstance.registry.set('itemDeck', newDeck);
            localStorage.setItem('nyanya_itemDeck', JSON.stringify(newDeck));
            
            // Deduct from inventory
            const inv = gameInstance.registry.get('itemInventory') || {};
            if (inv[itemId] > 0) {
                inv[itemId]--;
                gameInstance.registry.set('itemInventory', inv);
                localStorage.setItem('nyanya_itemInventory', JSON.stringify(inv));
            }
          }
        }
      }
    }
  };

  const handleSpawn = (deckIdx) => {
    if (currentScene && !spawnedUnits()[deckIdx]) {
      currentScene.spawnDeckUnit(deckIdx);
    }
  };

  const handleHeal = () => {
    if (currentScene) {
      currentScene.healBase();
    }
  };

  const handleShouting = () => {
    if (currentScene && cannonProgress() >= 100) {
      currentScene.fireShouting();
    }
  };

  const toggleAutoMode = () => {
    const newVal = !isAutoMode();
    setIsAutoMode(newVal);
    if (currentScene) {
      currentScene.setAutoMode(newVal);
    }
  };

  const changeGameSpeed = (speed) => {
    setGameSpeed(speed);
    if (gameInstance) {
      gameInstance.registry.set('gameSpeed', speed);
    }
    if (currentScene) {
      currentScene.setGameSpeed(speed);
    }
  };

  return (
    <div class="app-container">
      <div class="game-wrapper">

        <div ref={gameContainer} class="phaser-container"></div>
        <TutorialOverlay
          tutorial={activeTutorial()}
          onComplete={(id, disableAll) => {
            if (disableAll) {
              setTutorialsDisabled(true);
              localStorage.setItem('nyanya_tutorialsDisabled', 'true');
            }

            const newCompleted = [...completedTutorials(), id];
            setCompletedTutorials(newCompleted);
            localStorage.setItem('nyanya_completedTutorials', JSON.stringify(newCompleted));

            setActiveTutorial(null);

            // Check for next tutorial immediately after one is completed
            if (!disableAll) {
              setTimeout(() => checkTutorials(), 300);
            }
          }}
        />
        {gameOver() !== '' && (
          <div class="game-over-screen">
            <div style={{ "display": "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", "width": "100%", "height": "100%", "position": "relative" }}>
              <div style={{ "display": "flex", "align-items": "center", "justify-content": "center", "gap": "40px" }}>
                <div style={{ "display": "flex", "flex-direction": "column", "align-items": "center" }}>
                  <h2 class="victory-msg" style={{ "margin": "0 0 10px 0", "font-size": "3rem" }}>
                    {gameOver() === 'victory' ? '승리!' : (gameOver() === 'retreat' ? '후퇴' : '패배...')}
                  </h2>
                  {victoryReward() > 0 && (
                    <p style={{ "font-size": "1.5rem", "color": "#fbd46d", "margin": "0" }}>
                      {gameOver() === 'victory' ? '획득 보상: ' : '전투 수당: '}{victoryReward()} 냥
                    </p>
                  )}
                </div>

                {gameOver() === 'victory' && victoryDrawnCard() && (
                  <div style={{ "display": "flex", "flex-direction": "column", "align-items": "center", "position": "relative" }}>
                    <div class="reward-card" style={{
                      "background": "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
                      "border": "3px solid #fbd46d",
                      "border-radius": "16px",
                      "width": "120px",
                      "height": "170px",
                      "display": "flex",
                      "flex-direction": "column",
                      "align-items": "center",
                      "justify-content": "space-around",
                      "box-shadow": "0 0 25px rgba(251, 212, 109, 0.5)",
                      "padding": "10px",
                      "animation": "titleBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    }}>
                      <div style={{ "color": "#fbd46d", "font-weight": "900", "font-size": "1.1rem", "letter-spacing": "1px" }}>뽑기 보상</div>
                      <div style={{
                        "width": "64px",
                        "height": "64px",
                        "background": "rgba(255, 255, 255, 0.05)",
                        "border": "1px solid rgba(255, 255, 255, 0.2)",
                        "border-radius": "12px",
                        "display": "flex",
                        "align-items": "center",
                        "justify-content": "center"
                      }}>
                        <div class={`unit-icon ${victoryDrawnCard()}-icon`} style={{ "width": "40px", "height": "40px", "margin": "0" }}></div>
                      </div>
                      <div style={{ "color": "#fff", "font-weight": "700", "font-size": "1rem" }}>{victoryDrawnCard() === 'leader' ? '김냐냐' : ALLY_TYPES[victoryDrawnCard()]?.name}</div>
                    </div>
                    <p style={{ "color": "#a8ffb2", "font-size": "1.1rem", "font-weight": "700", "position": "absolute", "bottom": "-35px", "white-space": "nowrap", "margin": "0" }}>
                      {victoryDrawnCardLevel()}★ {victoryDrawnCard() === 'leader' ? '김냐냐' : ALLY_TYPES[victoryDrawnCard()]?.name} 카드 x {victoryDrawnCardCount()}
                    </p>
                  </div>
                )}
              </div>
              <button onClick={() => {
                if (gameInstance) {
                  gameInstance.scene.stop('GameScene');
                  gameInstance.scene.start('LobbyScene', { tab: 'MAIN' });
                }
                setCurrentSceneKey('LobbyScene');
                setCurrentTab('MAIN');
                setGameOver('');
                setVictoryReward(0);
              }} class="btn restart" style={{ "position": "absolute", "bottom": "30px", "margin": "0" }}>돌아가기</button>
            </div>
          </div>
        )}
        {stageCleared() && (
          <div class="game-over-screen">
            <div style={{ "display": "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", "width": "100%", "height": "100%", "position": "relative" }}>
              <div style={{ "display": "flex", "align-items": "center", "justify-content": "center", "gap": "40px" }}>
                <div style={{ "display": "flex", "flex-direction": "column", "align-items": "center" }}>
                  <h2 class="victory-msg" style={{ "margin": "0 0 10px 0", "font-size": "3rem" }}>승리!</h2>
                  <p style={{ "font-size": "1.5rem", "color": "#fbd46d", "margin": "0" }}>Bonus: {stageCleared().reward} 냥 지급!</p>
                </div>

                {stageCleared().drawnCard && (
                  <div style={{ "display": "flex", "flex-direction": "column", "align-items": "center", "position": "relative" }}>
                    <div class="reward-card" style={{
                      "background": "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
                      "border": "3px solid #fbd46d",
                      "border-radius": "16px",
                      "width": "120px",
                      "height": "170px",
                      "display": "flex",
                      "flex-direction": "column",
                      "align-items": "center",
                      "justify-content": "space-around",
                      "box-shadow": "0 0 25px rgba(251, 212, 109, 0.5)",
                      "padding": "10px",
                      "animation": "titleBounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    }}>
                      <div style={{ "color": "#fbd46d", "font-weight": "900", "font-size": "1.1rem", "letter-spacing": "1px" }}>뽑기 보상</div>
                      <div style={{
                        "width": "64px",
                        "height": "64px",
                        "background": "rgba(255, 255, 255, 0.05)",
                        "border": "1px solid rgba(255, 255, 255, 0.2)",
                        "border-radius": "12px",
                        "display": "flex",
                        "align-items": "center",
                        "justify-content": "center"
                      }}>
                        <div class={`unit-icon ${stageCleared().drawnCard}-icon`} style={{ "width": "40px", "height": "40px", "margin": "0" }}></div>
                      </div>
                      <div style={{ "color": "#fff", "font-weight": "700", "font-size": "1rem" }}>{stageCleared().drawnCard === 'leader' ? '김냐냐' : ALLY_TYPES[stageCleared().drawnCard]?.name}</div>
                    </div>
                    <p style={{ "color": "#a8ffb2", "font-size": "1.1rem", "font-weight": "700", "position": "absolute", "bottom": "-35px", "white-space": "nowrap", "margin": "0" }}>
                      {stageCleared().drawnCardLevel || 1}★ {stageCleared().drawnCard === 'leader' ? '김냐냐' : ALLY_TYPES[stageCleared().drawnCard]?.name} 카드 x {stageCleared().drawnCardCount || 1}
                    </p>
                  </div>
                )}
              </div>
              <button onClick={() => {
                setStageCleared(null);
                if (gameInstance) {
                  gameInstance.scene.stop('GameScene');
                  gameInstance.scene.start('LobbyScene', { tab: 'MAIN' });
                }
                setCurrentSceneKey('LobbyScene');
                setCurrentTab('MAIN');
              }} class="btn restart" style={{ "position": "absolute", "bottom": "30px", "margin": "0" }}>돌아가기</button>
            </div>
          </div>
        )}
        {unlockedUnit() && (
          <Portal>
            <div class="game-over-screen unlock-modal" style={{
              "position": "fixed",
              "top": "0",
              "left": "0",
              "width": "100dvw",
              "height": "100dvh",
              "z-index": "10000",
              "background": "rgba(0, 0, 0, 0.85)",
              "display": "flex",
              "justify-content": "center",
              "align-items": "center",
              "backdrop-filter": "blur(10px)",
              "padding": "10px"
            }}>
              <div class="unlock-content" style={{
                "text-align": "center",
                "background": "rgba(26, 26, 46, 0.98)",
                "padding": "20px 30px",
                "border-radius": "24px",
                "border": "4px solid #fbd46d",
                "max-width": "450px",
                "max-height": "95dvh",
                "width": "90%",
                "box-shadow": "0 0 50px rgba(0,0,0,0.5)",
                "position": "relative",
                "overflow-y": "auto",
                "display": "flex",
                "flex-direction": "column",
                "gap": "10px"
              }}>
                <h2 class="victory-msg" style={{
                  "font-size": "min(2rem, 8vw)",
                  "margin": "0",
                  "line-height": "1.2"
                }}>NEW UNIT UNLOCKED!</h2>

                <div class="unit-preview" style={{
                  "width": "80px",
                  "height": "80px",
                  "margin": "10px auto"
                }}>
                  <div class={`unit-icon ${unlockedUnit().key}-icon`} style={{ "width": "80px", "height": "80px" }}></div>
                </div>

                <h3 style={{ "color": "#fff", "font-size": "1.5rem", "margin": "0" }}>{unlockedUnit().name}</h3>

                <p style={{
                  "color": "#aaa",
                  "margin": "0 0 10px",
                  "font-size": "0.95rem",
                  "line-height": "1.4"
                }}>스테이지 {unlockedUnit().stage} 클리어 보상으로<br />새로운 용병을 고용할 수 있게 되었습니다!</p>

                <button onClick={() => {
                  const unit = unlockedUnit();
                  setUnlockedUnit(null);
                  if (unit && unit.stage === 3) {
                    setUnlockedItem(ITEM_CONFIG.heavy_metal);
                  }
                }} class="btn restart" style={{
                  "width": "100%",
                  "max-width": "260px",
                  "margin": "0 auto",
                  "padding": "10px",
                  "min-height": "45px"
                }}>확인</button>
              </div>
            </div>
          </Portal>
        )}
        {unlockedItem() && (
          <Portal>
            <div class="game-over-screen unlock-modal" style={{
              "position": "fixed", "top": "0", "left": "0", "width": "100dvw", "height": "100dvh", "z-index": "10001",
              "background": "rgba(0, 0, 0, 0.85)", "display": "flex", "justify-content": "center", "align-items": "center", "backdrop-filter": "blur(10px)"
            }}>
              <div class="unlock-content" style={{
                "text-align": "center", "background": "rgba(26, 26, 46, 0.98)", "padding": "30px", "border-radius": "24px",
                "border": "4px solid #43d8c9", "max-width": "450px", "width": "90%", "box-shadow": "0 0 50px rgba(67, 216, 201, 0.3)"
              }}>
                <h2 class="victory-msg" style={{ "font-size": "2rem", "margin": "0", "color": "#43d8c9" }}>NEW ITEM UNLOCKED!</h2>
                <div style={{ "font-size": "60px", "margin": "20px 0" }}>{unlockedItem().icon}</div>
                <h3 style={{ "color": "#fff", "font-size": "1.5rem", "margin": "0" }}>{unlockedItem().name}</h3>
                <p style={{ "color": "#aaa", "margin": "15px 0 25px", "line-height": "1.4" }}>{unlockedItem().desc}</p>
                <button onClick={() => setUnlockedItem(null)} class="btn restart" style={{ "width": "100%", "max-width": "260px", "margin": "0 auto" }}>확인</button>
              </div>
            </div>
          </Portal>
        )}

        {hiddenSkillData() && (
          <HiddenSkillModal 
            data={hiddenSkillData()} 
            onClose={() => setHiddenSkillData(null)} 
          />
        )}
        {skillTreeData() && (
          <SkillTreeModal 
            data={skillTreeData()} 
            gameInstance={gameInstance} 
            onClose={() => setSkillTreeData(null)} 
          />
        )}
        {currentSceneKey() === 'GameScene' && (
          <>
            <div class="top-controls-group">
              <div class="auto-mode-toggle" onClick={toggleAutoMode}>
                <div class={`toggle-switch ${isAutoMode() ? 'on' : 'off'}`}>
                  <div class={isAutoMode() ? 'toggle-label on' : 'toggle-label off'}>AUTO</div>
                  <div class="toggle-handle"></div>
                </div>
              </div>
              <div class="repeat-mode-toggle" onClick={() => setIsRepeatMode(!isRepeatMode())}>
                <div class={`toggle-switch repeat ${isRepeatMode() ? 'on' : 'off'}`}>
                  <div class={isRepeatMode() ? 'toggle-label on' : 'toggle-label off'}>REPEAT</div>
                  <div class="toggle-handle"></div>
                </div>
              </div>
              <button class="retreat-btn" onClick={() => {
                if (currentScene) currentScene.retreat();
              }}>후퇴</button>
            </div>
          </>
        )}

        {showDevMenu() && (
          <div class="dev-menu">
            <h4>Dev Menu</h4>
            <div class="dev-btn-group">
              <button class="dev-btn" onClick={() => { if (currentScene) currentScene.instantWin(); }}>
                Instant Win
              </button>

              <button class={`dev-btn ${gameSpeed() === 1 ? 'active' : ''}`} onClick={() => changeGameSpeed(1)}>
                1x Speed
              </button>

              <button class={`dev-btn ${gameSpeed() === 3 ? 'active' : ''}`} onClick={() => changeGameSpeed(3)}>
                3x Speed
              </button>

              <button class="dev-btn" onClick={() => {
                setCompletedTutorials([]);
                setTutorialsDisabled(false);
                localStorage.removeItem('nyanya_completedTutorials');
                localStorage.removeItem('nyanya_tutorialsDisabled');
                alert('Tutorials reset! Refresh or trigger a condition.');
              }}>
                Reset Tutorials
              </button>

              {!confirmReset() ? (
                <button class="dev-btn danger" onPointerDown={() => setConfirmReset(true)}>
                  Reset All
                </button>
              ) : (
                <>
                  <button class="dev-btn danger" style={{ background: '#ff0000', color: '#fff' }} onPointerDown={() => {
                    window.localStorage.clear();
                    window.location.reload();
                  }}>
                    CONFIRM RESET!
                  </button>
                  <button class="dev-btn" onPointerDown={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {currentSceneKey() === 'GameScene' && (
        <div class="controls-panel">
          <div class="main-controls">
            <div class="button-group allies-group">
              {deckUnits().map((cardObj, idx) => {
                if (!cardObj || !cardObj.type) return null;
                const unitType = cardObj.type;
                const spec = ALLY_TYPES[unitType];
                const slotColors = { normal: '#43d8c9', tanker: '#3498db', shooter: '#9b59b6', healer: '#ff88aa', raccoon: '#8d6e63' };
                const isUsed = spawnedUnits()[idx];
                const isMortarPart = mortarIndices().includes(idx);

                // HP Bar logic for normal and combo units
                let currentHP = 0;
                if (isUsed) {
                  if (isMortarPart) {
                    currentHP = allyHPs()[mortarIndices()[0]] || 0;
                  } else {
                    // Check for tanker combo (if I had those indices in App.jsx too)
                    // For now, check if the index itself has HP reported
                    currentHP = allyHPs()[idx] ?? 0;
                    // Fallback for tanker combo if idx is idx2
                    if (currentHP === 0 && idx > 0) {
                      // Simple check for tanker combo if not explicitly tracked yet
                      // Actually, I should probably export tankerComboIndices too
                      const tIndices = gameInstance?.registry.get('tankerComboIndices') || [];
                      if (tIndices.includes(idx)) {
                        currentHP = allyHPs()[tIndices[0]] || 0;
                      }
                    }
                  }
                }

                return (
                  <button class={`btn ally-btn ${isMortarPart ? 'bundled-unit' : ''} ${isUsed ? 'is-used' : ''}`}
                    disabled={isUsed || gameOver() !== '' || stageCleared()}
                    onClick={() => handleSpawn(idx)}
                    style={{ "border-color": isMortarPart ? '#9b59b6' : (slotColors[unitType] || '#fff'), "position": "relative" }}>
                    {isUsed && !respawnTimers()[idx] && (
                      <div class="card-hp-bar">
                        <div class="card-hp-fill" style={{ width: `${currentHP * 100}%` }}></div>
                      </div>
                    )}
                    {respawnTimers()[idx] !== undefined && (
                      <div class="respawn-overlay" style={{
                        "position": "absolute",
                        "top": "0",
                        "left": "0",
                        "width": "100%",
                        "height": "100%",
                        "background": "rgba(0,0,0,0.6)",
                        "display": "flex",
                        "align-items": "center",
                        "justify-content": "center",
                        "z-index": "20",
                        "border-radius": "8px"
                      }}>
                        <span style={{ "color": "#fbd46d", "font-size": "24px", "font-weight": "900", "text-shadow": "0 0 10px #000" }}>
                          {respawnTimers()[idx]}
                        </span>
                      </div>
                    )}
                    {isMortarPart && idx === mortarIndices()[1] && (
                      <div class="bundled-label">박격포병 부대</div>
                    )}
                    <div class={`unit-icon ${unitType}-icon`} style={{
                      "background-color": "transparent"
                    }}></div>
                    <span class="cost">{`${cardObj.level}★ ${spec?.name?.split(' ')[0]}`}</span>
                  </button>
                );
              })}
              {deckUnits().every(u => u === null) && (
                <span style={{ "color": "#888", "font-size": "12px", "padding": "10px" }}>덱이 비어있습니다. 로비에서 부대를 편성해주세요.</span>
              )}
            </div>

            <div class="button-group upgrades-group">
              <button class="btn ally-btn shouting-btn" disabled={cannonProgress() < 100 || gameOver() !== '' || stageCleared()} onClick={handleShouting}>
                <div class="ability-icon">{itemDeck().includes('heavy_metal') ? '🎸' : '🗣️'}</div>
                <span class={cannonProgress() >= 100 ? 'cost ready' : 'cost'}>
                  {itemDeck().includes('heavy_metal') 
                    ? (cannonProgress() >= 100 ? 'HEAVY METAL' : `${cannonSeconds()}s`) 
                    : (cannonProgress() >= 100 ? 'READY' : `${cannonProgress()}%`)}
                </span>
              </button>
            </div>
            <div class="button-group items-group">
              {itemDeck().map((itemId, idx) => {
                const item = ITEM_CONFIG[itemId];
                return (
                  <button class="btn item-btn" 
                    disabled={!itemId || gameOver() !== '' || stageCleared()}
                    onClick={() => handleItemUse(itemId, idx)}>
                    {item ? (
                      <>
                        <div class="item-icon">{item.icon}</div>
                        <span class="item-name">{item.name}</span>
                      </>
                    ) : (
                      <div class="empty-slot">EMPTY</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}



      {showGuide() && (
        <Portal>
          <Guide onClose={() => setShowGuide(false)} />
        </Portal>
      )}

    </div>
  );
}

export default App;
