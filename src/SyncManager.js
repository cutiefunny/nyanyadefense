import { auth, db, doc, getDoc, setDoc, updateDoc } from './firebase.js';

const STORAGE_KEYS = [
  'nyanya_xp',
  'nyanya_unitLevels',
  'nyanya_stageClears',
  'nyanya_squad',
  'nyanya_leaderPerks',
  'nyanya_itemDeck',
  'nyanya_itemInventory',
  'nyanya_permanentItems',
  'nyanya_deviceId',
  'nyanya_completedTutorials',
  'nyanya_tutorialsDisabled',
  'nyanya_hiddenSkillSeen_tanker',
  'nyanya_hiddenSkillSeen_shooter',
  'nyanya_hiddenSkillSeen_normal',
  'nyanya_hiddenSkillSeen_healer',
  'nyanya_globalGold',
  'nyanya_totalPlayTime',
  'nyanya_totalCoins'
];

export const syncToLocal = async (user) => {
  if (!user) return { hasData: false };
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const data = snap.data();
    if (data.gameData) {
      Object.keys(data.gameData).forEach(key => {
        localStorage.setItem(key, data.gameData[key]);
      });
      return { hasData: true, profile: data.profile || null }; // Successfully synced down
    }
  }
  return { hasData: false }; // No data found on server
};

export const syncToRemote = async (user, profileData = null) => {
  if (!user) return;
  const gameData = {};
  STORAGE_KEYS.forEach(key => {
    const val = localStorage.getItem(key);
    if (val !== null) {
      gameData[key] = val;
    }
  });

  const userRef = doc(db, 'users', user.uid);
  const payload = {
    gameData,
    lastSync: new Date().toISOString()
  };

  if (profileData) {
    payload.profile = profileData; // { nickname, avatar }
  }

  // Also extract total playtime and total coins for easy querying (leaderboard)
  payload.totalPlayTime = parseInt(localStorage.getItem('nyanya_totalPlayTime') || '0', 10);
  payload.totalCoins = parseInt(localStorage.getItem('nyanya_totalCoins') || '0', 10);

  await setDoc(userRef, payload, { merge: true });
};
