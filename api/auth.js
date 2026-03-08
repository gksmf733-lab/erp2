import { query, ensureTables } from './_lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'erp-secret-key-2024';

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

async function initTables() {
  await ensureTables('auth_v2', async () => {
    // employee_id 컬럼 추가 (기존 users 테이블에)
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(255)`);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  await initTables();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/auth', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    // POST /api/auth/login
    if (path === '/login' && req.method === 'POST') {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
      }

      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      }

      const tokenPayload = { id: user.id, email: user.email, name: user.name, role: user.role, employee_id: user.employee_id || null };
      const token = generateToken(tokenPayload);
      return res.json({ token, user: tokenPayload });
    }

    // GET /api/auth/me
    if (path === '/me' && req.method === 'GET') {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });
      return res.json({ user });
    }

    // ===================== 계정 관리 (관리자 전용) =====================

    // GET /api/auth/users - 계정 목록
    if (pathParts[0] === 'users' && !pathParts[1] && req.method === 'GET') {
      const currentUser = verifyToken(req);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const result = await query(
        `SELECT u.id, u.email, u.name, u.role, u.employee_id, u.created_at,
                e.name as employee_name, e.department, e.position
         FROM users u
         LEFT JOIN employees e ON e.id::text = u.employee_id::text
         ORDER BY u.created_at DESC`
      );
      return res.json(result.rows);
    }

    // POST /api/auth/users - 계정 생성
    if (pathParts[0] === 'users' && !pathParts[1] && req.method === 'POST') {
      const currentUser = verifyToken(req);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const { email, password, name, role, employee_id } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: '이메일, 비밀번호, 이름은 필수입니다.' });
      }

      // 이메일 중복 확인
      const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
      }

      // 직원 연동 중복 확인
      if (employee_id) {
        const linked = await query('SELECT id FROM users WHERE employee_id = $1', [employee_id]);
        if (linked.rows.length > 0) {
          return res.status(400).json({ error: '이미 계정이 연동된 직원입니다.' });
        }
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const validRole = ['admin', 'manager', 'employee'].includes(role) ? role : 'employee';

      await query(
        'INSERT INTO users (id, email, password, name, role, employee_id) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, email, hashedPassword, name, validRole, employee_id || null]
      );

      return res.status(201).json({ id, email, name, role: validRole, employee_id: employee_id || null });
    }

    // PUT /api/auth/users/:id - 계정 수정
    if (pathParts[0] === 'users' && pathParts[1] && req.method === 'PUT') {
      const currentUser = verifyToken(req);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const userId = pathParts[1];
      const { email, password, name, role, employee_id } = req.body;

      // 이메일 중복 확인 (자기 자신 제외)
      if (email) {
        const existing = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
        if (existing.rows.length > 0) {
          return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
        }
      }

      // 직원 연동 중복 확인 (자기 자신 제외)
      if (employee_id) {
        const linked = await query('SELECT id FROM users WHERE employee_id = $1 AND id != $2', [employee_id, userId]);
        if (linked.rows.length > 0) {
          return res.status(400).json({ error: '이미 계정이 연동된 직원입니다.' });
        }
      }

      let updateQuery = 'UPDATE users SET name = $1, email = $2, role = $3, employee_id = $4';
      const validRole = ['admin', 'manager', 'employee'].includes(role) ? role : 'employee';
      const params = [name, email, validRole, employee_id || null];

      if (password) {
        updateQuery += ', password = $5 WHERE id = $6';
        params.push(bcrypt.hashSync(password, 10), userId);
      } else {
        updateQuery += ' WHERE id = $5';
        params.push(userId);
      }

      await query(updateQuery, params);
      return res.json({ success: true });
    }

    // DELETE /api/auth/users/:id - 계정 삭제
    if (pathParts[0] === 'users' && pathParts[1] && req.method === 'DELETE') {
      const currentUser = verifyToken(req);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
      }

      const userId = pathParts[1];

      // 자기 자신은 삭제 불가
      if (currentUser.id === userId) {
        return res.status(400).json({ error: '자기 자신의 계정은 삭제할 수 없습니다.' });
      }

      await query('DELETE FROM users WHERE id = $1', [userId]);
      return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
