const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const publicUploadDir = path.join(__dirname, '../../public/uploads/public');
const eulogyUploadDir = path.join(__dirname, '../../public/uploads/eulogy');

[publicUploadDir, eulogyUploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isEulogy = req.body.category === 'eulogy';
        cb(null, isEulogy ? eulogyUploadDir : publicUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'image/jpeg',
        'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({ 
    storage,
    fileFilter,
    limits: { fileSize: 3 * 1024 * 1024 } // 3MB
});

module.exports = { upload };
