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
  const path = url.pathname.replace('/api/incentives', '');

  // 직원/매니저는 본인 인센티브만 조회
  const isRestricted = user.role === 'manager' || user.role === 'employee';
  const myEmployeeId = user.employee_id || null;
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('incentives', async () => {
      await query(`CREATE TABLE IF NOT EXISTS incentive_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(200) NOT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS order_incentives (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        employee_id UUID NOT NULL,
        policy_id UUID,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        quantity INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP
      )`);
      await query(`ALTER TABLE order_incentives ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS employees (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_number VARCHAR(50), name VARCHAR(255), department VARCHAR(100), position VARCHAR(100), email VARCHAR(255), phone VARCHAR(100), hire_date DATE, salary DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(100), customer_id UUID, assignee_id UUID, total_amount DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'pending', order_date DATE, start_date DATE, due_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, company VARCHAR(255), email VARCHAR(255), phone VARCHAR(100), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
    });

    // ===================== 정책 API =====================

    // GET /api/incentives/policies - 정책 목록
    if (pathParts[0] === 'policies' && !pathParts[1] && req.method === 'GET') {
      const { active_only } = queryParams;
      let whereClause = '';
      if (active_only === 'true') {
        whereClause = ' WHERE is_active = true';
      }
      const result = await query(
        `SELECT * FROM incentive_policies${whereClause} ORDER BY created_at DESC`
      );
      return res.json(result.rows);
    }

    // POST /api/incentives/policies - 정책 생성
    if (pathParts[0] === 'policies' && !pathParts[1] && req.method === 'POST') {
      const { name, amount, description } = req.body;
      if (!name || amount === undefined) {
        return res.status(400).json({ error: '정책명과 금액은 필수입니다.' });
      }
      const id = uuidv4();
      await query(
        'INSERT INTO incentive_policies (id, name, amount, description) VALUES ($1, $2, $3, $4)',
        [id, name, parseFloat(amount) || 0, description || null]
      );
      const result = await query('SELECT * FROM incentive_policies WHERE id::text = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    // PUT /api/incentives/policies/:id - 정책 수정
    if (pathParts[0] === 'policies' && pathParts[1] && req.method === 'PUT') {
      const id = pathParts[1];
      const { name, amount, description, is_active } = req.body;
      const current = await query('SELECT * FROM incentive_policies WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '정책을 찾을 수 없습니다.' });

      await query(
        'UPDATE incentive_policies SET name = $1, amount = $2, description = $3, is_active = $4 WHERE id::text = $5',
        [
          name !== undefined ? name : current.rows[0].name,
          amount !== undefined ? parseFloat(amount) : current.rows[0].amount,
          description !== undefined ? description : current.rows[0].description,
          is_active !== undefined ? is_active : current.rows[0].is_active,
          id
        ]
      );
      const result = await query('SELECT * FROM incentive_policies WHERE id::text = $1', [id]);
      return res.json(result.rows[0]);
    }

    // DELETE /api/incentives/policies/:id - 정책 삭제
    if (pathParts[0] === 'policies' && pathParts[1] && req.method === 'DELETE') {
      const id = pathParts[1];
      await query('DELETE FROM incentive_policies WHERE id::text = $1', [id]);
      return res.json({ message: '정책이 삭제되었습니다.' });
    }

    // ===================== 인센티브 API =====================

    // GET /api/incentives/summary - 직원별 인센티브 집계
    if (pathParts[0] === 'summary' && req.method === 'GET') {
      const summaryParams = [];
      let empFilter = '';
      if (isRestricted && myEmployeeId) {
        empFilter = ' AND e.id::text = $1';
        summaryParams.push(myEmployeeId);
      }

      const result = await query(
        `SELECT
          e.id as employee_id,
          e.name as employee_name,
          e.department,
          e.position,
          COUNT(oi.id) as incentive_count,
          COALESCE(SUM(oi.amount * COALESCE(oi.quantity, 1)), 0) as total_amount,
          COALESCE(SUM(CASE WHEN oi.status = 'paid' THEN oi.amount * COALESCE(oi.quantity, 1) ELSE 0 END), 0) as paid_amount,
          COALESCE(SUM(CASE WHEN oi.status = 'pending' THEN oi.amount * COALESCE(oi.quantity, 1) ELSE 0 END), 0) as pending_amount,
          COUNT(CASE WHEN oi.status = 'paid' THEN 1 END) as paid_count,
          COUNT(CASE WHEN oi.status = 'pending' THEN 1 END) as pending_count
        FROM employees e
        INNER JOIN order_incentives oi ON oi.employee_id::text = e.id::text
        WHERE e.status = 'active'${empFilter}
        GROUP BY e.id, e.name, e.department, e.position
        ORDER BY total_amount DESC`,
        summaryParams
      );

      // 정책별 상세 집계
      const policyDetail = await query(
        `SELECT
          oi.employee_id::text as employee_id,
          COALESCE(ip.name, '미지정') as policy_name,
          SUM(COALESCE(oi.quantity, 1)) as total_quantity,
          COALESCE(SUM(oi.amount * COALESCE(oi.quantity, 1)), 0) as total_amount
        FROM order_incentives oi
        LEFT JOIN incentive_policies ip ON ip.id::text = oi.policy_id::text
        INNER JOIN employees e ON e.id::text = oi.employee_id::text AND e.status = 'active'${empFilter}
        GROUP BY oi.employee_id, ip.name
        ORDER BY total_amount DESC`,
        summaryParams
      );

      // 직원별로 정책 상세 매핑
      const policyMap = {};
      for (const row of policyDetail.rows) {
        if (!policyMap[row.employee_id]) policyMap[row.employee_id] = [];
        policyMap[row.employee_id].push({
          policy_name: row.policy_name,
          total_quantity: Number(row.total_quantity),
          total_amount: Number(row.total_amount)
        });
      }

      const rows = result.rows.map(r => ({
        ...r,
        policy_details: policyMap[r.employee_id] || []
      }));

      return res.json(rows);
    }

    // GET /api/incentives - 인센티브 목록
    if (req.method === 'GET' && !pathParts[0]) {
      const { employee_id, order_id, status } = queryParams;
      let whereClause = '';
      const params = [];
      const conditions = [];
      let paramIdx = 1;

      // 직원/매니저는 본인 인센티브만
      const effectiveEmployeeId = (isRestricted && myEmployeeId) ? myEmployeeId : employee_id;
      if (effectiveEmployeeId) {
        conditions.push(`oi.employee_id::text = $${paramIdx}`);
        params.push(effectiveEmployeeId);
        paramIdx++;
      }
      if (order_id) {
        conditions.push(`oi.order_id::text = $${paramIdx}`);
        params.push(order_id);
        paramIdx++;
      }
      if (status) {
        conditions.push(`oi.status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
      }
      if (conditions.length > 0) {
        whereClause = ' WHERE ' + conditions.join(' AND ');
      }

      const result = await query(
        `SELECT oi.*,
          e.name as employee_name, e.department as employee_department, e.position as employee_position,
          o.order_number, o.total_amount as order_amount, o.order_date, o.status as order_status,
          c.name as customer_name, c.company as customer_company,
          ip.name as policy_name
        FROM order_incentives oi
        LEFT JOIN employees e ON oi.employee_id::text = e.id::text
        LEFT JOIN orders o ON oi.order_id::text = o.id::text
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        LEFT JOIN incentive_policies ip ON oi.policy_id::text = ip.id::text
        ${whereClause}
        ORDER BY oi.created_at DESC`,
        params
      );
      return res.json(result.rows);
    }

    // POST /api/incentives - 인센티브 부여
    if (req.method === 'POST' && !pathParts[0]) {
      const { order_id, employee_id, policy_id, amount, notes } = req.body;
      if (!order_id || !employee_id) {
        return res.status(400).json({ error: '주문과 직원은 필수입니다.' });
      }

      let incentiveAmount = parseFloat(amount) || 0;

      // 정책이 지정된 경우 정책 금액 사용
      if (policy_id && !amount) {
        const policy = await query('SELECT * FROM incentive_policies WHERE id::text = $1', [policy_id]);
        if (policy.rows.length > 0) {
          incentiveAmount = parseFloat(policy.rows[0].amount) || 0;
        }
      }

      const id = uuidv4();
      await query(
        'INSERT INTO order_incentives (id, order_id, employee_id, policy_id, amount, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, order_id, employee_id, policy_id || null, incentiveAmount, notes || null]
      );

      const result = await query(
        `SELECT oi.*,
          e.name as employee_name, e.department as employee_department,
          o.order_number, o.total_amount as order_amount,
          ip.name as policy_name
        FROM order_incentives oi
        LEFT JOIN employees e ON oi.employee_id::text = e.id::text
        LEFT JOIN orders o ON oi.order_id::text = o.id::text
        LEFT JOIN incentive_policies ip ON oi.policy_id::text = ip.id::text
        WHERE oi.id::text = $1`, [id]
      );
      return res.status(201).json(result.rows[0]);
    }

    // PUT /api/incentives/:id - 인센티브 수정
    if (pathParts[0] && !pathParts[1] && pathParts[0] !== 'policies' && pathParts[0] !== 'summary' && pathParts[0] !== 'batch-pay' && req.method === 'PUT') {
      const id = pathParts[0];
      const { amount, status, notes } = req.body;
      const current = await query('SELECT * FROM order_incentives WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '인센티브를 찾을 수 없습니다.' });

      const newStatus = status || current.rows[0].status;
      const paidAt = newStatus === 'paid' && current.rows[0].status !== 'paid'
        ? new Date().toISOString()
        : current.rows[0].paid_at;

      await query(
        'UPDATE order_incentives SET amount = $1, status = $2, notes = $3, paid_at = $4 WHERE id::text = $5',
        [
          amount !== undefined ? parseFloat(amount) : current.rows[0].amount,
          newStatus,
          notes !== undefined ? notes : current.rows[0].notes,
          paidAt,
          id
        ]
      );

      const result = await query(
        `SELECT oi.*,
          e.name as employee_name, e.department as employee_department,
          o.order_number, o.total_amount as order_amount,
          ip.name as policy_name
        FROM order_incentives oi
        LEFT JOIN employees e ON oi.employee_id::text = e.id::text
        LEFT JOIN orders o ON oi.order_id::text = o.id::text
        LEFT JOIN incentive_policies ip ON oi.policy_id::text = ip.id::text
        WHERE oi.id::text = $1`, [id]
      );
      return res.json(result.rows[0]);
    }

    // DELETE /api/incentives/:id - 인센티브 삭제
    if (pathParts[0] && !pathParts[1] && pathParts[0] !== 'policies' && pathParts[0] !== 'summary' && pathParts[0] !== 'batch-pay' && req.method === 'DELETE') {
      const id = pathParts[0];
      await query('DELETE FROM order_incentives WHERE id::text = $1', [id]);
      return res.json({ message: '인센티브가 삭제되었습니다.' });
    }

    // POST /api/incentives/batch-pay - 일괄 지급 처리
    if (pathParts[0] === 'batch-pay' && req.method === 'POST') {
      const { employee_id, ids } = req.body;
      const paidAt = new Date().toISOString();

      if (ids && ids.length > 0) {
        // 특정 인센티브 ID 목록에 대해 일괄 지급
        const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
        await query(
          `UPDATE order_incentives SET status = 'paid', paid_at = $1 WHERE id::text IN (${placeholders}) AND status = 'pending'`,
          [paidAt, ...ids]
        );
      } else if (employee_id) {
        // 특정 직원의 모든 대기 인센티브 일괄 지급
        await query(
          "UPDATE order_incentives SET status = 'paid', paid_at = $1 WHERE employee_id::text = $2 AND status = 'pending'",
          [paidAt, employee_id]
        );
      } else {
        return res.status(400).json({ error: '직원 ID 또는 인센티브 ID 목록이 필요합니다.' });
      }

      return res.json({ message: '일괄 지급 처리되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Incentives error:', error);
    return res.status(500).json({ error: '서버 오류: ' + (error.message || '알 수 없는 오류') });
  }
}
