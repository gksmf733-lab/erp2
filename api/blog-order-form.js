import { query, ensureTables } from './_lib/db.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
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

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/blog-order-form', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('blog_order_form_v1', async () => {
      await query(`CREATE TABLE IF NOT EXISTS blog_order_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        token VARCHAR(64) UNIQUE NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        campaign_name VARCHAR(255),
        company_name VARCHAR(255),
        contact_name VARCHAR(255),
        contact_phone VARCHAR(100),
        business_name VARCHAR(255),
        place_url TEXT,
        main_keyword VARCHAR(300),
        hashtags TEXT,
        total_quantity INTEGER,
        daily_quantity INTEGER,
        requested_date DATE,
        highlights TEXT,
        special_requests TEXT,
        submitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
    });

    // POST /api/blog-order-form/:token/submit - 공개 양식 제출 (인증 불필요)
    if (pathParts.length === 2 && pathParts[1] === 'submit' && req.method === 'POST') {
      const token = pathParts[0];
      const form = await query('SELECT * FROM blog_order_forms WHERE token = $1', [token]);
      if (form.rows.length === 0) return res.status(404).json({ error: '유효하지 않은 양식 링크입니다.' });

      const f = form.rows[0];
      if (f.status === 'submitted') {
        return res.status(400).json({ error: '이미 제출된 양식입니다.' });
      }

      const {
        campaign_name, company_name, contact_name, contact_phone,
        business_name, place_url, main_keyword, hashtags,
        total_quantity, daily_quantity, requested_date,
        highlights, special_requests
      } = req.body;

      await query(
        `UPDATE blog_order_forms SET
          campaign_name = $1, company_name = $2, contact_name = $3, contact_phone = $4,
          business_name = $5, place_url = $6, main_keyword = $7, hashtags = $8,
          total_quantity = $9, daily_quantity = $10, requested_date = $11,
          highlights = $12, special_requests = $13,
          status = 'submitted', submitted_at = NOW(), updated_at = NOW()
        WHERE token = $14`,
        [
          campaign_name || null, company_name || null, contact_name || null, contact_phone || null,
          business_name || null, place_url || null, main_keyword || null, hashtags || null,
          total_quantity || null, daily_quantity || null, requested_date || null,
          highlights || null, special_requests || null,
          token
        ]
      );

      const updated = await query('SELECT * FROM blog_order_forms WHERE token = $1', [token]);
      return res.json(updated.rows[0]);
    }

    // GET /api/blog-order-form/:token - 공개 양식 조회 (인증 불필요)
    if (pathParts.length === 1 && pathParts[0] !== 'order' && req.method === 'GET') {
      const token = pathParts[0];
      const form = await query(
        `SELECT bof.*, o.order_number, o.order_date,
          c.name as customer_name, c.company as customer_company
        FROM blog_order_forms bof
        LEFT JOIN orders o ON bof.order_id::text = o.id::text
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        WHERE bof.token = $1`,
        [token]
      );
      if (form.rows.length === 0) return res.status(404).json({ error: '유효하지 않은 양식 링크입니다.' });

      return res.json(form.rows[0]);
    }

    // 아래부터는 인증 필요
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

    // POST /api/blog-order-form - 양식 생성 (주문에 대해, 여러 개 가능)
    if (req.method === 'POST' && pathParts.length === 0) {
      const { order_id } = req.body;
      if (!order_id) return res.status(400).json({ error: 'order_id가 필요합니다.' });

      const id = uuidv4();
      const token = crypto.randomBytes(24).toString('hex');

      await query(
        `INSERT INTO blog_order_forms (id, order_id, token, status) VALUES ($1, $2, $3, 'pending')`,
        [id, order_id, token]
      );

      const result = await query('SELECT * FROM blog_order_forms WHERE id::text = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    // GET /api/blog-order-form/order/:orderId - 주문별 양식 전체 조회 (배열 반환)
    if (pathParts[0] === 'order' && pathParts[1] && req.method === 'GET') {
      const orderId = pathParts[1];
      const result = await query(
        `SELECT bof.*, o.order_number
        FROM blog_order_forms bof
        LEFT JOIN orders o ON bof.order_id::text = o.id::text
        WHERE bof.order_id::text = $1
        ORDER BY bof.created_at DESC`,
        [orderId]
      );
      return res.json(result.rows);
    }

    // DELETE /api/blog-order-form/:id - 양식 삭제
    if (pathParts[0] && req.method === 'DELETE') {
      await query('DELETE FROM blog_order_forms WHERE id::text = $1', [pathParts[0]]);
      return res.json({ message: '양식이 삭제되었습니다.' });
    }

    // PUT /api/blog-order-form/:id/reset - 양식 초기화 (재제출 가능하게)
    if (pathParts.length === 2 && pathParts[1] === 'reset' && req.method === 'PUT') {
      await query(
        `UPDATE blog_order_forms SET status = 'pending', submitted_at = NULL, updated_at = NOW() WHERE id::text = $1`,
        [pathParts[0]]
      );
      const result = await query('SELECT * FROM blog_order_forms WHERE id::text = $1', [pathParts[0]]);
      return res.json(result.rows[0]);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Blog Order Form API error:', error);
    return res.status(500).json({ error: '서버 오류: ' + (error.message || '알 수 없는 오류') });
  }
}
