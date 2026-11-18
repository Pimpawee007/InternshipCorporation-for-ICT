// script.js — หน้าแรก (ค้นหา / กรอง / รายละเอียด / รีวิว)
// ต้องโหลด common.js ก่อนไฟล์นี้

let companyData = [];
let currentCompanyId = null;
let savedSet = getSaved();
let compareSet = new Set(readList(COMPARE_KEY).slice(0, 3));  // เลือกได้สูงสุด 3 บริษัท (จำไว้ในเบราว์เซอร์)
let popularTags = [];            // จาก /api/stats/popular
const MAX_COMPARE = 3;

const view = {
    query: '',
    filters: {},          // { sector: [...], status: [...], position: [...], workmode: [...], other: [...] }
    sort: 'newest',
    savedOnly: false
};

const SLIDERS = { 'ภาครัฐ': 'sliderGov', 'รัฐวิสาหกิจ': 'sliderState', 'เอกชน': 'sliderPrivate' };
const SLIDER_IDS = Object.values(SLIDERS);

// ---------------------------------------------------------------------------
// โหลดข้อมูล
// ---------------------------------------------------------------------------
async function fetchCompanies() {
    try {
        const response = await fetch(`${API_URL}/companies`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        companyData = (await response.json()).map(c => ({ ...c, tags: displayTags(c) }));
        applyView();
        updateStats();
        renderCategoryTiles();
        loadPopular();
        openFromUrl();
    } catch (error) {
        console.error("Error fetching data:", error);
        SLIDER_IDS.forEach(id => {
            document.getElementById(id).innerHTML = '<p class="slider-empty-text">ไม่สามารถโหลดข้อมูลได้</p>';
        });
        showNotice('อ๊ะ Memo โหลดข้อมูลไม่ได้ ลองรีเฟรชหน้าอีกครั้งนะ', false);
    }
}

// เปิดรายละเอียดบริษัทจากลิงก์ เช่น index.html?company=c123
function openFromUrl() {
    const params = new URLSearchParams(location.search);
    const id = params.get('company');
    if (id && companyData.some(c => c.id === id)) return openDetailsModal(id);
    if (params.has('compare') && compareSet.size >= 2) openCompare();
}

// ---------------------------------------------------------------------------
// ค้นหา + กรอง + เรียง
// ---------------------------------------------------------------------------
function matchesQuery(c, q) {
    if (!q) return true;
    const hay = [c.name, c.pos, c.loc, c.desc, ...(c.tags || []), ...(c.stations || []).map(stationLabel)].join(' ').toLowerCase();
    return q.split(/\s+/).every(word => hay.includes(word));
}

function matchesFilters(c) {
    const tags = c.tags || [];
    const f = view.filters;
    if (f.sector?.length && !f.sector.includes(c.sector)) return false;
    if (f.status?.length && !f.status.includes(deadlineStatus(c).key)) return false;
    if (f.position?.length && !companyMatchesPositions(c, f.position)) return false;
    if (f.workmode?.length && !f.workmode.some(t => tags.includes(t))) return false;
    if (f.transit?.length && !companyMatchesTransit(c, f.transit)) return false;
    if (f.other?.length && !f.other.some(t => tags.includes(t))) return false;
    return true;
}

function createdTime(c) {
    if (c.createdAt) return new Date(c.createdAt).getTime();
    const m = String(c.id || '').match(/^c(\d{12,})$/);
    return m ? Number(m[1]) : 0;
}

function sortCompanies(list) {
    const arr = [...list];
    if (view.sort === 'newest') {
        arr.sort((a, b) => createdTime(b) - createdTime(a));
    } else if (view.sort === 'closing') {
        const rank = { closing: 0, open: 1, upcoming: 2, unknown: 3, closed: 4 };
        arr.sort((a, b) => {
            const sa = deadlineStatus(a), sb = deadlineStatus(b);
            if (rank[sa.key] !== rank[sb.key]) return rank[sa.key] - rank[sb.key];
            return (sa.end || Infinity) - (sb.end || Infinity);
        });
    } else if (view.sort === 'rating') {
        arr.sort((a, b) => (b.ratingAvg || 0) - (a.ratingAvg || 0) || (b.reviewCount || 0) - (a.reviewCount || 0));
    } else if (view.sort === 'name') {
        arr.sort((a, b) => String(a.name).localeCompare(String(b.name), 'th'));
    }
    return arr;
}

function applyView() {
    const q = view.query.trim().toLowerCase();
    let list = companyData.filter(c => matchesQuery(c, q) && matchesFilters(c));
    if (view.savedOnly) list = list.filter(c => savedSet.has(c.id));
    renderCards(sortCompanies(list));
    updateSavedCount();
    updateCompareUI();
    renderQuickChips();
}

// ---------------------------------------------------------------------------
// การ์ดบริษัท
// ---------------------------------------------------------------------------
function cardHTML(company) {
    const id = escapeHTML(company.id);
    const sectorCls = SECTOR_CLASS[company.sector] || '';
    const isSaved = savedSet.has(company.id);
    const payHtml = hasPay(company.pay)
        ? `<span class="pay-badge" title="${escapeHTML(company.pay)}">${icon('coins')}${escapeHTML(company.pay)}</span>`
        : '';
    const descHtml = company.desc ? `<p class="card-desc">${escapeHTML(company.desc)}</p>` : '';
    const ratingHtml = company.reviewCount
        ? `<span class="card-rating">${starsHTML(company.ratingAvg)}<b>${company.ratingAvg}</b><span>(${company.reviewCount} รีวิว)</span></span>`
        : `<span class="card-rating empty">ยังไม่มีรีวิว</span>`;

    return `
        <article class="slider-card" data-tags="${escapeHTML((company.tags || []).join(','))}">
            <div class="card-top">
                ${logoHTML(company)}
                <div class="card-title">
                    <h4 class="company-name">${escapeHTML(company.name)}</h4>
                    <p class="location">${icon('pin')}${hasText(company.loc) ? `<span>${escapeHTML(company.loc)}</span>` : '<span class="loc-missing">ยังไม่ระบุที่อยู่</span>'}</p>
                    ${stationLineHTML(company)}
                </div>
                <button type="button" class="btn-heart ${isSaved ? 'is-saved' : ''}" data-save="${id}" aria-pressed="${isSaved}" aria-label="บันทึก ${escapeHTML(company.name)}">${icon('heart')}</button>
            </div>
            <div class="card-pills">
                <span class="sector-tag ${sectorCls}">${escapeHTML(company.sector)}</span>
                ${statusBadgeHTML(company)}
                ${payHtml}
            </div>
            ${descHtml}
            <div class="card-foot">
                ${ratingHtml}
                <div class="card-actions">
                    <button class="btn-readmore" onclick="openDetailsModal('${id}')">ดูรายละเอียด${icon('arrow-right')}</button>
                    <button type="button" class="btn-compare" data-compare="${id}" aria-pressed="false" title="เพิ่มเข้าเปรียบเทียบ" aria-label="เปรียบเทียบ ${escapeHTML(company.name)}">${icon('compare')}</button>
                </div>
            </div>
        </article>`;
}

function stationLineHTML(company) {
    const st = company.stations || [];
    if (!st.length) return '';
    const more = st.length > 1 ? ` <span class="more">+${st.length - 1}</span>` : '';
    return `<p class="station-line" style="--line:${lineColor(st[0])}"><i></i><span>${escapeHTML(stationLabel(st[0]))}${more}</span></p>`;
}

function emptySliderHTML() {
    const text = view.savedOnly ? 'ยังไม่ได้บันทึกบริษัทในหมวดนี้' : 'หมวดนี้ยังว่างอยู่ Memo ขอนอนรอก่อนนะ zzz';
    return `
        <div class="memo-state compact">
            <img src="${MEMO}sleepy.webp" alt="Memo กำลังง่วงนอน" width="511" height="560">
            <p>${text}</p>
        </div>`;
}

function renderCards(companies) {
    const html = {}, count = {};
    SLIDER_IDS.forEach(id => { html[id] = ''; count[id] = 0; });

    companies.forEach(company => {
        const sliderId = SLIDERS[company.sector];
        if (!sliderId) return;
        html[sliderId] += cardHTML(company);
        count[sliderId]++;
    });

    SLIDER_IDS.forEach(id => {
        const el = document.getElementById(id);
        el.innerHTML = html[id] || emptySliderHTML();
        el.scrollLeft = 0;
        const pill = document.querySelector(`[data-count-for="${id}"]`);
        if (pill) pill.textContent = `${count[id]} แห่ง`;
    });
    updateSliderArrows();

    // ค้นหา/กรองแล้วไม่เจออะไรเลย → ให้ Memo บอก
    const total = SLIDER_IDS.reduce((sum, id) => sum + count[id], 0);
    if (total === 0 && companyData.length > 0) {
        showNotice(view.savedOnly && !view.query && !activeFilterCount()
            ? 'ยังไม่ได้บันทึกบริษัทไว้เลย กดรูปหัวใจที่การ์ดเพื่อเก็บไว้ดูทีหลังนะ'
            : 'อ๊ะ Memo หาไม่เจอเลย ลองเปลี่ยนคำค้นหรือตัวกรองดูนะ', true);
    } else {
        hideNotice();
    }
}

function showNotice(text, showClear) {
    document.getElementById('memoNoticeText').textContent = text;
    document.getElementById('btnClearSearch').classList.toggle('hidden', !showClear);
    document.getElementById('memoNotice').classList.remove('hidden');
    document.querySelectorAll('.slider-group').forEach(g => g.classList.add('hidden'));
}

function hideNotice() {
    document.getElementById('memoNotice').classList.add('hidden');
    document.querySelectorAll('.slider-group').forEach(g => g.classList.remove('hidden'));
}

document.getElementById('btnClearSearch').addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('#filterModal input:checked').forEach(cb => cb.checked = false);
    view.query = '';
    view.filters = {};
    setSavedOnly(false);
    updateFilterCount();
    applyView();
});

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------
const scrollAmount = 300;
function slideNext(containerId) {
    document.getElementById(containerId).scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

function slidePrev(containerId) {
    document.getElementById(containerId).scrollBy({ left: -scrollAmount, behavior: 'smooth' });
}

// ปิดปุ่มลูกศรเมื่อเลื่อนสุดแล้ว / ไม่มีอะไรให้เลื่อน
function updateSliderArrows() {
    SLIDER_IDS.forEach(id => {
        const el = document.getElementById(id);
        const prev = document.querySelector(`.prev-btn[onclick*="'${id}'"]`);
        const next = document.querySelector(`.next-btn[onclick*="'${id}'"]`);
        if (!el || !prev || !next) return;
        const max = el.scrollWidth - el.clientWidth;
        prev.disabled = el.scrollLeft <= 2;
        next.disabled = el.scrollLeft >= max - 2;
    });
}
SLIDER_IDS.forEach(id => document.getElementById(id).addEventListener('scroll', updateSliderArrows, { passive: true }));
window.addEventListener('resize', updateSliderArrows);

// Hamburger Menu Toggle (ซ่อนไว้ แต่ยังทำงานได้)
document.getElementById('hamburgerMenu').addEventListener('click', function() {
    document.getElementById('navLinks').classList.toggle('active');
});

// ---------------------------------------------------------------------------
// บันทึกบริษัท (หัวใจ)
// ---------------------------------------------------------------------------
function toggleSaved(id) {
    if (savedSet.has(id)) savedSet.delete(id); else savedSet.add(id);
    setSaved(savedSet);
    const on = savedSet.has(id);
    document.querySelectorAll(`[data-save="${CSS.escape(id)}"]`).forEach(btn => {
        btn.classList.toggle('is-saved', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    if (currentCompanyId === id) updateModalSaveBtn();
    updateSavedCount();
    updateNavSavedBadge();
    showToast(on ? 'Memo เก็บไว้ให้แล้ว ดูได้ที่ปุ่ม "ที่บันทึกไว้"' : 'เอาออกจากที่บันทึกไว้แล้ว', 'happy');
    if (view.savedOnly && !on) applyView();
}

document.getElementById('find').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (btn) return toggleSaved(btn.dataset.save);
    const cmp = e.target.closest('[data-compare]');
    if (cmp) return toggleCompare(cmp.dataset.compare);
    const chip = e.target.closest('[data-quick]');
    if (chip) return toggleQuickTag(chip.dataset.quick);
});

function updateSavedCount() {
    const n = companyData.filter(c => savedSet.has(c.id)).length;
    document.getElementById('savedCount').textContent = n ? n : '';
}

function setSavedOnly(on) {
    view.savedOnly = on;
    const btn = document.getElementById('btnSavedOnly');
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
}

document.getElementById('btnSavedOnly').addEventListener('click', () => {
    setSavedOnly(!view.savedOnly);
    applyView();
});

document.getElementById('sortSelect').addEventListener('change', (e) => {
    view.sort = e.target.value;
    applyView();
});

// ---------------------------------------------------------------------------
// ค้นหา
// ---------------------------------------------------------------------------
document.getElementById('btnSearch').addEventListener('click', () => {
    view.query = document.getElementById('searchInput').value;
    applyView();
});

let searchTimer;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { view.query = e.target.value; applyView(); }, 250);
});

