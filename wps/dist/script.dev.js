"use strict";

/* 
  Blood Donor Availability System - Expanded Logic
  Student Project - Updated with Advanced Features
*/
// --- 1. SETTINGS & TRANSLATIONS ---
var translations = {
  en: {
    title: "Blood Donor Availability System",
    home: "Home",
    register: "Register",
    find: "Find Donor",
    dashboard: "Dashboard",
    contact: "Contact/About",
    welcome: "Welcome to our Blood Donation Portal",
    sos_btn: "EMERGENCY SOS",
    total_donors: "Total Donors",
    eligible: "Eligible to donate",
    not_eligible: "Wait {days} days to donate",
    nearby: "Nearby Donor",
    other: "Other Location",
    available: "Available",
    unavailable: "Not Available",
    save: "Save",
    call: "Call",
    copy: "Copy Number"
  },
  es: {
    title: "Sistema de Disponibilidad de Donantes",
    home: "Inicio",
    register: "Registrarse",
    find: "Buscar Donante",
    dashboard: "Tablero",
    contact: "Contacto",
    welcome: "Bienvenido a nuestro Portal de Donación",
    sos_btn: "SOS DE EMERGENCIA",
    total_donors: "Total de Donantes",
    eligible: "Elegible para donar",
    not_eligible: "Espera {days} días para donar",
    nearby: "Donante Cercano",
    other: "Otra Ubicación",
    available: "Disponible",
    unavailable: "No Disponible",
    save: "Guardar",
    call: "Llamar",
    copy: "Copiar Número"
  }
};
var currentLanguage = localStorage.getItem('lang') || 'en';

function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('lang', lang);
  location.reload(); // Simplest way for a student project to refresh translations
}

function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
  var isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDark);
} // Check dark mode on load


if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
} // --- 2. DATA MANAGEMENT ---


function getDonors() {
  return JSON.parse(localStorage.getItem('donors')) || [];
}

function saveDonors(donors) {
  localStorage.setItem('donors', JSON.stringify(donors));
}

function getFavorites() {
  return JSON.parse(localStorage.getItem('favorites')) || [];
}

function saveFavorites(favorites) {
  localStorage.setItem('favorites', JSON.stringify(favorites));
} // --- 3. REGISTRATION LOGIC ---


function saveDonor() {
  var name = document.getElementById('name').value;
  var bloodGroup = document.getElementById('blood-group').value;
  var city = document.getElementById('city').value;
  var phone = document.getElementById('phone').value;
  var lastDonation = document.getElementById('last-donation').value;
  var availability = document.getElementById('availability').value;

  if (!name || !bloodGroup || !city || !phone || !lastDonation) {
    alert("Please fill all fields!");
    return;
  }

  var donorsList = getDonors(); // Check for duplicate phone number

  var exists = donorsList.find(function (d) {
    return d.phone === phone;
  });

  if (exists) {
    alert("Error: A donor with this phone number already exists!");
    return;
  }

  var newDonor = {
    id: Date.now(),
    name: name,
    bloodGroup: bloodGroup,
    city: city,
    phone: phone,
    lastDonation: lastDonation,
    availability: availability,
    points: 10,
    // Gamification: Start with 10 points
    badge: "Bronze Donor"
  };
  donorsList.push(newDonor);
  saveDonors(donorsList);
  alert("Success! Registration complete. You earned 10 points and the 'Bronze Donor' badge!");
  document.getElementById('registration-form').reset();
} // --- 4. SEARCH & ELIGIBILITY LOGIC ---


function calculateEligibility(lastDate) {
  var last = new Date(lastDate);
  var today = new Date();
  var diffTime = Math.abs(today - last);
  var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  var waitDays = 90 - diffDays;

  if (waitDays <= 0) {
    return {
      eligible: true
    };
  } else {
    return {
      eligible: false,
      days: waitDays
    };
  }
}

