import { createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';

export default function ProfileModal(props) {
  const [nickname, setNickname] = createSignal(props.initialProfile?.nickname || 'Player');
  const [avatar, setAvatar] = createSignal(props.initialProfile?.avatar || '🐱');

  const avatars = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐯', '🦁'];

  const handleSave = () => {
    props.onSave({ nickname: nickname(), avatar: avatar() });
  };

  return (
    <Portal>
      <div class="modal-overlay">
        <div class="modal-content" style={{ width: '350px' }}>
          <h2>프로필 설정</h2>
          
          <div style={{ margin: '20px 0' }}>
            <label style={{ display: 'block', 'margin-bottom': '10px', color: '#fbd46d' }}>아바타 선택</label>
            <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '10px', 'justify-content': 'center' }}>
              {avatars.map(a => (
                <div 
                  onClick={() => setAvatar(a)}
                  style={{ 
                    'font-size': '24px', 
                    cursor: 'pointer', 
                    border: avatar() === a ? '2px solid #2ecc71' : '2px solid transparent',
                    'border-radius': '8px',
                    padding: '5px'
                  }}
                >
                  {a}
                </div>
              ))}
            </div>
          </div>

          <div style={{ margin: '20px 0' }}>
            <label style={{ display: 'block', 'margin-bottom': '10px', color: '#fbd46d' }}>닉네임</label>
            <input 
              type="text" 
              value={nickname()} 
              onInput={(e) => setNickname(e.target.value)}
              style={{ width: '80%', padding: '8px', 'border-radius': '4px', border: 'none' }}
              maxLength={15}
            />
          </div>

          <button class="modal-btn" onClick={handleSave} style={{ 'background-color': '#2ecc71' }}>저장</button>
        </div>
      </div>
    </Portal>
  );
}
