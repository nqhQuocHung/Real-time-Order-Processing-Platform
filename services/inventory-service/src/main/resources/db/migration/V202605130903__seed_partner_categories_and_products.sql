INSERT INTO inventory.product_categories (
    id,
    uuid,
    shop_id,
    category_code,
    category_name,
    description,
    created_at,
    updated_at,
    deleted_at,
    is_active
)
VALUES
    (
        '81aa6f75-f48b-45aa-af55-185447e90001'::uuid,
        '82aa6f75-f48b-45aa-af55-185447e90001'::uuid,
        '8d0bbf75-f48b-45aa-af55-185447e90dcc'::uuid,
        'CHIP',
        'Computer Chips',
        'CPU and high performance compute chips',
        NOW(),
        NOW(),
        NULL,
        TRUE
    ),
    (
        '81aa6f75-f48b-45aa-af55-185447e90002'::uuid,
        '82aa6f75-f48b-45aa-af55-185447e90002'::uuid,
        '8d0bbf75-f48b-45aa-af55-185447e90dcc'::uuid,
        'KEYBOARD',
        'Computer Keyboards',
        'Mechanical and office keyboard products',
        NOW(),
        NOW(),
        NULL,
        TRUE
    )
ON CONFLICT (shop_id, category_code) DO NOTHING;

