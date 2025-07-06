const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Determine the database path. Store it in a 'db' directory in the project root.
const dbPath = path.resolve(__dirname, '../../db/twoem_online.sqlite');
const dbDir = path.resolve(__dirname, '../../db');

// Ensure db directory exists
const fs = require('fs');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize the database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDb();
    }
});

// Function to initialize tables
function initializeDb() {
    db.serialize(() => {
        // Students Table (REMOVED)
        // Password Reset Tokens Table (REMOVED)

        // Note: 'updated_at' timestamp for 'students' table will be handled by application logic
        // upon updates to ensure cross-database compatibility and simplify SQLite setup.

        // Courses Table
        db.run(`
            CREATE TABLE IF NOT EXISTS courses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                -- Add image_url TEXT if courses have images
            )
        `, (err) => {
            if (err) {
                console.error("Error creating courses table:", err.message);
            } else {
                console.log("Courses table checked/created.");
                // Seed "Computer Packages" course if it doesn't exist
                const computerPackagesCourseName = "Computer Packages";
                db.getAsync("SELECT id FROM courses WHERE name = ?", [computerPackagesCourseName])
                    .then(course => {
                        if (!course) {
                            db.runAsync("INSERT INTO courses (name, description) VALUES (?, ?)", [computerPackagesCourseName, "A foundational course covering essential computer skills including Introduction to Computers, Keyboard & Mouse, MS Word, Excel, Publisher, PowerPoint, Access, Internet & Email."])
                                .then(() => console.log(`Default course "${computerPackagesCourseName}" seeded.`))
                                .catch(seedErr => console.error(`Error seeding default course "${computerPackagesCourseName}":`, seedErr.message));
                        }
                    })
                    .catch(checkErr => console.error("Error checking for default course:", checkErr.message));
            }
        });

        // Enrollments Table (REMOVED)
        // Student table alterations (REMOVED as students table is REMOVED)

        // Fees Table (REMOVED)
        // Notifications Table (REMOVED)
        // Study Resources Table (REMOVED)
        // Site Settings Table (REMOVED)
        // Action Logs Table (REMOVED)

        // Downloadable Documents Table
        db.run(`
            CREATE TABLE IF NOT EXISTS downloadable_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                file_url TEXT NOT NULL, -- Hardcoded URL as per spec
                type TEXT NOT NULL CHECK(type IN ('public', 'eulogy')),
                expiry_date DATETIME, -- NULL for public, set for eulogy
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                uploaded_by_admin_id TEXT NOT NULL -- Admin who configured this entry
            )
        `, (err) => {
            if (err) console.error("Error creating downloadable_documents table:", err.message);
            else console.log("Downloadable_documents table checked/created.");
        });

        // Student Notification Reads Table (REMOVED)
        // Student Topic Marks Table (REMOVED)
        // Alterations to enrollments table (REMOVED as enrollments table is REMOVED)

    });
}

// Promisify db.get, db.all, db.run for easier async/await usage
const util = require('util');
db.getAsync = util.promisify(db.get);
db.allAsync = util.promisify(db.all);
db.runAsync = util.promisify(db.run);


// Close the database connection when the application exits
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            return console.error(err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});

module.exports = db;
