/**
 * SEEZO Platform - Core Client Engine
 * Real Backend & Production Firebase Sync Build
 */

// গ্লোবাল স্টেট
window.SEEZO_STATE = {
  user: null,
  balance: 0,
  initData: '',
  isSyncing: true
};

document.addEventListener('DOMContentLoaded', () => {
  handleAppLoader();
  initTelegramContext();
  initNavigation();
  initCoinTouch();
});

// লোডার কন্ট্রোলার
function handleAppLoader() {
  const loader = document.getElementById('app-loader');
  setTimeout(() => {
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 500);
    }
  }, 1000);
}

// টেলিগ্রাম কনটেক্সট এবং রিয়েল ব্যাকএন্ড সিঙ্ক
async function initTelegramContext() {
  const debugInfo = document.getElementById('telegram-debug-info');
  const userNameEl = document.getElementById('top-user-name');
  const userStatusEl = document.getElementById('top-user-status');
  const userAvatarEl = document.getElementById('top-user-avatar');
  const balanceEl = document.getElementById('user-balance');

  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    if (tg.setHeaderColor) tg.setHeaderColor('#101622');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#0a0d14');

    window.SEEZO_STATE.initData = tg.initData;

    const initDataUnsafe = tg.initDataUnsafe;

    if (initDataUnsafe && initDataUnsafe.user) {
      const u = initDataUnsafe.user;
      userNameEl.textContent = u.first_name || 'Member';
      userStatusEl.textContent = 'CONNECTING';

      if (u.photo_url) {
        userAvatarEl.innerHTML = `<img src="${u.photo_url}" alt="Avatar">`;
      }

      // ব্যাকএন্ডে রিয়েল অথেন্টিকেশন এবং ডেটাবেস থেকে ব্যালেন্স আনা
      try {
        debugInfo.textContent = 'Authenticating with Asia-Mumbai Database Node...';

        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: tg.initData,
            referralCode: initDataUnsafe.start_param || null
          })
        });

        const data = await response.json();

        if (data.success && data.user) {
          window.SEEZO_STATE.user = data.user;
          window.SEEZO_STATE.balance = data.user.balance || 0;
          
          // ব্যালেন্স UI আপডেট
          balanceEl.textContent = Number(data.user.balance).toLocaleString();
          userStatusEl.textContent = 'AUTHENTICATED';
          debugInfo.textContent = `Real-time Node Connected. User ID: ${data.user.telegram_id} | Status: ${data.user.status.toUpperCase()}`;
        } else {
          userStatusEl.textContent = 'AUTH ERROR';
          debugInfo.textContent = `Handshake Failed: ${data.message || 'Check Server Configuration'}`;
        }

      } catch (err) {
        console.error(err);
        userStatusEl.textContent = 'OFFLINE';
        debugInfo.textContent = 'Network Timeout: Unable to reach SEEZO Cloud Node.';
      }

    } else {
      userNameEl.textContent = 'Sandbox Mode';
      userStatusEl.textContent = 'BROWSER';
      debugInfo.textContent = 'Direct Web Preview. Real user data syncs inside Telegram.';
    }
  } else {
    userNameEl.textContent = 'Standalone';
    userStatusEl.textContent = 'OFFLINE';
    debugInfo.textContent = 'Telegram WebApp SDK not detected.';
  }
}

// বটম নেভিগেশন
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.view-screen');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScreenId = btn.getAttribute('data-target');

      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      screens.forEach(s => s.classList.remove('active'));
      const activeScreen = document.getElementById(targetScreenId);
      if (activeScreen) {
        activeScreen.classList.add('active');
      }

      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    });
  });
}

// কয়েন টাচ
function initCoinTouch() {
  const coin = document.getElementById('sezo-coin-elem');
  if (!coin) return;

  coin.parentElement.addEventListener('click', () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  });
}
