import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
});

// ==================== USER QUERIES ====================

export const createUser = async (name, email, password, photo = null) => {
  const query = `
    INSERT INTO users (name, email, password, photo)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, email, photo
  `;
  const values = [name, email, password, photo];
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const getUserByEmail = async (email) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  return result.rows[0];
};

export const getUserById = async (id) => {
  const query = 'SELECT id, name, email, photo FROM users WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

export const updateUser = async (id, name, email, photo = null) => {
  const query = photo
    ? 'UPDATE users SET name = $1, email = $2, photo = $3 WHERE id = $4 RETURNING id, name, email, photo'
    : 'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, photo';
  
  const values = photo ? [name, email, photo, id] : [name, email, id];
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const getAllUsers = async () => {
  const query = 'SELECT id, name, email, photo FROM users ORDER BY id';
  const result = await pool.query(query);
  return result.rows;
};

// ==================== BOOK QUERIES ====================

export const createBook = async (title, author, price, image = null) => {
  const query = `
    INSERT INTO books (title, author, price, image)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const values = [title, author, price, image];
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const getAllBooks = async (limit = null) => {
  const query = limit 
    ? 'SELECT * FROM books ORDER BY id DESC LIMIT $1'
    : 'SELECT * FROM books ORDER BY id DESC';
  
  const result = limit 
    ? await pool.query(query, [limit])
    : await pool.query(query);
  
  return result.rows;
};

export const getBookById = async (id) => {
  const query = 'SELECT * FROM books WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

export const updateBook = async (id, title, author, price, image = null) => {
  const query = image
    ? 'UPDATE books SET title = $1, author = $2, price = $3, image = $4 WHERE id = $5 RETURNING *'
    : 'UPDATE books SET title = $1, author = $2, price = $3 WHERE id = $4 RETURNING *';
  
  const values = image ? [title, author, price, image, id] : [title, author, price, id];
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const deleteBook = async (id) => {
  const query = 'DELETE FROM books WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// ==================== CART QUERIES ====================

export const getCartByUserId = async (userId) => {
  const query = `
    SELECT c.id, c.quantity, c.user_id, c.book_id,
           json_build_object(
             'id', b.id,
             'title', b.title,
             'author', b.author,
             'price', b.price,
             'image', b.image
           ) as book
    FROM cart c
    JOIN books b ON c.book_id = b.id
    WHERE c.user_id = $1
    ORDER BY c.id DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const addToCart = async (userId, bookId, quantity = 1) => {
  // Check if item already exists
  const checkQuery = 'SELECT * FROM cart WHERE user_id = $1 AND book_id = $2';
  const existing = await pool.query(checkQuery, [userId, bookId]);
  
  if (existing.rows.length > 0) {
    // Update quantity
    const updateQuery = `
      UPDATE cart SET quantity = quantity + $1 
      WHERE user_id = $2 AND book_id = $3 
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [quantity, userId, bookId]);
    return result.rows[0];
  } else {
    // Insert new
    const insertQuery = `
      INSERT INTO cart (user_id, book_id, quantity)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [userId, bookId, quantity]);
    return result.rows[0];
  }
};

export const updateCartQuantity = async (cartId, quantity) => {
  const query = 'UPDATE cart SET quantity = $1 WHERE id = $2 RETURNING *';
  const result = await pool.query(query, [quantity, cartId]);
  return result.rows[0];
};

export const removeFromCart = async (cartId) => {
  const query = 'DELETE FROM cart WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [cartId]);
  return result.rows[0];
};

export const clearCart = async (userId) => {
  const query = 'DELETE FROM cart WHERE user_id = $1';
  await pool.query(query, [userId]);
};

export const deleteCartByBookId = async (bookId) => {
  const query = 'DELETE FROM cart WHERE book_id = $1';
  await pool.query(query, [bookId]);
};

// ==================== WISHLIST QUERIES ====================

export const getWishlistByUserId = async (userId) => {
  const query = `
    SELECT w.id, w.user_id, w.book_id,
           json_build_object(
             'id', b.id,
             'title', b.title,
             'author', b.author,
             'price', b.price,
             'image', b.image
           ) as book
    FROM wishlist w
    JOIN books b ON w.book_id = b.id
    WHERE w.user_id = $1
    ORDER BY w.id DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

export const addToWishlist = async (userId, bookId) => {
  // Check if already exists
  const checkQuery = 'SELECT * FROM wishlist WHERE user_id = $1 AND book_id = $2';
  const existing = await pool.query(checkQuery, [userId, bookId]);
  
  if (existing.rows.length > 0) {
    return existing.rows[0]; // Already in wishlist
  }
  
  const insertQuery = `
    INSERT INTO wishlist (user_id, book_id)
    VALUES ($1, $2)
    RETURNING *
  `;
  const result = await pool.query(insertQuery, [userId, bookId]);
  return result.rows[0];
};

export const removeFromWishlist = async (wishlistId) => {
  const query = 'DELETE FROM wishlist WHERE id = $1 RETURNING *';
  const result = await pool.query(query, [wishlistId]);
  return result.rows[0];
};

export const clearWishlist = async (userId) => {
  const query = 'DELETE FROM wishlist WHERE user_id = $1';
  await pool.query(query, [userId]);
};

export const deleteWishlistByBookId = async (bookId) => {
  const query = 'DELETE FROM wishlist WHERE book_id = $1';
  await pool.query(query, [bookId]);
};

// ==================== EXPORT ====================

export default {
  query: (text, params) => pool.query(text, params),
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  getAllUsers,
  createBook,
  getAllBooks,
  getBookById,
  updateBook,
  deleteBook,
  deleteCartByBookId,
  getCartByUserId,
  addToCart,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getWishlistByUserId,
  addToWishlist,
  removeFromWishlist,
  clearWishlist,
  deleteWishlistByBookId
};