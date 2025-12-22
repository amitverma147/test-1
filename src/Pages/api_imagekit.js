const { getImageKitAuthParams, uploadToImageKit, deleteFromImageKit } = require('../server_handlers/imagekit');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Temporary authentication bypass for testing
 * TODO: Remove this once proper authentication is in place
 */
function bypassAuthForTesting(req) {
    // ALWAYS allow access during testing (bypass all auth checks)
    console.log('✅ Auth bypass (imagekit): Allowing access for testing');
    return true;
}

/**
 * GET /api/imagekit-auth
 * Returns authentication parameters for client-side ImageKit uploads
 */
async function handleImageKitAuth(req, res) {
    try {
        // Temporary: Allow access for testing
        if (!bypassAuthForTesting(req)) {
            console.warn('⚠️ Auth bypass check failed, but allowing for testing');
        }

        const authParams = getImageKitAuthParams();
        console.log('✅ ImageKit auth params generated successfully');
        return res.status(200).json(authParams);
    } catch (error) {
        console.error('ImageKit auth error:', error);
        return res.status(500).json({ error: 'Failed to generate authentication parameters' });
    }
}

/**
 * POST /api/imagekit-upload
 * Server-side upload to ImageKit (alternative to client-side upload)
 * Body: { file: base64, fileName: string, folder: string, jobId: string, category: string }
 */
async function handleImageKitUpload(req, res) {
    try {
        const { file, fileName, folder, jobId, category } = req.body;

        // Temporary: Allow access for testing
        if (!bypassAuthForTesting(req)) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'Unauthorized - Missing authentication' });
            }
        }

        // Validate required fields
        if (!file || !fileName || !jobId || !category) {
            return res.status(400).json({ error: 'Missing required fields: file, fileName, jobId, category' });
        }

        // Upload to ImageKit
        const uploadFolder = folder || `/jobs/${jobId}/${category.toLowerCase()}`;
        const result = await uploadToImageKit({
            file,
            fileName,
            folder: uploadFolder,
            tags: [jobId, category],
            useUniqueFileName: true
        });

        // Return upload result
        return res.status(200).json({
            success: true,
            data: {
                url: result.url,
                fileId: result.fileId,
                thumbnailUrl: result.thumbnailUrl,
                name: result.name,
                size: result.size,
                filePath: result.filePath
            }
        });
    } catch (error) {
        console.error('ImageKit upload error:', error);
        return res.status(500).json({
            error: 'Upload failed',
            message: error.message || 'Unknown error'
        });
    }
}

/**
 * DELETE /api/imagekit-delete
 * Delete an image from ImageKit
 * Body: { fileId: string }
 */
async function handleImageKitDelete(req, res) {
    try {
        const { fileId } = req.body;

        // Temporary: Allow access for testing
        if (!bypassAuthForTesting(req)) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'Unauthorized - Missing authentication' });
            }
        }

        // Validate fileId
        if (!fileId) {
            return res.status(400).json({ error: 'Missing required field: fileId' });
        }

        // Delete from ImageKit
        await deleteFromImageKit(fileId);

        return res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('ImageKit delete error:', error);
        return res.status(500).json({
            error: 'Delete failed',
            message: error.message || 'Unknown error'
        });
    }
}

/**
 * POST /api/imagekit-save-metadata
 * Save image metadata to job in database
 * Body: { jobId: string, category: 'before' | 'after', imageData: object }
 */
async function handleSaveImageMetadata(req, res) {
    try {
        const { jobId, category, imageData } = req.body;

        // Temporary: Allow access for testing
        if (!bypassAuthForTesting(req)) {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'Unauthorized - Missing authentication' });
            }
        }

        // Validate required fields
        if (!jobId || !category || !imageData) {
            return res.status(400).json({ error: 'Missing required fields: jobId, category, imageData' });
        }

        // Determine which column to update
        const columnName = category === 'before' ? 'before_images' : 'after_images';

        // Get current images
        const { data: job, error: fetchError } = await supabaseAdmin
            .from('jobs')
            .select(columnName)
            .eq('id', jobId)
            .single();

        if (fetchError) {
            console.error('Error fetching job:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch job data' });
        }

        // Append new image to existing array
        const currentImages = job?.[columnName] || [];
        const updatedImages = [...currentImages, imageData];

        // Update job with new images
        const { error: updateError } = await supabaseAdmin
            .from('jobs')
            .update({ [columnName]: updatedImages })
            .eq('id', jobId);

        if (updateError) {
            console.error('Error updating job:', updateError);
            return res.status(500).json({ error: 'Failed to save image metadata' });
        }

        return res.status(200).json({
            success: true,
            message: 'Image metadata saved successfully'
        });
    } catch (error) {
        console.error('Save metadata error:', error);
        return res.status(500).json({
            error: 'Failed to save metadata',
            message: error.message || 'Unknown error'
        });
    }
}

module.exports = {
    handleImageKitAuth,
    handleImageKitUpload,
    handleImageKitDelete,
    handleSaveImageMetadata
};
