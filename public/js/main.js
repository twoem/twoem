// Custom JavaScript for Twoem Online Productions

document.addEventListener('DOMContentLoaded', function() {
    console.log('Twoem Online Productions website script loaded.');

    // Example: Add active class to navbar links based on current page
    const currentLocation = window.location.pathname;
    const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentLocation) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });

    // Add more custom JS interactions here as the site develops
});
