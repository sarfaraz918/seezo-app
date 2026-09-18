/**
 * SEEZO Platform - Core Engine (Remastered 100% Bulletproof Build)
 * Instant X-Button Dismissal, Real-time Countdown Persistence & AdsGram 48325
 */

window.SEEZO_STATE = {
  user: null,
  balance: 0,
  initData: '',
  timerInterval: null,
  adsgramBlockId: "45875"
};

// গ্লোবাল ক্লোজ ফাংশনসমূহ (বাটনের অনক্লিকে সরাসরি ফায়ার হবে)
window.closeWithdrawModal = function() {
  const m = document.getElementById('withdraw-drawer-modal');
  if (m) m.classList.add('hidden');
};

window.closeNoticeModal = function() {
  const m = document.getElementById('notice-drawer-modal');
  if (m) m.classList.add('hidden');
};

function triggerHaptic(type = 'light') {
  if (window.Telegram?.WebApp?.HapticFeedback) {
    if (type === 'impact') window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    else if (type === 'success') window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    else if (type === 'selection') window.Telegram.WebApp.HapticFeedback.selectionChanged();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  handleAppLoader();
  initTelegramContext();
  initNavigation();
  initQuickTileClicks();
  initCoinTouch();
  initDailyRewardEvents();
  initAdEarningEvents();
  initWalletEvents();
  initReferralEvents();
  initSettingsModalEvents();
  checkPersistentCooldown();
});

function handleAppLoader() {
  const loader = document.getElementById('app-loader');
  setTimeout(() => {
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 400);
    }
  }, 700);
}

// ১০০% নির্ভরযোগ্য গ্লাস নোটিশ পপআপ
function showGlassNotice(title, htmlContent) {
  const modal = document.getElementById('notice-drawer-modal');
  const titleEl = document.getElementById('notice-title');
  const bodyEl = document.getElementById('notice-body');

  if (modal && titleEl && bodyEl) {
    titleEl.textContent = title;
    bodyEl.innerHTML = htmlContent;
    modal.classList.remove('hidden');
    triggerHaptic('impact');
  }
}

