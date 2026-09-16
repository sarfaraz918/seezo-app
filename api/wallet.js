/**
 * SEEZO Backend Serverless API - Wallet & Manual Withdrawal Engine
 * Path: /api/wallet
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
const MIN_WITHDRAWAL_SEZO = 2000; // ২০০০ SEZO = ১০০ BDT

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
    const { initData, action, amount, method, accountNumber } = req.body;
    const botToken = process.env.BOT_TOKEN;

    const isValid = verifyTelegramData(initData, botToken);
    const urlParams = new URLSearchParams(initData || '');
    const userRaw = urlParams.get('user');

    if (!isValid && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, message: 'Authentication failed' });
    }

    if (!userRaw) {
      return res.status(400).json({ success: false, message: 'User payload missing' });
    }

    const tgUser = JSON.parse(userRaw);
    const userId = String(tgUser.id);
    const userRef = db.collection('users').doc(userId);

    // ১. ওয়ালেট ডাটা ও ট্রানজ্যাকশন হিস্ট্রি ফেচ
    if (action === 'get_data') {
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ success: false, message: 'User not found' });

      const txSnapshot = await db.collection('transactions')
        .where('telegram_id', '==', userId)
        .orderBy('created_at', 'desc')
        .limit(20)
        .get();

      const transactions = [];
      txSnapshot.forEach(doc => transactions.push(doc.data()));

      return res.status(200).json({
        success: true,
        user: userDoc.data(),
        transactions: transactions
      });
    }

    // ২. উইথড্রয়াল সাবমিশন
    if (action === 'withdraw') {
      const sezoAmount = Number(amount);
      if (isNaN(sezoAmount) || sezoAmount < MIN_WITHDRAWAL_SEZO) {
        return res.status(400).json({ success: false, message: `Minimum withdrawal is ${MIN_WITHDRAWAL_SEZO} SEZO (100 BDT).` });
      }

      if (!method || !accountNumber || accountNumber.length < 11) {
        return res.status(400).json({ success: false, message: 'Valid payment method & 11-digit account number required.' });
      }

      const withdrawRef = db.collection('withdrawals').doc();
      const txRef = db.collection('transactions').doc();
      const bdtAmount = sezoAmount / 20;

      const withdrawResult = await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        const userData = userDoc.data();
        const currentBalance = Number(userData.balance || 0);

        if (currentBalance < sezoAmount) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        const newBalance = currentBalance - sezoAmount;
        const currentPending = Number(userData.pending_withdrawal || 0);
        const newPending = currentPending + sezoAmount;

        // ব্যালেন্স হোল্ডে নেওয়া
        t.update(userRef, {
          balance: newBalance,
          pending_withdrawal: newPending,
          last_active_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // অ্যাডমিন কিউতে রিকোয়েস্ট তৈরি
        t.set(withdrawRef, {
          withdrawal_id: withdrawRef.id,
          telegram_id: userId,
          user_name: tgUser.first_name || 'Member',
          sezo_amount: sezoAmount,
          bdt_amount: bdtAmount,
          payment_method: method,
          account_number: accountNumber,
          status: 'PENDING',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // ট্রানজ্যাকশন লেজার রেকর্ড
        t.set(txRef, {
          tx_id: txRef.id,
          telegram_id: userId,
          type: 'WITHDRAWAL_HOLD',
          amount_sezo: -sezoAmount,
          amount_bdt: -bdtAmount,
          balance_after: newBalance,
          status: 'PENDING',
          description: `Withdrawal Request to ${method} (${accountNumber})`,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        return { new_balance: newBalance, pending: newPending };
      });

      return res.status(200).json({
        success: true,
        message: 'Withdrawal submitted for manual review!',
        data: withdrawResult
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action specified' });

  } catch (err) {
    console.error('Wallet Error:', err);
    return res.status(500).json({ success: false, message: err.message === 'INSUFFICIENT_BALANCE' ? 'Insufficient balance for this withdrawal' : 'Internal processing error' });
  }
};
