// admin.js — หน้าจัดการสำหรับแอดมิน (อนุมัติ รวม Section แก้ไข ลบ และตรวจรีวิว/แจ้งข้อมูลผิด)
// ต้องโหลด transit-data.js, tag-data.js และ common.js ก่อนไฟล์นี้

const TOKEN_KEY = 'ict-admin-token';
let companiesCache = [];
let reviewsCache = [];
let reportsCache = [];
let activeTab = 'pending';

function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
}

async function authFetch(url, options = {}) {
    const headers = { ...(options.headers || {}), Authorization: `Bearer ${getToken()}` };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
        setToken('');
        showLoginView();
        showToast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 'error');
        throw new Error('unauthorized');
    }
    return res;
}

// ---------------------------------------------------------------------------
// Auth & View Switching
// ---------------------------------------------------------------------------
function showLoginView() {
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('dashboardContainer').classList.add('hidden');
    document.getElementById('btnLogout').classList.add('hidden');
}

function showDashboardView() {
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('dashboardContainer').classList.remove('hidden');
    document.getElementById('btnLogout').classList.remove('hidden');
}

async function initAdmin() {
    if (!getToken()) return showLoginView();
    try {
        const res = await fetch(`${API_URL}/admin/verify`, {
            headers: { Authorization: `Bearer ${getToken()}` }
        });
        if (!res.ok) throw new Error('invalid token');
        showDashboardView();
        loadData();
    } catch {
        setToken('');
        showLoginView();
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('adminUser').value.trim();
    const password = document.getElementById('adminPass').value;
    const errEl = document.getElementById('loginError');
    errEl.style.display = 'none';

    try {
        const res = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success && data.token) {
            setToken(data.token);
            e.target.reset();
            showDashboardView();
            loadData();
        } else {
            errEl.textContent = data.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
            errEl.style.display = 'block';
        }
    } catch {
        errEl.textContent = 'ไม่สามารถเชื่อมต่อ Server ได้';
        errEl.style.display = 'block';
    }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
    try {
        await fetch(`${API_URL}/admin/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` }
        });
    } catch { /* ignore */ }
    setToken('');
    showLoginView();
});

// ---------------------------------------------------------------------------
// Load All Admin Data
// ---------------------------------------------------------------------------
async function loadData() {
    try {
        const [compRes, revRes, repRes] = await Promise.all([
            authFetch(`${API_URL}/admin/companies`),
            authFetch(`${API_URL}/admin/reviews`),
            authFetch(`${API_URL}/admin/reports`)
        ]);

        companiesCache = await compRes.json();
        reviewsCache = await revRes.json();
        reportsCache = await repRes.json();

        updateTabCounts();
        renderAllViews();
    } catch (err) {
        if (err.message !== 'unauthorized') {
            console.error(err);
            showToast('โหลดข้อมูลไม่สำเร็จ', 'error');
        }
    }
}

function updateTabCounts() {
    const pendingComp = companiesCache.filter(c => c.status === 'pending').length;
    const approvedComp = companiesCache.filter(c => c.status === 'approved').length;
    const pendingRev = reviewsCache.filter(r => r.status === 'pending').length;
    const repCount = reportsCache.length;

    document.getElementById('pendingCount').textContent = pendingComp;
    document.getElementById('approvedCount').textContent = approvedComp;
    document.getElementById('reviewCount').textContent = pendingRev;
    document.getElementById('reportCount').textContent = repCount;
}

function renderAllViews() {
    const q = (document.getElementById('adminSearch')?.value || '').trim().toLowerCase();

    const matchCompany = (c) => {
        if (!q) return true;
        const sections = Array.isArray(c.sections) ? c.sections : [];
        const hay = [
            c.name, c.sector, c.loc, c.pos, c.desc,
            ...(c.tags || []),
            ...sections.flatMap(s => [s.sourceLabel, s.loc, s.pos, s.desc])
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
    };

    const pendingList = companiesCache.filter(c => c.status === 'pending' && matchCompany(c));
    const approvedList = companiesCache.filter(c => c.status === 'approved' && matchCompany(c));

    renderPendingCompanies(pendingList);
    renderApprovedCompanies(approvedList);
    renderPendingReviews(reviewsCache.filter(r => r.status === 'pending'));
    renderReports(reportsCache);
}

document.getElementById('adminSearch')?.addEventListener('input', renderAllViews);

// ---------------------------------------------------------------------------
// Tabs Navigation
// ---------------------------------------------------------------------------
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));

        document.getElementById('pendingSection').classList.toggle('hidden', activeTab !== 'pending');
        document.getElementById('approvedSection').classList.toggle('hidden', activeTab !== 'approved');
        document.getElementById('reviewsSection').classList.toggle('hidden', activeTab !== 'reviews');
        document.getElementById('reportsSection').classList.toggle('hidden', activeTab !== 'reports');
    });
});