document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnSearch').click();
});

// ---------------------------------------------------------------------------
// ตัวกรอง
// ---------------------------------------------------------------------------
const filterPositionPicker = createPositionPicker(document.getElementById('filterPositions'), { allowWholeCategory: true });
document.getElementById('filterWorkmode').innerHTML = chipsHTML(WORKMODE_TAGS, { group: 'workmode' });
const filterStationPicker = createStationPicker(document.getElementById('filterTransit'), { allowWholeLine: true });

function readFilters() {
    const filters = {};
    document.querySelectorAll('#filterModal input[data-group]:checked').forEach(cb => {
        (filters[cb.dataset.group] = filters[cb.dataset.group] || []).push(cb.value);
    });
    const stations = filterStationPicker.get();
    if (stations.length) filters.transit = stations;
    const positions = filterPositionPicker.get();
    if (positions.length) filters.position = positions;
    return filters;
}

function syncFilterInputs() {
    document.querySelectorAll('#filterModal input[data-group]').forEach(cb => {
        cb.checked = (view.filters[cb.dataset.group] || []).includes(cb.value);
    });
    filterStationPicker.set(view.filters.transit || []);
    filterPositionPicker.set(view.filters.position || []);
}

function activeFilterCount() {
    return Object.values(view.filters).reduce((n, arr) => n + arr.length, 0);
}

