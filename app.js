import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as db from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Simple session storage (in-memory)
const sessions = new Map();

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper: Parse multipart form data
function parseMultipart(buffer, boundary) {
  const fields = {};
  const files = {};
  
  const text = buffer.toString('binary');
  const parts = text.split(`--${boundary}`);
  
  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;
    
    const nameMatch = part.match(/name="([^"]+)"/);
    const filenameMatch = part.match(/filename="([^"]+)"/);
    
    if (!nameMatch) continue;
    
    const fieldName = nameMatch[1];
    const headerEndIndex = part.indexOf('\r\n\r\n');
    
    if (headerEndIndex === -1) continue;
    
    const contentStart = headerEndIndex + 4;
    const contentEnd = part.lastIndexOf('\r\n');
    
    if (contentEnd <= contentStart) continue;
    
    if (filenameMatch && filenameMatch[1]) {
      const filename = filenameMatch[1];
      const binaryContent = part.substring(contentStart, contentEnd);
      const fileBuffer = Buffer.from(binaryContent, 'binary');
      
      files[fieldName] = {
        filename: filename,
        data: fileBuffer
      };
    } else {
      const textContent = part.substring(contentStart, contentEnd);
      fields[fieldName] = textContent;
    }
  }
  
  return { fields, files };
}

// Helper: Get session
function getSession(req) {
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
  
  const sessionId = cookies?.sessionId;
  return sessionId ? sessions.get(sessionId) : null;
}

// Helper: Create session
function createSession(userId) {
  const sessionId = Math.random().toString(36).substring(7);
  sessions.set(sessionId, { userId, createdAt: Date.now() });
  return sessionId;
}

