import { query, ensureTables } from './_lib/db.js';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'erp-secret-key-2024';

function formatCurrency(amount) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
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
  const path = url.pathname.replace('/api/sales', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    // 콜드스타트 시 1회만 테이블 생성
    await ensureTables('sales_v3', async () => {
      await query(`CREATE TABLE IF NOT EXISTS customers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, company VARCHAR(255), email VARCHAR(255), phone VARCHAR(100), phone2 VARCHAR(100), business_number VARCHAR(50), industry VARCHAR(100), business_type VARCHAR(100), address TEXT, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone2 VARCHAR(100)`).catch(() => {});
      await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_number VARCHAR(50)`).catch(() => {});
      await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry VARCHAR(100)`).catch(() => {});
      await query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_type VARCHAR(100)`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS employees (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_number VARCHAR(50), name VARCHAR(255), department VARCHAR(100), position VARCHAR(100), email VARCHAR(255), phone VARCHAR(100), hire_date DATE, salary DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT NOW())`);
      await query(`CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_number VARCHAR(100), customer_id UUID, assignee_id UUID, total_amount DECIMAL(15,2) DEFAULT 0, status VARCHAR(50) DEFAULT 'pending', order_date DATE, start_date DATE, due_date DATE, notes TEXT, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS start_date DATE`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS order_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID, item_id UUID, item_name VARCHAR(255), quantity INTEGER DEFAULT 1, unit_price DECIMAL(15,2) DEFAULT 0, total_price DECIMAL(15,2) DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'normal'`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS order_vendor_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), order_id UUID NOT NULL, vendor_id UUID NOT NULL, vendor_product_id UUID NOT NULL, quantity INTEGER DEFAULT 1, unit_price DECIMAL(15,2) DEFAULT 0, total_price DECIMAL(15,2) DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE order_vendor_items ADD COLUMN IF NOT EXISTS item_type VARCHAR(20) DEFAULT 'normal'`).catch(() => {});;
      await query(`CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type VARCHAR(50) NOT NULL, category VARCHAR(100) NOT NULL, amount DECIMAL(15,2) DEFAULT 0, description TEXT, date DATE, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255)`).catch(() => {});
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`).catch(() => {});
      // 주문 수정 내역 로그 테이블
      await query(`CREATE TABLE IF NOT EXISTS order_edit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        change_summary TEXT,
        edited_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      // 인센티브 관련 테이블
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
      // 서비스 테이블 (블로그 자동 생성에서 참조)
      await query(`CREATE TABLE IF NOT EXISTS services (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), service_code VARCHAR(50), name VARCHAR(255), category VARCHAR(100), description TEXT, price DECIMAL(15,2) DEFAULT 0, unit VARCHAR(50) DEFAULT '건', duration VARCHAR(100), status VARCHAR(50) DEFAULT 'active', is_blog BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_blog BOOLEAN DEFAULT false`).catch(() => {});
      // 고객별 서비스 단가 테이블
      await query(`CREATE TABLE IF NOT EXISTS service_prices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), service_id UUID, customer_id UUID, price DECIMAL(15,2) DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);
      // 블로그 발행목록 테이블
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
    });

    if (pathParts[0] === 'customers' && req.method === 'GET' && !pathParts[1]) {
      const { search, status } = queryParams;
      let result;
      if (search && status) {
        result = await query('SELECT * FROM customers WHERE status = $1 AND (name ILIKE $2 OR company ILIKE $2 OR business_number ILIKE $2) ORDER BY created_at DESC', [status, '%' + search + '%']);
      } else if (search) {
        result = await query('SELECT * FROM customers WHERE name ILIKE $1 OR company ILIKE $1 OR business_number ILIKE $1 ORDER BY created_at DESC', ['%' + search + '%']);
      } else if (status) {
        result = await query('SELECT * FROM customers WHERE status = $1 ORDER BY created_at DESC', [status]);
      } else {
        result = await query('SELECT * FROM customers ORDER BY created_at DESC');
      }
      return res.json(result.rows);
    }

    if (pathParts[0] === 'customers' && pathParts[1] && !pathParts[2] && req.method === 'GET') {
      const result = await query('SELECT * FROM customers WHERE id::text = $1', [pathParts[1]]);
      if (result.rows.length === 0) return res.status(404).json({ error: '고객을 찾을 수 없습니다.' });
      return res.json(result.rows[0]);
    }

    if (pathParts[0] === 'customers' && !pathParts[1] && req.method === 'POST') {
      const { name, company, email, phone, phone2, business_number, industry, business_type, address } = req.body;
      if (!name) return res.status(400).json({ error: '대표자명은 필수입니다.' });
      const id = uuidv4();
      await query('INSERT INTO customers (id, name, company, email, phone, phone2, business_number, industry, business_type, address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [id, name, company || null, email || null, phone || null, phone2 || null, business_number || null, industry || null, business_type || null, address || null]);
      const result = await query('SELECT * FROM customers WHERE id::text = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    if (pathParts[0] === 'customers' && pathParts[1] && !pathParts[2] && req.method === 'PUT') {
      const id = pathParts[1];
      const { name, company, email, phone, phone2, business_number, industry, business_type, address, status } = req.body;
      const current = await query('SELECT * FROM customers WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '고객을 찾을 수 없습니다.' });
      const c = current.rows[0];
      await query('UPDATE customers SET name=$1, company=$2, email=$3, phone=$4, phone2=$5, business_number=$6, industry=$7, business_type=$8, address=$9, status=$10 WHERE id::text=$11', [name || c.name, company !== undefined ? company : c.company, email !== undefined ? email : c.email, phone !== undefined ? phone : c.phone, phone2 !== undefined ? phone2 : c.phone2, business_number !== undefined ? business_number : c.business_number, industry !== undefined ? industry : c.industry, business_type !== undefined ? business_type : c.business_type, address !== undefined ? address : c.address, status || c.status, id]);
      const result = await query('SELECT * FROM customers WHERE id::text = $1', [id]);
      return res.json(result.rows[0]);
    }

    if (pathParts[0] === 'customers' && pathParts[1] && !pathParts[2] && req.method === 'DELETE') {
      const result = await query('DELETE FROM customers WHERE id::text = $1', [pathParts[1]]);
      if (result.rowCount === 0) return res.status(404).json({ error: '고객을 찾을 수 없습니다.' });
      return res.json({ message: '고객이 삭제되었습니다.' });
    }

    // GET /api/sales/customers/:id/prices - 고객별 서비스 단가 조회
    if (pathParts[0] === 'customers' && pathParts[1] && pathParts[2] === 'prices' && req.method === 'GET') {
      const customerId = pathParts[1];
      const result = await query(
        `SELECT sp.*, s.name as service_name, s.category as service_category, s.price as base_price, s.unit as service_unit
         FROM service_prices sp
         LEFT JOIN services s ON sp.service_id::text = s.id::text
         WHERE sp.customer_id::text = $1
         ORDER BY s.category, s.name`,
        [customerId]
      );
      return res.json(result.rows);
    }

    // POST /api/sales/customers/:id/prices - 고객별 서비스 단가 일괄 저장
    if (pathParts[0] === 'customers' && pathParts[1] && pathParts[2] === 'prices' && req.method === 'POST') {
      const customerId = pathParts[1];
      const { prices } = req.body; // [{service_id, price}]
      if (!prices || !Array.isArray(prices)) return res.status(400).json({ error: '단가 정보가 필요합니다.' });

      for (const p of prices) {
        if (!p.service_id) continue;
        const existing = await query(
          'SELECT * FROM service_prices WHERE service_id::text = $1 AND customer_id::text = $2',
          [p.service_id, customerId]
        );
        if (p.price === null || p.price === undefined || p.price === '') {
          // 가격이 비어있으면 삭제
          if (existing.rows.length > 0) {
            await query('DELETE FROM service_prices WHERE service_id::text = $1 AND customer_id::text = $2', [p.service_id, customerId]);
          }
        } else if (existing.rows.length > 0) {
          await query('UPDATE service_prices SET price = $1 WHERE service_id::text = $2 AND customer_id::text = $3', [p.price, p.service_id, customerId]);
        } else {
          const id = uuidv4();
          await query('INSERT INTO service_prices (id, service_id, customer_id, price) VALUES ($1, $2, $3, $4)', [id, p.service_id, customerId, p.price]);
        }
      }

      const result = await query(
        `SELECT sp.*, s.name as service_name, s.category as service_category, s.price as base_price
         FROM service_prices sp
         LEFT JOIN services s ON sp.service_id::text = s.id::text
         WHERE sp.customer_id::text = $1
         ORDER BY s.category, s.name`,
        [customerId]
      );
      return res.json(result.rows);
    }

    // POST /api/sales/orders/bulk-delete - 주문 대량 삭제
    if (pathParts[0] === 'orders' && pathParts[1] === 'bulk-delete' && req.method === 'POST') {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '삭제할 주문을 선택해주세요.' });
      let deleted = 0;
      for (const id of ids) {
        await query("DELETE FROM transactions WHERE reference_id::text = $1 AND reference_type IN ('order', 'order_vendor', 'order_refund', 'order_vendor_refund')", [id]);
        await query('DELETE FROM order_items WHERE order_id::text = $1', [id]);
        await query('DELETE FROM order_vendor_items WHERE order_id::text = $1', [id]);
        await query('DELETE FROM order_incentives WHERE order_id::text = $1', [id]);
        await query('DELETE FROM blog_posts WHERE order_id::text = $1', [id]);
        const result = await query('DELETE FROM orders WHERE id::text = $1', [id]);
        if (result.rowCount > 0) deleted++;
      }
      return res.json({ message: `${deleted}건의 주문이 삭제되었습니다.`, deleted });
    }

    if (pathParts[0] === 'orders' && req.method === 'GET' && !pathParts[1]) {
      // 날짜 기반 자동 상태 변경 (cancelled 상태는 제외)
      // 1. 종료일이 지난 주문 → 종료 (completed)
      await query(`UPDATE orders SET status = 'completed' WHERE status != 'cancelled' AND due_date IS NOT NULL AND due_date < CURRENT_DATE`);
      // 2. 종료일 당일 → 종료임박 (near_due)
      await query(`UPDATE orders SET status = 'near_due' WHERE status != 'cancelled' AND status != 'completed' AND due_date IS NOT NULL AND due_date = CURRENT_DATE`);
      // 3. 시작일 이후 ~ 종료일 전 → 진행중 (processing)
      await query(`UPDATE orders SET status = 'processing' WHERE status != 'cancelled' AND status != 'completed' AND status != 'near_due' AND start_date IS NOT NULL AND start_date <= CURRENT_DATE AND (due_date IS NULL OR due_date > CURRENT_DATE)`);
      // 4. 시작일 전 → 대기 (pending)
      await query(`UPDATE orders SET status = 'pending' WHERE status != 'cancelled' AND status != 'completed' AND status != 'near_due' AND status != 'processing' AND (start_date IS NULL OR start_date > CURRENT_DATE)`);

      const { status, customerId } = queryParams;
      let result;
      const baseSelect = `SELECT o.*, c.name as customer_name, c.company as customer_company, e.name as assignee_name,
        (SELECT string_agg(item_name, ', ' ORDER BY id) FROM (SELECT item_name, id FROM order_items WHERE order_id::text = o.id::text AND (item_type IS NULL OR item_type = 'normal') LIMIT 3) sub) as items_summary,
        (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id::text = o.id::text AND (item_type IS NULL OR item_type = 'normal')) as total_quantity,
        (SELECT COUNT(*) FROM order_items WHERE order_id::text = o.id::text AND (item_type IS NULL OR item_type = 'normal')) as items_count
        FROM orders o LEFT JOIN customers c ON o.customer_id::text = c.id::text LEFT JOIN employees e ON o.assignee_id::text = e.id::text`;
      if (status && customerId) {
        result = await query(`${baseSelect} WHERE o.status = $1 AND o.customer_id::text = $2 ORDER BY o.order_date DESC`, [status, customerId]);
      } else if (status) {
        result = await query(`${baseSelect} WHERE o.status = $1 ORDER BY o.order_date DESC`, [status]);
      } else if (customerId) {
        result = await query(`${baseSelect} WHERE o.customer_id::text = $1 ORDER BY o.order_date DESC`, [customerId]);
      } else {
        result = await query(`${baseSelect} ORDER BY o.order_date DESC`);
      }
      return res.json(result.rows);
    }

    // GET /api/sales/orders/:id/logs - 주문 수정 내역 로그 조회
    if (pathParts[0] === 'orders' && pathParts[1] && pathParts[2] === 'logs' && req.method === 'GET') {
      const orderId = pathParts[1];
      const logs = await query(
        `SELECT * FROM order_edit_logs WHERE order_id::text = $1 ORDER BY created_at DESC`,
        [orderId]
      );
      return res.json(logs.rows);
    }

    if (pathParts[0] === 'orders' && pathParts[1] && pathParts[1] !== 'bulk-delete' && !pathParts[2] && req.method === 'GET') {
      const id = pathParts[1];
      console.log('Fetching order details for id:', id);
      const orderResult = await query('SELECT o.*, c.name as customer_name, c.company as customer_company, e.name as assignee_name FROM orders o LEFT JOIN customers c ON o.customer_id::text = c.id::text LEFT JOIN employees e ON o.assignee_id::text = e.id::text WHERE o.id::text = $1', [id]);
      if (orderResult.rows.length === 0) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      const itemsResult = await query("SELECT oi.*, COALESCE(oi.item_type, 'normal') as item_type FROM order_items oi WHERE oi.order_id::text = $1 ORDER BY oi.item_type, oi.id", [id]);
      console.log('Order items found:', itemsResult.rows.length, 'items');
      const vendorItemsResult = await query(
        `SELECT ovi.*, v.name as vendor_name, vp.product_name, vp.cost_price, COALESCE(ovi.item_type, 'normal') as item_type
         FROM order_vendor_items ovi
         LEFT JOIN vendors v ON ovi.vendor_id::text = v.id::text
         LEFT JOIN vendor_products vp ON ovi.vendor_product_id::text = vp.id::text
         WHERE ovi.order_id::text = $1 ORDER BY ovi.item_type, v.name, vp.product_name`, [id]
      );
      console.log('Order vendor items found:', vendorItemsResult.rows.length, 'items');
      // 인센티브 조회
      const incentivesResult = await query(
        `SELECT oi.*, e.name as employee_name, e.department as employee_department,
          ip.name as policy_name
         FROM order_incentives oi
         LEFT JOIN employees e ON oi.employee_id::text = e.id::text
         LEFT JOIN incentive_policies ip ON oi.policy_id::text = ip.id::text
         WHERE oi.order_id::text = $1 ORDER BY oi.created_at`, [id]
      );
      const order = orderResult.rows[0];
      return res.json({ ...order, items: itemsResult.rows, vendor_items: vendorItemsResult.rows, incentives: incentivesResult.rows });
    }

    if (pathParts[0] === 'orders' && !pathParts[1] && req.method === 'POST') {
      const { customer_id, assignee_id, order_date, start_date, due_date, notes, items, vendor_items, incentives } = req.body;
      if (!customer_id || !order_date) return res.status(400).json({ error: '필수 필드를 입력해주세요.' });

      const id = uuidv4();
      // 순차 주문번호 생성 (0001, 0002, ...)
      const maxResult = await query("SELECT order_number FROM orders ORDER BY order_number DESC LIMIT 1");
      let nextNum = 1;
      if (maxResult.rows.length > 0) {
        const lastNum = parseInt(maxResult.rows[0].order_number, 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const orderNumber = String(nextNum).padStart(4, '0');

      // 총액 계산: normal 항목 합계 - refund 항목 합계
      let normalTotal = 0;
      let refundTotal = 0;
      if (items && items.length > 0) {
        for (const item of items) {
          const itemTotal = Math.abs(item.quantity) * item.unit_price;
          if (item.item_type === 'refund') {
            refundTotal += itemTotal;
          } else {
            normalTotal += itemTotal;
          }
        }
      }
      const totalAmount = normalTotal - refundTotal;

      await query('INSERT INTO orders (id, order_number, customer_id, assignee_id, total_amount, order_date, start_date, due_date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, orderNumber, customer_id, assignee_id || null, totalAmount, order_date, start_date || null, due_date || null, notes || null]);

      if (items && items.length > 0) {
        for (const item of items) {
          const itemId = uuidv4();
          const totalPrice = Math.abs(item.quantity) * item.unit_price;
          const itemType = item.item_type || 'normal';
          await query('INSERT INTO order_items (id, order_id, item_id, item_name, quantity, unit_price, total_price, item_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [itemId, id, item.item_id, item.item_name || null, Math.abs(item.quantity), item.unit_price, totalPrice, itemType]);
        }
      }
      if (vendor_items && vendor_items.length > 0) {
        for (const vi of vendor_items) {
          if (!vi.vendor_id || !vi.vendor_product_id) continue;
          const viId = uuidv4();
          const totalPrice = Math.abs(vi.quantity || 1) * (vi.unit_price || 0);
          const itemType = vi.item_type || 'normal';
          await query('INSERT INTO order_vendor_items (id, order_id, vendor_id, vendor_product_id, quantity, unit_price, total_price, item_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [viId, id, vi.vendor_id, vi.vendor_product_id, Math.abs(vi.quantity || 1), vi.unit_price || 0, totalPrice, itemType]);
        }
      }
      // 인센티브 생성
      if (incentives && incentives.length > 0) {
        for (const inc of incentives) {
          if (!inc.employee_id) continue;
          let incAmount = parseFloat(inc.amount) || 0;
          if (inc.policy_id && !inc.amount) {
            const policy = await query('SELECT amount FROM incentive_policies WHERE id::text = $1', [inc.policy_id]);
            if (policy.rows.length > 0) incAmount = parseFloat(policy.rows[0].amount) || 0;
          }
          const incQty = parseInt(inc.quantity) || 1;
          const incId = uuidv4();
          await query('INSERT INTO order_incentives (id, order_id, employee_id, policy_id, amount, quantity, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)', [incId, id, inc.employee_id, inc.policy_id || null, incAmount, incQty, inc.notes || null]);
        }
      }

      // 매출/환불 거래 자동 생성
      const customerResult = await query('SELECT name, company FROM customers WHERE id::text = $1', [customer_id]);
      const custName = customerResult.rows[0]?.company || customerResult.rows[0]?.name || '';
      if (normalTotal > 0) {
        const txnId = uuidv4();
        await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [txnId, 'income', '매출', normalTotal, `주문 ${orderNumber} - ${custName}`, order_date, id, 'order']);
      }
      if (refundTotal > 0) {
        const txnId = uuidv4();
        await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [txnId, 'expense', '환불', refundTotal, `환불 ${orderNumber} - ${custName}`, order_date, id, 'order_refund']);
      }

      // 업체상품 지출/환입 거래 자동 생성
      if (vendor_items && vendor_items.length > 0) {
        let vendorNormal = 0;
        let vendorRefund = 0;
        for (const vi of vendor_items) {
          const viTotal = Math.abs(vi.quantity || 1) * (vi.unit_price || 0);
          if (vi.item_type === 'refund') {
            vendorRefund += viTotal;
          } else {
            vendorNormal += viTotal;
          }
        }
        if (vendorNormal > 0) {
          const vtxnId = uuidv4();
          await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [vtxnId, 'expense', '업체상품', vendorNormal, `주문 ${orderNumber} - ${custName} 업체상품`, order_date, id, 'order_vendor']);
        }
        if (vendorRefund > 0) {
          const vtxnId = uuidv4();
          await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [vtxnId, 'income', '업체상품환입', vendorRefund, `환불 ${orderNumber} - ${custName} 업체상품 환입`, order_date, id, 'order_vendor_refund']);
        }
      }

      // 주문 생성 로그 기록
      const customerResult2 = await query('SELECT name, company FROM customers WHERE id::text = $1', [customer_id]);
      const customerInfo = customerResult2.rows[0]?.company || customerResult2.rows[0]?.name || '';
      const logId = uuidv4();
      await query(
        `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [logId, id, 'created', null, null, null, `주문 생성: ${orderNumber} - ${customerInfo} (${formatCurrency(totalAmount)})`, user.name || user.email || 'System']
      );

      // 생성 시 상품 항목 상세 로그
      if (items && items.length > 0) {
        for (const item of items) {
          const itemLogId = uuidv4();
          const itemDetail = `${item.item_name || '상품'} x ${Math.abs(item.quantity)}개 @ ${formatCurrency(item.unit_price)}`;
          const isRefund = item.item_type === 'refund';
          await query(
            `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [itemLogId, id, 'created', isRefund ? 'item_refund' : 'item_add', null, formatCurrency(Math.abs(item.quantity) * item.unit_price), `[${isRefund ? '환불' : '추가'}] ${itemDetail}`, user.name || user.email || 'System']
          );
        }
      }

      // 생성 시 업체상품 항목 상세 로그
      if (vendor_items && vendor_items.length > 0) {
        for (const vi of vendor_items) {
          if (!vi.vendor_id || !vi.vendor_product_id) continue;
          const vendorInfo = await query('SELECT name FROM vendors WHERE id::text = $1', [vi.vendor_id]);
          const productInfo = await query('SELECT product_name FROM vendor_products WHERE id::text = $1', [vi.vendor_product_id]);
          const vendorName = vendorInfo.rows[0]?.name || '업체';
          const productName = productInfo.rows[0]?.product_name || '상품';
          const viLogId = uuidv4();
          const itemDetail = `${vendorName} - ${productName} x ${Math.abs(vi.quantity || 1)}개 @ ${formatCurrency(vi.unit_price || 0)}`;
          const isRefund = vi.item_type === 'refund';
          await query(
            `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [viLogId, id, 'created', isRefund ? 'vendor_item_refund' : 'vendor_item_add', null, formatCurrency(Math.abs(vi.quantity || 1) * (vi.unit_price || 0)), `[업체상품${isRefund ? ' 환불' : ''}] ${itemDetail}`, user.name || user.email || 'System']
          );
        }
      }

      // 블로그 발행목록 자동 생성: is_blog=true인 서비스 상품이 포함된 경우
      if (items && items.length > 0) {
        for (const item of items) {
          if (!item.item_id || item.item_type === 'refund') continue;
          const svcResult = await query('SELECT * FROM services WHERE id::text = $1 AND is_blog = true', [item.item_id]);
          if (svcResult.rows.length > 0) {
            const qty = Math.abs(item.quantity) || 1;
            for (let i = 0; i < qty; i++) {
              const blogId = uuidv4();
              await query(
                `INSERT INTO blog_posts (id, order_id, order_item_id, customer_id, service_id, due_date, assigned_to)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [blogId, id, item.item_id, customer_id, item.item_id, due_date || null, assignee_id || null]
              );
            }
          }
        }
      }

      const result = await query('SELECT * FROM orders WHERE id::text = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    if (pathParts[0] === 'orders' && pathParts[1] && pathParts[1] !== 'bulk-delete' && req.method === 'PUT') {
      const id = pathParts[1];
      const { customer_id, assignee_id, order_date, start_date, due_date, status, notes, items, vendor_items, incentives } = req.body;
      const current = await query('SELECT * FROM orders WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      const order = current.rows[0];

      // 기존 항목들 조회 (변경 비교용)
      const existingItems = await query('SELECT * FROM order_items WHERE order_id::text = $1', [id]);
      const existingVendorItems = await query(`
        SELECT ovi.*, v.name as vendor_name, vp.product_name
        FROM order_vendor_items ovi
        LEFT JOIN vendors v ON ovi.vendor_id::text = v.id::text
        LEFT JOIN vendor_products vp ON ovi.vendor_product_id::text = vp.id::text
        WHERE ovi.order_id::text = $1
      `, [id]);

      // 총액 계산: normal 항목 합계 - refund 항목 합계
      let totalAmount = order.total_amount;
      let normalTotal = 0;
      let refundTotal = 0;
      if (items !== undefined && items.length > 0) {
        for (const item of items) {
          const itemTotal = Math.abs(item.quantity) * item.unit_price;
          if (item.item_type === 'refund') {
            refundTotal += itemTotal;
          } else {
            normalTotal += itemTotal;
          }
        }
        totalAmount = normalTotal - refundTotal;
      } else if (items && items.length === 0) {
        totalAmount = 0;
      }

      await query(
        'UPDATE orders SET customer_id = $1, assignee_id = $2, order_date = $3, start_date = $4, due_date = $5, status = $6, notes = $7, total_amount = $8 WHERE id::text = $9',
        [
          customer_id || order.customer_id,
          assignee_id !== undefined ? (assignee_id || null) : order.assignee_id,
          order_date || order.order_date,
          start_date !== undefined ? (start_date || null) : order.start_date,
          due_date !== undefined ? (due_date || null) : order.due_date,
          status || order.status,
          notes !== undefined ? notes : order.notes,
          totalAmount,
          id
        ]
      );

      // 주문 항목 업데이트
      if (items !== undefined) {
        await query('DELETE FROM order_items WHERE order_id::text = $1', [id]);
        if (items.length > 0) {
          for (const item of items) {
            const itemId = uuidv4();
            const totalPrice = Math.abs(item.quantity) * item.unit_price;
            const itemType = item.item_type || 'normal';
            await query('INSERT INTO order_items (id, order_id, item_id, item_name, quantity, unit_price, total_price, item_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [itemId, id, item.item_id, item.item_name || null, Math.abs(item.quantity), item.unit_price, totalPrice, itemType]);
          }
        }
      }

      // 업체상품 항목 업데이트
      if (vendor_items !== undefined) {
        await query('DELETE FROM order_vendor_items WHERE order_id::text = $1', [id]);
        if (vendor_items.length > 0) {
          for (const vi of vendor_items) {
            if (!vi.vendor_id || !vi.vendor_product_id) continue;
            const viId = uuidv4();
            const totalPrice = Math.abs(vi.quantity || 1) * (vi.unit_price || 0);
            const itemType = vi.item_type || 'normal';
            await query('INSERT INTO order_vendor_items (id, order_id, vendor_id, vendor_product_id, quantity, unit_price, total_price, item_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [viId, id, vi.vendor_id, vi.vendor_product_id, Math.abs(vi.quantity || 1), vi.unit_price || 0, totalPrice, itemType]);
          }
        }
      }

      // 인센티브 항목 업데이트
      if (incentives !== undefined) {
        await query('DELETE FROM order_incentives WHERE order_id::text = $1', [id]);
        if (incentives.length > 0) {
          for (const inc of incentives) {
            if (!inc.employee_id) continue;
            let incAmount = parseFloat(inc.amount) || 0;
            if (inc.policy_id && !inc.amount) {
              const policy = await query('SELECT amount FROM incentive_policies WHERE id::text = $1', [inc.policy_id]);
              if (policy.rows.length > 0) incAmount = parseFloat(policy.rows[0].amount) || 0;
            }
            const incQty = parseInt(inc.quantity) || 1;
            const incId = uuidv4();
            await query('INSERT INTO order_incentives (id, order_id, employee_id, policy_id, amount, quantity, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [incId, id, inc.employee_id, inc.policy_id || null, incAmount, incQty, inc.status || 'pending', inc.notes || null]);
          }
        }
      }

      // 매출/지출 거래 동기화 (기존 삭제 후 재생성)
      await query("DELETE FROM transactions WHERE reference_id::text = $1 AND reference_type IN ('order', 'order_vendor', 'order_refund', 'order_vendor_refund')", [id]);
      const updatedOrder = await query('SELECT order_number, order_date FROM orders WHERE id::text = $1', [id]);
      const custResult = await query('SELECT name, company FROM customers WHERE id::text = $1', [customer_id || order.customer_id]);
      const custName = custResult.rows[0]?.company || custResult.rows[0]?.name || '';

      // 항목별로 매출/환불 거래 생성
      if (items !== undefined) {
        if (normalTotal > 0) {
          const txnId = uuidv4();
          await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [txnId, 'income', '매출', normalTotal, `주문 ${updatedOrder.rows[0].order_number} - ${custName}`, order_date || order.order_date, id, 'order']);
        }
        if (refundTotal > 0) {
          const txnId = uuidv4();
          await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [txnId, 'expense', '환불', refundTotal, `환불 ${updatedOrder.rows[0].order_number} - ${custName}`, order_date || order.order_date, id, 'order_refund']);
        }
      } else if (totalAmount > 0) {
        // items가 없고 totalAmount만 있는 경우 (기존 호환)
        const txnId = uuidv4();
        await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [txnId, 'income', '매출', totalAmount, `주문 ${updatedOrder.rows[0].order_number} - ${custName}`, order_date || order.order_date, id, 'order']);
      }

      // 업체상품 지출/환입 거래 재생성 (item_type 기준)
      const vendorNormalResult = await query("SELECT COALESCE(SUM(total_price), 0) as total FROM order_vendor_items WHERE order_id::text = $1 AND (item_type IS NULL OR item_type = 'normal')", [id]);
      const vendorRefundResult = await query("SELECT COALESCE(SUM(total_price), 0) as total FROM order_vendor_items WHERE order_id::text = $1 AND item_type = 'refund'", [id]);
      const vendorNormalTotal = parseFloat(vendorNormalResult.rows[0].total) || 0;
      const vendorRefundTotal = parseFloat(vendorRefundResult.rows[0].total) || 0;
      if (vendorNormalTotal > 0) {
        const vtxnId = uuidv4();
        await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [vtxnId, 'expense', '업체상품', vendorNormalTotal, `주문 ${updatedOrder.rows[0].order_number} - ${custName} 업체상품`, order_date || order.order_date, id, 'order_vendor']);
      }
      if (vendorRefundTotal > 0) {
        const vtxnId = uuidv4();
        await query('INSERT INTO transactions (id, type, category, amount, description, date, reference_id, reference_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [vtxnId, 'income', '업체상품환입', vendorRefundTotal, `환불 ${updatedOrder.rows[0].order_number} - ${custName} 업체상품 환입`, order_date || order.order_date, id, 'order_vendor_refund']);
      }

      // 주문 수정 로그 기록
      const changes = [];
      const oldAmount = parseFloat(order.total_amount) || 0;
      const newAmount = totalAmount;

      // 상태 변경
      if (status && status !== order.status) {
        const statusLabels = { pending: '대기', processing: '진행중', near_due: '종료임박', completed: '종료' };
        changes.push(`상태: ${statusLabels[order.status] || order.status} → ${statusLabels[status] || status}`);
        const logId = uuidv4();
        await query(
          `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, 'updated', 'status', order.status, status, `상태 변경: ${statusLabels[order.status] || order.status} → ${statusLabels[status] || status}`, user.name || user.email || 'System']
        );
      }

      // 금액 변경
      if (oldAmount !== newAmount) {
        changes.push(`금액: ${formatCurrency(oldAmount)} → ${formatCurrency(newAmount)}`);
        const logId = uuidv4();
        await query(
          `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, 'updated', 'total_amount', String(oldAmount), String(newAmount), `금액 변경: ${formatCurrency(oldAmount)} → ${formatCurrency(newAmount)}`, user.name || user.email || 'System']
        );
      }

      // 담당자 변경
      if (assignee_id !== undefined && assignee_id !== order.assignee_id) {
        const oldAssignee = order.assignee_id ? (await query('SELECT name FROM employees WHERE id::text = $1', [order.assignee_id])).rows[0]?.name : '없음';
        const newAssignee = assignee_id ? (await query('SELECT name FROM employees WHERE id::text = $1', [assignee_id])).rows[0]?.name : '없음';
        changes.push(`담당자: ${oldAssignee || '없음'} → ${newAssignee || '없음'}`);
        const logId = uuidv4();
        await query(
          `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, 'updated', 'assignee', oldAssignee || '없음', newAssignee || '없음', `담당자 변경: ${oldAssignee || '없음'} → ${newAssignee || '없음'}`, user.name || user.email || 'System']
        );
      }

      // 마감일 변경
      const formatDateForLog = (d) => d ? String(d).split('T')[0] : '없음';
      if (due_date !== undefined && formatDateForLog(due_date) !== formatDateForLog(order.due_date)) {
        changes.push(`마감일: ${formatDateForLog(order.due_date)} → ${formatDateForLog(due_date)}`);
        const logId = uuidv4();
        await query(
          `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, 'updated', 'due_date', formatDateForLog(order.due_date), formatDateForLog(due_date), `마감일 변경: ${formatDateForLog(order.due_date)} → ${formatDateForLog(due_date)}`, user.name || user.email || 'System']
        );
      }

      // 메모 변경
      if (notes !== undefined && notes !== order.notes) {
        const logId = uuidv4();
        await query(
          `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, 'updated', 'notes', order.notes || '', notes || '', `메모 변경`, user.name || user.email || 'System']
        );
      }

      // 서비스 상품 항목 변경 상세 로그 기록 (기존 항목과 비교)
      if (items !== undefined) {
        const oldItems = existingItems.rows;
        const newItems = items;

        // 기존 항목을 item_id + item_type 조합으로 맵핑
        const oldItemMap = new Map();
        for (const item of oldItems) {
          const key = `${item.item_id || item.item_name}_${item.item_type || 'normal'}`;
          oldItemMap.set(key, item);
        }

        // 새 항목을 item_id + item_type 조합으로 맵핑
        const newItemMap = new Map();
        for (const item of newItems) {
          const key = `${item.item_id || item.item_name}_${item.item_type || 'normal'}`;
          newItemMap.set(key, item);
        }

        // 삭제된 항목 (기존에 있었는데 새로운 목록에 없는 것)
        for (const [key, oldItem] of oldItemMap) {
          if (!newItemMap.has(key)) {
            const logId = uuidv4();
            const itemType = oldItem.item_type || 'normal';
            const typeLabel = itemType === 'refund' ? '환불' : '일반';
            const itemDetail = `[서비스 상품 삭제] ${oldItem.item_name || '상품'} (${typeLabel}) ${oldItem.quantity}개 x ${formatCurrency(oldItem.unit_price)} = ${formatCurrency(oldItem.total_price)}`;
            await query(
              `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [logId, id, 'updated', 'item_delete', `${oldItem.quantity}개 x ${formatCurrency(oldItem.unit_price)}`, null, itemDetail, user.name || user.email || 'System']
            );
          }
        }

        // 추가된 항목 또는 수정된 항목
        for (const [key, newItem] of newItemMap) {
          const oldItem = oldItemMap.get(key);
          const itemType = newItem.item_type || 'normal';
          const typeLabel = itemType === 'refund' ? '환불' : '일반';
          const newQty = Math.abs(newItem.quantity);
          const newPrice = newItem.unit_price;
          const newTotal = newQty * newPrice;

          if (!oldItem) {
            // 새로 추가된 항목
            const logId = uuidv4();
            const itemDetail = `[서비스 상품 추가] ${newItem.item_name || '상품'} (${typeLabel}) ${newQty}개 x ${formatCurrency(newPrice)} = ${formatCurrency(newTotal)}`;
            await query(
              `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [logId, id, 'updated', itemType === 'refund' ? 'item_refund_add' : 'item_add', null, `${newQty}개 x ${formatCurrency(newPrice)}`, itemDetail, user.name || user.email || 'System']
            );
          } else {
            // 기존 항목 - 수량이나 가격이 변경되었는지 확인
            const oldQty = Math.abs(oldItem.quantity);
            const oldPrice = parseFloat(oldItem.unit_price);
            const oldTotal = oldQty * oldPrice;

            if (oldQty !== newQty || oldPrice !== newPrice) {
              const logId = uuidv4();
              let changeDetails = [];
              if (oldQty !== newQty) changeDetails.push(`수량: ${oldQty}개 → ${newQty}개`);
              if (oldPrice !== newPrice) changeDetails.push(`단가: ${formatCurrency(oldPrice)} → ${formatCurrency(newPrice)}`);
              const itemDetail = `[서비스 상품 수정] ${newItem.item_name || oldItem.item_name || '상품'} (${typeLabel}) ${changeDetails.join(', ')} | 합계: ${formatCurrency(oldTotal)} → ${formatCurrency(newTotal)}`;
              await query(
                `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [logId, id, 'updated', itemType === 'refund' ? 'item_refund_modify' : 'item_modify', `${oldQty}개 x ${formatCurrency(oldPrice)}`, `${newQty}개 x ${formatCurrency(newPrice)}`, itemDetail, user.name || user.email || 'System']
              );
            }
          }
        }
      }

      // 업체상품 항목 변경 상세 로그 기록 (기존 항목과 비교)
      if (vendor_items !== undefined) {
        const oldVendorItems = existingVendorItems.rows;
        const newVendorItems = vendor_items;

        // 기존 항목을 vendor_id + product_id + item_type 조합으로 맵핑
        const oldVendorMap = new Map();
        for (const item of oldVendorItems) {
          const key = `${item.vendor_id}_${item.vendor_product_id}_${item.item_type || 'normal'}`;
          oldVendorMap.set(key, item);
        }

        // 새 항목을 vendor_id + product_id + item_type 조합으로 맵핑
        const newVendorMap = new Map();
        for (const item of newVendorItems) {
          if (!item.vendor_id || !item.vendor_product_id) continue;
          const key = `${item.vendor_id}_${item.vendor_product_id}_${item.item_type || 'normal'}`;
          newVendorMap.set(key, item);
        }

        // 삭제된 업체상품
        for (const [key, oldItem] of oldVendorMap) {
          if (!newVendorMap.has(key)) {
            const logId = uuidv4();
            const itemType = oldItem.item_type || 'normal';
            const typeLabel = itemType === 'refund' ? '환불' : '일반';
            const vendorName = oldItem.vendor_name || '업체';
            const productName = oldItem.product_name || '상품';
            const itemDetail = `[업체상품 삭제] ${vendorName} / ${productName} (${typeLabel}) ${oldItem.quantity}개 x ${formatCurrency(oldItem.unit_price)} = ${formatCurrency(oldItem.total_price)}`;
            await query(
              `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [logId, id, 'updated', 'vendor_item_delete', `${oldItem.quantity}개 x ${formatCurrency(oldItem.unit_price)}`, null, itemDetail, user.name || user.email || 'System']
            );
          }
        }

        // 추가된 또는 수정된 업체상품
        for (const [key, newItem] of newVendorMap) {
          const oldItem = oldVendorMap.get(key);
          const itemType = newItem.item_type || 'normal';
          const typeLabel = itemType === 'refund' ? '환불' : '일반';
          const newQty = Math.abs(newItem.quantity || 1);
          const newPrice = newItem.unit_price || 0;
          const newTotal = newQty * newPrice;

          // 업체명, 상품명 조회
          const vendorInfo = await query('SELECT name FROM vendors WHERE id::text = $1', [newItem.vendor_id]);
          const productInfo = await query('SELECT product_name FROM vendor_products WHERE id::text = $1', [newItem.vendor_product_id]);
          const vendorName = vendorInfo.rows[0]?.name || '업체';
          const productName = productInfo.rows[0]?.product_name || '상품';

          if (!oldItem) {
            // 새로 추가된 업체상품
            const logId = uuidv4();
            const itemDetail = `[업체상품 추가] ${vendorName} / ${productName} (${typeLabel}) ${newQty}개 x ${formatCurrency(newPrice)} = ${formatCurrency(newTotal)}`;
            await query(
              `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [logId, id, 'updated', itemType === 'refund' ? 'vendor_item_refund_add' : 'vendor_item_add', null, `${newQty}개 x ${formatCurrency(newPrice)}`, itemDetail, user.name || user.email || 'System']
            );
          } else {
            // 기존 업체상품 - 수량이나 가격 변경 확인
            const oldQty = Math.abs(oldItem.quantity);
            const oldPrice = parseFloat(oldItem.unit_price);
            const oldTotal = oldQty * oldPrice;

            if (oldQty !== newQty || oldPrice !== newPrice) {
              const logId = uuidv4();
              let changeDetails = [];
              if (oldQty !== newQty) changeDetails.push(`수량: ${oldQty}개 → ${newQty}개`);
              if (oldPrice !== newPrice) changeDetails.push(`단가: ${formatCurrency(oldPrice)} → ${formatCurrency(newPrice)}`);
              const itemDetail = `[업체상품 수정] ${vendorName} / ${productName} (${typeLabel}) ${changeDetails.join(', ')} | 합계: ${formatCurrency(oldTotal)} → ${formatCurrency(newTotal)}`;
              await query(
                `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [logId, id, 'updated', itemType === 'refund' ? 'vendor_item_refund_modify' : 'vendor_item_modify', `${oldQty}개 x ${formatCurrency(oldPrice)}`, `${newQty}개 x ${formatCurrency(newPrice)}`, itemDetail, user.name || user.email || 'System']
              );
            }
          }
        }
      }

      // 블로그 발행목록 동기화: items 변경 시 is_blog 서비스 재집계
      if (items !== undefined) {
        // 기존 blog_posts 중 아직 pending 상태인 것만 삭제 (작성중/발행완료는 유지)
        await query("DELETE FROM blog_posts WHERE order_id::text = $1 AND publish_status = 'pending'", [id]);
        // 새 항목에서 is_blog 서비스 감지 후 생성
        for (const item of items) {
          if (!item.item_id || item.item_type === 'refund') continue;
          const svcResult = await query('SELECT * FROM services WHERE id::text = $1 AND is_blog = true', [item.item_id]);
          if (svcResult.rows.length > 0) {
            // 이미 이 주문+서비스로 작성중/발행 상태인 건수를 확인
            const existingCount = await query(
              "SELECT COUNT(*) as cnt FROM blog_posts WHERE order_id::text = $1 AND service_id::text = $2 AND publish_status != 'pending'",
              [id, item.item_id]
            );
            const alreadyExists = parseInt(existingCount.rows[0].cnt) || 0;
            const qty = Math.abs(item.quantity) || 1;
            const toCreate = Math.max(0, qty - alreadyExists);
            for (let i = 0; i < toCreate; i++) {
              const blogId = uuidv4();
              await query(
                `INSERT INTO blog_posts (id, order_id, order_item_id, customer_id, service_id, due_date, assigned_to)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [blogId, id, item.item_id, customer_id || order.customer_id, item.item_id, due_date !== undefined ? (due_date || null) : order.due_date, assignee_id !== undefined ? (assignee_id || null) : order.assignee_id]
              );
            }
          }
        }
      }

      const result = await query('SELECT o.*, c.name as customer_name, c.company as customer_company, e.name as assignee_name FROM orders o LEFT JOIN customers c ON o.customer_id::text = c.id::text LEFT JOIN employees e ON o.assignee_id::text = e.id::text WHERE o.id::text = $1', [id]);
      return res.json(result.rows[0]);
    }

    if (pathParts[0] === 'orders' && pathParts[1] && pathParts[1] !== 'bulk-delete' && req.method === 'DELETE') {
      const id = pathParts[1];
      // 삭제 전 주문 정보 조회
      const orderToDelete = await query('SELECT o.*, c.company, c.name as customer_name FROM orders o LEFT JOIN customers c ON o.customer_id::text = c.id::text WHERE o.id::text = $1', [id]);
      if (orderToDelete.rows.length > 0) {
        const ord = orderToDelete.rows[0];
        const logId = uuidv4();
        await query(
          `INSERT INTO order_edit_logs (id, order_id, action, field_name, old_value, new_value, change_summary, edited_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [logId, id, 'deleted', null, null, null, `주문 삭제: ${ord.order_number} - ${ord.company || ord.customer_name} (${formatCurrency(parseFloat(ord.total_amount) || 0)})`, user.name || user.email || 'System']
        );
      }
      await query("DELETE FROM transactions WHERE reference_id::text = $1 AND reference_type IN ('order', 'order_vendor', 'order_refund', 'order_vendor_refund')", [id]);
      await query('DELETE FROM order_items WHERE order_id::text = $1', [id]);
      await query('DELETE FROM order_vendor_items WHERE order_id::text = $1', [id]);
      await query('DELETE FROM order_incentives WHERE order_id::text = $1', [id]);
      await query('DELETE FROM blog_posts WHERE order_id::text = $1', [id]);
      const result = await query('DELETE FROM orders WHERE id::text = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      return res.json({ message: '주문이 삭제되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({
      error: '서버 오류: ' + (error.message || '알 수 없는 오류'),
      path: pathParts.join('/'),
      method: req.method
    });
  }
}
