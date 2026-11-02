const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const dataFile = path.join(__dirname, 'data.json');

// Initialize database file if it doesn't exist
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]));
}

// Setup Multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Admin Credentials
const admins = [
    { username: 'CodeLyxn', password: 'mhiyoklnwza888' }
];

// --- Routes ---

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const isValid = admins.some(a => a.username === username && a.password === password);
    if (isValid) {
        res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', token: 'admin_token_mock' });
    } else {
        res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }
});

// Get all companies
app.get('/api/companies', (req, res) => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    res.json(data);
});

// Add new company
app.post('/api/companies', upload.array('images', 3), (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        const newCompany = req.body;
        
        newCompany.id = 'c' + Date.now();
        newCompany.images = req.files ? req.files.map(f => '/uploads/' + f.filename) : [];
        
        // Handle tags processing from frontend
        if (newCompany.tags) {
            newCompany.tags = newCompany.tags.split(',').map(t => t.trim());
        } else {
            newCompany.tags = [];
        }

        data.push(newCompany);
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        res.json({ success: true, company: newCompany });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete company
app.delete('/api/companies/:id', (req, res) => {
    try {
        let data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        data = data.filter(c => c.id !== req.params.id);
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update company (Simple update for admin)
app.put('/api/companies/:id', (req, res) => {
    try {
        let data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        const index = data.findIndex(c => c.id === req.params.id);
        if(index !== -1) {
            // Merge updated data (ignoring file updates for simplicity in this version)
            data[index] = { ...data[index], ...req.body };
            fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
