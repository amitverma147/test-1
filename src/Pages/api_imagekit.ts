import { Request, Response } from 'express';
import { getImageKitAuthParams, uploadToImageKit, deleteFromImageKit } from '../server_handlers/imagekit';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('⚠️ Supabase configuration missing for ImageKit handlers');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/imagekit-auth
 * Returns authentication parameters for client-side ImageKit uploads
 */
export async function handleImageKitAuth(req: Request, res: Response) {
    try {
        console.log('🔐 ImageKit auth request received');
        const authParams = getImageKitAuthParams();
        return res.status(200).json(authParams);
    } catch (error: any) {
        console.error('❌ ImageKit auth error:', error);
        return res.status(500).json({ 
            error: 'Failed to generate authentication parameters',
            message: error.message 
        });
    }
}

/**
 * POST /api/imagekit-upload
 * Server-side upload to ImageKit (alternative to client-side upload)
 * Body: { file: base64, fileName: string, folder: string, jobId: string, category: string }
 */
export async function handleImageKitUpload(req: Request, res: Response) {
    try {
        const { file, fileName, folder, jobId, category } = req.body;

        console.log('📤 ImageKit upload request:', { fileName, folder, jobId, category });

        // Verify authentication
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.warn('⚠️ Missing authorization header');
            return res.status(401).json({ error: 'Unauthorized - Missing authentication' });
        }

        // Validate required fields
        if (!file) {
            return res.status(400).json({ error: 'Missing required field: file' });
        }
        if (!fileName) {
            return res.status(400).json({ error: 'Missing required field: fileName' });
        }
        if (!jobId) {
            return res.status(400).json({ error: 'Missing required field: jobId' });
        }
        if (!category) {
            return res.status(400).json({ error: 'Missing required field: category' });
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

        console.log('✅ ImageKit upload successful');

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
    } catch (error: any) {
        console.error('❌ ImageKit upload error:', error);
        return res.status(500).json({
            error: 'Upload failed',
        console.log('🗑️ ImageKit delete request:', fileId);

        // Verify authentication
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.warn('⚠️ Missing authorization header');
            return res.status(401).json({ error: 'Unauthorized - Missing authentication' });
        }

        // Validate fileId
        if (!fileId) {
            return res.status(400).json({ error: 'Missing required field: fileId' });
        }

        // Delete from ImageKit
        await deleteFromImageKit(fileId);

        console.log('✅ Image deleted successfully');

        return res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error: any) {
        console.error('❌ 
        // Validate fileId
        if (!fileId) {
            return res.status(400).json({ error: 'Missing required field: fileId' });
        }

        // Delete from ImageKit
        await deleteFromImageKit(fileId);

        return res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        console.log('💾 Save metadata request:', { jobId, category });

        // Verify authentication
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.warn('⚠️ Missing authorization header');
            return res.status(401).json({ error: 'Unauthorized - Missing authentication' });
        }

        // Validate required fields
        if (!jobId) {
            return res.status(400).json({ error: 'Missing required field: jobId' });
        }
        if (!category) {
            return res.status(400).json({ error: 'Missing required field: category' });
        }
        if (!imageData) {
            return res.status(400).json({ error: 'Missing required field: imageData' });
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
            console.error('❌ Error fetching job:', fetchError);
            return res.status(500).json({ error: 'Failed to fetch job data', details: fetchError.message });
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
            console.error('❌ Error updating job:', updateError);
            return res.status(500).json({ error: 'Failed to save image metadata', details: updateError.message });
        }

        console.log('✅ Metadata saved successfully');

        return res.status(200).json({
            success: true,
            message: 'Image metadata saved successfully'
        });
    } catch (error: any) {
        console.error('❌ ages = job?.[columnName] || [];
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
    } catch (error: any) {
        console.error('Save metadata error:', error);
        return res.status(500).json({
            error: 'Failed to save metadata',
            message: error.message || 'Unknown error'
        });
    }
}
