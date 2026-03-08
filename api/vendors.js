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
  const path = url.pathname.replace('/api/vendors', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('vendors', async () => {
      await query(`CREATE TABLE IF NOT EXISTS vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        representative VARCHAR(255),
        phone VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      await query(`CREATE TABLE IF NOT EXISTS vendor_products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_id UUID NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        cost_price DECIMAL(15,2) DEFAULT 0,
        service_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      // service_id 컬럼이 없으면 추가
      await query(`ALTER TABLE vendor_products ADD COLUMN IF NOT EXISTS service_id VARCHAR(255)`).catch(() => {});
      // 서비스 테이블 생성 (없을 경우)
      await query(`CREATE TABLE IF NOT EXISTS services (id VARCHAR(255) PRIMARY KEY, service_code VARCHAR(100) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL, description TEXT DEFAULT '', price DECIMAL(15,2) DEFAULT 0, unit VARCHAR(50) DEFAULT '건', duration VARCHAR(100) DEFAULT '', status VARCHAR(50) DEFAULT 'active', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await query(`CREATE TABLE IF NOT EXISTS service_vendor_items (id VARCHAR(255) PRIMARY KEY, service_id VARCHAR(255) NOT NULL, vendor_id VARCHAR(255) NOT NULL, vendor_product_id VARCHAR(255) NOT NULL, quantity INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await query(`CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type VARCHAR(50) NOT NULL, category VARCHAR(100) NOT NULL, amount DECIMAL(15,2) DEFAULT 0, description TEXT, date DATE, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255)`).catch(() => {});
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`).catch(() => {});
    });

    // GET /api/vendors - 업체 목록
    if (req.method === 'GET' && !pathParts[0]) {
      const result = await query('SELECT * FROM vendors ORDER BY created_at DESC');
      // 각 업체의 상품 수 포함
      const vendors = [];
      for (const v of result.rows) {
        const products = await query('SELECT COUNT(*)::int as count FROM vendor_products WHERE vendor_id::text = $1', [v.id]);
        vendors.push({ ...v, product_count: products.rows[0]?.count || 0 });
      }
      return res.json(vendors);
    }

    // GET /api/vendors/:id - 업체 상세 (상품 포함)
    if (pathParts[0] && !pathParts[1] && req.method === 'GET') {
      const result = await query('SELECT * FROM vendors WHERE id::text = $1', [pathParts[0]]);
      if (result.rows.length === 0) return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
      const products = await query('SELECT * FROM vendor_products WHERE vendor_id::text = $1 ORDER BY created_at ASC', [pathParts[0]]);
      return res.json({ ...result.rows[0], products: products.rows });
    }

    // POST /api/vendors/bulk-delete - 일괄 삭제
    if (pathParts[0] === 'bulk-delete' && req.method === 'POST') {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '삭제할 업체를 선택해주세요.' });
      }
      let deleted = 0;
      for (const vendorId of ids) {
        // 기존 상품들의 연계된 서비스 ID 가져오기
        const existingProducts = await query('SELECT service_id FROM vendor_products WHERE vendor_id::text = $1', [vendorId]);
        const serviceIds = existingProducts.rows.map(p => p.service_id).filter(Boolean);
        // 연계된 서비스 및 서비스-업체상품 연계 삭제
        for (const serviceId of serviceIds) {
          await query('DELETE FROM service_vendor_items WHERE service_id = $1', [serviceId]);
          await query('DELETE FROM services WHERE id = $1', [serviceId]);
        }
        await query("DELETE FROM transactions WHERE reference_id::text = $1 AND reference_type = 'vendor_product'", [vendorId]);
        await query('DELETE FROM vendor_products WHERE vendor_id::text = $1', [vendorId]);
        const result = await query('DELETE FROM vendors WHERE id::text = $1', [vendorId]);
        if (result.rowCount > 0) deleted++;
      }
      return res.json({ message: `${deleted}개의 업체가 삭제되었습니다.`, deleted });
    }

    // POST /api/vendors - 업체 등록 (상품 포함)
    if (req.method === 'POST' && !pathParts[0]) {
      const { name, representative, phone, products } = req.body;
      if (!name) return res.status(400).json({ error: '업체명은 필수입니다.' });
      const id = uuidv4();
      await query('INSERT INTO vendors (id, name, representative, phone) VALUES ($1, $2, $3, $4)', [id, name, representative || null, phone || null]);

      if (products && products.length > 0) {
        for (const p of products) {
          if (!p.product_name) continue;
          const pid = uuidv4();

          // 서비스 상품 자동 생성
          const serviceId = uuidv4();
          const maxResult = await query("SELECT MAX(CAST(REPLACE(service_code, 'SVC-', '') AS INTEGER)) as max_num FROM services WHERE service_code LIKE 'SVC-%'");
          const num = (parseInt(maxResult.rows[0].max_num) || 0) + 1;
          const serviceCode = 'SVC-' + String(num).padStart(4, '0');
          await query(
            'INSERT INTO services (id, service_code, name, category, description, price, unit, duration, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [serviceId, serviceCode, p.product_name, '업체상품', `${name} 업체의 ${p.product_name}`, p.cost_price || 0, '건', '', 'active']
          );

          // 업체상품 등록 (서비스 ID 연계)
          await query('INSERT INTO vendor_products (id, vendor_id, product_name, cost_price, service_id) VALUES ($1, $2, $3, $4, $5)', [pid, id, p.product_name, p.cost_price || 0, serviceId]);

          // 서비스-업체상품 연계 등록
          const sviId = uuidv4();
          await query('INSERT INTO service_vendor_items (id, service_id, vendor_id, vendor_product_id, quantity) VALUES ($1, $2, $3, $4, $5)', [sviId, serviceId, id, pid, 1]);
        }
      }

      const result = await query('SELECT * FROM vendors WHERE id::text = $1', [id]);
      const prods = await query('SELECT * FROM vendor_products WHERE vendor_id::text = $1 ORDER BY created_at ASC', [id]);
      return res.status(201).json({ ...result.rows[0], products: prods.rows });
    }

    // PUT /api/vendors/:id - 업체 수정 (상품 포함)
    if (pathParts[0] && !pathParts[1] && req.method === 'PUT') {
      const id = pathParts[0];
      const { name, representative, phone, status, products } = req.body;
      const current = await query('SELECT * FROM vendors WHERE id::text = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
      const v = current.rows[0];
      await query('UPDATE vendors SET name=$1, representative=$2, phone=$3, status=$4 WHERE id::text=$5', [
        name || v.name,
        representative !== undefined ? representative : v.representative,
        phone !== undefined ? phone : v.phone,
        status || v.status,
        id
      ]);

      if (products !== undefined) {
        // 기존 상품들의 연계된 서비스 ID 가져오기
        const existingProducts = await query('SELECT service_id FROM vendor_products WHERE vendor_id::text = $1', [id]);
        const serviceIds = existingProducts.rows.map(p => p.service_id).filter(Boolean);

        // 연계된 서비스 및 서비스-업체상품 연계 삭제
        for (const serviceId of serviceIds) {
          await query('DELETE FROM service_vendor_items WHERE service_id = $1', [serviceId]);
          await query('DELETE FROM services WHERE id = $1', [serviceId]);
        }

        await query('DELETE FROM vendor_products WHERE vendor_id::text = $1', [id]);
        // 기존 업체상품 관련 지출 거래 정리 (과거 데이터 호환)
        await query("DELETE FROM transactions WHERE reference_id::text = $1 AND reference_type = 'vendor_product'", [id]);
        if (products.length > 0) {
          const vendorName = name || v.name;
          for (const p of products) {
            if (!p.product_name) continue;
            const pid = uuidv4();

            // 서비스 상품 자동 생성
            const serviceId = uuidv4();
            const maxResult = await query("SELECT MAX(CAST(REPLACE(service_code, 'SVC-', '') AS INTEGER)) as max_num FROM services WHERE service_code LIKE 'SVC-%'");
            const num = (parseInt(maxResult.rows[0].max_num) || 0) + 1;
            const serviceCode = 'SVC-' + String(num).padStart(4, '0');
            await query(
              'INSERT INTO services (id, service_code, name, category, description, price, unit, duration, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
              [serviceId, serviceCode, p.product_name, '업체상품', `${vendorName} 업체의 ${p.product_name}`, p.cost_price || 0, '건', '', 'active']
            );

            // 업체상품 등록 (서비스 ID 연계)
            await query('INSERT INTO vendor_products (id, vendor_id, product_name, cost_price, service_id) VALUES ($1, $2, $3, $4, $5)', [pid, id, p.product_name, p.cost_price || 0, serviceId]);

            // 서비스-업체상품 연계 등록
            const sviId = uuidv4();
            await query('INSERT INTO service_vendor_items (id, service_id, vendor_id, vendor_product_id, quantity) VALUES ($1, $2, $3, $4, $5)', [sviId, serviceId, id, pid, 1]);
          }
        }
      }

      const result = await query('SELECT * FROM vendors WHERE id::text = $1', [id]);
      const prods = await query('SELECT * FROM vendor_products WHERE vendor_id::text = $1 ORDER BY created_at ASC', [id]);
      return res.json({ ...result.rows[0], products: prods.rows });
    }

    // DELETE /api/vendors/:id - 업체 삭제
    if (pathParts[0] && !pathParts[1] && req.method === 'DELETE') {
      // 기존 상품들의 연계된 서비스 ID 가져오기
      const existingProducts = await query('SELECT service_id FROM vendor_products WHERE vendor_id::text = $1', [pathParts[0]]);
      const serviceIds = existingProducts.rows.map(p => p.service_id).filter(Boolean);

      // 연계된 서비스 및 서비스-업체상품 연계 삭제
      for (const serviceId of serviceIds) {
        await query('DELETE FROM service_vendor_items WHERE service_id = $1', [serviceId]);
        await query('DELETE FROM services WHERE id = $1', [serviceId]);
      }

      await query("DELETE FROM transactions WHERE reference_id::text = $1 AND reference_type = 'vendor_product'", [pathParts[0]]);
      await query('DELETE FROM vendor_products WHERE vendor_id::text = $1', [pathParts[0]]);
      const result = await query('DELETE FROM vendors WHERE id::text = $1', [pathParts[0]]);
      if (result.rowCount === 0) return res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
      return res.json({ message: '업체가 삭제되었습니다.' });
    }

    // GET /api/vendors/settlement - 업체별 정산 (사용내역 취합)
    if (pathParts[0] === 'settlement' && req.method === 'GET') {
      const url2 = new URL(req.url, `http://${req.headers.host}`);
      const periodStart = url2.searchParams.get('period_start');
      const periodEnd = url2.searchParams.get('period_end');
      const vendorId = url2.searchParams.get('vendor_id');

      let dateFilter = '';
      let vendorFilter = '';
      const params = [];
      let paramIdx = 1;

      if (periodStart && periodEnd) {
        dateFilter = ` AND o.order_date >= $${paramIdx} AND o.order_date <= $${paramIdx + 1}`;
        params.push(periodStart, periodEnd);
        paramIdx += 2;
      }
      if (vendorId) {
        vendorFilter = ` AND ovi.vendor_id::text = $${paramIdx}`;
        params.push(vendorId);
        paramIdx++;
      }

      const result = await query(
        `SELECT
          v.id as vendor_id,
          v.name as vendor_name,
          v.representative,
          v.phone as vendor_phone,
          vp.id as product_id,
          vp.product_name,
          vp.cost_price,
          ovi.order_id,
          ovi.quantity,
          ovi.unit_price,
          ovi.total_price,
          COALESCE(ovi.item_type, 'normal') as item_type,
          o.order_number,
          o.order_date,
          o.status as order_status,
          c.name as customer_name,
          c.company as customer_company
        FROM order_vendor_items ovi
        JOIN vendors v ON ovi.vendor_id::text = v.id::text
        JOIN vendor_products vp ON ovi.vendor_product_id::text = vp.id::text
        JOIN orders o ON ovi.order_id::text = o.id::text
        LEFT JOIN customers c ON o.customer_id::text = c.id::text
        WHERE 1=1${dateFilter}${vendorFilter}
        ORDER BY v.name, vp.product_name, o.order_date DESC`,
        params
      );

      // 업체별 → 상품별 → 주문별 구조로 집계
      const vendorMap = new Map();

      for (const row of result.rows) {
        if (!vendorMap.has(row.vendor_id)) {
          vendorMap.set(row.vendor_id, {
            vendor_id: row.vendor_id,
            vendor_name: row.vendor_name,
            representative: row.representative,
            vendor_phone: row.vendor_phone,
            total_amount: 0,
            total_refund: 0,
            net_amount: 0,
            order_count: new Set(),
            products: new Map()
          });
        }
        const vendor = vendorMap.get(row.vendor_id);
        const price = parseFloat(row.total_price) || 0;

        if (row.item_type === 'refund') {
          vendor.total_refund += price;
        } else {
          vendor.total_amount += price;
        }

        vendor.order_count.add(row.order_id);

        if (!vendor.products.has(row.product_id)) {
          vendor.products.set(row.product_id, {
            product_id: row.product_id,
            product_name: row.product_name,
            cost_price: parseFloat(row.cost_price) || 0,
            total_quantity: 0,
            total_amount: 0,
            refund_quantity: 0,
            refund_amount: 0,
            orders: []
          });
        }
        const product = vendor.products.get(row.product_id);
        if (row.item_type === 'refund') {
          product.refund_quantity += row.quantity;
          product.refund_amount += price;
        } else {
          product.total_quantity += row.quantity;
          product.total_amount += price;
        }
        product.orders.push({
          order_id: row.order_id,
          order_number: row.order_number,
          customer_name: row.customer_company || row.customer_name,
          order_date: row.order_date,
          order_status: row.order_status,
          quantity: row.quantity,
          unit_price: parseFloat(row.unit_price),
          total_price: price,
          item_type: row.item_type
        });
      }

      // Map → 배열 변환
      const vendors = [];
      for (const vendor of vendorMap.values()) {
        const products = [];
        for (const product of vendor.products.values()) {
          products.push({
            ...product,
            net_amount: product.total_amount - product.refund_amount
          });
        }
        vendors.push({
          vendor_id: vendor.vendor_id,
          vendor_name: vendor.vendor_name,
          representative: vendor.representative,
          vendor_phone: vendor.vendor_phone,
          total_amount: vendor.total_amount,
          total_refund: vendor.total_refund,
          net_amount: vendor.total_amount - vendor.total_refund,
          order_count: vendor.order_count.size,
          products
        });
      }

      // 정산금액 큰 순서로 정렬
      vendors.sort((a, b) => b.net_amount - a.net_amount);
      return res.json(vendors);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Vendors API error:', error);
    return res.status(500).json({ error: '서버 오류: ' + (error.message || '알 수 없는 오류') });
  }
}
