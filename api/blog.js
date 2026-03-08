import { query, ensureTables } from './_lib/db.js';
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
  const path = url.pathname.replace('/api/blog', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('blog_v5', async () => {
      await query(`CREATE TABLE IF NOT EXISTS blog_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID,
        order_item_id UUID,
        customer_id UUID,
        service_id UUID,
        title VARCHAR(500),
        blog_url TEXT,
        keyword VARCHAR(300),
        publish_status VARCHAR(50) DEFAULT 'pending',
        publish_date DATE,
        due_date DATE,
        assigned_to UUID,
        notes TEXT,
        base_days INTEGER DEFAULT 30,
        guarantee_days INTEGER DEFAULT 25,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(100), customer_id UUID, assignee_id UUID, total_amount DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'pending', order_date DATE, start_date DATE, due_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, company VARCHAR(255), email VARCHAR(255), phone VARCHAR(100), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS employees (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_number VARCHAR(50), name VARCHAR(255), department VARCHAR(100), position VARCHAR(100), email VARCHAR(255), phone VARCHAR(100), hire_date DATE, salary DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS services (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), service_code VARCHAR(50), name VARCHAR(255), category VARCHAR(100), description TEXT, price DECIMAL(15,2) DEFAULT 0, unit VARCHAR(50) DEFAULT '건', duration VARCHAR(100), status VARCHAR(50) DEFAULT 'active', is_blog BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS order_incentives (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, employee_id UUID NOT NULL, policy_id UUID, amount DECIMAL(15,2) NOT NULL DEFAULT 0, quantity INTEGER DEFAULT 1, status VARCHAR(50) DEFAULT 'pending', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), paid_at TIMESTAMP)`);
      await query(`CREATE TABLE IF NOT EXISTS blog_rank_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blog_post_id UUID NOT NULL,
        track_date DATE NOT NULL,
        rank INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_monthly_guarantee BOOLEAN DEFAULT false`).catch(() => {});
      await query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS base_days INTEGER DEFAULT 30`).catch(() => {});
      await query(`ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS guarantee_days INTEGER DEFAULT 25`).catch(() => {});
    });

    // GET /api/blog/stats - 통계
    if (pathParts[0] === 'stats' && req.method === 'GET') {
      const result = await query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN publish_status = 'pending' THEN 1 END) as pending_count,
          COUNT(CASE WHEN publish_status = 'writing' THEN 1 END) as writing_count,
          COUNT(CASE WHEN publish_status = 'published' THEN 1 END) as published_count,
          COUNT(CASE WHEN publish_status = 'confirmed' THEN 1 END) as confirmed_count
        FROM blog_posts
      `);
      return res.json(result.rows[0]);
    }

    // GET /api/blog - 목록 조회
    if (req.method === 'GET' && !pathParts[0]) {
      const { publish_status, customer_id, assigned_to, from_date, to_date, search } = queryParams;
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (publish_status) {
        conditions.push(`bp.publish_status = $${paramIdx}`);
        params.push(publish_status);
        paramIdx++;
      }
      if (customer_id) {
        conditions.push(`bp.customer_id::text = $${paramIdx}`);
        params.push(customer_id);
        paramIdx++;
      }
      if (assigned_to) {
        conditions.push(`bp.assigned_to::text = $${paramIdx}`);
        params.push(assigned_to);
        paramIdx++;
      }
      if (from_date) {
        conditions.push(`bp.created_at::date >= $${paramIdx}::date`);
        params.push(from_date);
        paramIdx++;
      }
      if (to_date) {
        conditions.push(`bp.created_at::date <= $${paramIdx}::date`);
        params.push(to_date);
        paramIdx++;
      }
      if (search) {
        conditions.push(`(bp.title ILIKE $${paramIdx} OR bp.keyword ILIKE $${paramIdx} OR bp.blog_url ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx} OR c.company ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

      const result = await query(
        `SELECT bp.*,
          o.order_number, o.order_date, o.status as order_status,
          c.name as customer_name, c.company as customer_company,
          s.name as service_name, s.category as service_category,
          e.name as assigned_name,
          assignee.name as assignee_name,
          (SELECT string_agg(DISTINCT we.name, ', ')
           FROM order_incentives oi2
           JOIN employees we ON we.id::text = oi2.employee_id::text
           WHERE oi2.order_id::text = bp.order_id::text) as writer_names
        FROM blog_posts bp
        LEFT JOIN orders o ON bp.order_id::text = o.id::text
        LEFT JOIN customers c ON bp.customer_id::text = c.id::text
        LEFT JOIN services s ON bp.service_id::text = s.id::text
        LEFT JOIN employees e ON bp.assigned_to::text = e.id::text
        LEFT JOIN employees assignee ON o.assignee_id::text = assignee.id::text
        ${whereClause}
        ORDER BY bp.created_at DESC`,
        params
      );
      return res.json(result.rows);
    }

    // GET /api/blog/:id - 상세 조회
    if (pathParts[0] && !pathParts[1] && pathParts[0] !== 'stats' && pathParts[0] !== 'monthly-posts' && pathParts[0] !== 'rank-tracking' && req.method === 'GET') {
      const id = pathParts[0];
      const result = await query(
        `SELECT bp.*,
          o.order_number, o.order_date, o.status as order_status,
          c.name as customer_name, c.company as customer_company,
          s.name as service_name, s.category as service_category,
          e.name as assigned_name,
          assignee.name as assignee_name,
          (SELECT string_agg(DISTINCT we.name, ', ')
           FROM order_incentives oi2
           JOIN employees we ON we.id::text = oi2.employee_id::text
           WHERE oi2.order_id::text = bp.order_id::text) as writer_names
        FROM blog_posts bp
        LEFT JOIN orders o ON bp.order_id::text = o.id::text
        LEFT JOIN customers c ON bp.customer_id::text = c.id::text
        LEFT JOIN services s ON bp.service_id::text = s.id::text
        LEFT JOIN employees e ON bp.assigned_to::text = e.id::text
        LEFT JOIN employees assignee ON o.assignee_id::text = assignee.id::text
        WHERE bp.id::text = $1`, [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: '블로그 포스트를 찾을 수 없습니다.' });
      return res.json(result.rows[0]);
    }

    // POST /api/blog - 수동 생성
    if (req.method === 'POST' && !pathParts[0]) {
      const { order_id, customer_id, service_id, title, blog_url, keyword, publish_status, publish_date, due_date, assigned_to, notes } = req.body;
      const id = uuidv4();
      await query(
        `INSERT INTO blog_posts (id, order_id, customer_id, service_id, title, blog_url, keyword, publish_status, publish_date, due_date, assigned_to, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, order_id || null, customer_id || null, service_id || null, title || null, blog_url || null, keyword || null, publish_status || 'pending', publish_date || null, due_date || null, assigned_to || null, notes || null]
      );
      const result = await query(
        `SELECT bp.*,
          o.order_number, o.order_date, c.name as customer_name, c.company as customer_company,
          s.name as service_name, e.name as assigned_name,
          assignee.name as assignee_name,
          (SELECT string_agg(DISTINCT we.name, ', ')
           FROM order_incentives oi2
           JOIN employees we ON we.id::text = oi2.employee_id::text
           WHERE oi2.order_id::text = bp.order_id::text) as writer_names
        FROM blog_posts bp
        LEFT JOIN orders o ON bp.order_id::text = o.id::text
        LEFT JOIN customers c ON bp.customer_id::text = c.id::text
        LEFT JOIN services s ON bp.service_id::text = s.id::text
        LEFT JOIN employees e ON bp.assigned_to::text = e.id::text
        LEFT JOIN employees assignee ON o.assignee_id::text = assignee.id::text
        WHERE bp.id::text = $1`, [id]
      );
      return res.status(201).json(result.rows[0]);
    }

    // POST /api/blog/bulk - 일괄 생성
    if (req.method === 'POST' && pathParts[0] === 'bulk') {
      const { items, customer_id, assigned_to, publish_status, due_date } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '등록할 항목이 없습니다.' });
      }
      const results = [];
      for (const item of items) {
        const id = uuidv4();
        await query(
          `INSERT INTO blog_posts (id, order_id, customer_id, service_id, title, blog_url, keyword, publish_status, publish_date, due_date, assigned_to, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [id, item.order_id || null, item.customer_id || customer_id || null, item.service_id || null, item.title || null, item.blog_url || null, item.keyword || null, item.publish_status || publish_status || 'pending', item.publish_date || null, item.due_date || due_date || null, item.assigned_to || assigned_to || null, item.notes || null]
        );
        results.push(id);
      }
      return res.status(201).json({ message: `${results.length}건이 등록되었습니다.`, count: results.length });
    }

    // PUT /api/blog/bulk - 일괄 수정
    if (req.method === 'PUT' && pathParts[0] === 'bulk') {
      const { ids, updates } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '수정할 항목이 없습니다.' });
      }
      const fields = [];
      const params = [];
      let paramIdx = 1;
      if (updates.keyword !== undefined) { fields.push(`keyword = $${paramIdx}`); params.push(updates.keyword); paramIdx++; }
      if (updates.blog_url !== undefined) { fields.push(`blog_url = $${paramIdx}`); params.push(updates.blog_url); paramIdx++; }
      if (updates.publish_status !== undefined) { fields.push(`publish_status = $${paramIdx}`); params.push(updates.publish_status); paramIdx++; }
      if (updates.publish_date !== undefined) { fields.push(`publish_date = $${paramIdx}`); params.push(updates.publish_date || null); paramIdx++; }
      if (updates.due_date !== undefined) { fields.push(`due_date = $${paramIdx}`); params.push(updates.due_date || null); paramIdx++; }
      if (updates.assigned_to !== undefined) { fields.push(`assigned_to = $${paramIdx}`); params.push(updates.assigned_to || null); paramIdx++; }
      if (updates.notes !== undefined) { fields.push(`notes = $${paramIdx}`); params.push(updates.notes); paramIdx++; }
      if (fields.length === 0) {
        return res.status(400).json({ error: '수정할 필드가 없습니다.' });
      }
      fields.push('updated_at = NOW()');
      const placeholders = ids.map((_, i) => `$${paramIdx + i}`);
      params.push(...ids);
      await query(
        `UPDATE blog_posts SET ${fields.join(', ')} WHERE id::text IN (${placeholders.join(', ')})`,
        params
      );
      return res.json({ message: `${ids.length}건이 수정되었습니다.`, count: ids.length });
    }

    // PUT /api/blog/bulk-each - 개별 항목별 일괄 수정 (키워드/URL 등 각각 다른 값)
    if (req.method === 'PUT' && pathParts[0] === 'bulk-each') {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: '수정할 항목이 없습니다.' });
      }
      let count = 0;
      for (const item of items) {
        if (!item.id) continue;
        const fields = [];
        const params = [];
        let paramIdx = 1;
        if (item.keyword !== undefined) { fields.push(`keyword = $${paramIdx}`); params.push(item.keyword); paramIdx++; }
        if (item.blog_url !== undefined) { fields.push(`blog_url = $${paramIdx}`); params.push(item.blog_url); paramIdx++; }
        if (item.publish_status !== undefined) { fields.push(`publish_status = $${paramIdx}`); params.push(item.publish_status); paramIdx++; }
        if (item.publish_date !== undefined) { fields.push(`publish_date = $${paramIdx}`); params.push(item.publish_date || null); paramIdx++; }
        if (item.notes !== undefined) { fields.push(`notes = $${paramIdx}`); params.push(item.notes); paramIdx++; }
        if (fields.length === 0) continue;
        fields.push('updated_at = NOW()');
        params.push(item.id);
        await query(`UPDATE blog_posts SET ${fields.join(', ')} WHERE id::text = $${paramIdx}`, params);
        count++;
      }
      return res.json({ message: `${count}건이 수정되었습니다.`, count });
    }

    // PUT /api/blog/:id - 수정
    if (pathParts[0] && !pathParts[1] && pathParts[0] !== 'stats' && pathParts[0] !== 'guarantee-settings' && req.method === 'PUT') {
      const id = pathParts[0];
      const current = await query('SELECT * FROM blog_posts WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '블로그 포스트를 찾을 수 없습니다.' });
      const c = current.rows[0];

      const { title, blog_url, keyword, publish_status, publish_date, due_date, assigned_to, notes } = req.body;

      // 상태가 published로 변경되면 publish_date 자동 설정
      let finalPublishDate = publish_date !== undefined ? publish_date : c.publish_date;
      if (publish_status === 'published' && c.publish_status !== 'published' && !finalPublishDate) {
        finalPublishDate = new Date().toISOString().split('T')[0];
      }

      await query(
        `UPDATE blog_posts SET
          title = $1, blog_url = $2, keyword = $3, publish_status = $4,
          publish_date = $5, due_date = $6, assigned_to = $7, notes = $8,
          updated_at = NOW()
        WHERE id::text = $9`,
        [
          title !== undefined ? title : c.title,
          blog_url !== undefined ? blog_url : c.blog_url,
          keyword !== undefined ? keyword : c.keyword,
          publish_status || c.publish_status,
          finalPublishDate,
          due_date !== undefined ? (due_date || null) : c.due_date,
          assigned_to !== undefined ? (assigned_to || null) : c.assigned_to,
          notes !== undefined ? notes : c.notes,
          id
        ]
      );

      const result = await query(
        `SELECT bp.*,
          o.order_number, o.order_date, o.status as order_status,
          c.name as customer_name, c.company as customer_company,
          s.name as service_name, e.name as assigned_name
        FROM blog_posts bp
        LEFT JOIN orders o ON bp.order_id::text = o.id::text
        LEFT JOIN customers c ON bp.customer_id::text = c.id::text
        LEFT JOIN services s ON bp.service_id::text = s.id::text
        LEFT JOIN employees e ON bp.assigned_to::text = e.id::text
        WHERE bp.id::text = $1`, [id]
      );
      return res.json(result.rows[0]);
    }

    // DELETE /api/blog/:id - 삭제
    if (pathParts[0] && !pathParts[1] && pathParts[0] !== 'stats' && pathParts[0] !== 'rank-tracking' && pathParts[0] !== 'monthly-posts' && req.method === 'DELETE') {
      const id = pathParts[0];
      await query('DELETE FROM blog_posts WHERE id::text = $1', [id]);
      return res.json({ message: '블로그 포스트가 삭제되었습니다.' });
    }

    // ===== 월보장 순위추적 API =====

    // GET /api/blog/monthly-posts - 월보장 상품 블로그 포스트 목록
    if (pathParts[0] === 'monthly-posts' && req.method === 'GET') {
      const result = await query(
        `SELECT bp.*, o.order_number, o.order_date, o.status as order_status,
          c.name as customer_name, c.company as customer_company,
          s.name as service_name, s.category as service_category,
          e.name as assignee_name,
          (SELECT string_agg(DISTINCT emp.name, ', ') FROM order_incentives oi JOIN employees emp ON oi.employee_id::text = emp.id::text WHERE oi.order_id::text = bp.order_id::text) as writer_names
        FROM blog_posts bp
        LEFT JOIN orders o ON bp.order_id::text = o.id::text
        LEFT JOIN customers c ON bp.customer_id::text = c.id::text
        LEFT JOIN services s ON bp.service_id::text = s.id::text
        LEFT JOIN employees e ON o.assignee_id::text = e.id::text
        WHERE s.is_monthly_guarantee = true
        ORDER BY bp.created_at DESC`
      );
      return res.json(result.rows);
    }

    // GET /api/blog/rank-tracking/:blogPostId - 순위 기록 조회
    if (pathParts[0] === 'rank-tracking' && pathParts[1] && req.method === 'GET') {
      const blogPostId = pathParts[1];
      const result = await query(
        `SELECT * FROM blog_rank_tracking WHERE blog_post_id::text = $1 ORDER BY track_date ASC`,
        [blogPostId]
      );
      return res.json(result.rows);
    }

    // POST /api/blog/rank-tracking - 순위 기록 저장 (upsert 방식)
    if (pathParts[0] === 'rank-tracking' && req.method === 'POST') {
      const { blog_post_id, entries } = req.body;
      if (!blog_post_id || !entries || !Array.isArray(entries)) {
        return res.status(400).json({ error: 'blog_post_id와 entries 배열이 필요합니다.' });
      }

      for (const entry of entries) {
        if (!entry.track_date) continue;
        const existing = await query(
          'SELECT id FROM blog_rank_tracking WHERE blog_post_id::text = $1 AND track_date = $2',
          [blog_post_id, entry.track_date]
        );
        if (entry.rank === null || entry.rank === '' || entry.rank === undefined) {
          // 빈 값이면 삭제
          if (existing.rows.length > 0) {
            await query('DELETE FROM blog_rank_tracking WHERE id::text = $1', [existing.rows[0].id]);
          }
        } else if (existing.rows.length > 0) {
          await query(
            'UPDATE blog_rank_tracking SET rank = $1 WHERE id::text = $2',
            [entry.rank, existing.rows[0].id]
          );
        } else {
          const id = uuidv4();
          await query(
            'INSERT INTO blog_rank_tracking (id, blog_post_id, track_date, rank) VALUES ($1, $2, $3, $4)',
            [id, blog_post_id, entry.track_date, entry.rank]
          );
        }
      }

      const result = await query(
        'SELECT * FROM blog_rank_tracking WHERE blog_post_id::text = $1 ORDER BY track_date ASC',
        [blog_post_id]
      );
      return res.json(result.rows);
    }

    // DELETE /api/blog/rank-tracking/:id - 순위 기록 삭제
    if (pathParts[0] === 'rank-tracking' && pathParts[1] && req.method === 'DELETE') {
      await query('DELETE FROM blog_rank_tracking WHERE id::text = $1', [pathParts[1]]);
      return res.json({ message: '삭제되었습니다.' });
    }

    // PUT /api/blog/guarantee-settings/:blogPostId - 기준일수/보장일수 저장
    if (pathParts[0] === 'guarantee-settings' && pathParts[1] && req.method === 'PUT') {
      const blogPostId = pathParts[1];
      const { base_days, guarantee_days } = req.body;
      await query(
        'UPDATE blog_posts SET base_days = $1, guarantee_days = $2, updated_at = NOW() WHERE id::text = $3',
        [base_days || 30, guarantee_days || 25, blogPostId]
      );
      return res.json({ message: '저장되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Blog API error:', error);
    return res.status(500).json({ error: '서버 오류: ' + (error.message || '알 수 없는 오류') });
  }
}
