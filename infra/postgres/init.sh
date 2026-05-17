#!/usr/bin/env bash
set -euo pipefail

: "${AUTH_DB_PASSWORD:?AUTH_DB_PASSWORD is required}"
: "${ORDER_DB_PASSWORD:?ORDER_DB_PASSWORD is required}"
: "${INVENTORY_DB_PASSWORD:?INVENTORY_DB_PASSWORD is required}"
: "${PAYMENT_DB_PASSWORD:?PAYMENT_DB_PASSWORD is required}"
: "${NOTIFICATION_DB_PASSWORD:?NOTIFICATION_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  -v auth_db_password="$AUTH_DB_PASSWORD" \
  -v order_db_password="$ORDER_DB_PASSWORD" \
  -v inventory_db_password="$INVENTORY_DB_PASSWORD" \
  -v payment_db_password="$PAYMENT_DB_PASSWORD" \
  -v notification_db_password="$NOTIFICATION_DB_PASSWORD" <<-'EOSQL'
-- Bootstrap databases and schemas for local development.
-- Executed automatically by postgres image on first startup.

-- Service users
CREATE ROLE auth_service WITH LOGIN PASSWORD :'auth_db_password';
CREATE ROLE order_service WITH LOGIN PASSWORD :'order_db_password';
CREATE ROLE inventory_service WITH LOGIN PASSWORD :'inventory_db_password';
CREATE ROLE payment_service WITH LOGIN PASSWORD :'payment_db_password';
CREATE ROLE notification_service WITH LOGIN PASSWORD :'notification_db_password';

-- Service databases (owned by corresponding service users)
CREATE DATABASE auth_db OWNER auth_service;
CREATE DATABASE order_db OWNER order_service;
CREATE DATABASE inventory_db OWNER inventory_service;
CREATE DATABASE payment_db OWNER payment_service;
CREATE DATABASE notification_db OWNER notification_service;

-- Grant connect permission
GRANT CONNECT ON DATABASE auth_db TO auth_service;
GRANT CONNECT ON DATABASE order_db TO order_service;
GRANT CONNECT ON DATABASE inventory_db TO inventory_service;
GRANT CONNECT ON DATABASE payment_db TO payment_service;
GRANT CONNECT ON DATABASE notification_db TO notification_service;

-- Auth service schema
\connect auth_db;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION auth_service;
GRANT USAGE, CREATE ON SCHEMA auth TO auth_service;
ALTER ROLE auth_service SET search_path TO auth, public;

-- Order service schema
\connect order_db;
CREATE SCHEMA IF NOT EXISTS orders AUTHORIZATION order_service;
GRANT USAGE, CREATE ON SCHEMA orders TO order_service;
ALTER ROLE order_service SET search_path TO orders, public;

-- Inventory service schema
\connect inventory_db;
CREATE SCHEMA IF NOT EXISTS inventory AUTHORIZATION inventory_service;
GRANT USAGE, CREATE ON SCHEMA inventory TO inventory_service;
ALTER ROLE inventory_service SET search_path TO inventory, public;

-- Payment service schema
\connect payment_db;
CREATE SCHEMA IF NOT EXISTS payment AUTHORIZATION payment_service;
GRANT USAGE, CREATE ON SCHEMA payment TO payment_service;
ALTER ROLE payment_service SET search_path TO payment, public;

-- Notification service schema
\connect notification_db;
CREATE SCHEMA IF NOT EXISTS notification AUTHORIZATION notification_service;
GRANT USAGE, CREATE ON SCHEMA notification TO notification_service;
ALTER ROLE notification_service SET search_path TO notification, public;
EOSQL
