// tag-data.js — หมวดหมู่ตำแหน่งงาน (ใช้ทั้งหน้าเว็บและ server.js)
// เพิ่ม/แก้ตำแหน่งได้ที่ไฟล์นี้ที่เดียว ทุกหน้าจะอัปเดตตาม
// name = ชื่อเต็มที่เก็บเป็น Tag ในฐานข้อมูล (ถ้าเปลี่ยนชื่อที่มีคนใช้แล้ว ให้เพิ่มใน LEGACY_POSITION_MAP ด้วย)
// th   = ชื่อภาษาไทย (ใช้ค้นหา และขึ้นเป็นคำอธิบายเมื่อเอาเมาส์ชี้)

const POSITION_CATEGORIES = [
    {
        id: 'dev', name: 'พัฒนาซอฟต์แวร์', color: '#006C6C',
        items: [
            { name: 'Frontend Developer', th: 'นักพัฒนาหน้าเว็บ' },
            { name: 'Backend Developer', th: 'นักพัฒนาระบบหลังบ้าน' },
            { name: 'Full-stack Developer', th: 'นักพัฒนาเว็บครบวงจร' },
            { name: 'Web Developer', th: 'นักพัฒนาเว็บไซต์' },
            { name: 'Mobile Developer', th: 'นักพัฒนาแอปมือถือ iOS Android' },
            { name: 'Software Engineer', th: 'วิศวกรซอฟต์แวร์' },
            { name: 'Game Developer', th: 'นักพัฒนาเกม' }
        ]
    },
    {
        id: 'data', name: 'ข้อมูลและ AI', color: '#2F62A8',
        items: [
            { name: 'Data Analyst', th: 'นักวิเคราะห์ข้อมูล' },
            { name: 'Data Engineer', th: 'วิศวกรข้อมูล' },
            { name: 'Data Scientist', th: 'นักวิทยาศาสตร์ข้อมูล' },
            { name: 'Machine Learning Engineer', th: 'วิศวกรแมชชีนเลิร์นนิง ML' },
            { name: 'AI Engineer', th: 'วิศวกรปัญญาประดิษฐ์' },
            { name: 'Business Intelligence (BI) Analyst', th: 'นักวิเคราะห์ข้อมูลธุรกิจ dashboard' },
            { name: 'Research Assistant', th: 'ผู้ช่วยวิจัย' }
        ]
    },
    {
        id: 'design', name: 'ออกแบบ', color: '#C0622B',
        items: [
            { name: 'UX/UI Designer', th: 'นักออกแบบประสบการณ์ผู้ใช้ หน้าจอ' },
            { name: 'Product Designer', th: 'นักออกแบบผลิตภัณฑ์' },
            { name: 'Graphic Designer', th: 'นักออกแบบกราฟิก' },
            { name: 'Motion Designer', th: 'นักออกแบบภาพเคลื่อนไหว วิดีโอ' }
        ]
    },
    {
        id: 'infra', name: 'ระบบ เครือข่าย และคลาวด์', color: '#4F6475',
        items: [
            { name: 'Network Engineer', th: 'วิศวกรเครือข่าย' },
            { name: 'System Administrator', th: 'ผู้ดูแลระบบ' },
            { name: 'Cloud Engineer', th: 'วิศวกรคลาวด์' },
            { name: 'DevOps Engineer', th: 'ดีฟออปส์ ระบบ deploy' },
            { name: 'Database Administrator', th: 'ผู้ดูแลฐานข้อมูล' },
            { name: 'IT Support / Helpdesk', th: 'ฝ่ายสนับสนุนไอที ซัพพอร์ต' }
        ]
    },
    {
        id: 'security', name: 'ความปลอดภัยไซเบอร์', color: '#B03A5B',
        items: [
            { name: 'Cybersecurity Analyst', th: 'นักวิเคราะห์ความปลอดภัยไซเบอร์' },
            { name: 'Penetration Tester', th: 'ผู้ทดสอบเจาะระบบ' },
            { name: 'SOC Analyst', th: 'ศูนย์เฝ้าระวังภัยไซเบอร์' }
        ]
    },
    {
        id: 'qa', name: 'ทดสอบซอฟต์แวร์', color: '#6B4FBB',
        items: [
            { name: 'QA Tester', th: 'ผู้ทดสอบซอฟต์แวร์' },
            { name: 'Automation Tester', th: 'ผู้ทดสอบอัตโนมัติ' },
            { name: 'QA Engineer', th: 'วิศวกรประกันคุณภาพซอฟต์แวร์' }
        ]
    },
    {
        id: 'business', name: 'ธุรกิจ ผลิตภัณฑ์ และโปรเจกต์', color: '#8A6D00',
        items: [
            { name: 'Business Analyst', th: 'นักวิเคราะห์ธุรกิจ' },
            { name: 'System Analyst', th: 'นักวิเคราะห์ระบบ' },
            { name: 'Product Manager / Product Owner', th: 'ผู้จัดการผลิตภัณฑ์' },
            { name: 'Project Coordinator', th: 'ผู้ประสานงานโครงการ' },
            { name: 'IT Consultant', th: 'ที่ปรึกษาไอที' },
            { name: 'Digital Marketing', th: 'การตลาดดิจิทัล' },
            { name: 'Content Creator', th: 'ผู้สร้างคอนเทนต์' }
        ]
    },
    {
        id: 'hardware', name: 'ฮาร์ดแวร์ IoT และหุ่นยนต์', color: '#2E7D5B',
        items: [
            { name: 'Embedded Developer', th: 'นักพัฒนาระบบฝังตัว' },
            { name: 'IoT Developer', th: 'นักพัฒนาอุปกรณ์อินเทอร์เน็ตของสรรพสิ่ง' },
            { name: 'Robotics Engineer', th: 'วิศวกรหุ่นยนต์ AMR' },
            { name: 'Hardware / FPGA Engineer', th: 'วิศวกรฮาร์ดแวร์ วงจร FPGA' }
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
