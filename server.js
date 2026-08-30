import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const { Pool } = pg;
const app = express();

// Güvenlik Başlıkları (Helmet)
app.use(helmet());

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'trello_secret_key_123';

// --- RATE LIMITING (GÜVENLİK SINIRLAMALARI) ---
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Çok fazla giriş/kayıt denemesi yaptınız. Lütfen 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);

// --- POSTGRESQL BULUT (RENDER) BAĞLANTISI ---
const connectionString = process.env.DATABASE_URL || 'postgresql://trello_db_atqw_user:UD2lXny9bNRYu9bjnNoMIqMMdJp5D8Mo@dpg-da8nnjqd0e5s73974mq0-a.oregon-postgres.render.com/trello_db_atqw';

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

// Otomatik Tablo Oluşturma Fonksiyonu
const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Render PostgreSQL bulut veritabanına başarıyla bağlanıldı!');
    
    // Users tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT TRUE,
        verification_code VARCHAR(6)
      );
    `);

    // Tasks tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'TODO',
        category VARCHAR(50) DEFAULT 'Görev',
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✅ Veritabanı tabloları hazır!');
    client.release();
  } catch (err) {
    console.error('❌ Veritabanı bağlantı/tablo hatası:', err.stack);
  }
};

initDb();

// E-posta Gönderici Servisi
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'KENDI_GMAIL_ADRESIN@gmail.com',
    pass: process.env.EMAIL_PASS || 'xxxx xxxx xxxx xxxx',
  },
});

// --- JWT AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Yetkisiz erişim! Token bulunamadı.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
    req.user = user;
    next();
  });
};

// --- AUTH ROTALARI ---

// 1. KAYIT OL (Otomatik Onaylı)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      error: 'Şifre en az 8 karakter uzunluğunda olmalı, en az 1 büyük harf, 1 küçük harf ve 1 rakam içermelidir.'
    });
  }

  try {
    const userExist = await pool.query('SELECT * FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Kullanıcı adı veya email zaten kullanılıyor.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Otomatik olarak TRUE şekilde kaydediyoruz
    await pool.query(
      'INSERT INTO users (username, email, password, is_verified) VALUES ($1, $2, $3, TRUE)',
      [username, email, hashedPassword]
    );

    res.status(201).json({ message: 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.' });
  } catch (err) {
    console.error('Register Hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// 2. GİRİŞ YAP (LOGIN)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Geçersiz email veya şifre.' });

    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Geçersiz email veya şifre.' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('Login Hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// --- GÖREV ROTALARI ---

// GET: Görevleri Çek
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, status, category, created_at FROM tasks WHERE user_id = $1 ORDER BY id ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET Hatası:', err);
    res.status(500).json({ error: 'Veritabanı hatası' });
  }
});

// POST: Görev Ekle
app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, status = 'TODO', category = 'Görev' } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, status, category, user_id) VALUES ($1, $2, $3, $4) RETURNING id, title, status, category, created_at',
      [title, status, category, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST Hatası:', err);
    res.status(500).json({ error: 'Görev eklenemedi' });
  }
});

// PUT: Görev Durumunu Güncelle
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 AND user_id = $3',
      [status, id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('PUT Hatası:', err);
    res.status(500).json({ error: 'Güncelleme hatası' });
  }
});

// DELETE: Görev Sil
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE Hatası:', err);
    res.status(500).json({ error: 'Silme hatası' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Sunucu ${PORT} portunda çalışıyor.`);
});
