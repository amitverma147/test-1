const ImageKit = require('imagekit');

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

module.exports = {
    imagekit,
    getImageKitAuthParams,
    uploadToImageKit,
    deleteFromImageKit,
    getImageKitUrl
};
