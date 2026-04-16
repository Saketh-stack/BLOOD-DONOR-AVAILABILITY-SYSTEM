/*
  Blood Donor Availability System - Core Logic
*/

const translations = {
  en: {
    nearby: 'Nearby Donor',
    other: 'Other Location',
    eligible: 'Eligible to donate',
    not_eligible: 'Wait {days} days to donate',
    call: 'Call',
    copy: 'Copy Number',
    save: 'Save'
  },
  te: {
    nearby: '???? ???',
    other: '??? ??????',
    eligible: '???????? ????????',
    not_eligible: '{days} ????? ?????? ???????? ??????',
    call: '????',
    copy: '????? ????',
    save: '????'
  },
  hi: {
    nearby: '??????? ????',
    other: '???? ?????',
    eligible: '??????? ?? ??? ?????',
    not_eligible: '{days} ????? ??? ??????? ????',
    call: '???',
    copy: '???? ???? ????',
    save: '??? ????'
  }
};

let currentLanguage = localStorage.getItem('lang') || 'en';
if (!(translations[currentLanguage] || translations.en)) currentLanguage = 'en';
const API_BASE = (window.location.port === '5500' || window.location.port === '5501' || window.location.protocol === 'file:') ? 'http://localhost/wps%202/wps/api' : './api';

let hospitalPollTimer = null;
let donorChatPollTimer = null;
let hospitalChatPollTimer = null;
let donorRequestPollTimer = null;
let donorLocationWatchId = null;
let donorLiveRequestId = null;
let hospitalTrackingPollTimer = null;
let hospitalGeo = { latitude: null, longitude: null };
let googleMapsLoadPromise = null;
const hospitalMapState = { map: null, markers: [], directionsService: null, directionsRenderer: null };

function setLanguage(lang) {
  currentLanguage = translations[lang] ? lang : 'en';
  localStorage.setItem('lang', currentLanguage);
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', String(isDark));
}

if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}/${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

async function getDonors({ bloodGroup = '', city = '', availableOnly = false } = {}) {
  const params = new URLSearchParams();
  if (bloodGroup) params.set('blood_group', bloodGroup);
  if (city) params.set('city', city);
  if (availableOnly) params.set('available_only', '1');

  const data = await apiRequest(`donors.php?${params.toString()}`, { method: 'GET' });
  return data.donors || [];
}

async function getPendingRequests(bloodGroup = '') {
  const params = new URLSearchParams();
  if (bloodGroup) params.set('blood_group', bloodGroup);
  const result = await apiRequest(`requests.php?${params.toString()}`, { method: 'GET' });
  return result.requests || [];
}

function getFavorites() {
  return JSON.parse(localStorage.getItem('favorites') || '[]');
}

function saveFavorites(favorites) {
  localStorage.setItem('favorites', JSON.stringify(favorites));
}

async function saveDonor() {
  const name = document.getElementById('name')?.value?.trim() || '';
  const dobInput = document.getElementById('dob')?.value || '';
  const ageInput = (document.getElementById('age')?.value || '').trim();
  let dob = dobInput;
  if (!dob && ageInput) {
    const ageNum = Number.parseInt(ageInput, 10);
    if (!Number.isNaN(ageNum) && ageNum > 0) {
      const now = new Date();
      const year = now.getFullYear() - ageNum;
      dob = `${year}-01-01`;
    }
  }

  const gender = document.getElementById('gender')?.value || '';
  const bloodGroup = document.getElementById('blood-group')?.value || '';
  const city = document.getElementById('city')?.value?.trim() || '';
  const address = document.getElementById('address')?.value?.trim() || '';
  const phone = document.getElementById('phone')?.value?.trim() || '';
  const lastDonation = document.getElementById('last-donation')?.value || '';
  const availability = document.getElementById('availability')?.value || 'Available';

  if (!name || !dob || !gender || !bloodGroup || !city || !phone || !lastDonation) {
    alert('Please fill all required fields!');
    return;
  }

  const digits = (phone || '').replace(/\D+/g, '');
  if (digits.length < 10) {
    alert('Please enter a valid phone number.');
    return;
  }

  try {
    await apiRequest('register.php', {
      method: 'POST',
      body: JSON.stringify({
        name,
        dob,
        gender,
        bloodGroup,
        city,
        address,
        phone,
        lastDonation,
        availability
      })
    });

    alert('Success! Registration complete.');
    const form = document.getElementById('registration-form');
    if (form) form.reset();
  } catch (error) {
    alert(error.message || 'Registration failed.');
  }
}
function calculateEligibility(lastDate) {
  if (!lastDate) return { eligible: true };

  const last = new Date(lastDate);
  if (Number.isNaN(last.getTime())) return { eligible: true };

  const today = new Date();
  const diffTime = Math.abs(today - last);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const waitDays = 90 - diffDays;

  if (waitDays <= 0) return { eligible: true };
  return { eligible: false, days: waitDays };
}

async function findDonors() {
  const resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) return;

  const searchBG = document.getElementById('search-blood-group')?.value || '';
  const searchCity = (document.getElementById('search-location')?.value || '').toLowerCase().trim();

  let filtered = [];
  try {
    filtered = await getDonors({
      bloodGroup: searchBG,
      city: searchCity,
      availableOnly: true
    });
  } catch (error) {
    resultsContainer.innerHTML = `<p class="no-results">${error.message || 'Unable to load donors.'}</p>`;
    return;
  }

  resultsContainer.innerHTML = '';

  if (filtered.length === 0) {
    resultsContainer.innerHTML = '<p class="no-results">No available donors found.</p>';
  } else {
    filtered.forEach((d) => {
      const eligibility = calculateEligibility(d.lastDonation);
      const isNearby = searchCity !== '' && String(d.city || '').toLowerCase().includes(searchCity);

      const card = document.createElement('div');
      card.className = 'donor-card';
      card.innerHTML = `
        <div class="badge ${isNearby ? 'badge-nearby' : 'badge-other'}">
          ${isNearby ? (translations[currentLanguage] || translations.en).nearby : (translations[currentLanguage] || translations.en).other}
        </div>
        <div class="badge badge-bronze">${d.badge || 'Donor'}</div>
        <h3>${d.name} <span class="blood-group-tag">${d.bloodGroup}</span></h3>
        <p>Location: ${d.city || '-'}</p>
        <p style="color: ${eligibility.eligible ? 'green' : 'orange'}">
          Status: ${eligibility.eligible ? (translations[currentLanguage] || translations.en).eligible : (translations[currentLanguage] || translations.en).not_eligible.replace('{days}', String(eligibility.days))}
        </p>
        <div class="action-buttons">
          <a href="tel:${d.phone}" class="btn-small">${(translations[currentLanguage] || translations.en).call}</a>
          <button class="btn-small" onclick="copyNumber('${d.phone}')">${(translations[currentLanguage] || translations.en).copy}</button>
          <button class="btn-small btn-fav" onclick="toggleFavorite(${d.id})">${(translations[currentLanguage] || translations.en).save}</button>
        </div>
      `;
      resultsContainer.appendChild(card);
    });
  }

  updateStatsOnSearch();
}

