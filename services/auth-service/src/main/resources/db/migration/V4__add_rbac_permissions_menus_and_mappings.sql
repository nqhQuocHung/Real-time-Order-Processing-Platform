CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS auth.permissions (
    id UUID PRIMARY KEY,
    code VARCHAR(100) NOT NULL,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(300),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    uuid UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_permissions_code ON auth.permissions (code);
CREATE UNIQUE INDEX IF NOT EXISTS uk_permissions_uuid ON auth.permissions (uuid);

CREATE TABLE IF NOT EXISTS auth.menus (
    id UUID PRIMARY KEY,
    menu_key VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    path VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    permission_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    uuid UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT fk_menus_permission
        FOREIGN KEY (permission_id) REFERENCES auth.permissions (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_menus_menu_key ON auth.menus (menu_key);
CREATE UNIQUE INDEX IF NOT EXISTS uk_menus_uuid ON auth.menus (uuid);

CREATE TABLE IF NOT EXISTS auth.role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES auth.roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES auth.permissions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth.role_menus (
    role_id UUID NOT NULL,
    menu_id UUID NOT NULL,
    PRIMARY KEY (role_id, menu_id),
    CONSTRAINT fk_role_menus_role
        FOREIGN KEY (role_id) REFERENCES auth.roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_role_menus_menu
        FOREIGN KEY (menu_id) REFERENCES auth.menus (id) ON DELETE CASCADE
);

INSERT INTO auth.roles (id, code, name, is_active, uuid, created_at, updated_at)
SELECT gen_random_uuid(), 'USER', 'User', TRUE, gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM auth.roles WHERE UPPER(code) = 'USER');

INSERT INTO auth.roles (id, code, name, is_active, uuid, created_at, updated_at)
SELECT gen_random_uuid(), 'ADMIN', 'Admin', TRUE, gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM auth.roles WHERE UPPER(code) = 'ADMIN');

INSERT INTO auth.roles (id, code, name, is_active, uuid, created_at, updated_at)
SELECT gen_random_uuid(), 'SHOPEE_PARTNER', 'Shopee Partner', TRUE, gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM auth.roles WHERE UPPER(code) = 'SHOPEE_PARTNER');

WITH permission_seed (code, name, description) AS (
    VALUES
        ('VIEW_USER_DASHBOARD', 'View User Dashboard', 'Allow viewing user dashboard'),
        ('MANAGE_SELF_ORDERS', 'Manage Self Orders', 'Allow managing own orders'),
        ('VIEW_PRODUCT_CATALOG', 'View Product Catalog', 'Allow viewing product catalog'),
        ('VIEW_SELF_PROFILE', 'View Self Profile', 'Allow viewing own profile'),
        ('VIEW_SUPPORT', 'View Support', 'Allow viewing support channel'),
        ('VIEW_ADMIN_DASHBOARD', 'View Admin Dashboard', 'Allow viewing admin dashboard'),
        ('MANAGE_USERS', 'Manage Users', 'Allow managing users'),
        ('MANAGE_PARTNERS', 'Manage Partners', 'Allow managing partners'),
        ('MANAGE_PRODUCTS', 'Manage Products', 'Allow managing products'),
        ('MANAGE_ALL_ORDERS', 'Manage All Orders', 'Allow managing all orders'),
        ('VIEW_REPORTS', 'View Reports', 'Allow viewing reports'),
        ('MANAGE_SYSTEM_SETTINGS', 'Manage System Settings', 'Allow managing system settings'),
        ('VIEW_PARTNER_DASHBOARD', 'View Partner Dashboard', 'Allow viewing partner dashboard'),
        ('MANAGE_PARTNER_PRODUCTS', 'Manage Partner Products', 'Allow managing partner products'),
        ('MANAGE_PARTNER_ORDERS', 'Manage Partner Orders', 'Allow managing partner orders'),
        ('MANAGE_PARTNER_INVENTORY', 'Manage Partner Inventory', 'Allow managing partner inventory'),
        ('VIEW_PARTNER_REVENUE', 'View Partner Revenue', 'Allow viewing partner revenue'),
        ('VIEW_PARTNER_PROFILE', 'View Partner Profile', 'Allow viewing partner profile')
)
INSERT INTO auth.permissions (id, code, name, description, is_active, uuid, created_at, updated_at)
SELECT gen_random_uuid(), ps.code, ps.name, ps.description, TRUE, gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM permission_seed ps
WHERE NOT EXISTS (
    SELECT 1 FROM auth.permissions p WHERE UPPER(p.code) = UPPER(ps.code)
);

