const { SHOPIFY_API_VERSION } = require('../config');

function getAdminUrl(shop) {
  return `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

async function graphqlRequest(shop, accessToken, query, variables = {}) {
  const res = await fetch(getAdminUrl(shop), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error('Shopify GraphQL error:', JSON.stringify(json.errors, null, 2));
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }
  return json.data;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCollections(shop, accessToken) {
  const query = `
    query GetCollections($cursor: String) {
      collections(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id title handle }
      }
    }
  `;
  const collections = [];
  let cursor = null;
  while (true) {
    const data = await graphqlRequest(shop, accessToken, query, { cursor });
    collections.push(...data.collections.nodes);
    if (!data.collections.pageInfo.hasNextPage) break;
    cursor = data.collections.pageInfo.endCursor;
  }
  return collections;
}

async function getProducts(shop, accessToken, collectionId = null) {
  if (collectionId) {
    return getProductsByCollection(shop, accessToken, collectionId);
  }
  const query = `
    query GetProducts($cursor: String) {
      products(first: 250, after: $cursor, query: "status:active") {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          title
          variants(first: 50) {
            nodes {
              id
              title
              price
              compareAtPrice
            }
          }
        }
      }
    }
  `;
  const products = [];
  let cursor = null;
  while (true) {
    const data = await graphqlRequest(shop, accessToken, query, { cursor });
    products.push(...data.products.nodes);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return products;
}

async function getProductsByCollection(shop, accessToken, collectionId) {
  const query = `
    query GetCollectionProducts($id: ID!, $cursor: String) {
      collection(id: $id) {
        products(first: 250, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            title
            variants(first: 50) {
              nodes {
                id
                title
                price
                compareAtPrice
              }
            }
          }
        }
      }
    }
  `;
  const products = [];
  let cursor = null;
  while (true) {
    const data = await graphqlRequest(shop, accessToken, query, { id: collectionId, cursor });
    products.push(...data.collection.products.nodes);
    if (!data.collection.products.pageInfo.hasNextPage) break;
    cursor = data.collection.products.pageInfo.endCursor;
  }
  return products;
}

async function applyProductDiscount(shop, accessToken, productId, variants) {
  const mutation = `
    mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id price compareAtPrice }
        userErrors { field message }
      }
    }
  `;
  const variables = {
    productId,
    variants: variants.map((v) => ({
      id: v.id,
      price: v.newPrice,
      compareAtPrice: v.compareAtPrice,
    })),
  };
  const data = await graphqlRequest(shop, accessToken, mutation, variables);
  if (data.productVariantsBulkUpdate.userErrors.length > 0) {
    throw new Error(data.productVariantsBulkUpdate.userErrors.map((e) => e.message).join('; '));
  }
}

module.exports = {
  graphqlRequest,
  getCollections,
  getProducts,
  getProductsByCollection,
  applyProductDiscount,
  sleep,
};
