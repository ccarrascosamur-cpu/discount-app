const express = require('express');
const { buildAuthUrl, exchangeAccessToken, verifyHmac, generateNonce } = require('../lib/auth');
const { saveShop } = require('../lib/db');
const { HOST } = require('../config');

const router = express.Router();
const nonceStore = new Map(); // in-memory nonce validation

router.get('/auth', (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).send('Missing shop parameter');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop)) {
    return res.status(400).send('Invalid shop domain');
  }
  const nonce = generateNonce();
  nonceStore.set(shop, nonce);
  const url = buildAuthUrl(shop, nonce);
  res.redirect(url);
});

router.get('/auth/callback', async (req, res) => {
  const { shop, code, state, ...rest } = req.query;
  if (!shop || !code || !state) {
    return res.status(400).send('Missing parameters');
  }

  const storedNonce = nonceStore.get(shop);
  if (!storedNonce || storedNonce !== state) {
    return res.status(403).send('Invalid state parameter');
  }
  nonceStore.delete(shop);

  try {
    if (!verifyHmac(req.query)) {
      return res.status(403).send('HMAC validation failed');
    }
  } catch (err) {
    return res.status(403).send('HMAC validation error');
  }

  try {
    const accessToken = await exchangeAccessToken(shop, code);
    await saveShop(shop, accessToken);
    res.redirect(`${HOST}/?shop=${encodeURIComponent(shop)}`);
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('Authentication failed');
  }
});

module.exports = router;
