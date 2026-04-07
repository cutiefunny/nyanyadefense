import { createSignal, onMount, onCleanup } from 'solid-js';
import Phaser from 'phaser';
import GameScene, { ALLY_TYPES } from './game/GameScene';
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
      height: 480,
      parent: gameContainer,
      backgroundColor: '#1a1a2e',
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
      <header class="top-bar">
        <h1>Nyanya Defense</h1>
        <div class="stats">
          <div class="money">🪙 ${money()}</div>
          <div class="level">Income Lvl: {level()}</div>
        </div>
      </header>

      <div class="game-wrapper">
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
        <div class="controls-row">
            <h4>Deploy Units</h4>
            <div class="button-group">
                <button class="btn ally-btn basic-btn" disabled={money() < ALLY_TYPES.basic.cost || gameOver() !== ''} onClick={() => handleSpawn('basic')}>
                    {ALLY_TYPES.basic.name}
                    <span class="cost">🪙 {ALLY_TYPES.basic.cost}</span>
                </button>
                <button class="btn ally-btn tank-btn" disabled={money() < ALLY_TYPES.tank.cost || gameOver() !== ''} onClick={() => handleSpawn('tank')}>
                    {ALLY_TYPES.tank.name}
                    <span class="cost">🪙 {ALLY_TYPES.tank.cost}</span>
                </button>
                <button class="btn ally-btn ranger-btn" disabled={money() < ALLY_TYPES.ranger.cost || gameOver() !== ''} onClick={() => handleSpawn('ranger')}>
                    {ALLY_TYPES.ranger.name}
                    <span class="cost">🪙 {ALLY_TYPES.ranger.cost}</span>
                </button>
            </div>
        </div>

        <div class="controls-row">
            <h4>Upgrades & Abilities</h4>
            <div class="button-group">
                <button class="btn upgrade-btn" disabled={money() < upgradeCost() || gameOver() !== ''} onClick={handleUpgradeIncome}>
                    Upgrade Income
                    <span class="cost">🪙 {upgradeCost()}</span>
                </button>
                <button class="btn heal-btn" disabled={money() < 100 || gameOver() !== ''} onClick={handleHeal}>
                    Heal Base (+200)
                    <span class="cost">🪙 100</span>
                </button>
                <button class="btn cannon-btn" disabled={cannonProgress() < 100 || gameOver() !== ''} onClick={handleCannon}>
                    Laser Cannon
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
