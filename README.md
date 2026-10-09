# 🚗 DriveGo – Luxury & Self-Drive Car Rental Web App

An end-to-end full-stack car rental platform crafted with **Advanced Tailwind CSS**, **Vanilla HTML5 & Modern JavaScript**, and a **Zero-Dependency Node.js Backend**.

---

## ✨ Features Overview

### 🎨 Frontend (Advanced Tailwind CSS & Modern JS)
- **Luxury Automotive UI:** Designed with modern glassmorphism (`backdrop-blur-md`), ambient glowing gradients, fluid typography, smooth hover card lifts, and sleek micro-interactions.
- **Dark & Light Mode:** Persisted in `localStorage` with automated system preference detection.
- **Multi-Currency Live Converter:** Switch between **INR (₹)**, **USD ($)**, and **EUR (€)** with real-time rate conversion across the entire app.
- **Hero Booking Widget:** Interactive pickup/dropoff selector, dates & times picker, and vehicle category selector.
- **Fleet Catalog & Filters:**
  - Category Pills (All, SUVs & 4x4, Sedans, Luxury & Sports, Electric EV, Hatchbacks, 7-Seater MPVs).
  - Live debounced keyword search (brand, model name, features like *Sunroof*, *ADAS*).
  - Transmission (Automatic / Manual), Fuel (Petrol / Diesel / Electric), and Seats filters.
  - Interactive budget slider with dynamic price ceiling.
  - Sort by Featured, Price (Low to High / High to Low), Top Customer Rated, and Most Booked.
  - Grid View & Compact List View toggle.
- **Car Detail & Specifications Modal:**
  - High-res photo gallery.
  - Complete specs matrix: Seating, Gearbox, Fuel economy, 0-100 km/h acceleration, Top speed, Luggage.
  - Included amenities & comfort tags.
  - Customer reviews with 5-star rating breakdown and interactive review submission form.
- **Car Comparison Tool:**
  - Select up to 3 cars to inspect side-by-side in a responsive floating comparison drawer.
- **Multi-Step Checkout & Booking Flow:**
  - Date and branch selection.
  - Protection & Add-ons: Zero-Liability Full Protection, GPS Navigation, Child Safety Seat, Professional Chauffeur, Unlimited Km.
  - Working Promo Codes: `DRIVE20` (20% OFF), `FIRST10` (10% OFF), `WEEKEND15` (15% OFF), `VIP500` (Flat ₹500 OFF).
  - Simulated Payment Methods: Interactive 3D Credit Card preview with live card flipping, UPI / QR Code scanner, and Pay at Branch.
  - Live transparent pricing receipt (Base rate, 7+ day discount, add-ons, coupon discount, 18% GST, refundable deposit).
- **My Bookings & Tax Invoice Generator:**
  - Real-time booking history with status badges (`Confirmed`, `Active`, `Completed`, `Cancelled`).
  - Printable PDF-styled Tax Invoice Receipt modal with reference ID, itemized breakdown, and print trigger (`window.print()`).
  - 1-Click Trip Cancellation with automated full refund simulation.
- **Wishlist / Favorites:** Bookmark cars with animated heart icons, persisted in `localStorage`.
- **FAQ Accordion & Customer Reviews:** Interactive collapsible accordion and verified renter reviews.

### ⚙️ Backend (Zero-Dependency Node.js Server)
- Native Node.js HTTP server utilizing only built-in modules (`http`, `crypto`, `fs`, `path`).
- **No external npm modules required!** Runs out of the box with zero installation friction.
- Password hashing using `crypto.scryptSync` with unique salts.
- HMAC SHA-256 signed session tokens with expiration.
- Auto-seeding JSON database (`data/db.json`) initialized from `data/seed-cars.json`.
- Full REST API with collision/overlap booking protection.
- Complete **Admin Dashboard** with fleet management (Add, Edit, Delete, Toggle Maintenance) and platform-wide booking status updates.

---

## 🚀 Quick Start Guide

### Requirements
- **Node.js 16+** installed.
- Internet connection (for Google Fonts & Tailwind CDN script).

### Running the App

#### Windows (Easiest):
Double-click `start.bat` or run in terminal:
```cmd
node server.js
```

#### macOS / Linux:
```bash
chmod +x start.sh
./start.sh
```

#### Or with npm:
```bash
npm start
```

Then open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 👥 Demo User Credentials

| Role | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Demo Customer** | `customer@drivego.com` | `drive123` | Book cars, write reviews, view bookings, print invoices |
| **Fleet Admin** | `admin@drivego.com` | `admin123` | Full access + Admin Hub, Fleet CRUD, Booking status manager |

*(Quick 1-Click login buttons are also available directly on the login modal!)*

---

## 🎟️ Active Promo Codes

| Code | Discount | Terms |
| :--- | :--- | :--- |
| `DRIVE20` | **20% OFF** | Max discount ₹3,500 |
| `FIRST10` | **10% OFF** | Max discount ₹2,000 |
| `WEEKEND15` | **15% OFF** | Max discount ₹2,500 |
| `VIP500` | **₹500 Flat** | Flat discount on any rental |

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/cars` | Query cars by type, gearbox, fuel, seats, price, dates, search, sort |
| `GET` | `/api/cars/:id` | Single car details with customer reviews |
| `POST` | `/api/cars/:id/reviews` | Submit a review `{ rating, comment, author }` |
| `GET` | `/api/extras` | Available trip add-ons with pricing |
| `GET` | `/api/locations` | Available pickup and return branches |
| `POST` | `/api/coupons/validate` | Check promo code validity and discount |
| `POST` | `/api/quote` | Calculate itemized quote breakdown |
| `POST` | `/api/auth/register` | Create customer account |
| `POST` | `/api/auth/login` | Sign in with email and password |
| `GET` | `/api/auth/me` | Fetch authenticated user profile |
| `PUT` | `/api/auth/me` | Update profile information |
| `GET` | `/api/bookings` | List authenticated user's reservations |
| `POST` | `/api/bookings` | Create new reservation (with double-booking guard) |
| `DELETE` | `/api/bookings/:id` | Cancel reservation (full refund) |
| `GET` | `/api/admin/stats` | Admin KPIs (revenue, booking count, fleet size) |
| `GET` | `/api/admin/bookings` | Admin view of all platform bookings |
| `PATCH`| `/api/admin/bookings/:id`| Admin change booking status (`confirmed`, `active`, `completed`, `cancelled`) |
| `POST` | `/api/admin/cars` | Admin add new car to fleet |
| `PUT` | `/api/admin/cars/:id` | Admin update car specs or maintenance hold |
| `DELETE`| `/api/admin/cars/:id`| Admin remove car from fleet |

---

## 📂 Project Structure

```
car-rental-app/
├── server.js            # Zero-dependency Node.js HTTP server & REST APIs
├── package.json         # Project metadata and run scripts
├── start.bat            # One-click Windows runner
├── start.sh             # One-click macOS/Linux runner
├── README.md            # Complete documentation
├── data/
│   ├── seed-cars.json   # High-resolution initial fleet seed
│   └── db.json          # Persistent JSON database (auto-created on startup)
└── public/
    ├── index.html       # Single-page web app with Tailwind CSS UI
    ├── app.js           # Client-side state, reactive UI, and API integrations
    └── style.css        # Custom glassmorphism, animations, print invoice styles
```

---

## 📜 License
MIT License. Free to use, adapt, and build upon for personal or commercial projects.
