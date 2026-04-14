import { createSignal, onMount, onCleanup } from 'solid-js';
import Phaser from 'phaser';
import LobbyScene from './game/LobbyScene';
import GameScene from './game/GameScene';
import { ALLY_TYPES } from './game/unitsConfig';
import './App.css';

function App() {
  const [money, setMoney] = createSignal(0);
  const [level, setLevel] = createSignal(1);
  const [gameOver, setGameOver] = createSignal('');
  const [currentSceneKey, setCurrentSceneKey] = createSignal('LobbyScene');
  const [cannonProgress, setCannonProgress] = createSignal(0);
  const [showDevMenu, setShowDevMenu] = createSignal(false);
  const [stage, setStage] = createSignal(1);
  const [stageCleared, setStageCleared] = createSignal(null);
  const [isAutoMode, setIsAutoMode] = createSignal(true);
  const [isAutoBuy, setIsAutoBuy] = createSignal(true);
  const [gameSpeed, setGameSpeed] = createSignal(1);
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
      setIsAutoBuy(true);
    });

    gameInstance.events.on('game-ready', (scene) => {
      currentScene = scene;
      setCurrentSceneKey('GameScene');
      setGameOver('');
      setStage(scene.stage);
    });


    gameInstance.events.on('update-money', (m) => {
      setMoney(m);
    });

    gameInstance.events.on('update-cannon', (cp) => {
      setCannonProgress(cp);
    });

    gameInstance.events.on('level-up', (lvl) => {
      setLevel(lvl);
    });

    gameInstance.events.on('stage-up', (s) => {
      setStage(s);
    });

    gameInstance.events.on('stage-clear', (data) => {
      setStageCleared(data);
    });

    gameInstance.events.on('game-over', (result) => {
      setGameOver(result);
    });

    gameInstance.events.on('toggle-dev-menu', () => {
      setShowDevMenu((prev) => !prev);
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

    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gameInstance) {
        gameInstance.destroy(true);
      }
    });
  });

  const handleSpawn = (type) => {
    if (currentScene && money() >= ALLY_TYPES[type].cost) {
      currentScene.spawnAlly(type);
    }
  };

  const handleHeal = () => {
    if (currentScene && money() >= 100) {
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
    setIsAutoBuy(newVal); // 자동 구매도 함께 토글
    if (currentScene) {
      currentScene.setAutoMode(newVal);
      currentScene.setAutoBuy(newVal);
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
            <div class="money">🪙 ${Math.floor(money())}</div>
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
        {currentSceneKey() === 'GameScene' && (
          <>
            <div class="auto-mode-toggle" onClick={toggleAutoMode}>
              <div class={`toggle-switch ${isAutoMode() ? 'on' : 'off'}`}>
                <div class={isAutoMode() ? 'toggle-label on' : 'toggle-label off'}>AUTO</div>
                <div class="toggle-handle"></div>
              </div>
            </div>
          </>
        )}

      </div>

      {currentSceneKey() === 'GameScene' && (
        <div class="controls-panel">
          <div class="main-controls">
              <div class="button-group allies-group">
                  <button class="btn ally-btn basic-btn" disabled={money() < ALLY_TYPES.normal.cost || gameOver() !== '' || stageCleared()} onClick={() => handleSpawn('normal')}>
                      <div class="unit-icon basic-icon"></div>
                      <span class="cost">🪙 {ALLY_TYPES.normal.cost}</span>
                  </button>
                  <button class="btn ally-btn tank-btn" disabled={money() < ALLY_TYPES.tanker.cost || gameOver() !== '' || stageCleared()} onClick={() => handleSpawn('tanker')}>
                      <div class="unit-icon tank-icon"></div>
                      <span class="cost">🪙 {ALLY_TYPES.tanker.cost}</span>
                  </button>
                  <button class="btn ally-btn ranger-btn" disabled={money() < ALLY_TYPES.shooter.cost || gameOver() !== '' || stageCleared()} onClick={() => handleSpawn('shooter')}>
                      <div class="unit-icon ranger-icon"></div>
                      <span class="cost">🪙 {ALLY_TYPES.shooter.cost}</span>
                  </button>
              </div>

              <div class="button-group upgrades-group">
                  <button class="btn ally-btn heal-btn" disabled={money() < 100 || gameOver() !== '' || stageCleared()} onClick={handleHeal}>
                      <div class="ability-icon">💚</div>
                      <span class="cost">🪙 100</span>
                  </button>
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
            <button onClick={() => { setMoney(m => m + 1000); if (currentScene) currentScene.addMoney(1000); }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fff", "border": "1px solid #fff", "border-radius": "4px", "cursor": "pointer" }}>+1000 Money</button>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
