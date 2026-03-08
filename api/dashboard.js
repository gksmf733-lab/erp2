import { query, ensureTables } from './_lib/db.js';
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = verifyToken(req);
  if (!user) return res.status(401).json({ error: '인증이 필요합니다.' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/api/dashboard', '');

  try {
    await ensureTables('dashboard_v3', async () => {
      await query(`CREATE TABLE IF NOT EXISTS employees (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_number VARCHAR(50), name VARCHAR(255), department VARCHAR(100), position VARCHAR(100), email VARCHAR(255), phone VARCHAR(100), hire_date DATE, salary DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, company VARCHAR(255), email VARCHAR(255), phone VARCHAR(100), phone2 VARCHAR(100), business_number VARCHAR(50), industry VARCHAR(100), business_type VARCHAR(100), address TEXT, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(100), customer_id UUID, assignee_id UUID, total_amount DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'pending', order_date DATE, start_date DATE, due_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type VARCHAR(50) NOT NULL, category VARCHAR(100) NOT NULL, amount DECIMAL(15,2) DEFAULT 0, description TEXT, date DATE, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255)`).catch(() => {});
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID, item_id UUID, item_name VARCHAR(255), quantity INTEGER DEFAULT 1, unit_price DECIMAL(15,2) DEFAULT 0, total_price DECIMAL(15,2) DEFAULT 0, item_type VARCHAR(20) DEFAULT 'normal', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'normal'`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS order_vendor_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, vendor_id UUID NOT NULL, vendor_product_id UUID NOT NULL, quantity INTEGER DEFAULT 1, unit_price DECIMAL(15,2) DEFAULT 0, total_price DECIMAL(15,2) DEFAULT 0, item_type VARCHAR(20) DEFAULT 'normal', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE order_vendor_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'normal'`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS services (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), service_code VARCHAR(100), name VARCHAR(255), category VARCHAR(100), description TEXT, price DECIMAL(15,2) DEFAULT 0, unit VARCHAR(50), duration VARCHAR(50), status VARCHAR(50) DEFAULT 'active', is_blog BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS order_incentives (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, employee_id UUID NOT NULL, policy_id UUID, amount DECIMAL(15,2) NOT NULL DEFAULT 0, quantity INTEGER DEFAULT 1, status VARCHAR(50) DEFAULT 'pending', notes TEXT, created_at TIMESTAMP DEFAULT NOW(), paid_at TIMESTAMP)`);
    });

    // 매니저/직원은 본인 데이터만 조회
    const isManager = user.role === 'manager' || user.role === 'employee';
    const myEmployeeId = user.employee_id || null;

    if (path === '/summary') {
      // 당월 기준 날짜 범위
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = now.getMonth() === 11
        ? `${now.getFullYear() + 1}-01-01`
        : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;

      // 매니저/직원이면 본인 담당 주문만 필터
      const assigneeFilter = (isManager && myEmployeeId) ? ` AND assignee_id::text = $3` : '';
      const assigneeFilterJoin = (isManager && myEmployeeId) ? ` AND o.assignee_id::text = $3` : '';
      const txAssigneeJoin = (isManager && myEmployeeId)
        ? ` AND EXISTS (SELECT 1 FROM orders o WHERE o.id::text = transactions.reference_id::text AND o.assignee_id::text = $3)`
        : '';
      const params = [monthStart, nextMonth];
      if (isManager && myEmployeeId) params.push(myEmployeeId);

      const result = await query(`SELECT
        (SELECT COUNT(*) FROM employees WHERE status = 'active') as active_employees,
        (SELECT COUNT(*) FROM customers WHERE status = 'active') as active_customers,
        (SELECT COUNT(*) FROM services WHERE status = 'active') as active_services,

        -- 당월 매출: orders 테이블 기준
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE order_date >= $1 AND order_date < $2${assigneeFilter}) as month_sales,
        -- 당월 업체 지출
        (SELECT COALESCE(
          SUM(CASE WHEN reference_type = 'order_vendor' THEN amount ELSE 0 END) -
          SUM(CASE WHEN reference_type = 'order_vendor_refund' THEN amount ELSE 0 END), 0)
          FROM transactions WHERE reference_type IN ('order_vendor', 'order_vendor_refund') AND date >= $1 AND date < $2${txAssigneeJoin}) as month_vendor_expense,
        -- 당월 환불
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE reference_type = 'order_refund' AND date >= $1 AND date < $2${txAssigneeJoin}) as month_refund,
        -- 당월 인센티브 지출
        (SELECT COALESCE(SUM(oi.amount * COALESCE(oi.quantity, 1)), 0)
          FROM order_incentives oi
          JOIN orders o ON oi.order_id::text = o.id::text
          WHERE o.order_date >= $1 AND o.order_date < $2${assigneeFilterJoin}) as month_incentive,

        -- 전체 주문 수 (당월)
        (SELECT COUNT(*) FROM orders WHERE order_date >= $1 AND order_date < $2${assigneeFilter}) as month_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'pending'${assigneeFilter}) as pending_orders,
        -- 당일 접수 수량
        (SELECT COUNT(*) FROM orders WHERE order_date = CURRENT_DATE${assigneeFilter}) as today_orders,

        -- 정산 예정/확정
        (SELECT COALESCE(SUM(CASE WHEN due_date IS NULL OR due_date >= CURRENT_DATE THEN total_amount ELSE 0 END), 0) FROM orders WHERE assignee_id IS NOT NULL AND order_date >= $1 AND order_date < $2${assigneeFilter}) as expected_settlement,
        (SELECT COALESCE(SUM(CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN total_amount ELSE 0 END), 0) FROM orders WHERE assignee_id IS NOT NULL AND order_date >= $1 AND order_date < $2${assigneeFilter}) as confirmed_settlement
      `, params);

      const r = result.rows[0];
      const sales = parseFloat(r.month_sales) || 0;
      const vendorExpense = parseFloat(r.month_vendor_expense) || 0;
      const refund = parseFloat(r.month_refund) || 0;
      const incentive = parseFloat(r.month_incentive) || 0;
      const totalExpense = vendorExpense + refund + incentive;
      const netProfit = sales - totalExpense;

      return res.json({
        employees: { total: parseInt(r.active_employees) },
        services: { total: parseInt(r.active_services) },
        finance: {
          income: sales,
          expense: totalExpense,
          balance: netProfit,
          vendorExpense,
          refund,
          incentive
        },
        settlement: {
          expected: parseFloat(r.expected_settlement) || 0,
          confirmed: parseFloat(r.confirmed_settlement) || 0
        },
        sales: {
          customers: parseInt(r.active_customers),
          totalOrders: parseInt(r.month_orders),
          pendingOrders: parseInt(r.pending_orders),
          todayOrders: parseInt(r.today_orders),
          totalSales: sales
        },
        period: monthStart.substring(0, 7)
      });
    }

    if (path === '/recent') {
      // 매니저/직원 필터
      const recentAssigneeFilter = (isManager && myEmployeeId) ? ` AND o.assignee_id::text = $1` : '';
      const recentParams = (isManager && myEmployeeId) ? [myEmployeeId] : [];

      // 최근 주문 - 업체명, 담당자, 주문상품명, 수량 포함
      const recentOrders = await query(`
        SELECT o.id, o.order_number, o.total_amount, o.status, o.order_date,
               c.name as customer_name, c.company as customer_company,
               e.name as assignee_name,
               (SELECT string_agg(item_name, ', ' ORDER BY id) FROM (SELECT item_name, id FROM order_items WHERE order_id::text = o.id::text AND (item_type IS NULL OR item_type = 'normal') LIMIT 3) sub) as items_summary,
               (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id::text = o.id::text AND (item_type IS NULL OR item_type = 'normal')) as total_quantity
        FROM orders o
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        LEFT JOIN employees e ON o.assignee_id::text = e.id::text
        WHERE 1=1${recentAssigneeFilter}
        ORDER BY o.created_at DESC LIMIT 5
      `, recentParams);

      // 최근 거래내역 - 주문별 매출/업체지출만 정확히 분리
      const recentTransactions = await query(`
        SELECT
          t.reference_id,
          o.order_number,
          c.company as customer_company,
          c.name as customer_name,
          SUM(CASE WHEN t.reference_type = 'order' THEN t.amount ELSE 0 END) as income,
          SUM(CASE WHEN t.reference_type = 'order_vendor' THEN t.amount ELSE 0 END) -
          SUM(CASE WHEN t.reference_type = 'order_vendor_refund' THEN t.amount ELSE 0 END) as expense,
          SUM(CASE WHEN t.reference_type = 'order_refund' THEN t.amount ELSE 0 END) as refund,
          MIN(t.date) as date,
          MIN(t.created_at) as created_at
        FROM transactions t
        LEFT JOIN orders o ON t.reference_id::text = o.id::text
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        WHERE t.reference_id IS NOT NULL
          AND t.reference_type IN ('order', 'order_vendor', 'order_vendor_refund', 'order_refund')
          ${(isManager && myEmployeeId) ? `AND o.assignee_id::text = $1` : ''}
        GROUP BY t.reference_id, o.order_number, c.company, c.name
        ORDER BY MIN(t.created_at) DESC
        LIMIT 5
      `, recentParams);

      // 신규 등록 서비스상품 (최근 10건)
      const newServices = await query(`
        SELECT id, name, category, price, status, created_at
        FROM services
        ORDER BY created_at DESC LIMIT 10
      `);

      // 마감예정 주문 (due_date 기준, 오늘 이후 7일 이내 + 이미 지난것도 포함)
      const upcomingDeadlines = await query(`
        SELECT o.id, o.order_number, o.total_amount, o.status, o.due_date,
               c.name as customer_name, c.company as customer_company,
               e.name as assignee_name,
               (SELECT string_agg(item_name, ', ' ORDER BY id) FROM (SELECT item_name, id FROM order_items WHERE order_id::text = o.id::text AND (item_type IS NULL OR item_type = 'normal') LIMIT 3) sub) as items_summary
        FROM orders o
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        LEFT JOIN employees e ON o.assignee_id::text = e.id::text
        WHERE o.due_date IS NOT NULL
          AND o.due_date <= CURRENT_DATE + INTERVAL '7 days'
          AND o.status NOT IN ('completed', 'cancelled')
          ${(isManager && myEmployeeId) ? `AND o.assignee_id::text = $1` : ''}
        ORDER BY o.due_date ASC
        LIMIT 10
      `, recentParams);

      return res.json({
        recentOrders: recentOrders.rows.map(r => ({
          ...r,
          total_quantity: parseInt(r.total_quantity) || 0
        })),
        recentTransactions: recentTransactions.rows.map(r => ({
          ...r,
          income: parseFloat(r.income) || 0,
          expense: parseFloat(r.expense) || 0,
          refund: parseFloat(r.refund) || 0
        })),
        newServices: newServices.rows.map(r => ({
          ...r,
          price: parseFloat(r.price) || 0
        })),
        upcomingDeadlines: upcomingDeadlines.rows
      });
    }

    if (path === '/charts') {
      const chartParams = (isManager && myEmployeeId) ? [myEmployeeId] : [];
      const chartAssigneeFilter = (isManager && myEmployeeId) ? ` WHERE assignee_id::text = $1` : '';
      const chartAssigneeAnd = (isManager && myEmployeeId) ? ` AND assignee_id::text = $1` : '';
      const chartTxJoin = (isManager && myEmployeeId)
        ? ` AND EXISTS (SELECT 1 FROM orders o WHERE o.id::text = transactions.reference_id::text AND o.assignee_id::text = $1)`
        : '';

      const ordersByStatus = await query(`SELECT status, COUNT(*) as count FROM orders${chartAssigneeFilter} GROUP BY status`, chartParams);

      // 카테고리별 지출: reference_type 기반 (업체지출, 환불) + 인센티브
      const chartIncAssigneeFilter = (isManager && myEmployeeId)
        ? ` AND EXISTS (SELECT 1 FROM orders o WHERE o.id::text = oi.order_id::text AND o.assignee_id::text = $1)`
        : '';
      const expensesByCategory = await query(`
        SELECT category, total FROM (
          SELECT reference_type as category,
            SUM(CASE WHEN reference_type = 'order_vendor' THEN amount
                 WHEN reference_type = 'order_vendor_refund' THEN -amount
                 WHEN reference_type = 'order_refund' THEN amount
                 ELSE 0 END) as total
          FROM transactions
          WHERE reference_type IN ('order_vendor', 'order_vendor_refund', 'order_refund')${chartTxJoin}
          GROUP BY reference_type
          HAVING SUM(CASE WHEN reference_type = 'order_vendor' THEN amount
                          WHEN reference_type = 'order_vendor_refund' THEN -amount
                          WHEN reference_type = 'order_refund' THEN amount
                          ELSE 0 END) > 0
          UNION ALL
          SELECT 'incentive' as category,
            COALESCE(SUM(oi.amount * COALESCE(oi.quantity, 1)), 0) as total
          FROM order_incentives oi
          WHERE 1=1${chartIncAssigneeFilter}
          HAVING COALESCE(SUM(oi.amount * COALESCE(oi.quantity, 1)), 0) > 0
        ) combined
        ORDER BY total DESC LIMIT 6
      `, chartParams);

      // 월별 매출: orders 테이블 기준
      const monthlySales = await query(`SELECT TO_CHAR(order_date, 'YYYY-MM') as month, SUM(total_amount) as total FROM orders WHERE order_date IS NOT NULL${chartAssigneeAnd} GROUP BY TO_CHAR(order_date, 'YYYY-MM') ORDER BY month DESC LIMIT 6`, chartParams);

      // 월별 매출/지출: orders 기준 매출 + transactions 지출 + 인센티브 지출
      const chartIncOrderFilter = (isManager && myEmployeeId)
        ? ` AND o2.assignee_id::text = $1`
        : '';
      const monthlyFinance = await query(`
        SELECT m.month,
          COALESCE(o.sales, 0) as income,
          COALESCE(t.expense, 0) + COALESCE(inc.incentive_expense, 0) as expense
        FROM (
          SELECT DISTINCT month FROM (
            SELECT TO_CHAR(order_date, 'YYYY-MM') as month FROM orders WHERE order_date IS NOT NULL${chartAssigneeAnd}
            UNION
            SELECT TO_CHAR(date, 'YYYY-MM') as month FROM transactions WHERE date IS NOT NULL${chartTxJoin}
          ) months
        ) m
        LEFT JOIN (
          SELECT TO_CHAR(order_date, 'YYYY-MM') as month, SUM(total_amount) as sales
          FROM orders WHERE order_date IS NOT NULL${chartAssigneeAnd}
          GROUP BY TO_CHAR(order_date, 'YYYY-MM')
        ) o ON m.month = o.month
        LEFT JOIN (
          SELECT TO_CHAR(date, 'YYYY-MM') as month,
            SUM(CASE WHEN reference_type = 'order_vendor' THEN amount ELSE 0 END) -
            SUM(CASE WHEN reference_type = 'order_vendor_refund' THEN amount ELSE 0 END) +
            SUM(CASE WHEN reference_type = 'order_refund' THEN amount ELSE 0 END) as expense
          FROM transactions
          WHERE reference_type IN ('order_vendor', 'order_vendor_refund', 'order_refund') AND date IS NOT NULL${chartTxJoin}
          GROUP BY TO_CHAR(date, 'YYYY-MM')
        ) t ON m.month = t.month
        LEFT JOIN (
          SELECT TO_CHAR(o2.order_date, 'YYYY-MM') as month,
            SUM(oi.amount * COALESCE(oi.quantity, 1)) as incentive_expense
          FROM order_incentives oi
          JOIN orders o2 ON oi.order_id::text = o2.id::text
          WHERE o2.order_date IS NOT NULL${chartIncOrderFilter}
          GROUP BY TO_CHAR(o2.order_date, 'YYYY-MM')
        ) inc ON m.month = inc.month
        ORDER BY m.month DESC LIMIT 6
      `, chartParams);

      const categoryLabels = {
        'order_vendor': '업체 지출',
        'order_refund': '환불',
        'incentive': '인센티브'
      };

      return res.json({
        ordersByStatus: ordersByStatus.rows.map(r => ({ status: r.status, count: parseInt(r.count) })),
        expensesByCategory: expensesByCategory.rows
          .filter(r => r.category !== 'order_vendor_refund')
          .map(r => ({ category: categoryLabels[r.category] || r.category, total: parseFloat(r.total) })),
        monthlySales: monthlySales.rows.reverse().map(r => ({ month: r.month, total: parseFloat(r.total) })),
        monthlyFinance: monthlyFinance.rows.reverse().map(r => ({ month: r.month, income: parseFloat(r.income), expense: parseFloat(r.expense) }))
      });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
