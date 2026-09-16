/**
 * SEEZO Backend Serverless API - Daily Reward Engine
 * Path: /api/daily-reward
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
const DAILY_REWARD_AMOUNT = 10; // 10 SEZO
const COOLDOWN_HOURS = 24;

// Telegram initData HMAC-SHA256 ভ্যালিডেশন
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
      return res.status(401).json({ success: false, message: 'Cryptographic signature verification failed' });
    }

    if (!userRaw) {
      return res.status(400).json({ success: false, message: 'User payload missing' });
    }

    const tgUser = JSON.parse(userRaw);
    const userId = String(tgUser.id);

    const userRef = db.collection('users').doc(userId);
    const rewardRef = db.collection('daily_rewards').doc(`daily_${userId}`);
    const txRef = db.collection('transactions').doc();

    const nowMillis = Date.now();
    const cooldownMillis = COOLDOWN_HOURS * 60 * 60 * 1000;

    // Atomic Database Transaction (সার্ভার-সাইড ডাবল ক্লেইম প্রিভেনশন)
    const result = await db.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) {
        throw new Error('USER_NOT_INITIALIZED');
      }

      const rewardDoc = await t.get(rewardRef);
      if (rewardDoc.exists) {
        const lastClaimTime = rewardDoc.data().last_claim_timestamp_ms || 0;
        const timePassed = nowMillis - lastClaimTime;

        if (timePassed < cooldownMillis) {
          const remainingMillis = cooldownMillis - timePassed;
          return {
            eligible: false,
            remaining_ms: remainingMillis,
            message: 'Cooldown active'
          };
        }
      }

      const currentBalance = Number(userDoc.data().balance || 0);
      const currentEarned = Number(userDoc.data().total_earned || 0);
      const newBalance = currentBalance + DAILY_REWARD_AMOUNT;
      const newEarned = currentEarned + DAILY_REWARD_AMOUNT;

      // ১. ব্যালেন্স আপডেট
      t.update(userRef, {
        balance: newBalance,
        total_earned: newEarned,
        last_active_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // ২. ডেইলি রিওয়ার্ড ট্র্যাকার আপডেট
      t.set(rewardRef, {
        telegram_id: userId,
        last_claim_timestamp_ms: nowMillis,
        next_claim_timestamp_ms: nowMillis + cooldownMillis,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      // ৩. ট্রানজ্যাকশন লেজার রেকর্ড
      t.set(txRef, {
        tx_id: txRef.id,
        telegram_id: userId,
        type: 'DAILY_REWARD',
        amount_sezo: DAILY_REWARD_AMOUNT,
        amount_bdt: DAILY_REWARD_AMOUNT / 20,
        balance_after: newBalance,
        status: 'COMPLETED',
        description: '24-Hour Daily Login Bonus',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        eligible: true,
        claimed_amount: DAILY_REWARD_AMOUNT,
        new_balance: newBalance,
        next_claim_ms: nowMillis + cooldownMillis
      };
    });

    if (!result.eligible) {
      return res.status(400).json({
        success: false,
        cooldown: true,
        remaining_ms: result.remaining_ms,
        message: `Next claim available in ${Math.ceil(result.remaining_ms / (1000 * 60 * 60))} hours.`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Daily reward credited successfully!',
      reward: result
    });

  } catch (err) {
    console.error('Daily Reward Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Reward processing failed' });
  }
};
