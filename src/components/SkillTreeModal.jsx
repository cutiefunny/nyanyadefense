import { Portal } from 'solid-js/web';
import LEADER_SKILL_TREE from '../game/leaderSkillTree.json';

export default function SkillTreeModal(props) {
  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{ width: '400px' }}>
        <h2 style={{ "color": "#fbd46d", "margin-bottom": "10px", "font-size": "1.5rem" }}>LEADER LEVEL UP: {props.data.level}</h2>
        <p style={{ "color": "#aaa", "margin-bottom": "20px", "font-size": "0.9rem" }}>새로운 능력을 선택하세요</p>

        <div class="perk-options" style={{ "display": "flex", "flex-direction": "column", "gap": "12px" }}>
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
                "background": "rgba(255,255,255,0.05)", "border": `1px solid ${branchColors[branch]}88`, "padding": "12px", "border-radius": "12px",
                "cursor": "pointer", "transition": "all 0.2s", "text-align": "left", "color": "#fff", "position": "relative", "overflow": "hidden"
              }} class="perk-btn" onMouseOver={(e) => e.currentTarget.style.background = `${branchColors[branch]}33`} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                <div style={{ "position": "absolute", "top": "8px", "right": "12px", "font-size": "0.6rem", "color": branchColors[branch], "border": `1px solid ${branchColors[branch]}`, "padding": "1px 5px", "border-radius": "8px" }}>{branchNames[branch]}</div>
                <div style={{ "font-weight": "bold", "color": branchColors[branch], "font-size": "1.1rem", "margin-bottom": "3px" }}>{perk.name}</div>
                <div style={{ "font-size": "0.8rem", "color": "#ccc" }}>{perk.desc}</div>
              </button>
            ));
          })()}
        </div>

        <button onClick={() => props.onClose()} style={{
          "margin-top": "20px", "background": "transparent", "border": "none", "color": "#666", "cursor": "pointer", "text-decoration": "underline", "font-size": "0.8rem"
        }}>나중에 하기</button>
      </div>
    </div>
  );
}
