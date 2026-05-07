import { createSignal, onMount } from 'solid-js';
import { db, collection, query, orderBy, limit, getDocs } from '../firebase';
import { Portal } from 'solid-js/web';

export default function LeaderboardModal(props) {
  const [activeTab, setActiveTab] = createSignal('playtime'); // playtime or coins
  const [data, setData] = createSignal({ playtime: [], coins: [] });
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const usersRef = collection(db, 'users');
      
      const qTime = query(usersRef, orderBy('totalPlayTime', 'desc'), limit(10));
      const snapTime = await getDocs(qTime);
      const timeData = snapTime.docs.map(doc => doc.data());

      const qCoins = query(usersRef, orderBy('totalCoins', 'desc'), limit(10));
      const snapCoins = await getDocs(qCoins);
      const coinsData = snapCoins.docs.map(doc => doc.data());

      setData({ playtime: timeData, coins: coinsData });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  });

  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return `${h}h ${m%60}m ${s%60}s`;
  };

  return (
    <Portal>
      <div class="modal-overlay" onClick={props.onClose}>
        <div class="modal-content" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
          <h2>🏆 전체 순위표</h2>
          <div style={{ display: 'flex', 'justify-content': 'space-around', margin: '15px 0' }}>
            <button 
              onClick={() => setActiveTab('playtime')} 
              style={{ 'background-color': activeTab() === 'playtime' ? '#2ecc71' : '#333' }}
              class="modal-btn"
            >
              플레이타임
            </button>
            <button 
              onClick={() => setActiveTab('coins')} 
              style={{ 'background-color': activeTab() === 'coins' ? '#f1c40f' : '#333', color: '#000' }}
              class="modal-btn"
            >
              코인 획득
            </button>
          </div>

          <div style={{ 'max-height': '300px', 'overflow-y': 'auto', 'text-align': 'left' }}>
            {loading() ? (
              <p style={{ 'text-align': 'center' }}>로딩 중...</p>
            ) : (
              <table style={{ width: '100%', 'border-collapse': 'collapse', color: '#fff' }}>
                <thead>
                  <tr style={{ 'border-bottom': '1px solid #444', 'text-align': 'left' }}>
                    <th>순위</th>
                    <th>유저</th>
                    <th>{activeTab() === 'playtime' ? '시간' : '코인'}</th>
                  </tr>
                </thead>
                <tbody>
                  {data()[activeTab()].map((row, i) => (
                    <tr style={{ 'border-bottom': '1px solid #333' }}>
                      <td style={{ padding: '8px' }}>{i + 1}</td>
                      <td style={{ padding: '8px' }}>{row.profile?.avatar || '🐱'} {row.profile?.nickname || 'Player'}</td>
                      <td style={{ padding: '8px' }}>
                        {activeTab() === 'playtime' 
                          ? formatTime(row.totalPlayTime || 0)
                          : `${(row.totalCoins || 0).toLocaleString()} 냥`
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div style={{ 'margin-top': '20px' }}>
            <button class="modal-btn" onClick={props.onClose} style={{ 'background-color': '#444' }}>닫기</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
