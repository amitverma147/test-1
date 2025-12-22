const ImageKit = require('imagekit');
// Force rebuild - using CommonJS syntax for Vercel compatibility

// Initialize ImageKit with environment variables
const imagekit = new ImageKit({
    publicKey: process.env.VITE_IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: process.env.VITE_IMAGEKIT_URL_ENDPOINT || ''
});

/**
 * Generate authentication parameters for client-side uploads
 * This is required for secure client-side uploads to ImageKit
 */
function getImageKitAuthParams() {
    try {
        const authenticationParameters = imagekit.getAuthenticationParameters();
        return authenticationParameters;
    } catch (error) {
        console.error('Error generating ImageKit auth params:', error);
        throw error;
    }
}

/**
 * Upload a file to ImageKit
 */
async function uploadToImageKit(options) {
    try {
        const result = await imagekit.upload({
            file: options.file,
            fileName: options.fileName,
            folder: options.folder,
            tags: options.tags || [],
            useUniqueFileName: options.useUniqueFileName !== false
        });

        return {
            url: result.url,
            fileId: result.fileId,
            thumbnailUrl: result.thumbnailUrl,
            name: result.name,
            size: result.size,
            filePath: result.filePath
        };
    } catch (error) {
        console.error('Error uploading to ImageKit:', error);
        throw error;
    }
}

/**
 * Delete a file from ImageKit
 */
async function deleteFromImageKit(fileId) {
    try {
        await imagekit.deleteFile(fileId);
        return { success: true };
    } catch (error) {
        console.error('Error deleting from ImageKit:', error);
        throw error;
    }
}

/**
 * Get ImageKit URL with transformations
 */
function getImageKitUrl(path, transformations) {
    const urlEndpoint = process.env.VITE_IMAGEKIT_URL_ENDPOINT || '';
    if (transformations) {
        return `${urlEndpoint}/tr:${transformations}/${path}`;
    }
    return `${urlEndpoint}/${path}`;
}

/**
 * HTTP Handler: Get ImageKit authentication parameters
 */
function handleImageKitAuth(req, res) {
    try {
        const authParams = getImageKitAuthParams();
        res.status(200).json(authParams);
    } catch (error) {
        console.error('Error in handleImageKitAuth:', error);
        res.status(500).json({ error: 'Failed to generate auth parameters' });
    }
}

/**
 * HTTP Handler: Upload file to ImageKit
 */
async function handleImageKitUpload(req, res) {
    try {
        const { file, fileName, folder, tags, useUniqueFileName } = req.body;
        const result = await uploadToImageKit({
            file,
            fileName,
            folder,
            tags,
            useUniqueFileName
        });
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in handleImageKitUpload:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
}

/**
 * HTTP Handler: Delete file from ImageKit
 */
async function handleImageKitDelete(req, res) {
    try {
        const { fileId } = req.body;
        const result = await deleteFromImageKit(fileId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in handleImageKitDelete:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
}

/**
 * HTTP Handler: Save image metadata (placeholder for future use)
 */
async function handleSaveImageMetadata(req, res) {
    try {
        // This can be used to save additional metadata to your database
        const { fileId, metadata } = req.body;
        // Implement your metadata saving logic here
        res.status(200).json({ success: true, message: 'Metadata saved' });
    } catch (error) {
        console.error('Error in handleSaveImageMetadata:', error);
        res.status(500).json({ error: 'Failed to save metadata' });
    }
}

module.exports = {
    imagekit,
    getImageKitAuthParams,
    uploadToImageKit,
    deleteFromImageKit,
    getImageKitUrl,
    handleImageKitAuth,
    handleImageKitUpload,
    handleImageKitDelete,
    handleSaveImageMetadata
};