// টেলিগ্রাম ও ক্লাউড সিঙ্ক
async function initTelegramContext() {
  const initialsEl = document.getElementById('top-user-initials');
  const homeNameEl = document.getElementById('home-user-name');
  const topAvatarEl = document.getElementById('top-user-avatar');

  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    if (tg.setHeaderColor) tg.setHeaderColor('#07090e');
    if (tg.setBackgroundColor) tg.setBackgroundColor('#07090e');

    window.SEEZO_STATE.initData = tg.initData;
    const initDataUnsafe = tg.initDataUnsafe;

    if (initDataUnsafe && initDataUnsafe.user) {
      const u = initDataUnsafe.user;
      homeNameEl.textContent = u.first_name || 'Member';

      const initials = (u.first_name ? u.first_name[0] : '') + (u.last_name ? u.last_name[0] : '');
      initialsEl.textContent = initials || 'RA';

      if (u.photo_url) {
        topAvatarEl.innerHTML = `<img src="${u.photo_url}" alt="Avatar">`;
        const profileAvatar = document.getElementById('profile-avatar-box');
        if (profileAvatar) profileAvatar.innerHTML = `<img src="${u.photo_url}" alt="Avatar">`;
      }

      const pName = document.getElementById('profile-full-name');
      const pUser = document.getElementById('profile-username');
      if (pName) pName.textContent = `${u.first_name || ''} ${u.last_name || ''}`.trim();
      if (pUser) pUser.textContent = u.username ? `@${u.username}` : 'No Username';

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

          // সার্ভার থেকে লাইভ কুলডাউন সিঙ্ক
          if (data.daily_reward_next_ms && data.daily_reward_next_ms > Date.now()) {
            localStorage.setItem('seezo_daily_lock_ts', data.daily_reward_next_ms);
            startCooldownTimer(data.daily_reward_next_ms);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  }
}

// লোকাল স্টোরেজ চেক (যাতে রিলোড হলেও টাইমার রিসেট না হয়)
function checkPersistentCooldown() {
  const savedTs = localStorage.getItem('seezo_daily_lock_ts');
  if (savedTs) {
    const nextClaimTime = Number(savedTs);
    if (nextClaimTime > Date.now()) {
      startCooldownTimer(nextClaimTime);
    } else {
      localStorage.removeItem('seezo_daily_lock_ts');
    }
  }
}

// ড্যাশবোর্ড আপডেট
function updateDashboardUI(userData) {
  const balance = Number(userData.balance || 0);
  const earned = Number(userData.total_earned || 0);
  const withdrawn = Number(userData.total_withdrawn || 0);
  const bdtFormatted = `৳${(balance / 20).toFixed(2)}`;

  window.SEEZO_STATE.balance = balance;

  // Home
  const bdtVal = document.getElementById('balance-bdt-val');
  const sezoVal = document.getElementById('balance-sezo-val');
  if (bdtVal) bdtVal.textContent = bdtFormatted;
  if (sezoVal) sezoVal.textContent = balance.toLocaleString();

  // Wallet
  const wBdt = document.getElementById('wallet-bdt-val');
  const wSezo = document.getElementById('wallet-sezo-val');
  const wEarned = document.getElementById('wallet-total-earned');
  const wWithdrawn = document.getElementById('wallet-total-withdrawn');
  if (wBdt) wBdt.textContent = bdtFormatted;
  if (wSezo) wSezo.textContent = balance.toLocaleString();
  if (wEarned) wEarned.textContent = earned.toLocaleString();
  if (wWithdrawn) wWithdrawn.textContent = withdrawn.toLocaleString();

  // Profile
  const pEarned = document.getElementById('profile-earned-val');
  const pWithdrawn = document.getElementById('profile-withdrawn-val');
  if (pEarned) pEarned.textContent = earned.toLocaleString();
  if (pWithdrawn) pWithdrawn.textContent = withdrawn.toLocaleString();
}

// ট্যাব সুইচিং
function initNavigation() {
  const tabs = document.querySelectorAll('.cyber-tab');
  const screens = document.querySelectorAll('.cyber-screen');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      triggerHaptic('selection');
      const targetId = tab.getAttribute('data-target');

      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      screens.forEach(s => s.classList.remove('active'));
      const activeScreen = document.getElementById(targetId);
      if (activeScreen) activeScreen.classList.add('active');

      if (targetId === 'view-wallet') loadTransactions();
      if (targetId === 'view-ranks') loadLeaderboard();
    });
  });
}

// কুইক টাইলস
function initQuickTileClicks() {
  function goToTab(targetTabId) {
    triggerHaptic('selection');
    const tabBtn = document.querySelector(`.cyber-tab[data-target="${targetTabId}"]`);
    if (tabBtn) tabBtn.click();
  }

  document.getElementById('tile-go-earn')?.addEventListener('click', () => goToTab('view-earn'));
  document.getElementById('tile-go-tasks')?.addEventListener('click', () => goToTab('view-earn'));
  document.getElementById('tile-go-wallet')?.addEventListener('click', () => goToTab('view-wallet'));
  document.getElementById('tile-go-profile')?.addEventListener('click', () => goToTab('view-profile'));
  document.getElementById('bar-go-earn')?.addEventListener('click', () => goToTab('view-earn'));
  document.getElementById('btn-quick-earn')?.addEventListener('click', () => goToTab('view-earn'));

  document.getElementById('btn-quick-withdraw')?.addEventListener('click', () => {
    triggerHaptic('selection');
    document.getElementById('withdraw-drawer-modal')?.classList.remove('hidden');
  });

  document.getElementById('btn-open-withdraw-drawer')?.addEventListener('click', () => {
    triggerHaptic('selection');
    document.getElementById('withdraw-drawer-modal')?.classList.remove('hidden');
  });
}

