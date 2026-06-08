require('dotenv').config();

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || `http://localhost:${PORT}`;
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

const SCOPES = 'read_products,write_products,read_collections';

module.exports = {
  PORT,
  HOST,
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SHOPIFY_API_VERSION,
  SCOPES,
};