function updateFilterCount() {
    const n = activeFilterCount();
    const badge = document.getElementById('filterCount');
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
    document.getElementById('btnOpenFilter').classList.toggle('is-active', n > 0);
    renderQuickChips();
}

document.getElementById('btnOpenFilter').addEventListener('click', () => {
    syncFilterInputs();
    openModal('filterModal');
});
document.getElementById('btnCancelFilter').addEventListener('click', () => closeModal('filterModal'));
document.getElementById('btnResetFilter').addEventListener('click', () => {
    document.querySelectorAll('#filterModal input:checked').forEach(cb => cb.checked = false);
    filterStationPicker.set([]);
    filterPositionPicker.set([]);
});

document.getElementById('btnApplyFilter').addEventListener('click', () => {
    view.filters = readFilters();
    trackTags([
        ...['position', 'workmode', 'other'].flatMap(g => view.filters[g] || []),
        ...(view.filters.transit || []).map(v => (LINE_BY_ID[v.split(':')[0]] || {}).name).filter(Boolean)
    ]);
    updateFilterCount();
    applyView();
    closeModal('filterModal');
});

// ---------------------------------------------------------------------------
// รายละเอียดบริษัท
// ---------------------------------------------------------------------------
function updateModalSaveBtn() {
    const btn = document.getElementById('modalSaveBtn');
    const on = savedSet.has(currentCompanyId);
    btn.classList.toggle('is-saved', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('span').textContent = on ? 'บันทึกไว้แล้ว' : 'บันทึกไว้ดูทีหลัง';
}

document.getElementById('modalSaveBtn').addEventListener('click', () => {
    if (currentCompanyId) toggleSaved(currentCompanyId);
});

function openDetailsModal(companyId) {
    const data = companyData.find(c => c.id === companyId);
    if (!data) return;
    currentCompanyId = companyId;
    addRecent(companyId);

    document.getElementById('modalLogo').innerHTML = logoHTML(data, 'lg');
    document.getElementById('modalCompanyName').textContent = data.name;
    const sectorTag = document.getElementById('modalSectorTag');
    sectorTag.textContent = data.sector;
    sectorTag.className = 'sector-tag ' + (SECTOR_CLASS[data.sector] || '');
    document.getElementById('modalStatus').innerHTML = statusBadgeHTML(data);
    updateModalSaveBtn();
    updateModalCompareBtn();
    const cal = calendarURL(data);
    const calBtn = document.getElementById('modalCalendarBtn');
    calBtn.classList.toggle('hidden', !cal || deadlineStatus(data).key === 'closed');
    if (cal) calBtn.href = cal;

    
    // ช่องไหนยังไม่มีข้อมูล → ป้ายสีเทาบอกผู้ใช้ตรงๆ แทนขีด "-"
    const setField = (id, value, emptyText) => {
        const el = document.getElementById(id);
        if (hasText(value)) el.textContent = value; else el.innerHTML = missingHTML(emptyText);
    };
    setField('modalDesc', data.desc, 'ยังไม่มีคำอธิบาย');
    setField('modalLoc', data.loc, 'ยังไม่ระบุที่อยู่');
    setField('modalPay', data.pay, 'ไม่ระบุ');
    const positions = (data.tags || []).filter(t => POSITION_TAGS.includes(t));
    document.getElementById('modalPositions').innerHTML = positions.map(positionPillHTML).join('');
    if (positions.length || hasText(data.pos)) document.getElementById('modalPos').textContent = hasText(data.pos) ? data.pos : '';
    else document.getElementById('modalPos').innerHTML = missingHTML('ยังไม่ระบุตำแหน่ง · สอบถามบริษัทโดยตรง');
    if (hasText(data.time)) document.getElementById('modalTime').textContent = data.time;
    else document.getElementById('modalTime').innerHTML = missingHTML('ยังไม่ประกาศรอบรับสมัคร');

    // กล่องบอกว่า Memo ยังหาข้อมูลส่วนไหนไม่เจอ + ปุ่มช่วยเพิ่มข้อมูล
    const missing = missingFields(data);
    const missBox = document.getElementById('modalMissing');
    missBox.classList.toggle('hidden', !missing.length);
    document.getElementById('modalMissingText').textContent = missing.join(' · ');

    const extraTags = (data.tags || []).filter(t => t !== data.sector && !TRANSIT_TAGS.includes(t) && !POSITION_TAGS.includes(t));
    const stations = data.stations || [];
    document.getElementById('modalStationsRow').classList.toggle('hidden', !stations.length);
    document.getElementById('modalStations').innerHTML = stations.map(stationPillHTML).join('');
    document.getElementById('modalTags').innerHTML = extraTags.map(t => `<span class="mini-tag">${escapeHTML(t)}</span>`).join('');

    const contactText = hasText(data.contact) ? data.contact : '';
    const linkEl = document.getElementById('modalContactLink');
    const textEl = document.getElementById('modalContactText');

    if (!contactText) {
        textEl.innerHTML = missingHTML('ยังไม่มีช่องทางสมัคร');
        textEl.style.display = 'inline';
        linkEl.style.display = 'none';
    } else if (contactText.startsWith('http') || contactText.startsWith('www.')) {
        let url = contactText.startsWith('www.') ? 'http://' + contactText : contactText;
        linkEl.href = url;
        linkEl.textContent = contactText;
        linkEl.style.display = 'inline';
        textEl.style.display = 'none';
    } else {
        textEl.textContent = contactText;
        textEl.style.display = 'inline';
        linkEl.style.display = 'none';
    }

    resetReviewForm();
    resetReportForm();
    loadReviews(companyId, data);

    const modal = document.getElementById('companyModal');
    openModal('companyModal');
    modal.querySelector('.modal-content').scrollTop = 0;
}

// ---------------------------------------------------------------------------
// รีวิว
// ---------------------------------------------------------------------------
document.getElementById('rvWorkmode').innerHTML = chipsHTML(WORKMODE_TAGS, { name: 'rvWorkmode', type: 'radio' });

(function fillYears() {
    const thisYear = new Date().getFullYear() + 543;
    const opts = ['<option value="">ไม่ระบุ</option>'];
    for (let y = thisYear; y >= thisYear - 6; y--) opts.push(`<option value="${y}">${y}</option>`);
    document.getElementById('rvYear').innerHTML = opts.join('');
})();

function reviewItemHTML(r) {
    const meta = [r.year ? `ฝึกปี ${r.year}` : '', r.role, r.workMode, r.pay ? `ได้ ${r.pay}` : ''].filter(Boolean).map(escapeHTML).join(' · ');
    const date = r.createdAt ? formatThaiDate(new Date(r.createdAt), true) : '';
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
        <article class="review-item">
            <div class="review-top">
                ${starsHTML(r.rating)}
                <span class="review-rec ${r.recommend ? 'yes' : 'no'}">${icon('thumb')}${r.recommend ? 'แนะนำ' : 'ไม่แนะนำ'}</span>
                <span class="review-date">${date}</span>
            </div>
            ${meta ? `<p class="review-meta">${meta}</p>` : ''}
            <p class="review-text">${escapeHTML(r.text)}</p>
            ${interview}
        </article>`;
}

async function loadReviews(companyId, company) {
    const list = document.getElementById('reviewList');
    const summary = document.getElementById('reviewSummary');
    summary.innerHTML = '';
    list.innerHTML = '<p class="review-loading">กำลังโหลดรีวิว...</p>';
    try {
        const res = await fetch(`${API_URL}/companies/${encodeURIComponent(companyId)}/reviews`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const reviews = await res.json();
        if (currentCompanyId !== companyId) return;

        if (!reviews.length) {
            list.innerHTML = `
                <div class="memo-state compact review-empty">
                    <img src="${MEMO}happy.webp" alt="Memo กำลังดีใจ" width="560" height="518">
                    <p>ยังไม่มีรีวิว ถ้าเคยไปฝึกที่นี่ เป็นคนแรกที่เล่าให้รุ่นน้องฟังสิ!</p>
                </div>`;
            return;
        }
        const avg = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length;
        const rec = Math.round(reviews.filter(r => r.recommend).length / reviews.length * 100);
        summary.innerHTML = `${starsHTML(avg)}<b>${avg.toFixed(1)}</b><span>${reviews.length} รีวิว · ${rec}% แนะนำ</span>`;
        list.innerHTML = reviews.map(reviewItemHTML).join('');
    } catch (err) {
        list.innerHTML = '<p class="review-loading">โหลดรีวิวไม่ได้ ลองใหม่อีกครั้งนะ</p>';
    }
}

function resetReviewForm() {
    const form = document.getElementById('reviewForm');
    form.reset();
    form.classList.add('hidden');
    document.getElementById('btnWriteReview').classList.remove('hidden');
}

document.getElementById('btnWriteReview').addEventListener('click', () => {
    document.getElementById('reviewForm').classList.remove('hidden');
    document.getElementById('btnWriteReview').classList.add('hidden');
    document.getElementById('reviewForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
document.getElementById('btnCancelReview').addEventListener('click', resetReviewForm);

document.getElementById('reviewForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rating = document.querySelector('input[name="rvRating"]:checked');
    if (!rating) return showToast('ให้คะแนนดาวก่อนนะ', 'error');
    const text = document.getElementById('rvText').value.trim();
    if (text.length < 10) return showToast('เล่าเพิ่มอีกนิดนะ อย่างน้อย 10 ตัวอักษร', 'error');

    const btn = document.getElementById('btnSubmitReview');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/companies/${encodeURIComponent(currentCompanyId)}/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rating: Number(rating.value),
                role: document.getElementById('rvRole').value,
                pay: document.getElementById('rvPay').value,
                workMode: (document.querySelector('input[name="rvWorkmode"]:checked') || {}).value || '',
                recommend: (document.querySelector('input[name="rvRecommend"]:checked') || {}).value === 'yes',
                text,
                year: document.getElementById('rvYear').value,
                difficulty: (document.querySelector('input[name="rvDifficulty"]:checked') || {}).value || '',
                hasTest: (document.querySelector('input[name="rvTest"]:checked') || {}).value || '',
                needPortfolio: (document.querySelector('input[name="rvPortfolio"]:checked') || {}).value || '',
                interviewQuestions: document.getElementById('rvInterview').value
            })
        });
        const result = await res.json();
        if (result.success) {
            resetReviewForm();
            showToast('ขอบคุณที่เล่าให้ฟังนะ! รีวิวจะขึ้นหลังแอดมินตรวจสอบ');
        } else {
            showToast(result.message || 'ส่งรีวิวไม่สำเร็จ', 'error');
        }
    } catch (err) {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Server', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ---------------------------------------------------------------------------
// แจ้งข้อมูลผิด
// ---------------------------------------------------------------------------
function resetReportForm() {
    const form = document.getElementById('reportForm');
    form.reset();
    form.classList.add('hidden');
    document.getElementById('btnReport').classList.remove('hidden');
}

document.getElementById('btnReport').addEventListener('click', () => {
    document.getElementById('reportForm').classList.remove('hidden');
    document.getElementById('btnReport').classList.add('hidden');
    document.getElementById('reportText').focus();
});
document.getElementById('btnCancelReport').addEventListener('click', resetReportForm);

// ปุ่ม "รู้ข้อมูล? ช่วยเพิ่มให้หน่อย" → เปิดฟอร์มแจ้งแอดมิน พร้อมเติมหัวข้อที่ยังขาด
document.getElementById('btnHelpInfo').addEventListener('click', () => {
    const missing = document.getElementById('modalMissingText').textContent;
    document.getElementById('btnReport').click();
    const box = document.getElementById('reportText');
    if (!box.value) box.value = `ข้อมูลเพิ่มเติม (${missing}):\n`;
    box.setSelectionRange(box.value.length, box.value.length);
    document.querySelector('#companyModal .report-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('reportText').value.trim();
    if (message.length < 5) return showToast('ช่วยบอกหน่อยว่าข้อมูลตรงไหนผิด', 'error');
    const btn = document.getElementById('btnSubmitReport');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/companies/${encodeURIComponent(currentCompanyId)}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        const result = await res.json();
        if (result.success) {
            resetReportForm();
            showToast('ส่งให้แอดมินแล้ว ขอบคุณที่ช่วยกันดูแลข้อมูลนะ');
        } else {
            showToast(result.message || 'ส่งไม่สำเร็จ', 'error');
        }
    } catch (err) {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Server', 'error');
    } finally {
        btn.disabled = false;
    }
});

// ---------------------------------------------------------------------------
// ตัวเลขสรุปบนหน้าแรก
// ---------------------------------------------------------------------------
function updateStats() {
    const statuses = companyData.map(c => deadlineStatus(c).key);
    document.getElementById('statTotal').textContent = companyData.length;
    document.getElementById('statOpen').textContent = statuses.filter(k => k === 'open' || k === 'closing').length;
    document.getElementById('statClosing').textContent = statuses.filter(k => k === 'closing').length;
    document.getElementById('statReviews').textContent = companyData.reduce((n, c) => n + (c.reviewCount || 0), 0);
}

document.querySelectorAll('.stat-tile').forEach(tile => tile.addEventListener('click', () => {
    const type = tile.dataset.stat;
    if (type === 'all') view.filters = {};
    if (type === 'open') view.filters = { status: ['open', 'closing'] };
    if (type === 'closing') view.filters = { status: ['closing'] };
    if (type === 'reviews') {
        view.sort = 'rating';
        document.getElementById('sortSelect').value = 'rating';
    }
    updateFilterCount();
    applyView();
    document.getElementById('find').scrollIntoView({ behavior: 'smooth' });
}));

// ---------------------------------------------------------------------------
// หมวดตำแหน่งยอดนิยม (การ์ด 8 หมวด)
// ---------------------------------------------------------------------------
function renderCategoryTiles() {
    const box = document.getElementById('categoryTiles');
    if (!box) return;
    box.innerHTML = POSITION_CATEGORIES.map(cat => {
        const n = companyData.filter(c => (c.tags || []).some(t => CATEGORY_OF_POSITION[t] === cat)).length;
        return `<button type="button" class="cat-tile" data-cat="${cat.id}" style="--cat:${cat.color}">
            <span class="cat-icon">${icon(CATEGORY_ICON[cat.id] || 'briefcase')}</span>
            <span class="cat-name">${escapeHTML(cat.name)}</span>
            <span class="cat-count">${n} บริษัท</span>
        </button>`;
    }).join('');
}

document.getElementById('categoryTiles').addEventListener('click', (e) => {
    const tile = e.target.closest('[data-cat]');
    if (!tile) return;
    view.filters = { position: [`cat:${tile.dataset.cat}`] };
    updateFilterCount();
    applyView();
    document.getElementById('find').scrollIntoView({ behavior: 'smooth' });
});

// ---------------------------------------------------------------------------
// ปุ่ม Tag ยอดนิยม (ข้างปุ่ม "ที่บันทึกไว้")
// ---------------------------------------------------------------------------
async function loadPopular() {
    try {
        const res = await fetch(`${API_URL}/stats/popular`);
        if (res.ok) popularTags = (await res.json()).map(s => s.tag);
    } catch { /* ใช้ค่าจากข้อมูลบริษัทแทน */ }
    renderQuickChips();
}

// Tag ที่คนกดค้นหาบ่อยก่อน แล้วเติมด้วย Tag ที่มีบริษัทใช้เยอะที่สุดให้ครบ 6 อัน
function quickTagList() {
    const known = [...POSITION_TAGS, ...WORKMODE_TAGS, ...TRANSIT_TAGS, ...OTHER_TAGS, 'มีค่าตอบแทน'];
    const freq = {};
    companyData.forEach(c => (c.tags || []).forEach(t => { if (known.includes(t)) freq[t] = (freq[t] || 0) + 1; }));
    const byFreq = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
    const list = [...new Set([...popularTags.filter(t => known.includes(t)), ...byFreq])];
    return (list.length ? list : POSITION_TAGS).slice(0, 6);
}

// ปุ่มลัดของสายรถไฟฟ้า = กรอง "ทุกสถานีในสายนั้น"
function filterValueOf(tag) {
    const line = lineByName(tag);
    return line ? `${line.id}:*` : tag;
}

function isTagActive(tag) {
    return (view.filters[tagGroup(tag)] || []).includes(filterValueOf(tag));
}

function renderQuickChips() {
    const box = document.getElementById('quickChips');
    if (!box) return;
    box.innerHTML = quickTagList().map(tag => {
        const on = isTagActive(tag);
        return `<button type="button" class="quick-chip ${on ? 'is-active' : ''}" data-quick="${escapeHTML(tag)}" aria-pressed="${on}">${escapeHTML(tag)}</button>`;
    }).join('');
}

function toggleQuickTag(tag) {
    const group = tagGroup(tag);
    const value = filterValueOf(tag);
    const list = view.filters[group] || [];
    if (list.includes(value)) {
        view.filters[group] = list.filter(t => t !== value);
        if (!view.filters[group].length) delete view.filters[group];
    } else {
        view.filters[group] = [...list, value];
        trackTags([tag]);
    }
    updateFilterCount();
    applyView();
}

function trackTags(tags) {
    if (!tags.length) return;
    fetch(`${API_URL}/stats/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
    }).catch(() => {});
}

