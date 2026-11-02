// Mock Data with specific tags and images
const companyData = [
    {
        id: 'c1', name: 'สำนักงานพัฒนารัฐบาลดิจิทัล', sector: 'ภาครัฐ', sectorClass: 'gov-sector',
        desc: 'พัฒนาระบบบริการภาครัฐ', loc: 'พญาไท, กรุงเทพฯ', pay: '-',
        pos: 'IT Support, Developer', time: '12/05/2027 - 31/07/2027', contact: 'hr@dga.or.th',
        tags: ['ภาครัฐ', 'ภาคกลาง'], images: [] // ไม่มีภาพ
    },
    {
        id: 'c2', name: 'กระทรวงดิจิทัลเพื่อเศรษฐกิจฯ', sector: 'ภาครัฐ', sectorClass: 'gov-sector',
        desc: '-', loc: 'แจ้งวัฒนะ, กรุงเทพฯ', pay: 'เบี้ยเลี้ยงตามระเบียบ',
        pos: '-', time: '-', contact: 'www.mdes.go.th',
        tags: ['ภาครัฐ', 'ภาคกลาง', 'มีค่าตอบแทน'], images: ['https://via.placeholder.com/400x200.png?text=MDES+Image+1']
    },
    {
        id: 'c3', name: 'บริษัท โค้ดดิ้ง สเปซ จำกัด', sector: 'เอกชน', sectorClass: 'private-sector',
        desc: 'พัฒนา Web Application ด้วย React และ Node.js', loc: 'พญาไท, กรุงเทพฯ', pay: '400 บาท/วัน',
        pos: 'Software Engineer', time: 'ม.ค. - พ.ค.', contact: 'career@codingspace.co.th',
        tags: ['เอกชน', 'ภาคกลาง', 'มีค่าตอบแทน', 'รับฝึกมากกว่า 2 เดือน'], images: ['https://via.placeholder.com/400x200.png?text=Coding+Space+Office']
    },
    {
        id: 'c4', name: 'บริษัท ซอฟต์แวร์ เฮ้าส์ เชียงใหม่', sector: 'เอกชน', sectorClass: 'private-sector',
        desc: 'สร้างระบบสำหรับธุรกิจท้องถิ่น', loc: 'เมือง, เชียงใหม่', pay: 'ตามแต่ตกลง',
        pos: 'Frontend Developer', time: '-', contact: 'jobs@shcm.co.th',
        tags: ['เอกชน', 'ต่างจังหวัด', 'มีค่าตอบแทน'], images: []
    },
    {
        id: 'c5', name: 'Global Tech Tokyo', sector: 'เอกชน', sectorClass: 'private-sector',
        desc: 'Internship in Japan for talented devs', loc: 'Tokyo, Japan', pay: '50,000 JPY/Month',
        pos: 'Fullstack Dev', time: '1/6/2027 - 31/8/2027', contact: 'www.globaltech.jp/career',
        tags: ['เอกชน', 'ต่างประเทศ', 'มีค่าตอบแทน', 'รับฝึกมากกว่า 2 เดือน'], images: []
    }
];

// Initialize Sliders
function renderCards(companies) {
    const govContainer = document.getElementById('sliderGov');
    const priContainer = document.getElementById('sliderPrivate');
    
    govContainer.innerHTML = '';
    priContainer.innerHTML = '';
    
    companies.forEach(company => {
        const cardHTML = `
            <div class="slider-card" data-tags="${company.tags.join(',')}">
                <div class="card-header">
                    <h4 class="company-name">${company.name}</h4>
                    <span class="sector-tag ${company.sectorClass}">${company.sector}</span>
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
}

// Initial render
renderCards(companyData);

// Slider Scroll Logic
const scrollAmount = 280; 
function slideNext(containerId) {
    document.getElementById(containerId).scrollBy({ left: scrollAmount, behavior: 'smooth' });
}

// Modal Functions
function openDetailsModal(companyId) {
    const data = companyData.find(c => c.id === companyId);
    if (!data) return;

    document.getElementById('modalCompanyName').textContent = data.name;
    const sectorTag = document.getElementById('modalSectorTag');
    sectorTag.textContent = data.sector;
    sectorTag.className = 'sector-tag ' + data.sectorClass;
    
    document.getElementById('modalDesc').textContent = data.desc || '-';
    document.getElementById('modalLoc').textContent = data.loc || '-';
    document.getElementById('modalPay').textContent = data.pay || '-';
    document.getElementById('modalPos').textContent = data.pos || '-';
    document.getElementById('modalTime').textContent = data.time || '-';
    document.getElementById('modalContact').textContent = data.contact || '-';
    
    const imgContainer = document.getElementById('modalImageContainer');
    imgContainer.innerHTML = ''; // clear old images
    if (data.images && data.images.length > 0) {
        data.images.forEach(src => {
            const img = document.createElement('img');
            img.src = src;
            imgContainer.appendChild(img);
        });
        imgContainer.style.display = 'flex';
    } else {
        imgContainer.style.display = 'none';
    }
    
    document.getElementById('companyModal').style.display = 'flex';
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Filter Logic
document.getElementById('btnOpenFilter').addEventListener('click', () => openModal('filterModal'));
document.getElementById('btnCancelFilter').addEventListener('click', () => closeModal('filterModal'));

document.getElementById('btnApplyFilter').addEventListener('click', () => {
    // Get checked checkboxes
    const checkedBoxes = document.querySelectorAll('.checkbox-grid input:checked');
    const selectedTags = Array.from(checkedBoxes).map(cb => cb.value);
    
    if (selectedTags.length === 0) {
        // No filter, show all
        renderCards(companyData);
    } else {
        // Filter logic: show if company has AT LEAST ONE of the selected tags
        const filtered = companyData.filter(company => 
            selectedTags.some(tag => company.tags.includes(tag))
        );
        renderCards(filtered);
    }
    closeModal('filterModal');
});

// Search by Text
document.getElementById('btnSearch').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const filtered = companyData.filter(c => c.name.toLowerCase().includes(query));
    renderCards(filtered);
});

// Toggle Add Form Extra Fields
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

// Pay Type Radio Logic
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

// Add Form Submission (Mock)
document.getElementById('addCompanyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('บันทึกข้อมูลเรียบร้อยแล้ว (Mockup)');
    e.target.reset();
    document.getElementById('extraFields').classList.add('hidden');
    document.getElementById('btnToggleExtra').innerHTML = '&gt; เพิ่มเติม';
});

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}