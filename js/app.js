/**
 * SEEZO Platform - Client Application Controller
 * Phase 9 & 10 Integrated Build (Dashboard & Real 24h Daily Reward)
 */

window.SEEZO_STATE = {
  user: null,
  balance: 0,
  initData: '',
  nextDailyRewardTime: 0,
  timerInterval: null
};

document.addEventListener('DOMContentLoaded', () => {
  handleAppLoader();
  initTelegramContext();
  initNavigation();
  initCoinTouch();
  initDailyRewardEvents();
});

// লোডার
function handleAppLoader() {
  const loader = document.getElementById('app-loader');
  setTimeout(() => {
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 400);
    }
  }, 1000);
}

// নোটিফিকেশন টোস্ট
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `seezo-toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// টেলিগ্রাম এবং প্রোফাইল সিঙ্ক
async function initTelegramContext() {
  const debugInfo = document.getElementById('telegram-debug-info');
  const userNameEl = document.getElementById('top-user-name');
  const userStatusEl = document.getElementById('top-user-status');
  const userAvatarEl = document.getElementById('top-user-avatar');

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

      try {
        debugInfo.textContent = 'Authenticating with Asia-Mumbai Database Cluster...';

        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: tg.initData,
            referralCode: initDataUnsafe.start_param || null
          })
        });

        const data = await res.json();

        if (data.success && data.user) {
          window.SEEZO_STATE.user = data.user;
          updateDashboardUI(data.user);
          userStatusEl.textContent = 'ONLINE';
          debugInfo.textContent = `Node: Verified User ID ${data.user.telegram_id} | Status: ACTIVE`;
        } else {
          userStatusEl.textContent = 'AUTH ERROR';
          debugInfo.textContent = data.message || 'Server Auth Verification Failed';
        }

      } catch (err) {
        console.error(err);
        userStatusEl.textContent = 'OFFLINE';
        debugInfo.textContent = 'Network Timeout: Unable to sync with backend.';
      }
    } else {
      userNameEl.textContent = 'Sandbox';
      userStatusEl.textContent = 'BROWSER';
      debugInfo.textContent = 'Direct Web Preview Active. Real security checks active in Telegram.';
    }
  }
}

// UI ড্যাশবোর্ড আপডেট (ব্যালেন্স, BDT সমমূল্য ও মেট্রিকস)
function updateDashboardUI(userData) {
  const balanceEl = document.getElementById('user-balance');
  const bdtEl = document.getElementById('bdt-equivalent-val');
  const totalEarnedEl = document.getElementById('metric-total-earned');
  const referralsEl = document.getElementById('metric-referrals');

  const balance = Number(userData.balance || 0);
  const earned = Number(userData.total_earned || 0);
  const referrals = Number(userData.referral_count || 0);

  window.SEEZO_STATE.balance = balance;

  balanceEl.textContent = balance.toLocaleString();
  // 2000 SEZO = 100 BDT অর্থাৎ 20 SEZO = 1 BDT
  const bdtAmount = (balance / 20).toFixed(2);
  bdtEl.textContent = `≈ ${bdtAmount} BDT`;

  totalEarnedEl.textContent = `${earned.toLocaleString()} SEZO`;
  referralsEl.textContent = `${referrals} Users`;
}

// PHASE 10: ডেইলি রিওয়ার্ড ক্লেইম ইভেন্ট
function initDailyRewardEvents() {
  const claimBtn = document.getElementById('btn-claim-daily');
  const claimBtnText = document.getElementById('btn-claim-text');
  const timerBadge = document.getElementById('daily-cooldown-timer');
  const timerText = document.getElementById('daily-timer-text');

  claimBtn.addEventListener('click', async () => {
    if (!window.SEEZO_STATE.initData) {
      showToast('Please open inside Telegram to claim reward', 'error');
      return;
    }

    claimBtn.disabled = true;
    claimBtnText.textContent = 'Processing Claim...';

    try {
      const res = await fetch('/api/daily-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
      });

      const data = await res.json();

      if (data.success && data.reward) {
        showToast('Success! +10 SEZO credited to your account', 'success');

        // ব্যালেন্স লাইভ আপডেট
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.reward.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 10;
          updateDashboardUI(window.SEEZO_STATE.user);
        }

        // ২৪ ঘণ্টার কাউন্টডাউন টাইমার স্টার্ট
        startCooldownTimer(data.reward.next_claim_ms);

        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
      } else if (data.cooldown) {
        showToast(data.message || 'Reward cooldown active', 'error');
        startCooldownTimer(Date.now() + data.remaining_ms);
      } else {
        showToast(data.message || 'Claim failed', 'error');
        claimBtn.disabled = false;
        claimBtnText.textContent = 'Claim Daily 10 SEZO';
      }

    } catch (err) {
      console.error(err);
      showToast('Network error while claiming reward', 'error');
      claimBtn.disabled = false;
      claimBtnText.textContent = 'Claim Daily 10 SEZO';
    }
  });

  function startCooldownTimer(targetTimeMs) {
    claimBtn.disabled = true;
    claimBtn.style.display = 'none';
    timerBadge.classList.remove('hidden');

    if (window.SEEZO_STATE.timerInterval) {
      clearInterval(window.SEEZO_STATE.timerInterval);
    }

    function update() {
      const remaining = targetTimeMs - Date.now();
      if (remaining <= 0) {
        clearInterval(window.SEEZO_STATE.timerInterval);
        timerBadge.classList.add('hidden');
        claimBtn.style.display = 'block';
        claimBtn.disabled = false;
        claimBtnText.textContent = 'Claim Daily 10 SEZO';
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      const fH = String(hours).padStart(2, '0');
      const fM = String(minutes).padStart(2, '0');
      const fS = String(seconds).padStart(2, '0');

      timerText.textContent = `${fH}:${fM}:${fS}`;
    }

    update();
    window.SEEZO_STATE.timerInterval = setInterval(update, 1000);
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
