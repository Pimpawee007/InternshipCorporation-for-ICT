const API_URL = '/api';
let companyData = [];

async function fetchCompanies() {
    try {
        const response = await fetch(`${API_URL}/companies`);
        companyData = await response.json();
        renderCards(companyData);
    } catch (error) {
        console.error("Error fetching data:", error);
        document.getElementById('sliderGov').innerHTML = '<p>ไม่สามารถโหลดข้อมูลได้</p>';
        document.getElementById('sliderPrivate').innerHTML = '<p>ไม่สามารถโหลดข้อมูลได้</p>';
    }
}

fetchCompanies();

function renderCards(companies) {
    const govContainer = document.getElementById('sliderGov');
    const priContainer = document.getElementById('sliderPrivate');
    
    govContainer.innerHTML = '';
    priContainer.innerHTML = '';
    
    companies.forEach(company => {
        const tagsString = company.tags ? company.tags.join(',') : '';
        const sectorCls = company.sector === 'ภาครัฐ' ? 'gov-sector' : 'private-sector';

        const cardHTML = `
            <div class="slider-card" data-tags="${tagsString}">
                <div class="card-header">
                    <h4 class="company-name">${company.name}</h4>
                    <span class="sector-tag ${sectorCls}">${company.sector}</span>
                </div>
                <div class="card-body">
                    <p class="location">สถานที่ตั้ง: ${company.loc}</p>
                    <button class="btn-readmore" onclick="openDetailsModal('${company.id}')">เพิ่มเติม</button>
                </div>
            </div>
        `;
        
        if (company.sector === 'ภาครัฐ') {
            govContainer.innerHTML += cardHTML;
        } else {
            priContainer.innerHTML += cardHTML;
        }
    });

    if(govContainer.innerHTML === '') govContainer.innerHTML = '<p style="padding:20px; color:#888;">ยังไม่มีข้อมูล</p>';
    if(priContainer.innerHTML === '') priContainer.innerHTML = '<p style="padding:20px; color:#888;">ยังไม่มีข้อมูล</p>';
}

const scrollAmount = 280; 
function slideNext(containerId) {
    document.getElementById(containerId).scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

function openDetailsModal(companyId) {
    const data = companyData.find(c => c.id === companyId);
    if (!data) return;

    document.getElementById('modalCompanyName').textContent = data.name;
    const sectorTag = document.getElementById('modalSectorTag');
    sectorTag.textContent = data.sector;
    sectorTag.className = 'sector-tag ' + (data.sector === 'ภาครัฐ' ? 'gov-sector' : 'private-sector');
    
    document.getElementById('modalDesc').textContent = data.desc || '-';
    document.getElementById('modalLoc').textContent = data.loc || '-';
    document.getElementById('modalPay').textContent = data.pay || '-';
    document.getElementById('modalPos').textContent = data.pos || '-';
    document.getElementById('modalTime').textContent = data.time || '-';
    document.getElementById('modalContact').textContent = data.contact || '-';
    
    document.getElementById('companyModal').style.display = 'flex';
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.getElementById('btnOpenFilter').addEventListener('click', () => openModal('filterModal'));
document.getElementById('btnCancelFilter').addEventListener('click', () => closeModal('filterModal'));

document.getElementById('btnApplyFilter').addEventListener('click', () => {
    const checkedBoxes = document.querySelectorAll('.checkbox-grid input:checked');
    const selectedTags = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedTags.length === 0) {
        renderCards(companyData);
    } else {
        const filtered = companyData.filter(company => {
            if(!company.tags) return false;
            return selectedTags.some(tag => company.tags.includes(tag));
        });
        renderCards(filtered);
    }
    closeModal('filterModal');
});

document.getElementById('btnSearch').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = companyData.filter(c => c.name.toLowerCase().includes(query));
    renderCards(filtered);
});

document.getElementById('btnToggleExtra').addEventListener('click', function() {
    const extraFields = document.getElementById('extraFields');
    if (extraFields.classList.contains('hidden')) {
        extraFields.classList.remove('hidden');
        this.innerHTML = 'v ย่อกลับ';
    } else {
        extraFields.classList.add('hidden');
        this.innerHTML = '&gt; เพิ่มเติม';
    }
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

document.getElementById('addCompanyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmitAdd');
    btnSubmit.textContent = 'กำลังบันทึก...';
    btnSubmit.disabled = true;

    // Time Format
    const tStart = document.getElementById('addTimeStart').value;
    const tEnd = document.getElementById('addTimeEnd').value;
    const timeStr = (tStart && tEnd) ? `${tStart} ถึง ${tEnd}` : '-';

    // Pay Format
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
            alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
            e.target.reset();
            document.getElementById('extraFields').classList.add('hidden');
            document.getElementById('btnToggleExtra').innerHTML = '&gt; เพิ่มเติม';
            fetchCompanies();
        }
    } catch (err) {
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ Server');
        console.error(err);
    } finally {
        btnSubmit.textContent = 'บันทึกข้อมูล';
        btnSubmit.disabled = false;
    }
});

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}