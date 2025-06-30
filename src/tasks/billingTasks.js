const db = require('../config/database');

/**
 * Applies monthly billing charges to all active customers.
 * This function is intended to be called by a scheduler on the 1st of every month.
 */
async function applyMonthlyBilling() {
    console.log(`[BillingTask] Starting monthly billing cycle at ${new Date().toISOString()}...`);
    let processedCount = 0;
    let errorCount = 0;

    try {
        const activeCustomers = await db.allAsync("SELECT id, current_balance, payment_per_month, grace_period_ends_at, disconnection_date FROM customers WHERE is_active = TRUE");

        if (!activeCustomers || activeCustomers.length === 0) {
            console.log("[BillingTask] No active customers found to bill.");
            return;
        }

        const today = new Date();
        const currentMonth = today.getMonth(); // 0-11
        const currentYear = today.getFullYear();

        for (const customer of activeCustomers) {
            try {
                const newBalance = customer.current_balance + customer.payment_per_month;
                let newGracePeriodEndsAt = customer.grace_period_ends_at; // Keep existing if any, might be cleared below
                let newDisconnectionDate = customer.disconnection_date; // Keep existing if any

                console.log(`[BillingTask] Processing Customer ID: ${customer.id}. Old Balance: ${customer.current_balance}, Monthly: ${customer.payment_per_month}, New Raw Balance: ${newBalance}`);

                if (newBalance > 0) {
                    // Customer owes money after adding current month's charge.
                    // Set grace period to end on the 7th of the current month.
                    // The billing task runs ON the 1st.
                    const graceEndDate = new Date(currentYear, currentMonth, 7, 23, 59, 59);
                    newGracePeriodEndsAt = graceEndDate.toISOString();

                    // Clear any pre-existing disconnection date as they are now in a new grace period for the current month's bill.
                    // The actual disconnection will be handled by a daily check or on access if payment is not made by grace_period_ends_at.
                    newDisconnectionDate = null;

                    console.log(`[BillingTask] Customer ID: ${customer.id} owes. New Balance: ${newBalance}. Grace Period Ends: ${newGracePeriodEndsAt}`);
                } else {
                    // Customer is paid up or has credit. Clear grace and disconnection dates.
                    newGracePeriodEndsAt = null;
                    newDisconnectionDate = null;
                    console.log(`[BillingTask] Customer ID: ${customer.id} is paid up/in credit. New Balance: ${newBalance}. Clearing grace/disconnection dates.`);
                }

                await db.runAsync(
                    "UPDATE customers SET current_balance = ?, grace_period_ends_at = ?, disconnection_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [newBalance, newGracePeriodEndsAt, newDisconnectionDate, customer.id]
                );
                processedCount++;
            } catch (customerError) {
                errorCount++;
                console.error(`[BillingTask] Error processing customer ID ${customer.id}:`, customerError);
                // Continue to next customer
            }
        }

        console.log(`[BillingTask] Monthly billing cycle completed. Processed: ${processedCount} customers. Errors: ${errorCount}.`);

    } catch (err) {
        console.error('[BillingTask] Critical error during monthly billing cycle:', err);
    }
}

/**
 * Checks for customers whose grace period has ended and disconnects them.
 * This function is intended to be called by a daily scheduler (e.g., early morning).
 */
async function checkAndApplyDisconnections() {
    console.log(`[BillingTask] Starting daily disconnection check at ${new Date().toISOString()}...`);
    let disconnectedCount = 0;
    let errorCount = 0;
    try {
        const today = new Date().toISOString(); // Compare with grace_period_ends_at

        // Find active customers whose grace period has ended and balance is still positive
        const overdueCustomers = await db.allAsync(
            "SELECT id, account_number, current_balance, grace_period_ends_at FROM customers WHERE is_active = TRUE AND current_balance > 0 AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at < ?",
            [today]
        );

        if (!overdueCustomers || overdueCustomers.length === 0) {
            console.log("[BillingTask] No customers found for disconnection today.");
            return;
        }

        for (const customer of overdueCustomers) {
            try {
                await db.runAsync(
                    "UPDATE customers SET is_active = FALSE, disconnection_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    [customer.id]
                );
                disconnectedCount++;
                console.log(`[BillingTask] Disconnected customer ID ${customer.id} (Acc: ${customer.account_number}). Balance: ${customer.current_balance}, Grace Ended: ${customer.grace_period_ends_at}`);
                // TODO: Optionally send a notification to the customer about disconnection.
            } catch (customerError) {
                errorCount++;
                console.error(`[BillingTask] Error disconnecting customer ID ${customer.id}:`, customerError);
            }
        }
        console.log(`[BillingTask] Daily disconnection check completed. Disconnected: ${disconnectedCount} customers. Errors: ${errorCount}.`);

    } catch (err) {
        console.error('[BillingTask] Critical error during daily disconnection check:', err);
    }
}


// How to potentially schedule these with node-cron (example, not run by default):
/*
const cron = require('node-cron');

// Schedule monthly billing: At 00:05 on the 1st day of every month.
// cron.schedule('5 0 1 * *', applyMonthlyBilling, {
//     scheduled: true,
//     timezone: "Africa/Nairobi" // Example: Set your server's timezone
// });

// Schedule daily disconnection check: At 01:05 AM every day.
// cron.schedule('5 1 * * *', checkAndApplyDisconnections, {
//     scheduled: true,
//     timezone: "Africa/Nairobi"
// });

// To run these tasks manually for testing (e.g., via a secure admin route):
// applyMonthlyBilling();
// checkAndApplyDisconnections();
*/

module.exports = {
    applyMonthlyBilling,
    checkAndApplyDisconnections
};
