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
  const path = url.pathname.replace('/api/finance', '');
  const pathParts = path.split('/').filter(Boolean);

  try {
    await ensureTables('finance', async () => {
      await query(`CREATE TABLE IF NOT EXISTS transactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type VARCHAR(50) NOT NULL, category VARCHAR(100) NOT NULL, amount DECIMAL(15,2) DEFAULT 0, description TEXT, date DATE, created_at TIMESTAMP DEFAULT NOW())`);
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR(255)`).catch(() => {});
      await query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50)`).catch(() => {});
      // 고정비 테이블 생성
      await query(`CREATE TABLE IF NOT EXISTS fixed_expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        amount DECIMAL(15,2) DEFAULT 0,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
    });

    if (path === '/summary' && req.method === 'GET') {
      const totalsResult = await query("SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income, COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense FROM transactions");
      const byCategoryResult = await query('SELECT type, category, SUM(amount) as total FROM transactions GROUP BY type, category ORDER BY total DESC');
      const income = parseFloat(totalsResult.rows[0].income);
      const expense = parseFloat(totalsResult.rows[0].expense);
      return res.json({ income, expense, balance: income - expense, byCategory: byCategoryResult.rows });
    }

    // 월별 지출 요약 (고정비 포함)
    if (path === '/monthly-summary' && req.method === 'GET') {
      const { year, month } = queryParams;
      const targetYear = year || new Date().getFullYear();
      const targetMonth = month || new Date().getMonth() + 1;
      const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
      const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

      // 해당 월 거래 내역
      const transactionsResult = await query(
        `SELECT type, category, SUM(amount) as total FROM transactions
         WHERE date >= $1 AND date <= $2
         GROUP BY type, category ORDER BY total DESC`,
        [startDate, endDate]
      );

      // 활성화된 고정비 목록
      const fixedExpensesResult = await query(
        `SELECT id, name, category, amount FROM fixed_expenses WHERE is_active = true`
      );

      const monthlyIncome = transactionsResult.rows
        .filter(r => r.type === 'income')
        .reduce((sum, r) => sum + parseFloat(r.total), 0);

      const monthlyExpense = transactionsResult.rows
        .filter(r => r.type === 'expense')
        .reduce((sum, r) => sum + parseFloat(r.total), 0);

      const fixedExpenseTotal = fixedExpensesResult.rows
        .reduce((sum, r) => sum + parseFloat(r.amount), 0);

      return res.json({
        year: parseInt(targetYear),
        month: parseInt(targetMonth),
        income: monthlyIncome,
        expense: monthlyExpense,
        fixedExpense: fixedExpenseTotal,
        totalExpense: monthlyExpense + fixedExpenseTotal,
        balance: monthlyIncome - (monthlyExpense + fixedExpenseTotal),
        byCategory: transactionsResult.rows,
        fixedExpenses: fixedExpensesResult.rows
      });
    }

    // ===== 고정비 API =====
    // GET /api/finance/fixed-expenses - 고정비 목록
    if (pathParts[0] === 'fixed-expenses' && req.method === 'GET' && !pathParts[1]) {
      const result = await query('SELECT * FROM fixed_expenses ORDER BY created_at DESC');
      return res.json(result.rows);
    }

    // POST /api/finance/fixed-expenses - 고정비 등록
    if (pathParts[0] === 'fixed-expenses' && req.method === 'POST' && !pathParts[1]) {
      const { name, category, amount, description } = req.body;
      if (!name || !category || !amount) {
        return res.status(400).json({ error: '필수 필드를 입력해주세요.' });
      }
      const id = uuidv4();
      await query(
        'INSERT INTO fixed_expenses (id, name, category, amount, description) VALUES ($1, $2, $3, $4, $5)',
        [id, name, category, amount, description || null]
      );
      const result = await query('SELECT * FROM fixed_expenses WHERE id = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    // PUT /api/finance/fixed-expenses/:id - 고정비 수정
    if (pathParts[0] === 'fixed-expenses' && pathParts[1] && req.method === 'PUT') {
      const id = pathParts[1];
      const { name, category, amount, description, is_active } = req.body;
      const current = await query('SELECT * FROM fixed_expenses WHERE id = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '고정비 항목을 찾을 수 없습니다.' });
      const item = current.rows[0];
      await query(
        'UPDATE fixed_expenses SET name = $1, category = $2, amount = $3, description = $4, is_active = $5 WHERE id = $6',
        [
          name || item.name,
          category || item.category,
          amount !== undefined ? amount : item.amount,
          description !== undefined ? description : item.description,
          is_active !== undefined ? is_active : item.is_active,
          id
        ]
      );
      const result = await query('SELECT * FROM fixed_expenses WHERE id = $1', [id]);
      return res.json(result.rows[0]);
    }

    // DELETE /api/finance/fixed-expenses/:id - 고정비 삭제
    if (pathParts[0] === 'fixed-expenses' && pathParts[1] && req.method === 'DELETE') {
      const id = pathParts[1];
      const result = await query('DELETE FROM fixed_expenses WHERE id = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: '고정비 항목을 찾을 수 없습니다.' });
      return res.json({ message: '고정비 항목이 삭제되었습니다.' });
    }

    if (pathParts[0] === 'transactions' && req.method === 'GET' && !pathParts[1]) {
      const { type, category } = queryParams;
      let result;
      if (type && category) {
        result = await query('SELECT * FROM transactions WHERE type = $1 AND category = $2 ORDER BY date DESC', [type, category]);
      } else if (type) {
        result = await query('SELECT * FROM transactions WHERE type = $1 ORDER BY date DESC', [type]);
      } else if (category) {
        result = await query('SELECT * FROM transactions WHERE category = $1 ORDER BY date DESC', [category]);
      } else {
        result = await query('SELECT * FROM transactions ORDER BY date DESC');
      }
      return res.json(result.rows);
    }

    // POST /api/finance/transactions/bulk-delete - 일괄 삭제
    if (pathParts[0] === 'transactions' && pathParts[1] === 'bulk-delete' && req.method === 'POST') {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: '삭제할 거래내역을 선택해주세요.' });
      }
      let deleted = 0;
      for (const txnId of ids) {
        const result = await query('DELETE FROM transactions WHERE id::text = $1', [txnId]);
        if (result.rowCount > 0) deleted++;
      }
      return res.json({ message: `${deleted}건의 거래내역이 삭제되었습니다.`, deleted });
    }

    if (pathParts[0] === 'transactions' && req.method === 'POST' && !pathParts[1]) {
      const { type, category, amount, description, date } = req.body;
      if (!type || !category || !amount || !date) {
        return res.status(400).json({ error: '필수 필드를 입력해주세요.' });
      }
      const id = uuidv4();
      await query('INSERT INTO transactions (id, type, category, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)', [id, type, category, amount, description || null, date]);
      const result = await query('SELECT * FROM transactions WHERE id = $1', [id]);
      return res.status(201).json(result.rows[0]);
    }

    if (pathParts[0] === 'transactions' && pathParts[1] && req.method === 'PUT') {
      const id = pathParts[1];
      const { type, category, amount, description, date } = req.body;
      const current = await query('SELECT * FROM transactions WHERE id = $1', [id]);
      if (current.rows.length === 0) return res.status(404).json({ error: '거래 내역을 찾을 수 없습니다.' });
      const txn = current.rows[0];
      await query('UPDATE transactions SET type = $1, category = $2, amount = $3, description = $4, date = $5 WHERE id = $6', [type || txn.type, category || txn.category, amount !== undefined ? amount : txn.amount, description !== undefined ? description : txn.description, date || txn.date, id]);
      const result = await query('SELECT * FROM transactions WHERE id = $1', [id]);
      return res.json(result.rows[0]);
    }

    if (pathParts[0] === 'transactions' && pathParts[1] && req.method === 'DELETE') {
      const id = pathParts[1];
      const result = await query('DELETE FROM transactions WHERE id = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: '거래 내역을 찾을 수 없습니다.' });
      return res.json({ message: '거래 내역이 삭제되었습니다.' });
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (error) {
    console.error('Finance error:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
