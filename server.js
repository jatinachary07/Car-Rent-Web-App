/* DriveGo – Advanced Car Rental Web App
   Zero-dependency Node.js backend (native HTTP, crypto, fs, path modules only)
*/
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;

const APP_DIR = fs.existsSync(path.join(__dirname, 'public'))
  ? __dirname
  : fs.existsSync(path.join(__dirname, '..', 'public'))
    ? path.dirname(__dirname)
    : __dirname;

const SECRET = process.env.SECRET || 'drivego-super-secret-key-2026';

const DATA_DIR = path.join(APP_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SEED_FILE = path.join(DATA_DIR, 'seed-cars.json');
const PUBLIC_DIR = path.join(APP_DIR, 'public');

/* ---------- INITIAL DATA & DB LAYER ---------- */
const LOCATIONS = [
  'Indira Gandhi Int. Airport (Terminal 3)',
  'City Center Downtown Hub (MG Road)',
  'Central Railway Station (North Gate)',
  'Cyber City Tech Park Hub',
  'South Extension Premium Lounge',
  'Doorstep Home / Hotel Delivery'
];

const EXTRAS = {
  insurance: { label: 'Zero-Liability Full Protection', perDay: 300, icon: '🛡️', desc: 'Zero deductible. Covers collisions, glass, and tires.' },
  gps: { label: 'GPS Satellite Navigation', perDay: 150, icon: '📍', desc: 'Live traffic updates and offline route guidance.' },
  childSeat: { label: 'Child Safety Seat (ISOFIX)', perDay: 100, icon: '👶', desc: 'Certified ergonomic seat suitable for all ages.' },
  driver: { label: 'Professional Chauffeur', perDay: 1000, icon: '🧑‍✈️', desc: 'Courteous, verified driver for stress-free travel.' },
  unlimitedKm: { label: 'Unlimited Kilometers Pack', perDay: 250, icon: '⚡', desc: 'No daily distance limits or excess kilometer charges.' }
};

const COUPONS = {
  'DRIVE20': { type: 'percent', value: 20, maxDiscount: 3500, desc: '20% off up to ₹3,500' },
  'FIRST10': { type: 'percent', value: 10, maxDiscount: 2000, desc: '10% off your first drive' },
  'WEEKEND15': { type: 'percent', value: 15, maxDiscount: 2500, desc: '15% weekend special discount' },
  'VIP500': { type: 'flat', value: 500, maxDiscount: 500, desc: 'Flat ₹500 discount' }
};

const INITIAL_REVIEWS = [
  { id: 1, carId: 10, author: "Vikram Malhotra", rating: 5, date: "2026-09-18", comment: "The BMW M340i was in pristine showroom condition! Effortless acceleration and smooth pickup at Airport T3." },
  { id: 2, carId: 10, author: "Pooja Hegde", rating: 5, date: "2026-08-25", comment: "Outstanding service. The exhaust sound and handling on the expressway were breathtaking." },
  { id: 3, carId: 5, author: "Rahul Sharma", rating: 5, date: "2026-09-02", comment: "Creta Knight Edition was super comfortable for our family trip to Agra. Panoramic sunroof made the drive awesome!" },
  { id: 4, carId: 6, author: "Aman Preet", rating: 5, date: "2026-09-14", comment: "Thar 4x4 handled rough trails with zero trouble. Bluetooth, AC, and build quality were top notch." },
  { id: 5, carId: 9, author: "Dr. Ananya Roy", rating: 5, date: "2026-09-20", comment: "Tesla Model 3 Autopilot is magic. Super quiet, extremely quick, and cost practically nothing to charge." },
  { id: 6, carId: 3, author: "Karan Johar", rating: 4, date: "2026-08-30", comment: "Honda City had huge legroom in the rear and great luggage space. Very clean interior." }
];

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hash] = (stored || '').split(':');
    if (!salt || !hash) return false;
    const test = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch {
    return false;
  }
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 14 * 24 * 3600 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function loadDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  let cars = [];
  if (fs.existsSync(SEED_FILE)) {
    try { cars = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')); } catch { cars = []; }
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialUsers = [
      {
        id: 1,
        name: "Alex Johnson",
        email: "customer@drivego.com",
        phone: "+91 98765 43210",
        licenseNumber: "DL-04202300892",
        role: "user",
        password: hashPassword("drive123"),
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        name: "Fleet Administrator",
        email: "admin@drivego.com",
        phone: "+91 98888 77777",
        licenseNumber: "DL-ADMIN-01",
        role: "admin",
        password: hashPassword("admin123"),
        createdAt: new Date().toISOString()
      }
    ];

    const initialBookings = [
      {
        id: 1,
        ref: "DG-7A39B",
        userId: 1,
        userName: "Alex Johnson",
        carId: 5,
        carName: "Hyundai Creta SX(O) Knight Edition",
        start: "2026-10-15",
        end: "2026-10-18",
        pickupTime: "10:00 AM",
        returnTime: "10:00 AM",
        pickupLocation: "Indira Gandhi Int. Airport (Terminal 3)",
        returnLocation: "Indira Gandhi Int. Airport (Terminal 3)",
        days: 3,
        extras: ["insurance", "gps"],
        promoCode: "DRIVE20",
        base: 13200,
        extrasTotal: 1350,
        durationDiscount: 0,
        promoDiscount: 2910,
        tax: 2095,
        deposit: 3000,
        total: 13735,
        status: "confirmed",
        paymentMethod: "Credit Card (•••• 4242)",
        createdAt: "2026-10-08T14:20:00.000Z"
      }
    ];

    const db = {
      cars,
      users: initialUsers,
      bookings: initialBookings,
      reviews: INITIAL_REVIEWS,
      coupons: COUPONS,
      nextId: 100
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }

  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!db.cars || db.cars.length === 0) db.cars = cars;
    if (!db.reviews) db.reviews = INITIAL_REVIEWS;
    if (!db.coupons) db.coupons = COUPONS;
    if (!db.users || db.users.length === 0) {
      db.users = [
        { id: 1, name: "Alex Johnson", email: "customer@drivego.com", phone: "+91 98765 43210", licenseNumber: "DL-04202300892", role: "user", password: hashPassword("drive123") },
        { id: 2, name: "Fleet Administrator", email: "admin@drivego.com", phone: "+91 98888 77777", licenseNumber: "DL-ADMIN-01", role: "admin", password: hashPassword("admin123") }
      ];
    }
    return db;
  } catch (err) {
    console.error("Error reading db.json, repairing...", err);
    const db = { cars, users: [], bookings: [], reviews: INITIAL_REVIEWS, coupons: COUPONS, nextId: 100 };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/* ---------- PRICING & LOGIC ---------- */
const GST = 0.18;
const REFUNDABLE_DEPOSIT = 3000;

function parseDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

const dayCount = (start, end) => Math.max(1, Math.round((end - start) / 86400000));
const overlaps = (b, start, end) => start < parseDate(b.end) && end > parseDate(b.start);

function isCarAvailable(db, carId, start, end, excludeBookingId = null) {
  const car = db.cars.find(c => c.id === Number(carId));
  if (!car || car.isMaintenance) return false;
  return !db.bookings.some(b => 
    b.carId === Number(carId) && 
    b.status !== 'cancelled' && 
    (!excludeBookingId || b.id !== excludeBookingId) &&
    overlaps(b, start, end)
  );
}

function calculateQuote(db, carId, startStr, endStr, extras = [], promoCode = '') {
  const car = db.cars.find(c => c.id === Number(carId));
  if (!car) return { error: 'Car not found', status: 404 };
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!start || !end) return { error: 'Please choose valid pickup and return dates', status: 400 };

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = parseDate(todayStr);
  if (start < today) return { error: 'Pickup date cannot be in the past', status: 400 };

  const days = dayCount(start, end);
  if (days < 1) return { error: 'Return date must be at least 1 day after pickup date', status: 400 };
  if (days > 90) return { error: 'Maximum rental period is 90 days', status: 400 };

  const chosenExtras = (Array.isArray(extras) ? extras : []).filter(e => EXTRAS[e]);
  const base = car.pricePerDay * days;
  const extrasTotal = chosenExtras.reduce((sum, e) => sum + EXTRAS[e].perDay * days, 0);

  // 10% discount for 7+ days rental
  const durationDiscount = days >= 7 ? Math.round(base * 0.10) : 0;
  let subtotal = base + extrasTotal - durationDiscount;

  // Coupon discount
  let promoDiscount = 0;
  let appliedCoupon = null;
  if (promoCode) {
    const codeKey = promoCode.trim().toUpperCase();
    const coupon = db.coupons[codeKey];
    if (coupon) {
      if (coupon.type === 'percent') {
        promoDiscount = Math.min(Math.round(subtotal * (coupon.value / 100)), coupon.maxDiscount);
      } else if (coupon.type === 'flat') {
        promoDiscount = Math.min(coupon.value, subtotal);
      }
      appliedCoupon = { code: codeKey, discount: promoDiscount, desc: coupon.desc };
      subtotal = Math.max(0, subtotal - promoDiscount);
    }
  }

  const tax = Math.round(subtotal * GST);
  const deposit = REFUNDABLE_DEPOSIT;
  const total = subtotal + tax + deposit;

  return {
    car,
    days,
    base,
    extrasTotal,
    durationDiscount,
    promoDiscount,
    appliedCoupon,
    subtotal,
    tax,
    deposit,
    total,
    extras: chosenExtras
  };
}

