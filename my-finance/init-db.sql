-- Create database if not exists (PostgreSQL doesn't support IF NOT EXISTS for databases in older versions)
-- This script will run during container initialization

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables for auth service
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tables for transaction service
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    balance DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'VND',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    note TEXT,
    date_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date_time);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert sample data for development (optional)
-- Uncomment the following lines if you want sample data

/*
-- Sample user
INSERT INTO users (id, username, email, password, role) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'testuser', 'test@example.com', '$2b$10$example.hash.here', 'user')
ON CONFLICT (username) DO NOTHING;

-- Sample account
INSERT INTO accounts (user_id, balance, currency) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 1000000.00, 'VND')
ON CONFLICT (user_id) DO NOTHING;

-- Sample transactions
INSERT INTO transactions (user_id, amount, category, note, date_time) 
VALUES 
    ('550e8400-e29b-41d4-a716-446655440000', 50000, 'food', 'Lunch at restaurant', '2024-12-01 12:00:00+07'),
    ('550e8400-e29b-41d4-a716-446655440000', 80000, 'transport', 'Taxi to office', '2024-12-01 08:30:00+07'),
    ('550e8400-e29b-41d4-a716-446655440000', 1200000, 'income', 'Salary payment', '2024-12-01 09:00:00+07')
ON CONFLICT DO NOTHING;
*/