/**
 * SEEZO Platform - Web3 Tap-to-Mine Engine
 * Tactile Spring Tap, Persistent Energy System & AdsGram 48325 Booster
 */

window.SEEZO_STATE = {
  user: null,
  balance: 0,
  initData: '',
  energy: 1000,
  maxEnergy: 1000,
  tapValue: 1,
  adsgramBlockId: "48325"
};

// গ্লোবাল ক্লোজ ফাংশন (✕ বাটনে ১০০% নিশ্চিত কাজ করবে)
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
    else if (type === 'heavy') window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
    else if (type === 'success') window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    else if (type === 'selection') window.Telegram.WebApp.HapticFeedback.selectionChanged();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTelegramContext();
  initNavigation();
  initTapMiningSystem();
  initEnergyRegenLoop();
  initDailyRewardEvents();
  initAdRefillEvents();
  initWalletEvents();
  initReferralEvents();
  initSettingsModalEvents();
  checkPersistentDailyLock();
});

// ১০০% নির্ভরযোগ্য গ্লাস নোটিশ
function showNotice(title, htmlContent) {
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

// ==========================================
// 1. TACTILE TAP-TO-MINE SYSTEM (কয়েন আর ঘুরবে না)
// ==========================================
function initTapMiningSystem() {
  const coinStage = document.getElementById('tap-coin-stage');
  if (!coinStage) return;

  // সেভ করা এনার্জি রিড করা
  const savedEnergy = localStorage.getItem('seezo_energy_val');
  if (savedEnergy !== null) {
    window.SEEZO_STATE.energy = Math.max(0, parseInt(savedEnergy));
    updateEnergyUI();
  }

  coinStage.addEventListener('pointerdown', (e) => {
    e.preventDefault();

    if (window.SEEZO_STATE.energy < window.SEEZO_STATE.tapValue) {
      triggerHaptic('heavy');
      showNotice('Energy Depleted', '<p>আপনার মাইনিং এনার্জি শেষ হয়ে গেছে! সম্পূর্ণ এনার্জি ফুল করতে নিচের <strong>Watch Ad Refill</strong> বাটনে ক্লিক করুন।</p>');
      return;
    }

    // এনার্জি হ্রাস ও কয়েন ব্যালেন্স ইনক্রিমেন্ট
    window.SEEZO_STATE.energy -= window.SEEZO_STATE.tapValue;
    window.SEEZO_STATE.balance += window.SEEZO_STATE.tapValue;

    if (window.SEEZO_STATE.user) {
      window.SEEZO_STATE.user.balance = window.SEEZO_STATE.balance;
      window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + window.SEEZO_STATE.tapValue;
    }

    // ভাইব্রেশন ও সাউন্ড ফিল
    triggerHaptic('impact');

    // ফ্লোটিং +1 পার্টিক্যাল তৈরি
    createTapParticle(e.clientX, e.clientY);

    // UI আপডেট
    updateEnergyUI();
    updateBalanceDigits();

    // লোকাল স্টোরেজে এনার্জি সেভ
    localStorage.setItem('seezo_energy_val', window.SEEZO_STATE.energy);
  });
}

function createTapParticle(x, y) {
  const p = document.createElement('div');
  p.className = 'floating-tap-text';
  p.textContent = `+${window.SEEZO_STATE.tapValue}`;
  p.style.left = `${x - 15}px`;
  p.style.top = `${y - 20}px`;
  document.body.appendChild(p);

  setTimeout(() => p.remove(), 800);
}

// এনার্জি প্যাসিভ রিজেনারেশন (প্রতি ১ সেকেন্ডে +৩ এনার্জি)
function initEnergyRegenLoop() {
  setInterval(() => {
    if (window.SEEZO_STATE.energy < window.SEEZO_STATE.maxEnergy) {
      window.SEEZO_STATE.energy = Math.min(window.SEEZO_STATE.maxEnergy, window.SEEZO_STATE.energy + 3);
      updateEnergyUI();
      localStorage.setItem('seezo_energy_val', window.SEEZO_STATE.energy);
    }
  }, 1000);
}

function updateEnergyUI() {
  const currentEl = document.getElementById('energy-current');
  const barEl = document.getElementById('energy-bar-fill');

  if (currentEl) currentEl.textContent = window.SEEZO_STATE.energy;
  if (barEl) {
    const pct = (window.SEEZO_STATE.energy / window.SEEZO_STATE.maxEnergy) * 100;
    barEl.style.width = `${pct}%`;
  }
}

function updateBalanceDigits() {
  const b = window.SEEZO_STATE.balance;
  const bdt = `৳${(b / 20).toFixed(2)}`;

  const bdtVal = document.getElementById('balance-bdt-val');
  const sezoVal = document.getElementById('balance-sezo-val');
  const wBdt = document.getElementById('wallet-bdt-val');
  const wSezo = document.getElementById('wallet-sezo-val');

  if (bdtVal) bdtVal.textContent = bdt;
  if (sezoVal) sezoVal.textContent = b.toLocaleString();
  if (wBdt) wBdt.textContent = bdt;
  if (wSezo) wSezo.textContent = b.toLocaleString();
}

function updateDashboardUI(userData) {
  window.SEEZO_STATE.balance = Number(userData.balance || 0);
  updateBalanceDigits();

  const earned = Number(userData.total_earned || 0);
  const withdrawn = Number(userData.total_withdrawn || 0);

  const wEarned = document.getElementById('wallet-total-earned');
  const wWithdrawn = document.getElementById('wallet-total-withdrawn');
  const pEarned = document.getElementById('profile-earned-val');
  const pWithdrawn = document.getElementById('profile-withdrawn-val');

  if (wEarned) wEarned.textContent = earned.toLocaleString();
  if (wWithdrawn) wWithdrawn.textContent = withdrawn.toLocaleString();
  if (pEarned) pEarned.textContent = earned.toLocaleString();
  if (pWithdrawn) pWithdrawn.textContent = withdrawn.toLocaleString();
}

// ==========================================
// 2. ADSGRAM FULL ENERGY REFILL & EARNING
// ==========================================
function initAdRefillEvents() {
  const refillBtn = document.getElementById('btn-ad-refill');
  const directAdBtn = document.getElementById('btn-watch-direct-ad');

  function triggerRewardedAd(isRefill = true) {
    triggerHaptic('impact');
    if (!window.SEEZO_STATE.initData) {
      showNotice('Notice', '<p>বিজ্ঞাপন দেখতে টেলিগ্রাম অ্যাপের ভেতর থেকে প্রবেশ করুন।</p>');
      return;
    }

    if (window.Adsgram) {
      try {
        const AdController = window.Adsgram.init({ 
          blockId: window.SEEZO_STATE.adsgramBlockId,
          debug: false 
        });

        AdController.show().then(async () => {
          // বিজ্ঞাপন সফল হলে এনার্জি ফুল ও +৫ SEZO বোনাস
          window.SEEZO_STATE.energy = window.SEEZO_STATE.maxEnergy;
          updateEnergyUI();
          localStorage.setItem('seezo_energy_val', window.SEEZO_STATE.maxEnergy);

          await claimAdRewardServer();
        }).catch(() => {
          showNotice('Notice', '<p>বিজ্ঞাপন সম্পূর্ণ দেখা হয়নি অথবা এই মুহূর্তে নেটওয়ার্ক খালি রয়েছে।</p>');
        });

      } catch (err) {
        showNotice('Network Notice', '<p>অ্যাড নেটওয়ার্ক সাময়িকভাবে ব্যস্ত। কিছুক্ষণ পর চেষ্টা করুন।</p>');
      }
    } else {
      showNotice('Notice', '<p>অ্যাড SDK প্রস্তুত হচ্ছে। কয়েক সেকেন্ড পর আবার চেষ্টা করুন।</p>');
    }
  }

  if (refillBtn) refillBtn.onclick = () => triggerRewardedAd(true);
  if (directAdBtn) directAdBtn.onclick = () => triggerRewardedAd(false);
}

async function claimAdRewardServer() {
  try {
    const res = await fetch('/api/ad-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
    });

    const data = await res.json();
    if (data.success && data.reward) {
      triggerHaptic('success');
      showNotice('⚡ Energy Refilled!', '<p>আপনার মাইনিং এনার্জি সম্পূর্ণ ফুল হয়েছে এবং সাথে <strong>+৫ SEZO</strong> বোনাস দেওয়া হয়েছে!</p>');
      if (window.SEEZO_STATE.user) {
        window.SEEZO_STATE.user.balance = data.reward.new_balance;
        window.SEEZO_STATE.user.total_earned = (window.SEEZO_STATE.user.total_earned || 0) + 5;
        updateDashboardUI(window.SEEZO_STATE.user);
      }
    }
  } catch (e) {
    showNotice('Success', '<p>এনার্জি ফুল রিচার্জ সম্পন্ন হয়েছে!</p>');
  }
}

