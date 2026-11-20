# JMCFI PostFlow

Welcome to the JMCFI PostFlow project! This guide will help you get the project running on your local machine, whether you're opening it for the first time or cloning it onto a new laptop.

## Project Structure
- `backend/`: Laravel PHP application (API & Database)
- `frontend-rn/`: React Native / Expo application (User Interface)

---

## 🚀 How to Start the Project (Everyday Use)

When you open the project to work on it, you need to start both the backend and frontend servers in separate terminals.

### 1. Start the Backend (Laravel)
Open a new terminal and run:
```bash
cd backend
php artisan serve
```
*(This will start the backend at `http://127.0.0.1:8000`)*

### 2. Start the Frontend (Expo/React Native)
Open a **second** terminal and run:
```bash
cd frontend-rn
npm install  # (Only needed if you added new packages)
npm run web
```
*(Open `http://localhost:3000` in your browser after the build finishes.)*

`npm run web` builds the same production frontend used in deployment and serves it at `http://localhost:3000`, with compressed assets, browser caching, and an API proxy to Laravel on port 8000. Refreshes reuse the built JavaScript instead of requesting a development bundle. After changing source files, restart this command to rebuild. To reuse an existing build, run `npm run preview:web`.

For development with live updates, use `npm run dev`. Development bundles are slower to load than the production preview. Recent dashboard data is cached per account in the current browser session for up to five minutes and refreshed in the background; logout clears it.

The web login preserves the school photograph and purple branding. The existing PostFlow chatbot flies into the welcome with an animated cape, then settles above a centered login card containing the JMC logo. The welcome automatically completes in about four and a half seconds, once per browser tab session. Cursor-following eyes activate on the login screen and close while the password field is focused. After successful sign-in, the assistant pushes the card aside before opening the user's dashboard or pending link; failed attempts keep the form visible. Reduced-motion preferences bypass the introduction and motion effects, and signed-in users continue directly to their dashboard.

To check the welcome and login flows after exporting the web app, run `node tests/startup.browser.cjs` from `frontend-rn`. This uses mocked authentication responses and saves desktop and mobile screenshots in `.expo/startup-qa/`.

---

## 💻 Setting up on a New Laptop (Fresh Clone)

If you clone this repository onto another laptop, follow these steps to get everything connected properly so the admin user can log in.

### Prerequisites
Make sure the new laptop has installed:
- **PHP** (and Composer)
- **Node.js** (and npm)
- **PostgreSQL** (and pgAdmin 4 for easy viewing)

### Step 1: Setup the Database
1. Open **pgAdmin 4** or your PostgreSQL command line.
2. Create a new empty database named `JMCFI`.

### Step 2: Configure the Backend
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install PHP dependencies:
   ```bash
   composer install
   ```
3. Copy the example environment file to create your own `.env`:
   ```bash
   cp .env.example .env
   ```
4. Open the `.env` file in your code editor and update the database settings to match your PostgreSQL setup:
   ```env
   DB_CONNECTION=pgsql
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_DATABASE=JMCFI
   DB_USERNAME=postgres
   DB_PASSWORD=your_postgres_password_here
   ```
5. Generate an application key:
   ```bash
   php artisan key:generate
   ```
6. Run the database migrations and seed the data (this creates the tables and the admin account):
   ```bash
   php artisan migrate:fresh --seed
   ```
7. Start the backend server:
   ```bash
   php artisan serve
   ```

### Step 3: Configure the Frontend
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd frontend-rn
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the frontend server:
   ```bash
   npm run web
   ```

---

## 🔑 Admin Login Credentials

Once both servers are running and the database is seeded, you can log into the frontend using the default admin account:

- **Email:** `admin@jmc.edu.ph`
- **Password:** `password123`