// ডেইলি রিওয়ার্ড (পার্মানেন্ট কাউন্টডাউন)
function initDailyRewardEvents() {
  const claimBtn = document.getElementById('btn-claim-daily');
  const claimBtnText = document.getElementById('btn-claim-text');

  if (!claimBtn) return;

  claimBtn.addEventListener('click', async () => {
    triggerHaptic('impact');
    if (!window.SEEZO_STATE.initData) {
      showGlassNotice('Notice', '<p>Open inside Telegram client to claim reward.</p>');
      return;
    }

    claimBtn.disabled = true;
    claimBtnText.textContent = 'Verifying...';

    try {
      const res = await fetch('/api/daily-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
      });

      const data = await res.json();

      if (data.success && data.reward) {
        triggerHaptic('success');
        showGlassNotice('Bonus Claimed', '<p>অভিনন্দন! <strong>+১০ SEZO</strong> আপনার ব্যালেন্সে সফলভাবে যোগ হয়েছে।</p>');
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.reward.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 10;
          updateDashboardUI(window.SEEZO_STATE.user);
        }
        localStorage.setItem('seezo_daily_lock_ts', data.reward.next_claim_ms);
        startCooldownTimer(data.reward.next_claim_ms);
      } else if (data.cooldown) {
        localStorage.setItem('seezo_daily_lock_ts', Date.now() + data.remaining_ms);
        startCooldownTimer(Date.now() + data.remaining_ms);
      } else {
        showGlassNotice('Notice', `<p>${data.message || 'Daily cooldown active.'}</p>`);
        claimBtn.disabled = false;
        claimBtnText.textContent = 'Bonus Claim করুন';
      }
    } catch (err) {
      claimBtn.disabled = false;
      claimBtnText.textContent = 'Bonus Claim করুন';
    }
  });
}