// ==========================================
// 3. DAILY REWARD (১০০% পার্মানেন্ট টাইমার লক)
// ==========================================
function checkPersistentDailyLock() {
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

function initDailyRewardEvents() {
  const claimBtn = document.getElementById('btn-claim-daily');
  const claimBtnText = document.getElementById('btn-claim-text');

  if (!claimBtn) return;

  claimBtn.addEventListener('click', async () => {
    triggerHaptic('impact');
    if (!window.SEEZO_STATE.initData) {
      showNotice('Notice', '<p>Open inside Telegram to claim daily bonus.</p>');
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
        showNotice('Bonus Claimed', '<p>অভিনন্দন! <strong>+১০ SEZO</strong> আপনার ব্যালেন্সে সফলভাবে যোগ হয়েছে।</p>');
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
        showNotice('Notice', `<p>${data.message || 'Daily cooldown active.'}</p>`);
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
      return;
    }
    const h = String(Math.floor(remaining / (1000 * 60 * 60))).padStart(2, '0');
    const m = String(Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const s = String(Math.floor((remaining % (1000 * 60)) / 1000)).padStart(2, '0');
    const formatted = `${h}:${m}:${s}`;

    if (earnTimerText) earnTimerText.textContent = formatted;
    if (claimBtnText) claimBtnText.textContent = `আবার পাওয়া যাবে ${formatted}`;
  }
  update();
  window.SEEZO_STATE.timerInterval = setInterval(update, 1000);
}

// ==========================================
// 4. NAVIGATION & OTHER CONTROLLERS
// ==========================================
function initNavigation() {
  const tabs = document.querySelectorAll('.game-tab');
  const screens = document.querySelectorAll('.game-tab-view');

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

function loadLeaderboard() {
  const container = document.getElementById('ranks-list-container');
  const myRankBadge = document.getElementById('my-rank-badge');
  if (!container || !window.SEEZO_STATE.initData) return;

  fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData: window.SEEZO_STATE.initData })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.leaderboard) {
      if (myRankBadge) myRankBadge.textContent = data.my_rank || '#-';

      container.innerHTML = data.leaderboard.map(item => {
        const badgeClass = item.rank === 1 ? 'gold' : (item.rank === 2 ? 'silver' : (item.rank === 3 ? 'bronze' : ''));
        return `
          <div class="rank-row ${item.is_current_user ? 'is-me' : ''}">
            <div class="rank-left-box">
              <span class="rank-badge ${badgeClass}">${item.rank}</span>
              <div>
                <div style="font-size: 13px; font-weight: 700;">${item.first_name} ${item.is_current_user ? '(You)' : ''}</div>
                <div style="font-size: 10px; color: #94a3b8;">${item.username || `ID: ${item.telegram_id}`}</div>
              </div>
            </div>
            <div style="font-size: 13px; font-weight: 900; color: #00f2fe;">${Number(item.total_earned).toLocaleString()} SEZO</div>
          </div>
        `;
      }).join('');
    }
  })
  .catch(err => console.error(err));
}

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
        showNotice('Copied', '<p>রেফারেল লিংক ক্লিপবোর্ডে কপি করা হয়েছে!</p>');
      });
    };
  }

  if (shareTgBtn) {
    shareTgBtn.onclick = () => {
      triggerHaptic('impact');
      const shareText = encodeURIComponent(`SEEZO মাইনিং গেমে ট্যাপ করে ফ্রি SEZO কয়েন আর্ন করুন এবং বিকাশ/নগদে উইথড্র নিন!`);
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(shareUrl);
      } else {
        window.open(shareUrl, '_blank');
      }
    };
  }
}

