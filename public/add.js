// add.js — หน้าเพิ่มบริษัท (รองรับปุ่มเปิดรายละเอียดเพิ่มเติม, ไม่มีกำหนดปิดรับสมัคร, และแจ้งเตือนชื่อซ้ำ)
// ต้องโหลด transit-data.js, tag-data.js และ common.js ก่อนไฟล์นี้

const workmodeContainer = document.getElementById('addWorkmodeChips');
const otherContainer = document.getElementById('addOtherChips');
const posPickerWrap = document.getElementById('addPositionPicker');
const stationPickerWrap = document.getElementById('addStationPicker');

const payRadios = document.querySelectorAll('input[name="payType"]');
const payAmountInput = document.getElementById('payAmountInput');

const btnToggleExtra = document.getElementById('btnToggleExtra');
const extraFields = document.getElementById('extraFields');

const addNoDeadline = document.getElementById('addNoDeadline');
const addTimeEnd = document.getElementById('addTimeEnd');

const addNameInput = document.getElementById('addName');
const dupHintEl = document.getElementById('dupHint');

let existingCompanies = [];
let pendingPayload = null;
let duplicateTarget = null;

// ---------------------------------------------------------------------------
// Init Pickers & Chips
// ---------------------------------------------------------------------------
workmodeContainer.innerHTML = chipsHTML(WORKMODE_TAGS);
otherContainer.innerHTML = chipsHTML(OTHER_TAGS);

const positionPicker = createPositionPicker(posPickerWrap);
const stationPicker = createStationPicker(stationPickerWrap, { max: 4 });

// โหลดรายชื่อบริษัทที่มีอยู่แล้วเพื่อเช็กชื่อซ้ำแบบเรียลไทม์
(async function loadExistingNames() {
    try {
        const res = await fetch(`${API_URL}/companies`);
        if (res.ok) existingCompanies = await res.json();
    } catch { /* ignore */ }
})();

// ---------------------------------------------------------------------------
// UI Toggles (รายละเอียดเพิ่มเติม, ค่าตอบแทน, ไม่มีกำหนดปิดรับสมัคร)
// ---------------------------------------------------------------------------
btnToggleExtra.addEventListener('click', () => {
    const isHidden = extraFields.classList.toggle('hidden');
    btnToggleExtra.setAttribute('aria-expanded', String(!isHidden));
    btnToggleExtra.classList.toggle('is-open', !isHidden);
});

payRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.value === 'amount' && radio.checked) {
            payAmountInput.classList.remove('hidden');
            payAmountInput.focus();
        } else {
            payAmountInput.classList.add('hidden');
            payAmountInput.value = '';
        }
    });
});

addNoDeadline.addEventListener('change', function () {
    if (this.checked) {
        addTimeEnd.value = '';
        addTimeEnd.disabled = true;
    } else {
        addTimeEnd.disabled = false;
    }
});

// เช็กชื่อบริษัทซ้ำขณะพิมพ์
function findMatchingCompany(name) {
    const norm = name.trim().toLowerCase();
    if (norm.length < 2) return null;
    return existingCompanies.find(c => {
        const cName = String(c.name || '').trim().toLowerCase();
        return cName === norm || (norm.length >= 4 && (cName.includes(norm) || norm.includes(cName)));
    }) || null;
}

addNameInput.addEventListener('input', () => {
    const match = findMatchingCompany(addNameInput.value);
    if (match) {
        dupHintEl.textContent = `ℹ️ มีข้อมูลของ "${match.name}" อยู่ในระบบแล้ว (สามารถเพิ่มเป็นอีกรอบ/Section ได้)`;
        dupHintEl.classList.remove('hidden');
    } else {
        dupHintEl.classList.add('hidden');
    }
});

