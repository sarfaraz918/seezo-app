/**
 * SEEZO Backend Serverless API - Global Real-time Leaderboard
 * Path: /api/leaderboard
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = admin.firestore();

function verifyTelegramData(telegramInitData, botToken) {
  if (!telegramInitData || !botToken) return false;
  const urlParams = new URLSearchParams(telegramInitData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  const paramsArray = [];
  for (const [key, value] of urlParams.entries()) {
    paramsArray.push(`${key}=${value}`);
  }
  paramsArray.sort();
  const dataCheckString = paramsArray.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  return calculatedHash === hash;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { initData } = req.body;
    const botToken = process.env.BOT_TOKEN;

    const isValid = verifyTelegramData(initData, botToken);
    const urlParams = new URLSearchParams(initData || '');
    const userRaw = urlParams.get('user');

    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const currentUserId = userRaw ? String(JSON.parse(userRaw).id) : null;

    // টপ আর্নারদের লাইভ কুয়েরি
    const topSnapshot = await db.collection('users')
      .orderBy('total_earned', 'desc')
      .limit(30)
      .get();

    let rank = 1;
    let myRank = '30+';
    const leaderboard = [];

    topSnapshot.forEach(doc => {
      const u = doc.data();
      const isMe = u.telegram_id === currentUserId;
      if (isMe) myRank = `#${rank}`;

      leaderboard.push({
        rank: rank++,
        telegram_id: u.telegram_id,
        first_name: u.first_name || 'Member',
        username: u.username ? `@${u.username}` : '',
        total_earned: u.total_earned || 0,
        is_current_user: isMe
      });
    });

    return res.status(200).json({
      success: true,
      my_rank: myRank,
      leaderboard: leaderboard
    });

  } catch (err) {
    console.error('Leaderboard Error:', err);
    return res.status(500).json({ success: false, message: 'Leaderboard query error' });
  }
};