/* ---------- HTTP UTILITIES ---------- */
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2e6) {
        reject(new HttpError(413, 'Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getAuthUser(req) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '');
  return verifyToken(token);
}

function requireUser(req) {
  const user = getAuthUser(req);
  if (!user) throw new HttpError(401, 'Please log in to continue');
  return user;
}

function requireAdmin(req) {
  const user = requireUser(req);
  const db = loadDb();
  const dbUser = db.users.find(u => u.id === user.id);
  if (!dbUser || dbUser.role !== 'admin') {
    throw new HttpError(403, 'Administrator access required');
  }
  return dbUser;
}

/* ---------- ROUTING ---------- */
const routes = [];
const route = (method, pattern, handler) => {
  routes.push({ method, regex: new RegExp('^' + pattern + '$'), handler });
};

// 1. Static Configuration & Metadata
route('GET', '/api/extras', async () => [200, EXTRAS]);
route('GET', '/api/locations', async () => [200, LOCATIONS]);

// 2. Validate Coupons
route('POST', '/api/coupons/validate', async ({ body }) => {
  const { code, amount = 0 } = body;
  if (!code) throw new HttpError(400, 'Coupon code is required');
  const db = loadDb();
  const c = db.coupons[(code || '').trim().toUpperCase()];
  if (!c) throw new HttpError(404, 'Invalid coupon code. Try DRIVE20 or FIRST10');
  
  let discount = 0;
  if (c.type === 'percent') {
    discount = Math.min(Math.round((amount || 0) * (c.value / 100)), c.maxDiscount);
  } else {
    discount = Math.min(c.value, amount || c.value);
  }
  return [200, { valid: true, code: code.toUpperCase(), discount, desc: c.desc }];
});

// 3. Cars fleet with smart filtering, search, sorting
route('GET', '/api/cars', async ({ query }) => {
  const db = loadDb();
  const params = Object.fromEntries(query);
  const { type, transmission, fuel, search, minPrice, maxPrice, seats, sort, start, end } = params;

  let list = db.cars.slice();

  if (type && type !== 'All') {
    list = list.filter(c => c.type.toLowerCase() === type.toLowerCase());
  }
  if (transmission) {
    list = list.filter(c => c.transmission.toLowerCase() === transmission.toLowerCase());
  }
  if (fuel) {
    list = list.filter(c => c.fuel.toLowerCase() === fuel.toLowerCase());
  }
  if (seats) {
    list = list.filter(c => c.seats >= Number(seats));
  }
  if (minPrice) {
    list = list.filter(c => c.pricePerDay >= Number(minPrice));
  }
  if (maxPrice) {
    list = list.filter(c => c.pricePerDay <= Number(maxPrice));
  }
  if (search) {
    const q = search.toLowerCase().trim();
    list = list.filter(c =>
      `${c.brand} ${c.name} ${c.type} ${(c.features || []).join(' ')}`.toLowerCase().includes(q)
    );
  }

  const s = parseDate(start);
  const e = parseDate(end);
  list = list.map(c => ({
    ...c,
    available: s && e ? isCarAvailable(db, c.id, s, e) : (!c.isMaintenance)
  }));

  if (sort === 'price-asc') list.sort((a, b) => a.pricePerDay - b.pricePerDay);
  else if (sort === 'price-desc') list.sort((a, b) => b.pricePerDay - a.pricePerDay);
  else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
  else if (sort === 'popular') list.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0));

  return [200, list];
});

