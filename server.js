const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const mongoose = require('mongoose');
const TRANSIT_LINES = require('./public/transit-data.js');
const { POSITION_CATEGORIES, LEGACY_POSITION_MAP } = require('./public/tag-data.js');
const POSITION_NAMES = POSITION_CATEGORIES.flatMap(c => c.items.map(i => i.name));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 🔗 เชื่อมต่อไปยัง MongoDB Atlas (ตั้ง MONGO_URI ใน Environment ของ Render ได้)
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://pimpawee49_db_user:wDSUhF5vHeFfA9FH@internshipproject1.c0djffi.mongodb.net/internship_db?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas successfully!'))
    .catch((err) => console.error('❌ MongoDB connection error:', err));

// ---------------------------------------------------------------------------
// Models
// หมายเหตุ: บริษัทเก่าที่ไม่มี field "status" ถือว่า "approved" (เว็บเดิมใช้ฐานข้อมูลเดียวกัน)
// ---------------------------------------------------------------------------
const companySchema = new mongoose.Schema({
    id: String,
    name: String,
    loc: String,
    sector: String,
    desc: String,
    pay: String,
    pos: String,
    time: String,
    timeStart: String,
    timeEnd: String,
    contact: String,
    tags: [String],
    stations: [String],  // สถานีรถไฟฟ้าใกล้บริษัท เช่น "bts-sukhumvit:อโศก"
    status: String,      // 'approved' | 'pending'
    createdAt: Date
});
const Company = mongoose.model('Company', companySchema);

const reviewSchema = new mongoose.Schema({
    id: String,
    companyId: String,
    rating: Number,      // 1-5
    role: String,
    workMode: String,
    pay: String,
    recommend: Boolean,
    text: String,
    year: String,               // ปีที่ฝึก (พ.ศ.) เช่น "2568"
    interviewQuestions: String, // ประสบการณ์สัมภาษณ์
    hasTest: String,            // 'yes' | 'no' | ''
    needPortfolio: String,      // 'yes' | 'no' | ''
    difficulty: String,         // 'easy' | 'medium' | 'hard' | ''
    status: String,      // 'approved' | 'pending'
    createdAt: Date
});
const Review = mongoose.model('Review', reviewSchema);

const reportSchema = new mongoose.Schema({
    id: String,
    companyId: String,
    companyName: String,
    message: String,
    createdAt: Date
});
const Report = mongoose.model('Report', reportSchema);

// นับว่า Tag ไหนถูกกดค้นหาบ่อย (ใช้ทำปุ่ม "ยอดนิยม" หน้าแรก)
const tagStatSchema = new mongoose.Schema({ tag: String, count: Number });
const TagStat = mongoose.model('TagStat', tagStatSchema);

// ---------------------------------------------------------------------------
// Admin auth (token แบบมีลายเซ็น — แก้ไข/ลบ/อนุมัติ ต้อง login เท่านั้น)
// ---------------------------------------------------------------------------
const admins = [
    { username: 'CodeLyxn', password: 'mhiyoklnwza888' },
    { username: 'Peerapat_pun', password: 'gyoza888' },
];

// แนะนำให้ตั้ง ADMIN_SECRET ใน Environment ของ Render (ถ้าไม่ตั้ง จะสร้างจาก MONGO_URI)
const TOKEN_SECRET = process.env.ADMIN_SECRET || crypto.createHash('sha256').update('ict-admin:' + MONGO_URI).digest('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 ชั่วโมง

function sign(data) {
    return crypto.createHmac('sha256', TOKEN_SECRET).update(data).digest('base64url');
}

function createToken(username) {
    const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
    return payload + '.' + sign(payload);
}

function verifyToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) return null;
    const [payload, sig] = token.split('.');
    const expected = sign(payload);
    const a = Buffer.from(sig || '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (!data.exp || data.exp < Date.now()) return null;
        return data;
    } catch {
        return null;
    }
}

function requireAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const data = verifyToken(token);
    if (!data) return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบใหม่' });
    req.admin = data.u;
    next();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SECTORS = ['ภาครัฐ', 'เอกชน', 'รัฐวิสาหกิจ'];

// ต้องตรงกับรายการใน public/common.js
const TRACKABLE_TAGS = [
    ...POSITION_NAMES,
    'Onsite', 'Hybrid', 'Remote',
    'มีค่าตอบแทน', 'ภาคกลาง', 'ต่างจังหวัด', 'ต่างประเทศ', 'รับฝึกมากกว่า 2 เดือน',
    ...TRANSIT_LINES.map(l => l.name)
];

const LINE_NAMES = TRANSIT_LINES.map(l => l.name);
const VALID_STATIONS = new Set(TRANSIT_LINES.flatMap(l => l.stations.map(st => `${l.id}:${st}`)));
const LINE_BY_ID = Object.fromEntries(TRANSIT_LINES.map(l => [l.id, l]));

const yesNo = (v) => (v === 'yes' || v === 'no' ? v : '');

function cleanText(value, max = 500) {
    if (value === undefined || value === null) return '';
    return String(value).trim().slice(0, max);
}