// ---------------------------------------------------------------------------
// เปรียบเทียบบริษัท
// ---------------------------------------------------------------------------
function toggleCompare(id) {
    if (compareSet.has(id)) {
        compareSet.delete(id);
    } else {
        if (compareSet.size >= MAX_COMPARE) return showToast(`เปรียบเทียบได้สูงสุด ${MAX_COMPARE} บริษัทนะ`, 'error');
        compareSet.add(id);
    }
    updateCompareUI();
    if (currentCompanyId === id) updateModalCompareBtn();
}

function updateCompareUI() {
    // ตัดบริษัทที่ไม่มีแล้วออก (รอให้โหลดข้อมูลเสร็จก่อน)
    if (companyData.length) compareSet.forEach(id => { if (!companyData.some(c => c.id === id)) compareSet.delete(id); });
    writeList(COMPARE_KEY, [...compareSet]);
    document.querySelectorAll('[data-compare]').forEach(btn => {
        const on = compareSet.has(btn.dataset.compare);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', String(on));
    });
    const bar = document.getElementById('compareBar');
    const n = compareSet.size;
    bar.classList.toggle('hidden', n === 0);
    document.body.classList.toggle('has-compare', n > 0);
    document.getElementById('compareCount').textContent = `เลือกแล้ว ${n}/${MAX_COMPARE}`;
    document.getElementById('compareLogos').innerHTML = [...compareSet]
        .map(id => companyData.find(c => c.id === id)).filter(Boolean)
        .map(c => logoHTML(c, 'sm')).join('');
    document.getElementById('btnCompareOpen').disabled = n < 2;
}

