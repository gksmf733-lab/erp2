import { query, ensureTables } from './_lib/db.js';
import { v4 as uuidv4 } from 'uuid';

async function initTables() {
  await ensureTables('inquiries', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS inquiries (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        address TEXT,
        plan VARCHAR(50),
        move_date DATE,
        current_provider VARCHAR(50),
        message TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  await initTables();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/inquiries', '');

  try {
    // POST /api/inquiries - 새 문의 접수
    if (req.method === 'POST' && (!path || path === '/')) {
      const { name, phone, address, plan, moveDate, currentProvider, message } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ error: '이름과 연락처는 필수 입력 항목입니다.' });
      }

      const id = uuidv4();
      await query(
        `INSERT INTO inquiries (id, name, phone, address, plan, move_date, current_provider, message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, name, phone, address || null, plan || null, moveDate || null, currentProvider || null, message || null]
      );

      return res.status(201).json({ id, message: '문의가 접수되었습니다.' });
    }

    // GET /api/inquiries - 문의 목록 조회 (관리자용)
    if (req.method === 'GET' && (!path || path === '/')) {
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = (page - 1) * limit;

      let whereClause = '';
      const params = [];

      if (status) {
        whereClause = 'WHERE status = $1';
        params.push(status);
      }

      const countResult = await query(
        `SELECT COUNT(*) as count FROM inquiries ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await query(
        `SELECT * FROM inquiries ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      return res.json({
        inquiries: result.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }

    // PATCH /api/inquiries/:id - 문의 상태 변경
    if (req.method === 'PATCH' && path.length > 1) {
      const id = path.slice(1);
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: '상태값을 입력해주세요.' });
      }

      const validStatuses = ['pending', 'contacted', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: '유효하지 않은 상태값입니다.' });
      }

      await query('UPDATE inquiries SET status = $1 WHERE id = $2', [status, id]);
      return res.json({ message: '상태가 변경되었습니다.' });
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Inquiries error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
