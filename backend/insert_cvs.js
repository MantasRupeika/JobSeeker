const db = require('./db/database');

// Insert sample CVs (assuming user_id 1 exists; adjust if needed)
const cvs = [
  {
    user_id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+370 600 12345',
    experience: '5 years in software development, specializing in Node.js and React.',
    education: 'Bachelor of Computer Science, Vilnius University',
    skills: 'JavaScript, Node.js, React, SQL, Git',
    file_path: null
  },
  {
    user_id: 1,
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    phone: '+370 600 67890',
    experience: '3 years in web development, focus on frontend technologies.',
    education: 'Master of Information Technology, Kaunas University',
    skills: 'HTML, CSS, JavaScript, Vue.js, Python',
    file_path: null
  },
  {
    user_id: 1,
    name: 'Alex Johnson',
    email: 'alex.johnson@example.com',
    phone: '+370 600 54321',
    experience: '7 years in full-stack development, including project management.',
    education: 'PhD in Computer Engineering, Klaipeda University',
    skills: 'Java, Spring, Angular, Docker, AWS',
    file_path: null
  }
];

const insertStmt = db.prepare(`
  INSERT INTO cvs (user_id, name, email, phone, experience, education, skills, file_path)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

cvs.forEach(cv => {
  insertStmt.run(cv.user_id, cv.name, cv.email, cv.phone, cv.experience, cv.education, cv.skills, cv.file_path);
});

console.log('Sample CVs inserted successfully.');