import express from 'express';
import cors from 'cors';
import mariadb from 'mariadb';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'sapassword',
  port: parseInt(process.env.DB_PORT || '3306')
};

let pool;

async function initDB() {
  try {
    const conn = await mariadb.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });
    await conn.query(`CREATE DATABASE IF NOT EXISTS user_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`ALTER DATABASE user_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();

    pool = mariadb.createPool({ ...dbConfig, database: 'user_service_db', connectionLimit: 5 });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('USER', 'ADMIN') DEFAULT 'USER'
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    const rows = await pool.query('SELECT * FROM users WHERE username = "admin"');
    if (rows.length === 0) {
      await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', 'admin', 'ADMIN']);
      await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['user', 'user', 'USER']);
    }

    console.log(`User Service Database initialized on ${dbConfig.host}`);
  } catch (error) {
    console.error('User DB Error:', error.message);
  }
}

initDB();

app.post('/api/users/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, 'USER']);
    const rows = await pool.query('SELECT id, username, role FROM users WHERE username = ?', [username]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(400).json({ message: 'User already exists or registration failed' });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const rows = await pool.query('SELECT id, username, role FROM users WHERE username = ? AND password = ?', [username, password]);
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const rows = await pool.query('SELECT id, username, role FROM users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`User Service running on port ${PORT}`);
});
