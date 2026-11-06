// script.js — หน้าแรก (ค้นหา / กรอง / รายละเอียด / รีวิว)
// ต้องโหลด common.js ก่อนไฟล์นี้

let companyData = [];
let currentCompanyId = null;
let savedSet = getSaved();

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
        companyData = await response.json();
        applyView();
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
    const id = new URLSearchParams(location.search).get('company');
    if (id && companyData.some(c => c.id === id)) openDetailsModal(id);
}

// ---------------------------------------------------------------------------
// ค้นหา + กรอง + เรียง
// ---------------------------------------------------------------------------
function matchesQuery(c, q) {
    if (!q) return true;
    const hay = [c.name, c.pos, c.loc, c.desc, ...(c.tags || [])].join(' ').toLowerCase();
    return q.split(/\s+/).every(word => hay.includes(word));
}

function matchesFilters(c) {
    const tags = c.tags || [];
    const f = view.filters;
    if (f.sector?.length && !f.sector.includes(c.sector)) return false;
    if (f.status?.length && !f.status.includes(deadlineStatus(c).key)) return false;
    if (f.position?.length && !f.position.some(t => tags.includes(t))) return false;
    if (f.workmode?.length && !f.workmode.some(t => tags.includes(t))) return false;
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
                    <p class="location">${icon('pin')}<span>${escapeHTML(company.loc)}</span></p>
                </div>
                <button type="button" class="btn-save ${isSaved ? 'is-saved' : ''}" data-save="${id}" aria-pressed="${isSaved}" aria-label="บันทึก ${escapeHTML(company.name)}">${icon('heart')}</button>
            </div>
            <div class="card-pills">
                <span class="sector-tag ${sectorCls}">${escapeHTML(company.sector)}</span>
                ${statusBadgeHTML(company)}
                ${payHtml}
            </div>
            ${descHtml}
            <div class="card-foot">
                ${ratingHtml}
                <button class="btn-readmore" onclick="openDetailsModal('${id}')">ดูรายละเอียด${icon('arrow-right')}</button>
            </div>
        </article>`;
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
    showToast(on ? 'Memo เก็บไว้ให้แล้ว ดูได้ที่ปุ่ม "ที่บันทึกไว้"' : 'เอาออกจากที่บันทึกไว้แล้ว', 'happy');
    if (view.savedOnly && !on) applyView();
}

document.getElementById('find').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (btn) toggleSaved(btn.dataset.save);
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
document.getElementById('filterPositions').innerHTML = chipsHTML(POSITION_TAGS, { group: 'position' });
document.getElementById('filterWorkmode').innerHTML = chipsHTML(WORKMODE_TAGS, { group: 'workmode' });

function readFilters() {
    const filters = {};
    document.querySelectorAll('#filterModal input[data-group]:checked').forEach(cb => {
        (filters[cb.dataset.group] = filters[cb.dataset.group] || []).push(cb.value);
    });
    return filters;
}

function syncFilterInputs() {
    document.querySelectorAll('#filterModal input[data-group]').forEach(cb => {
        cb.checked = (view.filters[cb.dataset.group] || []).includes(cb.value);
    });
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
}

document.getElementById('btnOpenFilter').addEventListener('click', () => {
    syncFilterInputs();
    openModal('filterModal');
});
document.getElementById('btnCancelFilter').addEventListener('click', () => closeModal('filterModal'));
document.getElementById('btnResetFilter').addEventListener('click', () => {
    document.querySelectorAll('#filterModal input:checked').forEach(cb => cb.checked = false);
});

document.getElementById('btnApplyFilter').addEventListener('click', () => {
    view.filters = readFilters();
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

    document.getElementById('modalLogo').innerHTML = logoHTML(data, 'lg');
    document.getElementById('modalCompanyName').textContent = data.name;
    const sectorTag = document.getElementById('modalSectorTag');
    sectorTag.textContent = data.sector;
    sectorTag.className = 'sector-tag ' + (SECTOR_CLASS[data.sector] || '');
    document.getElementById('modalStatus').innerHTML = statusBadgeHTML(data);
    updateModalSaveBtn();

    document.getElementById('modalDesc').textContent = data.desc || '-';
    document.getElementById('modalLoc').textContent = data.loc || '-';
    document.getElementById('modalPay').textContent = data.pay || '-';
    document.getElementById('modalPos').textContent = data.pos || '-';
    document.getElementById('modalTime').textContent = data.time || '-';

    const extraTags = (data.tags || []).filter(t => t !== data.sector);
    document.getElementById('modalTags').innerHTML = extraTags.map(t => `<span class="mini-tag">${escapeHTML(t)}</span>`).join('');

    const contactText = data.contact || '-';
    const linkEl = document.getElementById('modalContactLink');
    const textEl = document.getElementById('modalContactText');

    if (contactText.startsWith('http') || contactText.startsWith('www.')) {
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

function reviewItemHTML(r) {
    const meta = [r.role, r.workMode, r.pay ? `ได้ ${r.pay}` : ''].filter(Boolean).map(escapeHTML).join(' · ');
    const date = r.createdAt ? formatThaiDate(new Date(r.createdAt), true) : '';
    return `
        <article class="review-item">
            <div class="review-top">
                ${starsHTML(r.rating)}
                <span class="review-rec ${r.recommend ? 'yes' : 'no'}">${icon('thumb')}${r.recommend ? 'แนะนำ' : 'ไม่แนะนำ'}</span>
                <span class="review-date">${date}</span>
            </div>
            ${meta ? `<p class="review-meta">${meta}</p>` : ''}
            <p class="review-text">${escapeHTML(r.text)}</p>
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
                text
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
