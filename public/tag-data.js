// tag-data.js — หมวดหมู่ตำแหน่งงาน (ใช้ทั้งหน้าเว็บและ server.js)
// เพิ่ม/แก้ตำแหน่งได้ที่ไฟล์นี้ที่เดียว ทุกหน้าจะอัปเดตตาม
// name = ชื่อเต็มที่เก็บเป็น Tag ในฐานข้อมูล (ถ้าเปลี่ยนชื่อที่มีคนใช้แล้ว ให้เพิ่มใน LEGACY_POSITION_MAP ด้วย)
// th   = ชื่อภาษาไทย (ใช้ค้นหา และขึ้นเป็นคำอธิบายเมื่อเอาเมาส์ชี้)
// keywords = คำที่ใช้จับคู่จากข้อความ "ตำแหน่งงานที่เปิดรับ" (pos) ของบริษัทเก่าที่ยังไม่ได้เลือก Tag
//            คำภาษาอังกฤษต้องตรงทั้งคำ (เช่น 'ai' ไม่จับ 'mail'), คำภาษาไทยจับแบบมีอยู่ในข้อความ

const POSITION_CATEGORIES = [
    {
        id: 'dev', name: 'พัฒนาซอฟต์แวร์', color: '#006C6C',
        items: [
            { name: 'Frontend Developer', th: 'นักพัฒนาหน้าเว็บ', keywords: ['frontend', 'front-end', 'front end', 'react', 'vue', 'angular', 'หน้าเว็บ'] },
            { name: 'Backend Developer', th: 'นักพัฒนาระบบหลังบ้าน', keywords: ['backend', 'back-end', 'back end', 'api', 'node.js', 'nodejs', 'spring', 'django', 'laravel', 'golang', 'หลังบ้าน'] },
            { name: 'Full-stack Developer', th: 'นักพัฒนาเว็บครบวงจร', keywords: ['full stack', 'full-stack', 'fullstack'] },
            { name: 'Web Developer', th: 'นักพัฒนาเว็บไซต์', keywords: ['web developer', 'web development', 'web dev', 'พัฒนาเว็บ', 'เว็บไซต์'] },
            { name: 'Mobile Developer', th: 'นักพัฒนาแอปมือถือ iOS Android', keywords: ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'แอปมือถือ', 'แอปพลิเคชันมือถือ'] },
            { name: 'Software Engineer', th: 'วิศวกรซอฟต์แวร์', keywords: ['software engineer', 'software developer', 'software development', 'programmer', 'โปรแกรมเมอร์', 'นักพัฒนาซอฟต์แวร์'] },
            { name: 'Game Developer', th: 'นักพัฒนาเกม', keywords: ['game', 'unity', 'unreal', 'เกม'] }
        ]
    },
    {
        id: 'data', name: 'ข้อมูลและ AI', color: '#2F62A8',
        items: [
            { name: 'Data Analyst', th: 'นักวิเคราะห์ข้อมูล', keywords: ['data analyst', 'data analysis', 'data analytics', 'วิเคราะห์ข้อมูล'] },
            { name: 'Data Engineer', th: 'วิศวกรข้อมูล', keywords: ['data engineer', 'data engineering', 'etl', 'data pipeline'] },
            { name: 'Data Scientist', th: 'นักวิทยาศาสตร์ข้อมูล', keywords: ['data scientist', 'data science'] },
            { name: 'Machine Learning Engineer', th: 'วิศวกรแมชชีนเลิร์นนิง ML', keywords: ['machine learning', 'ml engineer', 'deep learning', 'mlops'] },
            { name: 'AI Engineer', th: 'วิศวกรปัญญาประดิษฐ์', keywords: ['ai', 'artificial intelligence', 'llm', 'computer vision', 'nlp', 'ปัญญาประดิษฐ์'] },
            { name: 'Business Intelligence (BI) Analyst', th: 'นักวิเคราะห์ข้อมูลธุรกิจ dashboard', keywords: ['business intelligence', 'power bi', 'tableau', 'bi analyst', 'bi developer'] },
            { name: 'Research Assistant', th: 'ผู้ช่วยวิจัย', keywords: ['research', 'researcher', 'ผู้ช่วยวิจัย', 'นักวิจัย'] }
        ]
    },
    {
        id: 'design', name: 'ออกแบบ', color: '#C0622B',
        items: [
            { name: 'UX/UI Designer', th: 'นักออกแบบประสบการณ์ผู้ใช้ หน้าจอ', keywords: ['ux', 'ui', 'ux/ui', 'ui/ux', 'figma', 'user experience', 'user interface'] },
            { name: 'Product Designer', th: 'นักออกแบบผลิตภัณฑ์', keywords: ['product designer', 'product design'] },
            { name: 'Graphic Designer', th: 'นักออกแบบกราฟิก', keywords: ['graphic', 'กราฟิก', 'illustrator', 'photoshop'] },
            { name: 'Motion Designer', th: 'นักออกแบบภาพเคลื่อนไหว วิดีโอ', keywords: ['motion', 'animation', 'animator', 'video editor', 'ตัดต่อ'] }
        ]
    },
    {
        id: 'infra', name: 'ระบบ เครือข่าย และคลาวด์', color: '#4F6475',
        items: [
            { name: 'Network Engineer', th: 'วิศวกรเครือข่าย', keywords: ['network', 'networking', 'cisco', 'ccna', 'เครือข่าย'] },
            { name: 'System Administrator', th: 'ผู้ดูแลระบบ', keywords: ['system administrator', 'system admin', 'sysadmin', 'server admin', 'ผู้ดูแลระบบ'] },
            { name: 'Cloud Engineer', th: 'วิศวกรคลาวด์', keywords: ['cloud', 'aws', 'azure', 'gcp', 'คลาวด์'] },
            { name: 'DevOps Engineer', th: 'ดีฟออปส์ ระบบ deploy', keywords: ['devops', 'ci/cd', 'kubernetes', 'docker', 'sre'] },
            { name: 'Database Administrator', th: 'ผู้ดูแลฐานข้อมูล', keywords: ['database administrator', 'dba', 'database admin', 'ผู้ดูแลฐานข้อมูล'] },
            { name: 'IT Support / Helpdesk', th: 'ฝ่ายสนับสนุนไอที ซัพพอร์ต', keywords: ['it support', 'helpdesk', 'help desk', 'technical support', 'service desk', 'ซัพพอร์ต'] }
        ]
    },
    {
        id: 'security', name: 'ความปลอดภัยไซเบอร์', color: '#B03A5B',
        items: [
            { name: 'Cybersecurity Analyst', th: 'นักวิเคราะห์ความปลอดภัยไซเบอร์', keywords: ['security', 'cybersecurity', 'cyber', 'ความปลอดภัย', 'ไซเบอร์'] },
            { name: 'Penetration Tester', th: 'ผู้ทดสอบเจาะระบบ', keywords: ['penetration', 'pentest', 'pen test', 'pentester', 'ethical hack'] },
            { name: 'SOC Analyst', th: 'ศูนย์เฝ้าระวังภัยไซเบอร์', keywords: ['soc'] }
        ]
    },
    {
        id: 'qa', name: 'ทดสอบซอฟต์แวร์', color: '#6B4FBB',
        items: [
            { name: 'QA Tester', th: 'ผู้ทดสอบซอฟต์แวร์', keywords: ['tester', 'testing', 'qa', 'software test', 'ทดสอบซอฟต์แวร์', 'ทดสอบระบบ'] },
            { name: 'Automation Tester', th: 'ผู้ทดสอบอัตโนมัติ', keywords: ['automation test', 'automated test', 'test automation', 'selenium', 'robot framework', 'cypress'] },
            { name: 'QA Engineer', th: 'วิศวกรประกันคุณภาพซอฟต์แวร์', keywords: ['qa engineer', 'quality assurance'] }
        ]
    },
    {
        id: 'business', name: 'ธุรกิจ ผลิตภัณฑ์ และโปรเจกต์', color: '#8A6D00',
        items: [
            { name: 'Business Analyst', th: 'นักวิเคราะห์ธุรกิจ', keywords: ['business analyst', 'นักวิเคราะห์ธุรกิจ'] },
            { name: 'System Analyst', th: 'นักวิเคราะห์ระบบ', keywords: ['system analyst', 'systems analyst', 'นักวิเคราะห์ระบบ'] },
            { name: 'Product Manager / Product Owner', th: 'ผู้จัดการผลิตภัณฑ์', keywords: ['product manager', 'product owner', 'project manager'] },
            { name: 'Project Coordinator', th: 'ผู้ประสานงานโครงการ', keywords: ['coordinator', 'ประสานงาน'] },
            { name: 'IT Consultant', th: 'ที่ปรึกษาไอที', keywords: ['consultant', 'consulting', 'ที่ปรึกษา'] },
            { name: 'Digital Marketing', th: 'การตลาดดิจิทัล', keywords: ['marketing', 'seo', 'การตลาด'] },
            { name: 'Content Creator', th: 'ผู้สร้างคอนเทนต์', keywords: ['content', 'คอนเทนต์'] }
        ]
    },
    {
        id: 'hardware', name: 'ฮาร์ดแวร์ IoT และหุ่นยนต์', color: '#2E7D5B',
        items: [
            { name: 'Embedded Developer', th: 'นักพัฒนาระบบฝังตัว', keywords: ['embedded', 'firmware', 'microcontroller', 'arduino', 'ระบบฝังตัว'] },
            { name: 'IoT Developer', th: 'นักพัฒนาอุปกรณ์อินเทอร์เน็ตของสรรพสิ่ง', keywords: ['iot', 'internet of things'] },
            { name: 'Robotics Engineer', th: 'วิศวกรหุ่นยนต์ AMR', keywords: ['robot', 'robotics', 'amr', 'ros', 'หุ่นยนต์'] },
            { name: 'Hardware / FPGA Engineer', th: 'วิศวกรฮาร์ดแวร์ วงจร FPGA', keywords: ['fpga', 'hardware', 'vlsi', 'verilog', 'vhdl', 'asic', 'ฮาร์ดแวร์', 'วงจร'] }
        ]
    }
];

// Tag ตำแหน่งชื่อสั้นแบบเก่า → ชื่อเต็มแบบใหม่ (ข้อมูลเก่าจะถูกแปลงให้อัตโนมัติ)
const LEGACY_POSITION_MAP = {
    'Frontend': 'Frontend Developer',
    'Backend': 'Backend Developer',
    'Full-stack': 'Full-stack Developer',
    'Mobile': 'Mobile Developer',
    'Data / AI': 'Data Scientist',
    'UX/UI': 'UX/UI Designer',
    'Network / Infra': 'Network Engineer',
    'Cybersecurity': 'Cybersecurity Analyst',
    'QA / Tester': 'QA Tester',
    'IT Support': 'IT Support / Helpdesk'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { POSITION_CATEGORIES, LEGACY_POSITION_MAP };
}
