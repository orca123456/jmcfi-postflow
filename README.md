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
npx expo start --web
```
*(This will start the frontend web app. Press `w` in the terminal to open it in your browser if it doesn't open automatically.)*

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
   npx expo start --web
   ```

---

## 🔑 Admin Login Credentials

Once both servers are running and the database is seeded, you can log into the frontend using the default admin account:

- **Email:** `admin@jmc.edu.ph`
- **Password:** `password123`
