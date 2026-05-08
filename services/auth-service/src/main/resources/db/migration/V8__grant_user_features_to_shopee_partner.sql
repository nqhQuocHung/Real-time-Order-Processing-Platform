WITH partner_user_permission_seed (permission_code) AS (
    VALUES
        ('VIEW_USER_DASHBOARD'),
        ('MANAGE_SELF_ORDERS'),
        ('VIEW_PRODUCT_CATALOG'),
        ('VIEW_SELF_PROFILE'),
        ('VIEW_SUPPORT')
)
INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM partner_user_permission_seed s
JOIN auth.roles r ON UPPER(r.code) = 'SHOPEE_PARTNER'
JOIN auth.permissions p ON UPPER(p.code) = UPPER(s.permission_code)
WHERE NOT EXISTS (
    SELECT 1
    FROM auth.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
);

WITH partner_user_menu_seed (menu_key) AS (
    VALUES
        ('user-dashboard'),
        ('user-orders'),
        ('user-products'),
        ('user-profile'),
        ('user-support')
)
INSERT INTO auth.role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM partner_user_menu_seed s
JOIN auth.roles r ON UPPER(r.code) = 'SHOPEE_PARTNER'
JOIN auth.menus m ON m.menu_key = s.menu_key
WHERE NOT EXISTS (
    SELECT 1
    FROM auth.role_menus rm
    WHERE rm.role_id = r.id
      AND rm.menu_id = m.id
);
