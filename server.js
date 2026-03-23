const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const CONTENT_PATH = path.join(__dirname, 'content.json');
const ADMIN_PASSWORD = (() => {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    return config.adminPassword || 'greenscape2026';
  } catch (e) {
    return process.env.ADMIN_PASSWORD || 'greenscape2026';
  }
})();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Disable caching
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Session middleware for admin auth
app.use((req, res, next) => {
  req.isAdmin = req.session && req.session.isAdmin;
  next();
});

// Setup multer for file uploads
const upload = multer({
  dest: 'public/uploads/', // will store uploads in public/uploads/
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (including uploaded images)
app.use(express.static(path.join(__dirname, 'public')));

// Load content
function loadContent() {
  try {
    const raw = fs.readFileSync(CONTENT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// Save content
function saveContent(data) {
  fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Helper: compute hash of a file
function computeFileHash(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(data).digest('hex');
}

// Helper: handle uploaded file - reuse existing if same hash, otherwise rename to hash
function handleUploadedFile(tempFilePath, currentPath) {
  const tempHash = computeFileHash(tempFilePath);
  const uploadsDir = path.join(__dirname, 'public/uploads');
  
  // Check all existing files in uploads dir
  const existingFiles = fs.readdirSync(uploadsDir);
  for (const file of existingFiles) {
    if (file.includes(':')) continue; // skip Zone.Identifier files
    const existingPath = path.join(uploadsDir, file);
    try {
      const existingHash = computeFileHash(existingPath);
      if (existingHash === tempHash) {
        // Same file exists - delete temp, return existing path
        fs.unlinkSync(tempFilePath);
        return { path: `/uploads/${file}`, reused: true };
      }
    } catch (e) {
      // skip problematic files
    }
  }
  
  // No match - rename temp file to hash name
  const newFilename = tempHash;
  const newPath = path.join(uploadsDir, newFilename);
  fs.renameSync(tempFilePath, newPath);
  
  // Delete old file if exists and different
  if (currentPath && currentPath !== `/images/logo.png`) {
    const oldFilePath = path.join(__dirname, 'public', currentPath);
    if (fs.existsSync(oldFilePath) && oldFilePath !== newPath) {
      fs.unlinkSync(oldFilePath);
    }
  }
  
  return { path: `/uploads/${newFilename}`, reused: false };
}

// Home page
app.get('/', (req, res) => {
  const content = loadContent();
  res.render('index', { content });
});

// Privacy policy page
app.get('/privacy-policy', (req, res) => {
  const content = loadContent();
  res.render('privacy-policy', { content });
});

// Admin login page
app.get('/admin-login', (req, res) => {
  res.render('admin-login');
});

// Handle admin login
app.post('/admin-login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.cookie('admin_auth', 'true', { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.redirect('/admin');
  } else {
    res.render('admin-login', { error: 'Неверный пароль' });
  }
});

// Admin page - require auth
app.get('/admin', (req, res) => {
  const isAdmin = req.cookies && req.cookies.admin_auth === 'true';
  if (!isAdmin) {
    return res.redirect('/admin-login');
  }
  const content = loadContent();
  res.render('admin', { content });
});

// Handle admin form submit with file upload
app.post('/admin', upload.fields([{ name: 'heroImage', maxCount: 1 }, { name: 'logoFile', maxCount: 1 }, { name: 'galleryImages', maxCount: 10 }]), (req, res) => {
  console.log('Request Body:', req.body);
  console.log('Request Files:', req.files);
  const form = req.body;
  const currentContent = loadContent();

  const newContent = {
    siteTitle: form.siteTitle,
    titleColor: form.titleColor || '#ffffff',
    titleColorScrolled: form.titleColorScrolled || '#222222',
    headerBg: form.headerBg || '#264d26',
    headerBgScrolled: form.headerBgScrolled || '#264d26',
    gradientColor: form.gradientColor || '#264d26',
    gradientDeg: form.gradientDeg || '135deg',
    logoPath: currentContent.logoPath || '/images/logo.png',
    logoHeight: form.logoHeight || '50px',
    sectionBg: form.sectionBg || '#f8f9f5',
    cardBg: form.cardBg || '#ffffff',
    footerBg: form.footerBg || '#1b361b',
    footerText: form.footerText || '#ffffff',
    formBg: form.formBg || '#ffffff',
    formText: form.formText || '#222222',

    heroTitle: form.heroTitle || 'Озеленение и ландшафтный дизайн под ключ',
    heroSubtitle: form.heroSubtitle || '',
    phone: form.phone || '+7 (912) 746-04-68',
    email: form.email || 'Grechkovb@yandex.ru',
    region: form.region || 'Ижевск и Удмуртская Республика',
    services: [
      { title: form.service1Title || 'Ландшафтный дизайн', text: form.service1Text || '' },
      { title: form.service2Title || 'Озеленение и посадки', text: form.service2Text || '' },
      { title: form.service3Title || 'Газон под ключ', text: form.service3Text || '' },
      { title: form.service4Title || 'Системы автополива', text: form.service4Text || '' },
      { title: form.service5Title || 'Уход за участком', text: form.service5Text || '' }
    ],
    prices: [
      { title: form.price1Title || 'Ландшафтный проект', price: form.price1Price || 'от 3 000 ₽ за сотку', desc: form.price1Desc || '' },
      { title: form.price2Title || 'Озеленение и посадки', price: form.price2Price || 'по индивидуальной смете', desc: form.price2Desc || '' },
      { title: form.price3Title || 'Газон под ключ', price: form.price3Price || 'от 350 ₽/м²', desc: form.price3Desc || '' },
      { title: form.price4Title || 'Сезонный уход', price: form.price4Price || 'от 5 000 ₽ за выезд', desc: form.price4Desc || '' }
    ],
    prices2: [
      { title: form.price1Title2 || 'Ландшафтный проект', price: form.price1Price2 || 'от 3 000 ₽ за сотку', desc: form.price1Desc2 || '' },
      { title: form.price2Title2 || 'Озеленение и посадки', price: form.price2Price2 || 'по индивидуальной смете', desc: form.price2Desc2 || '' },
      { title: form.price3Title2 || 'Газон под ключ', price: form.price3Price2 || 'от 350 ₽/м²', desc: form.price3Desc2 || '' },
      { title: form.price4Title2 || 'Сезонный уход', price: form.price4Price2 || 'от 5 000 ₽ за выезд', desc: form.price4Desc2 || '' }
    ],
    heroImage: currentContent.heroImage || '',
    gallery: currentContent.gallery || []
  };

  // Handle logo file upload
  if (req.files && req.files['logoFile']) {
    const result = handleUploadedFile(req.files['logoFile'][0].path, currentContent.logoPath);
    newContent.logoPath = result.path;
  } else if (form.logoPath === '') { // If logo was explicitly cleared from form
    if (currentContent.logoPath && currentContent.logoPath !== '/images/logo.png') {
      const oldLogoPath = path.join(__dirname, 'public', currentContent.logoPath);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }
    newContent.logoPath = '';
  }

  // Handle hero image upload
  if (req.files && req.files['heroImage']) {
    const result = handleUploadedFile(req.files['heroImage'][0].path, currentContent.heroImage);
    newContent.heroImage = result.path;
  }
  // Если новый файл не загружен - оставляем старое значение (уже в newContent.heroImage = currentContent.heroImage)

  // Handle gallery images upload
  if (req.files && req.files['galleryImages']) {
    const newGalleryImages = [...(currentContent.gallery || [])];
    req.files['galleryImages'].forEach(file => {
      newGalleryImages.push(`/uploads/${file.filename}`);
    });
    newContent.gallery = newGalleryImages;
  }

  saveContent(newContent);
  res.redirect('/admin');
});

// Handle logo deletion
app.post('/admin/delete-logo', (req, res) => {
  const content = loadContent();

  if (content.logoPath && content.logoPath !== '/images/logo.png') { // Prevent deleting default logo
    const logoPathToDelete = path.join(__dirname, 'public', content.logoPath);
    if (fs.existsSync(logoPathToDelete)) {
      fs.unlinkSync(logoPathToDelete);
    }
    content.logoPath = ''; // Clear the image path from content
    saveContent(content);
  }
  res.redirect('/admin');
});

// Handle hero image deletion
app.post('/admin/delete-hero-image', (req, res) => {
  const content = loadContent();

  if (content.heroImage) {
    const imagePathToDelete = path.join(__dirname, 'public', content.heroImage);
    if (fs.existsSync(imagePathToDelete)) {
      fs.unlinkSync(imagePathToDelete);
    }
    content.heroImage = ''; // Clear the image path from content
    saveContent(content);
  }
  res.redirect('/admin');
});

// Handle gallery image deletion
app.post('/admin/delete-gallery-image', (req, res) => {
  const content = loadContent();
  const imageToDelete = req.body.imagePath;

  if (imageToDelete && content.gallery) {
    const fullPath = path.join(__dirname, 'public', imageToDelete);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    content.gallery = content.gallery.filter(img => img !== imageToDelete);
    saveContent(content);
  }
  res.redirect('/admin');
});

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'yandex',
  auth: {
    user: 'grechkovb@yandex.ru',
    pass: 'vzjdwtmczvxlqsxb'
  }
});

app.post('/api/contact', async (req, res) => {
  const { name, phone, message } = req.body;
  
  const mailOptions = {
    from: 'grechkovb@yandex.ru',
    to: 'grechkovb@yandex.ru',
    subject: 'Новая заявка с сайта Территория флоры',
    text: `Имя: ${name}\nТелефон: ${phone}\nСообщение: ${message}`
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error) {
    console.error('Email error:', error);
    res.json({ success: false });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GreenScape site running on http://0.0.0.0:${PORT}`);
});
