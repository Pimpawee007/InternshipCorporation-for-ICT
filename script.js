// Slider functionality
const slider = document.getElementById('slider');
const prevBtn = document.querySelector('.prev-btn');
const nextBtn = document.querySelector('.next-btn');

// Scroll amount based on card width + gap
const scrollAmount = 280; 

nextBtn.addEventListener('click', () => {
    slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
});

prevBtn.addEventListener('click', () => {
    slider.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
});

// Mock data for Modal
const companyData = {
    'company1': {
        name: 'บริษัท โค้ดดิ้ง สเปซ จำกัด',
        sector: 'เอกชน',
        sectorClass: 'private-sector',
        desc: 'พัฒนา Web Application ด้วย React',
        loc: 'พญาไท, กรุงเทพฯ',
        pay: '400 บาท/วัน',
        pos: 'Software Engineer',
        time: 'ม.ค. - พ.ค.'
    },
    'company2': {
        name: 'สำนักงานพัฒนารัฐบาลดิจิทัล',
        sector: 'ภาครัฐ',
        sectorClass: 'gov-sector',
        desc: 'พัฒนาระบบบริการภาครัฐ',
        loc: 'พญาไท, กรุงเทพฯ',
        pay: 'ไม่มีค่าตอบแทน',
        pos: 'IT Support, Developer',
        time: 'ตลอดปี'
    },
    'company3': {
        name: 'บริษัท ดาต้า อนาไลติกส์',
        sector: 'เอกชน',
        sectorClass: 'private-sector',
        desc: 'วิเคราะห์ข้อมูลขนาดใหญ่',
        loc: 'สาทร, กรุงเทพฯ',
        pay: '500 บาท/วัน',
        pos: 'Data Analyst',
        time: 'มิ.ย. - ส.ค.'
    },
    'company4': {
        name: 'กระทรวงดิจิทัลเพื่อเศรษฐกิจฯ',
        sector: 'ภาครัฐ',
        sectorClass: 'gov-sector',
        desc: 'ดูแลนโยบายดิจิทัลของประเทศ',
        loc: 'แจ้งวัฒนะ, กรุงเทพฯ',
        pay: 'เบี้ยเลี้ยงตามระเบียบ',
        pos: 'Policy Analyst',
        time: 'ตามประกาศ'
    },
    'company5': {
        name: 'บริษัท เทค อินโนเวชั่น',
        sector: 'เอกชน',
        sectorClass: 'private-sector',
        desc: 'สร้างนวัตกรรม IoT',
        loc: 'บางนา, กรุงเทพฯ',
        pay: '350 บาท/วัน',
        pos: 'IoT Engineer',
        time: 'ม.ค. - ธ.ค.'
    }
};

// Modal functionality
const modal = document.getElementById('companyModal');

function openModal(companyId) {
    const data = companyData[companyId];
    if (data) {
        document.getElementById('modalCompanyName').textContent = data.name;
        
        const sectorTag = document.getElementById('modalSectorTag');
        sectorTag.textContent = data.sector;
        sectorTag.className = 'sector-tag ' + data.sectorClass;
        
        document.getElementById('modalName').textContent = data.name;
        document.getElementById('modalDesc').textContent = data.desc;
        document.getElementById('modalLoc').textContent = data.loc;
        document.getElementById('modalPay').textContent = data.pay;
        document.getElementById('modalPos').textContent = data.pos;
        document.getElementById('modalTime').textContent = data.time;
        
        modal.style.display = 'flex';
    }
}

function closeModal() {
    modal.style.display = 'none';
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}
