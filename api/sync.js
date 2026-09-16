/**
 * SEEZO Backend Serverless API - User Sync & Cryptographic Handshake
 * Path: /api/sync
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

// Firebase Admin SDK নিরাপদ ইনিশিয়ালাইজেশন
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

// Telegram initData HMAC-SHA256 ক্রিপ্টোগ্রাফিক ভ্যালিডেশন
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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { initData, referralCode } = req.body;
    const botToken = process.env.BOT_TOKEN;

    // ১. ক্লায়েন্ট সিকিউরিটি ভ্যালিডেশন
    const isValid = verifyTelegramData(initData, botToken);
    
    // যদি ব্রাউজার মোড হয় তবে টেস্ট সাপোর্ট, অন্যথায় টেলিগ্রাম ভ্যালিডেশন বাধ্যতামূলক
    const urlParams = new URLSearchParams(initData || '');
    const userRaw = urlParams.get('user');

    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, message: 'Cryptographic authentication failed. Unauthorized client.' });
    }

    if (!userRaw) {
      return res.status(400).json({ success: false, message: 'Missing user payload' });
    }

    const tgUser = JSON.parse(userRaw);
    const userId = String(tgUser.id);
    const userRef = db.collection('users').doc(userId);

    // ২. ডেটাবেস লেনদেন (Atomic Handshake)
    const userDoc = await userRef.get();
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (!userDoc.exists) {
      // নতুন ইউজার রেজিস্ট্রেশন
      const newUserData = {
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

      await userRef.set(newUserData);

      return res.status(200).json({
        success: true,
        is_new_user: true,
        user: newUserData
      });
    } else {
      // পুরাতন ইউজারের প্রোফাইল সিঙ্ক ও লাস্ট অ্যাক্টিভ আপডেট
      const existingData = userDoc.data();

      // যদি ইউজারের নাম বা ফটো টেলিগ্রামে পরিবর্তন হয় তবে সিঙ্ক হবে
      await userRef.update({
        first_name: tgUser.first_name || existingData.first_name,
        last_name: tgUser.last_name || existingData.last_name,
        username: tgUser.username || existingData.username,
        photo_url: tgUser.photo_url || existingData.photo_url,
        last_active_at: now
      });

      return res.status(200).json({
        success: true,
        is_new_user: false,
        user: {
          ...existingData,
          first_name: tgUser.first_name || existingData.first_name,
          username: tgUser.username || existingData.username
        }
      });
    }

  } catch (error) {
    console.error('SEEZO Sync Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal Database Handshake Failed',
      error: error.message 
    });
  }
};
