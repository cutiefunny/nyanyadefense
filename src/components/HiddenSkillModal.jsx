import { Portal } from 'solid-js/web';

export default function HiddenSkillModal(props) {
  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{
        "background": "linear-gradient(135deg, #2c3e50 0%, #000000 100%)", "padding": "30px", "border-radius": "24px", "border": "3px solid #f1c40f",
        "width": "320px"
      }}>
        <div style={{ "font-size": "2.5rem", "margin-bottom": "15px" }}>🌟</div>
        <h2 style={{ "color": "#f1c40f", "margin-bottom": "8px", "font-size": "1.4rem", "text-transform": "uppercase" }}>HIDDEN SKILL!</h2>
        <h3 style={{ "color": "#fff", "margin-bottom": "12px", "font-size": "1.1rem" }}>{props.data.unitName}: {props.data.skillName}</h3>
        <p style={{ "color": "#ccc", "line-height": "1.5", "margin-bottom": "25px", "font-size": "0.85rem" }}>{props.data.desc}</p>

        <button class="modal-btn" onClick={() => props.onClose()} style={{ "background": "#f1c40f", "color": "#000" }}>
          확인
        </button>
      </div>
    </div>
  );
}

