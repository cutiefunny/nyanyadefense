import { createSignal, onMount, onCleanup } from 'solid-js';
import Phaser from 'phaser';
import GameScene from './game/GameScene';
import { ALLY_TYPES } from './game/unitsConfig';
import './App.css';

function App() {
  const [money, setMoney] = createSignal(0);
  const [level, setLevel] = createSignal(1);
  const [gameOver, setGameOver] = createSignal('');
  const [cannonProgress, setCannonProgress] = createSignal(0);
  const [showDevMenu, setShowDevMenu] = createSignal(false);
  const [stage, setStage] = createSignal(1);
  const [stageCleared, setStageCleared] = createSignal(null);
  let gameContainer;
  let gameInstance = null;
  let currentScene = null;

  onMount(() => {
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
      scene: GameScene
    };

    gameInstance = new Phaser.Game(config);

    const handleKeyDown = (e) => {
      if (e.key === '`') {
        setShowDevMenu((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    gameInstance.events.on('game-ready', (scene) => {
      currentScene = scene;
      setGameOver('');
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

  return (
    <div class="app-container">
      <div class="game-wrapper">
        <div class="stats hud-stats">
          <div class="money">🪙 ${Math.floor(money())}</div>
          <div class="level">Level: {level()}</div>
        </div>
        <div ref={gameContainer} class="phaser-container"></div>
        {gameOver() !== '' && (
          <div class="game-over-screen">
            <h2 class={gameOver() === 'victory' ? 'victory-msg' : 'defeat-msg'}>
              {gameOver() === 'victory' ? 'Victory!' : 'Defeat...'}
            </h2>
            <button onClick={() => window.location.reload()} class="btn restart">Play Again</button>
          </div>
        )}
        {stageCleared() && (
          <div class="game-over-screen">
            <h2 class="victory-msg">Stage {stageCleared().stage} Clear!</h2>
            <p style={{ "font-size": "1.5rem", "color": "#fbd46d", "margin-bottom": "20px" }}>Bonus: {stageCleared().reward} 골드 지급!</p>
            <button onClick={() => {
              setStageCleared(null);
              if (currentScene) currentScene.proceedToNextStage();
            }} class="btn restart" style={{ "width": "auto", "padding": "10px 30px" }}>다음 스테이지</button>
          </div>
        )}
      </div>

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
      
      {showDevMenu() && (
        <div class="dev-menu" style={{ "margin-top": "15px", "background": "rgba(0,0,0,0.8)", "padding": "15px", "border-radius": "12px", "width": "100%", "max-width": "800px", "color": "#43d8c9", "font-family": "monospace", "border": "1px solid #43d8c9" }}>
          <h4 style={{ "margin-top": "0", "margin-bottom": "10px", "text-transform": "uppercase" }}>Developer Menu</h4>
          <div style={{ "display": "flex", "gap": "10px", "flex-wrap": "wrap" }}>
            <button onClick={() => { setMoney(m => m + 1000); if (currentScene) currentScene.addMoney(1000); }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fff", "border": "1px solid #fff", "border-radius": "4px", "cursor": "pointer" }}>+1000 Money</button>
            <button onClick={() => { setLevel(l => l + 1); if (currentScene) currentScene.level++; }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fff", "border": "1px solid #fff", "border-radius": "4px", "cursor": "pointer" }}>+1 Level</button>
            <button onClick={() => { setCannonProgress(100); if (currentScene) currentScene.skillManager.shoutingCooldown = 100; }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#fff", "border": "1px solid #fff", "border-radius": "4px", "cursor": "pointer" }}>Max Cannon</button>
            <button onClick={() => { if (currentScene) currentScene.spawnEnemy(); }} style={{ "padding": "5px 10px", "background": "#1a1a2e", "color": "#e74c3c", "border": "1px solid #e74c3c", "border-radius": "4px", "cursor": "pointer" }}>Spawn Enemy</button>
            <div style={{ "display": "flex", "align-items": "center", "gap": "5px", "border": "1px solid #e74c3c", "padding": "5px", "border-radius": "4px" }}>
              <span style={{ "color": "#e74c3c", "font-weight": "bold" }}>Stage (Current: {stage()}):</span>
              <button onClick={() => { setStage(1); if (currentScene) currentScene.changeStage(1); }} style={{ "padding": "2px 8px", "background": "#1a1a2e", "color": "#e74c3c", "border": "1px solid #e74c3c", "cursor": "pointer" }}>1</button>
              <button onClick={() => { setStage(2); if (currentScene) currentScene.changeStage(2); }} style={{ "padding": "2px 8px", "background": "#1a1a2e", "color": "#e74c3c", "border": "1px solid #e74c3c", "cursor": "pointer" }}>2</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