function copyNumber(num) {
  navigator.clipboard.writeText(num || '');
  alert('Phone number copied to clipboard!');
}

async function toggleFavorite(id) {
  const favorites = getFavorites();
  const donors = await getDonors();
  const donor = donors.find((d) => Number(d.id) === Number(id));

  if (favorites.find((f) => Number(f.id) === Number(id))) {
    alert('Already in favorites!');
    return;
  }

  if (!donor) {
    alert('Donor not found.');
    return;
  }

  favorites.push(donor);
  saveFavorites(favorites);
  alert('Added to favorites!');
}

async function updateDashboard() {
  let donors = [];
  const favs = getFavorites();

  try {
    donors = await getDonors();
  } catch (error) {
    donors = [];
  }

  const totalEl = document.getElementById('total-donors-val');
  if (totalEl) totalEl.innerText = String(donors.length);

  const bgCounts = {};
  donors.forEach((d) => {
    bgCounts[d.bloodGroup] = (bgCounts[d.bloodGroup] || 0) + 1;
  });

  const statsList = document.getElementById('bg-stats-list');
  if (statsList) {
    statsList.innerHTML = '';
    Object.keys(bgCounts).forEach((bg) => {
      const li = document.createElement('li');
      li.innerText = `${bg}: ${bgCounts[bg]}`;
      statsList.appendChild(li);
    });
    if (!Object.keys(bgCounts).length) {
      statsList.innerHTML = '<li>No data available</li>';
    }
  }

  const favSection = document.getElementById('favorites-list');
  if (favSection) {
    favSection.innerHTML = '';
    if (favs.length === 0) favSection.innerHTML = '<li>No favorites saved yet.</li>';
    favs.forEach((f) => {
      const li = document.createElement('li');
      li.innerText = `${f.name} (${f.bloodGroup}) - ${f.city}`;
      favSection.appendChild(li);
    });
  }

  const donor = getCurrentDonor();
  const pendingEl = document.getElementById('pending-requests-val');
  const matchedEl = document.getElementById('matched-blood-val');

  if (pendingEl || matchedEl) {
    try {
      const allPending = await getPendingRequests('');
      const matched = donor ? await getPendingRequests(donor.bloodGroup || '') : [];
      if (pendingEl) pendingEl.innerText = String(allPending.length);
      if (matchedEl) matchedEl.innerText = String(matched.length);
    } catch (error) {
      if (pendingEl) pendingEl.innerText = '0';
      if (matchedEl) matchedEl.innerText = '0';
    }
  }
}

async function updateStatsOnSearch() {
  let donors = [];
  try {
    donors = await getDonors();
  } catch (error) {
    donors = [];
  }

  const countEl = document.getElementById('donor-count-search');
  if (countEl) countEl.innerText = String(donors.length);
}

async function updateHomeStats() {
  let donors = [];
  try {
    donors = await getDonors();
  } catch (error) {
    donors = [];
  }

  const countEl = document.getElementById('donor-count');
  if (countEl) countEl.innerText = `Current Database Size: ${donors.length} Donors`;

  const cardCount = document.getElementById('total-donors-val-home');
  if (cardCount) cardCount.innerText = String(donors.length);
}

function toggleChatbot() {
  const win = document.getElementById('chatbot-window');
  if (!win) return;
  win.style.display = win.style.display === 'block' ? 'none' : 'block';
}

let chatHistory = [];

function appendChatMessage(role, text) {
  const body = document.getElementById('chat-body');
  if (!body) return;

  const msg = document.createElement('div');
  msg.className = `chat-msg ${role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`;
  msg.innerText = `${role === 'user' ? 'You' : 'Bot'}: ${text}`;
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  appendChatMessage('user', message);

  try {
    const result = await apiRequest('chat.php', {
      method: 'POST',
      body: JSON.stringify({ message, history: chatHistory })
    });

    const reply = String(result.reply || 'No response.');
    appendChatMessage('assistant', reply);

    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 20) {
      chatHistory = chatHistory.slice(chatHistory.length - 20);
    }
  } catch (error) {
    appendChatMessage('assistant', error.message || 'Chatbot failed to respond.');
  }
}

async function triggerSOS() {
  const donor = getCurrentDonor();
  if (!donor) {
    alert('Please login first to use SOS.');
    window.location.href = 'login.html';
    return;
  }

  const city = prompt('Enter location where blood is needed:');
  if (!city) return;

  try {
    const result = await apiRequest('sos.php', {
      method: 'POST',
      body: JSON.stringify({ city: city.trim() })
    });

    const firstError = result.failed && result.failed.length > 0 ? result.failed[0].error : '';
    const msg = `SOS SMS sent. Targeted: ${result.targeted}, Sent: ${result.sent_count}, Failed: ${result.failed_count}.`;
    alert(firstError ? `${msg}\nReason: ${firstError}` : msg);
  } catch (error) {
    alert(error.message || 'Failed to process SOS request.');
  }
}

async function clearAllData() {
  if (!confirm('Clear ALL data including favorites and points?')) return;

  try {
    await apiRequest('clear.php', { method: 'POST' });
    localStorage.removeItem('favorites');
    location.reload();
  } catch (error) {
    alert(error.message || 'Unable to clear data.');
  }
}

async function loginDonor() {
  const phone = document.getElementById('login-phone')?.value?.trim() || '';
  const bloodGroup = document.getElementById('login-blood-group')?.value || '';

  if (!phone || !bloodGroup) {
    alert('Please enter both phone number and blood group.');
    return;
  }

  try {
    const result = await apiRequest('login.php', {
      method: 'POST',
      body: JSON.stringify({ phone, bloodGroup })
    });

    localStorage.setItem('currentDonor', JSON.stringify(result.donor));
    localStorage.removeItem('currentHospital');

    const status = document.getElementById('login-status');
    if (status) {
      status.innerText = `Logged in as ${result.donor.name} (${result.donor.bloodGroup})`;
    }

    alert(`Login successful. Welcome, ${result.donor.name}!`);
    applyAuthAccess();
    window.location.href = 'index.html';
  } catch (error) {
    alert(error.message || 'Login failed.');
  }
}

