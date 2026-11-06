const API_URL = '/api';
let companyData = [];

const MEMO = 'assets/character/';

// กันไม่ให้ข้อความที่ผู้ใช้กรอก (ชื่อบริษัท ฯลฯ) กลายเป็น HTML บนหน้าเว็บ
function escapeHTML(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function fetchCompanies() {
    try {
        const response = await fetch(`${API_URL}/companies`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        companyData = await response.json();
        renderCards(companyData);
    } catch (error) {
        console.error("Error fetching data:", error);
        ['sliderGov', 'sliderPrivate', 'sliderState'].forEach(id => {
            document.getElementById(id).innerHTML = '<p class="slider-empty-text">ไม่สามารถโหลดข้อมูลได้</p>';
        });
        showNotice('อ๊ะ Memo โหลดข้อมูลไม่ได้ ลองรีเฟรชหน้าอีกครั้งนะ', false);
    }
}

fetchCompanies();

const SECTOR_CLASS = {
    'ภาครัฐ': 'gov-sector',
    'เอกชน': 'private-sector',
    'รัฐวิสาหกิจ': 'state-sector'
};

function hasPay(pay) {
    return pay && !['-', 'ไม่มี', 'ไม่มีค่าตอบแทน'].includes(pay.trim());
}

function emptySliderHTML() {
    return `
        <div class="memo-state compact">
            <img src="${MEMO}sleepy.webp" alt="Memo กำลังง่วงนอน" width="511" height="560">
            <p>หมวดนี้ยังว่างอยู่ Memo ขอนอนรอก่อนนะ zzz</p>
        </div>`;
}

function renderCards(companies) {
    const govContainer = document.getElementById('sliderGov');
    const priContainer = document.getElementById('sliderPrivate');
    const stateContainer = document.getElementById('sliderState');

    const html = { gov: '', pri: '', state: '' };
    const count = { gov: 0, pri: 0, state: 0 };

    companies.forEach(company => {
        const tagsString = company.tags ? company.tags.join(',') : '';
        const sectorCls = SECTOR_CLASS[company.sector] || '';

        const descHtml = company.desc ? `<p class="card-desc">${escapeHTML(company.desc)}</p>` : '';
        const payHtml = hasPay(company.pay)
            ? `<span class="pay-badge" title="${escapeHTML(company.pay)}"><svg class="icon"><use href="#i-coins"/></svg>${escapeHTML(company.pay)}</span>`
            : '';

        const cardHTML = `
            <article class="slider-card" data-tags="${escapeHTML(tagsString)}">
                <div class="card-header">
                    <span class="sector-tag ${sectorCls}">${escapeHTML(company.sector)}</span>
                    ${payHtml}
                </div>
                <div class="card-body">
                    <h4 class="company-name">${escapeHTML(company.name)}</h4>
                    ${descHtml}
                    <p class="location"><svg class="icon"><use href="#i-pin"/></svg><span>${escapeHTML(company.loc)}</span></p>
                    <button class="btn-readmore" onclick="openDetailsModal('${escapeHTML(company.id)}')">ดูรายละเอียด<svg class="icon"><use href="#i-arrow-right"/></svg></button>
                </div>
            </article>
        `;

        if (company.sector === 'ภาครัฐ') {
            html.gov += cardHTML; count.gov++;
        } else if (company.sector === 'เอกชน') {
            html.pri += cardHTML; count.pri++;
        } else if (company.sector === 'รัฐวิสาหกิจ') {
            html.state += cardHTML; count.state++;
        }
    });

    govContainer.innerHTML = html.gov || emptySliderHTML();
    priContainer.innerHTML = html.pri || emptySliderHTML();
    stateContainer.innerHTML = html.state || emptySliderHTML();
    [govContainer, priContainer, stateContainer].forEach(el => el.scrollLeft = 0);
    updateSliderArrows();

    setCount('sliderGov', count.gov);
    setCount('sliderPrivate', count.pri);
    setCount('sliderState', count.state);

    // ค้นหา/กรองแล้วไม่เจออะไรเลย → ให้ Memo บอก
    const total = count.gov + count.pri + count.state;
    if (total === 0 && companyData.length > 0) {
        showNotice('อ๊ะ Memo หาไม่เจอเลย ลองเปลี่ยนคำค้นดูนะ', true);
    } else {
        hideNotice();
    }
}

function setCount(sliderId, n) {
    const pill = document.querySelector(`[data-count-for="${sliderId}"]`);
    if (pill) pill.textContent = `${n} แห่ง`;
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
    document.querySelectorAll('.checkbox-grid input:checked').forEach(cb => cb.checked = false);
    renderCards(companyData);
});

const scrollAmount = 280;
function slideNext(containerId) {
    document.getElementById(containerId).scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

function slidePrev(containerId) {
    document.getElementById(containerId).scrollBy({ left: -scrollAmount, behavior: 'smooth' });
}

// ปิดปุ่มลูกศรเมื่อเลื่อนสุดแล้ว / ไม่มีอะไรให้เลื่อน
const SLIDER_IDS = ['sliderGov', 'sliderState', 'sliderPrivate'];
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

// Hamburger Menu Toggle
document.getElementById('hamburgerMenu').addEventListener('click', function() {
    document.getElementById('navLinks').classList.toggle('active');
});

function openDetailsModal(companyId) {
    const data = companyData.find(c => c.id === companyId);
    if (!data) return;

    document.getElementById('modalCompanyName').textContent = data.name;
    const sectorTag = document.getElementById('modalSectorTag');
    sectorTag.textContent = data.sector;
    sectorTag.className = 'sector-tag ' + (SECTOR_CLASS[data.sector] || '');

    document.getElementById('modalDesc').textContent = data.desc || '-';
    document.getElementById('modalLoc').textContent = data.loc || '-';
    document.getElementById('modalPay').textContent = data.pay || '-';
    document.getElementById('modalPos').textContent = data.pos || '-';
    document.getElementById('modalTime').textContent = data.time || '-';

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

    openModal('companyModal');
}

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
    document.body.classList.add('modal-open');
}
function closeModal(id) {
    document.getElementById(id).style.display = 'none';
    document.body.classList.remove('modal-open');
}

document.getElementById('btnOpenFilter').addEventListener('click', () => openModal('filterModal'));
document.getElementById('btnCancelFilter').addEventListener('click', () => closeModal('filterModal'));

// ตรรกะการกรอง
document.getElementById('btnApplyFilter').addEventListener('click', () => {
    const checkedBoxes = Array.from(document.querySelectorAll('.checkbox-grid input:checked')).map(cb => cb.value);
    document.getElementById('btnOpenFilter').classList.toggle('is-active', checkedBoxes.length > 0);

    if (checkedBoxes.length === 0) {
        renderCards(companyData);
        closeModal('filterModal');
        return;
    }

    const sectorKeywords = ['ภาครัฐ', 'เอกชน', 'รัฐวิสาหกิจ'];
    const selectedSectors = checkedBoxes.filter(val => sectorKeywords.includes(val));
    const selectedOtherTags = checkedBoxes.filter(val => !sectorKeywords.includes(val));

    const filtered = companyData.filter(company => {
        let passSector = true;
        let passOther = true;

        if (selectedSectors.length > 0) {
            passSector = selectedSectors.includes(company.sector);
        }

        if (selectedOtherTags.length > 0) {
            if (!company.tags) passOther = false;
            else {
                passOther = selectedOtherTags.some(tag => company.tags.includes(tag));
            }
        }

        return passSector && passOther;
    });

    renderCards(filtered);
    closeModal('filterModal');
});

document.getElementById('btnSearch').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = companyData.filter(c => (c.name || '').toLowerCase().includes(query));
    renderCards(filtered);
});

