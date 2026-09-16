/**
 * SEEZO Platform - Core Engine (Production Full Build)
 * All Phases 1 to 18 Integrated
 */

window.SEEZO_STATE = {
  user: null,
  balance: 0,
  initData: '',
  timerInterval: null,
  adsgramBlockId: "int-1736",
  botUsername: "SEEZO"
};

document.addEventListener('DOMContentLoaded', () => {
  handleAppLoader();
  initTelegramContext();
  initNavigation();
  initCoinTouch();
  initDailyRewardEvents();
  initAdEarningEvents();
  initWalletEvents();
  initReferralEvents();
  initModalEvents();
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

      // প্রোফাইল স্ক্রিন সিঙ্ক
      const pName = document.getElementById('profile-name');
      const pUser = document.getElementById('profile-username');
      const pId = document.getElementById('profile-tg-id');
      const pAvatar = document.getElementById('profile-avatar-big');

      if (pName) pName.textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      if (pUser) pUser.textContent = u.username ? `@${u.username}` : 'No Telegram Username';
      if (pId) pId.textContent = `Telegram ID: ${u.id}`;
      if (pAvatar && u.photo_url) pAvatar.innerHTML = `<img src="${u.photo_url}" alt="Avatar">`;

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

          // রেফারেল লিংক সেটআপ
          setupReferralLink(u.id);
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

// UI রেন্ডারিং
function updateDashboardUI(userData) {
  const balanceEl = document.getElementById('user-balance');
  const bdtEl = document.getElementById('bdt-equivalent-val');
  const totalEarnedEl = document.getElementById('metric-total-earned');
  const referralsEl = document.getElementById('metric-referrals');

  const balance = Number(userData.balance || 0);
  const earned = Number(userData.total_earned || 0);
  const referrals = Number(userData.referral_count || 0);

  window.SEEZO_STATE.balance = balance;

  if (balanceEl) balanceEl.textContent = balance.toLocaleString();
  if (bdtEl) bdtEl.textContent = `≈ ${(balance / 20).toFixed(2)} BDT`;
  if (totalEarnedEl) totalEarnedEl.textContent = `${earned.toLocaleString()} SEZO`;
  if (referralsEl) referralsEl.textContent = `${referrals} Users`;

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

  if (!claimBtn) return;

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

// অ্যাড আর্নিং
function initAdEarningEvents() {
  const adBtn = document.getElementById('btn-watch-ad');
  const adBtnText = document.getElementById('btn-ad-text');

  if (!adBtn) return;

  adBtn.addEventListener('click', async () => {
    if (!window.SEEZO_STATE.initData) {
      showToast('Open in Telegram to view ads', 'error');
      return;
    }

    adBtn.disabled = true;
    adBtnText.textContent = 'Loading Ad Stream...';

    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ 
          blockId: window.SEEZO_STATE.adsgramBlockId,
          debug: false 
        });

        AdController.show().then(async () => {
          adBtnText.textContent = 'Verifying View...';
          await claimAdReward();
        }).catch((err) => {
          console.error('AdsGram Event:', err);
          showToast('Ad not completed. Reward canceled.', 'error');
          resetAdButton();
        });

      } catch (err) {
        showToast('Ad network unavailable.', 'error');
        resetAdButton();
      }
    } else {
      showToast('Ad SDK not ready. Try again in a moment.', 'error');
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

// PHASE 15: টাস্ক কন্ট্রোলার
async function loadTasks() {
  const container = document.getElementById('tasks-list-container');
  if (!container || !window.SEEZO_STATE.initData) return;

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: window.SEEZO_STATE.initData,
        action: 'list'
      })
    });

    const data = await res.json();
    if (data.success && data.tasks) {
      container.innerHTML = data.tasks.map(task => {
        const isDone = task.status === 'COMPLETED';
        return `
          <div class="task-item-card">
            <div class="task-info-side">
              <div class="task-badge-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
              </div>
              <div class="task-texts">
                <h4>${task.title}</h4>
                <p>${task.description}</p>
                <span class="task-reward-tag">+${task.reward_sezo} SEZO</span>
              </div>
            </div>
            <div>
              ${isDone ? `
                <button class="btn-task-action completed" disabled>Completed</button>
              ` : `
                <button class="btn-task-action" onclick="performTask('${task.id}', '${task.action_url}')">Start & Earn</button>
              `}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Task load error:', err);
  }
}

window.performTask = async (taskId, actionUrl) => {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.openLink(actionUrl);
  } else {
    window.open(actionUrl, '_blank');
  }

  showToast('Verifying task completion (5s)...', 'success');

  setTimeout(async () => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: window.SEEZO_STATE.initData,
          action: 'complete',
          taskId: taskId
        })
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.data.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + data.data.reward;
          updateDashboardUI(window.SEEZO_STATE.user);
        }
        loadTasks();
      } else {
        showToast(data.message || 'Task verification failed', 'error');
      }
    } catch (e) {
      showToast('Error verifying task', 'error');
    }
  }, 4500);
};

// PHASE 17: লিডারবোর্ড কন্ট্রোলার
async function loadLeaderboard() {
  const container = document.getElementById('leaderboard-list-container');
  const myRankEl = document.getElementById('my-rank-display');
  if (!container || !window.SEEZO_STATE.initData) return;

  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
    });

    const data = await res.json();
    if (data.success) {
      if (myRankEl) myRankEl.textContent = data.my_rank;

      container.innerHTML = data.leaderboard.map(item => {
        const rankClass = item.rank <= 3 ? `top-${item.rank}` : '';
        return `
          <div class="rank-item-card ${item.is_current_user ? 'is-me' : ''}">
            <div class="rank-left">
              <span class="rank-number-badge ${rankClass}">#${item.rank}</span>
              <div class="rank-name-wrap">
                <span class="rank-name">${item.first_name} ${item.is_current_user ? '(You)' : ''}</span>
                <span class="rank-sub">${item.username || `ID: ${item.telegram_id}`}</span>
              </div>
            </div>
            <div class="rank-earned">${Number(item.total_earned).toLocaleString()} SEZO</div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Leaderboard error:', err);
  }
}

// PHASE 16: রেফারেল লিঙ্ক ও শেয়ার
function setupReferralLink(userId) {
  const input = document.getElementById('referral-link-input');
  const copyBtn = document.getElementById('btn-copy-ref');
  const shareTgBtn = document.getElementById('btn-share-tg');

  const botUser = window.SEEZO_STATE.botUsername;
  const referralLink = `https://t.me/${botUser}/app?startapp=${userId}`;

  if (input) input.value = referralLink;

  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(referralLink).then(() => {
        showToast('Referral link copied to clipboard!', 'success');
      });
    };
  }

  if (shareTgBtn) {
    shareTgBtn.onclick = () => {
      const shareText = encodeURIComponent(`Join SEEZO and earn verified SEZO virtual coins with instant daily bonuses! Claim your 2000 SEZO reward.`);
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
    };
  }
}

