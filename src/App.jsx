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

    gameInstance.events.on('game-over', (result) => {
      setGameOver(result);
    });

    onCleanup(() => {
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

  const handleUpgradeIncome = () => {
    if (currentScene && money() >= upgradeCost()) {
      currentScene.upgradeIncome();
    }
  };

  const handleHeal = () => {
    if (currentScene && money() >= 100) {
      currentScene.healBase();
    }
  };

  const handleCannon = () => {
    if (currentScene && cannonProgress() >= 100) {
      currentScene.fireCannon();
    }
  };

  const upgradeCost = () => 100 + level() * 50;

  return (
    <div class="app-container">
      <div class="game-wrapper">
        <div class="stats hud-stats">
          <div class="money">🪙 ${Math.floor(money())}</div>
          <div class="level">Income Lvl: {level()}</div>
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
      </div>

      <div class="controls-panel">
        <div class="main-controls">
            <div class="button-group allies-group">
                <button class="btn ally-btn basic-btn" disabled={money() < ALLY_TYPES.normal.cost || gameOver() !== ''} onClick={() => handleSpawn('normal')}>
                    <div class="unit-icon basic-icon"></div>
                    <span class="cost">🪙 {ALLY_TYPES.normal.cost}</span>
                </button>
                <button class="btn ally-btn tank-btn" disabled={money() < ALLY_TYPES.tanker.cost || gameOver() !== ''} onClick={() => handleSpawn('tanker')}>
                    <div class="unit-icon tank-icon"></div>
                    <span class="cost">🪙 {ALLY_TYPES.tanker.cost}</span>
                </button>
                <button class="btn ally-btn ranger-btn" disabled={money() < ALLY_TYPES.shooter.cost || gameOver() !== ''} onClick={() => handleSpawn('shooter')}>
                    <div class="unit-icon ranger-icon"></div>
                    <span class="cost">🪙 {ALLY_TYPES.shooter.cost}</span>
                </button>
            </div>

            <div class="button-group upgrades-group">
                <button class="btn ally-btn upgrade-btn" disabled={money() < upgradeCost() || gameOver() !== ''} onClick={handleUpgradeIncome}>
                    <div class="ability-icon">📈</div>
                    <span class="cost">🪙 {upgradeCost()}</span>
                </button>
                <button class="btn ally-btn heal-btn" disabled={money() < 100 || gameOver() !== ''} onClick={handleHeal}>
                    <div class="ability-icon">💚</div>
                    <span class="cost">🪙 100</span>
                </button>
                <button class="btn ally-btn cannon-btn" disabled={cannonProgress() < 100 || gameOver() !== ''} onClick={handleCannon}>
                    <div class="ability-icon">⚡</div>
                    <span class={cannonProgress() >= 100 ? 'cost ready' : 'cost'}>
                        {cannonProgress() >= 100 ? 'READY' : `${cannonProgress()}%`}
                    </span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;