async function hospitalRegister() {
  const hospitalName = document.getElementById('hospital-name')?.value?.trim() || '';
  const location = document.getElementById('hospital-location')?.value?.trim() || '';
  const password = document.getElementById('hospital-password')?.value || '';

  if (!hospitalName || !location || !password) {
    alert('Please enter hospital name, location and password.');
    return;
  }

  try {
    await apiRequest('hospital_register.php', {
      method: 'POST',
      body: JSON.stringify({ hospitalName, location, password })
    });

    alert('Hospital account created successfully. Please login.');
    const form = document.getElementById('hospital-signup-form');
    if (form) form.reset();
    window.location.href = 'hospital-login.html';
  } catch (error) {
    alert(error.message || 'Hospital registration failed.');
  }
}

async function hospitalLogin() {
  const hospitalName = document.getElementById('hospital-login-name')?.value?.trim() || '';
  const location = document.getElementById('hospital-login-location')?.value?.trim() || '';
  const password = document.getElementById('hospital-login-password')?.value || '';

  if (!hospitalName || !location || !password) {
    alert('Please enter hospital name, location and password.');
    return;
  }

  try {
    const result = await apiRequest('hospital_login.php', {
      method: 'POST',
      body: JSON.stringify({ hospitalName, location, password })
    });

    localStorage.setItem('currentHospital', JSON.stringify(result.hospital));
    localStorage.removeItem('currentDonor');

    alert(`Hospital login successful. Welcome, ${result.hospital.hospitalName}!`);
    applyAuthAccess();
    window.location.href = 'hospital.html';
  } catch (error) {
    alert(error.message || 'Hospital login failed.');
  }
}
function getCurrentDonor() {
  try {
    return JSON.parse(localStorage.getItem('currentDonor') || 'null');
  } catch (e) {
    return null;
  }
}

function getCurrentHospital() {
  try {
    return JSON.parse(localStorage.getItem('currentHospital') || 'null');
  } catch (e) {
    return null;
  }
}
function getCurrentPageName() {
  const path = window.location.pathname || '';
  const page = path.split('/').pop();
  return (page || 'index.html').toLowerCase();
}

function enforceLoginGate() {
  const donor = getCurrentDonor();
  const hospital = getCurrentHospital();
  const page = getCurrentPageName();

  const donorPublicPages = ['login.html', 'signup.html', 'register.html'];
  const hospitalPublicPages = ['hospital-login.html', 'hospital-signup.html'];
  const publicPages = donorPublicPages.concat(hospitalPublicPages);

  if (page === 'hospital.html') {
    if (!hospital) {
      window.location.href = 'hospital-login.html';
      return false;
    }
    return true;
  }

  if (!donor && !hospital && !publicPages.includes(page)) {
    window.location.href = 'login.html';
    return false;
  }

  if (donor && donorPublicPages.includes(page)) {
    window.location.href = 'index.html';
    return false;
  }
  if (donor && hospitalPublicPages.includes(page)) {
    window.location.href = 'index.html';
    return false;
  }

  if (hospital && donorPublicPages.includes(page)) {
    window.location.href = 'hospital.html';
    return false;
  }

  if (hospital && hospitalPublicPages.includes(page)) {
    window.location.href = 'hospital.html';
    return false;
  }

  return true;
}

function logoutSession() {
  localStorage.removeItem('currentDonor');
  localStorage.removeItem('currentHospital');
  window.location.href = 'login.html';
}

