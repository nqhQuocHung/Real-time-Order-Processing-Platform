WITH permission_seed (code, name, description) AS (
    VALUES
        ('VIEW_SYSTEM_MONITORING', 'View System Monitoring', 'Allow viewing system monitoring dashboards')
)
INSERT INTO auth.permissions (id, code, name, description, is_active, uuid, created_at, updated_at)
SELECT gen_random_uuid(), ps.code, ps.name, ps.description, TRUE, gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM permission_seed ps
WHERE NOT EXISTS (
    SELECT 1 FROM auth.permissions p WHERE UPPER(p.code) = UPPER(ps.code)
);

WITH monitoring_menu_seed (menu_key, label, path, display_order, permission_code) AS (
    VALUES ('admin-monitoring', 'System Monitoring', '/admin/monitoring', 15, 'VIEW_SYSTEM_MONITORING')
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
FROM monitoring_menu_seed s
LEFT JOIN auth.permissions p ON UPPER(p.code) = UPPER(s.permission_code)
WHERE NOT EXISTS (
    SELECT 1 FROM auth.menus m WHERE m.menu_key = s.menu_key
);

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
JOIN auth.permissions p ON UPPER(p.code) = 'VIEW_SYSTEM_MONITORING'
WHERE UPPER(r.code) = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM auth.role_permissions rp
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
  );

INSERT INTO auth.role_menus (role_id, menu_id)
SELECT r.id, m.id
FROM auth.roles r
JOIN auth.menus m ON m.menu_key = 'admin-monitoring'
WHERE UPPER(r.code) = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM auth.role_menus rm
      WHERE rm.role_id = r.id
        AND rm.menu_id = m.id
  );
