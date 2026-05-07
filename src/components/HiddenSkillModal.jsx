import { Portal } from 'solid-js/web';

export default function HiddenSkillModal(props) {
  return (
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
          <h3 style={{ "color": "#fff", "margin-bottom": "15px", "font-size": "1.4rem" }}>{props.data.unitName}: {props.data.skillName}</h3>
          <p style={{ "color": "#ccc", "line-height": "1.6", "margin-bottom": "30px" }}>{props.data.desc}</p>

          <button onClick={() => props.onClose()} style={{
            "background": "#f1c40f", "color": "#000", "border": "none", "padding": "12px 30px", "border-radius": "25px",
            "font-weight": "bold", "font-size": "1.1rem", "cursor": "pointer", "transition": "all 0.2s"
          }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>
            확인
          </button>
        </div>
      </div>
    </Portal>
  );
}
