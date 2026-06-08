const { Pool } = require('pg');

// Use DATABASE_URL from environment (Render provides this automatically)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id SERIAL PRIMARY KEY,
        shop_domain TEXT UNIQUE NOT NULL,
        access_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS operations (
        id SERIAL PRIMARY KEY,
        shop_domain TEXT NOT NULL,
        percentage REAL NOT NULL,
        collection_ids TEXT,
        status TEXT DEFAULT 'active',
        total_products INTEGER DEFAULT 0,
        total_variants INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS operation_variants (
        id SERIAL PRIMARY KEY,
        operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        original_price TEXT NOT NULL,
        original_compare_at_price TEXT,
        new_price TEXT NOT NULL
      )
    `);
  } finally {
    client.release();
  }
}

async function getDb() {
  await initDb();
  return pool;
}

// --- Public API ---

async function getShop(shopDomain) {
  const res = await pool.query('SELECT * FROM shops WHERE shop_domain = $1', [shopDomain]);
  return res.rows[0] || null;
}

async function saveShop(shopDomain, accessToken) {
  const existing = await getShop(shopDomain);
  if (existing) {
    await pool.query('UPDATE shops SET access_token = $1 WHERE shop_domain = $2', [accessToken, shopDomain]);
  } else {
    await pool.query('INSERT INTO shops (shop_domain, access_token) VALUES ($1, $2)', [shopDomain, accessToken]);
  }
}

async function getAllShops() {
  const res = await pool.query('SELECT id, shop_domain, created_at FROM shops ORDER BY created_at DESC');
  return res.rows;
}

async function createOperation({ shopDomain, percentage, collectionIds, totalProducts, totalVariants }) {
  const res = await pool.query(
    'INSERT INTO operations (shop_domain, percentage, collection_ids, total_products, total_variants) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [shopDomain, percentage, JSON.stringify(collectionIds), totalProducts, totalVariants]
  );
  return res.rows[0].id;
}

async function saveOperationVariant(operationId, variants) {
  const client = await pool.connect();
  try {
    for (const v of variants) {
      await client.query(
        'INSERT INTO operation_variants (operation_id, product_id, variant_id, original_price, original_compare_at_price, new_price) VALUES ($1, $2, $3, $4, $5, $6)',
        [operationId, v.productId, v.variantId, v.originalPrice, v.originalCompareAtPrice, v.newPrice]
      );
    }
  } finally {
    client.release();
  }
}

async function getActiveOperation(shopDomain) {
  const res = await pool.query(
    "SELECT * FROM operations WHERE shop_domain = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [shopDomain]
  );
  return res.rows[0] || null;
}

async function getOperationVariants(operationId) {
  const res = await pool.query('SELECT * FROM operation_variants WHERE operation_id = $1', [operationId]);
  return res.rows;
}

async function revertOperation(operationId) {
  await pool.query(
    "UPDATE operations SET status = 'reverted', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [operationId]
  );
}

async function getOperations(shopDomain) {
  const res = await pool.query('SELECT * FROM operations WHERE shop_domain = $1 ORDER BY created_at DESC', [shopDomain]);
  return res.rows;
}

module.exports = {
  getDb,
  getShop,
  saveShop,
  getAllShops,
  createOperation,
  saveOperationVariant,
  getActiveOperation,
  getOperationVariants,
  revertOperation,
  getOperations,
};
