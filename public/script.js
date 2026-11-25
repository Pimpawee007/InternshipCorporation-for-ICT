// script.js — หน้าแรก (ค้นหา กรอง เปรียบเทียบ ดูรายละเอียด แจ้งข้อมูลผิด และเขียนรีวิว)
// ต้องโหลด transit-data.js, tag-data.js และ common.js ก่อนไฟล์นี้

let allCompanies = [];
let filteredCompanies = [];
let activeCompany = null;
let savedIds = getSaved();
let compareIds = readList(COMPARE_KEY);

const filterState = {
    sector: [],
    status: [],
    position: [],
    workmode: [],
    transit: [],
    other: []
};

let savedOnly = false;
let currentSort = 'newest';

// ---------------------------------------------------------------------------
// Init Pickers & UI Components
// ---------------------------------------------------------------------------
document.getElementById('filterWorkmode').innerHTML = chipsHTML(WORKMODE_TAGS, { group: 'workmode' });
document.getElementById('rvWorkmode').innerHTML = chipsHTML(WORKMODE_TAGS, { name: 'rvWorkmode', type: 'radio' });

const filterPositionPicker = createPositionPicker(document.getElementById('filterPositions'), {
    allowWholeCategory: true
});
const filterStationPicker = createStationPicker(document.getElementById('filterTransit'), {
    allowWholeLine: true
});

// เติมปี พ.ศ. ในฟอร์มรีวิว
(function populateReviewYears() {
    const sel = document.getElementById('rvYear');
    if (!sel) return;
    const currentBE = new Date().getFullYear() + 543;
    let html = '<option value="">ไม่ระบุปี</option>';
    for (let y = currentBE; y >= currentBE - 5; y--) {
        html += `<option value="${y}">${y}</option>`;
    }
    sel.innerHTML = html;
})();

// สร้างการ์ดหมวดตำแหน่งยอดนิยมหน้าแรก
function renderCategoryTiles() {
    const grid = document.getElementById('categoryTiles');
    if (!grid) return;
    grid.innerHTML = POSITION_CATEGORIES.map(cat => {
        const count = allCompanies.filter(c =>
            (c.tags || []).some(t => CATEGORY_OF_POSITION[t] === cat)
        ).length;
        const ic = CATEGORY_ICON[cat.id] || 'briefcase';
        return `
            <button type="button" class="cat-tile" data-cat="${escapeHTML(cat.id)}" style="--cat:${cat.color}">
                <span class="cat-icon">${icon(ic)}</span>
                <span class="cat-name">${escapeHTML(cat.name)}</span>
                <span class="cat-count">${count} บริษัท</span>
            </button>`;
    }).join('');
}

document.getElementById('categoryTiles')?.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-cat]');
    if (!tile) return;
    const val = 'cat:' + tile.dataset.cat;
    filterState.position = [val];
    filterPositionPicker.set([val]);
    syncFilterUI();
    applyFilters();
    document.getElementById('find').scrollIntoView({ behavior: 'smooth' });
});

// ---------------------------------------------------------------------------
// Load Data
// ---------------------------------------------------------------------------
async function loadCompanies() {
    try {
        const res = await fetch(`${API_URL}/companies`);
        if (!res.ok) throw new Error('fetch failed');
        const list = await res.json();
        allCompanies = (Array.isArray(list) ? list : []).map(c => ({
            ...c,
            tags: displayTags(c)
        }));

        updateStats();
        renderCategoryTiles();
        applyFilters();
        loadPopularTags();

        // เปิดบริษัทอัตโนมัติถ้าเข้าผ่านลิงก์แชร์ ?company=...
        const paramId = new URLSearchParams(location.search).get('company');
        if (paramId) {
            const target = allCompanies.find(c => c.id === paramId);
            if (target) openCompanyModal(target.id);
        }
    } catch (err) {
        console.error(err);
        showNotice('โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าเว็บใหม่อีกครั้งนะ');
        ['sliderGov', 'sliderState', 'sliderPrivate'].forEach(id => {
            document.getElementById(id).innerHTML = '<p class="slider-empty-text">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</p>';
        });
    }
}

async function loadPopularTags() {
    const box = document.getElementById('quickChips');
    if (!box) return;
    try {
        const res = await fetch(`${API_URL}/stats/popular`);
        const items = res.ok ? await res.json() : [];
        const fallback = ['Frontend Developer', 'Backend Developer', 'Data Analyst', 'UX/UI Designer', 'Hybrid', 'มีค่าตอบแทน'];
        const tags = items.length ? items.map(x => x.tag) : fallback;
        box.innerHTML = tags.map(t =>
            `<button type="button" class="quick-chip" data-quick-tag="${escapeHTML(t)}">${escapeHTML(t)}</button>`
        ).join('');
        syncQuickChips();
    } catch { /* ignore */ }
}

