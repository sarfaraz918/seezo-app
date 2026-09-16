/**
 * SEEZO Backend Serverless API - Tasks Management & Verification
 * Path: /api/tasks
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

// ডিফল্ট প্রাথমিক টাস্ক লিস্ট
const INITIAL_TASKS = [
  {
    id: "task_tg_channel",
    title: "Join Official Telegram Channel",
    description: "Subscribe to SEEZO announcements channel",
    reward_sezo: 25,
    action_url: "https://t.me/telegram",
    type: "TELEGRAM"
  },
  {
    id: "task_tg_group",
    title: "Join SEEZO Community Chat",
    description: "Connect with thousands of active earners",
    reward_sezo: 20,
    action_url: "https://t.me/telegram",
    type: "TELEGRAM"
  },
  {
    id: "task_follow_x",
    title: "Follow SEEZO on X (Twitter)",
    description: "Stay updated with global platform updates",
    reward_sezo: 15,
    action_url: "https://x.com",
    type: "SOCIAL"
  }
];

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
    const { initData, action, taskId } = req.body;
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

    // ১. টাস্ক তালিকা এবং ইউজারের কমপ্লিট হিস্ট্রি ফেচ
    if (action === 'list') {
      const submissionsSnap = await db.collection('task_submissions')
        .where('telegram_id', '==', userId)
        .get();

      const completedMap = {};
      submissionsSnap.forEach(doc => {
        completedMap[doc.data().task_id] = doc.data().status;
      });

      const tasksWithStatus = INITIAL_TASKS.map(task => ({
        ...task,
        status: completedMap[task.id] || 'AVAILABLE'
      }));

      return res.status(200).json({
        success: true,
        tasks: tasksWithStatus
      });
    }

    // ২. টাস্ক কমপ্লিট ও রিওয়ার্ড ক্লেইম
    if (action === 'complete') {
      const task = INITIAL_TASKS.find(t => t.id === taskId);
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

      const submissionRef = db.collection('task_submissions').doc(`${userId}_${taskId}`);
      const txRef = db.collection('transactions').doc();

      const result = await db.runTransaction(async (t) => {
        const subDoc = await t.get(submissionRef);
        if (subDoc.exists) {
          throw new Error('ALREADY_CLAIMED');
        }

        const userDoc = await t.get(userRef);
        if (!userDoc.exists) throw new Error('USER_NOT_FOUND');

        const currentBalance = Number(userDoc.data().balance || 0);
        const currentEarned = Number(userDoc.data().total_earned || 0);
        const newBalance = currentBalance + task.reward_sezo;
        const newEarned = currentEarned + task.reward_sezo;

        t.update(userRef, {
          balance: newBalance,
          total_earned: newEarned,
          last_active_at: admin.firestore.FieldValue.serverTimestamp()
        });

        t.set(submissionRef, {
          submission_id: submissionRef.id,
          telegram_id: userId,
          task_id: task.id,
          reward_sezo: task.reward_sezo,
          status: 'COMPLETED',
          completed_at: admin.firestore.FieldValue.serverTimestamp()
        });

        t.set(txRef, {
          tx_id: txRef.id,
          telegram_id: userId,
          type: 'TASK_REWARD',
          amount_sezo: task.reward_sezo,
          amount_bdt: task.reward_sezo / 20,
          balance_after: newBalance,
          status: 'COMPLETED',
          description: `Completed: ${task.title}`,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        return { new_balance: newBalance, reward: task.reward_sezo };
      });

      return res.status(200).json({
        success: true,
        message: `Task completed! +${task.reward_sezo} SEZO credited.`,
        data: result
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid action' });

  } catch (err) {
    console.error('Task API Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message === 'ALREADY_CLAIMED' ? 'Reward already claimed for this task!' : 'Task processing error'
    });
  }
};
