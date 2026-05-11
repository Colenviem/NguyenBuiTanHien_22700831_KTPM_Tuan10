import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mariadb from 'mariadb';

const app = express();
const PORT = 3004;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'sapassword',
  port: 3306
};

let pool;

async function initDB() {
  try {
    const conn = await mariadb.createConnection(dbConfig);
    await conn.query(`CREATE DATABASE IF NOT EXISTS payment_service_db`);
    await conn.end();

    pool = mariadb.createPool({ ...dbConfig, database: 'payment_service_db', connectionLimit: 5 });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId INT NOT NULL,
        method VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Success',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Payment Service Database initialized (MariaDB)');
  } catch (error) {
    console.error('Payment DB Error:', error.message);
  }
}

initDB();

app.post('/api/payments', async (req, res) => {
  const { orderId, method } = req.body;

  try {
    await pool.query('INSERT INTO payments (orderId, method) VALUES (?, ?)', [orderId, method]);
    
    const orderRes = await axios.patch(`http://localhost:3003/api/orders/${orderId}/status`, {
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
