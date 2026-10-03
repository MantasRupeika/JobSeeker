const request = require('supertest');
const express = require('express');

jest.mock('../db/database', () => ({
  prepare: jest.fn()
}));

jest.mock('../middleware/auth', () => (req, res, next) => {
  req.user = { id: 1, email: 'test@example.com' };
  next();
});

const db = require('../db/database');
const cvRoutes = require('./cv');

const app = express();
app.use(express.json());
app.use('/api/cv', cvRoutes);

describe('CV API', () => {
  let state;

  beforeEach(() => {
    state = {
      listRows: [],
      getByIdRow: null,
      insertRowId: 1,
      createdRow: null,
      updatedRow: null,
      updateAllowed: true,
      deleteAllowed: true
    };

    db.prepare.mockImplementation((sql) => {
      if (sql.startsWith('INSERT INTO cvs')) {
        return {
          run: jest.fn(() => ({ lastInsertRowid: state.insertRowId }))
        };
      }

      if (sql.startsWith('UPDATE cvs')) {
        return {
          run: jest.fn(() => {
            if (!state.updateAllowed) {
              throw new Error('Update failed');
            }
            return {};
          })
        };
      }

      if (sql.startsWith('DELETE FROM cvs')) {
        return {
          run: jest.fn(() => {
            if (!state.deleteAllowed) {
              throw new Error('Delete failed');
            }
            return {};
          })
        };
      }

      if (sql.startsWith('SELECT id, user_id, name, email, phone, experience, education, skills, file_path, created_at, updated_at')) {
        if (sql.includes('WHERE id = ? AND user_id = ?')) {
          return {
            get: jest.fn((cvId, userId) => {
              if (state.getByIdRow && String(state.getByIdRow.id) === String(cvId) && String(state.getByIdRow.userId) === String(userId)) {
                return {
                  id: state.getByIdRow.id,
                  user_id: state.getByIdRow.userId,
                  name: state.getByIdRow.name,
                  email: state.getByIdRow.email,
                  phone: state.getByIdRow.phone,
                  experience: state.getByIdRow.experience,
                  education: state.getByIdRow.education,
                  skills: state.getByIdRow.skills,
                  file_path: state.getByIdRow.filePath,
                  created_at: state.getByIdRow.createdAt,
                  updated_at: state.getByIdRow.updatedAt
                };
              }

              return null;
            })
          };
        }

        if (sql.includes('WHERE user_id = ?') && sql.includes('ORDER BY')) {
          return {
            all: jest.fn(() => state.listRows)
          };
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists CVs for the authenticated user', async () => {
    state.listRows = [
      {
        id: 1,
        user_id: 1,
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123456789',
        experience: '2 years',
        education: 'BSc Computer Science',
        skills: 'React, Node.js',
        file_path: '/uploads/cv.pdf',
        created_at: '2026-04-03 10:00:00',
        updated_at: '2026-04-03 10:00:00'
      }
    ];

    const response = await request(app).get('/api/cv');

    expect(response.status).toBe(200);
    expect(response.body.cvs).toHaveLength(1);
    expect(response.body.cvs[0]).toMatchObject({
      id: 1,
      userId: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      filePath: '/uploads/cv.pdf'
    });
  });

  it('creates a new CV', async () => {
    state.insertRowId = 7;
    state.getByIdRow = {
      id: 7,
      userId: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+123456789',
      experience: '2 years',
      education: 'BSc Computer Science',
      skills: 'React, Node.js',
      filePath: '/uploads/cv.pdf',
      createdAt: '2026-04-03 10:00:00',
      updatedAt: '2026-04-03 10:00:00'
    };

    const response = await request(app)
      .post('/api/cv')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+123456789',
        experience: '2 years',
        education: 'BSc Computer Science',
        skills: 'React, Node.js',
        filePath: '/uploads/cv.pdf'
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 7,
      userId: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+123456789',
      filePath: '/uploads/cv.pdf'
    });
  });

  it('returns 400 when CV name is missing', async () => {
    const response = await request(app)
      .post('/api/cv')
      .send({
        email: 'jane@example.com'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('name');
  });

  it('returns a CV by id', async () => {
    state.getByIdRow = {
      id: 3,
      userId: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+123456789',
      experience: '2 years',
      education: 'BSc Computer Science',
      skills: 'React, Node.js',
      filePath: '/uploads/cv.pdf',
      createdAt: '2026-04-03 10:00:00',
      updatedAt: '2026-04-03 10:00:00'
    };

    const response = await request(app).get('/api/cv/3');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 3,
      userId: 1,
      name: 'Jane Doe'
    });
  });

  it('returns 404 when CV is not found', async () => {
    const response = await request(app).get('/api/cv/99');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('CV nerastas');
  });

  it('updates an existing CV', async () => {
    state.getByIdRow = {
      id: 4,
      userId: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+123456789',
      experience: '2 years',
      education: 'BSc Computer Science',
      skills: 'React, Node.js',
      filePath: '/uploads/cv.pdf',
      createdAt: '2026-04-03 10:00:00',
      updatedAt: '2026-04-03 10:00:00'
    };

    const updatedRow = {
      id: 4,
      userId: 1,
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+123456789',
      experience: '3 years',
      education: 'BSc Computer Science',
      skills: 'React, Node.js, SQL',
      filePath: '/uploads/updated-cv.pdf',
      createdAt: '2026-04-03 10:00:00',
      updatedAt: '2026-04-03 12:00:00'
    };

    db.prepare.mockImplementation((sql) => {
      if (sql.startsWith('UPDATE cvs')) {
        return { run: jest.fn(() => ({})) };
      }

      if (sql.startsWith('INSERT INTO cvs')) {
        return { run: jest.fn(() => ({ lastInsertRowid: 4 })) };
      }

      if (sql.startsWith('DELETE FROM cvs')) {
        return { run: jest.fn(() => ({})) };
      }

      if (sql.startsWith('SELECT id, user_id, name, email, phone, experience, education, skills, file_path, created_at, updated_at')) {
        if (sql.includes('WHERE id = ? AND user_id = ?')) {
          return {
            get: jest.fn((cvId) => {
              if (String(cvId) === '4') {
                return {
                  id: updatedRow.id,
                  user_id: updatedRow.userId,
                  name: updatedRow.name,
                  email: updatedRow.email,
                  phone: updatedRow.phone,
                  experience: updatedRow.experience,
                  education: updatedRow.education,
                  skills: updatedRow.skills,
                  file_path: updatedRow.filePath,
                  created_at: updatedRow.createdAt,
                  updated_at: updatedRow.updatedAt
                };
              }

              return null;
            })
          };
        }

        if (sql.includes('WHERE user_id = ?') && sql.includes('ORDER BY')) {
          return { all: jest.fn(() => []) };
        }
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await request(app)
      .put('/api/cv/4')
      .send({
        name: 'Jane Smith',
        experience: '3 years',
        skills: 'React, Node.js, SQL',
        filePath: '/uploads/updated-cv.pdf'
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 4,
      userId: 1,
      name: 'Jane Smith',
      experience: '3 years',
      skills: 'React, Node.js, SQL',
      filePath: '/uploads/updated-cv.pdf'
    });
  });

  it('deletes an existing CV', async () => {
    state.getByIdRow = {
      id: 5,
      userId: 1,
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '+123456789',
      experience: '2 years',
      education: 'BSc Computer Science',
      skills: 'React, Node.js',
      filePath: '/uploads/cv.pdf',
      createdAt: '2026-04-03 10:00:00',
      updatedAt: '2026-04-03 10:00:00'
    };

    const response = await request(app).delete('/api/cv/5');

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('CV ištrintas');
  });
});