function cleanTags(tags) {
    if (!Array.isArray(tags)) return [];
    return [...new Set(tags.map(t => cleanText(t, 40)).filter(Boolean))].slice(0, 60);
}

function normalizeName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/บริษัท|จำกัด|\(มหาชน\)|มหาชน|ประเทศไทย/g, '')
        .replace(/\b(co|ltd|limited|inc|corp|corporation|company|thailand)\b\.?/g, '')
        .replace(/[^a-z0-9ก-๙]/g, '');
}

// เก็บเฉพาะสถานีที่มีอยู่จริง (สูงสุด 6) และให้ชื่อสายใน tags ตรงกับสถานีที่เลือกเสมอ
// (ถ้าไม่ได้ส่ง stations มา จะไม่แตะ tags เดิม)
function withStations(fields, rawStations) {
    if (!Array.isArray(rawStations)) return fields;
    const stations = [...new Set(rawStations)].filter(v => VALID_STATIONS.has(v)).slice(0, 6);
    const lines = [...new Set(stations.map(v => LINE_BY_ID[v.split(':')[0]].name))];
    const tags = fields.tags.filter(t => !LINE_NAMES.includes(t));
    return { ...fields, stations, tags: [...tags, ...lines] };
}

function companyFields(body) {
    return withStations({
        name: cleanText(body.name, 150),
        loc: cleanText(body.loc, 200),
        sector: SECTORS.includes(body.sector) ? body.sector : 'เอกชน',
        desc: cleanText(body.desc, 1000),
        pay: cleanText(body.pay, 100),
        pos: cleanText(body.pos, 200),
        time: cleanText(body.time, 100),
        timeStart: cleanText(body.timeStart, 10),
        timeEnd: cleanText(body.timeEnd, 10),
        contact: cleanText(body.contact, 200),
        tags: [...new Set(cleanTags(body.tags).map(t => LEGACY_POSITION_MAP[t] || t))]
    }, body.stations);
}

const plain = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);
const isApproved = (c) => c.status !== 'pending';
const newId = (prefix) => prefix + Date.now() + crypto.randomBytes(2).toString('hex');

// ---------------------------------------------------------------------------
// Routes: Auth
// ---------------------------------------------------------------------------
app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    const isValid = admins.some(a => a.username === username && a.password === password);
    if (isValid) {
        res.json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', token: createToken(username) });
    } else {
        res.status(401).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' });
    }
});

// ---------------------------------------------------------------------------
// Routes: Companies (public)
// ---------------------------------------------------------------------------

