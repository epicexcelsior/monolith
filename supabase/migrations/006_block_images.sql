-- Block Images Storage
-- Creates a public Supabase Storage bucket for user-uploaded block images.
-- Images are stored as {blockId}.webp and served via Supabase CDN.

-- Create the storage bucket (public = accessible without auth token)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'block-images',
  'block-images',
  true,
  2097152,  -- 2MB max file size
  ARRAY['image/webp', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access (anyone can view block images)
CREATE POLICY "Block images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'block-images');

-- Allow service role to upload/update/delete (server handles auth)
CREATE POLICY "Service role can manage block images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'block-images')
  WITH CHECK (bucket_id = 'block-images');

-- Helper function to merge imageUrl into block appearance JSONB
-- Used as fallback when direct JSONB merge isn't available
CREATE OR REPLACE FUNCTION update_block_image_url(
  p_layer integer,
  p_index integer,
  p_image_url text
) RETURNS void AS $$
BEGIN
  UPDATE blocks
  SET appearance = appearance || jsonb_build_object('imageUrl', p_image_url),
      updated_at = now()
  WHERE layer = p_layer AND index = p_index;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