// ---------------------------------------------------------------------------
// Render Companies (Pending & Approved)
// ---------------------------------------------------------------------------
function findDuplicateTargets(pendingItem) {
    const norm = String(pendingItem.name || '').trim().toLowerCase();
    if (!norm) return [];
    return companiesCache.filter(c =>
        c.status === 'approved' &&
        c.id !== pendingItem.id &&
        (String(c.name || '').trim().toLowerCase() === norm ||
         String(c.name || '').trim().toLowerCase().includes(norm) ||
         norm.includes(String(c.name || '').trim().toLowerCase()))
    );
}

function renderPendingCompanies(list) {
    const grid = document.getElementById('pendingList');
    if (!list.length) {
        grid.innerHTML = `
            <div class="memo-state empty-box">
                <img src="assets/character/happy.webp" alt="" width="240" height="280">
                <p>ไม่มีบริษัทที่รออนุมัติในขณะนี้</p>
            </div>`;
        return;
    }

    grid.innerHTML = list.map(c => {
        const dupTargets = findDuplicateTargets(c);
        const dupAlertHTML = dupTargets.length ? `
            <div class="dup-merge-box">
                <p>⚠️ พบชื่อใกล้เคียงในระบบแล้ว: <strong>${escapeHTML(dupTargets[0].name)}</strong></p>
                <div class="merge-controls">
                    <input type="text" id="mergeLabel_${escapeHTML(c.id)}" placeholder="ชื่อหัวข้อ Section (เช่น รอบสหกิจ, ประกาศเพิ่ม)" value="${escapeHTML(c.sourceLabel || '')}">
                    <button type="button" class="btn-merge" onclick="mergeCompany('${escapeHTML(dupTargets[0].id)}', '${escapeHTML(c.id)}')">รวมเป็นอีก Section</button>
                </div>
            </div>` : '';

        return `
            <div class="admin-card pending-card">
                <div class="card-header">
                    <span class="badge-sector">${escapeHTML(c.sector || 'เอกชน')}</span>
                    ${statusBadgeHTML(c)}
                </div>
                <h3>${escapeHTML(c.name)}</h3>
                <p class="card-meta"><strong>สถานที่:</strong> ${escapeHTML(c.loc || '-')}</p>
                <p class="card-meta"><strong>ตำแหน่ง:</strong> ${escapeHTML(c.pos || (c.tags || []).filter(t => POSITION_TAGS.includes(t)).join(', ') || '-')}</p>
                <p class="card-meta"><strong>ค่าตอบแทน:</strong> ${escapeHTML(c.pay || '-')}</p>
                <p class="card-meta"><strong>รับสมัคร:</strong> ${escapeHTML(c.time || '-')}</p>
                ${c.desc ? `<p class="card-desc-admin">${escapeHTML(c.desc)}</p>` : ''}
                ${dupAlertHTML}
                <div class="card-actions">
                    <button type="button" class="btn-approve" onclick="approveCompany('${escapeHTML(c.id)}')">อนุมัติขึ้นเว็บ</button>
                    <button type="button" class="btn-edit" onclick="openEditModal('${escapeHTML(c.id)}')">แก้ไขก่อน</button>
                    <button type="button" class="btn-delete" onclick="deleteCompany('${escapeHTML(c.id)}', '${escapeHTML(c.name)}')">ลบทิ้ง</button>
                </div>
            </div>`;
    }).join('');
}

