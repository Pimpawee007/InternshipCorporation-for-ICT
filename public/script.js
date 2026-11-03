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
        document.getElementById('sliderState').innerHTML = '<p>ไม่สามารถโหลดข้อมูลได้</p>';
    }
}

fetchCompanies();

function renderCards(companies) {
    const govContainer = document.getElementById('sliderGov');
    const priContainer = document.getElementById('sliderPrivate');
    const stateContainer = document.getElementById('sliderState');
    
    govContainer.innerHTML = '';
    priContainer.innerHTML = '';
    stateContainer.innerHTML = '';
    
    companies.forEach(company => {
        const tagsString = company.tags ? company.tags.join(',') : '';
        
        let sectorCls = '';
        if(company.sector === 'ภาครัฐ') sectorCls = 'gov-sector';
        else if(company.sector === 'เอกชน') sectorCls = 'private-sector';
        else if(company.sector === 'รัฐวิสาหกิจ') sectorCls = 'state-sector'; // สีม่วง

        const descHtml = company.desc ? `<p class="card-desc"><strong>คำอธิบาย:</strong> ${company.desc}</p>` : '';

        const cardHTML = `
            <div class="slider-card" data-tags="${tagsString}">
                <div class="card-header">
                    <h4 class="company-name">${company.name}</h4>
                    <span class="sector-tag ${sectorCls}">${company.sector}</span>
                </div>
                <div class="card-body">
                    ${descHtml}
                    <p class="location"><strong>สถานที่ตั้ง:</strong> ${company.loc}</p>
                    <button class="btn-readmore" onclick="openDetailsModal('${company.id}')">เพิ่มเติม</button>
                </div>
            </div>
        `;
        
        if (company.sector === 'ภาครัฐ') {
            govContainer.innerHTML += cardHTML;
        } else if (company.sector === 'เอกชน') {
            priContainer.innerHTML += cardHTML;
        } else if (company.sector === 'รัฐวิสาหกิจ') {
            stateContainer.innerHTML += cardHTML;
        }
    });

    if(govContainer.innerHTML === '') govContainer.innerHTML = '<p style="padding:20px; color:#888;">ยังไม่มีข้อมูล</p>';
    if(priContainer.innerHTML === '') priContainer.innerHTML = '<p style="padding:20px; color:#888;">ยังไม่มีข้อมูล</p>';
    if(stateContainer.innerHTML === '') stateContainer.innerHTML = '<p style="padding:20px; color:#888;">ยังไม่มีข้อมูล</p>';
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
    
    let sectorCls = '';
    if(data.sector === 'ภาครัฐ') sectorCls = 'gov-sector';
    else if(data.sector === 'เอกชน') sectorCls = 'private-sector';
    else if(data.sector === 'รัฐวิสาหกิจ') sectorCls = 'state-sector';
    
    sectorTag.className = 'sector-tag ' + sectorCls;
    
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
    
    document.getElementById('companyModal').style.display = 'flex';
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.getElementById('btnOpenFilter').addEventListener('click', () => openModal('filterModal'));
document.getElementById('btnCancelFilter').addEventListener('click', () => closeModal('filterModal'));

// ตรรกะการกรอง (เจาะจงมากขึ้น)
document.getElementById('btnApplyFilter').addEventListener('click', () => {
    const checkedBoxes = Array.from(document.querySelectorAll('.checkbox-grid input:checked')).map(cb => cb.value);
    
    if (checkedBoxes.length === 0) {
        renderCards(companyData);
        closeModal('filterModal');
        return;
    }

    const sectorKeywords = ['ภาครัฐ', 'เอกชน', 'รัฐวิสาหกิจ'];
    // แยกหมวดหมู่ Sector กับ Tag อื่นๆ
    const selectedSectors = checkedBoxes.filter(val => sectorKeywords.includes(val));
    const selectedOtherTags = checkedBoxes.filter(val => !sectorKeywords.includes(val));

    const filtered = companyData.filter(company => {
        let passSector = true;
        let passOther = true;

        // ถ้ามีการเลือก Sector ต้องตรงกับ Sector ที่เลือกเท่านั้น
        if (selectedSectors.length > 0) {
            passSector = selectedSectors.includes(company.sector);
        }

        // ถ้ามีการเลือก Tag อื่นๆ (เช่น มีค่าตอบแทน, ภาคกลาง) ต้องมี Tag นั้นอย่างน้อย 1 อัน
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
        // การเลือก "ตามแต่ตกลง" ให้นับรวมใน tag มีค่าตอบแทน
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