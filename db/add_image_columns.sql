-- Add image columns to jobs table for ImageKit URLs
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS before_images jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS after_images jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS image_metadata jsonb DEFAULT '{}'::jsonb;

-- Add indexes for faster image queries
CREATE INDEX IF NOT EXISTS idx_jobs_before_images ON public.jobs USING gin(before_images);
CREATE INDEX IF NOT EXISTS idx_jobs_after_images ON public.jobs USING gin(after_images);

-- Add comments for documentation
COMMENT ON COLUMN public.jobs.before_images IS 'Array of before work images with ImageKit URLs and metadata';
COMMENT ON COLUMN public.jobs.after_images IS 'Array of after work images with ImageKit URLs and metadata';
COMMENT ON COLUMN public.jobs.image_metadata IS 'Additional metadata for image management (upload stats, etc)';

-- Example structure for before_images/after_images:
-- [
--   {
--     "id": "unique-id",
--     "url": "https://ik.imagekit.io/ropaxjhgke/jobs/123/before/image1.jpg",
--     "fileId": "imagekit-file-id",
--     "thumbnailUrl": "https://ik.imagekit.io/ropaxjhgke/jobs/123/before/tr:w-200,h-200/image1.jpg",
--     "uploadedAt": "2025-12-22T10:30:00Z",
--     "uploadedBy": "user-id",
--     "caption": "Front damage",
--     "size": 1024000,
--     "name": "front_damage.jpg"
--   }
-- ]
