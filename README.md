project:
  name: "Bookstore Application"
  description: "Aplikasi toko buku online berbasis Node.js dan PostgreSQL dengan sistem login, cart, wishlist, dan dashboard admin."

features:
  - Autentikasi pengguna (register, login, logout)
  - CRUD data buku (khusus admin)
  - Keranjang belanja (cart)
  - Wishlist (daftar keinginan)
  - Profil pengguna
  - Upload gambar untuk buku dan profil
  - Proteksi akses (login required)
  - UI minimalis dan konsisten menggunakan favicon icons

technologies:
  backend: "Node.js (tanpa framework Express)"
  frontend: "HTML, CSS, dan JavaScript murni"
  database: "PostgreSQL (Railway)"
  styling: "TailwindCSS"
  alert: "SweetAlert2 (notifikasi interaktif)"

prerequisites:
  - Node.js v14 atau lebih baru
  - npm
  - Akun Railway untuk database PostgreSQL

installation:
  steps:
    - step: "1. Instal Node.js dan npm"
      instructions: |
        Unduh Node.js dari https://nodejs.org/ (pilih LTS version).
        Setelah selesai, periksa instalasi dengan:
          node -v
          npm -v

    - step: "2. Clone Repository"
      commands:
        - git clone https://github.com/Akiraa-cat/paas-bookstore.git
        - cd paas-bookstore

    - step: "3. Install Dependencies"
      commands:
        - npm install

    - step: "4. Setup Database PostgreSQL di Railway"
      instructions: |
        1. Masuk ke https://railway.app
        2. Buat proyek baru dan tambahkan PostgreSQL Plugin
        3. Setelah dibuat, buka tab Variables → salin connection string seperti:
           postgresql://user:password@host:port/database
        4. Buka terminal proyek dan buat file `.env` berisi:

          DATABASE_URL=postgresql://user:password@host:port/database
          PORT=3000

        5. Jalankan SQL schema berikut di Railway:
      sql_schema: |
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          photo VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE books (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          author VARCHAR(255),
          price DECIMAL(10,2),
          image VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE cart (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
          quantity INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE wishlist (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          book_id INTEGER REFERENCES books(id) ON DELETE CASCADE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

    - step: "5. Jalankan Aplikasi"
      commands:
        - npm start
        - npm run dev
      access_url: "http://localhost:3000"

folder_structure: |
  bookstore-app/
  ├── views/
  │   ├── index.html
  │   ├── books.html
  │   ├── add_book.html
  │   ├── cart.html
  │   ├── wishlist.html
  │   ├── login.html
  │   ├── register.html
  │   └── profile.html
  ├── public/
  │   └── uploads/
  │       ├── books/
  │       └── users/
  ├── app.js
  ├── db.js
  ├── .env
  ├── package.json
  └── README.md

usage:
  user_flow:
    - Register atau login melalui halaman /login
    - Jelajahi daftar buku di /books
    - Tambahkan buku ke cart atau wishlist
    - Lihat dan ubah profil di /profile
  admin_flow:
    - Login sebagai admin
    - Tambah, edit, dan hapus buku
    - Mengelola data di halaman admin (CRUD)

api_endpoints:
  authentication:
    - POST /api/register : register user baru
    - POST /api/login : login user
    - GET /api/logout : logout user
  user_profile:
    - GET /api/profile : mendapatkan data user
    - PUT /api/profile : memperbarui profil user
  books:
    - GET /api/books : ambil semua buku
    - GET /api/books/:id : ambil detail buku
    - POST /api/books : tambah buku (admin only)
    - PUT /api/books/:id : update buku (admin only)
    - DELETE /api/books/:id : hapus buku (admin only)
  cart:
    - GET /api/cart : lihat isi cart
    - POST /api/cart : tambah ke cart
    - PUT /api/cart/:id : ubah quantity
    - DELETE /api/cart/:id : hapus dari cart
  wishlist:
    - GET /api/wishlist : lihat wishlist
    - POST /api/wishlist : tambah ke wishlist
    - DELETE /api/wishlist/:id : hapus dari wishlist

access_control:
  - Hanya user login yang dapat mengakses:
    - /cart
    - /wishlist
    - /profile
  - Hanya admin yang dapat:
    - Tambah, edit, hapus buku (CRUD)
  - User biasa hanya dapat:
    - Melihat buku
    - Menambah ke cart/wishlist

security:
  - Hash password dengan bcrypt
  - Gunakan session/token untuk login
  - Validasi form input sebelum query
  - Cegah SQL Injection dengan parameterized query
  - Batasi upload file berdasarkan tipe (jpg/png/jpeg)
  - Jangan commit file .env

deployment:
  railway:
    steps:
      - Hubungkan repository GitHub ke Railway
      - Tambahkan variabel lingkungan DATABASE_URL dan PORT
      - Deploy otomatis setelah push ke branch utama
  optional:
    - Gunakan storage eksternal untuk gambar (Cloudinary atau AWS S3)
    - Tambahkan custom domain jika diperlukan

troubleshooting:
  - Jika database tidak terkoneksi: periksa DATABASE_URL dan koneksi Railway
  - Jika port 3000 sudah digunakan:
    - Windows: netstat -ano | findstr :3000 lalu taskkill /PID <PID> /F
    - Linux/Mac: lsof -ti:3000 | xargs kill -9
  - Jika file upload gagal: periksa permission folder public/uploads
  - Jika modul tidak ditemukan: jalankan npm install

todo:
  - Tambahkan fitur forgot password
  - Tambahkan verifikasi email
  - Tambahkan sistem order history
  - Tambahkan dark mode
  - Tambahkan integrasi pembayaran (Midtrans / Stripe)

development:
  scripts:
    start: "node app.js"
    dev: "node --watch app.js"
  gitignore: |
    node_modules/
    .env
    public/uploads/*
    !public/uploads/.gitkeep
    *.log
    .DS_Store

license: "MIT License"

contributing: "Pull requests diterima. Buka issue terlebih dahulu untuk perubahan besar."

author:
  name: "Akiwaa"
  note: "Dibuat untuk pembelajaran dan pengembangan aplikasi CRUD dengan Node.js dan PostgreSQL."
