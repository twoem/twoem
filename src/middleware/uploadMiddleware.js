const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists at project root
const rootUploadsDir = path.join(__dirname, '../../uploads');
const backupUploadDir = path.join(rootUploadsDir, 'backups');

if (!fs.existsSync(rootUploadsDir)){
    fs.mkdirSync(rootUploadsDir);
}
if (!fs.existsSync(backupUploadDir)){
    fs.mkdirSync(backupUploadDir);
}

// Set up storage engine for multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, backupUploadDir); // Corrected path to root/uploads/backups
    },
    filename: function (req, file, cb) {
        // Keep original name + timestamp to avoid conflicts, or generate unique name
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Initialize upload variable
const uploadBackupFile = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // Limit file size (e.g., 100MB)
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('backupFile'); // 'backupFile' is the name attribute of the file input field

// Check File Type
function checkFileType(file, cb) {
    // Allowed ext
    const filetypes = /zip/;
    // Check ext
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    // Check mime
    const mimetype = filetypes.test(file.mimetype); // Example: application/zip or application/x-zip-compressed

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Zip Files Only!'); // This error message can be caught by an error handler
    }
}

module.exports = uploadBackupFile;
