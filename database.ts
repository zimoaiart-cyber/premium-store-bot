// Database module for Deno with Neon.tech PostgreSQL
import { Pool, PoolClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

let pool: Pool | null = null;

export interface User {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string | null;
  created_at: Date;
}

export interface CartItem {
  id: number;
  user_id: number;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  added_at: Date;
}

export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  status: string;
  payment_id: string | null;
  created_at: Date;
}

export interface ManagerRequest {
  id: number;
  user_id: number;
  message_text: string;
  status: string;
  admin_response: string | null;
  created_at: Date;
  resolved_at: Date | null;
}

export async function initPool(databaseUrl: string): Promise<void> {
  pool = new Pool(databaseUrl, 10, true);
  await createTables();
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error("Database pool not initialized. Call initPool() first.");
  }
  return pool;
}

async function createTables(): Promise<void> {
  const client = await getPool().connect();
  try {
    // Users table
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS users (
        user_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cart items table
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        product_id TEXT,
        product_name TEXT,
        price INTEGER,
        quantity INTEGER DEFAULT 1,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        UNIQUE (user_id, product_id)
      )
    `);

    // Orders table
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        total_amount INTEGER,
        status TEXT DEFAULT 'pending',
        payment_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // Order items table
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER,
        product_id TEXT,
        product_name TEXT,
        price INTEGER,
        quantity INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      )
    `);

    // Manager requests table
    await client.queryArray(`
      CREATE TABLE IF NOT EXISTS manager_requests (
        id SERIAL PRIMARY KEY,
        user_id BIGINT,
        message_text TEXT,
        status TEXT DEFAULT 'pending',
        admin_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
      )
    `);

    // Indexes
    await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id)`);
    await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`);
    await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
    await client.queryArray(`CREATE INDEX IF NOT EXISTS idx_manager_requests_status ON manager_requests(status)`);
  } finally {
    client.release();
  }
}

// User methods
export async function addUser(
  client: PoolClient,
  userId: number,
  username: string,
  firstName: string,
  lastName: string | null = null
): Promise<void> {
  await client.queryArray(
    `INSERT INTO users (user_id, username, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       username = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name`,
    [userId, username, firstName, lastName]
  );
}

export async function getUser(client: PoolClient, userId: number): Promise<User | null> {
  const result = await client.queryObject<User>(
    "SELECT * FROM users WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

// Cart methods
export async function addToCart(
  client: PoolClient,
  userId: number,
  productId: string,
  productName: string,
  price: number,
  quantity: number = 1
): Promise<void> {
  await client.queryArray(
    `INSERT INTO cart_items (user_id, product_id, product_name, price, quantity)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, product_id) DO UPDATE SET
       quantity = cart_items.quantity + EXCLUDED.quantity`,
    [userId, productId, productName, price, quantity]
  );
}

export async function getCartItems(client: PoolClient, userId: number): Promise<CartItem[]> {
  const result = await client.queryObject<CartItem>(
    "SELECT * FROM cart_items WHERE user_id = $1 ORDER BY added_at",
    [userId]
  );
  return result.rows;
}

export async function updateCartQuantity(
  client: PoolClient,
  userId: number,
  productId: string,
  quantity: number
): Promise<void> {
  if (quantity <= 0) {
    await client.queryArray(
      "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
      [userId, productId]
    );
  } else {
    await client.queryArray(
      "UPDATE cart_items SET quantity = $3 WHERE user_id = $1 AND product_id = $2",
      [userId, productId, quantity]
    );
  }
}

export async function removeFromCart(
  client: PoolClient,
  userId: number,
  productId: string
): Promise<void> {
  await client.queryArray(
    "DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2",
    [userId, productId]
  );
}

export async function clearCart(client: PoolClient, userId: number): Promise<void> {
  await client.queryArray("DELETE FROM cart_items WHERE user_id = $1", [userId]);
}

export async function getCartTotal(client: PoolClient, userId: number): Promise<number> {
  const result = await client.queryObject<{ total: number }>(
    "SELECT COALESCE(SUM(price * quantity), 0) as total FROM cart_items WHERE user_id = $1",
    [userId]
  );
  return result.rows[0]?.total || 0;
}

export async function getCartCount(client: PoolClient, userId: number): Promise<number> {
  const result = await client.queryObject<{ count: number }>(
    "SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = $1",
    [userId]
  );
  return result.rows[0]?.count || 0;
}

// Order methods
export async function createOrder(
  client: PoolClient,
  userId: number,
  totalAmount: number,
  paymentId: string | null = null
): Promise<number> {
  const result = await client.queryObject<{ id: number }>(
    `INSERT INTO orders (user_id, total_amount, payment_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, totalAmount, paymentId]
  );
  return result.rows[0].id;
}

export async function addOrderItem(
  client: PoolClient,
  orderId: number,
  productId: string,
  productName: string,
  price: number,
  quantity: number
): Promise<void> {
  await client.queryArray(
    `INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, productId, productName, price, quantity]
  );
}

export async function updateOrderStatus(
  client: PoolClient,
  orderId: number,
  status: string
): Promise<void> {
  await client.queryArray(
    "UPDATE orders SET status = $1 WHERE id = $2",
    [status, orderId]
  );
}

export async function getOrder(client: PoolClient, orderId: number): Promise<Order | null> {
  const result = await client.queryObject<Order>(
    "SELECT * FROM orders WHERE id = $1",
    [orderId]
  );
  return result.rows[0] || null;
}

export async function getOrderItems(client: PoolClient, orderId: number): Promise<CartItem[]> {
  const result = await client.queryObject<CartItem>(
    "SELECT * FROM order_items WHERE order_id = $1",
    [orderId]
  );
  return result.rows;
}

export async function getPendingOrders(client: PoolClient): Promise<Order[]> {
  const result = await client.queryObject<Order>(
    `SELECT o.*, u.first_name, u.last_name, u.username
     FROM orders o
     JOIN users u ON o.user_id = u.user_id
     WHERE o.status = 'pending'
     ORDER BY o.created_at DESC`
  );
  return result.rows;
}

// Manager request methods
export async function createManagerRequest(
  client: PoolClient,
  userId: number,
  messageText: string
): Promise<number> {
  const result = await client.queryObject<{ id: number }>(
    `INSERT INTO manager_requests (user_id, message_text)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, messageText]
  );
  return result.rows[0].id;
}

export async function getPendingManagerRequests(client: PoolClient): Promise<ManagerRequest[]> {
  const result = await client.queryObject<ManagerRequest>(
    `SELECT mr.*, u.first_name, u.last_name, u.username 
     FROM manager_requests mr
     JOIN users u ON mr.user_id = u.user_id
     WHERE mr.status = 'pending'
     ORDER BY mr.created_at DESC`
  );
  return result.rows;
}

export async function getManagerRequest(
  client: PoolClient,
  requestId: number
): Promise<ManagerRequest | null> {
  const result = await client.queryObject<ManagerRequest>(
    "SELECT * FROM manager_requests WHERE id = $1",
    [requestId]
  );
  return result.rows[0] || null;
}

export async function setAdminResponse(
  client: PoolClient,
  requestId: number,
  responseText: string
): Promise<void> {
  await client.queryArray(
    `UPDATE manager_requests 
     SET admin_response = $1, status = 'answered'
     WHERE id = $2`,
    [responseText, requestId]
  );
}

export async function resolveManagerRequest(
  client: PoolClient,
  requestId: number
): Promise<void> {
  await client.queryArray(
    `UPDATE manager_requests 
     SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [requestId]
  );
}
