const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🔗 เชื่อมต่อไปยัง MongoDB Atlas ของคุณ
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://pimpawee49_db_user:wDSUhF5vHeFfA9FH@internshipproject1.c0djffi.mongodb.net/internship_db?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas successfully!'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// สร้าง Schema และ Model สำหรับเก็บข้อมูลบริษัท
const companySchema = new mongoose.Schema({
    id: String,
    name: String,
    loc: String,
    sector: String,
    desc: String,
    pay: String,
    pos: String,
    time: String,
    contact: String,
    tags: [String]
});

const Company = mongoose.model('Company', companySchema);

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

// Get all companies from MongoDB
app.get('/api/companies', async (req, res) => {
    try {
        const companies = await Company.find();
        res.json(companies);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add new company to MongoDB
app.post('/api/companies', async (req, res) => {
    try {
        const newCompanyData = req.body;
        newCompanyData.id = 'c' + Date.now();

        const newCompany = new Company(newCompanyData);
        await newCompany.save();

        res.json({ success: true, company: newCompany });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete company from MongoDB
app.delete('/api/companies/:id', async (req, res) => {
    try {
        await Company.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});