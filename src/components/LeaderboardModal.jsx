import { createSignal, onMount } from 'solid-js';
import { db, collection, query, orderBy, limit, getDocs } from '../firebase';
import { Portal } from 'solid-js/web';

export default function LeaderboardModal(props) {
  const [data, setData] = createSignal([]);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    try {
      const usersRef = collection(db, 'users');
      // Fetch top 20 by total coins
      const q = query(usersRef, orderBy('totalCoins', 'desc'), limit(20));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => doc.data());
      setData(list);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  });

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div class="modal-content" onClick={e => e.stopPropagation()} style={{ width: '360px' }}>
        <h2>전체 순위표</h2>
        
        <div style={{ 'max-height': '240px', 'overflow-y': 'auto', 'text-align': 'left', 'font-size': '0.85rem' }}>
          {loading() ? (
            <p style={{ 'text-align': 'center' }}>로딩 중...</p>
          ) : (
            <table style={{ width: '100%', 'border-collapse': 'collapse', color: '#fff' }}>
              <thead>
                <tr style={{ 'border-bottom': '1px solid #444', 'text-align': 'left', color: '#fbd46d' }}>
                  <th style={{ padding: '8px' }}>순위</th>
                  <th style={{ padding: '8px' }}>유저</th>
                  <th style={{ padding: '8px' }}>총 획득냥</th>
                </tr>
              </thead>
              <tbody>
                {data().map((row, i) => (
                  <tr style={{ 'border-bottom': '1px solid #333', background: i < 3 ? 'rgba(251, 212, 109, 0.05)' : 'transparent' }}>
                    <td style={{ padding: '8px', 'font-weight': i < 3 ? 'bold' : 'normal' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', 'align-items': 'center', gap: '5px' }}>
                        {(() => {
                          const av = row.profile?.avatar || '🐱';
                          const unitKeys = ['leader', 'normal', 'tanker', 'shooter', 'healer', 'raccoon'];
                          if (unitKeys.includes(av)) {
                            return <div class={`unit-icon ${av}-icon`} style={{ width: '20px', height: '20px', margin: 0 }}></div>;
                          }
                          return <span>{av}</span>;
                        })()} 
                        <span style={{ 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', 'max-width': '100px' }}>
                          {row.profile?.nickname || 'Player'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '8px', color: '#f1c40f', 'font-weight': 'bold', 'text-align': 'right' }}>
                      {(row.totalCoins || 0).toLocaleString()} 냥
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ 'margin-top': '15px' }}>
          <button class="modal-btn" onClick={props.onClose} style={{ 'background-color': '#444' }}>닫기</button>
        </div>
      </div>
    </div>
  );
}
