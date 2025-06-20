require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const MongoStore = require('connect-mongo');
const fs = require('fs');

// Debug: Show deployment environment
console.log('Current directory:', process.cwd());
console.log('Directory contents:', fs.readdirSync('.'));

// Initialize app
const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Session store
const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
});

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000, // 1 hour
        domain: process.env.WEBSITE_DOMAIN,
        sameSite: 'lax'
    }
}));

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many login attempts, please try again later'
});

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes
app.use('/', require('./routes/homeRoutes'));
app.use('/contact', require('./routes/contactRoutes'));
app.use('/gallery', require('./routes/galleryRoutes'));
app.use('/services', require('./routes/servicesRoutes'));
app.use('/downloads', require('./routes/downloadRoutes'));
app.use('/data-protection', require('./routes/dataProtectionRoutes'));
app.use('/portals', require('./routes/portalRoutes'));
app.use('/admin', authLimiter, require('./routes/adminRoutes'));
app.use('/student', authLimiter, require('./routes/studentRoutes'));

// Root route (kept from original, but homeRoutes should handle this)
app.get('/', (req, res) => {
    res.render('index', { title: 'Twoem | Home' });
});

// Error handling
app.use((req, res) => {
    res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500', { title: 'Server Error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Website domain: ${process.env.WEBSITE_DOMAIN}`);
});
