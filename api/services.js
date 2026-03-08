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
  const path = url.pathname.replace('/api/services', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    // 콜드스타트 시 1회만 테이블 생성
    await ensureTables('services_v2', async () => {
      await query(`CREATE TABLE IF NOT EXISTS services (id VARCHAR(255) PRIMARY KEY, service_code VARCHAR(100) UNIQUE NOT NULL, name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL, description TEXT DEFAULT '', price DECIMAL(15,2) DEFAULT 0, unit VARCHAR(50) DEFAULT '건', duration VARCHAR(100) DEFAULT '', status VARCHAR(50) DEFAULT 'active', is_blog BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_blog BOOLEAN DEFAULT false`).catch(() => {});
      await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS is_monthly_guarantee BOOLEAN DEFAULT false`).catch(() => {});
      await query(`CREATE TABLE IF NOT EXISTS service_prices (id VARCHAR(255) PRIMARY KEY, service_id VARCHAR(255), customer_id VARCHAR(255), price DECIMAL(15,2) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
      await query(`CREATE TABLE IF NOT EXISTS service_vendor_items (id VARCHAR(255) PRIMARY KEY, service_id VARCHAR(255) NOT NULL, vendor_id VARCHAR(255) NOT NULL, vendor_product_id VARCHAR(255) NOT NULL, quantity INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    });

    // GET /api/services - 목록 조회 (업체상품의 경우 업체 정보 포함)
    if (req.method === 'GET' && !pathParts[0]) {
      const { category, search, status } = queryParams;
      let result;
      if (search && category) {
        result = await query('SELECT * FROM services WHERE category = $1 AND (name ILIKE $2 OR service_code ILIKE $2 OR description ILIKE $2) ORDER BY name', [category, '%' + search + '%']);
      } else if (search) {
        result = await query('SELECT * FROM services WHERE name ILIKE $1 OR service_code ILIKE $1 OR description ILIKE $1 ORDER BY name', ['%' + search + '%']);
      } else if (category) {
        result = await query('SELECT * FROM services WHERE category = $1 ORDER BY name', [category]);
      } else if (status) {
        result = await query('SELECT * FROM services WHERE status = $1 ORDER BY name', [status]);
      } else {
        result = await query('SELECT * FROM services ORDER BY name');
      }

      // 업체상품인 경우 업체 정보 추가
      const services = [];
      for (const svc of result.rows) {
        if (svc.category === '업체상품') {
          const vendorInfo = await query(
            `SELECT v.id as vendor_id, v.name as vendor_name
             FROM service_vendor_items svi
             LEFT JOIN vendors v ON svi.vendor_id::text = v.id::text
             WHERE svi.service_id = $1 LIMIT 1`,
            [svc.id]
          );
          if (vendorInfo.rows.length > 0) {
            svc.vendor_id = vendorInfo.rows[0].vendor_id;
            svc.vendor_name = vendorInfo.rows[0].vendor_name;
          }
        }
        services.push(svc);
      }
      return res.json(services);
    }

    // GET /api/services/:id - 상세 조회 (업체상품 포함)
    if (req.method === 'GET' && pathParts[0] && pathParts[1] !== 'prices') {
      const id = pathParts[0];
      const result = await query('SELECT * FROM services WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: '서비스를 찾을 수 없습니다.' });
      const vendorItems = await query(
        `SELECT svi.*, v.name as vendor_name, vp.product_name, vp.cost_price
         FROM service_vendor_items svi
         LEFT JOIN vendors v ON svi.vendor_id::text = v.id::text
         LEFT JOIN vendor_products vp ON svi.vendor_product_id::text = vp.id::text
         WHERE svi.service_id = $1
         ORDER BY v.name, vp.product_name`,
        [id]
      );
      return res.json({ ...result.rows[0], vendor_items: vendorItems.rows });
    }

    // POST /api/services - 등록
    if (req.method === 'POST' && !pathParts[0]) {
      const { service_code, name, category, description, price, unit, duration, status, is_blog, is_monthly_guarantee, vendor_items } = req.body;
      if (!name || !category) {
        return res.status(400).json({ error: '이름, 카테고리는 필수입니다.' });
      }
      let finalCode = service_code;
      if (!finalCode) {
        const maxResult = await query("SELECT MAX(CAST(REPLACE(service_code, 'SVC-', '') AS INTEGER)) as max_num FROM services WHERE service_code LIKE 'SVC-%'");
        const num = (parseInt(maxResult.rows[0].max_num) || 0) + 1;
        finalCode = 'SVC-' + String(num).padStart(4, '0');
      }
      const id = uuidv4();
      await query(
        'INSERT INTO services (id, service_code, name, category, description, price, unit, duration, status, is_blog, is_monthly_guarantee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [id, finalCode, name, category, description || '', price || 0, unit || '건', duration || '', status || 'active', is_blog || false, is_monthly_guarantee || false]
      );
      if (vendor_items && vendor_items.length > 0) {
        for (const vi of vendor_items) {
          if (!vi.vendor_id || !vi.vendor_product_id) continue;
          const viId = uuidv4();
          await query('INSERT INTO service_vendor_items (id, service_id, vendor_id, vendor_product_id, quantity) VALUES ($1, $2, $3, $4, $5)', [viId, id, vi.vendor_id, vi.vendor_product_id, vi.quantity || 1]);
        }
      }
      const result = await query('SELECT * FROM services WHERE id = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    // PUT /api/services/:id - 수정
    if (req.method === 'PUT' && pathParts[0] && pathParts[1] !== 'prices') {
      const id = pathParts[0];
      const current = await query('SELECT * FROM services WHERE id = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '서비스를 찾을 수 없습니다.' });
      const item = current.rows[0];
      const { name, category, description, price, unit, duration, status, is_blog, is_monthly_guarantee, vendor_items } = req.body;
      await query(
        'UPDATE services SET name = $1, category = $2, description = $3, price = $4, unit = $5, duration = $6, status = $7, is_blog = $8, is_monthly_guarantee = $9 WHERE id = $10',
        [
          name || item.name,
          category || item.category,
          description !== undefined ? description : item.description,
          price !== undefined ? price : item.price,
          unit || item.unit,
          duration !== undefined ? duration : item.duration,
          status || item.status,
          is_blog !== undefined ? is_blog : (item.is_blog || false),
          is_monthly_guarantee !== undefined ? is_monthly_guarantee : (item.is_monthly_guarantee || false),
          id
        ]
      );
      if (vendor_items !== undefined) {
        await query('DELETE FROM service_vendor_items WHERE service_id = $1', [id]);
        if (vendor_items.length > 0) {
          for (const vi of vendor_items) {
            if (!vi.vendor_id || !vi.vendor_product_id) continue;
            const viId = uuidv4();
            await query('INSERT INTO service_vendor_items (id, service_id, vendor_id, vendor_product_id, quantity) VALUES ($1, $2, $3, $4, $5)', [viId, id, vi.vendor_id, vi.vendor_product_id, vi.quantity || 1]);
          }
        }
      }
      const result = await query('SELECT * FROM services WHERE id = $1', [id]);
      return res.json(result.rows[0]);
    }

    // DELETE /api/services/:id - 삭제
    if (req.method === 'DELETE' && pathParts[0]) {
      const id = pathParts[0];
      const result = await query('SELECT * FROM services WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: '서비스를 찾을 수 없습니다.' });
      await query('DELETE FROM services WHERE id = $1', [id]);
      return res.json({ message: '서비스가 삭제되었습니다.' });
    }

    // GET /api/services/:id/prices - 업체별 단가 조회
    if (req.method === 'GET' && pathParts[0] && pathParts[1] === 'prices') {
      const serviceId = pathParts[0];
      const result = await query('SELECT sp.*, c.name as customer_name, c.company as customer_company FROM service_prices sp LEFT JOIN customers c ON sp.customer_id::text = c.id::text WHERE sp.service_id = $1 ORDER BY c.company, c.name', [serviceId]);
      return res.json(result.rows);
    }

    // POST /api/services/:id/prices - 업체별 단가 등록/수정
    if (req.method === 'POST' && pathParts[0] && pathParts[1] === 'prices') {
      const serviceId = pathParts[0];
      const { customer_id, price } = req.body;
      if (!customer_id) return res.status(400).json({ error: '업체를 선택해주세요.' });
      // Check existing
      const existing = await query('SELECT * FROM service_prices WHERE service_id = $1 AND customer_id::text = $2', [serviceId, customer_id]);
      if (existing.rows.length > 0) {
        await query('UPDATE service_prices SET price = $1 WHERE service_id = $2 AND customer_id::text = $3', [price || 0, serviceId, customer_id]);
      } else {
        const id = uuidv4();
        await query('INSERT INTO service_prices (id, service_id, customer_id, price) VALUES ($1, $2, $3, $4)', [id, serviceId, customer_id, price || 0]);
      }
      const result = await query('SELECT sp.*, c.name as customer_name, c.company as customer_company FROM service_prices sp LEFT JOIN customers c ON sp.customer_id::text = c.id::text WHERE sp.service_id = $1 ORDER BY c.company, c.name', [serviceId]);
      return res.json(result.rows);
    }

    // DELETE /api/services/:id/prices/:priceId - 업체별 단가 삭제
    if (req.method === 'DELETE' && pathParts[0] && pathParts[1] === 'prices' && pathParts[2]) {
      const priceId = pathParts[2];
      await query('DELETE FROM service_prices WHERE id = $1', [priceId]);
      return res.json({ message: '삭제되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Services error:', error);
    const errMsg = error.message || String(error);
    if (errMsg.includes('unique') || errMsg.includes('duplicate')) {
      return res.status(400).json({ error: '이미 존재하는 서비스코드입니다.' });
    }
    return res.status(500).json({ error: '서버 오류가 발생했습니다.', detail: errMsg });
  }
}
