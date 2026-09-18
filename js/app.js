/**
 * SEEZO Platform - Core Engine (White Luxury Editorial Edition)
 * Zero Neon, Clean Typography, Welcome Channel Modal & Profile Error Drawer
 */

window.SEEZO_STATE = {
  user: null,
  balance: 0,
  initData: '',
  timerInterval: null,
  adsgramBlockId: "48325",
  officialChannelUrl: "https://t.me/telegram" // আপনার অফিসিয়াল টেলিগ্রাম চ্যানেল লিংক
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
  checkChannelWelcomePopup();
});

function handleAppLoader() {
  const loader = document.getElementById('app-loader');
  setTimeout(() => {
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 400);
    }
  }, 900);
}

// প্রফেশনাল ড্রয়ার নোটিফিকেশন / এরর হ্যান্ডলার
function openDrawerNotification(title, messageHtml) {
  const drawer = document.getElementById('info-drawer-modal');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerBody = document.getElementById('drawer-body');

  if (drawer && drawerTitle && drawerBody) {
    drawerTitle.textContent = title;
    drawerBody.innerHTML = messageHtml;
    drawer.classList.remove('hidden');
  }
}

// চ্যানেল জয়েন ওয়েলকাম পপআপ
function checkChannelWelcomePopup() {
  const hasSeen = localStorage.getItem('seezo_channel_popup_seen');
  const modal = document.getElementById('channel-welcome-modal');
  const joinBtn = document.getElementById('btn-join-channel');
  const dismissBtn = document.getElementById('btn-dismiss-welcome');

  if (!hasSeen && modal) {
    setTimeout(() => {
      modal.classList.remove('hidden');
    }, 1200);

    joinBtn.onclick = () => {
      localStorage.setItem('seezo_channel_popup_seen', 'true');
      modal.classList.add('hidden');
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(window.SEEZO_STATE.officialChannelUrl);
      } else {
        window.open(window.SEEZO_STATE.officialChannelUrl, '_blank');
      }
    };

    dismissBtn.onclick = () => {
      localStorage.setItem('seezo_channel_popup_seen', 'true');
      modal.classList.add('hidden');
    };
  }
}

// টেলিগ্রাম এবং প্রোফাইল সিঙ্ক
async function initTelegramContext() {
  const userNameEl = document.getElementById('top-user-name');
  const userAvatarEl = document.getElementById('top-user-avatar');

  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    if (tg.setHeaderColor) tg.setHeaderColor('#ffffff');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#f8fafc');

    window.SEEZO_STATE.initData = tg.initData;
    const initDataUnsafe = tg.initDataUnsafe;

    if (initDataUnsafe && initDataUnsafe.user) {
      const u = initDataUnsafe.user;
      userNameEl.textContent = u.first_name || 'Member';

      if (u.photo_url) {
        userAvatarEl.innerHTML = `<img src="${u.photo_url}" alt="Avatar">`;
      }

      const pName = document.getElementById('profile-name');
      const pUser = document.getElementById('profile-username');
      const pId = document.getElementById('profile-tg-id');
      const pAvatar = document.getElementById('profile-avatar-big');

      if (pName) pName.textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      if (pUser) pUser.textContent = u.username ? `@${u.username}` : 'No Username';
      if (pId) pId.textContent = `User ID: ${u.id}`;
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
          setupReferralLink(u.id);
        } else {
          openDrawerNotification('Session Notice', `<p>${data.message || 'Verification pending'}</p>`);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }
}

