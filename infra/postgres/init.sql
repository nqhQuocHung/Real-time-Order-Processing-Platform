-- Bootstrap databases and schemas for local development
-- Executed automatically by postgres image on first startup.

-- Service databases
CREATE DATABASE auth_db;
CREATE DATABASE order_db;
CREATE DATABASE inventory_db;
CREATE DATABASE payment_db;
CREATE DATABASE notification_db;

-- Optional dedicated user for application services
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
      CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password';
   END IF;
END
$$;

GRANT CONNECT ON DATABASE auth_db TO app_user;
GRANT CONNECT ON DATABASE order_db TO app_user;
GRANT CONNECT ON DATABASE inventory_db TO app_user;
GRANT CONNECT ON DATABASE payment_db TO app_user;
GRANT CONNECT ON DATABASE notification_db TO app_user;

-- Service schemas
\connect auth_db;
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION app_user;
GRANT USAGE ON SCHEMA auth TO app_user;

\connect order_db;
CREATE SCHEMA IF NOT EXISTS orders AUTHORIZATION app_user;
GRANT USAGE ON SCHEMA orders TO app_user;

\connect inventory_db;
CREATE SCHEMA IF NOT EXISTS inventory AUTHORIZATION app_user;
GRANT USAGE ON SCHEMA inventory TO app_user;

\connect payment_db;
CREATE SCHEMA IF NOT EXISTS payment AUTHORIZATION app_user;
GRANT USAGE ON SCHEMA payment TO app_user;

\connect notification_db;
CREATE SCHEMA IF NOT EXISTS notification AUTHORIZATION app_user;
GRANT USAGE ON SCHEMA notification TO app_user;
