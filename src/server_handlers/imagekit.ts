import ImageKit from 'imagekit';

// Load and validate environment variables
const publicKey = process.env.VITE_IMAGEKIT_PUBLIC_KEY || '';
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || '';
const urlEndpoint = process.env.VITE_IMAGEKIT_URL_ENDPOINT || '';

// Log configuration status (without exposing secrets)
const hasAllCredentials = !!(publicKey && privateKey && urlEndpoint);
if (!hasAllCredentials) {
    console.error('❌ ImageKit server configuration missing:', {
        hasPublicKey: !!publicKey,
        hasPrivateKey: !!privateKey,
        hasUrlEndpoint: !!urlEndpoint,
        note: 'Please set VITE_IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and VITE_IMAGEKIT_URL_ENDPOINT'
    });
}

// Initialize ImageKit SDK
export const imagekit = new ImageKit({
    publicKey,
    privateKey,
    urlEndpoint
});

/**
 * Generate authentication parameters for client-side uploads
 * This is required for secure client-side uploads to ImageKit
 */
export function getImageKitAuthParams() {
    try {
        if (!privateKey || !publicKey) {
            throw new Error('ImageKit credentials not configured. Please set VITE_IMAGEKIT_PUBLIC_KEY and IMAGEKIT_PRIVATE_KEY environment variables.');
        }
        
        const authParams = imagekit.getAuthenticationParameters();
        console.log('✅ Generated ImageKit auth params');
        
        return authParams;
    } catch (error: any) { (server-side)
 */
export async function uploadToImageKit(options: {
    file: string | Buffer; // base64 string or buffer
    fileName: string;
    folder: string;
    tags?: string[];
    useUniqueFileName?: boolean;
}) {
    try {
        if (!privateKey) {
            throw new Error('ImageKit private key not configured');
        }

        console.log('🚀 Server-side ImageKit upload:', {
            fileName: options.fileName,
            folder: options.folder,
            tags: options.tags
        });

        const result = await imagekit.upload({
            file: options.file,
            fileName: options.fileName,
            folder: options.folder,
            tags: options.tags || [],
            useUniqueFileName: options.useUniqueFileName !== false
        });

        console.log('✅ ImageKit upload successful:', {
            fileId: result.fileId,
            url: result.url
        });

        return {
            url: result.url,
            fileId: result.fileId,
            thumbnailUrl: result.thumbnailUrl,
            name: result.name,
            size: result.size,
            filePath: result.filePath
        };
    } catch (error: any) {
        console.error('❌ ImageKit upload error:', error);
        throw new Error(`Upload failed: ${error.message || error}`);
    }
}
 (server-side utility)
 */
export function getImageKitUrl(path: string, transformations?: string) {
    if (!urlEndpoint) {
        console.warn('ImageKit URL endpoint not configured');
        return path;
    }
    
    // Remove leading slash from path if present
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    if (transformations) {
        return `${urlEndpoint}/tr:${transformations}/${cleanPath}`;
    }
    return `${urlEndpoint}/${cleanPmageKit private key not configured');
        }

        console.log('🗑️ Deleting file from ImageKit:', fileId);
        
        await imagekit.deleteFile(fileId);
        
        console.log('✅ File deleted successfully');
        return { success: true };
    } catch (error: any) {
        console.error('❌ ImageKit delete error:', error);
        throw new Error(`Delete failed: ${error.message || error}`)
export async function deleteFromImageKit(fileId: string) {
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
export function getImageKitUrl(path: string, transformations?: string) {
    const urlEndpoint = process.env.VITE_IMAGEKIT_URL_ENDPOINT || '';
    if (transformations) {
        return `${urlEndpoint}/tr:${transformations}/${path}`;
    }
    return `${urlEndpoint}/${path}`;
}
