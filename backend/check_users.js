const db = require('./db/database');

const users = db.prepare('SELECT id, name, email FROM users').all();

console.log('Existing users:');
users.forEach(user => {
  console.log(`ID: ${user.id}, Name: ${user.name}, Email: ${user.email}`);
});