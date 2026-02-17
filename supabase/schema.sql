-- Contour Map Studio — Supabase Schema
-- Run this in Supabase SQL Editor to set up or update tables.

-- Posters table: stores uploaded poster images and metadata
CREATE TABLE IF NOT EXISTS posters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    route_name text NOT NULL,
    image_url text NOT NULL,
    preview_url text,
    config jsonb DEFAULT '{}'::jsonb
);

-- Orders table: one row per line item in a checkout
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    poster_id uuid REFERENCES posters(id),
    stripe_session_id text NOT NULL,
    product_type text DEFAULT 'poster',
    size text NOT NULL,
    quantity integer DEFAULT 1,
    price integer NOT NULL,           -- in smallest currency unit (cents)
    currency text DEFAULT 'eur',
    status text DEFAULT 'pending',    -- pending | paid | fulfilled | refunded
    customer_email text,
    shipping_name text,
    shipping_address jsonb,           -- { line1, line2, city, state, postal_code, country }
    printful_order_id text,           -- Printful order ID after submission
    printful_status text              -- submitted | failed | in_production | shipped
);

-- Index for looking up orders by Stripe session
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

-- Storage bucket for poster images (create via Supabase dashboard or API):
-- Bucket name: poster-images
-- Public: true
-- File naming: {uuid}.png

-- Migration: if tables already exist, add missing columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency text DEFAULT 'eur';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_type text DEFAULT 'poster';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printful_order_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printful_status text;