// UI ড্যাশবোর্ড আপডেট
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
      openDrawerNotification('Notice', '<p>Please open inside Telegram client to claim your daily bonus.</p>');
      return;
    }

    claimBtn.disabled = true;
    claimBtnText.textContent = '...';

    try {
      const res = await fetch('/api/daily-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
      });

      const data = await res.json();

      if (data.success && data.reward) {
        openDrawerNotification('Reward Credited', '<p><strong>+10 SEZO</strong> has been deposited to your balance.</p>');
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.reward.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 10;
          updateDashboardUI(window.SEEZO_STATE.user);
        }
        startCooldownTimer(data.reward.next_claim_ms);
      } else if (data.cooldown) {
        startCooldownTimer(Date.now() + data.remaining_ms);
      } else {
        openDrawerNotification('Reward Status', `<p>${data.message || 'Daily reward cooldown is active.'}</p>`);
        claimBtn.disabled = false;
        claimBtnText.textContent = '+10 SEZO';
      }
    } catch (err) {
      claimBtn.disabled = false;
      claimBtnText.textContent = '+10 SEZO';
    }
  });

  function startCooldownTimer(targetTimeMs) {
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
        claimBtnText.textContent = '+10 SEZO';
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

// স্পন্সরড ভিডিও অ্যাড
function initAdEarningEvents() {
  const adBtn = document.getElementById('btn-watch-ad');
  const adBtnText = document.getElementById('btn-ad-text');

  if (!adBtn) return;

  adBtn.addEventListener('click', async () => {
    if (!window.SEEZO_STATE.initData) {
      openDrawerNotification('Notice', '<p>Open inside Telegram to watch sponsored ads.</p>');
      return;
    }

    adBtn.disabled = true;
    adBtnText.textContent = '...';

    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ 
          blockId: window.SEEZO_STATE.adsgramBlockId,
          debug: false 
        });

        AdController.show().then(async () => {
          await claimAdReward();
        }).catch((err) => {
          console.warn('Ad stream notice:', err);
          openDrawerNotification('Ad Stream Notice', '<p>The ad was closed before completion or no new inventory available right now.</p>');
          resetAdButton();
        });

      } catch (err) {
        openDrawerNotification('Network Notice', '<p>Ad network is currently busy. Please retry in a few moments.</p>');
        resetAdButton();
      }
    } else {
      openDrawerNotification('Loading', '<p>Ad provider SDK is initializing. Please try again.</p>');
      resetAdButton();
    }
  });

  function resetAdButton() {
    adBtn.disabled = false;
    adBtnText.textContent = '+5 SEZO';
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
        openDrawerNotification('Ad Verified', '<p><strong>+5 SEZO</strong> has been deposited to your balance.</p>');
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.reward.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 5;
          updateDashboardUI(window.SEEZO_STATE.user);
        }
      } else {
        openDrawerNotification('Notice', `<p>${data.message || 'Ad reward error'}</p>`);
      }
    } catch (e) {
      openDrawerNotification('Network Error', '<p>Failed to verify ad reward with node.</p>');
    } finally {
      resetAdButton();
    }
  }
}

// লিডারবোর্ড
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
          <div class="rank-row-card ${item.is_current_user ? 'is-me' : ''}">
            <div class="rank-left-side">
              <span class="rank-order-num ${rankClass}">#${item.rank}</span>
              <div>
                <div class="rank-user-title">${item.first_name} ${item.is_current_user ? '(You)' : ''}</div>
                <div class="rank-user-sub">${item.username || `ID: ${item.telegram_id}`}</div>
              </div>
            </div>
            <div class="rank-earned-sum">${Number(item.total_earned).toLocaleString()} SEZO</div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Leaderboard error:', err);
  }
}

// রেফারেল
function setupReferralLink(userId) {
  const input = document.getElementById('referral-link-input');
  const copyBtn = document.getElementById('btn-copy-ref');
  const shareTgBtn = document.getElementById('btn-share-tg');

  const referralLink = `https://t.me/SEEZO/app?startapp=${userId}`;
  if (input) input.value = referralLink;

  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(referralLink).then(() => {
        openDrawerNotification('Copied', '<p>Referral link copied to clipboard.</p>');
      });
    };
  }

  if (shareTgBtn) {
    shareTgBtn.onclick = () => {
      const shareText = encodeURIComponent(`Join SEEZO and earn verified SEZO virtual tokens with daily rewards!`);
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
    };
  }
}

