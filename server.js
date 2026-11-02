const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataFile = path.join(__dirname, 'data.json');

if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([]));
}

const admins = [
    { username: 'CodeLyxn', password: 'mhiyoklnwza888' }
];

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const isValid = admins.some(a => a.username === username && a.password === password);
    if (isValid) {
        res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', token: 'admin_token_mock' });
    } else {
        res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }
});

app.get('/api/companies', (req, res) => {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    res.json(data);
});

app.post('/api/companies', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
        const newCompany = req.body;
        newCompany.id = 'c' + Date.now();
        data.push(newCompany);
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        res.json({ success: true, company: newCompany });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});