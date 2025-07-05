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
    // useCreateIndex: true, // No longer needed, Mongoose 6+ uses `autoCreate` and `autoIndex`
    // useFindAndModify: false // No longer needed
}).then(() => {
    console.log('Successfully connected to MongoDB (for Customer data).');
}).catch(err => {
    console.error('MongoDB connection error (for Customer data):', err);
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
    next();
});


// Import routes
const mainRoutes = require('./src/routes/mainRoutes');

// Use routes
app.use('/', mainRoutes); // Mount main routes


// Catch 404 and forward to error handler
app.use((req, res, next) => {
    res.status(404).render('pages/errors/404', {
        title: 'Page Not Found',
        url: req.originalUrl
    });
});

// TODO: Add a more generic error handler (for 500 errors etc.)
// This should ideally be the VERY last middleware.
// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     // Check if headers have already been sent
//     if (res.headersSent) {
//         return next(err);
//     }
//     res.status(err.status || 500).render('pages/errors/500', { // Assuming 500.ejs exists
//         title: 'Server Error',
//         error: process.env.NODE_ENV === 'development' ? err : {} // Only show error details in dev
//     });
// });

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    // console.log(`Default student pass: ${process.env.DEFAULT_STUDENT_PASSWORD}`); // Removed for cleaner logs
});
