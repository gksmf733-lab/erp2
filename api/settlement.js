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
  const path = url.pathname.replace('/api/settlement', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('settlement_v3', async () => {
      await query(`CREATE TABLE IF NOT EXISTS employees (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_number VARCHAR(50), name VARCHAR(255), department VARCHAR(100), position VARCHAR(100), email VARCHAR(255), phone VARCHAR(100), hire_date DATE, salary DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(100), customer_id UUID, assignee_id UUID, total_amount DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'pending', order_date DATE, start_date DATE, due_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, company VARCHAR(255), email VARCHAR(255), phone VARCHAR(100), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      // 정산에서 참조하는 필수 테이블들
      await query(`CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type VARCHAR(50) NOT NULL, category VARCHAR(100) NOT NULL, amount DECIMAL(15,2) DEFAULT 0, description TEXT, date DATE, reference_id VARCHAR(255), reference_type VARCHAR(50), created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255)`).catch(() => {});
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS vendors (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, contact_name VARCHAR(255), phone VARCHAR(100), email VARCHAR(255), address TEXT, business_number VARCHAR(50), status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS vendor_products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id UUID, product_name VARCHAR(255), cost_price DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID, item_id UUID, item_name VARCHAR(255), quantity INTEGER DEFAULT 1, unit_price DECIMAL(15,2) DEFAULT 0, total_price DECIMAL(15,2) DEFAULT 0, item_type VARCHAR(20) DEFAULT 'normal', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'normal'`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS order_vendor_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, vendor_id UUID NOT NULL, vendor_product_id UUID NOT NULL, quantity INTEGER DEFAULT 1, unit_price DECIMAL(15,2) DEFAULT 0, total_price DECIMAL(15,2) DEFAULT 0, item_type VARCHAR(20) DEFAULT 'normal', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE order_vendor_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'normal'`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS order_incentives (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, employee_id UUID NOT NULL, policy_id UUID, amount DECIMAL(15,2) NOT NULL DEFAULT 0, quantity INTEGER DEFAULT 1, status VARCHAR(50) DEFAULT 'pending', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), paid_at TIMESTAMP)`);
      await query(`ALTER TABLE order_incentives ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS incentive_policies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(200) NOT NULL, amount DECIMAL(15,2) NOT NULL DEFAULT 0, description TEXT, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS settlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        assignee_id UUID NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_sales DECIMAL(15,2) DEFAULT 0,
        total_expenses DECIMAL(15,2) DEFAULT 0,
        commission_rate DECIMAL(5,2) DEFAULT 0,
        commission_amount DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        settled_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      // total_expenses 컬럼 추가 (기존 테이블 대응)
      await query(`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS total_expenses DECIMAL(15,2) DEFAULT 0`);
      // orders 테이블에 settlement_status 필드 추가 (개별 주문 정산 상태)
      await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50) DEFAULT 'pending'`);
      await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_date DATE`);
      // orders 테이블에 settlement_id 추가 (정산 레코드와 연결)
      await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS settlement_id UUID`);
      await query(`CREATE TABLE IF NOT EXISTS vendor_settlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        total_amount DECIMAL(15,2) DEFAULT 0,
        total_refund DECIMAL(15,2) DEFAULT 0,
        net_amount DECIMAL(15,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        settled_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
    });

    // 매니저인 경우 본인 employee_id만 조회 가능
    const isManager = user.role === 'manager';
    const myEmployeeId = user.employee_id || null;

    // GET /api/settlement/summary - 영업담당자별 요약 (정산예정/정산확정 분리)
    if (path === '/summary' && req.method === 'GET') {
      const { period_start, period_end } = queryParams;
      let dateFilter = '';
      const params = [];
      let paramIdx = 1;
      if (period_start && period_end) {
        dateFilter = ` AND o.order_date >= $${paramIdx} AND o.order_date <= $${paramIdx + 1}`;
        params.push(period_start, period_end);
        paramIdx += 2;
      }
      let managerFilter = '';
      if (isManager && myEmployeeId) {
        managerFilter = ` AND e.id::text = $${paramIdx}`;
        params.push(myEmployeeId);
      }

      const result = await query(
        `SELECT
          e.id as assignee_id,
          e.name as assignee_name,
          e.department,
          e.position,
          COUNT(DISTINCT o.id) as order_count,
          COALESCE(SUM(DISTINCT o.total_amount), 0) as total_sales,
          COALESCE(SUM(CASE WHEN o.due_date IS NULL OR o.due_date >= CURRENT_DATE THEN o.total_amount ELSE 0 END), 0) as expected_sales,
          COALESCE(SUM(CASE WHEN o.due_date IS NOT NULL AND o.due_date < CURRENT_DATE THEN o.total_amount ELSE 0 END), 0) as confirmed_sales,
          COUNT(DISTINCT CASE WHEN o.due_date IS NULL OR o.due_date >= CURRENT_DATE THEN o.id END) as expected_count,
          COUNT(DISTINCT CASE WHEN o.due_date IS NOT NULL AND o.due_date < CURRENT_DATE THEN o.id END) as confirmed_count,
          COALESCE(SUM(vt.vendor_net), 0) as vendor_expenses,
          COALESCE(SUM(inc.incentive_total), 0) as incentive_expenses,
          COALESCE(SUM(vt.vendor_net), 0) + COALESCE(SUM(inc.incentive_total), 0) as total_expenses,
          COALESCE(SUM(CASE WHEN o.due_date IS NULL OR o.due_date >= CURRENT_DATE THEN COALESCE(vt.vendor_net, 0) + COALESCE(inc.incentive_total, 0) ELSE 0 END), 0) as expected_expenses,
          COALESCE(SUM(CASE WHEN o.due_date IS NOT NULL AND o.due_date < CURRENT_DATE THEN COALESCE(vt.vendor_net, 0) + COALESCE(inc.incentive_total, 0) ELSE 0 END), 0) as confirmed_expenses
        FROM employees e
        LEFT JOIN orders o ON o.assignee_id::text = e.id::text${dateFilter}
        LEFT JOIN (
          SELECT reference_id,
            SUM(CASE WHEN reference_type = 'order_vendor' THEN amount ELSE 0 END) -
            SUM(CASE WHEN reference_type = 'order_vendor_refund' THEN amount ELSE 0 END) as vendor_net
          FROM transactions
          WHERE reference_type IN ('order_vendor', 'order_vendor_refund')
          GROUP BY reference_id
        ) vt ON vt.reference_id::text = o.id::text
        LEFT JOIN (
          SELECT order_id,
            SUM(amount * COALESCE(quantity, 1)) as incentive_total
          FROM order_incentives
          GROUP BY order_id
        ) inc ON inc.order_id::text = o.id::text
        WHERE e.status = 'active'
          AND EXISTS (SELECT 1 FROM orders o2 WHERE o2.assignee_id::text = e.id::text)${managerFilter}
        GROUP BY e.id, e.name, e.department, e.position
        ORDER BY total_sales DESC`,
        params
      );
      return res.json(result.rows);
    }

    // GET /api/settlement/orders - 전체 주문 목록 (담당자 정보 포함)
    if (pathParts[0] === 'orders' && !pathParts[1] && req.method === 'GET') {
      const { period_start, period_end, assignee_id } = queryParams;
      let dateFilter = '';
      const params = [];
      let paramIdx = 1;
      if (period_start && period_end) {
        dateFilter = ` AND o.order_date >= $${paramIdx} AND o.order_date <= $${paramIdx + 1}`;
        params.push(period_start, period_end);
        paramIdx += 2;
      }
      let assigneeFilter = '';
      if (isManager && myEmployeeId) {
        assigneeFilter = ` AND o.assignee_id::text = $${paramIdx}`;
        params.push(myEmployeeId);
        paramIdx++;
      } else if (assignee_id) {
        assigneeFilter = ` AND o.assignee_id::text = $${paramIdx}`;
        params.push(assignee_id);
        paramIdx++;
      }

      const result = await query(
        `SELECT o.*, c.name as customer_name, c.company as customer_company,
          e.name as assignee_name, e.department as assignee_department,
          CASE WHEN o.due_date IS NOT NULL AND o.due_date < CURRENT_DATE THEN 'confirmed' ELSE 'expected' END as settlement_type,
          COALESCE(o.settlement_status, 'pending') as settlement_status,
          o.settled_date,
          COALESCE((SELECT SUM(CASE WHEN t.reference_type = 'order_vendor' THEN t.amount WHEN t.reference_type = 'order_vendor_refund' THEN -t.amount ELSE 0 END) FROM transactions t WHERE t.reference_type IN ('order_vendor', 'order_vendor_refund') AND t.reference_id::text = o.id::text), 0) as vendor_expense,
          COALESCE((SELECT SUM(oi2.amount * COALESCE(oi2.quantity, 1)) FROM order_incentives oi2 WHERE oi2.order_id::text = o.id::text), 0) as incentive_expense,
          (SELECT json_agg(json_build_object('vendor_name', v.name, 'product_name', vp.product_name, 'unit_price', ovi.unit_price, 'quantity', ovi.quantity, 'item_type', COALESCE(ovi.item_type, 'normal')))
            FROM order_vendor_items ovi
            LEFT JOIN vendors v ON ovi.vendor_id::text = v.id::text
            LEFT JOIN vendor_products vp ON ovi.vendor_product_id::text = vp.id::text
            WHERE ovi.order_id::text = o.id::text) as vendor_items,
          (SELECT json_agg(json_build_object('item_name', oi.item_name, 'unit_price', oi.unit_price, 'quantity', oi.quantity, 'item_type', COALESCE(oi.item_type, 'normal')))
            FROM order_items oi
            WHERE oi.order_id::text = o.id::text) as order_items,
          (SELECT json_agg(json_build_object('employee_name', emp.name, 'amount', oinc.amount, 'quantity', COALESCE(oinc.quantity, 1), 'status', oinc.status, 'policy_name', ip.name))
            FROM order_incentives oinc
            LEFT JOIN employees emp ON oinc.employee_id::text = emp.id::text
            LEFT JOIN incentive_policies ip ON oinc.policy_id::text = ip.id::text
            WHERE oinc.order_id::text = o.id::text) as incentive_items
        FROM orders o
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        LEFT JOIN employees e ON o.assignee_id::text = e.id::text
        WHERE o.assignee_id IS NOT NULL${dateFilter}${assigneeFilter}
        ORDER BY e.name, o.order_date DESC`,
        params
      );
      return res.json(result.rows);
    }

    // GET /api/settlement/orders/:assigneeId - 담당자별 주문 목록 (정산구분 포함)
    if (pathParts[0] === 'orders' && pathParts[1] && req.method === 'GET') {
      const assigneeId = pathParts[1];
      const { period_start, period_end } = queryParams;
      let dateFilter = '';
      const params = [assigneeId];
      if (period_start && period_end) {
        dateFilter = ' AND o.order_date >= $2 AND o.order_date <= $3';
        params.push(period_start, period_end);
      }

      const result = await query(
        `SELECT o.*, c.name as customer_name, c.company as customer_company,
          CASE WHEN o.due_date IS NOT NULL AND o.due_date < CURRENT_DATE THEN 'confirmed' ELSE 'expected' END as settlement_type
        FROM orders o
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        WHERE o.assignee_id::text = $1${dateFilter}
        ORDER BY o.order_date DESC`,
        params
      );
      return res.json(result.rows);
    }

    // GET /api/settlement - 정산 목록
    if (req.method === 'GET' && !pathParts[0]) {
      const { status, assignee_id } = queryParams;
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (status) {
        conditions.push(`s.status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
      }

      // 매니저는 본인 정산만 조회
      const effectiveAssigneeId = (isManager && myEmployeeId) ? myEmployeeId : assignee_id;
      if (effectiveAssigneeId) {
        conditions.push(`s.assignee_id::text = $${paramIdx}`);
        params.push(effectiveAssigneeId);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

      // 저장된 total_expenses와 commission_amount 사용 (개별 정산건 기준)
      // 연결된 주문 수도 함께 조회
      const result = await query(
        `SELECT s.*, e.name as assignee_name, e.department, e.position,
          ROUND((s.total_sales - COALESCE(s.total_expenses, 0)) * s.commission_rate / 100) as calculated_commission,
          (SELECT COUNT(*) FROM orders o WHERE o.settlement_id::text = s.id::text) as linked_order_count
        FROM settlements s
        LEFT JOIN employees e ON s.assignee_id::text = e.id::text
        ${whereClause}
        ORDER BY s.created_at DESC`,
        params
      );
      // 수수료를 순수익 기준으로 재계산 (저장된 total_expenses 사용)
      const rows = result.rows.map(row => ({
        ...row,
        total_expenses: parseFloat(row.total_expenses) || 0,
        commission_amount: row.calculated_commission || 0,
        linked_order_count: parseInt(row.linked_order_count) || 0
      }));
      return res.json(rows);
    }

    // POST /api/settlement - 정산 생성
    if (req.method === 'POST' && !pathParts[0]) {
      const { assignee_id, period_start, period_end, commission_rate, notes } = req.body;
      if (!assignee_id || !period_start || !period_end) {
        return res.status(400).json({ error: '담당자, 시작일, 종료일은 필수입니다.' });
      }

      // 해당 기간 매출 합계 계산
      const salesResult = await query(
        `SELECT COALESCE(SUM(total_amount), 0) as total_sales
        FROM orders
        WHERE assignee_id::text = $1 AND order_date >= $2 AND order_date <= $3`,
        [assignee_id, period_start, period_end]
      );
      const totalSales = parseFloat(salesResult.rows[0].total_sales);

      // 해당 기간 지출(업체상품) 합계 계산 (환불 차감)
      const expensesResult = await query(
        `SELECT COALESCE(
          SUM(CASE WHEN t.reference_type = 'order_vendor' THEN t.amount ELSE 0 END) -
          SUM(CASE WHEN t.reference_type = 'order_vendor_refund' THEN t.amount ELSE 0 END),
        0) as total_expenses
        FROM transactions t
        JOIN orders o ON t.reference_id::text = o.id::text
        WHERE t.reference_type IN ('order_vendor', 'order_vendor_refund')
          AND o.assignee_id::text = $1
          AND o.order_date >= $2 AND o.order_date <= $3`,
        [assignee_id, period_start, period_end]
      );
      const vendorExpenses = Math.max(0, parseFloat(expensesResult.rows[0].total_expenses) || 0);

      // 해당 기간 인센티브 합계 계산
      const incentiveResult = await query(
        `SELECT COALESCE(SUM(oinc.amount * COALESCE(oinc.quantity, 1)), 0) as total_incentive
        FROM order_incentives oinc
        JOIN orders o ON oinc.order_id::text = o.id::text
        WHERE o.assignee_id::text = $1
          AND o.order_date >= $2 AND o.order_date <= $3`,
        [assignee_id, period_start, period_end]
      );
      const incentiveExpenses = parseFloat(incentiveResult.rows[0].total_incentive) || 0;
      const totalExpenses = vendorExpenses + incentiveExpenses;

      // 수수료 = (매출 - 지출) * 수수료율 (순수익 기준)
      const rate = parseFloat(commission_rate) || 0;
      const netProfit = totalSales - totalExpenses;
      const commissionAmount = Math.round(netProfit * rate / 100);

      const id = uuidv4();
      await query(
        `INSERT INTO settlements (id, assignee_id, period_start, period_end, total_sales, total_expenses, commission_rate, commission_amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, assignee_id, period_start, period_end, totalSales, totalExpenses, rate, commissionAmount, notes || null]
      );

      // 해당 기간의 주문들을 이 정산 레코드와 연결하고 정산 상태 업데이트
      const settledDate = new Date().toISOString().split('T')[0];
      await query(
        `UPDATE orders SET settlement_status = 'settled', settled_date = $1, settlement_id = $2
         WHERE assignee_id::text = $3 AND order_date >= $4 AND order_date <= $5`,
        [settledDate, id, assignee_id, period_start, period_end]
      );

      const result = await query(
        `SELECT s.*, e.name as assignee_name, e.department, e.position
        FROM settlements s LEFT JOIN employees e ON s.assignee_id::text = e.id::text
        WHERE s.id::text = $1`, [id]
      );
      return res.status(201).json(result.rows[0]);
    }

    // PUT /api/settlement/:id - 정산 수정
    if (pathParts[0] && !pathParts[1] && req.method === 'PUT') {
      const id = pathParts[0];
      const { status, commission_rate, settled_date, notes } = req.body;
      const current = await query('SELECT * FROM settlements WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '정산을 찾을 수 없습니다.' });
      const s = current.rows[0];

      let commissionAmount = s.commission_amount;
      if (commission_rate !== undefined) {
        // 저장된 total_expenses 사용
        const totalExpenses = parseFloat(s.total_expenses) || 0;
        const netProfit = parseFloat(s.total_sales) - totalExpenses;
        const rate = parseFloat(commission_rate) || 0;
        commissionAmount = Math.round(netProfit * rate / 100);
      }

      const newStatus = status || s.status;
      const newSettledDate = settled_date !== undefined ? (settled_date || null) : s.settled_date;

      await query(
        `UPDATE settlements SET status = $1, commission_rate = $2, commission_amount = $3, settled_date = $4, notes = $5 WHERE id::text = $6`,
        [
          newStatus,
          commission_rate !== undefined ? commission_rate : s.commission_rate,
          commissionAmount,
          newSettledDate,
          notes !== undefined ? notes : s.notes,
          id
        ]
      );

      // 정산 레코드 상태에 따라 연결된 주문들의 정산 상태도 업데이트
      if (newStatus === 'completed') {
        const orderSettledDate = newSettledDate || new Date().toISOString().split('T')[0];
        await query(
          `UPDATE orders SET settlement_status = 'settled', settled_date = $1 WHERE settlement_id::text = $2`,
          [orderSettledDate, id]
        );
      } else if (newStatus === 'pending') {
        await query(
          `UPDATE orders SET settlement_status = 'pending', settled_date = NULL WHERE settlement_id::text = $1`,
          [id]
        );
      }

      const result = await query(
        `SELECT s.*, e.name as assignee_name, e.department, e.position
        FROM settlements s LEFT JOIN employees e ON s.assignee_id::text = e.id::text
        WHERE s.id::text = $1`, [id]
      );
      return res.json(result.rows[0]);
    }

    // DELETE /api/settlement/:id - 정산 삭제
    if (pathParts[0] && !pathParts[1] && req.method === 'DELETE') {
      const settlementId = pathParts[0];

      // 먼저 연결된 주문들의 정산 상태를 초기화
      await query(
        `UPDATE orders SET settlement_status = 'pending', settled_date = NULL, settlement_id = NULL
         WHERE settlement_id::text = $1`,
        [settlementId]
      );

      const result = await query('DELETE FROM settlements WHERE id::text = $1', [settlementId]);
      if (result.rowCount === 0) return res.status(404).json({ error: '정산을 찾을 수 없습니다.' });
      return res.json({ message: '정산이 삭제되었습니다.' });
    }

    // PUT /api/settlement/orders/:orderId/status - 개별 주문 정산 상태 변경
    if (pathParts[0] === 'orders' && pathParts[1] && pathParts[2] === 'status' && req.method === 'PUT') {
      const orderId = pathParts[1];
      const { settlement_status } = req.body;

      if (!settlement_status || !['pending', 'settled'].includes(settlement_status)) {
        return res.status(400).json({ error: '유효한 정산 상태를 입력해주세요. (pending/settled)' });
      }

      const settledDate = settlement_status === 'settled' ? new Date().toISOString().split('T')[0] : null;
      // 개별 상태 변경 시 settlement_id 연결 해제 (pending으로 변경 시)
      const settlementIdValue = settlement_status === 'pending' ? null : undefined;

      let result;
      if (settlement_status === 'pending') {
        // pending으로 변경 시 settlement_id도 해제
        result = await query(
          `UPDATE orders SET settlement_status = $1, settled_date = $2, settlement_id = NULL WHERE id::text = $3 RETURNING *`,
          [settlement_status, settledDate, orderId]
        );
      } else {
        // settled로 변경 시 settlement_id는 유지 (개별 정산이므로 레코드 연결 없음)
        result = await query(
          `UPDATE orders SET settlement_status = $1, settled_date = $2 WHERE id::text = $3 RETURNING *`,
          [settlement_status, settledDate, orderId]
        );
      }

      if (result.rowCount === 0) {
        return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      }

      return res.json(result.rows[0]);
    }

    // POST /api/settlement/batch - 담당자별 일괄 정산
    if (pathParts[0] === 'batch' && req.method === 'POST') {
      const { assignee_id, period_start, period_end, settlement_status, commission_rate, create_settlement_record } = req.body;

      if (!assignee_id || !period_start || !period_end) {
        return res.status(400).json({ error: '담당자, 시작일, 종료일은 필수입니다.' });
      }

      const status = settlement_status || 'settled';
      const settledDate = status === 'settled' ? new Date().toISOString().split('T')[0] : null;

      // 정산 레코드 생성 옵션이 활성화된 경우 먼저 레코드 생성
      let settlementRecord = null;
      let settlementRecordId = null;

      if (create_settlement_record && status === 'settled') {
        // 해당 기간 매출 합계 계산
        const salesResult = await query(
          `SELECT COALESCE(SUM(total_amount), 0) as total_sales
          FROM orders
          WHERE assignee_id::text = $1 AND order_date >= $2 AND order_date <= $3`,
          [assignee_id, period_start, period_end]
        );
        const totalSales = parseFloat(salesResult.rows[0].total_sales);

        // 해당 기간 지출(업체상품) 합계 계산 (환불 차감)
        const expensesResult = await query(
          `SELECT COALESCE(
            SUM(CASE WHEN t.reference_type = 'order_vendor' THEN t.amount ELSE 0 END) -
            SUM(CASE WHEN t.reference_type = 'order_vendor_refund' THEN t.amount ELSE 0 END),
          0) as total_expenses
          FROM transactions t
          JOIN orders o ON t.reference_id::text = o.id::text
          WHERE t.reference_type IN ('order_vendor', 'order_vendor_refund')
            AND o.assignee_id::text = $1
            AND o.order_date >= $2 AND o.order_date <= $3`,
          [assignee_id, period_start, period_end]
        );
        const vendorExpenses = Math.max(0, parseFloat(expensesResult.rows[0].total_expenses) || 0);

        // 해당 기간 인센티브 합계 계산
        const incentiveResult = await query(
          `SELECT COALESCE(SUM(oinc.amount * COALESCE(oinc.quantity, 1)), 0) as total_incentive
          FROM order_incentives oinc
          JOIN orders o ON oinc.order_id::text = o.id::text
          WHERE o.assignee_id::text = $1
            AND o.order_date >= $2 AND o.order_date <= $3`,
          [assignee_id, period_start, period_end]
        );
        const incentiveExpenses = parseFloat(incentiveResult.rows[0].total_incentive) || 0;
        const totalExpenses = vendorExpenses + incentiveExpenses;

        // 수수료 계산
        const rate = parseFloat(commission_rate) || 10;
        const netProfit = totalSales - totalExpenses;
        const commissionAmount = Math.round(netProfit * rate / 100);

        settlementRecordId = uuidv4();
        await query(
          `INSERT INTO settlements (id, assignee_id, period_start, period_end, total_sales, total_expenses, commission_rate, commission_amount, status, settled_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed', $9)`,
          [settlementRecordId, assignee_id, period_start, period_end, totalSales, totalExpenses, rate, commissionAmount, settledDate]
        );

        const settlementResult = await query(
          `SELECT s.*, e.name as assignee_name, e.department, e.position
          FROM settlements s LEFT JOIN employees e ON s.assignee_id::text = e.id::text
          WHERE s.id::text = $1`, [settlementRecordId]
        );
        settlementRecord = settlementResult.rows[0];
      }

      // 해당 담당자의 기간 내 주문들 일괄 정산 처리 (정산 레코드 ID 연결 포함)
      const updateResult = await query(
        `UPDATE orders SET settlement_status = $1, settled_date = $2, settlement_id = $3
         WHERE assignee_id::text = $4 AND order_date >= $5 AND order_date <= $6
         RETURNING id`,
        [status, settledDate, settlementRecordId, assignee_id, period_start, period_end]
      );

      const updatedCount = updateResult.rowCount;

      return res.json({
        message: `${updatedCount}건의 주문이 정산 처리되었습니다.`,
        updated_count: updatedCount,
        settlement_record: settlementRecord
      });
    }

    // === 업체정산 관련 API ===

    // GET /api/settlement/vendor-summary - 업체별 정산 요약
    if (path === '/vendor-summary' && req.method === 'GET') {
      const { period_start, period_end } = req.query;
      let dateFilter = '';
      const params = [];
      if (period_start && period_end) {
        dateFilter = ' AND o.order_date >= $1 AND o.order_date <= $2';
        params.push(period_start, period_end);
      }

      const result = await query(
        `SELECT
          v.id as vendor_id,
          v.name as vendor_name,
          COUNT(DISTINCT ovi.order_id) as order_count,
          COALESCE(SUM(CASE WHEN COALESCE(ovi.item_type, 'normal') = 'normal' THEN ovi.unit_price * ovi.quantity ELSE 0 END), 0) as total_amount,
          COALESCE(SUM(CASE WHEN ovi.item_type = 'refund' THEN ovi.unit_price * ovi.quantity ELSE 0 END), 0) as total_refund,
          COALESCE(SUM(CASE WHEN COALESCE(ovi.item_type, 'normal') = 'normal' THEN ovi.unit_price * ovi.quantity ELSE 0 END), 0)
            - COALESCE(SUM(CASE WHEN ovi.item_type = 'refund' THEN ovi.unit_price * ovi.quantity ELSE 0 END), 0) as net_amount,
          COALESCE((SELECT SUM(vs2.net_amount) FROM vendor_settlements vs2 WHERE vs2.vendor_id::text = v.id::text AND vs2.status = 'completed'), 0) as settled_amount
        FROM vendors v
        INNER JOIN order_vendor_items ovi ON ovi.vendor_id::text = v.id::text
        INNER JOIN orders o ON ovi.order_id::text = o.id::text
        WHERE 1=1${dateFilter}
        GROUP BY v.id, v.name
        ORDER BY net_amount DESC`,
        params
      );
      return res.json(result.rows);
    }

    // GET /api/settlement/vendor-orders - 특정 업체의 주문 목록
    if (path === '/vendor-orders' && req.method === 'GET') {
      const { vendor_id, period_start, period_end } = req.query;
      if (!vendor_id) return res.status(400).json({ error: '업체 ID가 필요합니다.' });

      const params = [vendor_id];
      let dateFilter = '';
      if (period_start && period_end) {
        dateFilter = ' AND o.order_date >= $2 AND o.order_date <= $3';
        params.push(period_start, period_end);
      }

      const result = await query(
        `SELECT
          o.id, o.order_number, o.order_date, o.due_date, o.total_amount, o.status,
          c.name as customer_name, c.company as customer_company,
          e.name as assignee_name,
          (SELECT json_agg(json_build_object(
            'product_name', vp.product_name,
            'unit_price', ovi2.unit_price,
            'quantity', ovi2.quantity,
            'item_type', COALESCE(ovi2.item_type, 'normal')
          )) FROM order_vendor_items ovi2
            LEFT JOIN vendor_products vp ON ovi2.vendor_product_id::text = vp.id::text
            WHERE ovi2.order_id::text = o.id::text AND ovi2.vendor_id::text = $1
          ) as vendor_items,
          COALESCE(
            (SELECT SUM(CASE WHEN COALESCE(ovi3.item_type, 'normal') = 'normal' THEN ovi3.unit_price * ovi3.quantity ELSE 0 END)
             - SUM(CASE WHEN ovi3.item_type = 'refund' THEN ovi3.unit_price * ovi3.quantity ELSE 0 END)
             FROM order_vendor_items ovi3
             WHERE ovi3.order_id::text = o.id::text AND ovi3.vendor_id::text = $1
            ), 0) as vendor_amount
        FROM orders o
        INNER JOIN order_vendor_items ovi ON ovi.order_id::text = o.id::text AND ovi.vendor_id::text = $1
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        LEFT JOIN employees e ON o.assignee_id::text = e.id::text
        WHERE 1=1${dateFilter}
        GROUP BY o.id, o.order_number, o.order_date, o.due_date, o.total_amount, o.status,
          c.name, c.company, e.name
        ORDER BY o.order_date DESC`,
        params
      );
      return res.json(result.rows);
    }

    // GET /api/settlement/vendor-settle - 업체 정산 레코드 목록
    if (pathParts[0] === 'vendor-settle' && !pathParts[1] && req.method === 'GET') {
      const { vendor_id, status } = req.query;
      const params = [];
      const conditions = [];
      if (vendor_id) {
        params.push(vendor_id);
        conditions.push(`vs.vendor_id::text = $${params.length}`);
      }
      if (status) {
        params.push(status);
        conditions.push(`vs.status = $${params.length}`);
      }
      const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

      const result = await query(
        `SELECT vs.*, v.name as vendor_name
        FROM vendor_settlements vs
        LEFT JOIN vendors v ON vs.vendor_id::text = v.id::text
        ${whereClause}
        ORDER BY vs.created_at DESC`,
        params
      );
      return res.json(result.rows);
    }

    // POST /api/settlement/vendor-settle - 업체 정산 생성
    if (pathParts[0] === 'vendor-settle' && !pathParts[1] && req.method === 'POST') {
      const { vendor_id, period_start, period_end, notes } = req.body;
      if (!vendor_id || !period_start || !period_end) {
        return res.status(400).json({ error: '업체, 시작일, 종료일은 필수입니다.' });
      }

      const amountResult = await query(
        `SELECT
          COALESCE(SUM(CASE WHEN COALESCE(ovi.item_type, 'normal') = 'normal' THEN ovi.unit_price * ovi.quantity ELSE 0 END), 0) as total_amount,
          COALESCE(SUM(CASE WHEN ovi.item_type = 'refund' THEN ovi.unit_price * ovi.quantity ELSE 0 END), 0) as total_refund
        FROM order_vendor_items ovi
        JOIN orders o ON ovi.order_id::text = o.id::text
        WHERE ovi.vendor_id::text = $1
          AND o.order_date >= $2 AND o.order_date <= $3`,
        [vendor_id, period_start, period_end]
      );
      const totalAmount = parseFloat(amountResult.rows[0].total_amount);
      const totalRefund = parseFloat(amountResult.rows[0].total_refund);
      const netAmount = totalAmount - totalRefund;

      const id = uuidv4();
      const settledDate = new Date().toISOString().split('T')[0];
      await query(
        `INSERT INTO vendor_settlements (id, vendor_id, period_start, period_end, total_amount, total_refund, net_amount, status, settled_date, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9)`,
        [id, vendor_id, period_start, period_end, totalAmount, totalRefund, netAmount, settledDate, notes || null]
      );

      const result = await query(
        `SELECT vs.*, v.name as vendor_name
        FROM vendor_settlements vs
        LEFT JOIN vendors v ON vs.vendor_id::text = v.id::text
        WHERE vs.id::text = $1`, [id]
      );
      return res.status(201).json(result.rows[0]);
    }

    // PUT /api/settlement/vendor-settle/:id - 업체 정산 수정
    if (pathParts[0] === 'vendor-settle' && pathParts[1] && req.method === 'PUT') {
      const id = pathParts[1];
      const { status, settled_date, notes } = req.body;

      const current = await query('SELECT * FROM vendor_settlements WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '업체 정산을 찾을 수 없습니다.' });
      const vs = current.rows[0];

      const newStatus = status || vs.status;
      const newSettledDate = settled_date !== undefined ? (settled_date || null) : vs.settled_date;

      await query(
        `UPDATE vendor_settlements SET status = $1, settled_date = $2, notes = $3 WHERE id::text = $4`,
        [newStatus, newSettledDate, notes !== undefined ? notes : vs.notes, id]
      );

      const result = await query(
        `SELECT vs.*, v.name as vendor_name
        FROM vendor_settlements vs
        LEFT JOIN vendors v ON vs.vendor_id::text = v.id::text
        WHERE vs.id::text = $1`, [id]
      );
      return res.json(result.rows[0]);
    }

    // DELETE /api/settlement/vendor-settle/:id - 업체 정산 삭제
    if (pathParts[0] === 'vendor-settle' && pathParts[1] && req.method === 'DELETE') {
      const id = pathParts[1];
      const result = await query('DELETE FROM vendor_settlements WHERE id::text = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: '업체 정산을 찾을 수 없습니다.' });
      return res.json({ message: '업체 정산이 삭제되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Settlement error:', error);
    return res.status(500).json({ error: '서버 오류: ' + (error.message || '알 수 없는 오류') });
  }
}
