require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');

// Connect to MongoDB
if (!process.env.DATABASE_URL) {
    console.error('FATAL ERROR: DATABASE_URL is not defined in .env file for MongoDB connection.');
    process.exit(1); // Exit if no DB URL
}

mongoose.connect(process.env.DATABASE_URL, {
    // useNewUrlParser: true, // No longer needed in Mongoose 6+
    // useUnifiedTopology: true, // No longer needed in Mongoose 6+
}).then(() => {
    console.log('Successfully connected to MongoDB.'); // Generic message
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if connection fails
});


const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Static files middleware
app.use(express.static(path.join(__dirname, 'public')));

// Body parsing middleware (for form data)
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies
app.use(express.json()); // To parse JSON bodies

const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');

// Middleware
app.use(cookieParser()); // Use cookie-parser

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_strong_secret_key_fallback', // Fallback if not in .env
    resave: false,
    saveUninitialized: true, // Can be false if login is mandatory for sessions
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 1000 * 60 * 60 * 24 // Example: 1 day session cookie
    }
}));

// Flash messages middleware
app.use(flash());

// Middleware to make flash messages available to all templates
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error'); // For express-validator errors or other single errors
    // Making user info available to all views if logged in (from my portal auth)
    // This might conflict if your mainRoutes also sets req.user differently.
    // For now, this makes portal user data available.
    if (req.user) {
        res.locals.currentUser = req.user; // Portal user
    }
    // Making title available for navbar active state
    // This is a common pattern, but your mainRoutes might handle title differently.
    // For portal pages, pageTitle is passed directly in res.render.
    // We need a consistent way for the shared navbar to know the 'active' page.
    // Let's rely on `title` being passed from `res.render` for now.
    // res.locals.title = ''; // Example: set a default title if needed
    next();
});


// Import routes
const mainRoutes = require('./src/routes/mainRoutes');
const customerPortalRoutes = require('./src/routes/portals/customerPortalRoutes');
const studentPortalRoutes = require('./src/routes/portals/studentPortalRoutes');
const adminPortalRoutes = require('./src/routes/portals/adminPortalRoutes');


// Use routes
app.use('/', mainRoutes); // Mount main routes

// Mount portal routes
app.use('/customer', customerPortalRoutes);
app.use('/student', studentPortalRoutes);
app.use('/admin', adminPortalRoutes);


// Catch 404 and forward to error handler
app.use((req, res, next) => {
    // Check if the request was for a portal asset that might be missing
    // or if it's a general 404 for your public site.
    // For now, using your existing 404 page.
    res.status(404).render('pages/errors/404', { // Assuming this is your public 404 page
        title: 'Page Not Found',
        url: req.originalUrl
    });
});

// Generic error handler (your existing one was commented out)
// This should ideally be the VERY last middleware.
app.use((err, req, res, next) => {
    console.error("Global Error Handler:",err.stack);
    // Check if headers have already been sent
    if (res.headersSent) {
        return next(err);
    }
    const statusCode = err.status || 500;
    // Render a generic error page for portals, or your existing one
    // For now, sending a simple text response for non-404 portal errors to avoid conflicts
    if (req.originalUrl.startsWith('/customer') || req.originalUrl.startsWith('/student') || req.originalUrl.startsWith('/admin')) {
        res.status(statusCode).send(`Error ${statusCode}: An unexpected error occurred on the portal.`);
    } else {
         res.status(statusCode).render('pages/errors/500', { // Assuming 500.ejs for public site
            title: 'Server Error',
            error: process.env.NODE_ENV === 'development' ? err : { message: "An unexpected error occurred." }
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
});
