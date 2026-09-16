/**
 * SEEZO Backend Serverless API - Ad Earning Engine
 * Path: /api/ad-reward
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
const AD_REWARD_AMOUNT = 5; // 5 SEZO
const AD_COOLDOWN_SECONDS = 30; // অ্যান্টি-স্প্যাম কুলডাউন

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
    const { initData } = req.body;
    const botToken = process.env.BOT_TOKEN;

    const isValid = verifyTelegramData(initData, botToken);
    const urlParams = new URLSearchParams(initData || '');
    const userRaw = urlParams.get('user');

    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, message: 'Security validation failed' });
    }

    if (!userRaw) {
      return res.status(400).json({ success: false, message: 'User payload missing' });
    }

    const tgUser = JSON.parse(userRaw);
    const userId = String(tgUser.id);

    const userRef = db.collection('users').doc(userId);
    const adSessionRef = db.collection('ad_rewards').doc(`ad_${userId}`);
    const txRef = db.collection('transactions').doc();

    const nowMillis = Date.now();
    const cooldownMillis = AD_COOLDOWN_SECONDS * 1000;

    const result = await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new Error('USER_NOT_FOUND');

      const adDoc = await t.get(adSessionRef);
      if (adDoc.exists) {
        const lastAdTime = adDoc.data().last_ad_ms || 0;
        if (nowMillis - lastAdTime < cooldownMillis) {
          const waitTime = Math.ceil((cooldownMillis - (nowMillis - lastAdTime)) / 1000);
          return { eligible: false, wait_seconds: waitTime };
        }
      }

      const currentBalance = Number(userDoc.data().balance || 0);
      const currentEarned = Number(userDoc.data().total_earned || 0);
      const newBalance = currentBalance + AD_REWARD_AMOUNT;
      const newEarned = currentEarned + AD_REWARD_AMOUNT;

      t.update(userRef, {
        balance: newBalance,
        total_earned: newEarned,
        last_active_at: admin.firestore.FieldValue.serverTimestamp()
      });

      t.set(adSessionRef, {
        telegram_id: userId,
        last_ad_ms: nowMillis,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      t.set(txRef, {
        tx_id: txRef.id,
        telegram_id: userId,
        type: 'AD_REWARD',
        amount_sezo: AD_REWARD_AMOUNT,
        amount_bdt: AD_REWARD_AMOUNT / 20,
        balance_after: newBalance,
        status: 'COMPLETED',
        description: 'Verified Sponsored Ad Reward',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return { eligible: true, new_balance: newBalance, reward: AD_REWARD_AMOUNT };
    });

    if (!result.eligible) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${result.wait_seconds} seconds before watching another ad.`
      });
    }

    return res.status(200).json({
      success: true,
      message: '+5 SEZO credited successfully!',
      reward: result
    });

  } catch (err) {
    console.error('Ad Reward Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Ad reward error' });
  }
};
