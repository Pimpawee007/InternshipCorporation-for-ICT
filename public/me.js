// me.js — หน้า "ของฉัน" (บริษัทที่บันทึกไว้ / ดูล่าสุด / เปรียบเทียบ)
// ข้อมูลทั้งหมดเก็บในเบราว์เซอร์ (localStorage) ไม่ต้อง login
// ต้องโหลด transit-data.js, tag-data.js, common.js ก่อนไฟล์นี้

let companies = [];

function meCardHTML(c, action) {
    const id = escapeHTML(c.id);
    const positions = (c.tags || []).filter(t => POSITION_TAGS.includes(t)).slice(0, 2);
    const actionBtn = {
        unsave: `<button type="button" class="me-icon-btn heart" data-unsave="${id}" aria-label="เอาออกจากที่บันทึกไว้" title="เอาออก">${icon('heart')}</button>`,
        uncompare: `<button type="button" class="me-icon-btn" data-uncompare="${id}" aria-label="เอาออกจากรายการเปรียบเทียบ" title="เอาออก">${icon('x')}</button>`,
        none: ''
    }[action];
    return `
        <article class="me-card">
            ${logoHTML(c)}
            <div class="me-card-body">
                <a href="index.html?company=${encodeURIComponent(c.id)}" class="me-card-name">${escapeHTML(c.name)}</a>
                <p class="me-card-meta">${icon('pin')}<span>${escapeHTML(c.loc || '-')}</span></p>
                <div class="card-pills">
                    <span class="sector-tag ${SECTOR_CLASS[c.sector] || ''}">${escapeHTML(c.sector)}</span>
                    ${statusBadgeHTML(c)}
                    ${positions.map(positionPillHTML).join('')}
                </div>
            </div>
            <div class="me-card-actions">
                ${actionBtn}
                <a href="index.html?company=${encodeURIComponent(c.id)}" class="me-icon-btn go" aria-label="ดูรายละเอียด" title="ดูรายละเอียด">${icon('arrow-right')}</a>
            </div>
        </article>`;
}

function emptyHTML(text) {
    return `<div class="memo-state compact"><img src="${MEMO}sleepy.webp" alt="Memo กำลังง่วงนอน" width="511" height="560"><p>${text}</p></div>`;
}

function byIds(ids) {
    return ids.map(id => companies.find(c => c.id === id)).filter(Boolean);
}

function render() {
    const saved = byIds([...getSaved()]);
    const compare = byIds(readList(COMPARE_KEY));
    const recent = byIds(readList(RECENT_KEY));

    document.getElementById('countSaved').textContent = saved.length;
    document.getElementById('countCompare').textContent = compare.length;
    document.getElementById('countRecent').textContent = recent.length;

    document.getElementById('meSaved').innerHTML = saved.length
        ? saved.map(c => meCardHTML(c, 'unsave')).join('')
        : emptyHTML('ยังไม่ได้บันทึกบริษัทเลย กดรูปหัวใจที่การ์ดในหน้าแรกเพื่อเก็บไว้ที่นี่นะ');

    document.getElementById('meCompare').innerHTML = compare.length
        ? compare.map(c => meCardHTML(c, 'uncompare')).join('')
        : emptyHTML('ยังไม่มีบริษัทในรายการเปรียบเทียบ กดปุ่มสี่เหลี่ยมข้าง "ดูรายละเอียด" ในหน้าแรก');
    const openBtn = document.getElementById('btnOpenCompare');
    openBtn.classList.toggle('is-disabled', compare.length < 2);
    openBtn.setAttribute('aria-disabled', String(compare.length < 2));

    document.getElementById('meRecent').innerHTML = recent.length
        ? recent.map(c => meCardHTML(c, 'none')).join('')
        : emptyHTML('ยังไม่ได้เปิดดูบริษัทไหนเลย');
    document.getElementById('btnClearRecent').classList.toggle('hidden', !recent.length);

    updateNavSavedBadge();
}

document.querySelector('.me-page').addEventListener('click', (e) => {
    const unsave = e.target.closest('[data-unsave]');
    if (unsave) {
        const set = getSaved();
        set.delete(unsave.dataset.unsave);
        setSaved(set);
        showToast('เอาออกจากที่บันทึกไว้แล้ว', 'happy');
        return render();
    }
    const uncompare = e.target.closest('[data-uncompare]');
    if (uncompare) {
        writeList(COMPARE_KEY, readList(COMPARE_KEY).filter(id => id !== uncompare.dataset.uncompare));
        return render();
    }
    if (e.target.closest('#btnClearRecent')) {
        writeList(RECENT_KEY, []);
        return render();
    }
    const open = e.target.closest('#btnOpenCompare');
    if (open && open.classList.contains('is-disabled')) {
        e.preventDefault();
        showToast('เลือกอย่างน้อย 2 บริษัทก่อนนะ', 'error');
    }
});

(async function load() {
    try {
        const res = await fetch(`${API_URL}/companies`);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        companies = (await res.json()).map(c => ({ ...c, tags: normalizeTags(c.tags) }));
        render();
    } catch (err) {
        ['meSaved', 'meCompare', 'meRecent'].forEach(id => {
            document.getElementById(id).innerHTML = `<div class="memo-state compact"><img src="${MEMO}confused-404.webp" alt="Memo กำลังงง" width="445" height="560"><p>โหลดข้อมูลไม่ได้ ลองรีเฟรชหน้าอีกครั้งนะ</p></div>`;
        });
    }
})();