// กด Enter ในช่องค้นหา = กดปุ่มค้นหา
document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btnSearch').click();
});

function setExtraOpen(open) {
    const extraFields = document.getElementById('extraFields');
    const btn = document.getElementById('btnToggleExtra');
    extraFields.classList.toggle('hidden', !open);
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('.toggle-label').textContent = open ? 'ย่อกลับ' : 'เพิ่มเติม';
}

document.getElementById('btnToggleExtra').addEventListener('click', function() {
    setExtraOpen(document.getElementById('extraFields').classList.contains('hidden'));
});

const payRadios = document.querySelectorAll('input[name="payType"]');
const payInput = document.getElementById('payAmountInput');
payRadios.forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'amount') {
            payInput.classList.remove('hidden');
            payInput.required = true;
        } else {
            payInput.classList.add('hidden');
            payInput.required = false;
            payInput.value = '';
        }
    });
});

// Memo toast (แทน alert)
let toastTimer;
function showToast(message, mood = 'excited') {
    const toast = document.getElementById('memoToast');
    const img = document.getElementById('memoToastImg');
    img.src = MEMO + (mood === 'error' ? 'confused-404.webp' : 'excited.webp');
    img.alt = mood === 'error' ? 'Memo กำลังงง' : 'Memo กำลังตื่นเต้นดีใจ';
    document.getElementById('memoToastText').textContent = message;
    toast.classList.toggle('is-error', mood === 'error');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

document.getElementById('addCompanyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitAdd');
    btnSubmit.textContent = 'กำลังบันทึก...';
    btnSubmit.disabled = true;

    const tStart = document.getElementById('addTimeStart').value;
    const tEnd = document.getElementById('addTimeEnd').value;
    const timeStr = (tStart && tEnd) ? `${tStart} ถึง ${tEnd}` : '-';

    const pType = document.querySelector('input[name="payType"]:checked').value;
    let payStr = '-';
    let tags = [document.getElementById('addSector').value];

    if(pType === 'amount') {
        payStr = document.getElementById('payAmountInput').value;
        tags.push('มีค่าตอบแทน');
    } else if (pType === 'agreed') {
        payStr = 'ตามแต่ตกลง';
        tags.push('มีค่าตอบแทน');
    } else {
        payStr = 'ไม่มีค่าตอบแทน';
    }

    const additionalTags = document.querySelectorAll('input[name="addTags"]:checked');
    additionalTags.forEach(t => tags.push(t.value));

    const payload = {
        name: document.getElementById('addName').value,
        loc: document.getElementById('addLoc').value,
        sector: document.getElementById('addSector').value,
        desc: document.getElementById('addDesc').value,
        pos: document.getElementById('addPos').value,
        contact: document.getElementById('addContact').value,
        time: timeStr,
        pay: payStr,
        tags: tags
    };

    try {
        const res = await fetch(`${API_URL}/companies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if(result.success) {
            showToast('เย้! ขอบคุณที่แชร์นะ Memo บันทึกให้แล้ว');
            e.target.reset();
            payInput.classList.add('hidden');
            payInput.required = false;
            setExtraOpen(false);
            fetchCompanies();
        } else {
            showToast('บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ', 'error');
        }
    } catch (err) {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Server', 'error');
        console.error(err);
    } finally {
        btnSubmit.textContent = 'บันทึกข้อมูล';
        btnSubmit.disabled = false;
    }
});

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
}

// กด Esc เพื่อปิด modal
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal').forEach(m => { if (m.style.display === 'flex') closeModal(m.id); });
});

// Bottom tab bar: ไฮไลต์แท็บตาม section ที่กำลังดูอยู่
(function initTabbar() {
    const tabs = document.querySelectorAll('.tabbar .tab');
    const setActive = (id) => tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === id));
    tabs.forEach(t => t.addEventListener('click', () => setActive(t.dataset.tab)));

    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['find', 'add', 'more', 'contact-section'].forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
    });
})();
