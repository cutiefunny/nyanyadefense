import { createSignal } from 'solid-js';

function Guide(props) {
  const guideData = [
    {
      category: "유닛 업그레이드",
      items: [
        { name: "김냐냐(리더)", score: 7, effect: "체력 +300, 공격력 +5 (Lv.1 기준)", desc: "죽으면 패배하는 리더의 생존력을 높여줍니다." },
        { name: "비실이(기본)", score: 5, effect: "체력 +16, 공격력 +1.6 (Lv.1 기준)", desc: "개별 능력치는 낮지만 물량 공세의 기초가 됩니다." },
        { name: "탱크", score: 9, effect: "체력 +200, 공격력 +5, 방어력 +1", desc: "방어력 +1은 적의 짤짤이 공격을 막는 핵심입니다." },
        { name: "턱시도(원거리)", score: 9, effect: "공격력 +3.6, 공격 속도 +5%", desc: "누적 딜량이 핵심인 원거리 딜러의 주력 스탯입니다." }
      ]
    },
    {
      category: "스킬 및 생산 업그레이드",
      items: [
        { name: "함성 쿨타임 단축", score: 10, effect: "쿨타임 -1초 (최소 5초)", desc: "아군 공속 2배 버프를 상시 유지할 수 있는 최강 스킬입니다." },
        { name: "함성 지속시간 연장", score: 6, effect: "지속시간 +2초", desc: "버프 공백을 메우는 용도입니다. 쿨타임 단축과 조합 시 유용합니다." },
        { name: "비실이 생산속도 증가", score: 10, effect: "생산 주기 -0.3초 (최소 0.8초)", desc: "물량이 6배 이상 늘어나는 라인 유지의 필수 요소입니다." }
      ]
    }
  ];

  return (
    <div class="guide-container">
      <div class="guide-content">
        <div class="guide-header">
          <h1>인게임 업그레이드 가이드</h1>
          <button class="close-btn" onClick={props.onClose}>&times;</button>
        </div>
        
        <div class="guide-sections">
          {guideData.map(section => (
            <div class="guide-section">
              <h2 class="section-title">{section.category}</h2>
              <div class="guide-grid">
                {section.items.map(item => (
                  <div class="guide-card">
                    <div class="card-header">
                      <span class="item-name">{item.name}</span>
                      <span class="item-score">{item.score}/10</span>
                    </div>
                    <div class="item-effect">{item.effect}</div>
                    <p class="item-desc">{item.desc}</p>
                    <div class="score-bar-bg">
                      <div class="score-bar-fill" style={{ width: `${item.score * 10}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div class="guide-footer">
          <p>※ 수치는 기본 스탯 및 레벨별 상승폭을 기준으로 계산되었습니다.</p>
          <button class="btn restart" onClick={props.onClose}>확인</button>
        </div>
      </div>
    </div>
  );
}

export default Guide;