function updateModalCompareBtn() {
    const btn = document.getElementById('modalCompareBtn');
    const on = compareSet.has(currentCompanyId);
    btn.classList.toggle('is-active', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.querySelector('span').textContent = on ? 'อยู่ในรายการเปรียบเทียบ' : 'เปรียบเทียบ';
}

document.getElementById('modalCompareBtn').addEventListener('click', () => {
    if (currentCompanyId) toggleCompare(currentCompanyId);
});
document.getElementById('btnCompareClear').addEventListener('click', () => {
    compareSet.clear();
    updateCompareUI();
});
document.getElementById('btnCompareOpen').addEventListener('click', openCompare);

function tagsIn(c, list) {
    return (c.tags || []).filter(t => list.includes(t));
}

function openCompare() {
    const list = [...compareSet].map(id => companyData.find(c => c.id === id)).filter(Boolean);
    if (list.length < 2) return showToast('เลือกอย่างน้อย 2 บริษัทก่อนนะ', 'error');

    const pills = (arr) => arr.length ? arr.map(t => `<span class="mini-tag">${escapeHTML(t)}</span>`).join('') : '<span class="cg-empty">-</span>';
    const rows = [
        ['ประเภท', c => `<span class="sector-tag ${SECTOR_CLASS[c.sector] || ''}">${escapeHTML(c.sector)}</span>`],
        ['รับสมัคร', c => statusBadgeHTML(c) || '<span class="cg-empty">ไม่ระบุ</span>'],
        ['ค่าตอบแทน', c => hasPay(c.pay) ? `<b class="highlight-pay">${escapeHTML(c.pay)}</b>` : '<span class="cg-empty">ไม่มี / ไม่ระบุ</span>'],
        ['ตำแหน่ง', c => {
            const list = tagsIn(c, POSITION_TAGS);
            const extra = c.pos ? `<span class="cg-pos-extra">${escapeHTML(c.pos)}</span>` : '';
            return (list.length ? list.map(positionPillHTML).join('') : '') + extra || '<span class="cg-empty">-</span>';
        }],
        ['รูปแบบงาน', c => pills(tagsIn(c, WORKMODE_TAGS))],
        ['รถไฟฟ้า', c => (c.stations || []).length ? c.stations.map(stationPillHTML).join('') : pills(tagsIn(c, TRANSIT_TAGS))],
        ['สถานที่', c => escapeHTML(c.loc || '-')],
        ['คะแนนรีวิว', c => c.reviewCount ? `${starsHTML(c.ratingAvg)} <b>${c.ratingAvg}</b> <span class="cg-empty">(${c.reviewCount})</span>` : '<span class="cg-empty">ยังไม่มีรีวิว</span>'],
        ['รุ่นพี่แนะนำ', c => c.recommendPct != null ? `<b>${c.recommendPct}%</b>` : '<span class="cg-empty">-</span>']
    ];

    let html = '<div class="cg-label cg-head"></div>' + list.map(c => `
        <div class="cg-cell cg-head">
            ${logoHTML(c)}
            <b class="cg-name">${escapeHTML(c.name)}</b>
            <button type="button" class="cg-remove" data-remove="${escapeHTML(c.id)}" aria-label="เอาออก">${icon('x')}</button>
        </div>`).join('');
    rows.forEach(([label, fn]) => {
        html += `<div class="cg-label">${label}</div>` + list.map(c => `<div class="cg-cell">${fn(c)}</div>`).join('');
    });
    html += '<div class="cg-label"></div>' + list.map(c => `<div class="cg-cell"><button type="button" class="btn-readmore" data-detail="${escapeHTML(c.id)}">ดูรายละเอียด</button></div>`).join('');

    const grid = document.getElementById('compareTable');
    grid.style.setProperty('--cols', list.length);
    grid.innerHTML = html;
    openModal('compareModal');
}

document.getElementById('compareTable').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) {
        compareSet.delete(rm.dataset.remove);
        updateCompareUI();
        if (compareSet.size < 2) closeModal('compareModal'); else openCompare();
        return;
    }
    const d = e.target.closest('[data-detail]');
    if (d) {
        closeModal('compareModal');
        openDetailsModal(d.dataset.detail);
    }
});

