exports.showHome = (req, res) => {
    res.render('home', {
        title: 'Twoem | Home',
        currentPage: 'home'
    });
};

exports.showSplash = (req, res) => {
    // Only show splash if it's the first visit
    if (!req.session.visited) {
        req.session.visited = true;
        return res.render('index');
    }
    res.redirect('/home');
};
