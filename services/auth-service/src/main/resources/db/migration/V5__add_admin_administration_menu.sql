WITH admin_menu_seed (menu_key, label, path, display_order, permission_code) AS (
    VALUES ('admin-administration', 'Quản trị', '/admin/administration', 15, 'MANAGE_USERS')
)
INSERT INTO auth.menus (id, menu_key, label, path, display_order, permission_id, is_active, uuid, created_at, updated_at)
SELECT
    gen_random_uuid(),
    s.menu_key,
    s.label,
    s.path,
    s.display_order,
    p.id,
    TRUE,
    gen_random_uuid(),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM admin_menu_seed s
LEFT JOIN auth.permissions p ON UPPER(p.code) = UPPER(s.permission_code)
WHERE NOT EXISTS (
    SELECT 1 FROM auth.menus m WHERE m.menu_key = s.menu_key
);

INSERT INTO auth.role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM auth.roles r
JOIN auth.menus m ON m.menu_key = 'admin-administration'
WHERE UPPER(r.code) = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM auth.role_menus rm
      WHERE rm.role_id = r.id
        AND rm.menu_id = m.id
  );
