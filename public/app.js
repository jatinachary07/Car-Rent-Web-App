/* DriveGo Luxe – Complete Modern Frontend Client */

const $ = (id) => document.getElementById(id);
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Application state
const state = {
  token: localStorage.getItem('dg_token'),
  user: JSON.parse(localStorage.getItem('dg_user') || 'null'),
  cars: [],
  locations: [],
  extrasConfig: {},
  selectedCategory: 'All',
  selectedCar: null,
  activeQuote: null,
  appliedPromo: null,
  authMode: 'login'
};

/* ---------- API Helper ---------- */
async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Server request failed');
  }
  return data;
}

/* ---------- Toast Notifications ---------- */
function toast(message, type = 'success') {
  const container = $('toastContainer');
  const t = document.createElement('div');
  const isOk = type === 'success';
  const isErr = type === 'error';

  t.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold text-white animate-slide-up ${
    isOk ? 'bg-slate-900 border border-slate-700' : isErr ? 'bg-red-600' : 'bg-brand-600'
  }`;

  const icon = isOk ? '✅' : isErr ? '❌' : 'ℹ️';
  t.innerHTML = `<span>${icon}</span><span class="flex-1">${message}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = 'all 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, 4000);
}

/* ---------- Modal Management ---------- */
function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('hidden');
  document.body.style.overflow = '';
}

['quickViewModal', 'bookingModal', 'voucherModal', 'myBookingsModal', 'reviewModal', 'authModal', 'adminModal'].forEach(id => {
  const el = $(id);
  if (el) {
    el.addEventListener('click', (e) => {
      if (e.target === el) closeModal(id);
    });
  }
});

/* ---------- Theme Initialization ---------- */
function initTheme() {
  const stored = localStorage.getItem('dg_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored ? stored === 'dark' : prefersDark;

  applyTheme(isDark);

  $('themeToggle').onclick = () => {
    const activeDark = document.documentElement.classList.contains('dark');
    applyTheme(!activeDark);
  };
}

function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('dg_theme', dark ? 'dark' : 'light');
  $('themeIcon').textContent = dark ? '☀️' : '🌙';
}

/* ---------- Category Navigation Tabs ---------- */
const CATEGORIES = [
  { id: 'All', label: 'All Fleet', icon: '✨' },
  { id: 'Luxury', label: 'Luxury & Sports', icon: '👑' },
  { id: 'SUV', label: 'SUVs & 4x4', icon: '🚙' },
  { id: 'Sedan', label: 'Executive Sedans', icon: '🚘' },
  { id: 'Electric', label: 'Electric (EV)', icon: '⚡' },
  { id: 'Hatchback', label: 'City Hatchback', icon: '🚗' },
  { id: 'MPV', label: '7-Seater MPV', icon: '🚐' }
];