// 4. Single car with reviews
route('GET', '/api/cars/(\\d+)', async ({ params }) => {
  const db = loadDb();
  const carId = Number(params[0]);
  const car = db.cars.find(c => c.id === carId);
  if (!car) throw new HttpError(404, 'Car not found');
  const reviews = (db.reviews || []).filter(r => r.carId === carId);
  return [200, { ...car, reviews }];
});

// 5. Add car review
route('POST', '/api/cars/(\\d+)/reviews', async ({ req, params, body }) => {
  const db = loadDb();
  const carId = Number(params[0]);
  const car = db.cars.find(c => c.id === carId);
  if (!car) throw new HttpError(404, 'Car not found');

  const auth = getAuthUser(req);
  const authorName = (auth ? auth.name : body.author) || 'Anonymous Renter';
  const rating = Math.min(5, Math.max(1, Number(body.rating) || 5));
  const comment = (body.comment || '').trim();
  if (!comment) throw new HttpError(400, 'Please write a review comment');

  const newReview = {
    id: db.nextId++,
    carId,
    author: authorName,
    rating,
    date: new Date().toISOString().slice(0, 10),
    comment
  };

  db.reviews.push(newReview);
  // Recalculate average car rating
  const carReviews = db.reviews.filter(r => r.carId === carId);
  const avgRating = Number((carReviews.reduce((sum, r) => sum + r.rating, 0) / carReviews.length).toFixed(1));
  car.rating = avgRating;
  car.reviewsCount = carReviews.length;

  saveDb(db);
  return [201, { review: newReview, updatedRating: avgRating, reviewsCount: car.reviewsCount }];
});

