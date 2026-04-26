import { createSignal, onMount, onCleanup } from 'solid-js';
import { Portal } from 'solid-js/web';
import Phaser from 'phaser';
import LobbyScene from './game/LobbyScene';
import GameScene from './game/GameScene';
import { ALLY_TYPES } from './game/unitsConfig';
import Guide from './components/Guide';
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
  let gameContainer;
  let gameInstance = null;
  let currentScene = null;

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

    gameInstance.events.on('lobby-ready', () => {
      currentScene = null;  // stale 참조 해제
      setCurrentSceneKey('LobbyScene');
      setGameOver('');
      setStageCleared(null);
      setIsAutoMode(true);
      setSpawnedUnits({normal: false, tanker: false, shooter: false});
    });

    gameInstance.events.on('game-ready', (scene) => {
      currentScene = scene;
      setCurrentSceneKey('GameScene');
      setGameOver('');
      setStage(scene.stage);
      // Load deck from squad data
      const squad = gameInstance.registry.get('squad') || { inventory: {}, deck: [null, null, null, null, null] };
      const deck = squad.deck || [null, null, null, null, null];
      setDeckUnits(deck);
      // Initialize spawned status for each deck slot
      const initSpawned = {};
      deck.forEach((_, idx) => initSpawned[idx] = false);
      setSpawnedUnits(initSpawned);
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
    });

    gameInstance.events.on('deck-unit-spawned', (idx) => {
      setSpawnedUnits(prev => ({...prev, [idx]: true}));
    });

    gameInstance.events.on('game-over', (result) => {
      setGameOver(result);
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
            setDeckUnits(value.deck || [null, null, null, null, null]);
        }
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
    if (currentScene) {
      currentScene.setGameSpeed(speed);
    }
  };

  return (
    <div class="app-container">
      <div class="game-wrapper">
        {currentSceneKey() === 'GameScene' && (
          <div class="stats hud-stats">
            <div class="level">Level: {level()}</div>
          </div>
        )}
        <div ref={gameContainer} class="phaser-container"></div>
        {gameOver() !== '' && (
          <div class="game-over-screen">
            <h2 class={gameOver() === 'victory' ? 'victory-msg' : 'defeat-msg'}>
              {gameOver() === 'victory' ? 'Victory!' : 'Defeat...'}
            </h2>
            <button onClick={() => { 
                if (gameInstance) {
                    gameInstance.scene.stop('GameScene');
                    gameInstance.scene.start('LobbyScene');
                }
                setCurrentSceneKey('LobbyScene');
                setGameOver('');
            }} class="btn restart">돌아가기</button>
          </div>
        )}
        {stageCleared() && (
          <div class="game-over-screen">
            <h2 class="victory-msg">Stage {stageCleared().stage} Clear!</h2>
            <p style={{ "font-size": "1.5rem", "color": "#fbd46d", "margin-bottom": "20px" }}>Bonus: {stageCleared().reward} 골드 지급!</p>
            <button onClick={() => {
              setStageCleared(null);
              if (gameInstance) {
                  gameInstance.scene.stop('GameScene');
                  gameInstance.scene.start('LobbyScene');
              }
              setCurrentSceneKey('LobbyScene');
            }} class="btn restart">돌아가기</button>
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
                }}>스테이지 {unlockedUnit().stage} 클리어 보상으로<br/>새로운 용병을 고용할 수 있게 되었습니다!</p>
                
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
        {currentSceneKey() === 'GameScene' && (
          <>
            <div class="top-controls-group">
                <div class="auto-mode-toggle" onClick={toggleAutoMode}>
                    <div class={`toggle-switch ${isAutoMode() ? 'on' : 'off'}`}>
                        <div class={isAutoMode() ? 'toggle-label on' : 'toggle-label off'}>AUTO</div>
                        <div class="toggle-handle"></div>
                    </div>
                </div>
                <button class="retreat-btn" onClick={() => {
                  if (currentScene) currentScene.retreat();
                }}>후퇴</button>
            </div>
          </>
        )}

      </div>

      {currentSceneKey() === 'GameScene' && (
        <div class="controls-panel">
          <div class="main-controls">
              <div class="button-group allies-group">
                  {deckUnits().map((unitType, idx) => {
                    if (!unitType) return null;
                    const spec = ALLY_TYPES[unitType];
                    const slotColors = { normal: '#43d8c9', tanker: '#3498db', shooter: '#9b59b6', healer: '#ff88aa' };
                    const isUsed = spawnedUnits()[idx];
                    return (
                      <button class="btn ally-btn" 
                        disabled={isUsed || gameOver() !== '' || stageCleared()} 
                        onClick={() => handleSpawn(idx)}
                        style={{ "border-color": slotColors[unitType] || '#fff' }}>
                          <div class={`unit-icon ${unitType}-icon`} style={{ 
                            "background-color": "transparent"
                          }}></div>
                          <span class="cost">{isUsed ? '배치됨' : (spec?.name?.split(' ')[0] || unitType)}</span>
                      </button>
                    );
                  })}
                  {deckUnits().every(u => u === null) && (
                    <span style={{"color":"#888","font-size":"12px","padding":"10px"}}>덱이 비어있습니다. 로비에서 부대를 편성해주세요.</span>
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

      
      {showDevMenu() && (
        <div class="dev-menu" style={{ "margin-top": "15px", "background": "rgba(0,0,0,0.8)", "padding": "15px", "border-radius": "12px", "width": "100%", "max-width": "800px", "color": "#43d8c9", "font-family": "monospace", "border": "1px solid #43d8c9" }}>
          <h4 style={{ "margin-top": "0", "margin-bottom": "10px", "text-transform": "uppercase" }}>Developer Menu</h4>
          
          <div class="storage-info" style={{ "margin-bottom": "15px", "font-size": "12px", "color": "#fbd46d", "border-bottom": "1px solid #43d8c9", "padding-bottom": "10px" }}>
            <strong>[Local Storage]</strong><br/>
            XP: {localStorage.getItem('nyanya_xp') || 0} | 
            Clears: {localStorage.getItem('nyanya_stageClears') || 'N/A'} | 
            Device: {localStorage.getItem('nyanya_deviceId')}
          </div>
          <div style={{ "display": "flex", "gap": "10px", "flex-wrap": "wrap" }}>
            <button onClick={() => { 
              if (gameInstance) {
                const cur = gameInstance.registry.get('globalGold') || 0;
                gameInstance.registry.set('globalGold', cur + 1000);
              }
            }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fbd46d", "border": "1px solid #fbd46d", "border-radius": "4px", "cursor": "pointer" }}>+1000 XP</button>
            <button onClick={() => { 
              if (gameInstance) gameInstance.registry.set('globalGold', 0);
            }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#e74c3c", "border": "1px solid #e74c3c", "border-radius": "4px", "cursor": "pointer" }}>Reset XP</button>
            <button onClick={() => { setLevel(l => l + 1); if (currentScene) currentScene.level++; }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fff", "border": "1px solid #fff", "border-radius": "4px", "cursor": "pointer" }}>+1 Level</button>
            <button onClick={() => { setCannonProgress(100); if (currentScene) currentScene.skillManager.shoutingCooldown = 100; }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fff", "border": "1px solid #fff", "border-radius": "4px", "cursor": "pointer" }}>Max Cannon</button>
            <button onClick={() => { if (currentScene) currentScene.instantWin(); }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fbd46d", "border": "1px solid #fbd46d", "border-radius": "4px", "cursor": "pointer" }}>Instant Win</button>
            <div style={{ "display": "flex", "align-items": "center", "gap": "5px", "border": "1px solid #e74c3c", "padding": "5px", "border-radius": "4px" }}>
              <span style={{ "color": "#e74c3c", "font-weight": "bold" }}>Stage (Current: {stage()}):</span>
              <button onClick={() => { setStage(1); if (currentScene) currentScene.changeStage(1); }} style={{ "padding": "2px 8px", "background": "#1a1a2e", "color": "#e74c3c", "border": "1px solid #e74c3c", "cursor": "pointer" }}>1</button>
              <button onClick={() => { setStage(2); if (currentScene) currentScene.changeStage(2); }} style={{ "padding": "2px 8px", "background": "#1a1a2e", "color": "#e74c3c", "border": "1px solid #e74c3c", "cursor": "pointer" }}>2</button>
              <button onClick={() => { setStage(3); if (currentScene) currentScene.changeStage(3); }} style={{ "padding": "2px 8px", "background": "#1a1a2e", "color": "#e74c3c", "border": "1px solid #e74c3c", "cursor": "pointer" }}>3</button>
            </div>
            <div style={{ "display": "flex", "align-items": "center", "gap": "5px", "border": "1px solid #a29bfe", "padding": "5px", "border-radius": "4px" }}>
              <span style={{ "color": "#a29bfe", "font-weight": "bold" }}>Speed:</span>
              <button onClick={() => changeGameSpeed(1)} style={{ "padding": "2px 8px", "background": gameSpeed() === 1 ? "#a29bfe" : "#1a1a2e", "color": gameSpeed() === 1 ? "#1a1a2e" : "#a29bfe", "border": "1px solid #a29bfe", "cursor": "pointer" }}>1x</button>
              <button onClick={() => changeGameSpeed(2)} style={{ "padding": "2px 8px", "background": gameSpeed() === 2 ? "#a29bfe" : "#1a1a2e", "color": gameSpeed() === 2 ? "#1a1a2e" : "#a29bfe", "border": "1px solid #a29bfe", "cursor": "pointer" }}>2x</button>
              <button onClick={() => changeGameSpeed(3)} style={{ "padding": "2px 8px", "background": gameSpeed() === 3 ? "#a29bfe" : "#1a1a2e", "color": gameSpeed() === 3 ? "#1a1a2e" : "#a29bfe", "border": "1px solid #a29bfe", "cursor": "pointer" }}>3x</button>
            </div>
            <button onClick={() => setShowGuide(true)} style={{ "padding": "5px 15px", "background": "var(--primary)", "color": "#1a1a2e", "border": "none", "border-radius": "4px", "cursor": "pointer", "font-weight": "bold" }}>Open Growth Guide</button>
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
