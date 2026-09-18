/**
 * SEEZO Backend Serverless API - User Sync & State Lock
 * Path: /api/sync
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
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  try {
    const { initData, referralCode } = req.body;
    const botToken = process.env.BOT_TOKEN;

    const isValid = verifyTelegramData(initData, botToken);
    const urlParams = new URLSearchParams(initData || '');
    const userRaw = urlParams.get('user');

    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, message: 'Cryptographic handshake rejected.' });
    }

    if (!userRaw) {
      return res.status(400).json({ success: false, message: 'Missing user payload' });
    }

    const tgUser = JSON.parse(userRaw);
    const userId = String(tgUser.id);
    const userRef = db.collection('users').doc(userId);
    const rewardRef = db.collection('daily_rewards').doc(`daily_${userId}`);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const [userDoc, rewardDoc] = await Promise.all([userRef.get(), rewardRef.get()]);

    let userData;

    if (!userDoc.exists) {
      userData = {
        telegram_id: userId,
        first_name: tgUser.first_name || '',
        last_name: tgUser.last_name || '',
        username: tgUser.username || '',
        photo_url: tgUser.photo_url || '',
        balance: 0,
        total_earned: 0,
        total_withdrawn: 0,
        pending_withdrawal: 0,
        referred_by: referralCode && referralCode !== userId ? referralCode : null,
        referral_count: 0,
        status: 'active',
        created_at: now,
        last_active_at: now
      };
      await userRef.set(userData);
    } else {
      userData = userDoc.data();
      await userRef.update({
        first_name: tgUser.first_name || userData.first_name,
        last_name: tgUser.last_name || userData.last_name,
        username: tgUser.username || userData.username,
        photo_url: tgUser.photo_url || userData.photo_url,
        last_active_at: now
      });
    }

    // ডেইলি রিওয়ার্ডের আসল সার্ভার টাইম সিঙ্ক
    let nextClaimMs = 0;
    if (rewardDoc.exists) {
      nextClaimMs = rewardDoc.data().next_claim_timestamp_ms || 0;
    }

    return res.status(200).json({
      success: true,
      user: userData,
      daily_reward_next_ms: nextClaimMs
    });

  } catch (error) {
    console.error('Sync Error:', error);
    return res.status(500).json({ success: false, message: 'Database Sync Failure' });
  }
};