WITH seeded_products(product_id, category_id, product_name, brand, sku, description, available_quantity) AS (
    VALUES
        ('90bbbf75-f48b-45aa-af55-185447e90001'::uuid, 'CHIP', 'Intel Core i3-12100F', 'Intel', 'CHIP-001', 'CPU 4 core 8 thread for office and gaming entry.', 55),
        ('90bbbf75-f48b-45aa-af55-185447e90002'::uuid, 'CHIP', 'Intel Core i5-12400F', 'Intel', 'CHIP-002', 'CPU 6 core 12 thread for mainstream desktop.', 62),
        ('90bbbf75-f48b-45aa-af55-185447e90003'::uuid, 'CHIP', 'Intel Core i5-13400F', 'Intel', 'CHIP-003', 'Raptor Lake chip for balanced performance.', 50),
        ('90bbbf75-f48b-45aa-af55-185447e90004'::uuid, 'CHIP', 'Intel Core i7-12700K', 'Intel', 'CHIP-004', 'Alder Lake high performance processor.', 28),
        ('90bbbf75-f48b-45aa-af55-185447e90005'::uuid, 'CHIP', 'Intel Core i7-13700K', 'Intel', 'CHIP-005', 'Enthusiast CPU for creators and gamers.', 26),
        ('90bbbf75-f48b-45aa-af55-185447e90006'::uuid, 'CHIP', 'Intel Core i9-13900K', 'Intel', 'CHIP-006', 'Top desktop CPU for workstation loads.', 18),
        ('90bbbf75-f48b-45aa-af55-185447e90007'::uuid, 'CHIP', 'Intel Core Ultra 5 245K', 'Intel', 'CHIP-007', 'New generation core ultra desktop chip.', 35),
        ('90bbbf75-f48b-45aa-af55-185447e90008'::uuid, 'CHIP', 'Intel Core Ultra 7 265K', 'Intel', 'CHIP-008', 'High-tier core ultra processor.', 21),
        ('90bbbf75-f48b-45aa-af55-185447e90009'::uuid, 'CHIP', 'Intel Core Ultra 9 285K', 'Intel', 'CHIP-009', 'Flagship core ultra for power users.', 12),
        ('90bbbf75-f48b-45aa-af55-185447e9000a'::uuid, 'CHIP', 'AMD Ryzen 3 4100', 'AMD', 'CHIP-010', 'Budget Ryzen CPU for basic gaming.', 44),
        ('90bbbf75-f48b-45aa-af55-185447e9000b'::uuid, 'CHIP', 'AMD Ryzen 5 5600', 'AMD', 'CHIP-011', 'Popular 6 core processor on AM4.', 70),
        ('90bbbf75-f48b-45aa-af55-185447e9000c'::uuid, 'CHIP', 'AMD Ryzen 5 5600X', 'AMD', 'CHIP-012', 'Higher boost version of Ryzen 5.', 58),
        ('90bbbf75-f48b-45aa-af55-185447e9000d'::uuid, 'CHIP', 'AMD Ryzen 5 7600', 'AMD', 'CHIP-013', 'AM5 processor for DDR5 platforms.', 41),
        ('90bbbf75-f48b-45aa-af55-185447e9000e'::uuid, 'CHIP', 'AMD Ryzen 5 7600X', 'AMD', 'CHIP-014', 'Unlocked AM5 chip with strong clocks.', 30),
        ('90bbbf75-f48b-45aa-af55-185447e9000f'::uuid, 'CHIP', 'AMD Ryzen 7 5700X', 'AMD', 'CHIP-015', '8 core AM4 chip for productivity.', 34),
        ('90bbbf75-f48b-45aa-af55-185447e90010'::uuid, 'CHIP', 'AMD Ryzen 7 7700', 'AMD', 'CHIP-016', 'Efficient 8 core chip for AM5.', 29),
        ('90bbbf75-f48b-45aa-af55-185447e90011'::uuid, 'CHIP', 'AMD Ryzen 7 7800X3D', 'AMD', 'CHIP-017', 'Gaming focused X3D processor.', 23),
        ('90bbbf75-f48b-45aa-af55-185447e90012'::uuid, 'CHIP', 'AMD Ryzen 9 5900X', 'AMD', 'CHIP-018', '12 core AM4 workstation CPU.', 16),
        ('90bbbf75-f48b-45aa-af55-185447e90013'::uuid, 'CHIP', 'AMD Ryzen 9 7900', 'AMD', 'CHIP-019', '12 core AM5 processor for creators.', 15),
        ('90bbbf75-f48b-45aa-af55-185447e90014'::uuid, 'CHIP', 'AMD Ryzen 9 7950X', 'AMD', 'CHIP-020', '16 core flagship Ryzen chip.', 10),
        ('90bbbf75-f48b-45aa-af55-185447e90015'::uuid, 'CHIP', 'Intel Xeon E-2388G', 'Intel', 'CHIP-021', 'Server grade chip for SMB workloads.', 9),
        ('90bbbf75-f48b-45aa-af55-185447e90016'::uuid, 'CHIP', 'Intel Xeon W-2465X', 'Intel', 'CHIP-022', 'Workstation CPU for heavy rendering.', 7),
        ('90bbbf75-f48b-45aa-af55-185447e90017'::uuid, 'CHIP', 'AMD EPYC 7313P', 'AMD', 'CHIP-023', 'Single socket EPYC server processor.', 6),
        ('90bbbf75-f48b-45aa-af55-185447e90018'::uuid, 'CHIP', 'AMD EPYC 7443P', 'AMD', 'CHIP-024', 'High core count EPYC for virtualization.', 5),
        ('90bbbf75-f48b-45aa-af55-185447e90019'::uuid, 'CHIP', 'Apple M2 Pro Chip', 'Apple', 'CHIP-025', 'Apple silicon chip for Mac workstation.', 13),
        ('90bbbf75-f48b-45aa-af55-185447e9001a'::uuid, 'CHIP', 'Apple M3 Pro Chip', 'Apple', 'CHIP-026', 'Latest Apple silicon for pro laptops.', 11),
        ('90bbbf75-f48b-45aa-af55-185447e9001b'::uuid, 'CHIP', 'Qualcomm Snapdragon X Elite', 'Qualcomm', 'CHIP-027', 'ARM compute chip for next-gen laptops.', 14),
        ('90bbbf75-f48b-45aa-af55-185447e9001c'::uuid, 'CHIP', 'Intel N100 Processor', 'Intel', 'CHIP-028', 'Low power chip for mini PC.', 39),
        ('90bbbf75-f48b-45aa-af55-185447e9001d'::uuid, 'CHIP', 'AMD Athlon 3000G', 'AMD', 'CHIP-029', 'Entry-level desktop processor with iGPU.', 27),
        ('90bbbf75-f48b-45aa-af55-185447e9001e'::uuid, 'CHIP', 'Intel Pentium Gold G7400', 'Intel', 'CHIP-030', 'Dual core processor for office PCs.', 24),
        ('90bbbf75-f48b-45aa-af55-185447e9001f'::uuid, 'KEYBOARD', 'Logitech K120', 'Logitech', 'KEY-001', 'Classic full size wired office keyboard.', 120),
        ('90bbbf75-f48b-45aa-af55-185447e90020'::uuid, 'KEYBOARD', 'Logitech K380', 'Logitech', 'KEY-002', 'Compact bluetooth multi-device keyboard.', 95),
        ('90bbbf75-f48b-45aa-af55-185447e90021'::uuid, 'KEYBOARD', 'Logitech G Pro X', 'Logitech', 'KEY-003', 'Tenkeyless gaming keyboard with hot swap.', 45),
        ('90bbbf75-f48b-45aa-af55-185447e90022'::uuid, 'KEYBOARD', 'Razer BlackWidow V4', 'Razer', 'KEY-004', 'Mechanical RGB gaming keyboard.', 37),
        ('90bbbf75-f48b-45aa-af55-185447e90023'::uuid, 'KEYBOARD', 'Keychron K2 V2', 'Keychron', 'KEY-005', 'Wireless 75 percent mechanical keyboard.', 66),
        ('90bbbf75-f48b-45aa-af55-185447e90024'::uuid, 'KEYBOARD', 'Keychron Q1 Pro', 'Keychron', 'KEY-006', 'Premium gasket mechanical keyboard.', 31),
        ('90bbbf75-f48b-45aa-af55-185447e90025'::uuid, 'KEYBOARD', 'Akko 3098B', 'Akko', 'KEY-007', 'Tri-mode mechanical keyboard with numpad.', 52),
        ('90bbbf75-f48b-45aa-af55-185447e90026'::uuid, 'KEYBOARD', 'Corsair K70 RGB', 'Corsair', 'KEY-008', 'Flagship gaming keyboard with aluminum frame.', 29),
        ('90bbbf75-f48b-45aa-af55-185447e90027'::uuid, 'KEYBOARD', 'DareU EK87', 'DareU', 'KEY-009', 'Budget mechanical keyboard for gaming.', 74),
        ('90bbbf75-f48b-45aa-af55-185447e90028'::uuid, 'KEYBOARD', 'HyperX Alloy Origins', 'HyperX', 'KEY-010', 'Compact mechanical keyboard with RGB.', 43)
)
INSERT INTO inventory.inventory_stocks (
    id,
    uuid,
    product_id,
    item_id,
    shop_id,
    name,
    description,
    category_id,
    brand,
    product_status,
    image_url,
    sku,
    product_name,
    available_quantity,
    reserved_quantity,
    version,
    created_at,
    updated_at,
    deleted_at,
    is_active
)
SELECT
    seeded_products.product_id,
    ('a0bbbf75-f48b-45aa-af55-' || substring(replace(seeded_products.product_id::text, '-', ''), 21, 12))::uuid,
    seeded_products.product_id,
    seeded_products.product_id,
    '8d0bbf75-f48b-45aa-af55-185447e90dcc'::uuid,
    seeded_products.product_name,
    seeded_products.description,
    CASE
        WHEN seeded_products.category_id = 'CHIP' THEN '81aa6f75-f48b-45aa-af55-185447e90001'::uuid
        WHEN seeded_products.category_id = 'KEYBOARD' THEN '81aa6f75-f48b-45aa-af55-185447e90002'::uuid
        ELSE NULL
    END,
    seeded_products.brand,
    'ACTIVE',
    'https://img.freepik.com/vector-cao-cap/khong-co-bieu-tuong-vector-anh-co-san-bieu-tuong-hinh-anh-mac-dinh-hinh-anh-sap-co-cho-trang-web-hoac-ung-dung-di-dong_87543-18055.jpg',
    seeded_products.sku,
    seeded_products.product_name,
    seeded_products.available_quantity,
    0,
    0,
    NOW(),
    NOW(),
    NULL,
    TRUE
FROM seeded_products
ON CONFLICT (product_id) DO NOTHING;
