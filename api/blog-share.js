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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/blog-share', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('blog_share_v1', async () => {
      await query(`CREATE TABLE IF NOT EXISTS blog_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR(64) UNIQUE NOT NULL,
        title VARCHAR(255),
        filter_customer_id UUID,
        filter_status VARCHAR(50),
        filter_order_ids TEXT,
        created_by VARCHAR(255),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS blog_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID, order_item_id UUID, customer_id UUID, service_id UUID,
        title VARCHAR(500), blog_url TEXT, keyword VARCHAR(300),
        publish_status VARCHAR(50) DEFAULT 'pending',
        publish_date DATE, due_date DATE, assigned_to UUID, notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(100), customer_id UUID, assignee_id UUID, total_amount DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'pending', order_date DATE, start_date DATE, due_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255), company VARCHAR(255), email VARCHAR(255), phone VARCHAR(100), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS employees (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255), department VARCHAR(100), position VARCHAR(100), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS services (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255), category VARCHAR(100), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS order_incentives (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, employee_id UUID NOT NULL, policy_id UUID, amount DECIMAL(15,2) DEFAULT 0, quantity INTEGER DEFAULT 1, status VARCHAR(50) DEFAULT 'pending', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), paid_at TIMESTAMP)`);
    });

    // GET /api/blog-share/:token - 공개 조회 (인증 불필요)
    if (pathParts[0] && pathParts[0] !== 'list' && req.method === 'GET') {
      const token = pathParts[0];
      const share = await query('SELECT * FROM blog_shares WHERE token = $1', [token]);
      if (share.rows.length === 0) return res.status(404).json({ error: '유효하지 않은 공유 링크입니다.' });

      const s = share.rows[0];

      // 만료 체크
      if (s.expires_at && new Date(s.expires_at) < new Date()) {
        return res.status(410).json({ error: '공유 링크가 만료되었습니다.' });
      }

      // 필터 조건 구성
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (s.filter_customer_id) {
        conditions.push(`bp.customer_id::text = $${paramIdx}`);
        params.push(s.filter_customer_id);
        paramIdx++;
      }
      if (s.filter_status) {
        conditions.push(`bp.publish_status = $${paramIdx}`);
        params.push(s.filter_status);
        paramIdx++;
      }
      if (s.filter_order_ids) {
        const orderIds = s.filter_order_ids.split(',').filter(Boolean);
        if (orderIds.length > 0) {
          conditions.push(`bp.order_id::text = ANY($${paramIdx})`);
          params.push(orderIds);
          paramIdx++;
        }
      }

      const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

      const result = await query(
        `SELECT bp.id, bp.keyword, bp.blog_url, bp.publish_status, bp.publish_date, bp.due_date,
          o.order_number, o.order_date,
          c.name as customer_name, c.company as customer_company,
          s.name as service_name,
          assignee.name as assignee_name,
          (SELECT string_agg(DISTINCT we.name, ', ')
           FROM order_incentives oi2
           JOIN employees we ON we.id::text = oi2.employee_id::text
           WHERE oi2.order_id::text = bp.order_id::text) as writer_names
        FROM blog_posts bp
        LEFT JOIN orders o ON bp.order_id::text = o.id::text
        LEFT JOIN customers c ON bp.customer_id::text = c.id::text
        LEFT JOIN services s ON bp.service_id::text = s.id::text
        LEFT JOIN employees assignee ON o.assignee_id::text = assignee.id::text
        ${whereClause}
        ORDER BY o.order_number DESC, bp.created_at DESC`,
        params
      );

      // 통계
      const posts = result.rows;
      const stats = {
        total: posts.length,
        pending: posts.filter(p => p.publish_status === 'pending').length,
        writing: posts.filter(p => p.publish_status === 'writing').length,
        published: posts.filter(p => p.publish_status === 'published').length,
        confirmed: posts.filter(p => p.publish_status === 'confirmed').length,
      };

      return res.json({
        title: s.title || '블로그 발행 현황',
        created_at: s.created_at,
        posts,
        stats,
      });
    }

    // 아래부터는 인증 필요
    const user = verifyToken(req);
    if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

    // POST /api/blog-share - 공유 링크 생성
    if (req.method === 'POST' && !pathParts[0]) {
      const { title, filter_customer_id, filter_status, filter_order_ids, expires_days } = req.body;

      const id = uuidv4();
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = expires_days ? new Date(Date.now() + expires_days * 86400000).toISOString() : null;

      await query(
        `INSERT INTO blog_shares (id, token, title, filter_customer_id, filter_status, filter_order_ids, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, token, title || null, filter_customer_id || null, filter_status || null, filter_order_ids || null, user.name || user.email, expiresAt]
      );

      const result = await query('SELECT * FROM blog_shares WHERE id::text = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    // GET /api/blog-share/list - 공유 링크 목록 (관리용)
    if (pathParts[0] === 'list' && req.method === 'GET') {
      const result = await query('SELECT * FROM blog_shares ORDER BY created_at DESC');
      return res.json(result.rows);
    }

    // DELETE /api/blog-share/:id - 공유 링크 삭제
    if (pathParts[0] && req.method === 'DELETE') {
      await query('DELETE FROM blog_shares WHERE id::text = $1', [pathParts[0]]);
      return res.json({ message: '공유 링크가 삭제되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Blog Share API error:', error);
    return res.status(500).json({ error: '서버 오류: ' + (error.message || '알 수 없는 오류') });
  }
}