function trackTags(tags) {
    if (!tags || !tags.length) return;
    fetch(`${API_URL}/stats/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
    }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Stats Row
// ---------------------------------------------------------------------------
function updateStats() {
    let open = 0, closing = 0, reviews = 0;
    allCompanies.forEach(c => {
        const st = deadlineStatus(c).key;
        if (st === 'open') open++;
        if (st === 'closing') closing++;
        reviews += Number(c.reviewCount) || 0;
    });
    document.getElementById('statTotal').textContent = allCompanies.length;
    document.getElementById('statOpen').textContent = open;
    document.getElementById('statClosing').textContent = closing;
    document.getElementById('statReviews').textContent = reviews;
}

document.querySelector('.stats-row')?.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-stat]');
    if (!tile) return;
    const mode = tile.dataset.stat;
    resetAllFilters(false);
    if (mode === 'open') filterState.status = ['open'];
    else if (mode === 'closing') filterState.status = ['closing'];
    else if (mode === 'reviews') {
        currentSort = 'rating';
        document.getElementById('sortSelect').value = 'rating';
    }
    syncFilterUI();
    applyFilters();
    document.getElementById('find').scrollIntoView({ behavior: 'smooth' });
});

// ---------------------------------------------------------------------------
// Filtering & Sorting
// ---------------------------------------------------------------------------
function companyMatchesQuery(c, q) {
    if (!q) return true;
    const sections = Array.isArray(c.sections) ? c.sections : [];
    const haystack = [
        c.name, c.loc, c.sector, c.desc, c.pos, c.pay,
        ...(c.tags || []),
        ...sections.flatMap(s => [s.sourceLabel, s.loc, s.desc, s.pos, s.pay, ...(s.tags || [])])
    ].filter(Boolean).join(' ').toLowerCase();
    return q.split(/\s+/).every(word => haystack.includes(word));
}

function applyFilters() {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();

    filteredCompanies = allCompanies.filter(c => {
        if (savedOnly && !savedIds.has(c.id)) return false;
        if (!companyMatchesQuery(c, q)) return false;

        if (filterState.sector.length && !filterState.sector.includes(c.sector)) return false;

        if (filterState.status.length) {
            const st = deadlineStatus(c).key;
            if (!filterState.status.includes(st)) return false;
        }

        if (filterState.position.length && !companyMatchesPositions(c, filterState.position)) return false;

        if (filterState.workmode.length) {
            const tags = c.tags || [];
            if (!filterState.workmode.some(w => tags.includes(w))) return false;
        }

        if (filterState.transit.length && !companyMatchesTransit(c, filterState.transit)) return false;

        if (filterState.other.length) {
            const tags = c.tags || [];
            if (!filterState.other.every(o => tags.includes(o))) return false;
        }

        return true;
    });

    sortCompanies(filteredCompanies);
    renderSliders();
    updateSavedBadge();
}

function sortCompanies(list) {
    if (currentSort === 'name') {
        list.sort((a, b) => String(a.name).localeCompare(String(b.name), 'th'));
    } else if (currentSort === 'rating') {
        list.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    } else if (currentSort === 'closing') {
        const rank = { closing: 0, open: 1, upcoming: 2, unknown: 3, closed: 4 };
        list.sort((a, b) => {
            const sa = deadlineStatus(a), sb = deadlineStatus(b);
            if (rank[sa.key] !== rank[sb.key]) return rank[sa.key] - rank[sb.key];
            if (sa.end && sb.end) return sa.end - sb.end;
            return 0;
        });
    } else {
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
}

// ---------------------------------------------------------------------------
// Render Sliders & Cards
// ---------------------------------------------------------------------------
function renderSliders() {
    const groups = [
        { id: 'sliderGov', sector: 'ภาครัฐ' },
        { id: 'sliderState', sector: 'รัฐวิสาหกิจ' },
        { id: 'sliderPrivate', sector: 'เอกชน' }
    ];

    groups.forEach(g => {
        const items = filteredCompanies.filter(c => c.sector === g.sector);
        const container = document.getElementById(g.id);
        const pill = document.querySelector(`[data-count-for="${g.id}"]`);
        if (pill) pill.textContent = items.length ? `${items.length} แห่ง` : '';

        if (items.length === 0) {
            container.innerHTML = `<p class="slider-empty-text">ไม่มีบริษัทในหมวด${g.sector}ที่ตรงกับเงื่อนไข</p>`;
        } else {
            container.innerHTML = items.map(companyCardHTML).join('');
        }
        updateSliderButtons(g.id);
    });

    const notice = document.getElementById('memoNotice');
    if (allCompanies.length > 0 && filteredCompanies.length === 0) {
        notice.classList.remove('hidden');
    } else {
        notice.classList.add('hidden');
    }
}

function showNotice(msg) {
    document.getElementById('memoNoticeText').textContent = msg;
    document.getElementById('memoNotice').classList.remove('hidden');
}

function companyCardHTML(c) {
    const id = escapeHTML(c.id);
    const isSaved = savedIds.has(c.id);
    const isCompared = compareIds.includes(c.id);
    const sectionCount = Array.isArray(c.sections) ? c.sections.length : 0;

    const stations = c.stations || [];
    const firstStation = stations[0] ? `
        <div class="station-line">
            <i style="--line:${lineColor(stations[0])}"></i>
            <span>${escapeHTML(stationLabel(stations[0]))}</span>
            ${stations.length > 1 ? `<span class="more">+${stations.length - 1}</span>` : ''}
        </div>` : '';

    const ratingHTML = c.reviewCount
        ? `<div class="card-rating">${starsHTML(c.ratingAvg)}<b>${c.ratingAvg}</b><span>(${c.reviewCount})</span></div>`
        : `<div class="card-rating empty">ยังไม่มีรีวิว</div>`;

    return `
        <article class="slider-card" data-company-id="${id}">
            <div class="card-top">
                ${logoHTML(c)}
                <div class="card-title">
                    <h4 class="company-name" title="${escapeHTML(c.name)}">${escapeHTML(c.name)}</h4>
                    <div class="location">${icon('pin')}<span class="${hasText(c.loc) ? '' : 'loc-missing'}">${escapeHTML(hasText(c.loc) ? c.loc : 'ยังไม่ระบุสถานที่')}</span></div>
                </div>
                <button type="button" class="btn-heart ${isSaved ? 'is-saved' : ''}" data-save-id="${id}" aria-label="${isSaved ? 'เอาออกจากที่บันทึกไว้' : 'บันทึกบริษัทนี้'}" aria-pressed="${isSaved}">
                    ${icon('heart')}
                </button>
            </div>

            <div class="card-pills">
                ${statusBadgeHTML(c)}
                ${hasPay(c.pay) ? `<span class="pay-badge">${icon('coins')}${escapeHTML(c.pay)}</span>` : ''}
                ${sectionCount > 1 ? `<span class="status-badge status-note">${sectionCount} รอบ/แหล่งข้อมูล</span>` : ''}
            </div>

            ${firstStation}
            ${hasText(c.desc) ? `<p class="card-desc">${escapeHTML(c.desc)}</p>` : ''}

            <div class="card-foot">
                ${ratingHTML}
                <div class="card-actions">
                    <button type="button" class="btn-readmore" onclick="openCompanyModal('${id}')">ดูรายละเอียด${icon('arrow-right')}</button>
                    <button type="button" class="btn-compare ${isCompared ? 'is-active' : ''}" data-compare-id="${id}" title="เปรียบเทียบ" aria-label="เพิ่มเข้าเปรียบเทียบ" aria-pressed="${isCompared}">
                        ${icon('compare')}
                    </button>
                </div>
            </div>
        </article>`;
}

// ---------------------------------------------------------------------------
// Slider Controls
// ---------------------------------------------------------------------------
function slidePrev(id) {
    const el = document.getElementById(id);
    el.scrollBy({ left: -300, behavior: 'smooth' });
}

function slideNext(id) {
    const el = document.getElementById(id);
    el.scrollBy({ left: 300, behavior: 'smooth' });
}

function updateSliderButtons(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const group = el.closest('.slider-group');
    const prev = group?.querySelector('.prev-btn');
    const next = group?.querySelector('.next-btn');
    if (prev) prev.disabled = el.scrollLeft <= 4;
    if (next) next.disabled = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
}

['sliderGov', 'sliderState', 'sliderPrivate'].forEach(id => {
    document.getElementById(id)?.addEventListener('scroll', () => updateSliderButtons(id), { passive: true });
});

// ---------------------------------------------------------------------------
// Search, Filter Modal & Quick Chips
// ---------------------------------------------------------------------------
document.getElementById('btnSearch').addEventListener('click', applyFilters);
document.getElementById('searchInput').addEventListener('input', applyFilters);
document.getElementById('sortSelect').addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFilters();
});

document.getElementById('btnSavedOnly').addEventListener('click', function () {
    savedOnly = !savedOnly;
    this.classList.toggle('is-active', savedOnly);
    this.setAttribute('aria-pressed', String(savedOnly));
    applyFilters();
});

function updateSavedBadge() {
    const n = savedIds.size;
    const badge = document.getElementById('savedCount');
    if (badge) badge.textContent = n || '';
    updateNavSavedBadge();
}

document.getElementById('btnOpenFilter').addEventListener('click', () => {
    syncFilterUI();
    openModal('filterModal');
});
document.getElementById('btnCancelFilter').addEventListener('click', () => closeModal('filterModal'));

document.getElementById('btnApplyFilter').addEventListener('click', () => {
    ['sector', 'status', 'workmode', 'other'].forEach(grp => {
        filterState[grp] = [...document.querySelectorAll(`#filterModal input[data-group="${grp}"]:checked`)].map(el => el.value);
    });
    filterState.position = filterPositionPicker.get();
    filterState.transit = filterStationPicker.get();

    const tracked = [
        ...filterState.position.filter(v => !v.startsWith('cat:')),
        ...filterState.workmode,
        ...filterState.other,
        ...filterState.transit.map(v => (LINE_BY_ID[v.split(':')[0]] || {}).name).filter(Boolean)
    ];
    trackTags(tracked);

    syncFilterUI();
    closeModal('filterModal');
    applyFilters();
});

