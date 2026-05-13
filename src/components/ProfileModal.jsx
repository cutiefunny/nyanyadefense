import { createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';

export default function ProfileModal(props) {
  const [nickname, setNickname] = createSignal(props.initialProfile?.nickname || 'Player');
  const [avatar, setAvatar] = createSignal(props.initialProfile?.avatar || '🐱');
  const [confirmReset, setConfirmReset] = createSignal(false);

  const unitNames = {
    leader: '김냐냐',
    normal: '비실이',
    tanker: '탱크',
    shooter: '턱시도',
    healer: '냐이팅게일',
    raccoon: '너구리'
  };

  const handleSave = () => {
    props.onSave({ nickname: nickname(), avatar: avatar() });
  };

  // Helper to render the avatar (handles both old emojis and new unit keys)
  const renderAvatar = (key, size = '24px') => {
    if (unitNames[key]) {
      return <div class={`unit-icon ${key}-icon`} style={{ width: size, height: size, margin: 0 }}></div>;
    }
    return <span style={{ 'font-size': size }}>{key}</span>;
  };


  return (
    <div class="modal-overlay">
      <div class="modal-content" style={{ width: '320px' }}>
        <h2>프로필 설정</h2>
        
        <div style={{ margin: '10px 0' }}>
          <label style={{ display: 'block', 'margin-bottom': '8px', color: '#fbd46d', 'font-size': '0.9rem' }}>아바타 선택</label>
          <div style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '8px', 'justify-content': 'center' }}>
            {(props.unlockedUnits || ['leader', 'normal']).map(unitKey => {
              return (
                <div 
                  onClick={() => setAvatar(unitKey)}
                  title={unitNames[unitKey]}
                  style={{ 
                    cursor: 'pointer', 
                    border: avatar() === unitKey ? '2px solid #2ecc71' : '2px solid rgba(255,255,255,0.1)',
                    'border-radius': '8px',
                    padding: '8px',
                    width: '50px',
                    height: '50px',
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    background: avatar() === unitKey ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.05)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {renderAvatar(unitKey, '32px')}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ margin: '15px 0' }}>
          <label style={{ display: 'block', 'margin-bottom': '8px', color: '#fbd46d', 'font-size': '0.9rem' }}>닉네임</label>
          <input 
            type="text" 
            value={nickname()} 
            onInput={(e) => setNickname(e.target.value)}
            style={{ 
              width: '80%', 
              padding: '10px', 
              'border-radius': '8px', 
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: '#fff',
              'text-align': 'center'
            }}
            maxLength={15}
          />
        </div>

        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '10px', 'margin-top': '20px' }}>
          <button class="modal-btn" onClick={handleSave} style={{ 'background-color': '#2ecc71', margin: 0 }}>저장</button>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', 'margin-top': '10px', 'padding-top': '10px' }}>
            <button 
              class="modal-btn" 
              onClick={() => {
                if (confirmReset()) {
                  props.onReset();
                } else {
                  setConfirmReset(true);
                }
              }} 
              style={{ 
                'background-color': confirmReset() ? '#e74c3c' : 'transparent', 
                border: '1px solid #e74c3c',
                color: '#fff',
                margin: 0,
                'font-size': '0.8rem',
                padding: '8px'
              }}
            >
              {confirmReset() ? '정말로 초기화하시겠습니까? (클릭 시 실행)' : '게임 데이터 초기화'}
            </button>
            {confirmReset() && (
              <button 
                class="modal-btn" 
                onClick={() => setConfirmReset(false)}
                style={{ background: 'transparent', border: 'none', color: '#aaa', 'font-size': '0.7rem', 'margin-top': '5px' }}
              >
                취소
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
