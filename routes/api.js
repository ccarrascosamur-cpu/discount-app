const express = require('express');
const {
  getShop,
  getAllShops,
  createOperation,
  saveOperationVariant,
  getActiveOperation,
  getOperationVariants,
  revertOperation,
  getOperations,
} = require('../lib/db');
const {
  getCollections,
  getProducts,
  applyProductDiscount,
  sleep,
} = require('../lib/shopify');

const router = express.Router();

router.get('/shops', async (req, res) => {
  const shops = await getAllShops();
  res.json({ shops });
});

router.get('/collections', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing shop' });
  const shopRecord = await getShop(shop);
  if (!shopRecord) return res.status(404).json({ error: 'Shop not connected' });

  try {
    const collections = await getCollections(shop, shopRecord.access_token);
    res.json({ collections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/apply', async (req, res) => {
  const { shop, percentage, collectionIds, excludeAlreadyDiscounted } = req.body;
  if (!shop || !percentage) {
    return res.status(400).json({ error: 'Missing shop or percentage' });
  }

  const shopRecord = await getShop(shop);
  if (!shopRecord) return res.status(404).json({ error: 'Shop not connected' });

  // Check for active operation
  const active = await getActiveOperation(shop);
  if (active) {
    return res.status(409).json({ error: 'There is already an active discount. Revert it first.' });
  }

  try {
    // Fetch products
    const ids = collectionIds && collectionIds.length ? collectionIds : ['all'];
    const allProducts = new Map();
    for (const cid of ids) {
      const products = await getProducts(shop, shopRecord.access_token, cid === 'all' ? null : cid);
      for (const p of products) allProducts.set(p.id, p);
    }

    const snapshotVariants = [];
    let totalProducts = 0;
    let totalVariants = 0;

    for (const product of allProducts.values()) {
      const variantsToUpdate = [];
      for (const v of product.variants.nodes) {
        const currentPrice = parseFloat(v.price);
        const compareAt = v.compareAtPrice ? parseFloat(v.compareAtPrice) : 0;

        if (excludeAlreadyDiscounted && compareAt > currentPrice) {
          continue;
        }

        const newPrice = (currentPrice * (1 - percentage / 100)).toFixed(2);
        variantsToUpdate.push({
          id: v.id,
          newPrice,
          compareAtPrice: v.price, // current price becomes compare_at
        });

        snapshotVariants.push({
          productId: product.id,
          variantId: v.id,
          originalPrice: v.price,
          originalCompareAtPrice: v.compareAtPrice || null,
          newPrice,
        });
      }

      if (variantsToUpdate.length > 0) {
        totalProducts++;
        totalVariants += variantsToUpdate.length;
      }
    }

    if (totalVariants === 0) {
      return res.status(400).json({ error: 'No variants to discount' });
    }

    // Save operation before applying (safer)
    const operationId = await createOperation({
      shopDomain: shop,
      percentage,
      collectionIds: ids,
      totalProducts,
      totalVariants,
    });
    await saveOperationVariant(operationId, snapshotVariants);

    // Apply mutations with rate limiting
    let appliedProducts = 0;
    for (const product of allProducts.values()) {
      const variantsToUpdate = [];
      for (const v of product.variants.nodes) {
        const snapshot = snapshotVariants.find((s) => s.variantId === v.id && s.productId === product.id);
        if (snapshot) {
          variantsToUpdate.push({
            id: v.id,
            newPrice: snapshot.newPrice,
            compareAtPrice: snapshot.originalPrice,
          });
        }
      }
      if (variantsToUpdate.length > 0) {
        await applyProductDiscount(shop, shopRecord.access_token, product.id, variantsToUpdate);
        appliedProducts++;
        if (appliedProducts % 10 === 0) await sleep(300);
      }
    }

    res.json({ success: true, operationId, totalProducts, totalVariants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/revert', async (req, res) => {
  const { shop } = req.body;
  if (!shop) return res.status(400).json({ error: 'Missing shop' });

  const shopRecord = await getShop(shop);
  if (!shopRecord) return res.status(404).json({ error: 'Shop not connected' });

  const active = await getActiveOperation(shop);
  if (!active) {
    return res.status(404).json({ error: 'No active discount to revert' });
  }

  try {
    const variants = await getOperationVariants(active.id);
    // Group by productId
    const byProduct = {};
    for (const v of variants) {
      if (!byProduct[v.product_id]) byProduct[v.product_id] = [];
      byProduct[v.product_id].push({
        id: v.variant_id,
        newPrice: v.original_price,
        compareAtPrice: v.original_compare_at_price,
      });
    }

    let applied = 0;
    for (const [productId, vars] of Object.entries(byProduct)) {
      await applyProductDiscount(shop, shopRecord.access_token, productId, vars);
      applied++;
      if (applied % 10 === 0) await sleep(300);
    }

    await revertOperation(active.id);
    res.json({ success: true, revertedProducts: applied, revertedVariants: variants.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/operations', async (req, res) => {
  const { shop } = req.query;
  if (!shop) return res.status(400).json({ error: 'Missing shop' });
  const ops = await getOperations(shop);
  res.json({ operations: ops });
});

module.exports = router;