function renderApprovedCompanies(list) {
    const grid = document.getElementById('approvedList');
    if (!list.length) {
        grid.innerHTML = `
            <div class="memo-state empty-box">
                <img src="assets/character/confused-404.webp" alt="" width="240" height="280">
                <p>ไม่พบบริษัทที่ตรงกับคำค้นหา</p>
            </div>`;
        return;
    }

    grid.innerHTML = list.map(c => {
        const secCount = Array.isArray(c.sections) ? c.sections.length : 0;
        return `
            <div class="admin-card">
                <div class="card-header">
                    <span class="badge-sector">${escapeHTML(c.sector || 'เอกชน')}</span>
                    ${statusBadgeHTML(c)}
                    ${secCount > 1 ? `<span class="status-badge status-note">${secCount} Sections</span>` : ''}
                </div>
                <h3>${escapeHTML(c.name)}</h3>
                <p class="card-meta"><strong>สถานที่:</strong> ${escapeHTML(c.loc || '-')}</p>
                <p class="card-meta"><strong>ค่าตอบแทน:</strong> ${escapeHTML(c.pay || '-')}</p>
                <p class="card-meta"><strong>รับสมัคร:</strong> ${escapeHTML(c.time || '-')}</p>
                <div class="card-actions">
                    <button type="button" class="btn-edit" onclick="openEditModal('${escapeHTML(c.id)}')">แก้ไขข้อมูล</button>
                    <button type="button" class="btn-delete" onclick="deleteCompany('${escapeHTML(c.id)}', '${escapeHTML(c.name)}')">ลบ</button>
                </div>
            </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Render Reviews & Reports
// ---------------------------------------------------------------------------
function renderPendingReviews(list) {
    const grid = document.getElementById('reviewsList');
    if (!list.length) {
        grid.innerHTML = `
            <div class="memo-state empty-box">
                <img src="assets/character/happy.webp" alt="" width="240" height="280">
                <p>ไม่มีรีวิวที่รอตรวจสอบ</p>
            </div>`;
        return;
    }

    grid.innerHTML = list.map(r => {
        const dateStr = r.createdAt ? formatThaiDate(new Date(r.createdAt), true) : '';
        return `
            <div class="admin-card">
                <div class="card-header">
                    <span class="badge-sector">${'★'.repeat(r.rating || 5)}</span>
                    <span class="meta-date">${escapeHTML(dateStr)}</span>
                </div>
                <h3>${escapeHTML(r.companyName || r.companyId)}</h3>
                <p class="card-meta">${escapeHTML([r.year ? `ปี ${r.year}` : '', r.role, r.workMode, r.pay].filter(Boolean).join(' · ') || 'ไม่ระบุรายละเอียดเสริม')}</p>
                <p class="review-body-text">${escapeHTML(r.text)}</p>
                ${r.interviewQuestions ? `<p class="card-meta"><strong>สัมภาษณ์:</strong> ${escapeHTML(r.interviewQuestions)}</p>` : ''}
                <div class="card-actions">
                    <button type="button" class="btn-approve" onclick="approveReview('${escapeHTML(r.id)}')">อนุมัติรีวิว</button>
                    <button type="button" class="btn-delete" onclick="deleteReview('${escapeHTML(r.id)}')">ลบทิ้ง</button>
                </div>
            </div>`;
    }).join('');
}

function renderReports(list) {
    const grid = document.getElementById('reportsList');
    if (!grid) return;
    if (!list.length) {
        grid.innerHTML = `
            <div class="memo-state empty-box">
                <img src="assets/character/happy.webp" alt="" width="240" height="280">
                <p>ยังไม่มีการแจ้งข้อมูลผิด</p>
            </div>`;
        return;
    }

    grid.innerHTML = list.map(r => {
        const dateStr = r.createdAt ? formatThaiDate(new Date(r.createdAt), true) : '';
        const secBadge = r.sectionLabel
            ? `<span class="status-badge status-open">${escapeHTML(r.sectionLabel)}</span>`
            : `<span class="status-badge status-note">ไม่ระบุ Section (แอดมินเลือกเอง)</span>`;
        return `
            <div class="admin-card">
                <div class="card-header">
                    <span class="badge-sector">แจ้งข้อมูลผิด</span>
                    ${secBadge}
                    <span class="meta-date">${escapeHTML(dateStr)}</span>
                </div>
                <h3>${escapeHTML(r.companyName || r.companyId)}</h3>
                <p class="review-body-text">${escapeHTML(r.message)}</p>
                <div class="card-actions">
                    <button type="button" class="btn-edit" onclick="openEditModal('${escapeHTML(r.companyId)}')">ไปแก้ไขบริษัท</button>
                    <button type="button" class="btn-delete" onclick="dismissReport('${escapeHTML(r.id)}')">ลบแจ้งเตือนนี้</button>
                </div>
            </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Admin Actions (Approve, Merge, Delete)
// ---------------------------------------------------------------------------
async function approveCompany(id) {
    try {
        const res = await authFetch(`${API_URL}/companies/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
        const data = await res.json();
        if (data.success) {
            showToast('อนุมัติบริษัทขึ้นเว็บแล้ว!', 'happy');
            loadData();
        } else {
            showToast(data.message || 'อนุมัติไม่สำเร็จ', 'error');
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    }
}

async function mergeCompany(targetId, sourceId) {
    const labelInput = document.getElementById(`mergeLabel_${sourceId}`);
    const sourceLabel = labelInput ? labelInput.value.trim() : '';
    try {
        const res = await authFetch(`${API_URL}/admin/companies/${encodeURIComponent(targetId)}/merge/${encodeURIComponent(sourceId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceLabel })
        });
        const data = await res.json();
        if (data.success) {
            showToast('รวมข้อมูลเป็น Section ใหม่เรียบร้อย!', 'happy');
            loadData();
        } else {
            showToast(data.message || 'รวมข้อมูลไม่สำเร็จ', 'error');
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    }
}

async function deleteCompany(id, name) {
    if (!confirm(`ยืนยันลบบริษัท "${name}" ออกจากระบบถาวร?`)) return;
    try {
        const res = await authFetch(`${API_URL}/companies/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('ลบบริษัทเรียบร้อยแล้ว');
            loadData();
        } else {
            showToast(data.message || 'ลบไม่สำเร็จ', 'error');
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    }
}

async function approveReview(id) {
    try {
        const res = await authFetch(`${API_URL}/admin/reviews/${encodeURIComponent(id)}/approve`, { method: 'PATCH' });
        const data = await res.json();
        if (data.success) {
            showToast('อนุมัติรีวิวแล้ว!', 'happy');
            loadData();
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    }
}

async function deleteReview(id) {
    if (!confirm('ยืนยันลบรีวิวนี้?')) return;
    try {
        const res = await authFetch(`${API_URL}/admin/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('ลบรีวิวเรียบร้อย');
            loadData();
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    }
}

async function dismissReport(id) {
    try {
        const res = await authFetch(`${API_URL}/admin/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('ลบแจ้งเตือนเรียบร้อย');
            loadData();
        }
    } catch (err) {
        if (err.message !== 'unauthorized') showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    }
}

// ---------------------------------------------------------------------------
// Edit Modal (รองรับการเลือกแก้ราย Section + ไม่มีกำหนดปิดรับสมัคร)
// ---------------------------------------------------------------------------
document.getElementById('editTagHint').textContent = 'Tag ที่ใช้กรองได้: ' + [...WORKMODE_TAGS, 'มีค่าตอบแทน', ...OTHER_TAGS].join(', ') + ' (ตำแหน่งงานกับรถไฟฟ้าเลือกจากปุ่มด้านบน)';

const editStationPicker = createStationPicker(document.getElementById('editStations'), { max: 6 });
const editPositionPicker = createPositionPicker(document.getElementById('editPositions'));

let editingCompany = null;
let editingSectionIndex = 0;

const editNoDeadlineEl = document.getElementById('editNoDeadline');
const editTimeEndEl = document.getElementById('editTimeEnd');
const editTimeTextEl = document.getElementById('editTime');

editNoDeadlineEl.addEventListener('change', function () {
    if (this.checked) {
        editTimeEndEl.value = '';
        editTimeEndEl.disabled = true;
        editTimeTextEl.value = '';
        editTimeTextEl.disabled = true;
    } else {
        editTimeEndEl.disabled = false;
        editTimeTextEl.disabled = false;
    }
});

function fillEditSectionFields(sec) {
    const { start, end } = companyDates(sec);
    const iso = (d) => d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';

    document.getElementById('editSourceLabel').value = sec.sourceLabel || '';
    document.getElementById('editLoc').value = sec.loc || '';
    document.getElementById('editDesc').value = sec.desc || '';
    document.getElementById('editPay').value = sec.pay || '';
    document.getElementById('editPos').value = sec.pos || '';
    document.getElementById('editTimeStart').value = iso(start);
    document.getElementById('editTimeEnd').value = iso(end);

    const isNoDeadline = sec.time === 'ไม่มีกำหนดปิดรับสมัคร';
    editNoDeadlineEl.checked = isNoDeadline;
    editTimeEndEl.disabled = isNoDeadline;
    editTimeTextEl.disabled = isNoDeadline;
    editTimeTextEl.value = (end || isNoDeadline) ? '' : (sec.time && sec.time !== '-' ? sec.time : '');

    document.getElementById('editContact').value = sec.contact || '';
    document.getElementById('editTags').value = (sec.tags || [])
        .filter(t => !TRANSIT_TAGS.includes(t) && !POSITION_TAGS.includes(t) && !['เอกชน', 'ภาครัฐ', 'รัฐวิสาหกิจ'].includes(t))
        .join(', ');

    editStationPicker.set(sec.stations || []);
    const chosen = (sec.tags || []).filter(t => POSITION_TAGS.includes(t));
    const guessed = chosen.length ? [] : inferPositions(sec.pos);
    editPositionPicker.set(chosen.length ? chosen : guessed);

    const hint = document.getElementById('editPosHint');
    hint.classList.toggle('hidden', !guessed.length);
    hint.textContent = guessed.length ? 'Memo เลือกตำแหน่งให้จากข้อความด้านล่างแล้ว ตรวจดูก่อนกดบันทึกนะ' : '';
}

document.getElementById('editSectionSelect').addEventListener('change', (e) => {
    if (!editingCompany) return;
    editingSectionIndex = Number(e.target.value) || 0;
    const sections = (Array.isArray(editingCompany.sections) && editingCompany.sections.length > 0)
        ? editingCompany.sections
        : [editingCompany];
    fillEditSectionFields(sections[editingSectionIndex] || sections[0]);
});

function openEditModal(id) {
    const data = companiesCache.find(c => c.id === id);
    if (!data) return;

    editingCompany = data;
    editingSectionIndex = 0;

    document.getElementById('editId').value = data.id;
    document.getElementById('editStatus').value = data.status === 'pending' ? 'pending' : 'approved';
    document.getElementById('editName').value = data.name || '';
    document.getElementById('editSector').value = data.sector || 'เอกชน';

    const sections = (Array.isArray(data.sections) && data.sections.length > 0) ? data.sections : [data];
    const sectionBox = document.getElementById('editSectionBox');
    const sectionSelect = document.getElementById('editSectionSelect');

    if (sections.length > 1) {
        sectionBox.classList.remove('hidden');
        sectionSelect.innerHTML = sections.map((s, idx) =>
            `<option value="${idx}">Section ${idx + 1}: ${escapeHTML(s.sourceLabel || s.pos || s.loc || 'ไม่มีชื่อหัวข้อ')}</option>`
        ).join('');
    } else {
        sectionBox.classList.add('hidden');
        sectionSelect.innerHTML = '';
    }

    fillEditSectionFields(sections[0]);
    openModal('editModal');
}

function closeEditModal() {
    editingCompany = null;
    closeModal('editModal');
}

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editingCompany) return;
    const id = document.getElementById('editId').value;

    const sector = document.getElementById('editSector').value;
    const rawTags = document.getElementById('editTags').value;
    const tagsArray = rawTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const combinedTags = [...new Set([sector, ...tagsArray, ...editPositionPicker.get()])];

    const isNoDeadline = editNoDeadlineEl.checked;
    const tStart = document.getElementById('editTimeStart').value;
    const tEnd = isNoDeadline ? '' : editTimeEndEl.value;
    const timeText = editTimeTextEl.value.trim();
    const time = isNoDeadline
        ? 'ไม่มีกำหนดปิดรับสมัคร'
        : ((tStart && tEnd) ? `${tStart} ถึง ${tEnd}` : (tEnd ? `ถึง ${tEnd}` : (timeText || '-')));

    const updatedSectionData = {
        sourceLabel: document.getElementById('editSourceLabel').value.trim(),
        loc: document.getElementById('editLoc').value.trim(),
        desc: document.getElementById('editDesc').value.trim(),
        pay: document.getElementById('editPay').value.trim(),
        pos: document.getElementById('editPos').value.trim(),
        time,
        timeStart: tStart,
        timeEnd: tEnd,
        contact: document.getElementById('editContact').value.trim(),
        tags: combinedTags,
        stations: editStationPicker.get()
    };

    const currentSections = (Array.isArray(editingCompany.sections) && editingCompany.sections.length > 0)
        ? [...editingCompany.sections]
        : [{ ...editingCompany }];
    currentSections[editingSectionIndex] = {
        ...currentSections[editingSectionIndex],
        ...updatedSectionData
    };

    const allTags = [...new Set([sector, ...currentSections.flatMap(s => s.tags || [])])];
    const allStations = [...new Set(currentSections.flatMap(s => s.stations || []))];
    const primarySec = currentSections[0];

    const payload = {
        status: document.getElementById('editStatus').value,
        name: document.getElementById('editName').value.trim(),
        sector,
        sourceLabel: primarySec.sourceLabel || '',
        loc: primarySec.loc || '',
        desc: primarySec.desc || '',
        pay: primarySec.pay || '',
        pos: primarySec.pos || '',
        time: primarySec.time || '-',
        timeStart: primarySec.timeStart || '',
        timeEnd: primarySec.timeEnd || '',
        contact: primarySec.contact || '',
        tags: allTags,
        stations: allStations,
        sections: currentSections
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
initAdmin();