WITH menu_seed (menu_key, label, path, display_order, permission_code) AS (
    VALUES
        ('user-dashboard', 'Dashboard', '/user/dashboard', 10, 'VIEW_USER_DASHBOARD'),
        ('user-orders', 'Orders', '/user/orders', 20, 'MANAGE_SELF_ORDERS'),
        ('user-products', 'Products', '/user/products', 30, 'VIEW_PRODUCT_CATALOG'),
        ('user-profile', 'Profile', '/user/profile', 40, 'VIEW_SELF_PROFILE'),
        ('user-support', 'Support', '/user/support', 50, 'VIEW_SUPPORT'),

        ('admin-dashboard', 'Admin Dashboard', '/admin/dashboard', 10, 'VIEW_ADMIN_DASHBOARD'),
        ('admin-users', 'User Management', '/admin/users', 20, 'MANAGE_USERS'),
        ('admin-partners', 'Partner Management', '/admin/partners', 30, 'MANAGE_PARTNERS'),
        ('admin-products', 'Product Management', '/admin/products', 40, 'MANAGE_PRODUCTS'),
        ('admin-orders', 'Order Management', '/admin/orders', 50, 'MANAGE_ALL_ORDERS'),
        ('admin-reports', 'Reports', '/admin/reports', 60, 'VIEW_REPORTS'),
        ('admin-settings', 'System Settings', '/admin/settings', 70, 'MANAGE_SYSTEM_SETTINGS'),

        ('partner-dashboard', 'Partner Dashboard', '/partner/dashboard', 10, 'VIEW_PARTNER_DASHBOARD'),
        ('partner-products', 'My Products', '/partner/products', 20, 'MANAGE_PARTNER_PRODUCTS'),
        ('partner-orders', 'Shopee Orders', '/partner/orders', 30, 'MANAGE_PARTNER_ORDERS'),
        ('partner-inventory', 'Inventory', '/partner/inventory', 40, 'MANAGE_PARTNER_INVENTORY'),
        ('partner-revenue', 'Revenue Report', '/partner/revenue', 50, 'VIEW_PARTNER_REVENUE'),
        ('partner-profile', 'Partner Profile', '/partner/profile', 60, 'VIEW_PARTNER_PROFILE')
)
INSERT INTO auth.menus (id, menu_key, label, path, display_order, permission_id, is_active, uuid, created_at, updated_at)
SELECT
    gen_random_uuid(),
    ms.menu_key,
    ms.label,
    ms.path,
    ms.display_order,
    p.id,
    TRUE,
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM menu_seed ms
LEFT JOIN auth.permissions p ON UPPER(p.code) = UPPER(ms.permission_code)
WHERE NOT EXISTS (
    SELECT 1 FROM auth.menus m WHERE m.menu_key = ms.menu_key
);

WITH role_permission_seed (role_code, permission_code) AS (
    VALUES
        ('USER', 'VIEW_USER_DASHBOARD'),
        ('USER', 'MANAGE_SELF_ORDERS'),
        ('USER', 'VIEW_PRODUCT_CATALOG'),
        ('USER', 'VIEW_SELF_PROFILE'),
        ('USER', 'VIEW_SUPPORT'),

        ('ADMIN', 'VIEW_ADMIN_DASHBOARD'),
        ('ADMIN', 'MANAGE_USERS'),
        ('ADMIN', 'MANAGE_PARTNERS'),
        ('ADMIN', 'MANAGE_PRODUCTS'),
        ('ADMIN', 'MANAGE_ALL_ORDERS'),
        ('ADMIN', 'VIEW_REPORTS'),
        ('ADMIN', 'MANAGE_SYSTEM_SETTINGS'),
        ('ADMIN', 'VIEW_USER_DASHBOARD'),
        ('ADMIN', 'VIEW_PARTNER_DASHBOARD'),

        ('SHOPEE_PARTNER', 'VIEW_PARTNER_DASHBOARD'),
        ('SHOPEE_PARTNER', 'MANAGE_PARTNER_PRODUCTS'),
        ('SHOPEE_PARTNER', 'MANAGE_PARTNER_ORDERS'),
        ('SHOPEE_PARTNER', 'MANAGE_PARTNER_INVENTORY'),
        ('SHOPEE_PARTNER', 'VIEW_PARTNER_REVENUE'),
        ('SHOPEE_PARTNER', 'VIEW_PARTNER_PROFILE')
)
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_permission_seed rs
JOIN auth.roles r ON UPPER(r.code) = UPPER(rs.role_code)
JOIN auth.permissions p ON UPPER(p.code) = UPPER(rs.permission_code)
WHERE NOT EXISTS (
    SELECT 1
    FROM auth.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

WITH role_menu_seed (role_code, menu_key) AS (
    VALUES
        ('USER', 'user-dashboard'),
        ('USER', 'user-orders'),
        ('USER', 'user-products'),
        ('USER', 'user-profile'),
        ('USER', 'user-support'),

        ('ADMIN', 'admin-dashboard'),
        ('ADMIN', 'admin-users'),
        ('ADMIN', 'admin-partners'),
        ('ADMIN', 'admin-products'),
        ('ADMIN', 'admin-orders'),
        ('ADMIN', 'admin-reports'),
        ('ADMIN', 'admin-settings'),

        ('SHOPEE_PARTNER', 'partner-dashboard'),
        ('SHOPEE_PARTNER', 'partner-products'),
        ('SHOPEE_PARTNER', 'partner-orders'),
        ('SHOPEE_PARTNER', 'partner-inventory'),
        ('SHOPEE_PARTNER', 'partner-revenue'),
        ('SHOPEE_PARTNER', 'partner-profile')
)
INSERT INTO auth.role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM role_menu_seed rms
JOIN auth.roles r ON UPPER(r.code) = UPPER(rms.role_code)
JOIN auth.menus m ON m.menu_key = rms.menu_key
WHERE NOT EXISTS (
    SELECT 1
    FROM auth.role_menus rm
    WHERE rm.role_id = r.id AND rm.menu_id = m.id
);
