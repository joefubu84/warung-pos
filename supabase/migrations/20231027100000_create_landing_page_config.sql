
CREATE TABLE IF NOT EXISTS landing_page_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hero_section JSONB DEFAULT '{
        "headline": "Selamat Datang ke Warung J&J",
        "subheadline": "Sajian Tradisional Penuh Kehangatan",
        "badge_text": "Buka Sekarang",
        "is_delivery_enabled": true,
        "delivery_status_note": "",
        "hero_image_url": "/images/default-hero.jpg"
    }',
    highlights_section JSONB DEFAULT '[
        {
            "title": "Sambal Gesek Kaw-Kaw",
            "description": "Pedas Menyengat, Bikin Ketagihan!",
            "image_url": "/images/default-highlight-1.jpg"
        },
        {
            "title": "Daging & Ayam Segar",
            "description": "Dipilih Khas Untuk Hidangan Anda",
            "image_url": "/images/default-highlight-2.jpg"
        }
    ]',
    popular_dishes TEXT[] DEFAULT ARRAY[]::TEXT[],
    business_info JSONB DEFAULT '{
        "operating_hours": "Isnin-Sabtu: 10AM - 10PM",
        "address": "No. 12, Jalan Warung, Taman J&J",
        "phone_number": "+6012-3456789",
        "google_maps_link": "https://maps.app.goo.gl/example"
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Add a trigger to update 'updated_at' on each row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_landing_page_config_updated_at ON landing_page_config;
CREATE TRIGGER update_landing_page_config_updated_at
BEFORE UPDATE ON landing_page_config
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