function startCooldownTimer(targetTimeMs) {
  const claimBtn = document.getElementById('btn-claim-daily');
  const claimBtnText = document.getElementById('btn-claim-text');
  const earnTimerText = document.getElementById('earn-timer-text');
  const homeTimerDisplay = document.getElementById('home-timer-display');

  if (claimBtn) claimBtn.disabled = true;
  if (window.SEEZO_STATE.timerInterval) clearInterval(window.SEEZO_STATE.timerInterval);

  function update() {
    const remaining = targetTimeMs - Date.now();
    if (remaining <= 0) {
      clearInterval(window.SEEZO_STATE.timerInterval);
      localStorage.removeItem('seezo_daily_lock_ts');
      if (claimBtn) {
        claimBtn.disabled = false;
        claimBtnText.textContent = 'Bonus Claim করুন';
      }
      if (earnTimerText) earnTimerText.textContent = '24:00:00';
      if (homeTimerDisplay) homeTimerDisplay.textContent = 'পরবর্তী বোনাস: প্রস্তুত';
      return;
    }
    const h = String(Math.floor(remaining / (1000 * 60 * 60))).padStart(2, '0');
    const m = String(Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const s = String(Math.floor((remaining % (1000 * 60)) / 1000)).padStart(2, '0');
    const formatted = `${h}:${m}:${s}`;

    if (earnTimerText) earnTimerText.textContent = formatted;
    if (homeTimerDisplay) homeTimerDisplay.textContent = `পরবর্তী বোনাস: ${formatted}`;
    if (claimBtnText) claimBtnText.textContent = `আবার পাওয়া যাবে ${formatted}`;
  }
  update();
  window.SEEZO_STATE.timerInterval = setInterval(update, 1000);
}

// AdsGram রিওয়ার্ডেড অ্যাড
function initAdEarningEvents() {
  const adBtn = document.getElementById('btn-watch-ad');
  const adBtnText = document.getElementById('btn-ad-text');

  if (!adBtn) return;

  adBtn.addEventListener('click', async () => {
    triggerHaptic('impact');
    if (!window.SEEZO_STATE.initData) {
      showGlassNotice('Notice', '<p>বিজ্ঞাপন দেখতে টেলিগ্রাম অ্যাপ থেকে প্রবেশ করুন।</p>');
      return;
    }

    adBtn.disabled = true;
    adBtnText.textContent = 'লোড হচ্ছে...';

    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ 
          blockId: window.SEEZO_STATE.adsgramBlockId,
          debug: false 
        });

        AdController.show().then(async () => {
          await claimAdReward();
        }).catch(() => {
          showGlassNotice('Ad Notice', '<p>বিজ্ঞাপন সম্পূর্ণ দেখা হয়নি অথবা এই মুহূর্তে বিজ্ঞাপন ইনভেন্টরি খালি রয়েছে।</p>');
          resetAdButton();
        });

      } catch (err) {
        showGlassNotice('Network Notice', '<p>বিজ্ঞাপন নেটওয়ার্ক সাময়িকভাবে ব্যস্ত। কিছুক্ষণ পর চেষ্টা করুন।</p>');
        resetAdButton();
      }
    } else {
      showGlassNotice('Notice', '<p>অ্যাড SDK প্রস্তুত হচ্ছে। কয়েক সেকেন্ড পর আবার চেষ্টা করুন।</p>');
      resetAdButton();
    }
  });

  function resetAdButton() {
    adBtn.disabled = false;
    adBtnText.textContent = 'বিজ্ঞাপন দেখুন (+5 SEZO)';
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
        triggerHaptic('success');
        showGlassNotice('Reward Verified', '<p>অভিনন্দন! <strong>+৫ SEZO</strong> আপনার ব্যালেন্সে যোগ হয়েছে।</p>');
        if (window.SEEZO_STATE.user) {
          window.SEEZO_STATE.user.balance = data.reward.new_balance;
          window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 5;
          updateDashboardUI(window.SEEZO_STATE.user);
        }
      } else {
        showGlassNotice('Notice', `<p>${data.message || 'Ad reward error'}</p>`);
      }
    } catch (e) {
      showGlassNotice('Network Error', '<p>সার্ভারের সাথে সংযোগ পাওয়া যায়নি।</p>');
    } finally {
      resetAdButton();
    }
  }
}