// ---------------------------------------------------------------------------
// Build Payload & Submit
// ---------------------------------------------------------------------------
function buildFormPayload() {
    const name = addNameInput.value.trim();
    const sector = document.getElementById('addSector').value;
    const sourceLabel = document.getElementById('addSourceLabel').value.trim();
    const loc = document.getElementById('addLoc').value.trim();
    const contact = document.getElementById('addContact').value.trim();
    const posExtra = document.getElementById('addPos').value.trim();
    const desc = document.getElementById('addDesc').value.trim();

    // ค่าตอบแทน
    const payMode = document.querySelector('input[name="payType"]:checked')?.value || 'none';
    let pay = '';
    if (payMode === 'amount') {
        const val = payAmountInput.value.trim();
        pay = val || 'มีค่าตอบแทน';
    } else if (payMode === 'agreed') {
        pay = 'ตามแต่ตกลง';
    }

    // ระยะเวลาการรับสมัคร
    const tStart = document.getElementById('addTimeStart').value;
    const isNoDeadline = addNoDeadline.checked;
    const tEnd = isNoDeadline ? '' : addTimeEnd.value;
    const timeStr = isNoDeadline
        ? 'ไม่มีกำหนดปิดรับสมัคร'
        : ((tStart && tEnd) ? `${tStart} ถึง ${tEnd}` : (tEnd ? `ถึง ${tEnd}` : '-'));

    // รวม Tags
    const chosenPositions = positionPicker.get();
    const workmodes = [...workmodeContainer.querySelectorAll('input:checked')].map(el => el.value);
    const others = [...otherContainer.querySelectorAll('input:checked')].map(el => el.value);
    if ((payMode === 'amount' || payMode === 'agreed') && !others.includes('มีค่าตอบแทน')) {
        others.push('มีค่าตอบแทน');
    }

    const tags = [...new Set([sector, ...chosenPositions, ...workmodes, ...others])];
    const stations = stationPicker.get();

    return {
        name,
        sector,
        sourceLabel,
        loc,
        desc,
        pay,
        pos: posExtra,
        time: timeStr,
        timeStart: tStart,
        timeEnd: tEnd,
        noDeadline: isNoDeadline,
        contact,
        tags,
        stations
    };
}

async function submitCompanyPayload(payload) {
    const btn = document.getElementById('btnSubmitAdd');
    btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/companies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('addSuccessName').textContent = payload.name;
            document.getElementById('addCompanyForm').classList.add('hidden');
            document.getElementById('addSuccess').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showToast(data.message || 'ส่งข้อมูลไม่สำเร็จ ลองใหม่อีกครั้งนะ', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('ไม่สามารถเชื่อมต่อ Server ได้', 'error');
    } finally {
        btn.disabled = false;
    }
}

document.getElementById('addCompanyForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = buildFormPayload();
    if (!payload.name) return showToast('ช่วยกรอกชื่อบริษัทก่อนนะ', 'error');
    if (!payload.loc) return showToast('ช่วยกรอกสถานที่ตั้งก่อนนะ', 'error');

    // หากพบชื่อซ้ำในระบบ เปิด Modal ถามก่อนว่าจะตั้งชื่อหัวข้อ Section เพิ่มไหม
    const match = findMatchingCompany(payload.name);
    if (match && !payload.sourceLabel) {
        duplicateTarget = match;
        pendingPayload = payload;
        document.getElementById('dupTargetName').textContent = match.name;
        document.getElementById('dupModalSourceLabel').value = '';
        openModal('duplicateMergeModal');
        return;
    }

    await submitCompanyPayload(payload);
});

// จัดการ Duplicate Merge Modal
document.getElementById('btnCancelMerge').addEventListener('click', () => {
    closeModal('duplicateMergeModal');
    pendingPayload = null;
    duplicateTarget = null;
});

document.getElementById('btnConfirmMerge').addEventListener('click', async () => {
    if (!pendingPayload) return;
    const customLabel = document.getElementById('dupModalSourceLabel').value.trim();
    if (customLabel) pendingPayload.sourceLabel = customLabel;
    // ใช้ชื่อบริษัทให้ตรงกับในระบบ เพื่อให้แอดมินกดรวม Section ได้ทันที
    if (duplicateTarget) pendingPayload.name = duplicateTarget.name;

    closeModal('duplicateMergeModal');
    await submitCompanyPayload(pendingPayload);
    pendingPayload = null;
    duplicateTarget = null;
});

// ปุ่ม "เพิ่มอีกบริษัท" หลังส่งสำเร็จ
document.getElementById('btnAddAnother').addEventListener('click', () => {
    document.getElementById('addCompanyForm').reset();
    payAmountInput.classList.add('hidden');
    addTimeEnd.disabled = false;
    dupHintEl.classList.add('hidden');
    positionPicker.set([]);
    stationPicker.set([]);

    extraFields.classList.add('hidden');
    btnToggleExtra.setAttribute('aria-expanded', 'false');
    btnToggleExtra.classList.remove('is-open');

    document.getElementById('addSuccess').classList.add('hidden');
    document.getElementById('addCompanyForm').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
```[cite: 29, 30]```