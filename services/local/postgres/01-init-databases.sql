\getenv auth_password AUTH_DB_PASSWORD
\getenv order_password ORDER_DB_PASSWORD
\getenv inventory_password INVENTORY_DB_PASSWORD
\getenv payment_password PAYMENT_DB_PASSWORD
\getenv notification_password NOTIFICATION_DB_PASSWORD

CREATE ROLE auth_service LOGIN PASSWORD :'auth_password';
CREATE DATABASE auth_db OWNER auth_service;

CREATE ROLE order_service LOGIN PASSWORD :'order_password';
CREATE DATABASE order_db OWNER order_service;

CREATE ROLE inventory_service LOGIN PASSWORD :'inventory_password';
CREATE DATABASE inventory_db OWNER inventory_service;

CREATE ROLE payment_service LOGIN PASSWORD :'payment_password';
CREATE DATABASE payment_db OWNER payment_service;

CREATE ROLE notification_service LOGIN PASSWORD :'notification_password';
CREATE DATABASE notification_db OWNER notification_service;
