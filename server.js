// server.js — Backend ของ Internship ICT (Express + MongoDB Atlas)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '1234';
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 ชั่วโมง

if (!MONGO_URI) {
    console.error('❌ กรุณาตั้งค่า MONGODB_URI ในไฟล์ .env หรือ Environment Variables');
    process.exit(1);
}

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Rate Limiters
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'ลองเข้าสู่ระบบบ่อยเกินไป รอ 15 นาทีแล้วลองใหม่นะ' }
});

const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'ส่งข้อมูลบ่อยเกินไป รอสักครู่แล้วลองใหม่นะ' }
});

const reportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'ส่งแจ้งเตือนบ่อยเกินไป รอสักครู่แล้วลองใหม่นะ' }
});

// ---------------------------------------------------------------------------
// MongoDB Connection & Schemas
// ---------------------------------------------------------------------------
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ เชื่อมต่อ MongoDB Atlas สำเร็จ'))
    .catch(err => {
        console.error('❌ เชื่อมต่อ MongoDB ไม่สำเร็จ:', err);
        process.exit(1);
    });

const SectionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    sourceLabel: { type: String, default: '' },
    loc: { type: String, default: '' },
    desc: { type: String, default: '' },
    pay: { type: String, default: '' },
    pos: { type: String, default: '' },
    time: { type: String, default: '-' },
    timeStart: { type: String, default: '' },
    timeEnd: { type: String, default: '' },
    contact: { type: String, default: '' },
    tags: { type: [String], default: [] },
    stations: { type: [String], default: [] },
    approvedAt: { type: Date, default: Date.now }
}, { _id: false });

const CompanySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    status: { type: String, enum: ['approved', 'pending'], default: 'pending' },
    name: { type: String, required: true },
    sector: { type: String, enum: ['เอกชน', 'ภาครัฐ', 'รัฐวิสาหกิจ'], default: 'เอกชน' },
    sourceLabel: { type: String, default: '' },
    loc: { type: String, default: '' },
    desc: { type: String, default: '' },
    pay: { type: String, default: '' },
    pos: { type: String, default: '' },
    time: { type: String, default: '-' },
    timeStart: { type: String, default: '' },
    timeEnd: { type: String, default: '' },
    contact: { type: String, default: '' },
    tags: { type: [String], default: [] },
    stations: { type: [String], default: [] },
    sections: { type: [SectionSchema], default: [] },
    ratingAvg: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const ReviewSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    companyId: { type: String, required: true, index: true },
    companyName: { type: String, default: '' },
    status: { type: String, enum: ['approved', 'pending'], default: 'pending' },
    rating: { type: Number, min: 1, max: 5, required: true },
    year: { type: String, default: '' },
    role: { type: String, default: '' },
    pay: { type: String, default: '' },
    workMode: { type: String, default: '' },
    recommend: { type: Boolean, default: true },
    difficulty: { type: String, default: '' },
    hasTest: { type: String, default: '' },
    needPortfolio: { type: String, default: '' },
    interviewQuestions: { type: String, default: '' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const ReportSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    companyId: { type: String, required: true },
    companyName: { type: String, default: '' },
    sectionLabel: { type: String, default: '' },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const TagStatSchema = new mongoose.Schema({
    tag: { type: String, required: true, unique: true },
    count: { type: Number, default: 1 },
    updatedAt: { type: Date, default: Date.now }
});

const Company = mongoose.model('Company', CompanySchema);
const Review = mongoose.model('Review', ReviewSchema);
const Report = mongoose.model('Report', ReportSchema);
const TagStat = mongoose.model('TagStat', TagStatSchema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function cleanStr(val, max = 500) {
    if (val === null || val === undefined) return '';
    return String(val).trim().slice(0, max);
}

function cleanArray(arr, maxItems = 30, maxLen = 80) {
    if (!Array.isArray(arr)) return [];
    return [...new Set(arr.map(x => cleanStr(x, maxLen)).filter(Boolean))].slice(0, maxItems);
}

function companyFields(body = {}) {
    const allowedSectors = ['เอกชน', 'ภาครัฐ', 'รัฐวิสาหกิจ'];
    const sector = allowedSectors.includes(body.sector) ? body.sector : 'เอกชน';

    const isNoDeadline = body.noDeadline === true || cleanStr(body.time, 100) === 'ไม่มีกำหนดปิดรับสมัคร';
    const timeStart = cleanStr(body.timeStart, 30);
    const timeEnd = isNoDeadline ? '' : cleanStr(body.timeEnd, 30);
    let time = cleanStr(body.time, 150) || '-';
    if (isNoDeadline) time = 'ไม่มีกำหนดปิดรับสมัคร';

    const tags = cleanArray(body.tags, 40, 80);
    if (!tags.includes(sector)) tags.unshift(sector);

    return {
        name: cleanStr(body.name, 150),
        sector,
        sourceLabel: cleanStr(body.sourceLabel, 150),
        loc: cleanStr(body.loc, 250),
        desc: cleanStr(body.desc, 2000),
        pay: cleanStr(body.pay, 120),
        pos: cleanStr(body.pos, 500),
        time,
        timeStart,
        timeEnd,
        contact: cleanStr(body.contact, 300),
        tags,
        stations: cleanArray(body.stations, 12, 60)
    };
}

function buildSectionFromFields(fields, sourceLabelOverride = '') {
    return {
        id: 'sec_' + Date.now() + crypto.randomBytes(2).toString('hex'),
        sourceLabel: sourceLabelOverride || fields.sourceLabel || 'ข้อมูลหลัก',
        loc: fields.loc,
        desc: fields.desc,
        pay: fields.pay,
        pos: fields.pos,
        time: fields.time,
        timeStart: fields.timeStart,
        timeEnd: fields.timeEnd,
        contact: fields.contact,
        tags: fields.tags,
        stations: fields.stations,
        approvedAt: new Date()
    };
}

async function recomputeCompanyRating(companyId) {
    const approvedReviews = await Review.find({ companyId, status: 'approved' }).select('rating');
    const count = approvedReviews.length;
    const avg = count
        ? Math.round((approvedReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count) * 10) / 10
        : 0;
    await Company.updateOne({ id: companyId }, { ratingAvg: avg, reviewCount: count });
}

// ---------------------------------------------------------------------------
// Admin Auth (In-memory Session Tokens)
// ---------------------------------------------------------------------------
const activeTokens = new Map();

function createToken() {
    const token = crypto.randomBytes(24).toString('hex');
    activeTokens.set(token, Date.now() + TOKEN_TTL_MS);
    return token;
}

function requireAdmin(req, res, next) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const expires = activeTokens.get(token);
    if (!token || !expires || expires < Date.now()) {
        activeTokens.delete(token);
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    activeTokens.set(token, Date.now() + TOKEN_TTL_MS);
    next();
}

app.post('/api/admin/login', loginLimiter, (req, res) => {
    const username = cleanStr(req.body?.username, 100);
    const password = cleanStr(req.body?.password, 100);

    if (username === ADMIN_USER && password === ADMIN_PASS) {
        return res.json({ success: true, token: createToken() });
    }
    return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
});

app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (token) activeTokens.delete(token);
    res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Public Routes: Companies
// ---------------------------------------------------------------------------
app.get('/api/companies', async (req, res) => {
    try {
        const list = await Company.find({ status: 'approved' }).sort({ createdAt: -1 }).lean();
        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ส่งเพิ่มบริษัทใหม่จากหน้าบ้าน (เข้าคิว pending)
app.post('/api/companies', submitLimiter, async (req, res) => {
    try {
        const fields = companyFields(req.body);
        if (!fields.name) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อบริษัท' });
        }

        const newCompany = new Company({
            id: 'comp_' + Date.now() + crypto.randomBytes(2).toString('hex'),
            status: 'pending',
            ...fields,
            sections: [buildSectionFromFields(fields)]
        });

        await newCompany.save();
        res.status(201).json({ success: true, id: newCompany.id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---------------------------------------------------------------------------
// Public Routes: Reviews & Reports & Tag Stats
// ---------------------------------------------------------------------------
app.get('/api/companies/:id/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({ companyId: req.params.id, status: 'approved' })
            .sort({ createdAt: -1 })
            .lean();
        res.json(reviews);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/companies/:id/reviews', submitLimiter, async (req, res) => {
    try {
        const c = await Company.findOne({ id: req.params.id, status: 'approved' });
        if (!c) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });

        const rating = Number(req.body?.rating);
        const text = cleanStr(req.body?.text, 1500);
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'กรุณาให้คะแนน 1-5 ดาว' });
        }
        if (text.length < 10) {
            return res.status(400).json({ success: false, message: 'กรุณาเล่าประสบการณ์อย่างน้อย 10 ตัวอักษร' });
        }

        const review = new Review({
            id: 'rev_' + Date.now() + crypto.randomBytes(2).toString('hex'),
            companyId: c.id,
            companyName: c.name,
            status: 'pending',
            rating,
            year: cleanStr(req.body?.year, 10),
            role: cleanStr(req.body?.role, 100),
            pay: cleanStr(req.body?.pay, 100),
            workMode: cleanStr(req.body?.workMode, 50),
            recommend: req.body?.recommend !== false,
            difficulty: cleanStr(req.body?.difficulty, 20),
            hasTest: cleanStr(req.body?.hasTest, 10),
            needPortfolio: cleanStr(req.body?.needPortfolio, 10),
            interviewQuestions: cleanStr(req.body?.interviewQuestions, 1500),
            text
        });

        await review.save();
        res.status(201).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// แจ้งข้อมูลผิด / ไม่อัปเดต (รองรับการระบุ sectionLabel แบบไม่บังคับ)
app.post('/api/companies/:id/report', reportLimiter, async (req, res) => {
    try {
        const c = await Company.findOne({ id: req.params.id });
        if (!c) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });

        const message = cleanStr(req.body?.message, 1000);
        const sectionLabel = cleanStr(req.body?.sectionLabel, 200);
        if (message.length < 5) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุรายละเอียดอย่างน้อย 5 ตัวอักษร' });
        }

        const report = new Report({
            id: 'rep_' + Date.now() + crypto.randomBytes(2).toString('hex'),
            companyId: c.id,
            companyName: c.name,
            sectionLabel,
            message
        });

        await report.save();
        res.status(201).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.get('/api/stats/popular', async (req, res) => {
    try {
        const items = await TagStat.find().sort({ count: -1, updatedAt: -1 }).limit(8).lean();
        res.json(items);
    } catch {
        res.json([]);
    }
});

app.post('/api/stats/tags', async (req, res) => {
    try {
        const tags = cleanArray(req.body?.tags, 10, 80);
        await Promise.all(tags.map(tag =>
            TagStat.updateOne(
                { tag },
                { $inc: { count: 1 }, $set: { updatedAt: new Date() } },
                { upsert: true }
            )
        ));
        res.json({ success: true });
    } catch {
        res.json({ success: false });
    }
});

// ---------------------------------------------------------------------------
// Admin Routes: Companies, Merge Sections, Reviews & Reports
// ---------------------------------------------------------------------------
app.get('/api/admin/companies', requireAdmin, async (req, res) => {
    try {
        const list = await Company.find().sort({ createdAt: -1 }).lean();
        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// แอดมินเพิ่มบริษัทโดยตรง (อนุมัติทันที)
app.post('/api/admin/companies', requireAdmin, async (req, res) => {
    try {
        const fields = companyFields(req.body);
        if (!fields.name) {
            return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อบริษัท' });
        }

        const newCompany = new Company({
            id: 'comp_' + Date.now() + crypto.randomBytes(2).toString('hex'),
            status: 'approved',
            ...fields,
            sections: [buildSectionFromFields(fields)]
        });

        await newCompany.save();
        res.status(201).json({ success: true, company: newCompany });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// อนุมัติบริษัทที่รออนุมัติ
app.patch('/api/companies/:id/approve', requireAdmin, async (req, res) => {
    try {
        const c = await Company.findOne({ id: req.params.id });
        if (!c) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });

        c.status = 'approved';
        if (!Array.isArray(c.sections) || c.sections.length === 0) {
            c.sections = [buildSectionFromFields(c)];
        }
        await c.save();
        res.json({ success: true, company: c });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// รวมข้อมูลบริษัทที่รออนุมัติ (sourceId) เข้าไปเป็นอีก Section ในบริษัทหลัก (targetId)
app.post('/api/admin/companies/:targetId/merge/:sourceId', requireAdmin, async (req, res) => {
    try {
        const target = await Company.findOne({ id: req.params.targetId });
        const source = await Company.findOne({ id: req.params.sourceId });
        if (!target || !source) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลบริษัทต้นทางหรือปลายทาง' });
        }
        if (target.id === source.id) {
            return res.status(400).json({ success: false, message: 'ไม่สามารถรวมบริษัทเดียวกันเองได้' });
        }

        if (!Array.isArray(target.sections) || target.sections.length === 0) {
            target.sections = [buildSectionFromFields(target, target.sourceLabel || 'ข้อมูลหลัก')];
        }

        const label = cleanStr(req.body?.sourceLabel, 150) || source.sourceLabel || `ข้อมูลเพิ่มเติม (${target.sections.length + 1})`;
        const incomingSections = (Array.isArray(source.sections) && source.sections.length > 0)
            ? source.sections.map((s, idx) => ({
                ...s.toObject(),
                id: 'sec_' + Date.now() + idx + crypto.randomBytes(2).toString('hex'),
                sourceLabel: idx === 0 ? label : (s.sourceLabel || label),
                approvedAt: new Date()
            }))
            : [buildSectionFromFields(source, label)];

        target.sections.push(...incomingSections);
        target.tags = [...new Set([target.sector, ...target.sections.flatMap(s => s.tags || [])])];
        target.stations = [...new Set(target.sections.flatMap(s => s.stations || []))].slice(0, 12);

        await target.save();
        await Company.deleteOne({ id: source.id });

        res.json({ success: true, company: target });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// แก้ไขบริษัท (รองรับการแก้ไขและบันทึกแยกตาม Section)
app.put('/api/companies/:id', requireAdmin, async (req, res) => {
    try {
        const body = req.body || {};
        const update = companyFields(body);
        if (['approved', 'pending'].includes(body.status)) update.status = body.status;

        if (Array.isArray(body.sections) && body.sections.length > 0) {
            update.sections = body.sections.map(s => {
                const cleaned = companyFields({ ...s, name: update.name, sector: update.sector });
                return {
                    id: s.id || ('sec_' + Date.now() + crypto.randomBytes(2).toString('hex')),
                    sourceLabel: cleaned.sourceLabel,
                    loc: cleaned.loc,
                    desc: cleaned.desc,
                    pay: cleaned.pay,
                    pos: cleaned.pos,
                    time: cleaned.time,
                    timeStart: cleaned.timeStart,
                    timeEnd: cleaned.timeEnd,
                    contact: cleaned.contact,
                    tags: cleaned.tags,
                    stations: cleaned.stations,
                    approvedAt: s.approvedAt || new Date()
                };
            });
            update.tags = [...new Set([update.sector, ...update.sections.flatMap(s => s.tags || [])])];
            update.stations = [...new Set(update.sections.flatMap(s => s.stations || []))].slice(0, 12);
        }

        const updatedCompany = await Company.findOneAndUpdate({ id: req.params.id }, update, { new: true });
        if (!updatedCompany) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });
        res.json({ success: true, company: updatedCompany });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ลบบริษัท (พร้อมรีวิวและแจ้งเตือนที่เกี่ยวข้อง)
app.delete('/api/companies/:id', requireAdmin, async (req, res) => {
    try {
        const deleted = await Company.findOneAndDelete({ id: req.params.id });
        if (!deleted) return res.status(404).json({ success: false, message: 'ไม่พบบริษัทนี้' });
        await Promise.all([
            Review.deleteMany({ companyId: req.params.id }),
            Report.deleteMany({ companyId: req.params.id })
        ]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin: Reviews
app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
    try {
        const list = await Review.find().sort({ createdAt: -1 }).lean();
        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.patch('/api/admin/reviews/:id/approve', requireAdmin, async (req, res) => {
    try {
        const rv = await Review.findOneAndUpdate({ id: req.params.id }, { status: 'approved' }, { new: true });
        if (!rv) return res.status(404).json({ success: false, message: 'ไม่พบรีวิวนี้' });
        await recomputeCompanyRating(rv.companyId);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
    try {
        const rv = await Review.findOneAndDelete({ id: req.params.id });
        if (!rv) return res.status(404).json({ success: false, message: 'ไม่พบรีวิวนี้' });
        await recomputeCompanyRating(rv.companyId);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin: Reports
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
    try {
        const list = await Report.find().sort({ createdAt: -1 }).lean();
        res.json(list);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.delete('/api/admin/reports/:id', requireAdmin, async (req, res) => {
    try {
        await Report.deleteOne({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});