function renderCategoryTabs() {
  const container = $('categoryTabs');
  container.innerHTML = CATEGORIES.map(cat => {
    const active = state.selectedCategory.toLowerCase() === cat.id.toLowerCase();
    return `
      <button data-cat="${cat.id}" class="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
        active
          ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/25 scale-[1.02]'
          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-brand-500'
      }">
        <span>${cat.icon}</span>
        <span>${cat.label}</span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      state.selectedCategory = b.dataset.cat;
      $('heroCategorySelect').value = b.dataset.cat;
      renderCategoryTabs();
      loadFleet();
    };
  });
}

/* ---------- Locations & Extras Initializer ---------- */
async function loadLocationsAndExtras() {
  try {
    const [locations, extras] = await Promise.all([
      api('/api/locations'),
      api('/api/extras')
    ]);
    state.locations = locations;
    state.extrasConfig = extras;

    // Populate Hub Selects
    const hubOpts = locations.map(loc => `<option value="${loc}">${loc}</option>`).join('');
    $('hubSelect').innerHTML = hubOpts;
    $('bookModalLocation').innerHTML = hubOpts;
  } catch (e) {
    console.error('Failed to load metadata:', e);
  }
}

/* ---------- Fleet Fetching & Cards Display ---------- */
async function loadFleet() {
  const p = new URLSearchParams();
  if (state.selectedCategory !== 'All') p.set('type', state.selectedCategory);
  if ($('filterTrans').value) p.set('transmission', $('filterTrans').value);
  if ($('filterFuel').value) p.set('fuel', $('filterFuel').value);
  if ($('filterSeats').value) p.set('seats', $('filterSeats').value);
  if ($('filterSort').value) p.set('sort', $('filterSort').value);
  if ($('searchInput').value.trim()) p.set('search', $('searchInput').value.trim());

  p.set('maxPrice', $('filterPriceRange').value);

  const startVal = $('heroStartDate').value;
  const endVal = $('heroEndDate').value;
  if (startVal && endVal && endVal > startVal) {
    p.set('start', startVal);
    p.set('end', endVal);
  }

  try {
    const cars = await api('/api/cars?' + p);
    state.cars = cars;
    renderCarsGrid(cars);
    updateCalcCarDropdown(cars);
    updateReviewCarDropdown(cars);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderCarsGrid(cars) {
  const grid = $('carsGrid');
  const countText = $('fleetCountText');
  const emptyState = $('emptyFleetState');

  countText.textContent = `Showing ${cars.length} verified vehicle${cars.length === 1 ? '' : 's'} ready for reservation`;

  if (!cars.length) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = cars.map(c => {
    const fallback = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';
    return `
      <article class="card-zoom rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition duration-300 flex flex-col justify-between">
        <div>
          <!-- Car Photo Banner -->
          <div class="relative h-48 bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <img src="${c.image || fallback}" alt="${c.brand} ${c.name}" class="w-full h-full object-cover transition duration-500" onerror="this.src='${fallback}'" />
            
            <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 dark:bg-slate-900/90 text-[10px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-100 shadow-sm">
              ${c.type}
            </span>

            <span class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-white text-xs font-bold shadow-sm flex items-center gap-1">
              <span class="text-amber-400">★</span> ${c.rating || 4.8} <span class="text-[10px] text-slate-400">(${c.reviewsCount || 10})</span>
            </span>

            ${c.badge ? `
              <span class="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-lg bg-brand-600/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider">
                ${c.badge}
              </span>
            ` : ''}

            ${!c.available ? `
              <div class="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center text-white text-center p-4">
                <span class="text-2xl mb-1">🔒</span>
                <span class="text-xs font-extrabold uppercase tracking-wider">Booked for Chosen Dates</span>
                <span class="text-[10px] text-slate-300">Try adjusting your trip dates</span>
              </div>
            ` : ''}
          </div>

          <!-- Car Info & Specs -->
          <div class="p-5">
            <div class="flex items-center justify-between text-xs text-slate-400 font-semibold mb-0.5">
              <span>${c.brand}</span>
              <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">● Free Cancellation</span>
            </div>
            <h3 class="text-lg font-extrabold text-slate-900 dark:text-white leading-tight">${c.name}</h3>

            <!-- Key Specs Strip -->
            <div class="grid grid-cols-3 gap-2 mt-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <div class="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center gap-1">
                <span>👥</span> <span>${c.seats} Seats</span>
              </div>
              <div class="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center gap-1">
                <span>⚙️</span> <span>${c.transmission}</span>
              </div>
              <div class="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center gap-1">
                <span>⛽</span> <span>${c.fuel}</span>
              </div>
            </div>

            <p class="text-xs text-slate-500 dark:text-slate-400 mt-3 line-clamp-2">${c.description || ''}</p>
          </div>
        </div>

        <!-- Price & Action CTA -->
        <div class="p-5 pt-0">
          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
            <div>
              <p class="text-[11px] text-slate-400 line-through">${inr(Math.round(c.pricePerDay * 1.15))}</p>
              <div class="flex items-baseline gap-1">
                <span class="text-xl font-black text-slate-900 dark:text-white">${inr(c.pricePerDay)}</span>
                <span class="text-[11px] font-medium text-slate-400">/ day</span>
              </div>
            </div>

            <div class="flex gap-2">
              <button onclick="openQuickView(${c.id})" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:text-brand-600 text-slate-700 dark:text-slate-200 transition">
                Specs
              </button>
              <button onclick="startBooking(${c.id})" ${c.available ? '' : 'disabled'} class="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition">
                Book
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

/* ---------- Quick View / Specs Modal ---------- */
async function openQuickView(carId) {
  const car = state.cars.find(c => c.id === carId);
  if (!car) return;

  const content = $('quickViewContent');
  content.innerHTML = `
    <div class="relative h-64 sm:h-72 bg-slate-900">
      <img src="${car.image}" alt="${car.name}" class="w-full h-full object-cover opacity-90" />
      <button onclick="closeModal('quickViewModal')" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-950/70 text-white flex items-center justify-center text-sm hover:bg-slate-950">✕</button>
      <div class="absolute bottom-4 left-6 right-6 flex items-end justify-between text-white">
        <div>
          <span class="px-2.5 py-0.5 rounded-full bg-brand-600 text-[10px] font-extrabold uppercase">${car.type}</span>
          <h2 class="text-2xl sm:text-3xl font-black mt-1">${car.brand} ${car.name}</h2>
        </div>
        <div class="text-right">
          <p class="text-2xl font-black text-amber-300">${inr(car.pricePerDay)}<span class="text-xs text-white font-normal"> /day</span></p>
          <p class="text-[11px] text-slate-300">★ ${car.rating} (${car.reviewsCount || 12} reviews)</p>
        </div>
      </div>
    </div>

    <div class="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
      <div>
        <h4 class="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-3">Performance &amp; Engineering Specs</h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Top Speed</span>
            <span class="font-extrabold text-sm">${car.topSpeed || '180 km/h'}</span>
          </div>
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Acceleration</span>
            <span class="font-extrabold text-sm">${car.acceleration || '8.5s (0-100)'}</span>
          </div>
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Efficiency</span>
            <span class="font-extrabold text-sm">${car.mileage || '18 km/l'}</span>
          </div>
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
            <span class="text-slate-400 block text-[10px] uppercase font-bold">Luggage</span>
            <span class="font-extrabold text-sm">${car.luggage || '3 Large Bags'}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 class="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-3">Key Features &amp; Inclusions</h4>
        <div class="flex flex-wrap gap-2">
          ${(car.features || []).map(f => `
            <span class="px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-300 text-xs font-bold border border-brand-200 dark:border-brand-800">
              ✓ ${f}
            </span>
          `).join('')}
        </div>
      </div>

      <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
        <p class="font-bold text-slate-900 dark:text-white">Included With Every Booking:</p>
        <p>• 150 km/day daily allowance with easy extension</p>
        <p>• Hospital-grade interior sanitation before key handover</p>
        <p>• Full breakdown road assistance across India</p>
      </div>

      <div class="pt-2">
        <button onclick="closeModal('quickViewModal'); startBooking(${car.id});" class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-brand-600/30 transition">
          Proceed to Reserve ${car.name} →
        </button>
      </div>
    </div>
  `;

  openModal('quickViewModal');
}

/* ---------- Booking Wizard Modal ---------- */
async function startBooking(carId) {
  if (!state.token) {
    toast('Please sign in to reserve this car', 'info');
    openAuthModal('login');
    return;
  }

  const car = state.cars.find(c => c.id === carId);
  if (!car) return;

  state.selectedCar = car;
  state.appliedPromo = null;
  $('couponInput').value = '';
  $('couponStatusMessage').classList.add('hidden');

  $('bookingModalHeader').innerHTML = `
    <button onclick="closeModal('bookingModal')" class="absolute top-4 right-4 text-white/80 hover:text-white text-lg">✕</button>
    <div class="flex items-center gap-4">
      <img src="${car.image}" alt="${car.name}" class="w-20 h-14 rounded-xl object-cover shadow-md border border-white/20" />
      <div>
        <span class="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">${car.type}</span>
        <h3 class="text-xl font-extrabold">${car.brand} ${car.name}</h3>
        <p class="text-xs text-indigo-100">${inr(car.pricePerDay)}/day · ${car.transmission} · ${car.fuel}</p>
      </div>
    </div>
  `;

  $('bookModalStart').min = iso(new Date());
  $('bookModalStart').value = $('heroStartDate').value;
  $('bookModalEnd').value = $('heroEndDate').value;
  $('bookModalLocation').value = $('hubSelect').value;

  await renderBookingExtras();
  refreshBookingQuote();
  openModal('bookingModal');
}

async function renderBookingExtras() {
  if (!Object.keys(state.extrasConfig).length) {
    state.extrasConfig = await api('/api/extras').catch(() => ({}));
  }

  $('bookModalExtras').innerHTML = Object.entries(state.extrasConfig).map(([key, item]) => `
    <label class="flex items-start gap-2.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 cursor-pointer text-xs">
      <input type="checkbox" data-extra="${key}" ${key === 'insurance' ? 'checked' : ''} class="extra-checkbox accent-brand-600 w-4 h-4 rounded mt-0.5" />
      <div class="flex-1">
        <div class="flex justify-between font-bold">
          <span>${item.icon} ${item.label}</span>
          <span class="text-brand-600 dark:text-brand-400">${inr(item.perDay)}/d</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-0.5">${item.desc}</p>
      </div>
    </label>
  `).join('');

  $('bookModalExtras').querySelectorAll('input').forEach(box => {
    box.onchange = refreshBookingQuote;
  });
}

async function refreshBookingQuote() {
  const car = state.selectedCar;
  if (!car) return;

  const start = $('bookModalStart').value;
  const end = $('bookModalEnd').value;
  const chosenExtras = [...$('bookModalExtras').querySelectorAll('input:checked')].map(i => i.dataset.extra);
  const promoCode = state.appliedPromo ? state.appliedPromo.code : $('couponInput').value.trim();

  try {
    const q = await api('/api/quote', {
      method: 'POST',
      body: { carId: car.id, start, end, extras: chosenExtras, promoCode }
    });

    state.activeQuote = q;
    $('bookingErrorText').classList.add('hidden');

    $('modalQuoteBox').innerHTML = `
      <div class="flex justify-between text-slate-600 dark:text-slate-300">
        <span>Daily Rental (${inr(q.car.pricePerDay)} × ${q.days} day${q.days > 1 ? 's' : ''})</span>
        <span class="font-bold">${inr(q.base)}</span>
      </div>
      ${q.extrasTotal ? `
        <div class="flex justify-between text-slate-600 dark:text-slate-300">
          <span>Protection &amp; Add-ons</span>
          <span class="font-bold">${inr(q.extrasTotal)}</span>
        </div>
      ` : ''}
      ${q.durationDiscount ? `
        <div class="flex justify-between text-emerald-600 font-semibold">
          <span>Long Duration Discount (10% OFF)</span>
          <span>- ${inr(q.durationDiscount)}</span>
        </div>
      ` : ''}
      ${q.promoDiscount ? `
        <div class="flex justify-between text-emerald-600 font-semibold">
          <span>Promo Code Applied (${q.appliedCoupon?.code || promoCode})</span>
          <span>- ${inr(q.promoDiscount)}</span>
        </div>
      ` : ''}
      <div class="flex justify-between text-slate-600 dark:text-slate-300">
        <span>Statutory GST (18%)</span>
        <span class="font-bold">${inr(q.tax)}</span>
      </div>
      <div class="flex justify-between text-slate-500 text-[11px]">
        <span>Refundable Security Deposit (Returned on drop-off)</span>
        <span class="font-medium">${inr(q.deposit)}</span>
      </div>
      <div class="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm font-extrabold text-slate-900 dark:text-white">
        <span>Total Payable</span>
        <span class="text-lg text-brand-600 dark:text-brand-400">${inr(q.total)}</span>
      </div>
    `;
  } catch (err) {
    $('modalQuoteBox').innerHTML = `<p class="text-slate-400 text-center py-2">${err.message}</p>`;
    $('bookingErrorText').textContent = err.message;
    $('bookingErrorText').classList.remove('hidden');
  }
}

$('bookModalStart').addEventListener('change', () => {
  $('bookModalEnd').min = $('bookModalStart').value;
  if ($('bookModalEnd').value <= $('bookModalStart').value) {
    $('bookModalEnd').value = iso(addDays(new Date($('bookModalStart').value), 2));
  }
  refreshBookingQuote();
});
$('bookModalEnd').addEventListener('change', refreshBookingQuote);
$('closeBookingBtn').onclick = () => closeModal('bookingModal');

// Promo Coupon Validation
$('applyCouponBtn').onclick = async () => {
  const code = $('couponInput').value.trim().toUpperCase();
  const statusEl = $('couponStatusMessage');
  if (!code) {
    statusEl.textContent = 'Please enter a coupon code';
    statusEl.className = 'text-xs text-red-600';
    statusEl.classList.remove('hidden');
    return;
  }

  try {
    const res = await api('/api/coupons/validate', {
      method: 'POST',
      body: { code, amount: state.activeQuote ? state.activeQuote.base : 5000 }
    });
    state.appliedPromo = res;
    statusEl.textContent = `Promo code applied: ${res.desc}`;
    statusEl.className = 'text-xs text-emerald-600 font-bold';
    statusEl.classList.remove('hidden');
    refreshBookingQuote();
    toast(`Promo applied: ${res.code}!`);
  } catch (err) {
    state.appliedPromo = null;
    statusEl.textContent = err.message;
    statusEl.className = 'text-xs text-red-600';
    statusEl.classList.remove('hidden');
    refreshBookingQuote();
  }
};

// Confirm Booking
$('submitBookingBtn').onclick = async () => {
  const car = state.selectedCar;
  if (!car) return;

  const btn = $('submitBookingBtn');
  btn.disabled = true;
  btn.textContent = 'Confirming reservation…';

  const chosenExtras = [...$('bookModalExtras').querySelectorAll('input:checked')].map(i => i.dataset.extra);
  const paymentMethod = document.querySelector('input[name="paymentChoice"]:checked')?.value || 'Credit Card (•••• 4242)';

  try {
    const booking = await api('/api/bookings', {
      method: 'POST',
      body: {
        carId: car.id,
        start: $('bookModalStart').value,
        end: $('bookModalEnd').value,
        extras: chosenExtras,
        pickupLocation: $('bookModalLocation').value,
        paymentMethod,
        promoCode: state.appliedPromo ? state.appliedPromo.code : $('couponInput').value.trim()
      }
    });

    closeModal('bookingModal');
    toast(`Trip confirmed! Ref: ${booking.ref}`, 'success');
    showVoucherModal(booking, car);
    loadFleet();
    updateBookingCount();
  } catch (err) {
    $('bookingErrorText').textContent = err.message;
    $('bookingErrorText').classList.remove('hidden');
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm & Reserve Ride';
  }
};

/* ---------- Printable Boarding Voucher ---------- */
function showVoucherModal(booking, car) {
  const area = $('voucherPrintArea');
  area.innerHTML = `
    <div class="border-b-2 border-dashed border-slate-200 dark:border-slate-800 pb-5">
      <div class="flex justify-between items-start">
        <div>
          <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
            ✓ Confirmed Reservation
          </span>
          <h2 class="text-2xl font-black mt-2">DriveGo Luxe Boarding Pass</h2>
          <p class="text-xs text-slate-400">Show this pass at pickup hub or doorstep delivery</p>
        </div>
        <div class="text-right">
          <span class="text-xs font-mono font-bold text-slate-400">RESERVATION REF</span>
          <p class="text-xl font-mono font-extrabold text-brand-600 dark:text-brand-400">${booking.ref}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
      <div>
        <span class="text-slate-400 uppercase font-bold text-[10px] block">Renter</span>
        <span class="font-extrabold text-sm">${booking.userName || state.user?.name}</span>
      </div>
      <div>
        <span class="text-slate-400 uppercase font-bold text-[10px] block">Reserved Car</span>
        <span class="font-extrabold text-sm">${booking.carName}</span>
      </div>
      <div>
        <span class="text-slate-400 uppercase font-bold text-[10px] block">Pickup Location</span>
        <span class="font-extrabold text-sm">${booking.pickupLocation}</span>
      </div>
      <div>
        <span class="text-slate-400 uppercase font-bold text-[10px] block">Duration</span>
        <span class="font-extrabold text-sm">${booking.days} Day(s)</span>
      </div>
    </div>

    <div class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 flex justify-between items-center text-xs">
      <div>
        <p class="text-[10px] uppercase font-bold text-slate-400">Handover Date</p>
        <p class="font-extrabold text-base text-slate-800 dark:text-slate-100">${booking.start}</p>
      </div>
      <div class="text-center font-bold text-slate-300">
        ──────── 🚘 ────────
      </div>
      <div class="text-right">
        <p class="text-[10px] uppercase font-bold text-slate-400">Return Date</p>
        <p class="font-extrabold text-base text-slate-800 dark:text-slate-100">${booking.end}</p>
      </div>
    </div>

    <div class="space-y-1.5 text-xs border-t border-slate-100 dark:border-slate-800 pt-4">
      <div class="flex justify-between text-slate-500">
        <span>Payment Method</span>
        <span class="font-semibold text-slate-800 dark:text-slate-200">${booking.paymentMethod}</span>
      </div>
      <div class="flex justify-between text-slate-500">
        <span>Status</span>
        <span class="font-bold text-emerald-600 uppercase">${booking.status}</span>
      </div>
      <div class="flex justify-between text-slate-500">
        <span>Security Deposit (Refundable)</span>
        <span class="font-semibold">${inr(booking.deposit || 3000)}</span>
      </div>
      <div class="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
        <span>Total Paid Amount</span>
        <span class="text-brand-600 dark:text-brand-400">${inr(booking.total)}</span>
      </div>
    </div>

    <div class="flex items-center justify-between p-4 rounded-2xl bg-slate-900 text-white">
      <div class="text-xs">
        <p class="font-bold">Fast Handover Verification</p>
        <p class="text-[10px] text-slate-400">Have your original driving license and ID ready.</p>
      </div>
      <div class="w-14 h-14 bg-white p-1 rounded-xl flex items-center justify-center">
        <svg viewBox="0 0 40 40" class="w-full h-full text-slate-900" fill="currentColor">
          <path d="M4 4h12v12H4V4zm4 4v4h4V8H8zm16-4h12v12H24V4zm4 4v4h4V8h-4zM4 24h12v12H4V24zm4 4v4h4v-4H8zm16 4h4v4h-4v-4zm8 0h4v4h-4v-4zm-8-8h8v4h-8v-4zm8 4h4v4h-4v-4zm-4 8h4v4h-4v-4z"/>
        </svg>
      </div>
    </div>
  `;

  openModal('voucherModal');
}
$('closeVoucherBtn').onclick = () => closeModal('voucherModal');

/* ---------- Customer "My Trips" Portal ---------- */
async function openMyBookings() {
  if (!state.token) {
    openAuthModal('login');
    return;
  }

  const listEl = $('myBookingsList');
  listEl.innerHTML = `<p class="text-center py-8 text-xs text-slate-400">Loading your reservations…</p>`;
  openModal('myBookingsModal');

  try {
    const list = await api('/api/bookings');
    updateBookingCountBadge(list.length);

    if (!list.length) {
      listEl.innerHTML = `
        <div class="text-center py-12">
          <span class="text-4xl block mb-2">🚗</span>
          <p class="font-bold text-sm">No reservations found yet</p>
          <p class="text-xs text-slate-400 mt-1">Explore our fleet and book your first drive!</p>
          <button onclick="closeModal('myBookingsModal')" class="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white">Browse Fleet</button>
        </div>
      `;
      return;
    }

    listEl.innerHTML = list.map(b => {
      const isConfirmed = b.status === 'confirmed';
      const isCancelled = b.status === 'cancelled';
      const statusBadge = isConfirmed
        ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
        : isCancelled
        ? 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400'
        : 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400';

      return `
        <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-extrabold">${b.carName}</span>
              <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusBadge}">${b.status}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              📅 ${b.start} → ${b.end} (${b.days} days) · 📍 ${b.pickupLocation}
            </p>
            <p class="text-[11px] text-slate-400 font-mono mt-0.5">
              Ref: ${b.ref} · Total: <strong class="text-slate-800 dark:text-slate-200 font-sans">${inr(b.total)}</strong>
            </p>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-auto">
            <button onclick='reopenVoucher(${JSON.stringify(b)})' class="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-500">
              Voucher
            </button>
            ${isConfirmed ? `
              <button onclick="cancelBooking(${b.id})" class="px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 border border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/40">
                Cancel
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = `<p class="text-xs text-red-600 text-center py-6">${err.message}</p>`;
  }
}

window.reopenVoucher = (booking) => {
  const car = state.cars.find(c => c.id === booking.carId) || { name: booking.carName, image: booking.carImage };
  showVoucherModal(booking, car);
};

window.cancelBooking = async (bookingId) => {
  if (!confirm('Are you sure you want to cancel this booking? This will immediately free the vehicle.')) return;
  try {
    await api('/api/bookings/' + bookingId, { method: 'DELETE' });
    toast('Reservation cancelled successfully');
    openMyBookings();
    loadFleet();
  } catch (err) {
    toast(err.message, 'error');
  }
};

async function updateBookingCount() {
  if (!state.token) return;
  try {
    const list = await api('/api/bookings');
    updateBookingCountBadge(list.length);
  } catch (e) {}
}

function updateBookingCountBadge(count) {
  const badge = $('bookingCountBadge');
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

$('myBookingsBtn').onclick = openMyBookings;
$('mobileBookingsBtn').onclick = openMyBookings;
$('closeMyBookingsBtn').onclick = () => closeModal('myBookingsModal');

/* ---------- Pricing Estimator Calculator ---------- */
function initCalculator() {
  $('calcDaysRange').addEventListener('input', (e) => {
    $('calcDaysDisplay').textContent = `${e.target.value} Day${e.target.value > 1 ? 's' : ''}`;
    updateCalculatorQuote();
  });
  $('calcCarSelect').addEventListener('change', updateCalculatorQuote);
  $('calcInsurance').addEventListener('change', updateCalculatorQuote);
  $('calcDriver').addEventListener('change', updateCalculatorQuote);
}

function updateCalcCarDropdown(cars) {
  const select = $('calcCarSelect');
  select.innerHTML = cars.map(c => `
    <option value="${c.id}" data-price="${c.pricePerDay}">${c.brand} ${c.name} (${inr(c.pricePerDay)}/day)</option>
  `).join('');
  updateCalculatorQuote();
}

function updateCalculatorQuote() {
  const select = $('calcCarSelect');
  const opt = select.selectedOptions[0];
  if (!opt) return;

  const pricePerDay = Number(opt.dataset.price) || 2500;
  const days = Number($('calcDaysRange').value);
  const base = pricePerDay * days;

  let addons = 0;
  if ($('calcInsurance').checked) addons += 300 * days;
  if ($('calcDriver').checked) addons += 1000 * days;

  const discount = days >= 7 ? Math.round(base * 0.10) : 0;
  const discountRow = $('calcDiscountRow');

  if (discount > 0) {
    discountRow.classList.remove('hidden');
    $('calcDiscountPrice').textContent = `- ${inr(discount)}`;
  } else {
    discountRow.classList.add('hidden');
  }

  const subtotal = base + addons - discount;
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  $('calcBasePrice').textContent = inr(base);
  $('calcAddonsPrice').textContent = inr(addons);
  $('calcGstPrice').textContent = inr(gst);
  $('calcTotalPrice').textContent = inr(total);
}

/* ---------- Reviews System ---------- */
async function loadReviews() {
  const grid = $('reviewsListGrid');
  try {
    // Collect reviews from cars
    const seedCars = state.cars.slice(0, 6);
    let sampleReviews = [
      { author: "Vikram Malhotra", carName: "BMW M340i xDrive", rating: 5, date: "2026-09-18", comment: "The BMW M340i was in pristine showroom condition! Effortless acceleration and smooth pickup at Airport T3." },
      { author: "Pooja Hegde", carName: "BMW M340i xDrive", rating: 5, date: "2026-08-25", comment: "Outstanding service. The exhaust sound and handling on the expressway were breathtaking." },
      { author: "Rahul Sharma", carName: "Hyundai Creta SX(O)", rating: 5, date: "2026-09-02", comment: "Creta Knight Edition was super comfortable for our family trip to Agra. Panoramic sunroof made the drive awesome!" },
      { author: "Aman Preet", carName: "Mahindra Thar 4x4", rating: 5, date: "2026-09-14", comment: "Thar 4x4 handled rough trails with zero trouble. Bluetooth, AC, and build quality were top notch." },
      { author: "Dr. Ananya Roy", carName: "Tesla Model 3 Long Range", rating: 5, date: "2026-09-20", comment: "Tesla Model 3 Autopilot is magic. Super quiet, extremely quick, and cost practically nothing to charge." },
      { author: "Karan Johar", carName: "Honda City ZX CVT", rating: 4, date: "2026-08-30", comment: "Honda City had huge legroom in the rear and great luggage space. Very clean interior." }
    ];

    grid.innerHTML = sampleReviews.map(r => `
      <div class="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-amber-400 text-sm">★★★★★</span>
            <span class="text-[10px] text-slate-400">${r.date}</span>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">"${r.comment}"</p>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-pink-500 text-white font-bold text-xs flex items-center justify-center">
            ${r.author.charAt(0)}
          </div>
          <div>
            <h4 class="text-xs font-bold leading-tight">${r.author}</h4>
            <span class="text-[10px] text-emerald-600 font-semibold">✓ Verified Drive (${r.carName})</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p class="text-xs text-slate-400">Failed to load reviews.</p>`;
  }
}

function updateReviewCarDropdown(cars) {
  const select = $('revCarSelect');
  select.innerHTML = cars.map(c => `
    <option value="${c.id}">${c.brand} ${c.name}</option>
  `).join('');
}

let activeReviewRating = 5;
function initReviewRatingPicker() {
  const stars = document.querySelectorAll('.star-rating-item');
  stars.forEach(s => {
    s.onclick = () => {
      activeReviewRating = Number(s.dataset.star);
      stars.forEach(star => {
        const val = Number(star.dataset.star);
        star.classList.toggle('text-amber-400', val <= activeReviewRating);
        star.classList.toggle('text-slate-300', val > activeReviewRating);
      });
    };
  });
}

$('openReviewModalBtn').onclick = () => {
  if (!state.token) {
    toast('Please sign in to post a verified review', 'info');
    openAuthModal('login');
    return;
  }
  openModal('reviewModal');
};
$('closeReviewModal').onclick = () => closeModal('reviewModal');

$('reviewForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const carId = $('revCarSelect').value;
  try {
    await api(`/api/cars/${carId}/reviews`, {
      method: 'POST',
      body: {
        rating: activeReviewRating,
        comment: $('revComment').value,
        author: state.user ? state.user.name : undefined
      }
    });

    closeModal('reviewModal');
    $('revComment').value = '';
    toast('Review published! Thank you for sharing your experience.', 'success');
    loadReviews();
    loadFleet();
  } catch (err) {
    toast(err.message, 'error');
  }
});

/* ---------- FAQ Accordion ---------- */
function initFaq() {
  document.querySelectorAll('.faq-toggle').forEach(btn => {
    btn.onclick = () => {
      const content = btn.nextElementSibling;
      const icon = btn.querySelector('.faq-icon');
      const isHidden = content.classList.contains('hidden');

      document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
      document.querySelectorAll('.faq-icon').forEach(i => { i.textContent = '+'; i.style.transform = 'none'; });

      if (isHidden) {
        content.classList.remove('hidden');
        icon.textContent = '−';
        icon.style.transform = 'rotate(180deg)';
      }
    };
  });
}

/* ---------- Admin Control Panel ---------- */
async function openAdminPanel() {
  if (!state.token || !state.user || state.user.role !== 'admin') {
    toast('Admin account required. Click 1-Click Admin Demo button', 'info');
    openAuthModal('login');
    fillDemoLogin('admin@drivego.com', 'admin123');
    return;
  }

  openModal('adminModal');
  loadAdminStats();
  loadAdminBookings();
}

async function loadAdminStats() {
  try {
    const stats = await api('/api/admin/stats');
    $('adminRevStat').textContent = inr(stats.totalRevenue);
    $('adminBookingsStat').textContent = stats.totalBookings;
    $('adminActiveStat').textContent = stats.activeBookings;
    $('adminFleetStat').textContent = stats.fleetCount;
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function loadAdminBookings() {
  const tbody = $('adminBookingsTableBody');
  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-slate-400">Loading bookings…</td></tr>`;

  try {
    const list = await api('/api/admin/bookings');
    tbody.innerHTML = list.map(b => `
      <tr class="border-b border-slate-100 dark:border-slate-800">
        <td class="py-2.5 font-mono font-bold">${b.ref}</td>
        <td class="py-2.5">${b.userName}</td>
        <td class="py-2.5 font-semibold">${b.carName}</td>
        <td class="py-2.5 text-slate-400">${b.start} → ${b.end}</td>
        <td class="py-2.5 font-bold">${inr(b.total)}</td>
        <td class="py-2.5">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
            b.status === 'completed' ? 'bg-indigo-100 text-indigo-700' :
            b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }">${b.status}</span>
        </td>
        <td class="py-2.5 text-right space-x-1">
          <select onchange="updateBookingStatus(${b.id}, this.value)" class="text-[10px] p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <option value="">Update…</option>
            <option value="confirmed">Confirmed</option>
            <option value="active">Active Trip</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">${err.message}</td></tr>`;
  }
}

window.updateBookingStatus = async (id, status) => {
  if (!status) return;
  try {
    await api('/api/admin/bookings/' + id, { method: 'PATCH', body: { status } });
    toast(`Booking status updated to ${status}`);
    loadAdminStats();
    loadAdminBookings();
  } catch (err) {
    toast(err.message, 'error');
  }
};

$('adminTabBookings').onclick = () => {
  $('adminTabBookings').className = 'px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white';
  $('adminTabAddCar').className = 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
  $('adminBookingsView').classList.remove('hidden');
  $('adminAddCarView').classList.add('hidden');
};

$('adminTabAddCar').onclick = () => {
  $('adminTabAddCar').className = 'px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white';
  $('adminTabBookings').className = 'px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
  $('adminAddCarView').classList.remove('hidden');
  $('adminBookingsView').classList.add('hidden');
};

$('adminAddCarForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/cars', {
      method: 'POST',
      body: {
        brand: $('addCarBrand').value,
        name: $('addCarName').value,
        type: $('addCarType').value,
        pricePerDay: Number($('addCarPrice').value),
        transmission: $('addCarTrans').value,
        fuel: $('addCarFuel').value,
        seats: Number($('addCarSeats').value),
        image: $('addCarImage').value || undefined
      }
    });

    $('adminAddCarForm').reset();
    toast('New vehicle added to active fleet!', 'success');
    loadAdminStats();
    loadFleet();
    $('adminTabBookings').click();
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('adminBtn').onclick = openAdminPanel;
$('mobileAdminBtn').onclick = openAdminPanel;
$('closeAdminModal').onclick = () => closeModal('adminModal');

/* ---------- Authentication & Session Handling ---------- */
function renderAuthUi() {
  const authContainer = $('authContainer');
  const myBookingsBtn = $('myBookingsBtn');
  const adminBtn = $('adminBtn');

  if (state.user) {
    myBookingsBtn.classList.remove('hidden');
    myBookingsBtn.classList.add('flex');

    if (state.user.role === 'admin') {
      adminBtn.classList.remove('hidden');
      adminBtn.classList.add('flex');
    } else {
      adminBtn.classList.add('hidden');
    }

    authContainer.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-600 dark:text-slate-300 hidden sm:inline">
          👋 ${state.user.name.split(' ')[0]}
        </span>
        <button id="logoutBtn" class="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-red-400 hover:text-red-600 transition">
          Logout
        </button>
      </div>
    `;
    $('logoutBtn').onclick = logoutUser;
    updateBookingCount();
  } else {
    myBookingsBtn.classList.add('hidden');
    adminBtn.classList.add('hidden');
    authContainer.innerHTML = `
      <button id="loginBtn" class="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-600/20 transition">
        Sign In
      </button>
    `;
    $('loginBtn').onclick = () => openAuthModal('login');
  }
}

function openAuthModal(mode) {
  state.authMode = mode;
  const isReg = mode === 'register';

  $('authModalTitle').textContent = isReg ? 'Create Account' : 'Welcome back';
  $('authModalSubtitle').textContent = isReg ? 'Register to reserve luxury and economy cars' : 'Sign in to access your bookings';
  $('authName').classList.toggle('hidden', !isReg);
  $('authName').required = isReg;

  $('authToggleQuestion').textContent = isReg ? 'Already have an account?' : 'New to DriveGo?';
  $('authToggleBtn').textContent = isReg ? 'Log In' : 'Create an account';

  $('authErrorMsg').classList.add('hidden');
  openModal('authModal');
}

function fillDemoLogin(email, pass) {
  $('authEmail').value = email;
  $('authPassword').value = pass;
}
window.fillDemoLogin = fillDemoLogin;

$('authToggleBtn').onclick = () => {
  openAuthModal(state.authMode === 'login' ? 'register' : 'login');
};
$('closeAuthModal').onclick = () => closeModal('authModal');

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const endpoint = state.authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const body = {
    email: $('authEmail').value,
    password: $('authPassword').value
  };
  if (state.authMode === 'register') body.name = $('authName').value;

  try {
    const res = await api(endpoint, { method: 'POST', body });
    state.token = res.token;
    state.user = res.user;

    localStorage.setItem('dg_token', res.token);
    localStorage.setItem('dg_user', JSON.stringify(res.user));

    closeModal('authModal');
    $('authForm').reset();
    renderAuthUi();
    toast(`Welcome, ${res.user.name}!`);

    if (state.selectedCar) {
      startBooking(state.selectedCar.id);
    }
  } catch (err) {
    $('authErrorMsg').textContent = err.message;
    $('authErrorMsg').classList.remove('hidden');
  }
});

function logoutUser() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('dg_token');
  localStorage.removeItem('dg_user');
  renderAuthUi();
  toast('Signed out');
}

window.copyPromo = (code) => {
  navigator.clipboard.writeText(code).then(() => {
    toast(`Promo coupon ${code} copied to clipboard! Paste it in the booking modal.`);
  }).catch(() => {
    toast(`Promo code: ${code}`);
  });
};

/* ---------- Filter Controls Listeners ---------- */
['filterTrans', 'filterFuel', 'filterSeats', 'filterSort'].forEach(id => {
  $(id).addEventListener('change', loadFleet);
});

let searchDebounce;
$('searchInput').addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadFleet, 300);
});

$('filterPriceRange').addEventListener('input', (e) => {
  $('priceDisplayLabel').textContent = inr(e.target.value);
  loadFleet();
});

$('resetFiltersBtn').onclick = () => {
  $('searchInput').value = '';
  $('filterTrans').value = '';
  $('filterFuel').value = '';
  $('filterSeats').value = '';
  $('filterSort').value = '';
  $('filterPriceRange').value = 25000;
  $('priceDisplayLabel').textContent = inr(25000);
  state.selectedCategory = 'All';
  renderCategoryTabs();
  loadFleet();
};

$('searchBarForm').addEventListener('submit', (e) => {
  e.preventDefault();
  state.selectedCategory = $('heroCategorySelect').value;
  renderCategoryTabs();
  loadFleet();
  $('fleet').scrollIntoView({ behavior: 'smooth' });
});

$('mobileMenuBtn').onclick = () => {
  $('mobileMenu').classList.toggle('hidden');
};

/* Global Window Bindings */
window.openQuickView = openQuickView;
window.startBooking = startBooking;
window.closeModal = closeModal;

/* ---------- Bootstrap Application ---------- */
async function initApp() {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 4);

  $('heroStartDate').min = iso(today);
  $('heroStartDate').value = iso(tomorrow);
  $('heroEndDate').min = iso(tomorrow);
  $('heroEndDate').value = iso(dayAfterTomorrow);

  $('currentYear').textContent = new Date().getFullYear();

  initTheme();
  renderCategoryTabs();
  renderAuthUi();
  initCalculator();
  initFaq();
  initReviewRatingPicker();

  await loadLocationsAndExtras();
  await loadFleet();
  loadReviews();
}

window.addEventListener('DOMContentLoaded', initApp);