function initWalletEvents() {
  const form = document.getElementById('withdrawal-form');
  const submitBtn = document.getElementById('btn-submit-withdraw');
  const openBtn = document.getElementById('btn-open-withdraw-drawer');

  if (openBtn) {
    openBtn.onclick = () => {
      triggerHaptic('selection');
      document.getElementById('withdraw-drawer-modal')?.classList.remove('hidden');
    };
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      triggerHaptic('impact');

      const method = document.querySelector('input[name="withdraw-method"]:checked')?.value;
      const accountNum = document.getElementById('withdraw-account-num')?.value?.trim();
      const amount = document.getElementById('withdraw-amount-select')?.value;

      if (!accountNum || accountNum.length < 11) {
        showNotice('Invalid Input', '<p>অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।</p>');
        return;
      }

      if (Number(window.SEEZO_STATE.balance || 0) < Number(amount)) {
        showNotice('Insufficient Balance', `<p>আপনার ব্যালেন্সে পর্যাপ্ত SEZO নেই। নূন্যতম ${amount} SEZO প্রয়োজন।</p>`);
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
          showNotice('Request Submitted', '<p>আপনার উইথড্র রিকোয়েস্ট অ্যাডমিন প্যানেলে পাঠানো হয়েছে। ২৪ ঘণ্টার মধ্যে রিভিউ করে টাকা পাঠানো হবে।</p>');
          if (window.SEEZO_STATE.user) {
            window.SEEZO_STATE.user.balance = data.data.new_balance;
            window.SEEZO_STATE.user.pending_withdrawal = data.data.pending;
            updateDashboardUI(window.SEEZO_STATE.user);
          }
          form.reset();
          loadTransactions();
        } else {
          showNotice('Notice', `<p>${data.message || 'Withdrawal failed'}</p>`);
        }
      } catch (err) {
        showNotice('Network Error', '<p>উইথড্র প্রসেস করতে সমস্যা হয়েছে।</p>');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Payout Request';
      }
    });
  }
}

