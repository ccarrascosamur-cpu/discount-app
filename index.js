const express = require('express');
const { PORT } = require('./config');
const { getDb } = require('./lib/db');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const publicRoutes = require('./routes/public');

const app = express();
app.use(express.json());
app.use('/', authRoutes);
app.use('/api', apiRoutes);
app.use('/', publicRoutes);

async function main() {
  await getDb();
  app.listen(PORT, () => {
    console.log(`Discounts app running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
