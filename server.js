/**
 * RIMT University — Backend API Server
 * ====================================
 * Centralized Express REST API serving the Student App (Expo RN)
 * and the Admin Portal (Next.js). All business logic, validation,
 * Supabase queries, Cloudinary signing, FCM push, and Gemini AI
 * are handled server-side.
 *
 * Endpoints:
 *   POST   /api/auth/signup              — Student registration (PENDING)
 *   POST   /api/auth/signin              — Student sign-in by roll number
 *   GET    /api/auth/status/:rollNo      — Check student approval status
 *   POST   /api/auth/signout             — Sign out (invalidate session)
 *
 *   GET    /api/students/profile/:rollNo — Fetch full student profile
 *   PATCH  /api/students/profile/:rollNo — Update student profile
 *   GET    /api/students/full/:rollNo    — Full student dossier (profile+academics+projects)
 *
 *   GET    /api/documents/:rollNo        — List student documents
 *   POST   /api/documents/upload         — Upload document via Cloudinary
 *   DELETE /api/documents/:id            — Delete a document
 *
 *   POST   /api/cloudinary/sign          — Cloudinary upload signature
 *
 *   GET    /api/placement-stats/summary      — Placement KPIs
 *   GET    /api/placement-stats/companies    — Registered companies
 *   GET    /api/placement-stats/placed-students — Placed students list
 *
 *   GET    /api/notifications            — Fetch notifications
 *   POST   /api/notifications            — Create notification
 *
 *   POST   /api/fcm/register             — Register FCM device token
 *   POST   /api/fcm/send                 — Send push notification
 *
 *   POST   /api/gemini/analyze-resume    — Gemini ATS resume analysis (proxy)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Route modules
const authRoutes = require('./src/routes/auth');
const studentRoutes = require('./src/routes/students');
const documentRoutes = require('./src/routes/documents');
const cloudinaryRoutes = require('./src/routes/cloudinary');
const placementRoutes = require('./src/routes/placement');
const notificationRoutes = require('./src/routes/notifications');
const fcmRoutes = require('./src/routes/fcm');
const geminiRoutes = require('./src/routes/gemini');

// Error handler
const { globalErrorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── GLOBAL MIDDLEWARE ──────────────────────────────────────────────

// CORS — Allow all origins in dev, restrict in production
const corsOptions = {
  origin: process.env.CORS_ORIGINS === '*'
    ? '*'
    : (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Roll-No'],
  credentials: true,
};
app.use(cors(corsOptions));

// JSON body parser (50MB limit for document uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global rate limiter: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});
app.use(globalLimiter);

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
  });
}

// ─── HEALTH CHECK ───────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'RIMT Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── ROUTE MOUNTING ─────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);
app.use('/api/placement-stats', placementRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/fcm', fcmRoutes);
app.use('/api/gemini', geminiRoutes);

// ─── ERROR HANDLING ─────────────────────────────────────────────────

app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── START SERVER ───────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   RIMT University — Backend API Server        ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║   🚀 Running on http://0.0.0.0:${PORT}           ║`);
  console.log(`║   📦 Environment: ${(process.env.NODE_ENV || 'development').padEnd(20)}     ║`);
  console.log(`║   🗄️  Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Not configured'}               ║`);
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