// লিডারবোর্ড
async function loadLeaderboard() {
  const container = document.getElementById('ranks-list-container');
  const myRankBadge = document.getElementById('my-rank-badge');
  if (!container || !window.SEEZO_STATE.initData) return;

  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
    });

    const data = await res.json();
    if (data.success && data.leaderboard) {
      if (myRankBadge) myRankBadge.textContent = data.my_rank || '#-';

      container.innerHTML = data.leaderboard.map(item => {
        const badgeClass = item.rank === 1 ? 'gold' : (item.rank === 2 ? 'silver' : (item.rank === 3 ? 'bronze' : ''));
        return `
          <div class="rank-row-neon ${item.is_current_user ? 'is-me' : ''}">
            <div class="rank-left">
              <span class="rank-hex-box ${badgeClass}">${item.rank}</span>
              <div>
                <div class="rank-title">${item.first_name} ${item.is_current_user ? '(You)' : ''}</div>
                <div class="rank-sub">${item.username || `ID: ${item.telegram_id}`}</div>
              </div>
            </div>
            <div class="rank-score">${Number(item.total_earned).toLocaleString()} SEZO</div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
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
      triggerHaptic('success');
      navigator.clipboard.writeText(referralLink).then(() => {
        showGlassNotice('Copied', '<p>রেফারেল লিংক ক্লিপবোর্ডে কপি করা হয়েছে!</p>');
      });
    };
  }

  if (shareTgBtn) {
    shareTgBtn.onclick = () => {
      triggerHaptic('impact');
      const shareText = encodeURIComponent(`SEEZO-তে জয়েন করে ফ্রি SEZO কয়েন আয় করুন এবং সরাসরি বিকাশ/নগদে ক্যাশআউট নিন!`);
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
    };
  }
}

// ওয়ালেট ও উইথড্রয়াল
function initWalletEvents() {
  const form = document.getElementById('withdrawal-form');
  const submitBtn = document.getElementById('btn-submit-withdraw');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      triggerHaptic('impact');

      const method = document.querySelector('input[name="withdraw-method"]:checked')?.value;
      const accountNum = document.getElementById('withdraw-account-num')?.value?.trim();
      const amount = document.getElementById('withdraw-amount-select')?.value;

      if (!accountNum || accountNum.length < 11) {
        showGlassNotice('Invalid Input', '<p>অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।</p>');
        return;
      }

      if (Number(window.SEEZO_STATE.balance || 0) < Number(amount)) {
        showGlassNotice('Insufficient Balance', `<p>আপনার ব্যালেন্সে পর্যাপ্ত SEZO নেই। উইথড্র করার জন্য নূন্যতম ${amount} SEZO প্রয়োজন।</p>`);
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
          triggerHaptic('success');
          window.closeWithdrawModal();
          showGlassNotice('Request Submitted', '<p>আপনার উইথড্র রিকোয়েস্ট অ্যাডমিন প্যানেলে পাঠানো হয়েছে। ২৪ ঘণ্টার মধ্যে রিভিউ করে টাকা পাঠানো হবে।</p>');
          if (window.SEEZO_STATE.user) {
            window.SEEZO_STATE.user.balance = data.data.new_balance;
            window.SEEZO_STATE.user.pending_withdrawal = data.data.pending;
            updateDashboardUI(window.SEEZO_STATE.user);
          }
          form.reset();
          loadTransactions();
        } else {
          showGlassNotice('Notice', `<p>${data.message || 'Withdrawal failed'}</p>`);
        }
      } catch (err) {
        showGlassNotice('Network Error', '<p>উইথড্র রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে।</p>');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Payout Request';
      }
    });
  }
}

// ট্রানজ্যাকশন হিস্ট্রি ফেচ
async function loadTransactions() {
  const list = document.getElementById('wallet-tx-list');
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
        list.innerHTML = `<div class="glass-empty-card">কোনো লেনদেন পাওয়া যায়নি</div>`;
        return;
      }

      list.innerHTML = data.transactions.map(tx => {
        const isCredit = tx.amount_sezo > 0;
        return `
          <div class="tx-glass-item">
            <div>
              <div class="tx-head-title">${tx.description || tx.type}</div>
              <div class="tx-head-date">${tx.created_at ? new Date(tx.created_at._seconds * 1000).toLocaleDateString() : 'Recent'}</div>
            </div>
            <div class="tx-val-sum ${isCredit ? 'credit' : 'debit'}">
              ${isCredit ? '+' : ''}${tx.amount_sezo} SEZO
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// সেটিংস ও ইনফো মডাল
function initSettingsModalEvents() {
  document.getElementById('btn-open-privacy')?.addEventListener('click', () => {
    showGlassNotice('Privacy Policy', '<p>SEEZO আপনার টেলিগ্রাম আইডি ও ডাটা সম্পূর্ণ এনক্রিপ্টেড ক্লাউডে সংরক্ষণ করে। আর্থিক নিরাপত্তা শতভাগ নিশ্চিত করা হয়।</p>');
  });

  document.getElementById('btn-open-support')?.addEventListener('click', () => {
    showGlassNotice('Help & Support', '<p><strong>এক্সচেঞ্জ রেট:</strong> ২০ SEZO = ১.০০ BDT (২০০০ SEZO = ১০০ BDT)।<br><br>পেমেন্ট সংক্রান্ত সহায়তার জন্য টেলিগ্রাম অ্যাডমিনের সাথে যোগাযোগ করুন।</p>');
  });
}

function initCoinTouch() {
  const coin = document.getElementById('sezo-coin-elem');
  if (!coin) return;
  coin.addEventListener('click', () => {
    triggerHaptic('impact');
  });
}
