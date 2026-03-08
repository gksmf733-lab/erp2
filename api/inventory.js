import { query } from './_lib/db.js';
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
  const path = url.pathname.replace('/api/inventory', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    if (pathParts[0] === 'items' && req.method === 'GET' && !pathParts[1]) {
      const { category, search, lowStock } = queryParams;
      let result;
      if (lowStock === 'true') {
        result = await query('SELECT * FROM inventory_items WHERE quantity <= min_quantity ORDER BY name');
      } else if (search && category) {
        result = await query('SELECT * FROM inventory_items WHERE category = $1 AND (name ILIKE $2 OR sku ILIKE $2) ORDER BY name', [category, '%' + search + '%']);
      } else if (search) {
        result = await query('SELECT * FROM inventory_items WHERE name ILIKE $1 OR sku ILIKE $1 ORDER BY name', ['%' + search + '%']);
      } else if (category) {
        result = await query('SELECT * FROM inventory_items WHERE category = $1 ORDER BY name', [category]);
      } else {
        result = await query('SELECT * FROM inventory_items ORDER BY name');
      }
      return res.json(result.rows);
    }

    if (pathParts[0] === 'items' && pathParts[1] && req.method === 'GET') {
      const id = pathParts[1];
      const result = await query('SELECT * FROM inventory_items WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: '품목을 찾을 수 없습니다.' });
      return res.json(result.rows[0]);
    }

    // POST /api/inventory/items/bulk-delete - 일괄 삭제
    if (pathParts[0] === 'items' && pathParts[1] === 'bulk-delete' && req.method === 'POST') {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '삭제할 품목을 선택해주세요.' });
      }
      let deleted = 0;
      for (const itemId of ids) {
        const result = await query('DELETE FROM inventory_items WHERE id::text = $1', [itemId]);
        if (result.rowCount > 0) deleted++;
      }
      return res.json({ message: `${deleted}개의 품목이 삭제되었습니다.`, deleted });
    }

    if (pathParts[0] === 'items' && req.method === 'POST' && !pathParts[1]) {
      const { sku, name, category, quantity, unit, unit_price, min_quantity, location } = req.body;
      if (!sku || !name || !category || !unit) {
        return res.status(400).json({ error: '필수 필드를 입력해주세요.' });
      }
      const id = uuidv4();
      await query('INSERT INTO inventory_items (id, sku, name, category, quantity, unit, unit_price, min_quantity, location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [id, sku, name, category, quantity || 0, unit, unit_price || 0, min_quantity || 0, location || null]);
      const result = await query('SELECT * FROM inventory_items WHERE id = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    if (pathParts[0] === 'items' && pathParts[1] && req.method === 'PUT') {
      const id = pathParts[1];
      const { name, category, unit, unit_price, min_quantity, location } = req.body;
      const current = await query('SELECT * FROM inventory_items WHERE id = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '품목을 찾을 수 없습니다.' });
      const item = current.rows[0];
      await query('UPDATE inventory_items SET name = $1, category = $2, unit = $3, unit_price = $4, min_quantity = $5, location = $6 WHERE id = $7', [name || item.name, category || item.category, unit || item.unit, unit_price !== undefined ? unit_price : item.unit_price, min_quantity !== undefined ? min_quantity : item.min_quantity, location !== undefined ? location : item.location, id]);
      const result = await query('SELECT * FROM inventory_items WHERE id = $1', [id]);
      return res.json(result.rows[0]);
    }

    if (pathParts[0] === 'items' && pathParts[1] && req.method === 'DELETE') {
      const id = pathParts[1];
      const result = await query('DELETE FROM inventory_items WHERE id = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: '품목을 찾을 수 없습니다.' });
      return res.json({ message: '품목이 삭제되었습니다.' });
    }

    if (pathParts[0] === 'movements' && req.method === 'POST') {
      const { item_id, type, quantity, reason, date } = req.body;
      if (!item_id || !type || !quantity || !date) {
        return res.status(400).json({ error: '필수 필드를 입력해주세요.' });
      }
      const itemResult = await query('SELECT * FROM inventory_items WHERE id = $1', [item_id]);
      if (itemResult.rows.length === 0) return res.status(404).json({ error: '품목을 찾을 수 없습니다.' });
      const item = itemResult.rows[0];
      const newQuantity = type === 'in' ? item.quantity + quantity : item.quantity - quantity;
      if (newQuantity < 0) return res.status(400).json({ error: '재고가 부족합니다.' });
      const id = uuidv4();
      await query('INSERT INTO inventory_movements (id, item_id, type, quantity, reason, date) VALUES ($1, $2, $3, $4, $5, $6)', [id, item_id, type, quantity, reason || null, date]);
      await query('UPDATE inventory_items SET quantity = $1 WHERE id = $2', [newQuantity, item_id]);
      const result = await query('SELECT * FROM inventory_movements WHERE id = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Inventory error:', error);
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return res.status(400).json({ error: '이미 존재하는 SKU입니다.' });
    }
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