// PHASE 18: মডাল (প্রাইভেসী পলিসি ও হেল্প সেন্টার)
function initModalEvents() {
  const modal = document.getElementById('info-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeBtn = document.getElementById('btn-close-modal');
  const backdrop = modal?.querySelector('.modal-backdrop');

  const privacyBtn = document.getElementById('btn-open-privacy');
  const supportBtn = document.getElementById('btn-open-support');

  function openModal(title, html) {
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  if (closeBtn) closeBtn.onclick = closeModal;
  if (backdrop) backdrop.onclick = closeModal;

  if (privacyBtn) {
    privacyBtn.onclick = () => {
      openModal('SEEZO Privacy Policy', `
        <h4>1. Information We Collect</h4>
        <p>SEEZO collects your Telegram User ID, username, and public profile name strictly for authentication, reward ledger tracking, and fraud prevention.</p>
        
        <h4>2. Financial & Withdrawal Data</h4>
        <p>When you submit a withdrawal request, your provided mobile financial number (bKash/Nagad/Rocket) is held in our private database strictly for manual admin payout processing.</p>

        <h4>3. Data Security & Storage</h4>
        <p>All database records are securely hosted in Google Cloud (Asia-Mumbai) with cryptographic HMAC-SHA256 client validation. No passwords or private tokens are stored on client devices.</p>
      `);
    };
  }

  if (supportBtn) {
    supportBtn.onclick = () => {
      openModal('Help & Official Support', `
        <h4>Platform Economics</h4>
        <p>Official Exchange Rate: <strong>2000 SEZO = 100 BDT</strong> (20 SEZO = 1.00 BDT).</p>

        <h4>Daily Rewards</h4>
        <p>Users can claim 10 SEZO every 24 hours. The countdown timer runs automatically upon each successful claim.</p>

        <h4>Payout Guidelines</h4>
        <p>Minimum withdrawal is 2000 SEZO. All payouts are reviewed and approved manually by administrators within 24–48 hours to ensure zero platform abuse.</p>

        <h4>Need Direct Assistance?</h4>
        <p>For account issues, contact your official bot administrator or community support group.</p>
      `);
    };
  }
}

// ওয়ালেট কন্ট্রোলার
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
        showToast('Enter valid 11-digit account number', 'error');
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
        showToast('Network error processing payout', 'error');
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
        list.innerHTML = `<div class="tx-empty-state"><span>No transactions recorded yet</span></div>`;
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

      if (targetScreenId === 'view-tasks') {
        loadTasks();
      } else if (targetScreenId === 'view-wallet') {
        loadTransactions();
      } else if (targetScreenId === 'view-leaderboard') {
        loadLeaderboard();
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