function applyAuthAccess() {
  const donor = getCurrentDonor();
  const hospital = getCurrentHospital();
  const nav = document.querySelector('nav');
  if (!nav) return;

  const isAuthed = Boolean(donor || hospital);
  const links = nav.querySelectorAll('a');

  links.forEach((link) => {
    const href = (link.getAttribute('href') || '').toLowerCase();
    const donorAuthLinks = href === 'login.html' || href === 'signup.html' || href === 'register.html';
    const hospitalAuthLinks = href === 'hospital-login.html' || href === 'hospital-signup.html';

    if (!isAuthed) {
      const showBeforeLogin = donorAuthLinks || hospitalAuthLinks;
      link.style.display = showBeforeLogin ? '' : 'none';
      return;
    }

    if (donor) {
      if (donorAuthLinks || hospitalAuthLinks) {
        link.style.display = 'none';
      } else if (href === 'hospital.html') {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
      return;
    }

    if (hospital) {
      link.style.display = href === 'hospital.html' ? '' : 'none';
    }
  });

  let logoutLink = document.getElementById('logout-link');
  if (isAuthed) {
    if (!logoutLink) {
      logoutLink = document.createElement('a');
      logoutLink.id = 'logout-link';
      logoutLink.href = '#';
      logoutLink.textContent = 'Logout';
      logoutLink.onclick = (e) => {
        e.preventDefault();
        logoutSession();
      };
      nav.appendChild(logoutLink);
    }
  } else if (logoutLink) {
    logoutLink.remove();
  }
}

function fmtDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function renderChatFeed(elementId, messages) {
  const feed = document.getElementById(elementId);
  if (!feed) return;

  if (!messages.length) {
    feed.innerHTML = '<p class="muted">No messages yet.</p>';
    return;
  }

  feed.innerHTML = messages
    .map((m) => `<div class="chat-line"><strong>${m.sender_role} - ${m.sender_name}</strong><span class="chat-time">${fmtDateTime(m.sent_at)}</span><div>${m.message}</div></div>`)
    .join('');

  feed.scrollTop = feed.scrollHeight;
}

async function initDonorLiveChat() {
  const select = document.getElementById('donor-request-select');
  if (!select) return;

  const donor = getCurrentDonor();
  if (!donor) return;

  try {
    const requests = await getPendingRequests(donor.bloodGroup || '');
    select.innerHTML = '<option value="">Select an emergency request</option>';

    requests.forEach((r) => {
      const opt = document.createElement('option');
      opt.value = String(r.request_id);
      opt.textContent = `#${r.request_id} ${r.blood_group} | ${r.location} | ${r.urgency_level}`;
      select.appendChild(opt);
    });

    const matchedEl = document.getElementById('matched-blood-val');
    if (matchedEl) matchedEl.innerText = String(requests.length);

    if (requests.length > 0 && !select.value) {
      select.value = String(requests[0].request_id);
      await loadDonorChatMessages();
    }
  } catch (error) {
    const feed = document.getElementById('donor-chat-feed');
    if (feed) feed.innerHTML = `<p class="muted">${error.message || 'Unable to load requests.'}</p>`;
  }

  if (donorChatPollTimer) clearInterval(donorChatPollTimer);
  donorChatPollTimer = setInterval(loadDonorChatMessages, 4000);
}

async function loadDonorChatMessages() {
  const requestId = Number(document.getElementById('donor-request-select')?.value || 0);
  if (!requestId) return;

  try {
    const data = await apiRequest(`live_chat.php?request_id=${requestId}`, { method: 'GET' });
    renderChatFeed('donor-chat-feed', data.messages || []);
  } catch (error) {
    const feed = document.getElementById('donor-chat-feed');
    if (feed) feed.innerHTML = `<p class="muted">${error.message || 'Unable to load chat.'}</p>`;
  }
}

async function sendDonorLiveMessage() {
  const donor = getCurrentDonor();
  if (!donor) return;

  const requestId = Number(document.getElementById('donor-request-select')?.value || 0);
  const input = document.getElementById('donor-chat-input');
  const message = input?.value?.trim() || '';

  if (!requestId || !message) {
    alert('Please select a request and type a message.');
    return;
  }

  try {
    await apiRequest('live_chat.php', {
      method: 'POST',
      body: JSON.stringify({
        requestId,
        senderRole: 'donor',
        senderName: donor.name || 'Donor',
        message
      })
    });

    input.value = '';
    await loadDonorChatMessages();
  } catch (error) {
    alert(error.message || 'Unable to send message.');
  }
}

function getFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function setupCanvas2D(canvas, height = 220) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const cssWidth = Math.max(320, canvas.clientWidth || canvas.width || 640);
  const cssHeight = Math.max(180, height || canvas.clientHeight || 220);

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  return { ctx, width: cssWidth, height: cssHeight };
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBarChart(canvasId, labels, values, title, barColor = '#e7c06a') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const setup = setupCanvas2D(canvas, 230);
  if (!setup) return;

  const { ctx, width, height } = setup;

  const safeLabels = Array.isArray(labels) ? labels.map((l) => String(l || 'Unknown')) : [];
  const safeValues = Array.isArray(values) ? values.map(getFiniteNumber) : [];
  const pointCount = Math.min(safeLabels.length, safeValues.length);

  ctx.clearRect(0, 0, width, height);

  const headerH = 28;
  const padX = 18;
  const padBottom = pointCount > 6 ? 44 : 34;
  const chartX = padX;
  const chartY = headerH + 8;
  const chartW = Math.max(10, width - padX * 2);
  const chartH = Math.max(70, height - chartY - padBottom);

  ctx.fillStyle = '#f3f4f6';
  ctx.font = '600 13px Segoe UI';
  ctx.fillText(title || 'Chart', padX, 18);

  if (!pointCount) {
    ctx.fillStyle = '#8b8b8b';
    ctx.font = '12px Segoe UI';
    ctx.fillText('No data available', padX, 46);
    return;
  }

  const maxVal = Math.max(1, ...safeValues.slice(0, pointCount));
  const steps = 4;

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= steps; i += 1) {
    const y = chartY + (chartH * i) / steps;
    ctx.beginPath();
    ctx.moveTo(chartX, y);
    ctx.lineTo(chartX + chartW, y);
    ctx.stroke();
  }

  const slotW = chartW / pointCount;
  const barW = Math.max(16, Math.min(52, slotW * 0.64));

  for (let i = 0; i < pointCount; i += 1) {
    const value = safeValues[i];
    const ratio = Math.max(0, Math.min(1, value / maxVal));
    const barH = Math.max(1, Math.round((chartH - 8) * ratio));
    const x = chartX + i * slotW + (slotW - barW) / 2;
    const y = chartY + chartH - barH;

    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, barColor);
    grad.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = grad;
    drawRoundedRect(ctx, x, y, barW, barH, 7);
    ctx.fill();

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '600 11px Segoe UI';
    const valText = String(Math.round(value));
    const tw = ctx.measureText(valText).width;
    ctx.fillText(valText, x + (barW - tw) / 2, y - 6);

    const rawLabel = safeLabels[i] || 'Unknown';
    const maxChars = pointCount > 6 ? 14 : 16;
    const label = rawLabel.length > maxChars ? `${rawLabel.slice(0, maxChars)}...` : rawLabel;

    ctx.fillStyle = '#c2c7d0';
    ctx.font = '11px Segoe UI';
    const lx = x + barW / 2;
    const ly = chartY + chartH + 12;

    if (pointCount > 5) {
      ctx.save();
      ctx.translate(lx, ly + 8);
      ctx.rotate(-Math.PI / 4);
      ctx.textAlign = 'right';
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.textAlign = 'left';
    } else {
      const lw = ctx.measureText(label).width;
      ctx.fillText(label, lx - lw / 2, ly + 8);
    }
  }
}

function renderHospitalTables(donors, requests) {
  const donorBody = document.querySelector('#hospital-donor-table tbody');
  if (donorBody) {
    donorBody.innerHTML = donors
      .map((d) => {
        const avail = String(d.availability || '') === 'Available';
        return `<tr>
          <td>${d.name || '-'}</td>
          <td>${d.blood_group || '-'}</td>
          <td>${d.contact || '-'}</td>
          <td>${d.location || '-'}</td>
          <td><span class="status-pill ${avail ? 'status-available' : 'status-unavailable'}">${d.availability || '-'}</span></td>
        </tr>`;
      })
      .join('');

    if (!donors.length) donorBody.innerHTML = '<tr><td colspan="5">No donor data</td></tr>';
  }

  const reqBody = document.querySelector('#hospital-request-table tbody');
  if (reqBody) {
    reqBody.innerHTML = requests
      .map((r) => {
        const pending = String(r.status || '') === 'Pending';
        return `<tr>
          <td>#${r.request_id}</td>
          <td>${r.patient_name || '-'}</td>
          <td>${r.blood_group || '-'}</td>
          <td>${r.urgency_level || '-'}</td>
          <td>${r.location || '-'}</td>
          <td><span class="status-pill ${pending ? 'status-pending' : 'status-fulfilled'}">${r.status || '-'}</span></td>
          <td>${r.message_count || 0}</td>
        </tr>`;
      })
      .join('');

    if (!requests.length) reqBody.innerHTML = '<tr><td colspan="7">No requests yet</td></tr>';
  }
}

function updateHospitalCards(summary) {
  const totalEl = document.getElementById('hospital-total-donors');
  const availableEl = document.getElementById('hospital-available-donors');
  const pendingEl = document.getElementById('hospital-pending-requests');
  const highEl = document.getElementById('hospital-high-urgency');

  if (totalEl) totalEl.innerText = String(summary.totalDonors || 0);
  if (availableEl) availableEl.innerText = String(summary.availability?.available || 0);
  if (pendingEl) pendingEl.innerText = String(summary.requests?.pending || 0);
  if (highEl) highEl.innerText = String(summary.requests?.highUrgency || 0);
}

