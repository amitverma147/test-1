const ImageKit = require('imagekit');

// Initialize ImageKit with environment variables
const imagekit = new ImageKit({
    publicKey: process.env.VITE_IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: process.env.VITE_IMAGEKIT_URL_ENDPOINT || ''
});

/**
 * Generate authentication parameters for client-side uploads
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
        const result = await imagekit.upload({
            file,
            fileName,
            folder,
            tags: tags || [],
            useUniqueFileName: useUniqueFileName !== false
        });
        res.status(200).json({
            url: result.url,
            fileId: result.fileId,
            thumbnailUrl: result.thumbnailUrl,
            name: result.name,
            size: result.size,
            filePath: result.filePath
        });
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
        await imagekit.deleteFile(fileId);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error in handleImageKitDelete:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
}

/**
 * HTTP Handler: Save image metadata
 */
async function handleSaveImageMetadata(req, res) {
    try {
        const { fileId, metadata } = req.body;
        res.status(200).json({ success: true, message: 'Metadata saved' });
    } catch (error) {
        console.error('Error in handleSaveImageMetadata:', error);
        res.status(500).json({ error: 'Failed to save metadata' });
    }
}

module.exports = {
    handleImageKitAuth,
    handleImageKitUpload,
    handleImageKitDelete,
    handleSaveImageMetadata
};
