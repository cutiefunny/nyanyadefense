import { Portal } from 'solid-js/web';
import LEADER_SKILL_TREE from '../game/leaderSkillTree.json';

export default function SkillTreeModal(props) {
  return (
    <Portal>
      <div class="game-over-screen" style={{
        "position": "fixed", "top": "0", "left": "0", "width": "100dvw", "height": "100dvh", "z-index": "20000",
        "background": "rgba(0, 0, 0, 0.9)", "display": "flex", "justify-content": "center", "align-items": "center", "backdrop-filter": "blur(15px)"
      }}>
        <div class="skill-tree-content" style={{
          "background": "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", "padding": "30px", "border-radius": "30px", "border": "4px solid #fbd46d",
          "width": "90%", "max-width": "500px", "box-shadow": "0 0 50px rgba(251, 212, 109, 0.2)", "color": "#fff", "text-align": "center"
        }}>
          <h2 style={{ "color": "#fbd46d", "margin-bottom": "10px", "font-size": "1.8rem" }}>LEADER LEVEL UP: {props.data.level}</h2>
          <p style={{ "color": "#aaa", "margin-bottom": "25px" }}>새로운 능력을 선택하세요</p>

          <div class="perk-options" style={{ "display": "flex", "flex-direction": "column", "gap": "15px" }}>
            {(() => {
              const rawPerks = props.gameInstance?.registry.get('leaderPerks') || {};
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
                  if (props.gameInstance) {
                    const gold = props.gameInstance.registry.get('globalGold') || 0;
                    if (gold >= props.data.cost) {
                      props.gameInstance.registry.set('globalGold', gold - props.data.cost);

                      const levels = { ...props.gameInstance.registry.get('unitLevels') };
                      levels.leader = props.data.level;
                      props.gameInstance.registry.set('unitLevels', levels);
                      localStorage.setItem('nyanya_unitLevels', JSON.stringify(levels));

                      const newPerks = { ...perks };
                      newPerks[branch] += 1;
                      props.gameInstance.registry.set('leaderPerks', newPerks);

                      props.onClose();
                      props.gameInstance.scene.getScene('LobbyScene').scene.restart({ keepTab: true });
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

          <button onClick={() => props.onClose()} style={{
            "margin-top": "25px", "background": "transparent", "border": "none", "color": "#666", "cursor": "pointer", "text-decoration": "underline"
          }}>나중에 하기</button>
        </div>
      </div>
    </Portal>
  );
}