// মডাল ও ড্রয়ার ইভেন্টস
function initModalEvents() {
  const drawer = document.getElementById('info-drawer-modal');
  const closeBtn = document.getElementById('btn-close-drawer');
  const backdrop = document.getElementById('drawer-backdrop');

  const privacyBtn = document.getElementById('btn-open-privacy');
  const supportBtn = document.getElementById('btn-open-support');
  const profileTrigger = document.getElementById('top-profile-trigger');

  function closeDrawer() {
    if (drawer) drawer.classList.add('hidden');
  }

  if (closeBtn) closeBtn.onclick = closeDrawer;
  if (backdrop) backdrop.onclick = closeDrawer;

  if (profileTrigger) {
    profileTrigger.onclick = () => {
      const u = window.SEEZO_STATE.user;
      openDrawerNotification('Account Profile', `
        <h4>Telegram Identity</h4>
        <p>User: <strong>${u ? u.first_name : 'Guest'}</strong> (@${u && u.username ? u.username : 'N/A'})</p>
        <p>Telegram ID: <strong>${u ? u.telegram_id : '--------'}</strong></p>
        <p>Account Status: <strong>VERIFIED ACTIVE</strong></p>
      `);
    };
  }

  if (privacyBtn) {
    privacyBtn.onclick = () => {
      openDrawerNotification('Privacy Policy', `
        <h4>Data Collection</h4>
        <p>SEEZO records only your public Telegram User ID and username to maintain your virtual balance and prevent multi-account abuse.</p>
        
        <h4>Financial Privacy</h4>
        <p>Withdrawal payout information (bKash/Nagad/Rocket) is used exclusively for manual admin payments and never shared with third parties.</p>
      `);
    };
  }

  if (supportBtn) {
    supportBtn.onclick = () => {
      openDrawerNotification('Guidelines & Help', `
        <h4>Exchange Economics</h4>
        <p><strong>2000 SEZO = 100 BDT</strong> (20 SEZO = 1.00 BDT).</p>
        
        <h4>Withdrawals</h4>
        <p>All payouts are manually reviewed and processed by our admin team within 24 to 48 hours.</p>
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
        openDrawerNotification('Invalid Input', '<p>Please enter a valid 11-digit mobile phone number.</p>');
        return;
      }

      if (Number(window.SEEZO_STATE.balance || 0) < Number(amount)) {
        openDrawerNotification('Insufficient Balance', `<p>You have ${window.SEEZO_STATE.balance} SEZO. Minimum required for this payout is ${amount} SEZO.</p>`);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing...';

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
          openDrawerNotification('Withdrawal Submitted', '<p>Your payout request has been placed in the queue for manual admin approval.</p>');
          if (window.SEEZO_STATE.user) {
            window.SEEZO_STATE.user.balance = data.data.new_balance;
            window.SEEZO_STATE.user.pending_withdrawal = data.data.pending;
            updateDashboardUI(window.SEEZO_STATE.user);
          }
          form.reset();
          loadTransactions();
        } else {
          openDrawerNotification('Payout Notice', `<p>${data.message || 'Withdrawal failed'}</p>`);
        }
      } catch (err) {
        openDrawerNotification('Network Error', '<p>Unable to connect to transaction processor.</p>');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Withdrawal Request';
      }
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadTransactions();
    });
  }
}

// ট্রানজ্যাকশন হিস্ট্রি
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
        list.innerHTML = `<div class="empty-tx-box">No recorded transactions yet</div>`;
        return;
      }

      list.innerHTML = data.transactions.map(tx => {
        const isCredit = tx.amount_sezo > 0;
        return `
          <div class="tx-item-card">
            <div>
              <div class="tx-item-desc">${tx.description || tx.type}</div>
              <div class="tx-item-time">${tx.created_at ? new Date(tx.created_at._seconds * 1000).toLocaleTimeString() : 'Recent'}</div>
            </div>
            <div class="tx-item-amount ${isCredit ? 'credit' : 'debit'}">
              ${isCredit ? '+' : ''}${tx.amount_sezo} SEZO
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
  const navButtons = document.querySelectorAll('.nav-tab-btn');
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
