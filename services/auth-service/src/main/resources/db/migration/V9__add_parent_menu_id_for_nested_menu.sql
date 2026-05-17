ALTER TABLE auth.menus
    ADD COLUMN IF NOT EXISTS parent_menu_id UUID;

ALTER TABLE auth.menus
    ALTER COLUMN path DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = 'auth'
          AND table_name = 'menus'
          AND constraint_name = 'fk_menus_parent_menu'
    ) THEN
        ALTER TABLE auth.menus
            ADD CONSTRAINT fk_menus_parent_menu
                FOREIGN KEY (parent_menu_id) REFERENCES auth.menus (id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_menus_parent_menu_id ON auth.menus (parent_menu_id);