function findDonors() {
  var resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) return;
  var searchBG = document.getElementById('search-blood-group').value;
  var searchCity = document.getElementById('search-location').value.toLowerCase().trim();
  var allDonors = getDonors(); // Filter logic: Match BG, City (if provided), and ONLY show Available donors

  var filtered = allDonors.filter(function (d) {
    var bgMatch = searchBG === "" || d.bloodGroup === searchBG;
    var cityMatch = searchCity === "" || d.city.toLowerCase().includes(searchCity);
    var available = d.availability === "Available";
    return bgMatch && cityMatch && available;
  });
  resultsContainer.innerHTML = "";

  if (filtered.length === 0) {
    resultsContainer.innerHTML = "<p class=\"no-results\">No available donors found.</p>";
  } else {
    filtered.forEach(function (d) {
      var eligibility = calculateEligibility(d.lastDonation);
      var isNearby = searchCity !== "" && d.city.toLowerCase().includes(searchCity);
      var card = document.createElement('div');
      card.className = "donor-card";
      card.innerHTML = "\n                <div class=\"badge ".concat(isNearby ? 'badge-nearby' : 'badge-other', "\">\n                    ").concat(isNearby ? translations[currentLanguage].nearby : translations[currentLanguage].other, "\n                </div>\n                <div class=\"badge badge-bronze\">").concat(d.badge, "</div>\n                <h3>").concat(d.name, " <span class=\"blood-group-tag\">").concat(d.bloodGroup, "</span></h3>\n                <p>Location: ").concat(d.city, "</p>\n                <p style=\"color: ").concat(eligibility.eligible ? 'green' : 'orange', "\">\n                    Status: ").concat(eligibility.eligible ? translations[currentLanguage].eligible : translations[currentLanguage].not_eligible.replace('{days}', eligibility.days), "\n                </p>\n                <div class=\"action-buttons\">\n                    <a href=\"tel:").concat(d.phone, "\" class=\"btn-small\">").concat(translations[currentLanguage].call, "</a>\n                    <button class=\"btn-small\" onclick=\"copyNumber('").concat(d.phone, "')\">").concat(translations[currentLanguage].copy, "</button>\n                    <button class=\"btn-small btn-fav\" onclick=\"toggleFavorite(").concat(d.id, ")\">").concat(translations[currentLanguage].save, "</button>\n                </div>\n            ");
      resultsContainer.appendChild(card);
    });
  }

  updateStatsOnSearch();
}

function copyNumber(num) {
  navigator.clipboard.writeText(num);
  alert("Phone number copied to clipboard!");
}

function toggleFavorite(id) {
  var favorites = getFavorites();
  var donors = getDonors();
  var donor = donors.find(function (d) {
    return d.id === id;
  });

  if (favorites.find(function (f) {
    return f.id === id;
  })) {
    alert("Already in favorites!");
  } else {
    favorites.push(donor);
    saveFavorites(favorites);
    alert("Added to favorites!");
  }
} // --- 5. DASHBOARD & STATS LOGIC ---


function updateDashboard() {
  var donors = getDonors();
  var favs = getFavorites();
  document.getElementById('total-donors-val').innerText = donors.length;
  var bgCounts = {};
  donors.forEach(function (d) {
    bgCounts[d.bloodGroup] = (bgCounts[d.bloodGroup] || 0) + 1;
  });
  var statsList = document.getElementById('bg-stats-list');
  statsList.innerHTML = "";
  Object.keys(bgCounts).forEach(function (bg) {
    var li = document.createElement('li');
    li.innerText = "".concat(bg, ": ").concat(bgCounts[bg]);
    statsList.appendChild(li);
  }); // Render Favorites

  var favSection = document.getElementById('favorites-list');
  favSection.innerHTML = "";
  if (favs.length === 0) favSection.innerHTML = "<li>No favorites saved yet.</li>";
  favs.forEach(function (f) {
    var li = document.createElement('li');
    li.innerText = "".concat(f.name, " (").concat(f.bloodGroup, ") - ").concat(f.city);
    favSection.appendChild(li);
  });
}

function updateStatsOnSearch() {
  var donors = getDonors();
  var countEl = document.getElementById('donor-count-search');
  if (countEl) countEl.innerText = donors.length;
}

function updateHomeStats() {
  var donors = getDonors();
  var countEl = document.getElementById('donor-count');
  if (countEl) countEl.innerText = "Current Database Size: " + donors.length + " Donors";
} // --- 6. CHATBOT LOGIC ---


function toggleChatbot() {
  var win = document.getElementById('chatbot-window');
  win.style.display = win.style.display === 'block' ? 'none' : 'block';
}

function getChatResponse(q) {
  var body = document.getElementById('chat-body');
  var ans = "";
  if (q === 1) ans = "Healthy adults (18-65) weighing over 50kg can usually donate.";
  if (q === 2) ans = "You should wait at least 90 days between donations.";
  if (q === 3) ans = "Drink plenty of water and have a light meal before donating!";
  var msg = document.createElement('p');
  msg.style.marginBottom = "5px";
  msg.innerHTML = "<b>You:</b> Q".concat(q, "<br><b>Bot:</b> ").concat(ans);
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
} // SOS Alert


function triggerSOS() {
  alert("EMERGENCY SOS SENT!\nYour request has been broadcasted to all nearby donors in our system (Demo Alert).");
}

function clearAllData() {
  if (confirm("Clear ALL data including favorites and points?")) {
    localStorage.clear();
    location.reload();
  }
}