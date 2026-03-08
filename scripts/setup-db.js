import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const sql = postgres(process.env.POSTGRES_URL, {
  ssl: 'require'
});

async function query(text, params = []) {
  const result = await sql.unsafe(text, params);
  return { rows: result };
}

async function setupDatabase() {
  console.log('Setting up database...');
  console.log('Connection:', process.env.POSTGRES_URL ? 'Found' : 'NOT FOUND');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created users table');

  await query(`
    CREATE TABLE IF NOT EXISTS employees (
      id VARCHAR(255) PRIMARY KEY,
      employee_number VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      department VARCHAR(100) NOT NULL,
      position VARCHAR(100) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(50),
      hire_date DATE NOT NULL,
      salary DECIMAL(15, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created employees table');

  await query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(255) PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      amount DECIMAL(15, 2) NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created transactions table');

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id VARCHAR(255) PRIMARY KEY,
      sku VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      quantity INTEGER DEFAULT 0,
      unit VARCHAR(50) NOT NULL,
      unit_price DECIMAL(15, 2) DEFAULT 0,
      min_quantity INTEGER DEFAULT 0,
      location VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created inventory_items table');

  await query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id VARCHAR(255) PRIMARY KEY,
      item_id VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      date DATE NOT NULL,
      created_by VARCHAR(255)
    )
  `);
  console.log('Created inventory_movements table');

  await query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      company VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created customers table');

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(255) PRIMARY KEY,
      order_number VARCHAR(100) UNIQUE NOT NULL,
      customer_id VARCHAR(255) NOT NULL,
      total_amount DECIMAL(15, 2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      order_date DATE NOT NULL,
      due_date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created orders table');

  await query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL,
      item_id VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(15, 2) NOT NULL,
      total_price DECIMAL(15, 2) NOT NULL
    )
  `);
  console.log('Created order_items table');

  await query(`
    CREATE TABLE IF NOT EXISTS incentive_policies (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created incentive_policies table');

  await query(`
    CREATE TABLE IF NOT EXISTS order_incentives (
      id VARCHAR(255) PRIMARY KEY,
      order_id VARCHAR(255) NOT NULL,
      employee_id VARCHAR(255) NOT NULL,
      policy_id VARCHAR(255),
      amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP
    )
  `);
  console.log('Created order_incentives table');

  await query(`
    CREATE TABLE IF NOT EXISTS inquiries (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      address TEXT,
      plan VARCHAR(50),
      move_date DATE,
      current_provider VARCHAR(50),
      message TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Created inquiries table');

  const adminCheck = await query("SELECT id FROM users WHERE email = 'admin@company.com'");
  if (adminCheck.rows.length === 0) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    await query(
      'INSERT INTO users (id, email, password, name, role) VALUES ($1, $2, $3, $4, $5)',
      ['admin-001', 'admin@company.com', hashedPassword, '관리자', 'admin']
    );
    console.log('Created admin user');
  }

  await insertSampleData();
  console.log('Database setup complete!');
  await sql.end();
}

async function insertSampleData() {
  const employeeCheck = await query('SELECT COUNT(*) as count FROM employees');
  if (parseInt(employeeCheck.rows[0].count) > 0) {
    console.log('Sample data already exists');
    return;
  }

  console.log('Inserting sample data...');

  const employees = [
    ['emp-001', 'EMP001', '김철수', '개발팀', '팀장', 'kim@company.com', '010-1234-5678', '2020-01-15', 5000000],
    ['emp-002', 'EMP002', '이영희', '마케팅팀', '대리', 'lee@company.com', '010-2345-6789', '2021-03-20', 3500000],
    ['emp-003', 'EMP003', '박민수', '영업팀', '과장', 'park@company.com', '010-3456-7890', '2019-07-10', 4200000],
    ['emp-004', 'EMP004', '정수진', '인사팀', '사원', 'jung@company.com', '010-4567-8901', '2022-09-01', 3000000],
    ['emp-005', 'EMP005', '최동현', '개발팀', '대리', 'choi@company.com', '010-5678-9012', '2021-11-15', 3800000],
  ];
  for (const emp of employees) {
    await query('INSERT INTO employees (id, employee_number, name, department, position, email, phone, hire_date, salary) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', emp);
  }

  const items = [
    ['item-001', 'SKU001', '노트북', '전자기기', 50, '대', 1500000, 10, 'A-1'],
    ['item-002', 'SKU002', '모니터', '전자기기', 80, '대', 350000, 20, 'A-2'],
    ['item-003', 'SKU003', '키보드', '주변기기', 200, '개', 50000, 50, 'B-1'],
    ['item-004', 'SKU004', '마우스', '주변기기', 300, '개', 30000, 50, 'B-2'],
    ['item-005', 'SKU005', '사무용 의자', '가구', 100, '개', 200000, 20, 'C-1'],
  ];
  for (const item of items) {
    await query('INSERT INTO inventory_items (id, sku, name, category, quantity, unit, unit_price, min_quantity, location) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', item);
  }

  const customers = [
    ['cust-001', '홍길동', '(주)길동테크', 'hong@gildong.com', '02-1234-5678', '서울시 강남구'],
    ['cust-002', '김사장', '김사장유통', 'kim@kimceo.com', '02-2345-6789', '서울시 서초구'],
    ['cust-003', '이대표', '이대표산업', 'lee@leerep.com', '031-3456-7890', '경기도 성남시'],
  ];
  for (const cust of customers) {
    await query('INSERT INTO customers (id, name, company, email, phone, address) VALUES ($1, $2, $3, $4, $5, $6)', cust);
  }

  const transactions = [
    ['txn-001', 'income', '매출', 15000000, '1월 제품 판매', '2024-01-15'],
    ['txn-002', 'income', '매출', 12000000, '1월 서비스 매출', '2024-01-20'],
    ['txn-003', 'expense', '급여', 20000000, '1월 급여 지급', '2024-01-25'],
    ['txn-004', 'expense', '임대료', 3000000, '1월 사무실 임대료', '2024-01-28'],
    ['txn-005', 'expense', '운영비', 500000, '사무용품 구매', '2024-01-30'],
  ];
  for (const txn of transactions) {
    await query('INSERT INTO transactions (id, type, category, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6)', txn);
  }

  const orders = [
    ['ord-001', 'ORD-2024-001', 'cust-001', 3000000, 'completed', '2024-01-10'],
    ['ord-002', 'ORD-2024-002', 'cust-002', 1500000, 'processing', '2024-01-15'],
    ['ord-003', 'ORD-2024-003', 'cust-003', 750000, 'pending', '2024-01-20'],
  ];
  for (const ord of orders) {
    await query('INSERT INTO orders (id, order_number, customer_id, total_amount, status, order_date) VALUES ($1, $2, $3, $4, $5, $6)', ord);
  }

  console.log('Sample data inserted');
}

setupDatabase().catch(console.error);