function loadTransactions() {
  const list = document.getElementById('wallet-tx-list');
  if (!list || !window.SEEZO_STATE.initData) return;

  fetch('/api/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData: window.SEEZO_STATE.initData,
      action: 'get_data'
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success && data.transactions) {
      if (data.transactions.length === 0) {
        list.innerHTML = `<div class="game-empty-box">কোনো লেনদেন রেকর্ড পাওয়া যায়নি</div>`;
        return;
      }

      list.innerHTML = data.transactions.map(tx => {
        const isCredit = tx.amount_sezo > 0;
        return `
          <div class="tx-item">
            <div>
              <div style="font-size: 13px; font-weight: 700;">${tx.description || tx.type}</div>
              <div style="font-size: 10px; color: #94a3b8;">${tx.created_at ? new Date(tx.created_at._seconds * 1000).toLocaleDateString() : 'Recent'}</div>
            </div>
            <div class="tx-amount ${isCredit ? 'credit' : 'debit'}">
              ${isCredit ? '+' : ''}${tx.amount_sezo} SEZO
            </div>
          </div>
        `;
      }).join('');
    }
  })
  .catch(err => console.error(err));
}

function initSettingsModalEvents() {
  document.getElementById('btn-open-privacy')?.addEventListener('click', () => {
    showNotice('Privacy Policy', '<p>SEEZO আপনার টেলিগ্রাম আইডি এনক্রিপ্টেড ক্লাউডে সংরক্ষণ করে। আর্থিক নিরাপত্তা শতভাগ নিশ্চিত করা হয়।</p>');
  });

  document.getElementById('btn-open-support')?.addEventListener('click', () => {
    showNotice('Help & Support', '<p><strong>কনভার্সন রেট:</strong> ২০ SEZO = ১.০০ BDT (২০০০ SEZO = ১০০ BDT)।<br><br>সহায়তার জন্য টেলিগ্রাম অ্যাডমিনের সাথে যোগাযোগ করুন।</p>');
  });
}
