/**
 * SEEZO Platform - Core Engine
 * Production AdsGram Rewarded Video & Strict Anti-Abuse Controller
 */

window.SEEZO_STATE = {
  user: null,
  balance: 0,
  initData: '',
  timerInterval: null,
  // AdsGram Official Test Block ID (পরবর্তীতে adsgram.ai থেকে আপনার রিয়েল আইডি বসাতে পারবেন)
  adsgramBlockId: "int-1736"
};

document.addEventListener('DOMContentLoaded', () => {
  handleAppLoader();
  initTelegramContext();
  initNavigation();
  initCoinTouch();
  initDailyRewardEvents();
  initAdEarningEvents();
  initWalletEvents();
});

function handleAppLoader() {
  const loader = document.getElementById('app-loader');
  setTimeout(() => {
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 400);
    }
  }, 1000);
}

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
  }, 3200);
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
          debugInfo.textContent = data.message || 'Verification Failed';
        }
      } catch (err) {
        console.error(err);
        userStatusEl.textContent = 'OFFLINE';
        debugInfo.textContent = 'Cluster Connection Timeout.';
      }
    }
  }
}

// ড্যাশবোর্ড আপডেট
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
  bdtEl.textContent = `≈ ${(balance / 20).toFixed(2)} BDT`;
  totalEarnedEl.textContent = `${earned.toLocaleString()} SEZO`;
  referralsEl.textContent = `${referrals} Users`;

  const walletBal = document.getElementById('wallet-balance-val');
  const walletBdt = document.getElementById('wallet-bdt-sub');
  const walletPending = document.getElementById('wallet-pending-val');
  const walletWithdrawn = document.getElementById('wallet-withdrawn-val');

  if (walletBal) walletBal.textContent = balance.toLocaleString();
  if (walletBdt) walletBdt.textContent = `≈ ${(balance / 20).toFixed(2)} BDT`;
  if (walletPending) walletPending.textContent = `${Number(userData.pending_withdrawal || 0).toLocaleString()} SEZO`;
  if (walletWithdrawn) walletWithdrawn.textContent = `${Number(userData.total_withdrawn || 0).toLocaleString()} SEZO`;
}

// ডেইলি রিওয়ার্ড
function initDailyRewardEvents() {
  const claimBtn = document.getElementById('btn-claim-daily');
  const claimBtnText = document.getElementById('btn-claim-text');
  const timerBadge = document.getElementById('daily-cooldown-timer');
  const timerText = document.getElementById('daily-timer-text');

  claimBtn.addEventListener('click', async () => {
    if (!window.SEEZO_STATE.initData) {
      showToast('Open inside Telegram to claim reward', 'error');
      return;
    }

    claimBtn.disabled = true;
    claimBtnText.textContent = 'Validating...';

    try {
      const res = await fetch('/api/daily-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
      });

      const data = await res.json();

      if (data.success && data.reward) {
        showToast('Success! +10 SEZO credited to your account', 'success');
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.reward.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 10;
          updateDashboardUI(window.SEEZO_STATE.user);
        }
        startCooldownTimer(data.reward.next_claim_ms);
      } else if (data.cooldown) {
        showToast(data.message || 'Cooldown active', 'error');
        startCooldownTimer(Date.now() + data.remaining_ms);
      } else {
        showToast(data.message || 'Claim failed', 'error');
        claimBtn.disabled = false;
        claimBtnText.textContent = 'Claim Daily 10 SEZO';
      }
    } catch (err) {
      showToast('Network error', 'error');
      claimBtn.disabled = false;
      claimBtnText.textContent = 'Claim Daily 10 SEZO';
    }
  });

  function startCooldownTimer(targetTimeMs) {
    claimBtn.disabled = true;
    claimBtn.style.display = 'none';
    timerBadge.classList.remove('hidden');

    if (window.SEEZO_STATE.timerInterval) clearInterval(window.SEEZO_STATE.timerInterval);

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
      const h = Math.floor(remaining / (1000 * 60 * 60));
      const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((remaining % (1000 * 60)) / 1000);
      timerText.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    update();
    window.SEEZO_STATE.timerInterval = setInterval(update, 1000);
  }
}

