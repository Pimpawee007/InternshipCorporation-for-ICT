// common.js — ฟังก์ชันที่ใช้ร่วมกันทุกหน้า (index / add / admin)
// โหลดไฟล์นี้ก่อน script ของแต่ละหน้าเสมอ

const API_URL = '/api';
const MEMO = 'assets/character/';

const SECTOR_CLASS = {
    'ภาครัฐ': 'gov-sector',
    'เอกชน': 'private-sector',
    'รัฐวิสาหกิจ': 'state-sector'
};

// Tag ที่ใช้ทั้งหน้าเพิ่มบริษัทและตัวกรอง (แก้ที่เดียว ใช้ได้ทุกหน้า)
const POSITION_TAGS = ['Frontend', 'Backend', 'Full-stack', 'Mobile', 'Data / AI', 'UX/UI', 'Network / Infra', 'Cybersecurity', 'QA / Tester', 'IT Support'];
const WORKMODE_TAGS = ['Onsite', 'Hybrid', 'Remote'];
const OTHER_TAGS = ['ภาคกลาง', 'ต่างจังหวัด', 'ต่างประเทศ', 'รับฝึกมากกว่า 2 เดือน'];
// ชื่อสายรถไฟฟ้ามาจาก transit-data.js (ต้องโหลดไฟล์นั้นก่อน common.js)
const TRANSIT_TAGS = TRANSIT_LINES.map(l => l.name);
const LINE_BY_ID = Object.fromEntries(TRANSIT_LINES.map(l => [l.id, l]));
// ถ้าเพิ่ม Tag ตำแหน่ง/รูปแบบงาน/อื่น ๆ ใหม่ อย่าลืมเพิ่มใน TRACKABLE_TAGS ของ server.js ด้วย

// Tag นี้อยู่หมวดไหนของตัวกรอง
function tagGroup(tag) {
    if (POSITION_TAGS.includes(tag)) return 'position';
    if (WORKMODE_TAGS.includes(tag)) return 'workmode';
    if (TRANSIT_TAGS.includes(tag)) return 'transit';
    return 'other';
}

const DIFFICULTY_LABEL = { easy: 'สัมภาษณ์ง่าย', medium: 'ปานกลาง', hard: 'ค่อนข้างยาก' };

// ---------------------------------------------------------------------------
// Icon sprite (Lucide style) — ใส่ครั้งเดียว ใช้ได้ทุกหน้าด้วย <svg class="icon"><use href="#i-..."/></svg>
// ---------------------------------------------------------------------------
const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    filter: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
    building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    'chev-left': '<path d="m15 18-6-6 6-6"/>',
    'chev-right': '<path d="m9 18 6-6-6-6"/>',
    'chev-down': '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
    plus: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    sort: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    'calendar-plus': '<path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    compare: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
    train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'
};

(function injectSprite() {
    const symbols = Object.entries(ICONS)
        .map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 24 24">${body}</symbol>`)
        .join('');
    document.body.insertAdjacentHTML('afterbegin', `<svg class="icon-sprite" aria-hidden="true" focusable="false">${symbols}</svg>`);
})();

function icon(name, cls = '') {
    return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

// กันไม่ให้ข้อความที่ผู้ใช้กรอก (ชื่อบริษัท ฯลฯ) กลายเป็น HTML บนหน้าเว็บ
function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ใช้เทียบชื่อบริษัทซ้ำ (ต้องตรงกับ normalizeName ใน server.js)
function normalizeName(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/บริษัท|จำกัด|\(มหาชน\)|มหาชน|ประเทศไทย/g, '')
        .replace(/\b(co|ltd|limited|inc|corp|corporation|company|thailand)\b\.?/g, '')
        .replace(/[^a-z0-9ก-๙]/g, '');
}

function hasPay(pay) {
    return Boolean(pay) && !['-', 'ไม่มี', 'ไม่มีค่าตอบแทน'].includes(String(pay).trim());
}

function formatThaiDate(date, withYear = false) {
    const opts = { day: 'numeric', month: 'short' };
    if (withYear) opts.year = '2-digit';
    return date.toLocaleDateString('th-TH', opts);
}

