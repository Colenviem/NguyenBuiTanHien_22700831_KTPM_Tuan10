import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mariadb from 'mariadb';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sapassword',
  port: parseInt(process.env.DB_PORT || '3306')
};

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';

let pool;

async function initDB() {
  let connected = false;
  while (!connected) {
    try {
      const conn = await mariadb.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
        port: dbConfig.port
      });
      await conn.query(`CREATE DATABASE IF NOT EXISTS payment_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.query(`ALTER DATABASE payment_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.end();

      pool = mariadb.createPool({ ...dbConfig, database: 'payment_service_db', connectionLimit: 5 });

      await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          orderId INT NOT NULL,
          method VARCHAR(50),
          status VARCHAR(50) DEFAULT 'Success',
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      console.log(`Payment Service Database initialized on ${dbConfig.host}`);
      connected = true;
    } catch (error) {
      console.error(`Payment DB Connection failed (${error.message}). Retrying in 5s...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

initDB();

app.post('/api/payments', async (req, res) => {
  const { orderId, method } = req.body;

  try {
    await pool.query('INSERT INTO payments (orderId, method) VALUES (?, ?)', [orderId, method]);
    
    const orderRes = await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/status`, {
      status: 'Paid'
    });
    const order = orderRes.data;

    console.log('--- NOTIFICATION ---');
    console.log(`User ${order.username} đã đặt đơn #${order.id} thành công`);
    console.log('--------------------');

    res.json({
      message: 'Payment processed and notification sent',
      order: order
    });
  } catch (error) {
    console.error('Payment error:', error.message);
    res.status(500).json({ message: 'Failed to process payment' });
  }
});

app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});
