// add.js — หน้าเพิ่มข้อมูลบริษัท
// ต้องโหลด common.js ก่อนไฟล์นี้

let existingCompanies = [];

document.getElementById('addPositionChips').innerHTML = chipsHTML(POSITION_TAGS, { name: 'addTags' });
document.getElementById('addWorkmodeChips').innerHTML = chipsHTML(WORKMODE_TAGS, { name: 'addTags' });
const stationPicker = createStationPicker(document.getElementById('addStationPicker'), { max: 4 });
document.getElementById('addOtherChips').innerHTML = chipsHTML(OTHER_TAGS, { name: 'addTags' });

// โหลดรายชื่อบริษัทที่มีอยู่ ไว้เช็คชื่อซ้ำ
fetch(`${API_URL}/companies`)
    .then(res => res.ok ? res.json() : [])
    .then(list => { existingCompanies = Array.isArray(list) ? list : []; })
    .catch(() => {});

// ---------------------------------------------------------------------------
// เช็คชื่อซ้ำระหว่างพิมพ์
// ---------------------------------------------------------------------------
function findSimilar(name) {
    const key = normalizeName(name);
    if (key.length < 3) return { exact: null, similar: [] };
    const exact = existingCompanies.find(c => normalizeName(c.name) === key) || null;
    const similar = existingCompanies
        .filter(c => c !== exact)
        .filter(c => {
            const k = normalizeName(c.name);
            return k.length >= 3 && (k.includes(key) || key.includes(k));
        })
        .slice(0, 2);
    return { exact, similar };
}

let dupTimer;
document.getElementById('addName').addEventListener('input', (e) => {
    clearTimeout(dupTimer);
    dupTimer = setTimeout(() => {
        const hint = document.getElementById('dupHint');
        const { exact, similar } = findSimilar(e.target.value);
        const link = (c) => `<a href="index.html?company=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">${escapeHTML(c.name)}</a>`;
        if (exact) {
            hint.className = 'dup-hint is-dup';
            hint.innerHTML = `${icon('info')}<span>มี ${link(exact)} อยู่ในเว็บแล้วนะ ถ้าข้อมูลไม่อัปเดต กด "แจ้งข้อมูลผิด" ในหน้าบริษัทได้เลย</span>`;
        } else if (similar.length) {
            hint.className = 'dup-hint';
            hint.innerHTML = `${icon('info')}<span>ชื่อคล้ายกับ ${similar.map(link).join(', ')} ใช่บริษัทเดียวกันไหม?</span>`;
        } else {
            hint.className = 'dup-hint hidden';
            hint.innerHTML = '';
        }
    }, 250);
});

// ---------------------------------------------------------------------------
// รายละเอียดเพิ่มเติม / ค่าตอบแทน
// ---------------------------------------------------------------------------
function setExtraOpen(open) {
    const extraFields = document.getElementById('extraFields');
    const btn = document.getElementById('btnToggleExtra');
    extraFields.classList.toggle('hidden', !open);
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
}

document.getElementById('btnToggleExtra').addEventListener('click', () => {
    setExtraOpen(document.getElementById('extraFields').classList.contains('hidden'));
});

const payInput = document.getElementById('payAmountInput');
document.querySelectorAll('input[name="payType"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if (this.value === 'amount') {
            payInput.classList.remove('hidden');
            payInput.required = true;
            payInput.focus();
        } else {
            payInput.classList.add('hidden');
            payInput.required = false;
            payInput.value = '';
        }
    });
});

// ---------------------------------------------------------------------------
// ส่งข้อมูล
// ---------------------------------------------------------------------------
function invalid(input, message) {
    input.classList.add('is-invalid');
    input.focus();
    showToast(message, 'error');
    return false;
}

document.querySelectorAll('#addCompanyForm input, #addCompanyForm textarea').forEach(el => {
    el.addEventListener('input', () => el.classList.remove('is-invalid'));
});

function validate() {
    const name = document.getElementById('addName');
    const loc = document.getElementById('addLoc');
    const start = document.getElementById('addTimeStart').value;
    const end = document.getElementById('addTimeEnd').value;
    if (!name.value.trim()) return invalid(name, 'ใส่ชื่อบริษัทก่อนนะ');
    if (!loc.value.trim()) return invalid(loc, 'ใส่สถานที่ตั้งด้วยนะ');
    if (payInput.required && !payInput.value.trim()) {
        setExtraOpen(true);
        return invalid(payInput, 'ใส่จำนวนค่าตอบแทนด้วยนะ');
    }
    if (start && end && start > end) {
        setExtraOpen(true);
        return invalid(document.getElementById('addTimeEnd'), 'วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่ม');
    }
    return true;
}

document.getElementById('addCompanyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const btnSubmit = document.getElementById('btnSubmitAdd');
    btnSubmit.textContent = 'กำลังส่ง...';
    btnSubmit.disabled = true;

    const tStart = document.getElementById('addTimeStart').value;
    const tEnd = document.getElementById('addTimeEnd').value;
    const timeStr = (tStart && tEnd) ? `${tStart} ถึง ${tEnd}` : (tEnd ? `ถึง ${tEnd}` : '-');

    const pType = document.querySelector('input[name="payType"]:checked').value;
    const sector = document.getElementById('addSector').value;
    let payStr;
    const tags = [sector];

    if (pType === 'amount') {
        payStr = payInput.value.trim();
        tags.push('มีค่าตอบแทน');
    } else if (pType === 'agreed') {
        payStr = 'ตามแต่ตกลง';
        tags.push('มีค่าตอบแทน');
    } else {
        payStr = 'ไม่มีค่าตอบแทน';
    }

    document.querySelectorAll('input[name="addTags"]:checked').forEach(t => tags.push(t.value));

    const payload = {
        name: document.getElementById('addName').value.trim(),
        loc: document.getElementById('addLoc').value.trim(),
        sector,
        desc: document.getElementById('addDesc').value.trim(),
        pos: document.getElementById('addPos').value.trim(),
        contact: document.getElementById('addContact').value.trim(),
        time: timeStr,
        timeStart: tStart,
        timeEnd: tEnd,
        pay: payStr,
        tags,
        stations: stationPicker.get()
    };

    try {
        const res = await fetch(`${API_URL}/companies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            document.getElementById('addSuccessName').textContent = payload.name;
            document.getElementById('addCompanyForm').classList.add('hidden');
            document.getElementById('addSuccess').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showToast(result.message || 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะ', 'error');
        }
    } catch (err) {
        showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Server', 'error');
        console.error(err);
    } finally {
        btnSubmit.textContent = 'ส่งข้อมูลให้แอดมินตรวจ';
        btnSubmit.disabled = false;
    }
});

document.getElementById('btnAddAnother').addEventListener('click', () => {
    const form = document.getElementById('addCompanyForm');
    form.reset();
    stationPicker.set([]);
    payInput.classList.add('hidden');
    payInput.required = false;
    setExtraOpen(false);
    document.getElementById('dupHint').className = 'dup-hint hidden';
    document.getElementById('addSuccess').classList.add('hidden');
    form.classList.remove('hidden');
    document.getElementById('addName').focus();
});
