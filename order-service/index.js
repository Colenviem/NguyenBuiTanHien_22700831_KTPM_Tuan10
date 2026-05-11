import express from 'express';
import cors from 'cors';
import axios from 'axios';
import mariadb from 'mariadb';

const app = express();
const PORT = 3003;

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
    await conn.query(`CREATE DATABASE IF NOT EXISTS order_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`ALTER DATABASE order_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();

    pool = mariadb.createPool({ ...dbConfig, database: 'order_service_db', connectionLimit: 5 });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        username VARCHAR(255) NOT NULL,
        total INT NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        orderId INT NOT NULL,
        foodId INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        price INT NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    await pool.query(`ALTER TABLE orders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await pool.query(`ALTER TABLE order_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    console.log('Order Service Database initialized (MariaDB)');
  } catch (error) {
    console.error('Order DB Error:', error.message);
  }
}

initDB();

app.post('/api/orders', async (req, res) => {
  const { userId, items } = req.body;

  try {
    const userRes = await axios.get(`http://localhost:3001/api/users`);
    const user = userRes.data.find(u => u.id === Number(userId));
    if (!user) return res.status(400).json({ message: 'Invalid user' });

    const foodRes = await axios.get(`http://localhost:3002/api/foods`);
    const allFoods = foodRes.data;
    
    let total = 0;
    const itemsToProcess = items.map(item => {
      const food = allFoods.find(f => f.id === Number(item.foodId));
      if (!food) throw new Error(`Food item ${item.foodId} not found`);
      total += food.price * item.quantity;
      return { foodId: food.id, name: food.name, quantity: item.quantity, price: food.price };
    });

    const orderResult = await pool.query(
      'INSERT INTO orders (userId, username, total) VALUES (?, ?, ?)',
      [userId, user.username, total]
    );
    const orderId = Number(orderResult.insertId);

    for (const item of itemsToProcess) {
      await pool.query(
        'INSERT INTO order_items (orderId, foodId, name, quantity, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.foodId, item.name, item.quantity, item.price]
      );
    }

    res.status(201).json({ id: orderId, userId, username: user.username, total, status: 'Pending', items: itemsToProcess });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await pool.query('SELECT * FROM orders');
    const enrichedOrders = [];
    
    for (const order of orders) {
      const items = await pool.query('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
      enrichedOrders.push({
        ...order,
        id: Number(order.id),
        items: items.map(item => ({...item, id: Number(item.id), orderId: Number(item.orderId)}))
      });
    }
    
    res.json(enrichedOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const id = req.params.id;
  const { status } = req.body;
  try {
    await pool.query('UPDATE orders SET status=? WHERE id=?', [status, id]);
    const rows = await pool.query('SELECT * FROM orders WHERE id=?', [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(404).json({ message: 'Order not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});