// บริษัทที่อนุมัติแล้ว + คะแนนรีวิวเฉลี่ย
app.get('/api/companies', async (req, res) => {
    try {
        const [companies, reviews] = await Promise.all([Company.find(), Review.find({ status: 'approved' })]);
        const stats = {};
        reviews.map(plain).forEach(r => {
            const s = stats[r.companyId] || (stats[r.companyId] = { sum: 0, count: 0, rec: 0 });
            s.sum += Number(r.rating) || 0;
            s.count++;
            if (r.recommend) s.rec++;
        });
        const result = companies.map(plain).filter(isApproved).map(c => {
            const s = stats[c.id];
            return {
                ...c,
                reviewCount: s ? s.count : 0,
                ratingAvg: s ? Math.round((s.sum / s.count) * 10) / 10 : null,
                recommendPct: s ? Math.round((s.rec / s.count) * 100) : null
            };
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// เพิ่มบริษัท → รออนุมัติ
app.post('/api/companies', async (req, res) => {
    try {
        const data = companyFields(req.body || {});
        if (!data.name || !data.loc) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อบริษัทและสถานที่ตั้ง' });
        }

        const key = normalizeName(data.name);
        const existing = (await Company.find()).map(plain);
        const dup = key && existing.find(c => normalizeName(c.name) === key);
        if (dup) {
            return res.status(409).json({
                success: false,
                duplicate: true,
                message: isApproved(dup) ? `มี "${dup.name}" อยู่ในเว็บแล้ว` : `มีคนส่ง "${dup.name}" มาแล้ว กำลังรอแอดมินตรวจสอบ`
            });
        }

        const newCompany = new Company({ ...data, id: 'c' + Date.now(), status: 'pending', createdAt: new Date() });
        await newCompany.save();
        res.json({ success: true, pending: true, company: newCompany });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// รีวิวของบริษัท (เฉพาะที่อนุมัติแล้ว)
app.get('/api/companies/:id/reviews', async (req, res) => {
    try {
        const reviews = (await Review.find({ companyId: req.params.id, status: 'approved' })).map(plain);
        reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// เขียนรีวิว → รออนุมัติ
app.post('/api/companies/:id/reviews', async (req, res) => {
    try {
        const company = await Company.findOne({ id: req.params.id });
        if (!company || !isApproved(plain(company))) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });

        const body = req.body || {};
        const rating = Math.round(Number(body.rating));
        const text = cleanText(body.text, 1500);
        if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ success: false, message: 'กรุณาให้คะแนน 1-5 ดาว' });
        if (text.length < 10) return res.status(400).json({ success: false, message: 'เล่าประสบการณ์อย่างน้อย 10 ตัวอักษรนะ' });

        const review = new Review({
            id: newId('r'),
            companyId: req.params.id,
            rating,
            role: cleanText(body.role, 100),
            workMode: ['Onsite', 'Hybrid', 'Remote'].includes(body.workMode) ? body.workMode : '',
            pay: cleanText(body.pay, 100),
            recommend: body.recommend === true || body.recommend === 'yes',
            text,
            year: /^(25[0-9]{2}|20[0-9]{2})$/.test(String(body.year || '')) ? String(body.year) : '',
            interviewQuestions: cleanText(body.interviewQuestions, 1500),
            hasTest: yesNo(body.hasTest),
            needPortfolio: yesNo(body.needPortfolio),
            difficulty: ['easy', 'medium', 'hard'].includes(body.difficulty) ? body.difficulty : '',
            status: 'pending',
            createdAt: new Date()
        });
        await review.save();
        res.json({ success: true, pending: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// แจ้งข้อมูลผิด
app.post('/api/companies/:id/report', async (req, res) => {
    try {
        const company = await Company.findOne({ id: req.params.id });
        if (!company) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });
        const message = cleanText((req.body || {}).message, 1000);
        if (message.length < 5) return res.status(400).json({ success: false, message: 'ช่วยบอกหน่อยว่าข้อมูลตรงไหนผิด' });

        const report = new Report({ id: newId('p'), companyId: req.params.id, companyName: plain(company).name, message, createdAt: new Date() });
        await report.save();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Tag ยอดนิยม: นับเมื่อมีคนกดปุ่มลัดหรือใช้ตัวกรอง (นับเฉพาะ Tag ที่อยู่ในรายการ)
app.post('/api/stats/tags', async (req, res) => {
    try {
        const tags = Array.isArray((req.body || {}).tags) ? req.body.tags : [];
        const valid = [...new Set(tags)].filter(t => TRACKABLE_TAGS.includes(t)).slice(0, 5);
        for (const tag of valid) {
            const updated = await TagStat.findOneAndUpdate({ tag }, { $inc: { count: 1 } }, { new: true });
            if (!updated) await new TagStat({ tag, count: 1 }).save();
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/stats/popular', async (req, res) => {
    try {
        const totals = {};
        (await TagStat.find()).map(plain).forEach(s => {
            const tag = LEGACY_POSITION_MAP[s.tag] || s.tag;
            if (TRACKABLE_TAGS.includes(tag)) totals[tag] = (totals[tag] || 0) + (s.count || 0);
        });
        const top = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8);
        res.json(top.map(([tag, count]) => ({ tag, count })));
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---------------------------------------------------------------------------
// Routes: Admin (ต้อง login)
// ---------------------------------------------------------------------------

// บริษัททั้งหมด รวมที่รออนุมัติ
app.get('/api/admin/companies', requireAdmin, async (req, res) => {
    try {
        const companies = (await Company.find()).map(plain);
        res.json(companies.map(c => ({ ...c, status: c.status || 'approved' })));
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// แก้ไขบริษัท
app.put('/api/companies/:id', requireAdmin, async (req, res) => {
    try {
        const update = companyFields(req.body || {});
        if (['approved', 'pending'].includes((req.body || {}).status)) update.status = req.body.status;
        const updatedCompany = await Company.findOneAndUpdate({ id: req.params.id }, update, { new: true });
        if (!updatedCompany) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });
        res.json({ success: true, company: updatedCompany });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// อนุมัติบริษัท
app.post('/api/companies/:id/approve', requireAdmin, async (req, res) => {
    try {
        const updated = await Company.findOneAndUpdate({ id: req.params.id }, { status: 'approved' }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ลบบริษัท (พร้อมรีวิวและรายงานของบริษัทนั้น)
app.delete('/api/companies/:id', requireAdmin, async (req, res) => {
    try {
        await Company.findOneAndDelete({ id: req.params.id });
        await Review.deleteMany({ companyId: req.params.id });
        await Report.deleteMany({ companyId: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// รีวิวทั้งหมด (สำหรับตรวจ)
app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
    try {
        const [reviews, companies] = await Promise.all([Review.find(), Company.find()]);
        const names = {};
        companies.map(plain).forEach(c => { names[c.id] = c.name; });
        const result = reviews.map(plain).map(r => ({ ...r, companyName: names[r.companyId] || '(บริษัทถูกลบแล้ว)' }));
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/reviews/:id/approve', requireAdmin, async (req, res) => {
    try {
        const updated = await Review.findOneAndUpdate({ id: req.params.id }, { status: 'approved' }, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'ไม่พบรีวิวนี้' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/reviews/:id', requireAdmin, async (req, res) => {
    try {
        await Review.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// รายการแจ้งข้อมูลผิด
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
    try {
        const reports = (await Report.find()).map(plain);
        reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(reports);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/reports/:id', requireAdmin, async (req, res) => {
    try {
        await Report.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
