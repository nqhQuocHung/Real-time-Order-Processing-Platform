WITH permission_seed (code, name, description) AS (
    VALUES
        (
            'MANAGE_PRODUCT_CATEGORIES',
            'Manage Product Categories',
            'Allow managing product categories'
        )
)
INSERT INTO auth.permissions (id, code, name, description, is_active, uuid, created_at, updated_at)
SELECT gen_random_uuid(), ps.code, ps.name, ps.description, TRUE, gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM permission_seed ps
WHERE NOT EXISTS (
    SELECT 1 FROM auth.permissions p WHERE UPPER(p.code) = UPPER(ps.code)
);

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth.roles r
JOIN auth.permissions p ON UPPER(p.code) = 'MANAGE_PRODUCT_CATEGORIES'
WHERE UPPER(r.code) = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM auth.role_permissions rp
      WHERE rp.role_id = r.id
        AND rp.permission_id = p.id
  );

DELETE FROM auth.role_permissions rp
USING auth.roles r, auth.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND UPPER(p.code) = 'MANAGE_PRODUCT_CATEGORIES'
  AND UPPER(r.code) <> 'ADMIN';