document.getElementById('btnResetFilter').addEventListener('click', () => {
    resetAllFilters(true);
});

document.getElementById('btnClearSearch').addEventListener('click', () => {
    resetAllFilters(true);
    applyFilters();
});

function resetAllFilters(clearSearchInput = true) {
    if (clearSearchInput) document.getElementById('searchInput').value = '';
    savedOnly = false;
    const savedBtn = document.getElementById('btnSavedOnly');
    savedBtn.classList.remove('is-active');
    savedBtn.setAttribute('aria-pressed', 'false');

    Object.keys(filterState).forEach(k => { filterState[k] = []; });
    filterPositionPicker.set([]);
    filterStationPicker.set([]);
    syncFilterUI();
}

function syncFilterUI() {
    ['sector', 'status', 'workmode', 'other'].forEach(grp => {
        document.querySelectorAll(`#filterModal input[data-group="${grp}"]`).forEach(el => {
            el.checked = filterState[grp].includes(el.value);
        });
    });

    const totalActive = Object.values(filterState).reduce((acc, arr) => acc + arr.length, 0);
    const btn = document.getElementById('btnOpenFilter');
    const countEl = document.getElementById('filterCount');
    btn.classList.toggle('is-active', totalActive > 0);
    countEl.textContent = totalActive;
    countEl.classList.toggle('hidden', totalActive === 0);
    syncQuickChips();
}

