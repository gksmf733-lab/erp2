import postgres from 'postgres';

let sql;
try {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || '';

  if (connectionString) {
    sql = postgres(connectionString, {
      ssl: 'require',
      max: 10,
      idle_timeout: 30,
      connect_timeout: 15,
      onnotice: () => {},
    });
  } else {
    console.error('No POSTGRES_URL or DATABASE_URL environment variable set');
  }
} catch (e) {
  console.error('DB connection init error:', e.message);
}

// pg 패키지와 호환되는 query 함수
export async function query(text, params = []) {
  if (!sql) {
    throw new Error('Database not configured - check POSTGRES_URL environment variable');
  }
  try {
    const result = await sql.unsafe(text, params);
    return { rows: result, rowCount: result.count };
  } catch (error) {
    console.error('Query error:', error.message, 'SQL:', text.substring(0, 100));
    throw error;
  }
}

// 테이블 초기화 (콜드스타트 시 1회만 실행)
const initialized = {};
export async function ensureTables(key, ddlFn) {
  if (initialized[key]) return;
  try {
    await ddlFn();
    initialized[key] = true;
  } catch (e) {
    console.log(`Table init (${key}):`, e.message);
  }
}

export default sql;
