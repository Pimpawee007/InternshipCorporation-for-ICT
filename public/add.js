// add.js — หน้าเพิ่มบริษัท (ส่งเข้าคิวรออนุมัติ)
// ต้องโหลด transit-data.js, tag-data.js และ common.js ก่อนไฟล์นี้

const addWorkmodeEl = document.getElementById('addWorkmode');
const addOtherEl = document.getElementById('addOther');
const addPosWrap = document.getElementById('addPositions');
const addStationsWrap = document.getElementById('addStations');
const addPayType = document.getElementById('addPayType');
const addPayInput = document.getElementById('addPay');
const addNoDeadline = document.getElementById('addNoDeadline');
const addTimeEnd = document.getElementById('addTimeEnd');

addWorkmodeEl.innerHTML = chipsHTML(WORKMODE_TAGS);
addOtherEl.innerHTML = chipsHTML(OTHER_TAGS);

const addPositionPicker = createPositionPicker(addPosWrap);
const addStationPicker = createStationPicker(addStationsWrap, { max: 6 });

// จัดการช่องค่าตอบแทน
addPayType.addEventListener('change', function () {
    if (this.value === 'มี') {
        addPayInput.classList.remove('hidden');
        addPayInput.focus();
    } else {
        addPayInput.classList.add('hidden');
        addPayInput.value = '';
    }
});

// จัดการปุ่ม "ไม่มีกำหนดปิดรับสมัคร"
addNoDeadline.addEventListener('change', function () {
    if (this.checked) {
        addTimeEnd.value = '';
        addTimeEnd.disabled = true;
    } else {
        addTimeEnd.disabled = false;
    }
});

// กดส่งฟอร์มเพิ่มบริษัท
document.getElementById('addCompanyForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btn = document.getElementById('btnSubmitAdd');
    const name = document.getElementById('addName').value.trim();
    const sector = document.getElementById('addSector').value;
    const loc = document.getElementById('addLoc').value.trim();
    const desc = document.getElementById('addDesc').value.trim();
    const posExtra = document.getElementById('addPos').value.trim();
    const contact = document.getElementById('addContact').value.trim();

    if (!name) return showToast('ช่วยกรอกชื่อบริษัทก่อนนะ', 'error');

    // ค่าตอบแทน
    let pay = addPayType.value;
    if (pay === 'มี') {
        const detail = addPayInput.value.trim();
        pay = detail ? detail : 'มีค่าตอบแทน';
    }

    // ระยะเวลาการรับสมัคร
    const tStart = document.getElementById('addTimeStart').value;
    const isNoDeadline = addNoDeadline.checked;
    const tEnd = isNoDeadline ? '' : addTimeEnd.value;
    const timeStr = isNoDeadline
        ? 'ไม่มีกำหนดปิดรับสมัคร'
        : ((tStart && tEnd) ? `${tStart} ถึง ${tEnd}` : (tEnd ? `ถึง ${tEnd}` : '-'));

    // รวม Tags
    const chosenPositions = addPositionPicker.get();
    const workmodes = [...addWorkmodeEl.querySelectorAll('input:checked')].map(el => el.value);
    const others = [...addOtherEl.querySelectorAll('input:checked')].map(el => el.value);
    if (addPayType.value === 'มี' && !others.includes('มีค่าตอบแทน')) {
        others.push('มีค่าตอบแทน');
    }

    const tags = [...new Set([sector, ...chosenPositions, ...workmodes, ...others])];
    const stations = addStationPicker.get();

    const payload = {
        name,
        sector,
        loc: loc || 'ยังไม่ระบุสถานที่',
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

    btn.disabled = true;
    try {
        const res = await fetch(`${API_URL}/companies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById('addFormCard').classList.add('hidden');
            document.getElementById('addSuccessCard').classList.remove('hidden');
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
});

// ปุ่ม "เพิ่มบริษัทอื่นอีก" หลังส่งสำเร็จ
document.getElementById('btnAddAnother').addEventListener('click', () => {
    document.getElementById('addCompanyForm').reset();
    addPayInput.classList.add('hidden');
    addTimeEnd.disabled = false;
    addPositionPicker.set([]);
    addStationPicker.set([]);

    document.getElementById('addSuccessCard').classList.add('hidden');
    document.getElementById('addFormCard').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});