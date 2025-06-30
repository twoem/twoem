const { body } = require('express-validator');

const validateRegisterCustomer = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('First Name is required.')
        .isLength({ min: 2 }).withMessage('First Name must be at least 2 characters long.'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Last Name is required.')
        .isLength({ min: 2 }).withMessage('Last Name must be at least 2 characters long.'),
    body('secondName')
        .optional({ checkFalsy: true })
        .trim(),
    body('organisationName')
        .optional({ checkFalsy: true })
        .trim(),
    body('phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone Number is required.')
        .matches(/^(0[17])\d{8}$/).withMessage('Phone Number must be 10 digits and start with 01 or 07.'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.'),
    body('location')
        .trim()
        .notEmpty().withMessage('Location is required.'),
    body('installationDate')
        .notEmpty().withMessage('Installation Date is required.')
        .isISO8601().withMessage('Invalid date format for Installation Date.'),
    body('paymentPerMonth')
        .notEmpty().withMessage('Payment Per Month is required.')
        .isFloat({ gt: 0 }).withMessage('Payment Per Month must be a positive number.'),
    body('accountNumber')
        .trim()
        .notEmpty().withMessage('Account Number is required.')
        .isLength({ min: 3 }).withMessage('Account Number must be at least 3 characters long.'),
    body('initialBalance')
        .notEmpty().withMessage('Initial Account Balance is required.')
        .isFloat().withMessage('Initial Account Balance must be a number (can be negative).')
];

const validateUpdateCustomer = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('First Name is required.')
        .isLength({ min: 2 }).withMessage('First Name must be at least 2 characters long.'),
    body('lastName')
        .trim()
        .notEmpty().withMessage('Last Name is required.')
        .isLength({ min: 2 }).withMessage('Last Name must be at least 2 characters long.'),
    body('secondName')
        .optional({ checkFalsy: true })
        .trim(),
    body('organisationName')
        .optional({ checkFalsy: true })
        .trim(),
    body('phoneNumber')
        .trim()
        .notEmpty().withMessage('Phone Number is required.')
        .matches(/^(0[17])\d{8}$/).withMessage('Phone Number must be 10 digits and start with 01 or 07.'),
        // Unique check for phoneNumber will be handled in controller to exclude current user
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Invalid email address.'),
        // Unique check for email will be handled in controller
    body('location')
        .trim()
        .notEmpty().withMessage('Location is required.'),
    body('installationDate')
        .notEmpty().withMessage('Installation Date is required.')
        .isISO8601().withMessage('Invalid date format for Installation Date.'),
    body('paymentPerMonth')
        .notEmpty().withMessage('Payment Per Month is required.')
        .isFloat({ gt: 0 }).withMessage('Payment Per Month must be a positive number.'),
    body('accountNumber')
        .trim()
        .notEmpty().withMessage('Account Number is required.')
        .isLength({ min: 3 }).withMessage('Account Number must be at least 3 characters long.')
        // Unique check for accountNumber will be handled in controller
];

module.exports = {
    validateRegisterCustomer,
    validateUpdateCustomer
};
