// src/utils/jwtHelper.js

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        console.error(
            "CRITICAL SECURITY WARNING: JWT_SECRET is not defined, empty, or too short (less than 32 characters) in .env. " +
            "Using a default development secret. THIS IS INSECURE AND MUST BE FIXED FOR PRODUCTION."
        );
        // This fallback is for development convenience ONLY.
        // In a production environment, the application should ideally fail to start if JWT_SECRET is missing or insecure.
        return process.env.NODE_ENV === 'production'
            ? 'fallback_prod_secret_that_is_very_long_and_random_and_changed_immediately_32_chars_min'
            // Ensure dev fallback is also reasonably long
            : 'dev_fallback_secret_must_be_long_and_random_at_least_32_chars_min_for_dev_only';
    }
    return secret;
};

module.exports = {
    getJwtSecret
};