// กดปุ่ม Tag ยอดนิยม
document.getElementById('quickChips')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quick-tag]');
    if (!btn) return;
    const tag = btn.dataset.quickTag;
    const grp = tagGroup(tag);

    let val = tag;
    if (grp === 'transit') {
        const line = lineByName(tag);
        if (line) val = `${line.id}:*`;
    }

    const exists = filterState[grp].includes(val);
    filterState[grp] = exists
        ? filterState[grp].filter(x => x !== val)
        : [...filterState[grp], val];

    if (!exists) trackTags([tag]);
    if (grp === 'position') filterPositionPicker.set(filterState.position);
    if (grp === 'transit') filterStationPicker.set(filterState.transit);

    syncFilterUI();
    applyFilters();
});

function syncQuickChips() {
    document.querySelectorAll('[data-quick-tag]').forEach(btn => {
        const tag = btn.dataset.quickTag;
        const grp = tagGroup(tag);
        let val = tag;
        if (grp === 'transit') {
            const line = lineByName(tag);
            if (line) val = `${line.id}:*`;
        }
        btn.classList.toggle('is-active', filterState[grp].includes(val));
    });
}

// ---------------------------------------------------------------------------
// Company Details Modal (รองรับทั้งบริษัททั่วไป และบริษัทที่รวมหลาย Section)
// ---------------------------------------------------------------------------
function renderSectionBlock(sec, index, total, sector) {
    const tags = displayTags(sec);
    const positions = tags.filter(t => POSITION_TAGS.includes(t));
    const otherTags = tags.filter(t => t !== sector && !TRANSIT_TAGS.includes(t) && !POSITION_TAGS.includes(t));
    const stations = Array.isArray(sec.stations) ? sec.stations : [];

    const contact = sec.contact || '';
    const isLink = contact.startsWith('http') || contact.startsWith('www.');
    const contactUrl = contact.startsWith('www.') ? 'http://' + contact : contact;

    const headerHTML = total > 1 ? `
        <div class="section-divider-head">
            <span class="section-index-badge">รอบ / ข้อมูลชุดที่ ${index + 1}</span>
            ${hasText(sec.sourceLabel) ? `<strong>${escapeHTML(sec.sourceLabel)}</strong>` : ''}
            ${statusBadgeHTML(sec)}
        </div>` : '';

    return `
        <div class="company-section-card ${total > 1 ? 'is-multi' : ''}">
            ${headerHTML}
            <div class="detail-row">
                <span class="detail-icon">${icon('file')}</span>
                <p><strong>คำอธิบาย</strong> <span class="break-text">${hasText(sec.desc) ? escapeHTML(sec.desc) : missingHTML('ยังไม่มีคำอธิบาย')}</span></p>
            </div>
            <div class="detail-row">
                <span class="detail-icon">${icon('pin')}</span>
                <p><strong>สถานที่ตั้ง</strong> <span class="break-text">${hasText(sec.loc) ? escapeHTML(sec.loc) : missingHTML('ยังไม่ระบุสถานที่')}</span></p>
            </div>
            ${stations.length ? `
            <div class="detail-row">
                <span class="detail-icon">${icon('train')}</span>
                <p><strong>รถไฟฟ้าใกล้ที่สุด</strong> <span class="station-pills">${stations.map(stationPillHTML).join('')}</span></p>
            </div>` : ''}
            <div class="detail-row">
                <span class="detail-icon pay">${icon('coins')}</span>
                <p><strong>ค่าตอบแทน</strong> <span class="highlight-pay break-text">${hasText(sec.pay) ? escapeHTML(sec.pay) : missingHTML('ยังไม่ระบุค่าตอบแทน')}</span></p>
            </div>
            <div class="detail-row">
                <span class="detail-icon">${icon('briefcase')}</span>
                <p>
                    <strong>ตำแหน่งงานที่เปิดรับ</strong>
                    ${positions.length ? `<span class="station-pills">${positions.map(positionPillHTML).join('')}</span>` : ''}
                    ${hasText(sec.pos) ? `<span class="break-text pos-extra">${escapeHTML(sec.pos)}</span>` : (!positions.length ? missingHTML('ยังไม่ระบุตำแหน่ง') : '')}
                </p>
            </div>
            <div class="detail-row">
                <span class="detail-icon">${icon('calendar')}</span>
                <p><strong>ระยะเวลาการรับสมัคร</strong> <span class="break-text">${hasText(sec.time) ? escapeHTML(sec.time) : missingHTML('ยังไม่ประกาศรอบรับสมัคร')}</span></p>
            </div>
            <div class="detail-row">
                <span class="detail-icon">${icon('phone')}</span>
                <p>
                    <strong>ช่องทางติดต่อ</strong>
                    ${isLink
                        ? `<a href="${escapeHTML(contactUrl)}" target="_blank" rel="noopener" class="break-text link-wrap">${escapeHTML(contact)}</a>`
                        : `<span class="break-text">${hasText(contact) ? escapeHTML(contact) : missingHTML('ยังไม่ระบุช่องทางติดต่อ')}</span>`
                    }
                </p>
            </div>
            ${otherTags.length ? `<div class="modal-tags">${otherTags.map(t => `<span class="mini-tag">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
        </div>
    `;
}

function openCompanyModal(id) {
    const c = allCompanies.find(x => x.id === id);
    if (!c) return;
    activeCompany = c;
    addRecent(c.id);

    document.getElementById('modalLogo').innerHTML = logoHTML(c, 'lg');
    const sectorEl = document.getElementById('modalSectorTag');
    sectorEl.textContent = c.sector || 'เอกชน';
    sectorEl.className = `sector-tag ${SECTOR_CLASS[c.sector] || ''}`;
    document.getElementById('modalStatus').innerHTML = statusBadgeHTML(c);
    document.getElementById('modalCompanyName').textContent = c.name;

    // ปุ่ม Action ด้านบน Modal
    syncModalActionButtons();

    const calBtn = document.getElementById('modalCalendarBtn');
    const calUrl = calendarURL(c);
    calBtn.classList.toggle('hidden', !calUrl);
    if (calUrl) calBtn.href = calUrl;

    // แสดงรายการ Section (ถ้ายังไม่มี array sections ให้ใช้ข้อมูลระดับบนเป็น 1 section)
    const sections = (Array.isArray(c.sections) && c.sections.length > 0) ? c.sections : [c];
    const detailsContainer = document.getElementById('modalDetailsContainer');
    const missing = missingFields(c);
    const missingBoxHTML = (sections.length === 1 && missing.length) ? `
        <div class="missing-box">
            <img src="assets/character/thinking.webp" alt="" width="420" height="560" loading="lazy">
            <div>
                <p class="missing-title">Memo ยังหาข้อมูลส่วนนี้ไม่เจอ</p>
                <p class="missing-list">${escapeHTML(missing.join(' · '))}</p>
                <p class="missing-sub">ข้อมูลอาจยังไม่ประกาศ หรือบริษัทยังไม่เปิดรับในตอนนี้ ลองติดต่อบริษัทโดยตรงนะ</p>
                <button type="button" class="action-chip" id="btnHelpInfo">${icon('plus')}<span>รู้ข้อมูล? ช่วยเพิ่มให้หน่อย</span></button>
            </div>
        </div>` : '';

    detailsContainer.innerHTML = sections
        .map((sec, idx) => renderSectionBlock(sec, idx, sections.length, c.sector))
        .join('') + missingBoxHTML;

    // รีเซ็ตฟอร์มรีวิวและฟอร์มแจ้งข้อมูลผิด
    document.getElementById('reviewForm').classList.add('hidden');
    document.getElementById('reportForm').classList.add('hidden');

    // เติมตัวเลือก Section ในฟอร์มแจ้งข้อมูลผิด (แสดงเมื่อมีมากกว่า 1 Section, เป็นแบบไม่บังคับ)
    const repSecGroup = document.getElementById('reportSectionGroup');
    const repSecSelect = document.getElementById('reportSectionSelect');
    if (repSecGroup && repSecSelect) {
        if (sections.length > 1) {
            repSecGroup.classList.remove('hidden');
            repSecSelect.innerHTML = `<option value="">-- ไม่ระบุ / ข้อมูลภาพรวมบริษัท --</option>` +
                sections.map((s, idx) => {
                    const label = `Section ${idx + 1}: ${s.sourceLabel || s.pos || s.loc || 'ข้อมูลชุดที่ ' + (idx + 1)}`;
                    return `<option value="${escapeHTML(label)}">${escapeHTML(label)}</option>`;
                }).join('');
        } else {
            repSecGroup.classList.add('hidden');
            repSecSelect.innerHTML = '';
        }
    }

    openModal('companyModal');
    loadCompanyReviews(c.id);
}

function syncModalActionButtons() {
    if (!activeCompany) return;
    const saved = savedIds.has(activeCompany.id);
    const compared = compareIds.includes(activeCompany.id);

    const saveBtn = document.getElementById('modalSaveBtn');
    saveBtn.classList.toggle('is-saved', saved);
    saveBtn.setAttribute('aria-pressed', String(saved));
    saveBtn.querySelector('span').textContent = saved ? 'บันทึกแล้ว' : 'บันทึกไว้ดูทีหลัง';

    const compBtn = document.getElementById('modalCompareBtn');
    compBtn.classList.toggle('is-active', compared);
    compBtn.setAttribute('aria-pressed', String(compared));
    compBtn.querySelector('span').textContent = compared ? 'อยู่ในรายการเทียบ' : 'เปรียบเทียบ';
}

document.getElementById('modalSaveBtn').addEventListener('click', () => {
    if (activeCompany) toggleSaveCompany(activeCompany.id);
});

document.getElementById('modalCompareBtn').addEventListener('click', () => {
    if (activeCompany) toggleCompareCompany(activeCompany.id);
});

document.getElementById('modalShareBtn').addEventListener('click', async () => {
    if (!activeCompany) return;
    const url = companyLink(activeCompany.id);
    if (navigator.share) {
        try {
            await navigator.share({ title: activeCompany.name, text: `ข้อมูลฝึกงาน ${activeCompany.name}`, url });
            return;
        } catch { /* fallback to clipboard */ }
    }
    try {
        await navigator.clipboard.writeText(url);
        showToast('คัดลอกลิงก์บริษัทแล้ว!', 'happy');
    } catch {
        showToast('คัดลอกลิงก์ไม่สำเร็จ', 'error');
    }
});

// กดปุ่ม "รู้ข้อมูล? ช่วยเพิ่มให้หน่อย" ในกล่องข้อมูลขาด
document.getElementById('modalDetailsContainer').addEventListener('click', (e) => {
    if (e.target.closest('#btnHelpInfo')) {
        const repForm = document.getElementById('reportForm');
        repForm.classList.remove('hidden');
        repForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('reportText').focus();
    }
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
async function loadCompanyReviews(companyId) {
    const listEl = document.getElementById('reviewList');
    const sumEl = document.getElementById('reviewSummary');
    listEl.innerHTML = '<p class="review-loading">กำลังโหลดรีวิว...</p>';
    sumEl.innerHTML = '';

    try {
        const res = await fetch(`${API_URL}/companies/${encodeURIComponent(companyId)}/reviews`);
        const reviews = res.ok ? await res.json() : [];

        if (!reviews.length) {
            listEl.innerHTML = `
                <div class="memo-state compact review-empty">
                    <img src="assets/character/sleepy.webp" alt="" width="200" height="220">
                    <p>ยังไม่มีรีวิวเลย เคยฝึกที่นี่ไหม? มาเขียนคนแรกให้รุ่นน้องหน่อย!</p>
                </div>`;
            return;
        }

        const avg = Math.round((reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length) * 10) / 10;
        sumEl.innerHTML = `${starsHTML(avg)}<b>${avg}</b><span>(${reviews.length} รีวิว)</span>`;
        listEl.innerHTML = reviews.map(reviewItemHTML).join('');
    } catch {
        listEl.innerHTML = '<p class="review-loading">โหลดรีวิวไม่สำเร็จ</p>';
    }
}

function reviewItemHTML(r) {
    const meta = [r.year ? `ฝึกปี ${r.year}` : '', r.role, r.workMode, r.pay ? `ได้ ${r.pay}` : '']
        .filter(Boolean).map(escapeHTML).join(' · ');
    const dateStr = r.createdAt ? formatThaiDate(new Date(r.createdAt), true) : '';

    const facts = [
        r.difficulty ? DIFFICULTY_LABEL[r.difficulty] : '',
        r.hasTest === 'yes' ? 'มีข้อสอบ' : r.hasTest === 'no' ? 'ไม่มีข้อสอบ' : '',
        r.needPortfolio === 'yes' ? 'ใช้ portfolio' : r.needPortfolio === 'no' ? 'ไม่ต้องใช้ portfolio' : ''
    ].filter(Boolean);

    const interviewHTML = (facts.length || r.interviewQuestions) ? `
        <div class="review-interview">
            <p class="ri-title">${icon('mic')}ประสบการณ์สัมภาษณ์</p>
            ${facts.length ? `<div class="ri-facts">${facts.map(f => `<span class="mini-tag">${escapeHTML(f)}</span>`).join('')}</div>` : ''}
            ${r.interviewQuestions ? `<p class="review-text">${escapeHTML(r.interviewQuestions)}</p>` : ''}
        </div>` : '';

    return `
        <article class="review-item">
            <div class="review-top">
                ${starsHTML(r.rating)}
                <span class="review-rec ${r.recommend ? 'yes' : 'no'}">${icon('thumb')}${r.recommend ? 'แนะนำ' : 'ไม่แนะนำ'}</span>
                <span class="review-date">${escapeHTML(dateStr)}</span>
            </div>
            ${meta ? `<p class="review-meta">${meta}</p>` : ''}
            <p class="review-text">${escapeHTML(r.text)}</p>
            ${interviewHTML}
        </article>`;
}

document.getElementById('btnWriteReview').addEventListener('click', () => {
    const form = document.getElementById('reviewForm');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

document.getElementById('btnCancelReview').addEventListener('click', () => {
    document.getElementById('reviewForm').classList.add('hidden');
});

document.getElementById('reviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeCompany) return;

    const rating = document.querySelector('input[name="rvRating"]:checked')?.value;
    const text = document.getElementById('rvText').value.trim();
    if (!rating) return showToast('กดเลือกดาวให้คะแนนก่อนนะ', 'error');
    if (text.length < 10) return showToast('เล่าประสบการณ์อย่างน้อย 10 ตัวอักษรนะ', 'error');

    const btn = document.getElementById('btnSubmitReview');
    btn.disabled = true;

    const payload = {
        rating: Number(rating),
        year: document.getElementById('rvYear').value,
        role: document.getElementById('rvRole').value.trim(),
        pay: document.getElementById('rvPay').value.trim(),
        workMode: document.querySelector('input[name="rvWorkmode"]:checked')?.value || '',
        recommend: document.querySelector('input[name="rvRecommend"]:checked')?.value === 'yes',
        difficulty: document.querySelector('input[name="rvDifficulty"]:checked')?.value || '',
        hasTest: document.querySelector('input[name="rvTest"]:checked')?.value || '',
        needPortfolio: document.querySelector('input[name="rvPortfolio"]:checked')?.value || '',
        interviewQuestions: document.getElementById('rvInterview').value.trim(),
        text
    };

    try {
        const res = await fetch(`${API_URL}/companies/${encodeURIComponent(activeCompany.id)}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            e.target.reset();
            e.target.classList.add('hidden');
            showToast('ส่งรีวิวแล้ว! จะแสดงหลังแอดมินตรวจสอบ', 'happy');
        } else {
            showToast(data.message || 'ส่งรีวิวไม่สำเร็จ', 'error');
        }
    } catch {
        showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ---------------------------------------------------------------------------
// Report Incorrect Info (รองรับการระบุ Section แบบไม่บังคับ)
// ---------------------------------------------------------------------------
document.getElementById('btnReport').addEventListener('click', () => {
    const form = document.getElementById('reportForm');
    form.classList.toggle('hidden');
    if (!form.classList.contains('hidden')) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

document.getElementById('btnCancelReport').addEventListener('click', () => {
    document.getElementById('reportForm').classList.add('hidden');
});

document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeCompany) return;
    const message = document.getElementById('reportText').value.trim();
    if (message.length < 5) return showToast('ช่วยพิมพ์รายละเอียดเพิ่มอีกนิดนะ', 'error');

    const sectionLabel = document.getElementById('reportSectionSelect')?.value || '';

    const btn = document.getElementById('btnSubmitReport');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/companies/${encodeURIComponent(activeCompany.id)}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, sectionLabel })
        });
        const data = await res.json();
        if (data.success) {
            e.target.reset();
            e.target.classList.add('hidden');
            showToast('ส่งแจ้งแอดมินเรียบร้อย ขอบคุณนะ!', 'happy');
        } else {
            showToast(data.message || 'ส่งไม่สำเร็จ', 'error');
        }
    } catch {
        showToast('เชื่อมต่อ Server ไม่ได้', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ---------------------------------------------------------------------------
// Save (Heart) & Compare
// ---------------------------------------------------------------------------
function toggleSaveCompany(id) {
    if (savedIds.has(id)) {
        savedIds.delete(id);
        showToast('เอาออกจากที่บันทึกไว้แล้ว');
    } else {
        savedIds.add(id);
        showToast('บันทึกไว้ดูทีหลังแล้ว!', 'happy');
    }
    setSaved(savedIds);
    updateSavedBadge();
    syncModalActionButtons();
    if (savedOnly) applyFilters();
    else renderSliders();
}

function toggleCompareCompany(id) {
    if (compareIds.includes(id)) {
        compareIds = compareIds.filter(x => x !== id);
    } else {
        if (compareIds.length >= 3) return showToast('เปรียบเทียบได้สูงสุด 3 บริษัทนะ', 'error');
        compareIds = [...compareIds, id];
    }
    writeList(COMPARE_KEY, compareIds);
    updateCompareBar();
    syncModalActionButtons();
    renderSliders();
}

function updateCompareBar() {
    const bar = document.getElementById('compareBar');
    const items = compareIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean);
    compareIds = items.map(c => c.id);
    writeList(COMPARE_KEY, compareIds);

    bar.classList.toggle('hidden', items.length === 0);
    document.body.classList.toggle('has-compare', items.length > 0);
    if (!items.length) return;

    document.getElementById('compareLogos').innerHTML = items.map(c => logoHTML(c, 'sm')).join('');
    document.getElementById('compareCount').textContent = `เลือก ${items.length}/3`;
    document.getElementById('btnCompareOpen').disabled = items.length < 2;
}

document.getElementById('btnCompareClear').addEventListener('click', () => {
    compareIds = [];
    writeList(COMPARE_KEY, []);
    updateCompareBar();
    syncModalActionButtons();
    renderSliders();
});

document.getElementById('btnCompareOpen').addEventListener('click', () => {
    const items = compareIds.map(id => allCompanies.find(c => c.id === id)).filter(Boolean);
    if (items.length < 2) return;

    const table = document.getElementById('compareTable');
    table.style.setProperty('--cols', items.length);

    const rows = [
        ['ประเภท', c => `<span class="sector-tag ${SECTOR_CLASS[c.sector] || ''}">${escapeHTML(c.sector)}</span>`],
        ['สถานะ', c => statusBadgeHTML(c)],
        ['ค่าตอบแทน', c => hasPay(c.pay) ? `<span class="highlight-pay">${escapeHTML(c.pay)}</span>` : '<span class="cg-empty">-</span>'],
        ['สถานที่ตั้ง', c => escapeHTML(c.loc || '-')],
        ['รถไฟฟ้า', c => (c.stations || []).length ? c.stations.map(stationPillHTML).join('') : '<span class="cg-empty">-</span>'],
        ['ตำแหน่ง', c => {
            const pos = (c.tags || []).filter(t => POSITION_TAGS.includes(t)).map(positionPillHTML).join('');
            const extra = hasText(c.pos) ? `<span class="cg-pos-extra">${escapeHTML(c.pos)}</span>` : '';
            return (pos || extra) ? pos + extra : '<span class="cg-empty">-</span>';
        }],
        ['รีวิว', c => c.reviewCount ? `${starsHTML(c.ratingAvg)} <b>${c.ratingAvg}</b> (${c.reviewCount})` : '<span class="cg-empty">ยังไม่มี</span>'],
        ['', c => `<button type="button" class="btn-readmore" onclick="closeModal('compareModal');openCompanyModal('${escapeHTML(c.id)}')">ดูรายละเอียด</button>`]
    ];

    let html = '<div class="cg-label">บริษัท</div>' + items.map(c => `
        <div class="cg-cell cg-head">
            <button type="button" class="cg-remove" data-remove-compare="${escapeHTML(c.id)}" aria-label="เอาออก">${icon('x')}</button>
            ${logoHTML(c)}
            <strong class="cg-name">${escapeHTML(c.name)}</strong>
        </div>`).join('');

    rows.forEach(([label, renderCell]) => {
        html += `<div class="cg-label">${label}</div>` + items.map(c => `<div class="cg-cell">${renderCell(c)}</div>`).join('');
    });

    table.innerHTML = html;
    openModal('compareModal');
});

document.getElementById('compareTable').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove-compare]');
    if (!rm) return;
    toggleCompareCompany(rm.dataset.removeCompare);
    if (compareIds.length < 2) closeModal('compareModal');
    else document.getElementById('btnCompareOpen').click();
});

// Delegated clicks บนการ์ดบริษัท (กดหัวใจ / กดเปรียบเทียบ)
document.getElementById('find').addEventListener('click', (e) => {
    const saveBtn = e.target.closest('[data-save-id]');
    if (saveBtn) return toggleSaveCompany(saveBtn.dataset.saveId);

    const compBtn = e.target.closest('[data-compare-id]');
    if (compBtn) return toggleCompareCompany(compBtn.dataset.compareId);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
loadCompanies().then(() => updateCompareBar());