// PHASE 11: আসল AdsGram Rewarded Video Integration (কোনো ফেক টাইমার ছাড়া)
function initAdEarningEvents() {
  const adBtn = document.getElementById('btn-watch-ad');
  const adBtnText = document.getElementById('btn-ad-text');

  adBtn.addEventListener('click', async () => {
    if (!window.SEEZO_STATE.initData) {
      showToast('Open in Telegram to view ads', 'error');
      return;
    }

    adBtn.disabled = true;
    adBtnText.textContent = 'Connecting to Ad Network...';

    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ 
          blockId: window.SEEZO_STATE.adsgramBlockId,
          debug: false 
        });

        AdController.show().then(async (result) => {
          // ইউজার সম্পূর্ণ অ্যাড দেখলে তবেই রিওয়ার্ড প্রসেস হবে
          adBtnText.textContent = 'Verifying Completed View...';
          await claimAdReward();
        }).catch((err) => {
          console.error('AdsGram Event Notice:', err);
          showToast('Ad was not completed or no ad available. Reward canceled.', 'error');
          resetAdButton();
        });

      } catch (err) {
        console.error('AdsGram Init Error:', err);
        showToast('Ad service temporarily unavailable.', 'error');
        resetAdButton();
      }
    } else {
      showToast('Ad provider SDK not ready yet. Please try again.', 'error');
      resetAdButton();
    }
  });

  function resetAdButton() {
    adBtn.disabled = false;
    adBtnText.textContent = 'Watch Video Ad (+5 SEZO)';
  }

  async function claimAdReward() {
    try {
      const res = await fetch('/api/ad-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
      });

      const data = await res.json();
      if (data.success && data.reward) {
        showToast('Verified! +5 SEZO added for watching ad', 'success');
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.reward.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 5;
          updateDashboardUI(window.SEEZO_STATE.user);
        }
      } else {
        showToast(data.message || 'Ad reward error', 'error');
      }
    } catch (e) {
      showToast('Connection error during reward handshake', 'error');
    } finally {
      resetAdButton();
    }
  }
}

// ওয়ালেট ও উইথড্রয়াল
function initWalletEvents() {
  const form = document.getElementById('withdrawal-form');
  const submitBtn = document.getElementById('btn-submit-withdraw');
  const refreshBtn = document.getElementById('btn-refresh-tx');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const method = document.querySelector('input[name="withdraw-method"]:checked')?.value;
      const accountNum = document.getElementById('withdraw-account-num')?.value?.trim();
      const amount = document.getElementById('withdraw-amount-select')?.value;

      if (!accountNum || accountNum.length < 11) {
        showToast('Enter a valid 11-digit mobile account number', 'error');
        return;
      }

      if (Number(window.SEEZO_STATE.balance || 0) < Number(amount)) {
        showToast(`Insufficient balance! You need ${amount} SEZO.`, 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Request...';

      try {
        const res = await fetch('/api/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: window.SEEZO_STATE.initData,
            action: 'withdraw',
            amount: amount,
            method: method,
            accountNumber: accountNum
          })
        });

        const data = await res.json();

        if (data.success) {
          showToast('Withdrawal submitted for manual admin review!', 'success');
          if (window.SEEZO_STATE.user) {
            window.SEEZO_STATE.user.balance = data.data.new_balance;
            window.SEEZO_STATE.user.pending_withdrawal = data.data.pending;
            updateDashboardUI(window.SEEZO_STATE.user);
          }
          form.reset();
          loadTransactions();
        } else {
          showToast(data.message || 'Withdrawal failed', 'error');
        }
      } catch (err) {
        showToast('Network error while processing payout', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Withdrawal Request';
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadTransactions();
      showToast('Ledger refreshed', 'success');
    });
  }
}

// ট্রানজ্যাকশন হিস্ট্রি ফেচ
async function loadTransactions() {
  const list = document.getElementById('tx-history-list');
  if (!list || !window.SEEZO_STATE.initData) return;

  try {
    const res = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: window.SEEZO_STATE.initData,
        action: 'get_data'
      })
    });

    const data = await res.json();
    if (data.success && data.transactions) {
      if (data.transactions.length === 0) {
        list.innerHTML = `
          <div class="tx-empty-state">
            <span>No transactions recorded yet</span>
          </div>`;
        return;
      }

      list.innerHTML = data.transactions.map(tx => {
        const isCredit = tx.amount_sezo > 0;
        return `
          <div class="tx-card-row">
            <div class="tx-info">
              <div class="tx-icon-pill ${isCredit ? 'plus' : 'minus'}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  ${isCredit ? '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>' : '<line x1="5" y1="12" x2="19" y2="12"></line>'}
                </svg>
              </div>
              <div>
                <div class="tx-desc">${tx.description || tx.type}</div>
                <div class="tx-date">${tx.created_at ? new Date(tx.created_at._seconds * 1000).toLocaleTimeString() : 'Recent'}</div>
              </div>
            </div>
            <div class="tx-amount-group">
              <div class="tx-amount ${isCredit ? 'credit' : 'debit'}">${isCredit ? '+' : ''}${tx.amount_sezo} SEZO</div>
              <span class="tx-status-tag ${tx.status.toLowerCase()}">${tx.status}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Transactions load error:', err);
  }
}

// নেভিগেশন
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

      if (targetScreenId === 'view-wallet') {
        loadTransactions();
      }

      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    });
  });
}

function initCoinTouch() {
  const coin = document.getElementById('sezo-coin-elem');
  if (!coin) return;
  coin.parentElement.addEventListener('click', () => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  });
}
