import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShoppingCart, User, LogOut, Trash2, CheckCircle } from 'lucide-react';

const USER_API = 'http://localhost:3001/api/users';
const FOOD_API = 'http://localhost:3002/api/foods';
const ORDER_API = 'http://localhost:3003/api/orders';
const PAYMENT_API = 'http://localhost:3004/api/payments';

function App() {
  const [view, setView] = useState('login'); // login, register, menu, orders
  const [currentUser, setCurrentUser] = useState(null);
  const [foods, setFoods] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (currentUser) {
      fetchFoods();
      fetchOrders();
    }
  }, [currentUser]);

  const fetchFoods = async () => {
    try {
      const res = await axios.get(FOOD_API);
      setFoods(res.data);
    } catch (e) {
      console.error('Error fetching foods', e);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(ORDER_API);
      // Filter orders for the current user
      setOrders(res.data.filter(o => o.userId === currentUser.id));
    } catch (e) {
      console.error('Error fetching orders', e);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${USER_API}/login`, authForm);
      setCurrentUser(res.data);
      setView('menu');
    } catch (e) {
      alert('Login failed: ' + (e.response?.data?.message || e.message));
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${USER_API}/register`, authForm);
      alert('Registration successful! Please login.');
      setView('login');
    } catch (e) {
      alert('Registration failed');
    }
  };

  const addToCart = (food) => {
    const existing = cart.find(item => item.id === food.id);
    if (existing) {
      setCart(cart.map(item => item.id === food.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...food, quantity: 1 }]);
    }
    setIsCartOpen(true);
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    try {
      // 1. Create Order
      const orderRes = await axios.post(ORDER_API, {
        userId: currentUser.id,
        items: cart.map(item => ({ foodId: item.id, quantity: item.quantity }))
      });
      const orderId = orderRes.data.id;

      // 2. Process Payment (COD for simplicity in demo)
      await axios.post(PAYMENT_API, {
        orderId: orderId,
        method: 'COD'
      });

      setCart([]);
      setIsCartOpen(false);
      fetchOrders();
      setView('orders');
      setNotification(`Đặt hàng thành công đơn #${orderId}!`);
      setTimeout(() => setNotification(null), 5000);
    } catch (e) {
      alert('Order failed: ' + e.message);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setView('login');
    setCart([]);
  };

  if (!currentUser) {
    return (
      <div className="app-container">
        <div className="auth-card">
          <h2 style={{ color: 'var(--primary)' }}>ShopeeFood Internal</h2>
          <h3>{view === 'login' ? 'Đăng nhập' : 'Đăng ký'}</h3>
          <form onSubmit={view === 'login' ? handleLogin : handleRegister}>
            <div className="form-group">
              <label>Tên đăng nhập</label>
              <input
                type="text"
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu</label>
              <input
                type="password"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
            </div>
            <button type="submit">{view === 'login' ? 'Vào ứng dụng' : 'Đăng ký ngay'}</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem' }}>
            {view === 'login' ? (
              <>Chưa có tài khoản? <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setView('register')}>Đăng ký</span></>
            ) : (
              <>Đã có tài khoản? <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setView('login')}>Đăng nhập</span></>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header>
        <div className="header-content">
          <a href="#" className="logo" onClick={() => setView('menu')}>ShopeeFood <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#666' }}>Internal</span></a>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <User size={16} /> {currentUser.username} ({currentUser.role})
            </span>
            <button
              onClick={() => setIsCartOpen(true)}
              style={{ width: 'auto', background: 'transparent', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <ShoppingCart size={20} />
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '50%', padding: '2px 6px', fontSize: '10px' }}>
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            </button>
            <button onClick={() => setView('orders')} style={{ width: 'auto', background: '#eee', color: '#333' }}>Đơn hàng</button>
            <button onClick={logout} style={{ width: 'auto', background: 'transparent', color: '#666' }}><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="app-container">
        {notification && (
          <div style={{ background: '#d4edda', color: '#155724', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={20} /> {notification}
          </div>
        )}

        {view === 'menu' ? (
          <div>
            <h2 style={{ marginBottom: '2rem' }}>Món ngon hôm nay</h2>
            <div className="food-grid">
              {foods.map(food => (
                <div key={food.id} className="food-card">
                  <img src={food.image} alt={food.name} className="food-img" />
                  <div className="food-info">
                    <div className="food-name">{food.name}</div>
                    <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1rem' }}>{food.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="food-price">{food.price.toLocaleString()}đ</div>
                      <button onClick={() => addToCart(food)} style={{ width: 'auto', padding: '8px 16px' }}>Chọn</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h2 style={{ marginBottom: '2rem' }}>Lịch sử đơn hàng</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {orders.length === 0 ? <p>Chưa có đơn hàng nào.</p> : orders.slice().reverse()?.map(order => (
                <div key={order.id} style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <strong>Đơn hàng #{order.id}</strong>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      background: order.status === 'Paid' ? '#e6f4ea' : '#fff3cd',
                      color: order.status === 'Paid' ? '#1e7e34' : '#856404'
                    }}>{order.status}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {order.items?.map(item => `${item.name} x${item.quantity}`).join(', ')}
                  </div>
                  <div style={{ marginTop: '10px', fontWeight: 600, color: 'var(--primary)' }}>
                    Tổng cộng: {order.total.toLocaleString()}đ
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {isCartOpen && (
        <div className="cart-drawer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Giỏ hàng</h3>
            <button onClick={() => setIsCartOpen(false)} style={{ width: 'auto', background: 'none', color: '#666' }}>Đóng</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {cart.length === 0 ? <p>Giỏ hàng trống</p> : cart.map(item => (
              <div key={item.id} className="cart-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>{item.price.toLocaleString()}đ x {item.quantity}</div>
                </div>
                <button onClick={() => removeFromCart(item.id)} style={{ width: 'auto', background: 'none', color: '#ff4d4f' }}>
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontWeight: 700 }}>
              <span>Tổng cộng</span>
              <span>{cart.reduce((a, b) => a + (b.price * b.quantity), 0).toLocaleString()}đ</span>
            </div>
            <button onClick={checkout} disabled={cart.length === 0} style={{ opacity: cart.length === 0 ? 0.5 : 1 }}>Đặt hàng ngay</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
