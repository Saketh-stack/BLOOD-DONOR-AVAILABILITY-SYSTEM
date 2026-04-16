(function () {
  const API_BASE = (window.location.port === '5500' || window.location.port === '5501' || window.location.protocol === 'file:') ? 'http://localhost/wps%202/wps/api' : './api';
  const SUPPORTED = ['en', 'te', 'hi'];
  const DEFAULT_LANG = 'en';
  const fallback = {
    language_label: 'Language',
    lang_english: 'English',
    lang_telugu: '??????',
    lang_hindi: '??????',
    nav_home: 'Home',
    nav_donor_signup: 'Donor Sign Up',
    nav_donor_login: 'Donor Login',
    nav_hospital_signup: 'Hospital Sign Up',
    nav_hospital_login: 'Hospital Login',
    nav_find_donor: 'Find Donor',
    nav_dashboard: 'Dashboard',
    nav_hospital: 'Hospital',
    nav_about: 'About',
    nav_logout: 'Logout',
    btn_dark_mode: 'Dark Mode',
    btn_send: 'Send',
    btn_search: 'Search',
    btn_clear_data: 'Wipe All Data',
    btn_use_current_location: 'Use Current Location',
    btn_request_blood: 'Request Blood',
    btn_accept: 'Accept Request',
    btn_reject: 'Reject Request',
    btn_get_directions: 'Get Directions',
    btn_call: 'Call',
    btn_copy: 'Copy Number',
    btn_save: 'Save',
    nearby: 'Nearby Donor',
    other: 'Other Location',
    eligible: 'Eligible to donate',
    no_results: 'No available donors found.',
    loading_db: 'Loading Database Status...',
    login_title: 'Donor Login',
    login_subtitle: 'Premium access to your donor identity and response tools.',
    login_heading: 'Secure Donor Login',
    login_help: 'Use your registered phone and blood group to continue.',
    signup_title: 'Create Donor Account',
    signup_subtitle: 'Join a premium donor network built for emergency speed.',
    signup_heading: 'Create Your Donor Profile',
    hospital_login_title: 'Hospital Login',
    hospital_signup_title: 'Hospital Registration',
    request_blood: 'Request Blood',
    received_requests: 'Received Requests'
  };

  let current = localStorage.getItem('lang') || DEFAULT_LANG;
  let dict = { ...fallback };

  function normalize(lang) {
    const l = String(lang || '').toLowerCase();
    return SUPPORTED.includes(l) ? l : DEFAULT_LANG;
  }

  function tr(key) {
    return dict[key] || fallback[key] || key;
  }

  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}/${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Language request failed');
    return data;
  }

  async function fetchLanguage(lang) {
    const data = await api(`lang.php?lang=${encodeURIComponent(lang)}`, { method: 'GET' });
    dict = { ...fallback, ...(data.translations || {}) };
    current = normalize(data.lang || lang);
    localStorage.setItem('lang', current);
    if (typeof window.setLanguage === 'function') {
      window.setLanguage(current);
    }
  }

  function setText(selector, key) {
    const el = document.querySelector(selector);
    if (el) el.textContent = tr(key);
  }

  function applyPageTranslations() {
    document.documentElement.lang = current;

    setText('nav a[href="index.html"]', 'nav_home');
    setText('nav a[href="signup.html"]', 'nav_donor_signup');
    setText('nav a[href="login.html"]', 'nav_donor_login');
    setText('nav a[href="hospital-signup.html"]', 'nav_hospital_signup');
    setText('nav a[href="hospital-login.html"]', 'nav_hospital_login');
    setText('nav a[href="search.html"]', 'nav_find_donor');
    setText('nav a[href="dashboard.html"]', 'nav_dashboard');
    setText('nav a[href="hospital.html"]', 'nav_hospital');
    setText('nav a[href="contact.html"]', 'nav_about');
    setText('#logout-link', 'nav_logout');

    const darkBtn = document.querySelector('button[onclick="toggleDarkMode()"]');
    if (darkBtn) darkBtn.textContent = tr('btn_dark_mode');
    const chatSend = document.getElementById('chat-send');
    if (chatSend) chatSend.textContent = tr('btn_send');

    const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

    if (page === 'login.html') {
      setText('header h1', 'login_title');
      setText('header p', 'login_subtitle');
      setText('.container h2', 'login_heading');
      setText('.container .page-subtext', 'login_help');
      setText('button[onclick="loginDonor()"]', 'nav_donor_login');
    }

    if (page === 'signup.html' || page === 'register.html') {
      setText('header h1', 'signup_title');
      setText('header p', 'signup_subtitle');
      setText('.container h2', 'signup_heading');
    }

    if (page === 'hospital-login.html') {
      setText('header h1', 'hospital_login_title');
      setText('button[onclick="hospitalLogin()"]', 'nav_hospital_login');
    }

    if (page === 'hospital-signup.html') {
      setText('header h1', 'hospital_signup_title');
      setText('button[onclick="hospitalRegister()"]', 'nav_hospital_signup');
    }

    if (page === 'hospital.html') {
      const firstPanelHeading = document.querySelector('.hospital-grid .panel-block h3');
      if (firstPanelHeading) firstPanelHeading.textContent = tr('request_blood');
      setText('button[onclick="requestBloodNow()"]', 'btn_request_blood');
      setText('button[onclick="captureHospitalLocation()"]', 'btn_use_current_location');
    }

    if (page === 'dashboard.html') {
      const firstReqHeading = document.querySelector('section.panel-block h3');
      if (firstReqHeading) firstReqHeading.textContent = tr('received_requests');
    }

    if (page === 'search.html') {
      setText('button[onclick="findDonors()"]', 'btn_search');
      const wipe = document.querySelector('button[onclick="clearAllData()"]');
      if (wipe) wipe.textContent = tr('btn_clear_data');
    }

    const donorCount = document.getElementById('donor-count');
    if (donorCount && donorCount.textContent.includes('Loading')) {
      donorCount.textContent = tr('loading_db');
    }
  }

  function ensureSwitcher() {
    let host = document.querySelector('header .toggles');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toggles';
      const header = document.querySelector('header');
      if (header) header.appendChild(host);
    }

    let wrap = document.querySelector('.lang-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'lang-wrap';
      host.appendChild(wrap);
    }

    let label = document.getElementById('global-language-label');
    if (!label) {
      label = document.createElement('label');
      label.setAttribute('for', 'global-language-select');
      label.id = 'global-language-label';
      wrap.appendChild(label);
    }
    label.textContent = tr('language_label');

    let sel = document.getElementById('global-language-select');
    if (!sel) {
      sel = document.createElement('select');
      sel.id = 'global-language-select';
      sel.className = 'lang-select';
      sel.addEventListener('change', async (e) => {
        const lang = normalize(e.target.value);
        localStorage.setItem('lang', lang);
        try {
          await api('lang.php', {
            method: 'POST',
            body: JSON.stringify({ lang })
          });
        } catch (err) {
        }
        await fetchLanguage(lang);
        applyPageTranslations();
        ensureSwitcher();
      });
      wrap.appendChild(sel);
    }

    sel.innerHTML = `
      <option value="en">${tr('lang_english')}</option>
      <option value="te">${tr('lang_telugu')}</option>
      <option value="hi">${tr('lang_hindi')}</option>
    `;
    sel.value = current;
  }

  async function initI18n() {
    current = normalize(localStorage.getItem('lang') || DEFAULT_LANG);
    try {
      await fetchLanguage(current);
    } catch (err) {
      current = DEFAULT_LANG;
      localStorage.setItem('lang', current);
      if (typeof window.setLanguage === 'function') {
        window.setLanguage(current);
      }
    }

    applyPageTranslations();
    ensureSwitcher();

    window.__i18n = {
      lang: () => current,
      t: tr,
      apply: applyPageTranslations
    };
  }

  document.addEventListener('DOMContentLoaded', initI18n);
})();

