const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../utils/jwtHelper'); // Import from helper

// Admin login logic
const loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).render('pages/admin-login', {
            title: 'Admin Login',
            error: 'Email and password are required.'
        });
    }

    let authenticatedAdmin = null;

    for (let i = 1; i <= 3; i++) {
        const adminEmail = process.env[`ADMIN${i}_EMAIL`];
        const adminPasswordHash = process.env[`ADMIN${i}_PASSWORD_HASH`];
        const adminName = process.env[`ADMIN${i}_NAME`];

        if (adminEmail === email) {
            if (!adminPasswordHash || adminPasswordHash.startsWith("PLACEHOLDER_BCRYPT_HASH") || adminPasswordHash.length < 20) { // Added length check
                console.warn(`Admin ${i} (${adminEmail}) email matched, but ADMIN${i}_PASSWORD_HASH is not a valid hash in .env.`);
                continue;
            }
            try {
                const isMatch = await bcrypt.compare(password, adminPasswordHash);
                if (isMatch) {
                    authenticatedAdmin = {
                        id: `admin${i}`,
                        email: adminEmail,
                        name: adminName || `Admin ${i}`
                    };
                    break;
                }
            } catch (compareError) {
                console.error(`Error comparing hash for admin ${i} (${adminEmail}):`, compareError);
            }
        }
    }

    if (!authenticatedAdmin) {
        return res.status(401).render('pages/admin-login', {
            title: 'Admin Login',
            error: 'Invalid credentials.'
        });
    }

    try {
        const token = jwt.sign(
            {
                id: authenticatedAdmin.id,
                email: authenticatedAdmin.email,
                name: authenticatedAdmin.name,
                isAdmin: true
            },
            getJwtSecret(), // Use helper function
            { expiresIn: process.env.JWT_EXPIRE || '1h' }
        );

        res.cookie('admin_auth_token', token, { // Changed cookie name
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: parseInt(process.env.JWT_EXPIRE_MS || (1 * 60 * 60 * 1000).toString(), 10),
            path: '/',
            sameSite: 'Lax' // Explicitly set SameSite
        });

        res.redirect('/admin/dashboard');

    } catch (jwtError) {
        console.error('Error generating JWT for admin:', jwtError);
        return res.status(500).render('pages/admin-login', {
            title: 'Admin Login',
            error: 'Login failed due to a server error. Please try again later.'
        });
    }
};

// Admin logout logic
const logoutAdmin = (req, res) => {
    res.cookie('admin_auth_token', '', { // Changed cookie name
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: new Date(0),
        path: '/',
        sameSite: 'Lax' // Explicitly set SameSite
    });
    req.flash('success_msg', 'You have been logged out successfully.');
    res.redirect('/admin/login');
};

module.exports = {
    loginAdmin,
    logoutAdmin
};
