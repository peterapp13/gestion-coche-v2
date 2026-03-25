# 🚗 Gestión de Vehículo - Complete Project

## 📦 Project Structure

This repository contains **TWO VERSIONS** of the same vehicle management application:

### 1. 🌐 PWA Standalone (Recommended for Personal Use)
**Location:** `/pwa-standalone/`

**Features:**
- ✅ **100% Offline** - Works without internet
- ✅ **No Backend Required** - Pure frontend with IndexedDB
- ✅ **No Authentication** - Complete privacy, data stays on device
- ✅ **Full CRUD** - Create, Read, Update, Delete in all modules
- ✅ **Auto-calculations** - KM Gastados & Consumo (L/100km)
- ✅ **CSV Export** - Download all your data
- ✅ **Installable PWA** - Add to home screen on any device
- ✅ **Dark Mode** - Professional UI optimized for workshop use
- ✅ **Responsive** - Works on iPhone, iPad, Android, and Desktop

**Quick Start:**
```bash
cd pwa-standalone
python -m http.server 8000
# Open http://localhost:8000
```

---

### 2. ☁️ Cloud Version (Expo + FastAPI + MongoDB)
**Location:** `/frontend/` and `/backend/`

**Features:**
- ✅ **Multi-user** - Google OAuth authentication
- ✅ **Cloud sync** - Data synced across all devices
- ✅ **Mobile Native** - Built with Expo/React Native
- ✅ **Backend API** - FastAPI with MongoDB

---

## 🚀 Quick Deploy PWA Standalone

**GitHub Pages (Free):**
```bash
# The PWA standalone version is ready to deploy!
# Just push to GitHub and enable GitHub Pages
```

**Run Locally:**
```bash
cd pwa-standalone
python -m http.server 8000
```

---

## 📱 Features

### ⛽ Repostajes (Fuel)
- Full CRUD (Create, Read, Update, Delete)
- Auto-calculates KM Gastados
- Auto-calculates Consumo (L/100km)

### 📦 Almacén (Parts)
- Full CRUD operations
- Status tracking (Pending/Installed)

### 🔧 Taller (Workshop)
- Full CRUD operations
- Maintenance history with notes

### 📊 Export
- Download all data to CSV
- Compatible with Excel/Google Sheets

---

## 📖 Full Documentation

See `/pwa-standalone/README.md` for complete PWA documentation.

---

**Version**: 1.0.0  
**License**: MIT  
**Enjoy managing your vehicle! 🚗💨**
