import { createSignal, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import Phaser from 'phaser';
import LobbyScene from './game/LobbyScene';
import GameScene from './game/GameScene';
import { ALLY_TYPES } from './game/unitsConfig';
import LEADER_SKILL_TREE from './game/leaderSkillTree.json';
import Guide from './components/Guide';
import TUTORIAL_CONFIG from './game/tutorialConfig.json';
import TutorialOverlay from './components/TutorialOverlay';
import './App.css';

const unitImages = import.meta.glob('./assets/units/*.png', { eager: true, import: 'default' });

function App() {
  const [spawnedUnits, setSpawnedUnits] = createSignal({});
  const [deckUnits, setDeckUnits] = createSignal([]); // deck from squad
  const [level, setLevel] = createSignal(1);
  const [gameOver, setGameOver] = createSignal('');
  const [currentSceneKey, setCurrentSceneKey] = createSignal('LobbyScene');
  const [cannonProgress, setCannonProgress] = createSignal(0);
  const [showDevMenu, setShowDevMenu] = createSignal(false);
  const [stage, setStage] = createSignal(1);
  const [stageCleared, setStageCleared] = createSignal(null);
  const [isAutoMode, setIsAutoMode] = createSignal(true);
  const [gameSpeed, setGameSpeed] = createSignal(1);
  const [showGuide, setShowGuide] = createSignal(false);
  const [unlockedUnit, setUnlockedUnit] = createSignal(null);
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
    console.log('Checking tutorials with trigger:', triggerData, 'Disabled:', tutorialsDisabled());
    if (activeTutorial() || tutorialsDisabled()) return;
    for (const tutorial of TUTORIAL_CONFIG) {
      if (completedTutorials().includes(tutorial.id)) {
        console.log('Tutorial already completed:', tutorial.id);
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

    gameInstance.events.on('update-cannon', (cp) => {
      setCannonProgress(cp);
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

    gameInstance.events.on('game-over', (result, reward = 0, drawnCard = '', drawnCardLevel = 1, drawnCardCount = 1) => {
      setGameOver(result);
      setVictoryReward(reward);
      setVictoryDrawnCard(drawnCard);
      setVictoryDrawnCardLevel(drawnCardLevel);
      setVictoryDrawnCardCount(drawnCardCount);
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
              gameInstance.scene.start('LobbyScene');
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
                  gameInstance.scene.start('LobbyScene');
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
                  gameInstance.scene.start('LobbyScene');
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

                <button onClick={() => setUnlockedUnit(null)} class="btn restart" style={{
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

        {hiddenSkillData() && (
          <Portal>
            <div class="modal-overlay" style={{
              "position": "fixed", "top": 0, "left": 0, "width": "100%", "height": "100%", "background": "rgba(0,0,0,0.85)",
              "display": "flex", "justify-content": "center", "align-items": "center", "z-index": 10000, "backdrop-filter": "blur(10px)"
            }}>
              <div class="hidden-skill-modal" style={{
                "background": "linear-gradient(135deg, #2c3e50 0%, #000000 100%)", "padding": "40px", "border-radius": "30px", "border": "4px solid #f1c40f",
                "width": "90%", "max-width": "450px", "box-shadow": "0 0 50px rgba(241, 196, 15, 0.3)", "color": "#fff", "text-align": "center",
                "animation": "scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
              }}>
                <div style={{ "font-size": "3rem", "margin-bottom": "20px" }}>🌟</div>
                <h2 style={{ "color": "#f1c40f", "margin-bottom": "10px", "font-size": "2rem", "text-transform": "uppercase" }}>HIDDEN SKILL UNLOCKED!</h2>
                <h3 style={{ "color": "#fff", "margin-bottom": "15px", "font-size": "1.4rem" }}>{hiddenSkillData().unitName}: {hiddenSkillData().skillName}</h3>
                <p style={{ "color": "#ccc", "line-height": "1.6", "margin-bottom": "30px" }}>{hiddenSkillData().desc}</p>

                <button onClick={() => setHiddenSkillData(null)} style={{
                  "background": "#f1c40f", "color": "#000", "border": "none", "padding": "12px 30px", "border-radius": "25px",
                  "font-weight": "bold", "font-size": "1.1rem", "cursor": "pointer", "transition": "all 0.2s"
                }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                  확인
                </button>
              </div>
            </div>
          </Portal>
        )}
        {skillTreeData() && (
          <Portal>
            <div class="game-over-screen" style={{
              "position": "fixed", "top": "0", "left": "0", "width": "100dvw", "height": "100dvh", "z-index": "20000",
              "background": "rgba(0, 0, 0, 0.9)", "display": "flex", "justify-content": "center", "align-items": "center", "backdrop-filter": "blur(15px)"
            }}>
              <div class="skill-tree-content" style={{
                "background": "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", "padding": "30px", "border-radius": "30px", "border": "4px solid #fbd46d",
                "width": "90%", "max-width": "500px", "box-shadow": "0 0 50px rgba(251, 212, 109, 0.2)", "color": "#fff", "text-align": "center"
              }}>
                <h2 style={{ "color": "#fbd46d", "margin-bottom": "10px", "font-size": "1.8rem" }}>LEADER LEVEL UP: {skillTreeData().level}</h2>
                <p style={{ "color": "#aaa", "margin-bottom": "25px" }}>새로운 능력을 선택하세요</p>

                <div class="perk-options" style={{ "display": "flex", "flex-direction": "column", "gap": "15px" }}>
                  {(() => {
                    const rawPerks = gameInstance?.registry.get('leaderPerks') || {};
                    const perks = {
                      shouting: typeof rawPerks.shouting === 'number' ? rawPerks.shouting : 0,
                      dealing: typeof rawPerks.dealing === 'number' ? rawPerks.dealing : 0,
                      tanking: typeof rawPerks.tanking === 'number' ? rawPerks.tanking : 0
                    };

                    const options = [];
                    Object.keys(LEADER_SKILL_TREE).forEach(branch => {
                      const currentLevel = perks[branch];
                      if (currentLevel < LEADER_SKILL_TREE[branch].length) {
                        options.push({ branch, perk: LEADER_SKILL_TREE[branch][currentLevel] });
                      }
                    });

                    if (options.length === 0) {
                      return <div style={{ color: '#aaa', padding: '20px' }}>모든 능력을 마스터했습니다!</div>;
                    }

                    const branchColors = {
                      shouting: '#43d8c9',
                      dealing: '#e74c3c',
                      tanking: '#2ecc71'
                    };
                    const branchNames = {
                      shouting: '함성 트랜스',
                      dealing: '전투 특화',
                      tanking: '생존 특화'
                    };

                    return options.map(({ branch, perk }) => (
                      <button onClick={() => {
                        if (gameInstance) {
                          const gold = gameInstance.registry.get('globalGold') || 0;
                          if (gold >= skillTreeData().cost) {
                            gameInstance.registry.set('globalGold', gold - skillTreeData().cost);

                            const levels = { ...gameInstance.registry.get('unitLevels') };
                            levels.leader = skillTreeData().level;
                            gameInstance.registry.set('unitLevels', levels);
                            localStorage.setItem('nyanya_unitLevels', JSON.stringify(levels));

                            const newPerks = { ...perks };
                            newPerks[branch] += 1;
                            gameInstance.registry.set('leaderPerks', newPerks);

                            setSkillTreeData(null);
                            gameInstance.scene.getScene('LobbyScene').scene.restart({ keepTab: true });
                          }
                        }
                      }} style={{
                        "background": "rgba(255,255,255,0.05)", "border": `1px solid ${branchColors[branch]}88`, "padding": "15px", "border-radius": "15px",
                        "cursor": "pointer", "transition": "all 0.2s", "text-align": "left", "color": "#fff", "position": "relative", "overflow": "hidden"
                      }} class="perk-btn" onMouseOver={(e) => e.currentTarget.style.background = `${branchColors[branch]}33`} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                        <div style={{ "position": "absolute", "top": "10px", "right": "15px", "font-size": "0.7rem", "color": branchColors[branch], "border": `1px solid ${branchColors[branch]}`, "padding": "2px 6px", "border-radius": "10px" }}>{branchNames[branch]}</div>
                        <div style={{ "font-weight": "bold", "color": branchColors[branch], "font-size": "1.1rem", "margin-bottom": "5px" }}>{perk.name}</div>
                        <div style={{ "font-size": "0.9rem", "color": "#ccc" }}>{perk.desc}</div>
                      </button>
                    ));
                  })()}
                </div>

                <button onClick={() => setSkillTreeData(null)} style={{
                  "margin-top": "25px", "background": "transparent", "border": "none", "color": "#666", "cursor": "pointer", "text-decoration": "underline"
                }}>나중에 하기</button>
              </div>
            </div>
          </Portal>
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
                const slotColors = { normal: '#43d8c9', tanker: '#3498db', shooter: '#9b59b6', healer: '#ff88aa' };
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
                    {isUsed && (
                      <div class="card-hp-bar">
                        <div class="card-hp-fill" style={{ width: `${currentHP * 100}%` }}></div>
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
                <div class="ability-icon">🗣️</div>
                <span class={cannonProgress() >= 100 ? 'cost ready' : 'cost'}>
                  {cannonProgress() >= 100 ? 'READY' : `${cannonProgress()}%`}
                </span>
              </button>
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
