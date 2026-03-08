import { query } from './_lib/db.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'erp-secret-key-2024';

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const queryParams = Object.fromEntries(url.searchParams);
  const pathParts = url.pathname.replace('/api/employees', '').split('/').filter(Boolean);
  const id = pathParts[0];

  try {
    if (req.method === 'GET' && !id) {
      const { department, search } = queryParams;
      let result;
      if (search && department) {
        result = await query('SELECT * FROM employees WHERE department = $1 AND (name ILIKE $2 OR employee_number ILIKE $2) ORDER BY created_at DESC', [department, '%' + search + '%']);
      } else if (search) {
        result = await query('SELECT * FROM employees WHERE name ILIKE $1 OR employee_number ILIKE $1 ORDER BY created_at DESC', ['%' + search + '%']);
      } else if (department) {
        result = await query('SELECT * FROM employees WHERE department = $1 ORDER BY created_at DESC', [department]);
      } else {
        result = await query('SELECT * FROM employees ORDER BY created_at DESC');
      }
      return res.json(result.rows);
    }

    if (req.method === 'GET' && id) {
      const result = await query('SELECT * FROM employees WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
      return res.json(result.rows[0]);
    }

    // POST /api/employees/bulk-delete - 일괄 삭제
    if (req.method === 'POST' && id === 'bulk-delete') {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '삭제할 직원을 선택해주세요.' });
      }
      let deleted = 0;
      for (const empId of ids) {
        const result = await query('DELETE FROM employees WHERE id::text = $1', [empId]);
        if (result.rowCount > 0) deleted++;
      }
      return res.json({ message: `${deleted}명의 직원이 삭제되었습니다.`, deleted });
    }

    if (req.method === 'POST' && !id) {
      const { employee_number, name, department, position, email, phone, hire_date, salary } = req.body;
      if (!employee_number || !name || !department || !position || !hire_date) {
        return res.status(400).json({ error: '필수 필드를 입력해주세요.' });
      }
      const newId = uuidv4();
      await query('INSERT INTO employees (id, employee_number, name, department, position, email, phone, hire_date, salary) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [newId, employee_number, name, department, position, email || null, phone || null, hire_date, salary || 0]);
      const result = await query('SELECT * FROM employees WHERE id = $1', [newId]);
      return res.status(201).json(result.rows[0]);
    }

    if (req.method === 'PUT' && id) {
      const { name, department, position, email, phone, salary, status } = req.body;
      const current = await query('SELECT * FROM employees WHERE id = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
      const emp = current.rows[0];
      await query('UPDATE employees SET name = $1, department = $2, position = $3, email = $4, phone = $5, salary = $6, status = $7 WHERE id = $8', [name || emp.name, department || emp.department, position || emp.position, email !== undefined ? email : emp.email, phone !== undefined ? phone : emp.phone, salary !== undefined ? salary : emp.salary, status || emp.status, id]);
      const result = await query('SELECT * FROM employees WHERE id = $1', [id]);
      return res.json(result.rows[0]);
    }

    if (req.method === 'DELETE' && id) {
      const result = await query('DELETE FROM employees WHERE id = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
      return res.json({ message: '직원이 삭제되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Employees error:', error);
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return res.status(400).json({ error: '이미 존재하는 사번입니다.' });
    }
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