// ---------------------------------------------------------------------------
// แชร์
// ---------------------------------------------------------------------------
document.getElementById('modalShareBtn').addEventListener('click', async () => {
    const c = companyData.find(x => x.id === currentCompanyId);
    if (!c) return;
    const url = companyLink(c.id);
    if (navigator.share) {
        try {
            await navigator.share({ title: c.name, text: `ที่ฝึกงานน่าสนใจ: ${c.name}`, url });
            return;
        } catch (err) {
            if (err && err.name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        showToast('ก๊อปลิงก์แล้ว ส่งในกลุ่ม LINE ได้เลย', 'happy');
    } catch {
        showToast('ก๊อปไม่ได้ ลองก๊อปลิงก์จากแถบที่อยู่แทนนะ', 'error');
        history.replaceState(null, '', url);
    }
});

// ---------------------------------------------------------------------------
// Bottom tab bar: ไฮไลต์แท็บตาม section ที่กำลังดูอยู่
// ---------------------------------------------------------------------------
(function initTabbar() {
    const tabs = document.querySelectorAll('.tabbar .tab');
    const setActive = (id) => tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    tabs.forEach(t => t.addEventListener('click', () => setActive(t.dataset.tab)));

    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['find', 'more', 'contact-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
    });
})();

fetchCompanies();
