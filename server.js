import express from 'express';
import cors from 'cors';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Resend } from 'resend';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const { Pool } = pg;
const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'trello_secret_key_123';
const resend = new Resend(process.env.RESEND_API_KEY || 're_test_key');

// RATE LIMIT (Test ortamı için esnek ayarlar)
const generalLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 100,
  message: { error: 'Çok hızlı istek gönderdiniz. Lütfen 30 saniye bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 100,
  message: { error: 'Çok fazla deneme yaptınız. Lütfen 30 saniye bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', generalLimiter);

const connectionString = process.env.DATABASE_URL || 'postgresql://trello_db_atqw_user:UD2lXny9bNRYu9bjnNoMIqMMdJp5D8Mo@dpg-da8nnjqd0e5s73974mq0-a.oregon-postgres.render.com/trello_db_atqw';

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

const initDb = async () => {
  try {
    const client = await pool.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(6)
      );
    `);

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

    client.release();
  } catch (err) {
    console.error('Veritabanı hatası:', err.stack);
  }
};

initDb();

const sendVerificationEmail = async (email, username, code) => {
  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'E-posta Doğrulama Kodu',
      html: `<h2>Hoş Geldiniz, ${username}!</h2><p>Proje Yönetim Panosu doğrulama kodunuz: <strong>${code}</strong></p>`
    });
  } catch (e) {
    console.error('Resend Mail Hatası:', e);
  }
};

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

// ADMIN TEMİZLEME ROTASI
app.get('/api/admin/clean-all', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE users CASCADE');
    res.json({ message: 'Tüm kullanıcılar ve veriler başarıyla sıfırlandı.' });
  } catch (err) {
    res.status(500).json({ error: 'Temizleme hatası' });
  }
});

// 1. KAYIT OL
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { username, email, password } = req.body;
  const cleanEmail = email.trim().toLowerCase();

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      error: 'Şifre en az 8 karakter uzunluğunda olmalı, en az 1 büyük harf, 1 küçük harf ve 1 rakam içermelidir.'
    });
  }

  try {
    const userExist = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = LOWER($2)', 
      [cleanEmail, username]
    );
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (userExist.rows.length > 0) {
      const existingUser = userExist.rows[0];

      if (!existingUser.is_verified) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.query(
          'UPDATE users SET username = $1, password = $2, verification_code = $3 WHERE id = $4',
          [username, hashedPassword, verificationCode, existingUser.id]
        );

        console.log(`[DOĞRULAMA KODU]: ${verificationCode}`);
        sendVerificationEmail(cleanEmail, username, verificationCode);

        return res.status(200).json({
          message: 'Hesabınız henüz doğrulanmamıştı. Yeni doğrulama kodu gönderildi.',
          needsVerification: true,
          email: cleanEmail
        });
      }

      return res.status(400).json({ error: 'Bu kullanıcı adı veya e-posta adresi zaten kullanılıyor.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO users (username, email, password, verification_code, is_verified) VALUES ($1, $2, $3, $4, FALSE)',
      [username, cleanEmail, hashedPassword, verificationCode]
    );

    console.log(`[DOĞRULAMA KODU]: ${verificationCode}`);
    sendVerificationEmail(cleanEmail, username, verificationCode);

    return res.status(201).json({
      message: 'Kayıt alındı. Lütfen e-postanıza gelen doğrulama kodunu girin.',
      needsVerification: true,
      email: cleanEmail
    });

  } catch (err) {
    console.error('Register Hatası:', err);
    res.status(500).json({ error: 'Veritabanı hatası oluştu.' });
  }
});

// 2. KODU DOĞRULA (VERIFY) - (Kullanıcı bulunamadı hatası düzeltildi)
app.post('/api/auth/verify', authLimiter, async (req, res) => {
  const { email, code } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta adresi eksik.' });

  const cleanEmail = email.trim().toLowerCase();

  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1', 
      [cleanEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Kullanıcı bulunamadı.' });
    }

    const user = userResult.rows[0];
    
    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Girdiğiniz doğrulama kodu hatalı!' });
    }

    await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_code = NULL WHERE id = $1', 
      [user.id]
    );

    res.json({ message: 'E-posta başarıyla doğrulandı. Şimdi giriş yapabilirsiniz!' });
  } catch (err) {
    console.error('Verify Hatası:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// 3. GİRİŞ YAP (LOGIN)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const cleanEmail = email.trim().toLowerCase();

  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1', 
      [cleanEmail]
    );

    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Geçersiz email veya şifre.' });

    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Geçersiz email veya şifre.' });

    if (!user.is_verified) {
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      await pool.query('UPDATE users SET verification_code = $1 WHERE id = $2', [newCode, user.id]);
      
      console.log(`[DOĞRULAMA KODU]: ${newCode}`);
      sendVerificationEmail(cleanEmail, user.username, newCode);

      return res.status(403).json({ 
        error: 'Lütfen önce e-posta adresinizi doğrulayın! Yeni kod gönderildi.',
        needsVerification: true,
        email: cleanEmail 
      });
    }

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

// GÖREV ROTALARI
app.get('/api/tasks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, status, category, created_at FROM tasks WHERE user_id = $1 ORDER BY id ASC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Veritabanı hatası' });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, status = 'TODO', category = 'Görev' } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, status, category, user_id) VALUES ($1, $2, $3, $4) RETURNING id, title, status, category, created_at',
      [title, status, category, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Görev eklenemedi' });
  }
});

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
    res.status(500).json({ error: 'Güncelleme hatası' });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Silme hatası' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Sunucu çalışıyor.`);
});
