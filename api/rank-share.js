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
  const path = url.pathname.replace('/api/rank-share', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('rank_share_v1', async () => {
      await query(`CREATE TABLE IF NOT EXISTS rank_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        token VARCHAR(64) UNIQUE NOT NULL,
        blog_post_id UUID NOT NULL,
        title VARCHAR(255),
        created_by VARCHAR(255),
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
    });

    // GET /api/rank-share/list/:blogPostId - 특정 포스트의 공유 링크 목록 (인증 필요)
    if (pathParts[0] === 'list' && pathParts[1] && req.method === 'GET') {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });
      const blogPostId = pathParts[1];
      const result = await query(
        'SELECT * FROM rank_shares WHERE blog_post_id::text = $1 ORDER BY created_at DESC',
        [blogPostId]
      );
      return res.json(result.rows);
    }

    // POST /api/rank-share - 공유 링크 생성 (인증 필요)
    if (req.method === 'POST' && !pathParts[0]) {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });
      const { blog_post_id, title, expires_days } = req.body;
      if (!blog_post_id) return res.status(400).json({ error: 'blog_post_id는 필수입니다.' });

      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = expires_days ? new Date(Date.now() + expires_days * 86400000).toISOString() : null;
      const id = uuidv4();

      await query(
        `INSERT INTO rank_shares (id, token, blog_post_id, title, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, token, blog_post_id, title || '순위추적 공유', user.email || user.name || 'System', expiresAt]
      );

      return res.json({ id, token, title });
    }

    // GET /api/rank-share/:token - 공개 조회 (인증 불필요)
    if (pathParts[0] && pathParts[0] !== 'list' && req.method === 'GET') {
      const token = pathParts[0];
      const shareResult = await query('SELECT * FROM rank_shares WHERE token = $1', [token]);
      if (shareResult.rows.length === 0) return res.status(404).json({ error: '유효하지 않은 링크입니다.' });

      const share = shareResult.rows[0];
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return res.status(410).json({ error: '만료된 링크입니다.' });
      }

      // 블로그 포스트 정보
      const postResult = await query(
        `SELECT bp.*, o.order_number, o.order_date,
          c.name as customer_name, c.company as customer_company,
          s.name as service_name
        FROM blog_posts bp
        LEFT JOIN orders o ON bp.order_id::text = o.id::text
        LEFT JOIN customers c ON bp.customer_id::text = c.id::text
        LEFT JOIN services s ON bp.service_id::text = s.id::text
        WHERE bp.id::text = $1`,
        [share.blog_post_id]
      );
      if (postResult.rows.length === 0) return res.status(404).json({ error: '포스트를 찾을 수 없습니다.' });
      const post = postResult.rows[0];

      // 순위 기록
      const rankResult = await query(
        'SELECT * FROM blog_rank_tracking WHERE blog_post_id::text = $1 ORDER BY track_date ASC',
        [share.blog_post_id]
      );

      return res.json({
        title: share.title,
        created_at: share.created_at,
        post: {
          keyword: post.keyword,
          blog_url: post.blog_url,
          customer_name: post.customer_name,
          customer_company: post.customer_company,
          service_name: post.service_name,
          order_number: post.order_number,
          order_date: post.order_date,
          created_at: post.created_at,
          base_days: post.base_days || 30,
          guarantee_days: post.guarantee_days || 25,
        },
        rank_entries: rankResult.rows.map(r => ({
          track_date: r.track_date,
          rank: r.rank,
        })),
      });
    }

    // DELETE /api/rank-share/:id - 공유 링크 삭제 (인증 필요)
    if (pathParts[0] && req.method === 'DELETE') {
      const user = verifyToken(req);
      if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });
      await query('DELETE FROM rank_shares WHERE id::text = $1', [pathParts[0]]);
      return res.json({ message: '삭제되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Rank share API error:', error);
    return res.status(500).json({ error: '서버 오류: ' + (error.message || '알 수 없는 오류') });
  }
}