// 6. User Auth & Profile
route('POST', '/api/auth/register', async ({ body }) => {
  const { name, email, password, phone, licenseNumber } = body;
  if (!name || !email || !password) throw new HttpError(400, 'Name, email, and password are required');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Please enter a valid email address');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters long');

  const db = loadDb();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const user = {
    id: db.nextId++,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone ? phone.trim() : '+91 98765 00000',
    licenseNumber: licenseNumber ? licenseNumber.trim() : 'DL-VERIFIED-PASS',
    role: 'user',
    password: hashPassword(password),
    createdAt: new Date().toISOString()
  };

  db.users.push(user);
  saveDb(db);

  const token = signToken({ id: user.id, name: user.name, role: user.role });
  return [201, {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, licenseNumber: user.licenseNumber }
  }];
});

route('POST', '/api/auth/login', async ({ body }) => {
  const { email, password } = body;
  if (!email || !password) throw new HttpError(400, 'Email and password are required');

  const db = loadDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user || !verifyPassword(password, user.password)) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = signToken({ id: user.id, name: user.name, role: user.role || 'user' });
  return [200, {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role || 'user', phone: user.phone, licenseNumber: user.licenseNumber }
  }];
});

route('GET', '/api/auth/me', async ({ req }) => {
  const auth = requireUser(req);
  const db = loadDb();
  const user = db.users.find(u => u.id === auth.id);
  if (!user) throw new HttpError(404, 'User not found');
  return [200, {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    licenseNumber: user.licenseNumber,
    role: user.role || 'user'
  }];
});

route('PUT', '/api/auth/me', async ({ req, body }) => {
  const auth = requireUser(req);
  const db = loadDb();
  const user = db.users.find(u => u.id === auth.id);
  if (!user) throw new HttpError(404, 'User not found');

  if (body.name) user.name = body.name.trim();
  if (body.phone) user.phone = body.phone.trim();
  if (body.licenseNumber) user.licenseNumber = body.licenseNumber.trim();

  saveDb(db);
  return [200, {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    licenseNumber: user.licenseNumber,
    role: user.role
  }];
});

// 7. Instant Quote Calculator
route('POST', '/api/quote', async ({ body }) => {
  const db = loadDb();
  const q = calculateQuote(db, body.carId, body.start, body.end, body.extras, body.promoCode);
  if (q.error) throw new HttpError(q.status, q.error);
  return [200, q];
});