function fillHospitalRequestSelect(requests) {
  const select = document.getElementById('hospital-request-select');
  if (!select) return;

  const previous = select.value;
  select.innerHTML = '<option value="">Select request to open chat</option>';

  requests.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = String(r.request_id);
    opt.textContent = `#${r.request_id} ${r.blood_group} | ${r.location} | ${r.urgency_level}`;
    select.appendChild(opt);
  });

  if (previous && [...select.options].some((o) => o.value === previous)) {
    select.value = previous;
  } else if (requests.length > 0) {
    select.value = String(requests[0].request_id);
  }
}

async function refreshHospitalDashboard() {
  const data = await apiRequest('hospital_dashboard.php', { method: 'GET' });
  const donors = data.donors || [];
  const requests = data.requests || [];
  const summary = data.summary || {};

  updateHospitalCards(summary);
  renderHospitalTables(donors, requests);
  fillHospitalRequestSelect(requests);

  try {
    drawBarChart(
      'availability-chart',
      ['Available', 'Not Available', 'Pending Requests', 'High Urgency'],
      [
        Number(summary.availability?.available || 0),
        Number(summary.availability?.notAvailable || 0),
        Number(summary.requests?.pending || 0),
        Number(summary.requests?.highUrgency || 0)
      ],
      'Decision Chart: Availability vs Request Pressure',
      '#e7c06a'
    );

    const mergedLocations = new Map();
    Object.entries(summary.topLocations || {}).forEach(([name, count]) => {
      const clean = String(name || 'Unknown').replace(/\s+/g, ' ').trim();
      const key = clean.toLowerCase();
      const prev = Number(mergedLocations.get(key)?.count || 0);
      const next = prev + Number(count || 0);
      mergedLocations.set(key, { label: clean, count: next });
    });

    const locEntries = Array.from(mergedLocations.values())
      .map((item) => [item.label, item.count])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    drawBarChart(
      'location-chart',
      locEntries.map((entry) => entry[0]),
      locEntries.map((entry) => entry[1]),
      'Donor Location Distribution (Top Cities)',
      '#7db6ff'
    );
  } catch (error) {
    console.error('Chart render failed:', error);
  }

  await loadHospitalChatMessages();
}

async function initHospitalDashboard() {
  try {
    await refreshHospitalDashboard();
  } catch (error) {
    alert(error.message || 'Unable to load hospital dashboard.');
  }

  if (hospitalPollTimer) clearInterval(hospitalPollTimer);
  hospitalPollTimer = setInterval(() => {
    refreshHospitalDashboard().catch(() => {});
  }, 8000);

  if (hospitalChatPollTimer) clearInterval(hospitalChatPollTimer);
  hospitalChatPollTimer = setInterval(loadHospitalChatMessages, 4000);
}

async function createEmergencyRequest() {
  const name = document.getElementById('req-patient-name')?.value?.trim() || '';
  const phone = document.getElementById('req-phone')?.value?.trim() || '';
  const bloodGroup = document.getElementById('req-blood-group')?.value || '';
  const location = document.getElementById('req-location')?.value?.trim() || '';
  const urgency = document.getElementById('req-urgency')?.value || 'High';
  const message = document.getElementById('req-initial-message')?.value?.trim() || '';

  if (!name || !bloodGroup || !location) {
    alert('Patient name, blood group and location are required.');
    return;
  }

  try {
    const result = await apiRequest('create_request.php', {
      method: 'POST',
      body: JSON.stringify({ name, phone, bloodGroup, location, urgency, message })
    });

    alert(`Request created successfully. Request ID: ${result.request?.requestId || ''}`);

    const ids = ['req-patient-name', 'req-phone', 'req-location', 'req-initial-message'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const bg = document.getElementById('req-blood-group');
    if (bg) bg.value = '';
    const urg = document.getElementById('req-urgency');
    if (urg) urg.value = 'High';

    await refreshHospitalDashboard();
  } catch (error) {
    alert(error.message || 'Unable to create request.');
  }
}

async function loadHospitalChatMessages() {
  const requestId = Number(document.getElementById('hospital-request-select')?.value || 0);
  if (!requestId) return;

  try {
    const result = await apiRequest(`live_chat.php?request_id=${requestId}`, { method: 'GET' });
    renderChatFeed('hospital-chat-feed', result.messages || []);
  } catch (error) {
    const feed = document.getElementById('hospital-chat-feed');
    if (feed) feed.innerHTML = `<p class="muted">${error.message || 'Unable to load chat.'}</p>`;
  }
}

async function sendHospitalLiveMessage() {
  const requestId = Number(document.getElementById('hospital-request-select')?.value || 0);
  const senderRole = document.getElementById('hospital-sender-role')?.value || 'hospital';
  const senderName = document.getElementById('hospital-sender-name')?.value?.trim() || 'Hospital Team';
  const input = document.getElementById('hospital-chat-input');
  const message = input?.value?.trim() || '';

  if (!requestId || !message) {
    alert('Please select request and type a message.');
    return;
  }

  try {
    await apiRequest('live_chat.php', {
      method: 'POST',
      body: JSON.stringify({ requestId, senderRole, senderName, message })
    });

    input.value = '';
    await loadHospitalChatMessages();
  } catch (error) {
    alert(error.message || 'Unable to send message.');
  }
}

async function captureHospitalLocation() {
  const status = document.getElementById('hospital-location-status');
  if (!navigator.geolocation) {
    if (status) status.innerText = 'Geolocation is not supported on this browser.';
    return;
  }

  if (status) status.innerHTML = '<span class="loading-inline"><span class="loading-dot"></span>Capturing hospital location...</span>';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      hospitalGeo.latitude = Number(position.coords.latitude || 0);
      hospitalGeo.longitude = Number(position.coords.longitude || 0);
      if (status) {
        status.innerText = `Location captured: ${hospitalGeo.latitude.toFixed(5)}, ${hospitalGeo.longitude.toFixed(5)}`;
      }
    },
    (err) => {
      if (status) status.innerText = `Location access failed: ${err.message}`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

async function requestBloodNow() {
  const hospital = getCurrentHospital();
  if (!hospital) {
    alert('Please login as hospital first.');
    window.location.href = 'hospital-login.html';
    return;
  }

  const bloodGroup = document.getElementById('hospital-blood-group')?.value || '';
  const location = document.getElementById('hospital-request-location')?.value?.trim() || '';
  const urgencyLevel = document.getElementById('hospital-urgency')?.value || 'High';

  if (!bloodGroup || !location) {
    alert('Please select blood group and enter location.');
    return;
  }

  try {
    const result = await apiRequest('blood_request_create.php', {
      method: 'POST',
      body: JSON.stringify({
        hospitalId: hospital.id,
        bloodGroup,
        location,
        urgencyLevel,
        hospitalLatitude: hospitalGeo.latitude,
        hospitalLongitude: hospitalGeo.longitude
      })
    });

    alert(`Request sent successfully. Targeted donors: ${result.targetedDonors}`);

    const bg = document.getElementById('hospital-blood-group');
    const loc = document.getElementById('hospital-request-location');
    const urg = document.getElementById('hospital-urgency');
    if (bg) bg.value = '';
    if (loc) loc.value = '';
    if (urg) urg.value = 'High';

    await loadHospitalTracking();
  } catch (error) {
    alert(error.message || 'Unable to create blood request.');
  }
}

function renderHospitalActiveRequests(requests) {
  const wrap = document.getElementById('hospital-active-requests');
  if (!wrap) return;

  if (!requests.length) {
    wrap.innerHTML = '<p class="muted">No active blood requests yet.</p>';
    return;
  }

  wrap.innerHTML = requests.map((r) => `
    <div class="request-card">
      <h4>Request #${r.id} (${r.blood_group})</h4>
      <div class="request-meta">
        <div><strong>Location:</strong> ${r.location}</div>
        <div><strong>Urgency:</strong> ${r.urgency_level}</div>
        <div><strong>Status:</strong> ${r.status}</div>
        <div><strong>Time:</strong> ${fmtDateTime(r.created_at)}</div>
        <div><strong>Targeted:</strong> ${r.targeted_count || 0}, <strong>Accepted:</strong> ${r.accepted_count || 0}, <strong>Pending:</strong> ${r.pending_count || 0}</div>
      </div>
    </div>
  `).join('');
}

function populateHospitalTrackSelect(requests) {
  const select = document.getElementById('hospital-track-request-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select request to track</option>';
  requests.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = String(r.id);
    opt.textContent = `#${r.id} ${r.blood_group} | ${r.location} | ${r.urgency_level}`;
    select.appendChild(opt);
  });

  if (current && [...select.options].some((o) => o.value === current)) {
    select.value = current;
  } else if (requests.length > 0) {
    select.value = String(requests[0].id);
  }
}

function clearHospitalMapMarkers() {
  hospitalMapState.markers.forEach((m) => m.setMap(null));
  hospitalMapState.markers = [];
}

async function ensureGoogleMapsLoaded() {
  if (window.google?.maps) return true;
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = (async () => {
    const keyResp = await apiRequest('maps_key.php', { method: 'GET' });
    const apiKey = String(keyResp.googleMapsApiKey || '').trim();
    if (!apiKey) return false;

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-maps="1"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMaps = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps script.'));
      document.head.appendChild(script);
    });

    return Boolean(window.google?.maps);
  })().catch(() => false);

  return googleMapsLoadPromise;
}

