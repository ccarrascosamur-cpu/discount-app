const crypto = require('crypto');
const querystring = require('querystring');
const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, HOST } = require('../config');

function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function buildAuthUrl(shop, nonce) {
  const redirectUri = `${HOST}/auth/callback`;
  const query = querystring.stringify({
    client_id: SHOPIFY_API_KEY,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: nonce,
  });
  return `https://${shop}/admin/oauth/authorize?${query}`;
}

async function exchangeAccessToken(shop, code) {
  const url = `https://${shop}/admin/oauth/access_token`;
  const body = JSON.stringify({
    client_id: SHOPIFY_API_KEY,
    client_secret: SHOPIFY_API_SECRET,
    code,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

function verifyHmac(queryObj) {
  const { hmac, signature, ...rest } = queryObj;
  // Shopify expects parameters sorted alphabetically for HMAC calculation
  const sortedKeys = Object.keys(rest).sort();
  const message = sortedKeys.map((key) => `${key}=${rest[key]}`).join('&');
  const generated = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(generated, 'hex'), Buffer.from(hmac, 'hex'));
}

module.exports = {
  generateNonce,
  buildAuthUrl,
  exchangeAccessToken,
  verifyHmac,
};
