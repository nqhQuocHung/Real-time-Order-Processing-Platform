UPDATE auth.menus
SET label = 'Administration',
    updated_at = CURRENT_TIMESTAMP
WHERE menu_key = 'admin-administration';
