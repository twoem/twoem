exports.ensureAdmin = (req, res, next) => {
    if (req.session.isAdmin) return next();
    res.redirect('/admin/login');
};

exports.ensureStudent = (req, res, next) => {
    if (req.session.studentId) return next();
    res.redirect('/student/login');
};

exports.redirectIfLoggedIn = (req, res, next) => {
    if (req.session.isAdmin) return res.redirect('/admin/dashboard');
    if (req.session.studentId) return res.redirect('/student/dashboard');
    next();
};