// Helper: Send JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Helper: Serve static file
function serveStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Helper: Save uploaded file
function saveUploadedFile(fileBuffer, filename, subfolder = '') {
  const uploadDir = path.join(__dirname, 'public', 'uploads', subfolder);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const timestamp = Date.now();
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9]/g, '_');
  const newFilename = `${timestamp}_${baseName}${ext}`;
  const filePath = path.join(uploadDir, newFilename);
  
  fs.writeFileSync(filePath, fileBuffer);
  
  return `/uploads/${subfolder}/${newFilename}`;
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  console.log(`${method} ${pathname}`);

  // ==================== STATIC FILES ====================
  
  if (pathname.startsWith('/uploads/') || pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
    const filePath = path.join(__dirname, 'public', pathname);
    return serveStaticFile(res, filePath);
  }

  // ==================== HTML PAGES ====================
  
  if (method === 'GET') {
    let htmlFile = null;
    
    switch (pathname) {
      case '/':
        htmlFile = 'index.html';
        break;
      case '/books':
        htmlFile = 'books.html';
        break;
      case '/add_book':
        htmlFile = 'add_book.html';
        break;
      case '/cart':
        htmlFile = 'cart.html';
        break;
      case '/wishlist':
        htmlFile = 'wishlist.html';
        break;
      case '/register':
        htmlFile = 'register.html';
        break;
      case '/login':
        htmlFile = 'login.html';
        break;
      case '/profile':
        htmlFile = 'profile.html';
        break;
    }
    
    if (htmlFile) {
      const filePath = path.join(__dirname, 'views', htmlFile);
      return serveStaticFile(res, filePath);
    }
  }

  // ==================== API ROUTES ====================

  // Get all books
  if (pathname === '/api/books' && method === 'GET') {
    try {
      const limit = parsedUrl.query.limit ? parseInt(parsedUrl.query.limit) : null;
      const books = await db.getAllBooks(limit);
      return sendJSON(res, 200, books);
    } catch (error) {
      console.error('Error fetching books:', error);
      return sendJSON(res, 500, { message: 'Server error' });
    }
  }

  // Add new book
  if (pathname === '/api/books' && method === 'POST') {
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'];
        let title, author, price, image = null;

        if (contentType?.includes('multipart/form-data')) {
          const boundary = contentType.split('boundary=')[1];
          const { fields, files } = parseMultipart(buffer, boundary);
          
          title = fields.title;
          author = fields.author;
          price = parseFloat(fields.price);
          
          if (files.image && files.image.data && files.image.data.length > 0) {
            console.log('Saving image:', files.image.filename, 'Size:', files.image.data.length, 'bytes');
            image = saveUploadedFile(files.image.data, files.image.filename, 'books');
            console.log('Image saved to:', image);
          }
        } else {
          const data = JSON.parse(buffer.toString());
          title = data.title;
          author = data.author;
          price = parseFloat(data.price);
          image = data.image;
        }

        const book = await db.createBook(title, author, price, image);
        console.log('Book created:', book);
        return sendJSON(res, 201, book);
      } catch (error) {
        console.error('Error creating book:', error);
        return sendJSON(res, 500, { message: 'Failed to create book: ' + error.message });
      }
    });
    return;
  }

  // Update book
  if (pathname.startsWith('/api/books/') && method === 'PUT') {
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    
    req.on('end', async () => {
      try {
        const bookId = parseInt(pathname.split('/')[3]);
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'];
        let title, author, price, image = null;

        if (contentType?.includes('multipart/form-data')) {
          const boundary = contentType.split('boundary=')[1];
          const { fields, files } = parseMultipart(buffer, boundary);
          
          title = fields.title;
          author = fields.author;
          price = parseFloat(fields.price);
          
          if (files.image && files.image.data && files.image.data.length > 0) {
            image = saveUploadedFile(files.image.data, files.image.filename, 'books');
          }
        } else {
          const data = JSON.parse(buffer.toString());
          title = data.title;
          author = data.author;
          price = parseFloat(data.price);
          image = data.image;
        }

        const book = await db.updateBook(bookId, title, author, price, image);
        return sendJSON(res, 200, book);
      } catch (error) {
        console.error('Error updating book:', error);
        return sendJSON(res, 500, { message: 'Failed to update book: ' + error.message });
      }
    });
    return;
  }

  // Delete book
  if (pathname.startsWith('/api/books/') && method === 'DELETE') {
    try {
      const bookId = parseInt(pathname.split('/').pop());

      // Check if book exists
      const book = await db.getBookById(bookId);
      
      if (!book) {
        return sendJSON(res, 404, { message: 'Book not found' });
      }

      // Delete book from cart and wishlist first
      await db.deleteCartByBookId(bookId);
      await db.deleteWishlistByBookId(bookId);

      // Delete the book
      await db.deleteBook(bookId);

      return sendJSON(res, 200, { message: 'Book deleted successfully' });
    } catch (error) {
      console.error('Error deleting book:', error);
      return sendJSON(res, 500, { message: 'Failed to delete book: ' + error.message });
    }
  }

  // Register user
  if (pathname === '/api/users' && method === 'POST') {
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'];
        let name, email, password, photo = null;

        if (contentType?.includes('multipart/form-data')) {
          const boundary = contentType.split('boundary=')[1];
          const { fields, files } = parseMultipart(buffer, boundary);
          
          name = fields.name;
          email = fields.email;
          password = fields.password;
          
          if (files.photo && files.photo.data && files.photo.data.length > 0) {
            photo = saveUploadedFile(files.photo.data, files.photo.filename, 'users');
          }
        } else {
          const data = JSON.parse(buffer.toString());
          name = data.name;
          email = data.email;
          password = data.password;
        }

        // Check if email exists
        const existing = await db.getUserByEmail(email);
        if (existing) {
          return sendJSON(res, 400, { message: 'Email already registered' });
        }

        const user = await db.createUser(name, email, password, photo);
        return sendJSON(res, 201, { message: 'User created', user });
      } catch (error) {
        console.error('Error creating user:', error);
        return sendJSON(res, 500, { message: 'Failed to create user' });
      }
    });
    return;
  }

  // Login
  if (pathname === '/api/login' && method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { email, password } = JSON.parse(body);
        const user = await db.getUserByEmail(email);
        
        if (!user || user.password !== password) {
          return sendJSON(res, 401, { message: 'Invalid email or password' });
        }
        
        const sessionId = createSession(user.id);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `sessionId=${sessionId}; HttpOnly; Path=/`
        });
        res.end(JSON.stringify({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email } }));
      } catch (error) {
        console.error('Error during login:', error);
        return sendJSON(res, 500, { message: 'Server error' });
      }
    });
    return;
  }

  // Logout
  if (pathname === '/api/logout' && method === 'POST') {
    const session = getSession(req);
    if (session) {
      const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      const sessionId = cookies?.sessionId;
      if (sessionId) {
        sessions.delete(sessionId);
      }
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'sessionId=; HttpOnly; Path=/; Max-Age=0'
    });
    res.end(JSON.stringify({ message: 'Logged out' }));
    return;
  }

  // Get profile
  if (pathname === '/api/profile' && method === 'GET') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    try {
      const user = await db.getUserById(session.userId);
      return sendJSON(res, 200, user);
    } catch (error) {
      console.error('Error fetching profile:', error);
      return sendJSON(res, 500, { message: 'Server error' });
    }
  }

  // Update profile
  if (pathname === '/api/profile' && method === 'PUT') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    
    req.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'];
        let name, email, photo = null;

        if (contentType?.includes('multipart/form-data')) {
          const boundary = contentType.split('boundary=')[1];
          const { fields, files } = parseMultipart(buffer, boundary);
          
          name = fields.name;
          email = fields.email;
          
          if (files.photo && files.photo.data && files.photo.data.length > 0) {
            photo = saveUploadedFile(files.photo.data, files.photo.filename, 'users');
          }
        } else {
          const data = JSON.parse(buffer.toString());
          name = data.name;
          email = data.email;
        }

        const user = await db.updateUser(session.userId, name, email, photo);
        return sendJSON(res, 200, user);
      } catch (error) {
        console.error('Error updating profile:', error);
        return sendJSON(res, 500, { message: 'Failed to update profile' });
      }
    });
    return;
  }

  // Get cart
  if (pathname === '/api/cart' && method === 'GET') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    try {
      const cart = await db.getCartByUserId(session.userId);
      return sendJSON(res, 200, cart);
    } catch (error) {
      console.error('Error fetching cart:', error);
      return sendJSON(res, 500, { message: 'Server error' });
    }
  }

  // Add to cart
  if (pathname === '/api/cart' && method === 'POST') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { book_id, quantity } = JSON.parse(body);
        const cartItem = await db.addToCart(session.userId, book_id, quantity);
        return sendJSON(res, 201, cartItem);
      } catch (error) {
        console.error('Error adding to cart:', error);
        return sendJSON(res, 500, { message: 'Server error' });
      }
    });
    return;
  }

  // Update cart quantity
  if (pathname.startsWith('/api/cart/') && method === 'PATCH') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const cartId = parseInt(pathname.split('/').pop());
        const { quantity } = JSON.parse(body);
        const updated = await db.updateCartQuantity(cartId, quantity);
        return sendJSON(res, 200, updated);
      } catch (error) {
        console.error('Error updating cart:', error);
        return sendJSON(res, 500, { message: 'Server error' });
      }
    });
    return;
  }

  // Remove from cart
  if (pathname.startsWith('/api/cart/') && method === 'DELETE') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    try {
      const cartId = parseInt(pathname.split('/').pop());
      await db.removeFromCart(cartId);
      return sendJSON(res, 200, { message: 'Item removed from cart' });
    } catch (error) {
      console.error('Error removing from cart:', error);
      return sendJSON(res, 500, { message: 'Server error' });
    }
  }

  // Get wishlist
  if (pathname === '/api/wishlist' && method === 'GET') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    try {
      const wishlist = await db.getWishlistByUserId(session.userId);
      return sendJSON(res, 200, wishlist);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
      return sendJSON(res, 500, { message: 'Server error' });
    }
  }

  // Add to wishlist
  if (pathname === '/api/wishlist' && method === 'POST') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { book_id } = JSON.parse(body);
        const wishlistItem = await db.addToWishlist(session.userId, book_id);
        return sendJSON(res, 201, wishlistItem);
      } catch (error) {
        console.error('Error adding to wishlist:', error);
        return sendJSON(res, 500, { message: 'Server error' });
      }
    });
    return;
  }

  // Remove from wishlist
  if (pathname.startsWith('/api/wishlist/') && method === 'DELETE') {
    const session = getSession(req);
    if (!session) {
      return sendJSON(res, 401, { message: 'Not authenticated' });
    }
    
    try {
      const wishlistId = parseInt(pathname.split('/').pop());
      await db.removeFromWishlist(wishlistId);
      return sendJSON(res, 200, { message: 'Item removed from wishlist' });
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      return sendJSON(res, 500, { message: 'Server error' });
    }
  }

  // 404 - Not Found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 - Not Found');
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
