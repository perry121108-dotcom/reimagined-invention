require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('連線中...');
  await client.connect();
  console.log('✓ 連線成功！');

  const res = await client.query('SELECT count(*) FROM color_rules;');
  console.log(`✓ color_rules 共 ${res.rows[0].count} 筆資料`);

  await client.end();
}

main().catch(err => {
  console.error('✗ 連線失敗：', err.message);
  process.exit(1);
});