function renderTrackingDonorList(donors) {
  const list = document.getElementById('tracking-donor-list');
  if (!list) return;

  if (!donors.length) {
    list.innerHTML = '<p class="muted">No accepted donors yet for selected request.</p>';
    return;
  }

  list.innerHTML = donors.map((d) => {
    const hasLive = d.latitude !== null && d.longitude !== null;
    const destination = d.hospital_location || '';
    return `
      <div class="tracking-item">
        <div><strong>${d.donor_name}</strong> (${d.donor_phone || '-'})</div>
        <div class="request-meta">City: ${d.donor_city || '-'}</div>
        <div class="request-meta">Live: ${hasLive ? `${Number(d.latitude).toFixed(5)}, ${Number(d.longitude).toFixed(5)}` : 'Waiting for location...'}</div>
        <div class="request-meta">Updated: ${d.updated_at ? fmtDateTime(d.updated_at) : '-'}</div>
        <div class="request-actions">
          <button class="btn-small" onclick="openExternalDirections('${d.latitude ?? ''}','${d.longitude ?? ''}','${d.hospital_latitude ?? ''}','${d.hospital_longitude ?? ''}','${destination.replace(/'/g, '&#39;')}')">Get Directions</button>
        </div>
      </div>
    `;
  }).join('');
}

function openExternalDirections(fromLat, fromLng, toLat, toLng, fallbackAddress = '') {
  if (fromLat && fromLng && toLat && toLng) {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${fromLat},${fromLng}`)}&destination=${encodeURIComponent(`${toLat},${toLng}`)}&travelmode=driving`;
    window.open(url, '_blank');
    return;
  }

  if (fallbackAddress) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackAddress)}`;
    window.open(url, '_blank');
    return;
  }

  alert('Direction coordinates are not available yet.');
}

async function drawHospitalLiveMap(hospitalInfo, donors) {
  const mapEl = document.getElementById('hospital-live-map');
  if (!mapEl) return;

  const loaded = await ensureGoogleMapsLoaded();
  if (!loaded) {
    mapEl.innerHTML = 'Google Maps key not configured. Add key in api/maps.config.php';
    return;
  }

  const hLat = Number(hospitalInfo?.hospital_latitude ?? 0);
  const hLng = Number(hospitalInfo?.hospital_longitude ?? 0);
  const center = (hLat && hLng) ? { lat: hLat, lng: hLng } : { lat: 20.5937, lng: 78.9629 };

  if (!hospitalMapState.map) {
    hospitalMapState.map = new google.maps.Map(mapEl, {
      zoom: (hLat && hLng) ? 11 : 5,
      center
    });
    hospitalMapState.directionsService = new google.maps.DirectionsService();
    hospitalMapState.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: false });
    hospitalMapState.directionsRenderer.setMap(hospitalMapState.map);
  } else {
    hospitalMapState.map.setCenter(center);
  }

  clearHospitalMapMarkers();

  if (hLat && hLng) {
    const hm = new google.maps.Marker({
      map: hospitalMapState.map,
      position: { lat: hLat, lng: hLng },
      title: 'Hospital',
      icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
    });
    hospitalMapState.markers.push(hm);
  }

  const withCoords = donors.filter((d) => d.latitude !== null && d.longitude !== null);
  withCoords.forEach((d) => {
    const marker = new google.maps.Marker({
      map: hospitalMapState.map,
      position: { lat: Number(d.latitude), lng: Number(d.longitude) },
      title: d.donor_name || 'Donor',
      icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
    });
    hospitalMapState.markers.push(marker);
  });

  if (withCoords.length > 0 && hLat && hLng) {
    const first = withCoords[0];
    hospitalMapState.directionsService.route(
      {
        origin: { lat: Number(first.latitude), lng: Number(first.longitude) },
        destination: { lat: hLat, lng: hLng },
        travelMode: google.maps.TravelMode.DRIVING
      },
      (result, status) => {
        if (status === 'OK') {
          hospitalMapState.directionsRenderer.setDirections(result);
        }
      }
    );
  }
}

async function loadHospitalTracking() {
  const hospital = getCurrentHospital();
  if (!hospital) return;

  const loading = document.getElementById('hospital-tracking-loading');
  if (loading) loading.innerHTML = '<span class="loading-inline"><span class="loading-dot"></span>Refreshing requests and tracking...</span>';

  const selectedRequestId = Number(document.getElementById('hospital-track-request-select')?.value || 0);
  const query = selectedRequestId ? `hospital_live_tracking.php?hospital_id=${hospital.id}&request_id=${selectedRequestId}` : `hospital_live_tracking.php?hospital_id=${hospital.id}`;

  try {
    const data = await apiRequest(query, { method: 'GET' });
    const requests = data.requests || [];
    const acceptedDonors = data.acceptedDonors || [];

    renderHospitalActiveRequests(requests);
    populateHospitalTrackSelect(requests);

    const activeRequestId = Number(document.getElementById('hospital-track-request-select')?.value || 0);
    const filteredDonors = activeRequestId ? acceptedDonors.filter((d) => Number(d.request_id) === activeRequestId) : acceptedDonors;
    renderTrackingDonorList(filteredDonors);

    const requestForMap = requests.find((r) => Number(r.id) === activeRequestId) || requests[0] || null;
    await drawHospitalLiveMap(requestForMap, filteredDonors);

    if (loading) loading.innerText = `Tracking updated at ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    if (loading) loading.innerText = error.message || 'Unable to load tracking feed.';
  }
}

