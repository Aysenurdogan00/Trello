// 1. KAYIT OL (Garantili Yönlendirme)
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
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (userExist.rows.length > 0) {
      const existingUser = userExist.rows[0];

      // Eğer kullanıcı var ama doğrulanmamışsa: Kodu güncelle ve doğrulama ekranına yönlendir
      if (!existingUser.is_verified) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.query(
          'UPDATE users SET username = $1, password = $2, verification_code = $3 WHERE email = $4',
          [username, hashedPassword, verificationCode, email]
        );

        // Mail göndermeyi dene (hata verse dahi akışı kesme)
        sendVerificationEmail(email, username, verificationCode).catch(err => console.error('Mail Gönderim Hatası:', err));

        return res.status(200).json({
          message: 'Hesabınız henüz doğrulanmamıştı. Doğrulama ekranına yönlendiriliyorsunuz.',
          needsVerification: true,
          email
        });
      }

      return res.status(400).json({ error: 'Bu kullanıcı adı veya e-posta adresi zaten doğrulanmış bir hesaba ait.' });
    }

    // Yeni Kayıt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      'INSERT INTO users (username, email, password, verification_code, is_verified) VALUES ($1, $2, $3, $4, FALSE)',
      [username, email, hashedPassword, verificationCode]
    );

    // Mail göndermeyi dene (hata verse dahi akışı kesme)
    sendVerificationEmail(email, username, verificationCode).catch(err => console.error('Mail Gönderim Hatası:', err));

    return res.status(201).json({
      message: 'Kayıt alındı. Lütfen e-postanıza gelen doğrulama kodunu girin.',
      needsVerification: true,
      email
    });

  } catch (err) {
    console.error('Register Hatası:', err);
    res.status(500).json({ error: 'Veritabanı veya sunucu hatası oluştu.' });
  }
});
