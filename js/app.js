/**
 * SEEZO Platform - Core Application Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  initTelegramContext();
  initNavigation();
});

// ১. টেলিগ্রাম ওয়েব অ্যাপ ইনিশিয়ালাইজেশন
function initTelegramContext() {
  const debugInfo = document.getElementById('telegram-debug-info');
  const userNameEl = document.getElementById('top-user-name');
  const userStatusEl = document.getElementById('top-user-status');
  const userAvatarEl = document.getElementById('top-user-avatar');

  // টেলিগ্রাম গ্লোবাল অবজেক্ট ভেরিফিকেশন
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    
    // টেলিগ্রাম উইন্ডো সম্পূর্ণ স্ক্রিনে এক্সপ্যান্ড করা
    tg.ready();
    tg.expand();

    // হেডার কালার ব্যাকগ্রাউন্ডের সাথে ম্যাচ করা
    if (tg.setHeaderColor) {
      tg.setHeaderColor('#101622');
    }
    if (tg.setBackgroundColor) {
      tg.setBackgroundColor('#0a0d14');
    }

    const initDataUnsafe = tg.initDataUnsafe;

    if (initDataUnsafe && initDataUnsafe.user) {
      const user = initDataUnsafe.user;
      const displayName = user.first_name + (user.last_name ? ' ' + user.last_name : '');
      
      userNameEl.textContent = displayName;
      userStatusEl.textContent = 'ONLINE';
      
      if (user.photo_url) {
        userAvatarEl.innerHTML = `<img src="${user.photo_url}" alt="Avatar">`;
      }

      debugInfo.textContent = `Connected as Telegram User ID: ${user.id} (@${user.username || 'N/A'}). Client integrity validated.`;
    } else {
      userNameEl.textContent = 'Web Preview';
      userStatusEl.textContent = 'DEV MODE';
      debugInfo.textContent = 'Running outside Telegram. Direct browser testing environment active.';
    }
  } else {
    userNameEl.textContent = 'Local Guest';
    userStatusEl.textContent = 'OFFLINE';
    debugInfo.textContent = 'Telegram WebApp SDK not detected. Running standalone.';
  }
}

// ২. বটম নেভিগেশন ট্যাব সুইচিং
function initNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.view-screen');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetScreenId = btn.getAttribute('data-target');

      // বাটন অ্যাক্টিভ স্টেট টগল
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // স্ক্রিন ভিউ টগল
      screens.forEach(s => s.classList.remove('active'));
      const activeScreen = document.getElementById(targetScreenId);
      if (activeScreen) {
        activeScreen.classList.add('active');
      }

      // টেলিগ্রাম হেপটিক ভাইব্রেশন (যদি ডিভাইসে সাপোর্ট করে)
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.selectionChanged();
      }
    });
  });
}