function getEligibilityFromDate(lastDonation) {
  if (!lastDonation) {
    return {
      eligible: true,
      daysRemaining: 0,
      nextEligibleDate: '',
      message: 'You are eligible to donate blood now.'
    };
  }

  const last = new Date(lastDonation + 'T00:00:00');
  if (Number.isNaN(last.getTime())) {
    return {
      eligible: true,
      daysRemaining: 0,
      nextEligibleDate: '',
      message: 'You are eligible to donate blood now.'
    };
  }

  const next = new Date(last);
  next.setDate(next.getDate() + 90);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = next.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const eligible = daysRemaining === 0;

  return {
    eligible,
    daysRemaining,
    nextEligibleDate: next.toISOString().slice(0, 10),
    message: eligible
      ? 'You are eligible to donate blood now.'
      : `You cannot donate blood until 90 days are completed. You can donate blood after ${daysRemaining} day(s).`
  };
}

function renderDonorEligibilityBox(data) {
  const box = document.getElementById('donor-eligibility-status');
  const ageEl = document.getElementById('profile-age');
  const nextEl = document.getElementById('profile-next-eligible');
  const daysEl = document.getElementById('profile-days-remaining');

  if (ageEl) ageEl.innerText = data.age != null ? String(data.age) : '-';
  if (nextEl) nextEl.innerText = data.nextEligibleDate || '-';
  if (daysEl) daysEl.innerText = String(data.daysRemaining ?? 0);

  if (!box) return;

  box.classList.remove('eligible', 'not-eligible');
  if (data.eligible) {
    box.classList.add('eligible');
    box.innerText = 'You are eligible to donate blood now.';
  } else {
    box.classList.add('not-eligible');
    box.innerText = `You cannot donate blood until 90 days are completed. You can donate blood after ${data.daysRemaining} day(s).`;
  }
}

async function loadDonorProfile() {
  const donor = getCurrentDonor();
  if (!donor) return;

  try {
    const result = await apiRequest(`donor_profile.php?donor_id=${donor.id}`, { method: 'GET' });
    const d = result.donor || {};

    const phoneEl = document.getElementById('profile-phone');
    const addressEl = document.getElementById('profile-address');
    const lastEl = document.getElementById('profile-last-donation');

    if (phoneEl) phoneEl.value = d.phone || '';
    if (addressEl) addressEl.value = d.address || '';
    if (lastEl) lastEl.value = d.lastDonation || '';

    renderDonorEligibilityBox(d);

    const current = getCurrentDonor() || {};
    localStorage.setItem('currentDonor', JSON.stringify({ ...current, ...d }));
  } catch (error) {
    const box = document.getElementById('donor-eligibility-status');
    if (box) {
      box.classList.remove('eligible');
      box.classList.add('not-eligible');
      box.innerText = error.message || 'Unable to load donor profile.';
    }
  }
}

async function updateDonorProfile() {
  const donor = getCurrentDonor();
  if (!donor) return;

  const phone = document.getElementById('profile-phone')?.value?.trim() || '';
  const address = document.getElementById('profile-address')?.value?.trim() || '';
  const lastDonation = document.getElementById('profile-last-donation')?.value || '';

  if (!phone || !address || !lastDonation) {
    alert('Please fill all profile fields.');
    return;
  }

  const digits = phone.replace(/\D+/g, '');
  if (digits.length < 10) {
    alert('Please enter a valid phone number.');
    return;
  }

  const calc = getEligibilityFromDate(lastDonation);
  renderDonorEligibilityBox(calc);

  try {
    const result = await apiRequest('donor_update_profile.php', {
      method: 'POST',
      body: JSON.stringify({
        donorId: donor.id,
        phone,
        address,
        lastDonation
      })
    });

    const updated = result.donor || {};
    const current = getCurrentDonor() || {};
    localStorage.setItem('currentDonor', JSON.stringify({ ...current, ...updated, phone, address, lastDonation }));

    renderDonorEligibilityBox(updated);
    alert('Profile updated successfully.');

    await updateDashboard();
    await loadDonorReceivedRequests();
  } catch (error) {
    alert(error.message || 'Unable to update profile.');
  }
}
async function loadDonorReceivedRequests() {
  const donor = getCurrentDonor();
  if (!donor) return;

  const loading = document.getElementById('donor-requests-loading');
  if (loading) loading.innerHTML = '<span class="loading-inline"><span class="loading-dot"></span>Loading received requests...</span>';

  try {
    const data = await apiRequest(`donor_requests.php?donor_id=${donor.id}`, { method: 'GET' });
    renderDonorReceivedRequests(data.requests || []);
    if (loading) loading.innerText = '';
  } catch (error) {
    if (loading) loading.innerText = error.message || 'Failed to load requests.';
  }
}

