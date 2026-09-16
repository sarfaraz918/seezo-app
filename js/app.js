/**
 * SEEZO Platform - Core Client Engine
 * Phase 4, 5, 6 Integrated Build
 */

document.addEventListener('DOMContentLoaded', () => {
  // ১. ব্র্যান্ডেড লোডার হ্যান্ডলিং
  handleAppLoader();

  // ২. টেলিগ্রাম কনটেক্সট ইনিশিয়ালাইজেশন
  initTelegramContext();

  // ৩. নেভিগেশন কন্ট্রোলার
  initNavigation();

  // ৪. কয়েন ইন্টার‍্যাকশন
  initCoinTouch();
});

// লোডিং স্ক্রিন নিয়ন্ত্রক (Phase 6)
function handleAppLoader() {
  const loader = document.getElementById('app-loader');
  
  // ১.২ সেকেন্ডে ব্র্যান্ডেড অ্যানিমেশন সম্পন্ন করে অ্যাপ দৃশ্যমান হবে
  setTimeout(() => {
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => loader.remove(), 500); // মেমরি বাঁচাতে সম্পূর্ণ রিমুভ
    }
  }, 1200);
}

// টেলিগ্রাম ওয়েব অ্যাপ ইনিশিয়ালাইজেশন (Phase 3 & 4)
function initTelegramContext() {
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

    const initDataUnsafe = tg.initDataUnsafe;

    if (initDataUnsafe && initDataUnsafe.user) {
      const user = initDataUnsafe.user;
      const displayName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
      
      userNameEl.textContent = displayName;
      userStatusEl.textContent = 'VERIFIED';
      
      if (user.photo_url) {
        userAvatarEl.innerHTML = `<img src="${user.photo_url}" alt="Avatar">`;
      }

      debugInfo.textContent = `Node: Telegram Client Connected (${user.id}). Security handshake ready.`;
    } else {
      userNameEl.textContent = 'Web Tester';
      userStatusEl.textContent = 'DEV MODE';
      debugInfo.textContent = 'Local sandbox active. Open inside Telegram for full functionality.';
    }
  } else {
    userNameEl.textContent = 'Guest User';
    userStatusEl.textContent = 'STANDALONE';
    debugInfo.textContent = 'Browser testing mode. Telegram SDK awaiting activation.';
  }
}

// বটম নেভিগেশন কন্ট্রোলার
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

      // হেপটিক ফিডব্যাক
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    });
  });
}

// ৩D SEZO কয়েন টাচ ইফেক্ট (Phase 5)
function initCoinTouch() {
  const coin = document.getElementById('sezo-coin-elem');
  if (!coin) return;

  coin.parentElement.addEventListener('click', () => {
    // টেলিগ্রাম হেপটিক ভাইব্রেশন
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
  });
}
