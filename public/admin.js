// admin.js — หน้าแอดมิน
// ต้องโหลด common.js ก่อนไฟล์นี้

let companiesCache = [];
let reviewsCache = [];
let reportsCache = [];
let currentTab = 'pending';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function getToken() {
    try { return sessionStorage.getItem('adminToken') || ''; } catch { return ''; }
}

async function authFetch(url, options = {}) {
    const res = await fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), Authorization: 'Bearer ' + getToken() }
    });
    if (res.status === 401) {
        try { sessionStorage.removeItem('adminToken'); } catch { /* ignore */ }
        showLogin();
        showToast('หมดเวลาเข้าสู่ระบบ กรุณา login ใหม่นะ', 'error');
        throw new Error('unauthorized');
    }
    return res;
}

function showLogin() {
    document.getElementById('loginWrap').style.display = '';
    document.getElementById('loginSection').style.display = '';
    document.getElementById('adminPanel').style.display = 'none';
}

function showPanel() {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadData();
}

function logout() {
    try { sessionStorage.removeItem('adminToken'); } catch { /* ignore */ }
    location.reload();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();

        if (data.success) {
            try { sessionStorage.setItem('adminToken', data.token); } catch { /* ignore */ }
            showPanel();
        } else {
            showToast(data.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        }
    } catch (err) {
        showToast('ไม่สามารถเชื่อมต่อ Server ได้', 'error');
    }
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function setTab(name) {
    currentTab = name;
    document.querySelectorAll('.admin-tab').forEach(t => {
        const on = t.dataset.tab === name;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
    });
    document.querySelectorAll('.admin-pane').forEach(p => p.classList.toggle('hidden', p.id !== 'pane-' + name));
}

document.querySelectorAll('.admin-tab').forEach(t => t.addEventListener('click', () => setTab(t.dataset.tab)));

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
async function loadData() {
    try {
        const [cRes, rRes, pRes] = await Promise.all([
            authFetch(`${API_URL}/admin/companies`),
            authFetch(`${API_URL}/admin/reviews`),
            authFetch(`${API_URL}/admin/reports`)
        ]);
        if (!cRes.ok || !rRes.ok || !pRes.ok) throw new Error('server');
        companiesCache = await cRes.json();
        reviewsCache = await rRes.json();
        reportsCache = await pRes.json();
        renderAll();
    } catch (err) {
        if (err.message === 'unauthorized') return;
        document.getElementById('pendingCompanies').innerHTML = emptyState('confused-404', 'โหลดข้อมูลไม่ได้ ลองรีเฟรชหน้าอีกครั้งนะ');
        document.getElementById('pendingReviews').innerHTML = '';
        document.getElementById('companyTableBody').innerHTML = '<tr><td class="admin-empty" colspan="5">โหลดข้อมูลไม่ได้</td></tr>';
    }
}

function renderAll() {
    const pendingCompanies = companiesCache.filter(c => c.status === 'pending');
    const pendingReviews = reviewsCache.filter(r => r.status === 'pending');
    const approvedCount = companiesCache.length - pendingCompanies.length;

    document.getElementById('adminCount').textContent = `แสดงบนเว็บ ${approvedCount} บริษัท`;
    setBadge('badgePending', pendingCompanies.length + pendingReviews.length);
    setBadge('badgeReports', reportsCache.length);

    document.getElementById('pendingCompanies').innerHTML = pendingCompanies.length
        ? pendingCompanies.map(pendingCompanyHTML).join('')
        : emptyState('happy', 'ไม่มีบริษัทค้างตรวจแล้ว เก่งมาก!');
    document.getElementById('pendingReviews').innerHTML = pendingReviews.length
        ? pendingReviews.map(r => reviewCardHTML(r)).join('')
        : emptyState('sleepy', 'ยังไม่มีรีวิวใหม่');

    renderTable();

    document.getElementById('allReviews').innerHTML = reviewsCache.length
        ? reviewsCache.map(r => reviewCardHTML(r)).join('')
        : emptyState('sleepy', 'ยังไม่มีรีวิวเลย');

    document.getElementById('reportList').innerHTML = reportsCache.length
        ? reportsCache.map(reportCardHTML).join('')
        : emptyState('happy', 'ไม่มีใครแจ้งข้อมูลผิด เยี่ยมไปเลย');
}

function setBadge(id, n) {
    const el = document.getElementById(id);
    el.textContent = n || '';
}

function emptyState(pose, text) {
    return `<div class="memo-state compact admin-empty-state"><img src="${MEMO}${pose}.webp" alt="" width="200" height="220"><p>${escapeHTML(text)}</p></div>`;
}

function formatDateTime(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' +
        date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function contactHTML(contact) {
    if (!contact || contact === '-') return '-';
    if (contact.startsWith('http') || contact.startsWith('www.')) {
        const url = contact.startsWith('www.') ? 'http://' + contact : contact;
        return `<a href="${escapeHTML(url)}" target="_blank" rel="noopener" class="link-break">${escapeHTML(contact)}</a>`;
    }
    return escapeHTML(contact);
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
function pendingCompanyHTML(c) {
    const id = escapeHTML(c.id);
    const tags = (c.tags || []).filter(t => t !== c.sector).map(t => `<span class="mini-tag">${escapeHTML(t)}</span>`).join('');
    const rows = [
        ['pin', c.loc], ['phone', c.contact], ['briefcase', c.pos], ['coins', c.pay], ['calendar', c.time], ['file', c.desc]
    ].filter(([, v]) => v && v !== '-')
        .map(([ic, v]) => `<p class="admin-row">${icon(ic)}<span>${ic === 'phone' ? contactHTML(v) : escapeHTML(v)}</span></p>`).join('');
    return `
        <article class="admin-card">
            <div class="admin-card-head">
                ${logoHTML(c)}
                <div>
                    <h4>${escapeHTML(c.name)}</h4>
                    <div class="card-pills"><span class="sector-tag ${SECTOR_CLASS[c.sector] || ''}">${escapeHTML(c.sector)}</span>${statusBadgeHTML(c)}</div>
                </div>
                <span class="admin-date">${formatDateTime(c.createdAt)}</span>
            </div>
            ${rows}
            ${tags ? `<div class="modal-tags">${tags}</div>` : ''}
            <div class="admin-card-actions">
                <button class="btn-approve" onclick="approveCompany('${id}')">${icon('check')}อนุมัติ</button>
                <button class="btn-edit" onclick="openEditModal('${id}')">${icon('pencil')}แก้ไข</button>
                <button class="btn-del" onclick="deleteCompany('${id}')">${icon('trash')}ลบ</button>
            </div>
        </article>`;
}

function reviewCardHTML(r) {
    const id = escapeHTML(r.id);
    const meta = [r.year ? `ฝึกปี ${r.year}` : '', r.role, r.workMode, r.pay ? `ได้ ${r.pay}` : ''].filter(Boolean).map(escapeHTML).join(' · ');
    const pending = r.status === 'pending';
    const facts = [
        r.difficulty ? DIFFICULTY_LABEL[r.difficulty] : '',
        r.hasTest === 'yes' ? 'มีข้อสอบ' : r.hasTest === 'no' ? 'ไม่มีข้อสอบ' : '',
        r.needPortfolio === 'yes' ? 'ใช้ portfolio' : r.needPortfolio === 'no' ? 'ไม่ต้องใช้ portfolio' : ''
    ].filter(Boolean);
    const interview = (facts.length || r.interviewQuestions) ? `
            <div class="review-interview">
                <p class="ri-title">${icon('mic')}สัมภาษณ์</p>
                ${facts.length ? `<div class="ri-facts">${facts.map(f => `<span class="mini-tag">${escapeHTML(f)}</span>`).join('')}</div>` : ''}
                ${r.interviewQuestions ? `<p class="review-text">${escapeHTML(r.interviewQuestions)}</p>` : ''}
            </div>` : '';
    return `
        <article class="admin-card ${pending ? 'is-pending' : ''}">
            <div class="admin-card-head simple">
                <div>
                    <h4>${escapeHTML(r.companyName)}</h4>
                    <div class="review-top">${starsHTML(r.rating)}<span class="review-rec ${r.recommend ? 'yes' : 'no'}">${icon('thumb')}${r.recommend ? 'แนะนำ' : 'ไม่แนะนำ'}</span>${pending ? '<span class="status-badge status-upcoming">รอตรวจ</span>' : ''}</div>
                </div>
                <span class="admin-date">${formatDateTime(r.createdAt)}</span>
            </div>
            ${meta ? `<p class="review-meta">${meta}</p>` : ''}
            <p class="review-text">${escapeHTML(r.text)}</p>
            ${interview}
            <div class="admin-card-actions">
                ${pending ? `<button class="btn-approve" onclick="approveReview('${id}')">${icon('check')}อนุมัติ</button>` : ''}
                <button class="btn-del" onclick="deleteReview('${id}')">${icon('trash')}ลบ</button>
            </div>
        </article>`;
}

function reportCardHTML(p) {
    const id = escapeHTML(p.id);
    const exists = companiesCache.some(c => c.id === p.companyId);
    return `
        <article class="admin-card">
            <div class="admin-card-head simple">
                <div><h4>${escapeHTML(p.companyName || '-')}</h4></div>
                <span class="admin-date">${formatDateTime(p.createdAt)}</span>
            </div>
            <p class="review-text">${icon('flag')} ${escapeHTML(p.message)}</p>
            <div class="admin-card-actions">
                ${exists ? `<button class="btn-edit" onclick="openEditModal('${escapeHTML(p.companyId)}')">${icon('pencil')}แก้ไขบริษัท</button>` : ''}
                <button class="btn-approve" onclick="resolveReport('${id}')">${icon('check')}จัดการแล้ว</button>
            </div>
        </article>`;
}

// ---------------------------------------------------------------------------
// ตารางบริษัททั้งหมด
// ---------------------------------------------------------------------------
function renderTable() {
    const tbody = document.getElementById('companyTableBody');
    const q = document.getElementById('adminSearch').value.trim().toLowerCase();
    const list = companiesCache.filter(c => !q || String(c.name).toLowerCase().includes(q));

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td class="admin-empty" colspan="5">${q ? 'ไม่พบบริษัทที่ค้นหา' : 'ยังไม่มีข้อมูลบริษัท'}</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(c => `
        <tr>
            <td class="cell-break td-name" data-label="ชื่อบริษัท">${escapeHTML(c.name)}${c.status === 'pending' ? ' <span class="status-badge status-upcoming">รออนุมัติ</span>' : ''}</td>
            <td data-label="ประเภท"><span class="sector-tag ${SECTOR_CLASS[c.sector] || ''}">${escapeHTML(c.sector)}</span></td>
            <td class="cell-break" data-label="สถานที่">${escapeHTML(c.loc)}</td>
            <td class="cell-break" data-label="ติดต่อ">${contactHTML(c.contact)}</td>
            <td class="td-actions">
                <button class="btn-edit" onclick="openEditModal('${escapeHTML(c.id)}')">${icon('pencil')}แก้ไข</button>
                <button class="btn-del" onclick="deleteCompany('${escapeHTML(c.id)}')">${icon('trash')}ลบ</button>
            </td>
        </tr>`).join('');
}

document.getElementById('adminSearch').addEventListener('input', renderTable);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function runAction(url, method, okMessage) {
    try {
        const res = await authFetch(url, { method });
        const result = await res.json();
        if (result.success) {
            showToast(okMessage, 'happy');
            await loadData();
        } else {
            showToast(result.message || 'ทำรายการไม่สำเร็จ', 'error');
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('ไม่สามารถเชื่อมต่อ Server ได้', 'error');
    }
}

function approveCompany(id) {
    runAction(`${API_URL}/companies/${encodeURIComponent(id)}/approve`, 'POST', 'อนุมัติแล้ว ขึ้นเว็บเรียบร้อย');
}

function deleteCompany(id) {
    const c = companiesCache.find(x => x.id === id);
    if (confirm(`ลบ "${c ? c.name : 'บริษัทนี้'}" และรีวิวทั้งหมดของบริษัทนี้?`)) {
        runAction(`${API_URL}/companies/${encodeURIComponent(id)}`, 'DELETE', 'ลบข้อมูลแล้ว');
    }
}

function approveReview(id) {
    runAction(`${API_URL}/reviews/${encodeURIComponent(id)}/approve`, 'POST', 'อนุมัติรีวิวแล้ว');
}

function deleteReview(id) {
    if (confirm('ลบรีวิวนี้?')) runAction(`${API_URL}/reviews/${encodeURIComponent(id)}`, 'DELETE', 'ลบรีวิวแล้ว');
}

function resolveReport(id) {
    runAction(`${API_URL}/reports/${encodeURIComponent(id)}`, 'DELETE', 'เคลียร์รายการแล้ว');
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------
document.getElementById('editTagHint').textContent = 'Tag ที่ใช้กรองได้: ' + [...POSITION_TAGS, ...WORKMODE_TAGS, ...TRANSIT_TAGS, 'มีค่าตอบแทน', ...OTHER_TAGS].join(', ');

function openEditModal(id) {
    const data = companiesCache.find(c => c.id === id);
    if (!data) return;

    const { start, end } = companyDates(data);
    const iso = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';

    document.getElementById('editId').value = data.id;
    document.getElementById('editStatus').value = data.status === 'pending' ? 'pending' : 'approved';
    document.getElementById('editName').value = data.name || '';
    document.getElementById('editLoc').value = data.loc || '';
    document.getElementById('editSector').value = data.sector || 'เอกชน';
    document.getElementById('editDesc').value = data.desc || '';
    document.getElementById('editPay').value = data.pay || '';
    document.getElementById('editPos').value = data.pos || '';
    document.getElementById('editTimeStart').value = iso(start);
    document.getElementById('editTimeEnd').value = iso(end);
    document.getElementById('editTime').value = end ? '' : (data.time && data.time !== '-' ? data.time : '');
    document.getElementById('editContact').value = data.contact || '';
    document.getElementById('editTags').value = data.tags ? data.tags.join(', ') : '';

    openModal('editModal');
}

function closeEditModal() {
    closeModal('editModal');
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;

    const rawTags = document.getElementById('editTags').value;
    const tagsArray = rawTags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    const tStart = document.getElementById('editTimeStart').value;
    const tEnd = document.getElementById('editTimeEnd').value;
    const timeText = document.getElementById('editTime').value.trim();
    const time = (tStart && tEnd) ? `${tStart} ถึง ${tEnd}` : (tEnd ? `ถึง ${tEnd}` : (timeText || '-'));

    const payload = {
        status: document.getElementById('editStatus').value,
        name: document.getElementById('editName').value,
        loc: document.getElementById('editLoc').value,
        sector: document.getElementById('editSector').value,
        desc: document.getElementById('editDesc').value,
        pay: document.getElementById('editPay').value,
        pos: document.getElementById('editPos').value,
        time,
        timeStart: tStart,
        timeEnd: tEnd,
        contact: document.getElementById('editContact').value,
        tags: tagsArray
    };

    try {
        const res = await authFetch(`${API_URL}/companies/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            showToast('แก้ไขข้อมูลเรียบร้อยแล้ว!', 'happy');
            closeEditModal();
            loadData();
        } else {
            showToast(result.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('ไม่สามารถเชื่อมต่อ Server ได้', 'error');
    }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
if (getToken()) {
    showPanel();
}
