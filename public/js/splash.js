document.addEventListener('DOMContentLoaded', () => {
    // After animations complete, redirect to home
    setTimeout(() => {
        window.location.href = '/home';
    }, 3500);
    
    // Prevent back navigation to splash screen
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            window.location.href = '/home';
        }
    });
});