// 8. Bookings
route('POST', '/api/bookings', async ({ req, body }) => {
  const auth = requireUser(req);
  const db = loadDb();

  const q = calculateQuote(db, body.carId, body.start, body.end, body.extras, body.promoCode);
  if (q.error) throw new HttpError(q.status, q.error);

  const start = parseDate(body.start);
  const end = parseDate(body.end);
  if (!isCarAvailable(db, q.car.id, start, end)) {
    throw new HttpError(409, 'Sorry! This vehicle was just booked for the selected dates. Please pick alternative dates or another car.');
  }

  const booking = {
    id: db.nextId++,
    ref: 'DG-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    userId: auth.id,
    userName: auth.name,
    carId: q.car.id,
    carName: `${q.car.brand} ${q.car.name}`,
    carImage: q.car.image,
    start: body.start,
    end: body.end,
    pickupTime: body.pickupTime || '10:00 AM',
    returnTime: body.returnTime || '10:00 AM',
    pickupLocation: body.pickupLocation || LOCATIONS[0],
    returnLocation: body.returnLocation || body.pickupLocation || LOCATIONS[0],
    days: q.days,
    extras: q.extras,
    promoCode: body.promoCode ? body.promoCode.trim().toUpperCase() : null,
    base: q.base,
    extrasTotal: q.extrasTotal,
    durationDiscount: q.durationDiscount,
    promoDiscount: q.promoDiscount,
    tax: q.tax,
    deposit: q.deposit,
    total: q.total,
    status: 'confirmed',
    paymentMethod: body.paymentMethod || 'Credit Card (•••• 4242)',
    driverName: body.driverName || auth.name,
    driverPhone: body.driverPhone || '+91 98765 43210',
    createdAt: new Date().toISOString()
  };

  db.bookings.push(booking);
  saveDb(db);
  return [201, booking];
});

route('GET', '/api/bookings', async ({ req }) => {
  const auth = requireUser(req);
  const db = loadDb();
  const bookings = db.bookings.filter(b => b.userId === auth.id).sort((a, b) => b.id - a.id);
  return [200, bookings];
});

route('GET', '/api/bookings/(\\d+)', async ({ req, params }) => {
  const auth = requireUser(req);
  const db = loadDb();
  const booking = db.bookings.find(b => b.id === Number(params[0]) && (b.userId === auth.id || auth.role === 'admin'));
  if (!booking) throw new HttpError(404, 'Booking not found');
  const car = db.cars.find(c => c.id === booking.carId);
  return [200, { ...booking, car }];
});

route('DELETE', '/api/bookings/(\\d+)', async ({ req, params }) => {
  const auth = requireUser(req);
  const db = loadDb();
  const booking = db.bookings.find(b => b.id === Number(params[0]) && (b.userId === auth.id || auth.role === 'admin'));
  if (!booking) throw new HttpError(404, 'Booking not found');
  if (booking.status === 'cancelled') throw new HttpError(400, 'This booking has already been cancelled');

  booking.status = 'cancelled';
  booking.cancelledAt = new Date().toISOString();
  saveDb(db);
  return [200, { success: true, booking }];
});

// 9. Admin Endpoints
route('GET', '/api/admin/stats', async ({ req }) => {
  requireAdmin(req);
  const db = loadDb();
  const confirmed = db.bookings.filter(b => b.status !== 'cancelled');
  const totalRevenue = confirmed.reduce((sum, b) => sum + (b.total - (b.deposit || 0)), 0);
  const activeBookings = confirmed.filter(b => b.status === 'confirmed' || b.status === 'active').length;

  return [200, {
    totalRevenue,
    totalBookings: db.bookings.length,
    activeBookings,
    fleetCount: db.cars.length,
    usersCount: db.users.length
  }];
});

route('GET', '/api/admin/bookings', async ({ req }) => {
  requireAdmin(req);
  const db = loadDb();
  return [200, db.bookings.slice().sort((a, b) => b.id - a.id)];
});

route('PATCH', '/api/admin/bookings/(\\d+)', async ({ req, params, body }) => {
  requireAdmin(req);
  const db = loadDb();
  const booking = db.bookings.find(b => b.id === Number(params[0]));
  if (!booking) throw new HttpError(404, 'Booking not found');

  if (body.status) {
    const valid = ['confirmed', 'active', 'completed', 'cancelled'];
    if (!valid.includes(body.status)) throw new HttpError(400, 'Invalid status');
    booking.status = body.status;
  }
  saveDb(db);
  return [200, booking];
});

