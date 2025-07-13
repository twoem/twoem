require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser'); // Added cookie-parser
const connectDB = require('./config/db'); // Uncommented and ready

const app = express();

// Connect Database
connectDB(); // Call the function to connect to DB

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const session = require('express-session');
const flash = require('connect-flash');

// Middleware
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: false })); // To parse URL-encoded bodies
app.use(cookieParser()); // Use cookie-parser
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Express session
app.use(
  session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,
  })
);

// Connect flash
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// Routes
const indexRouter = require('./routes/index');
const customerRouter = require('./routes/customer');
const studentRouter = require('./routes/student');
const adminRouter = require('./routes/admin');

app.use('/', indexRouter);
app.use('/customer', customerRouter);
app.use('/student', studentRouter);
app.use('/admin', adminRouter);

// Basic error handling (can be expanded)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