// ---------------------------------------------------------------------------
// โลโก้บริษัท: ลองดึง favicon จากเว็บไซต์/อีเมลบริษัท ถ้าไม่ได้ใช้ตัวอักษรย่อแทน
// ---------------------------------------------------------------------------
const FREE_MAIL = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com', 'icloud.com', 'msn.com'];

function companyDomain(contact) {
    const s = String(contact || '').trim().toLowerCase();
    if (!s || s === '-') return '';
    const email = s.match(/[\w.+-]+@([\w-]+(?:\.[\w-]+)+)/);
    if (email) return FREE_MAIL.includes(email[1]) ? '' : email[1];
    const url = s.match(/^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[\/?#:]|$)/);
    return url ? url[1] : '';
}

function companyInitials(name) {
    let n = String(name || '')
        .replace(/บริษัท|จำกัด|\(มหาชน\)|มหาชน|สำนักงาน|การ|กรม|ธนาคาร/g, ' ')
        .replace(/\b(co|ltd|limited|inc|corp|the)\b\.?/gi, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .trim();
    if (!n) n = String(name || '?').trim();
    if (/^[A-Za-z0-9]/.test(n)) {
        const words = n.split(/\s+/).filter(w => /^[A-Za-z0-9]/.test(w));
        return (words.slice(0, 2).map(w => w[0]).join('') || n[0]).toUpperCase();
    }
    // ภาษาไทย: ใช้พยัญชนะตัวแรก (ข้ามสระหน้า เ แ โ ใ ไ)
    const ch = n.replace(/^[เแโใไ]/, '')[0] || n[0];
    return ch;
}

function logoHTML(company, extraClass = '') {
    const domain = companyDomain(company.contact);
    const sectorCls = SECTOR_CLASS[company.sector] || '';
    const img = domain
        ? `<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128" alt="" loading="lazy" onload="logoLoaded(this)" onerror="logoFailed(this)">`
        : '';
    return `<span class="co-logo ${sectorCls} ${extraClass}" aria-hidden="true"><span class="co-initials">${escapeHTML(companyInitials(company.name))}</span>${img}</span>`;
}

function logoLoaded(img) {
    // Google ส่งรูปลูกโลก 16px กลับมาเมื่อหา favicon ไม่เจอ → ใช้ตัวอักษรย่อแทน
    if (img.naturalWidth <= 16) return logoFailed(img);
    img.parentElement.classList.add('has-img');
}

function logoFailed(img) {
    img.remove();
}

// ---------------------------------------------------------------------------
// สถานะการรับสมัคร (จากวันที่เริ่ม/สิ้นสุด)
// ---------------------------------------------------------------------------
function parseLocalDate(s) {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function companyDates(c) {
    let start = parseLocalDate(c.timeStart);
    let end = parseLocalDate(c.timeEnd);
    if (!end && c.time) {
        const m = String(c.time).match(/(\d{4}-\d{2}-\d{2})\s*ถึง\s*(\d{4}-\d{2}-\d{2})/);
        if (m) { start = parseLocalDate(m[1]); end = parseLocalDate(m[2]); }
    }
    return { start, end };
}

function deadlineStatus(c) {
    const { start, end } = companyDates(c);
    if (!end) return { key: 'unknown', label: '', end: null };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((end - today) / 86400000);
    if (days < 0) return { key: 'closed', label: 'ปิดรับแล้ว', end };
    if (start && start > today) return { key: 'upcoming', label: `เปิดรับ ${formatThaiDate(start)}`, end };
    if (days === 0) return { key: 'closing', label: 'ปิดรับวันนี้', end };
    if (days <= 14) return { key: 'closing', label: `ใกล้ปิด · อีก ${days} วัน`, end };
    return { key: 'open', label: `เปิดรับถึง ${formatThaiDate(end)}`, end };
}

// ลิงก์ตรงไปหน้ารายละเอียดบริษัท (ใช้แชร์)
function companyLink(id) {
    return new URL(`index.html?company=${encodeURIComponent(id)}`, location.href).href;
}

// ลิงก์เพิ่มวันปิดรับสมัครลง Google Calendar (เป็นนัดทั้งวัน)
function calendarURL(c) {
    const { end } = companyDates(c);
    if (!end) return '';
    const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const next = new Date(end); next.setDate(next.getDate() + 1);
    const pageUrl = companyLink(c.id);
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: `ปิดรับสมัครฝึกงาน: ${c.name}`,
        dates: `${fmt(end)}/${fmt(next)}`,
        details: `วันสุดท้ายของการรับสมัครฝึกงานที่ ${c.name}\nดูรายละเอียด: ${pageUrl}`,
        location: c.loc || ''
    });
    return `https://calendar.google.com/calendar/render?${params}`;
}

function statusBadgeHTML(c) {
    const st = deadlineStatus(c);
    if (st.key === 'unknown') return '';
    return `<span class="status-badge status-${st.key}">${icon('clock')}${escapeHTML(st.label)}</span>`;
}

// ---------------------------------------------------------------------------
// ดาวรีวิว
// ---------------------------------------------------------------------------
function starsHTML(rating) {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    return `<span class="stars" style="--rating:${r}" role="img" aria-label="${r} จาก 5 ดาว">★★★★★</span>`;
}

// ---------------------------------------------------------------------------
// บริษัทที่บันทึกไว้ (เก็บในเบราว์เซอร์ของแต่ละคน)
// ---------------------------------------------------------------------------
const SAVED_KEY = 'ict-saved-companies';

function getSaved() {
    try { return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')); }
    catch { return new Set(); }
}

function setSaved(set) {
    try { localStorage.setItem(SAVED_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------
function chipsHTML(values, { name = '', type = 'checkbox', group = '' } = {}) {
    return values.map(v => `<label class="chip"><input type="${type}" ${name ? `name="${name}"` : ''} ${group ? `data-group="${group}"` : ''} value="${escapeHTML(v)}"><span>${escapeHTML(v)}</span></label>`).join('');
}

// ---------------------------------------------------------------------------
// สถานีรถไฟฟ้า
// ค่า "bts-sukhumvit:อโศก" = สถานีเดียว, "bts-sukhumvit:*" = ทั้งสาย (ใช้ในตัวกรอง)
// ---------------------------------------------------------------------------
function lineByName(name) {
    return TRANSIT_LINES.find(l => l.name === name) || null;
}

function stationLabel(value) {
    const [id, st] = String(value).split(':');
    const line = LINE_BY_ID[id];
    if (!line) return value;
    return st === '*' ? line.name : `${line.short} ${st}`;
}

function lineColor(value) {
    return (LINE_BY_ID[String(value).split(':')[0]] || {}).color || '#9AB0AD';
}

function stationPillHTML(value) {
    return `<span class="station-pill" style="--line:${lineColor(value)}"><i></i>${escapeHTML(stationLabel(value))}</span>`;
}

function companyMatchesTransit(c, values) {
    const stations = c.stations || [];
    const tags = c.tags || [];
    return values.some(v => {
        const [id, st] = v.split(':');
        if (st === '*') {
            const line = LINE_BY_ID[id];
            return (line && tags.includes(line.name)) || stations.some(s => s.startsWith(id + ':'));
        }
        return stations.includes(v);
    });
}

// ตัวเลือกสถานี: เลือกสายก่อน แล้วเลือกสถานีในสายนั้น (หรือพิมพ์ค้นหาชื่อสถานีข้ามทุกสาย)
function createStationPicker(root, { max = 0, allowWholeLine = false, onChange = () => {} } = {}) {
    let selected = [];
    let activeLine = TRANSIT_LINES[0].id;
    let query = '';

    root.classList.add('station-picker');
    root.innerHTML = `
        <div class="sp-lines" role="tablist" aria-label="เลือกสายรถไฟฟ้า">
            ${TRANSIT_LINES.map(l => `<button type="button" class="sp-line" role="tab" data-line="${l.id}" style="--line:${l.color}"><i></i>${escapeHTML(l.name)}<span class="sp-line-count"></span></button>`).join('')}
        </div>
        <label class="sp-search">${icon('search')}<input type="text" placeholder="หรือพิมพ์ชื่อสถานี เช่น อโศก, ลาดพร้าว" aria-label="ค้นหาสถานี"></label>
        <div class="sp-stations"></div>
        <div class="sp-selected" aria-live="polite"></div>`;

    const q = (sel) => root.querySelector(sel);
    const input = q('.sp-search input');

    function render() {
        root.querySelectorAll('.sp-line').forEach(btn => {
            const on = btn.dataset.line === activeLine && !query;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', String(on));
            const n = selected.filter(v => v.startsWith(btn.dataset.line + ':')).length;
            btn.querySelector('.sp-line-count').textContent = n || '';
        });

        let items;
        if (query) {
            items = TRANSIT_LINES.flatMap(l => l.stations
                .filter(st => st.includes(query))
                .map(st => ({ v: `${l.id}:${st}`, label: `${l.short} ${st}`, color: l.color }))).slice(0, 40);
        } else {
            const line = LINE_BY_ID[activeLine];
            items = line.stations.map(st => ({ v: `${line.id}:${st}`, label: st, color: line.color }));
            if (allowWholeLine) items.unshift({ v: `${line.id}:*`, label: 'ทุกสถานีในสายนี้', color: line.color, whole: true });
        }

        q('.sp-stations').innerHTML = items.length
            ? items.map(it => {
                const on = selected.includes(it.v);
                return `<button type="button" class="sp-station ${it.whole ? 'whole' : ''} ${on ? 'is-on' : ''}" data-v="${escapeHTML(it.v)}" aria-pressed="${on}" style="--line:${it.color}">${escapeHTML(it.label)}</button>`;
            }).join('')
            : '<p class="sp-empty">ไม่พบสถานีชื่อนี้</p>';

        q('.sp-selected').innerHTML = selected.length
            ? '<span class="sp-sel-label">เลือกแล้ว:</span>' + selected.map(v =>
                `<button type="button" class="station-pill removable" data-rm="${escapeHTML(v)}" style="--line:${lineColor(v)}" aria-label="เอา ${escapeHTML(stationLabel(v))} ออก"><i></i>${escapeHTML(stationLabel(v))}${icon('x')}</button>`).join('')
            : '';
    }

    function toggle(v) {
        if (selected.includes(v)) {
            selected = selected.filter(x => x !== v);
        } else {
            if (max && selected.length >= max) return showToast(`เลือกได้สูงสุด ${max} สถานีนะ`, 'error');
            selected = [...selected, v];
        }
        render();
        onChange([...selected]);
    }

    root.addEventListener('click', (e) => {
        const line = e.target.closest('.sp-line');
        if (line) {
            activeLine = line.dataset.line;
            query = '';
            input.value = '';
            return render();
        }
        const st = e.target.closest('.sp-station');
        if (st) return toggle(st.dataset.v);
        const rm = e.target.closest('[data-rm]');
        if (rm) return toggle(rm.dataset.rm);
    });

    input.addEventListener('input', () => { query = input.value.trim(); render(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

    render();

    return {
        get: () => [...selected],
        set(values) {
            selected = (Array.isArray(values) ? values : []).filter(v => LINE_BY_ID[String(v).split(':')[0]]);
            if (selected[0]) activeLine = selected[0].split(':')[0];
            query = '';
            input.value = '';
            render();
        }
    };
}

// ---------------------------------------------------------------------------
// Memo toast (แทน alert)
// ---------------------------------------------------------------------------
let toastTimer;
function showToast(message, mood = 'excited') {
    const toast = document.getElementById('memoToast');
    if (!toast) return;
    const img = document.getElementById('memoToastImg');
    const map = { excited: 'excited.webp', happy: 'happy.webp', error: 'confused-404.webp' };
    img.src = MEMO + (map[mood] || map.excited);
    img.alt = mood === 'error' ? 'Memo กำลังงง' : 'Memo กำลังดีใจ';
    document.getElementById('memoToastText').textContent = message;
    toast.classList.toggle('is-error', mood === 'error');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------
function openModal(id) {
    document.getElementById(id).style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    if (![...document.querySelectorAll('.modal')].some(m => m.style.display === 'flex')) {
        document.body.classList.remove('modal-open');
    }
}

window.addEventListener('click', (event) => {
    if (event.target.classList && event.target.classList.contains('modal')) closeModal(event.target.id);
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal').forEach(m => { if (m.style.display === 'flex') closeModal(m.id); });
});