route('POST', '/api/admin/cars', async ({ req, body }) => {
  requireAdmin(req);
  const db = loadDb();
  const { name, brand, type, seats, transmission, fuel, pricePerDay, image, features, description } = body;
  if (!name || !brand || !pricePerDay) throw new HttpError(400, 'Name, brand, and price are required');

  const newCar = {
    id: db.nextId++,
    name: name.trim(),
    brand: brand.trim(),
    type: type || 'Sedan',
    seats: Number(seats) || 5,
    transmission: transmission || 'Automatic',
    fuel: fuel || 'Petrol',
    pricePerDay: Number(pricePerDay),
    rating: 5.0,
    reviewsCount: 1,
    hue: Math.floor(Math.random() * 360),
    image: image || 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
    gallery: [image || 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80'],
    mileage: body.mileage || '16 km/l',
    acceleration: body.acceleration || '8.5s (0-100)',
    topSpeed: body.topSpeed || '200 km/h',
    luggage: body.luggage || '3 Bags',
    year: new Date().getFullYear(),
    badge: body.badge || 'New Fleet Addition',
    description: description || 'Premium vehicle maintained to the highest standards.',
    features: Array.isArray(features) ? features : (features ? features.split(',').map(s => s.trim()) : ['AC', 'Touchscreen', 'Airbags'])
  };

  db.cars.unshift(newCar);
  saveDb(db);
  return [201, newCar];
});

route('PUT', '/api/admin/cars/(\\d+)', async ({ req, params, body }) => {
  requireAdmin(req);
  const db = loadDb();
  const car = db.cars.find(c => c.id === Number(params[0]));
  if (!car) throw new HttpError(404, 'Car not found');

  ['name', 'brand', 'type', 'transmission', 'fuel', 'image', 'mileage', 'acceleration', 'topSpeed', 'luggage', 'badge', 'description'].forEach(field => {
    if (body[field] !== undefined) car[field] = body[field];
  });
  if (body.seats !== undefined) car.seats = Number(body.seats);
  if (body.pricePerDay !== undefined) car.pricePerDay = Number(body.pricePerDay);
  if (body.isMaintenance !== undefined) car.isMaintenance = Boolean(body.isMaintenance);
  if (Array.isArray(body.features)) car.features = body.features;

  saveDb(db);
  return [200, car];
});

route('DELETE', '/api/admin/cars/(\\d+)', async ({ req, params }) => {
  requireAdmin(req);
  const db = loadDb();
  const carId = Number(params[0]);
  const index = db.cars.findIndex(c => c.id === carId);
  if (index === -1) throw new HttpError(404, 'Car not found');

  const removed = db.cars.splice(index, 1)[0];
  saveDb(db);
  return [200, { success: true, removed }];
});

/* ---------- STATIC FILE SERVING ---------- */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, pathname) {
  let relPath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.normalize(path.join(PUBLIC_DIR, relPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Access forbidden' });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return sendJson(res, 404, { error: 'File not found' });
      }
      return sendJson(res, 500, { error: 'Error reading file' });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': data.length
    });
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(data);
    }
  });
}

/* ---------- SERVER INITIALIZATION ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    if (url.pathname.startsWith('/api/')) {
      for (const r of routes) {
        const match = r.method === req.method && url.pathname.match(r.regex);
        if (!match) continue;

        const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
        const [status, data] = await r.handler({
          req,
          body,
          query: url.searchParams,
          params: match.slice(1)
        });
        return sendJson(res, status, data);
      }
      return sendJson(res, 404, { error: `Endpoint not found: ${req.method} ${url.pathname}` });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return sendJson(res, 405, { error: 'Method not allowed for static assets' });
    }

    serveStatic(req, res, url.pathname);
  } catch (err) {
    if (err instanceof HttpError) {
      return sendJson(res, err.status, { error: err.message });
    }
    console.error('Unhandled Server Error:', err);
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

// Error handlers
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error('Server error:', err);
  }
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Seed DB on startup
loadDb();

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚗 DriveGo Fullstack App Running`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`👤 Customer Demo: customer@drivego.com / drive123`);
  console.log(`🔑 Admin Demo:    admin@drivego.com / admin123`);
  console.log(`===============================================`);
});
