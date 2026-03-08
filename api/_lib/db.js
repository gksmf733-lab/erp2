import postgres from 'postgres';

let sql;
try {
  const connectionString = process.env.POSTGRES_URL || '';

  // WHATWG URL API를 사용하여 연결 문자열 파싱 (url.parse deprecation 경고 방지)
  let dbOptions = {
    ssl: 'require',
    connection: {},
    onnotice: () => {},
    max: 10,
    idle_timeout: 30,
    connect_timeout: 15
  };

  if (connectionString) {
    const url = new URL(connectionString);
    dbOptions = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ...dbOptions
    };
  }

  sql = postgres(dbOptions);
} catch (e) {
  console.error('DB connection init error:', e.message);
}

// pg 패키지와 호환되는 query 함수
export async function query(text, params = []) {
  if (!sql) {
    throw new Error('Database not configured');
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
