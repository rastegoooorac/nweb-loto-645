-- Database schema for Loto 6/45 application

-- Create rounds table
CREATE TABLE IF NOT EXISTS rounds (
    id SERIAL PRIMARY KEY,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    code UUID UNIQUE NOT NULL,
    round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    id_number VARCHAR(20) NOT NULL,
    numbers JSONB NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create drawn_numbers table
CREATE TABLE IF NOT EXISTS drawn_numbers (
    id SERIAL PRIMARY KEY,
    round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    numbers JSONB NOT NULL,
    drawn_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rounds_active ON rounds(is_active);
CREATE INDEX IF NOT EXISTS idx_rounds_created ON rounds(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_round_id ON tickets(round_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_drawn_numbers_round_id ON drawn_numbers(round_id);

-- Insert initial data (optional)
-- This will create a closed round for testing purposes
INSERT INTO rounds (is_active, created_at) VALUES (false, NOW()) ON CONFLICT DO NOTHING;