function renderDonorReceivedRequests(requests) {
  const wrap = document.getElementById('donor-received-requests');
  if (!wrap) return;

  if (!requests.length) {
    wrap.innerHTML = '<p class="muted">No requests received yet.</p>';
    return;
  }

  wrap.innerHTML = requests.map((r) => {
    const responseStatus = String(r.response_status || '').toLowerCase();
    const requestStatus = String(r.request_status || '').toLowerCase();
    const accepted = responseStatus === 'accepted';
    const rejected = responseStatus === 'rejected';
    const requestClosed = ['closed', 'cancelled', 'fulfilled'].includes(requestStatus);
    const canAccept = !requestClosed && !accepted;
    const canReject = !requestClosed && !rejected;
    const liveText = accepted
      ? (r.latitude && r.longitude ? `Live shared: ${Number(r.latitude).toFixed(5)}, ${Number(r.longitude).toFixed(5)}` : 'Accepted. Waiting for first location update...')
      : 'Location hidden until you accept.';

    return `
      <div class="request-card">
        <h4>${r.hospital_name} needs ${r.blood_group}</h4>
        <div class="request-meta">
          <div><strong>Hospital:</strong> ${r.hospital_name} (${r.hospital_location || '-'})</div>
          <div><strong>Location:</strong> ${r.location}</div>
          <div><strong>Urgency:</strong> ${r.urgency_level}</div>
          <div><strong>Request time:</strong> ${fmtDateTime(r.created_at)}</div>
          <div><strong>Status:</strong> ${r.response_status}</div>
          <div><strong>Location Sharing:</strong> ${liveText}</div>
        </div>
        <div class="request-actions">
          <button class="btn-small btn-accept" ${canAccept ? '' : 'disabled'} onclick="respondToBloodRequest(${r.request_id}, 'Accepted')">Accept Request</button>
          <button class="btn-small btn-reject" ${canReject ? '' : 'disabled'} onclick="respondToBloodRequest(${r.request_id}, 'Rejected')">Reject Request</button>
          <button class="btn-small" onclick="openExternalDirections('', '', '${r.hospital_latitude ?? ''}', '${r.hospital_longitude ?? ''}', '${String(r.location || '').replace(/'/g, '&#39;')}')">Get Directions</button>
        </div>
      </div>
    `;
  }).join('');
}

async function respondToBloodRequest(requestId, status) {
  const donor = getCurrentDonor();
  if (!donor || !donor.id) {
    alert('Session expired. Please login again.');
    window.location.href = 'login.html';
    return;
  }

  try {
    await apiRequest('donor_request_respond.php', {
      method: 'POST',
      body: JSON.stringify({
        donorId: donor.id,
        requestId,
        status
      })
    });

    if (status === 'Accepted') {
      startDonorLiveLocation(requestId);
    } else if (donorLiveRequestId === requestId) {
      stopDonorLiveLocation();
    }

    await loadDonorReceivedRequests();
    alert(`Request ${status.toLowerCase()} successfully.`);
  } catch (error) {
    alert(error.message || 'Unable to update request response.');
  }
}

function beginDonorLocationWatch(donorId, requestId, options = {}) {
  const watchOptions = {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 60000,
    ...options
  };

  if (donorLocationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(donorLocationWatchId);
    donorLocationWatchId = null;
  }

  donorLocationWatchId = navigator.geolocation.watchPosition(
    async (position) => {
      await sendDonorLiveCoordinates(
        donorId,
        requestId,
        Number(position.coords.latitude),
        Number(position.coords.longitude)
      );
    },
    (err) => {
      if (err && err.code === err.TIMEOUT && watchOptions.enableHighAccuracy) {
        // Retry with relaxed settings if high-accuracy GPS times out.
        beginDonorLocationWatch(donorId, requestId, {
          enableHighAccuracy: false,
          timeout: 45000,
          maximumAge: 180000
        });
        return;
      }

      if (err && err.code === err.PERMISSION_DENIED) {
        alert('Location permission denied. Please allow location access to share live tracking.');
        stopDonorLiveLocation();
        return;
      }

      if (err && err.code === err.POSITION_UNAVAILABLE) {
        alert('Live location is temporarily unavailable. Please move to open sky and try again.');
        return;
      }

      // Timeout or intermittent issues should not block donor flow with repeated alerts.
      console.warn('Live location warning:', err?.message || err);
    },
    watchOptions
  );
}

function startDonorLiveLocation(requestId) {
  const donor = getCurrentDonor();
  if (!donor) return;

  if (!navigator.geolocation) {
    alert('Geolocation is not supported on your device.');
    return;
  }

  donorLiveRequestId = Number(requestId);

  // Try one quick fix to get initial location, then start continuous tracking.
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      await sendDonorLiveCoordinates(
        donor.id,
        donorLiveRequestId,
        Number(position.coords.latitude),
        Number(position.coords.longitude)
      );

      beginDonorLocationWatch(donor.id, donorLiveRequestId, {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000
      });
    },
    () => {
      // Even if first fix fails, continue with watch and relaxed fallback handling.
      beginDonorLocationWatch(donor.id, donorLiveRequestId, {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000
      });
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
  );

  alert('Request accepted. Live location sharing started.');
}
function stopDonorLiveLocation() {
  if (donorLocationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(donorLocationWatchId);
  }
  donorLocationWatchId = null;
  donorLiveRequestId = null;
}

async function sendDonorLiveCoordinates(donorId, requestId, latitude, longitude) {
  try {
    await apiRequest('donor_location_update.php', {
      method: 'POST',
      body: JSON.stringify({ donorId, requestId, latitude, longitude })
    });
  } catch (error) {
    console.error('Location update failed', error.message || error);
  }
}
function applyLanguageToPage() {}

document.addEventListener('DOMContentLoaded', () => {
  if (!enforceLoginGate()) return;

  applyAuthAccess();

  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendChatMessage();
      }
    });
  }

  const donorChatInput = document.getElementById('donor-chat-input');
  if (donorChatInput) {
    donorChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendDonorLiveMessage();
      }
    });
  }

  const hospitalChatInput = document.getElementById('hospital-chat-input');
  if (hospitalChatInput) {
    hospitalChatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendHospitalLiveMessage();
      }
    });
  }

  const page = getCurrentPageName();
  if (page === 'hospital.html') {
    initHospitalDashboard();
    loadHospitalTracking();
    if (hospitalTrackingPollTimer) clearInterval(hospitalTrackingPollTimer);
    hospitalTrackingPollTimer = setInterval(loadHospitalTracking, 5000);
  }
  if (page === 'dashboard.html') {
    updateDashboard();
    loadDonorProfile();
    initDonorLiveChat();
    loadDonorReceivedRequests();
    if (donorRequestPollTimer) clearInterval(donorRequestPollTimer);
    donorRequestPollTimer = setInterval(loadDonorReceivedRequests, 10000);
  }
  if (page === 'index.html') {
    updateHomeStats();
  }
  if (page === 'search.html') {
    findDonors();
  }
});























