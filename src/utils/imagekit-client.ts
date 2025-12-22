import ImageKit from 'imagekit-javascript';

// Import thumbnail generation utility
import { getImageKitThumbnail } from './imagekit-transforms';

// Configuration constants
const publicKey = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY || '';
const urlEndpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT || '';
const authEndpoint = '/api/imagekit-auth';

// Validate configuration on module load
if (!publicKey || !urlEndpoint) {
    console.error('❌ ImageKit configuration missing:', {
        hasPublicKey: !!publicKey,
        hasUrlEndpoint: !!urlEndpoint,
        env: 'Please set VITE_IMAGEKIT_PUBLIC_KEY and VITE_IMAGEKIT_URL_ENDPOINT in .env.local'
    });
}

console.log('🔧 ImageKit client configuration:', {
    publicKey: publicKey ? publicKey.substring(0, 15) + '...' : 'MISSING',
    urlEndpoint,
    authEndpoint
});

// Initialize ImageKit client for browser
export const imagekitClient = new ImageKit({
    publicKey,
    urlEndpoint,
    authenticationEndpoint: authEndpoint
});

export interface UploadOptions {
    file: File;
    fileName: string;
    folder: string;
    tags?: string[];
    onProgress?: (progress: ProgressEvent) => void;
}

export interface UploadResult {
    url: string;
    fileId: string;
    thumbnailUrl: string;
    name: string;
    size: number;
    filePath: string;
}

/**
 * Upload a file to ImageKit using client-side upload
 * This method uses ImageKit's JavaScript SDK with proper authentication
 */
export async function uploadToImageKit(options: UploadOptions): Promise<UploadResult> {
    const { file, fileName, folder, tags, onProgress } = options;

    // Validate configuration before upload
    if (!publicKey || !urlEndpoint) {
        throw new Error('ImageKit configuration is missing. Please set VITE_IMAGEKIT_PUBLIC_KEY and VITE_IMAGEKIT_URL_ENDPOINT environment variables.');
    }

    // Validate file
    if (!file || !(file instanceof File)) {
        throw new Error('Invalid file provided for upload');
    }

    console.log('🚀 Starting ImageKit upload:', {
        fileName,
        folder,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        fileType: file.type
    });

    // First, test if we can get auth tokens
    let authTokens: { token: string; signature: string; expire: number };
    try {
        console.log('🔐 Testing authentication endpoint:', authEndpoint);
        const authResponse = await fetch(authEndpoint);
        console.log('🔐 Auth response status:', authResponse.status);
        
        if (!authResponse.ok) {
            const errorText = await authResponse.text();
            throw new Error(`Auth endpoint failed (${authResponse.status}): ${errorText}`);
        }
        
        const authData = await authResponse.json();
        console.log('✅ Auth tokens received:', {
            hasToken: !!authData.token,
            hasSignature: !!authData.signature,
            hasExpire: !!authData.expire,
            token: authData.token ? authData.token.substring(0, 8) + '...' : 'MISSING'
        });
        
        if (!authData.token || !authData.signature || !authData.expire) {
            throw new Error('Auth endpoint returned incomplete data');
        }
        
        authTokens = authData;
    } catch (error: any) {
        console.error('❌ Authentication test failed:', error);
        throw new Error(`Cannot authenticate with ImageKit: ${error.message}`);
    }

    return new Promise<UploadResult>((resolve, reject) => {
        try {
            const uploadOptions = {
                file,
                fileName,
                folder,
                tags: tags || [],
                useUniqueFileName: true,
                // Manually provide authentication tokens
                token: authTokens.token,
                signature: authTokens.signature,
                expire: authTokens.expire
            };

            console.log('📤 Upload options prepared:', {
                fileName,
                folder,
                hasFile: !!file,
                hasToken: !!authTokens.token,
                hasSignature: !!authTokens.signature,
                hasExpire: !!authTokens.expire,
                tokenValue: authTokens.token?.substring(0, 10) + '...',
                signatureValue: authTokens.signature?.substring(0, 10) + '...',
                expireValue: authTokens.expire
            });

            // Create progress handler wrapper
            const progressHandler = onProgress ? {
                onUploadProgress: (e: ProgressEvent) => {
                    if (e.lengthComputable) {
                        const percentComplete = Math.round((e.loaded * 100) / e.total);
                        console.log(`📊 Upload progress: ${percentComplete}%`);
                    }
                    onProgress(e);
                }
            } : undefined;

            console.log('📤 Calling ImageKit SDK upload...');

            // Execute upload
            imagekitClient.upload(
                uploadOptions,
                (err: any, result: any) => {
                    if (err) {
                        console.error('❌ ImageKit upload failed:', err);
                        const errorMessage = err.message || err.toString() || 'Unknown upload error';
                        reject(new Error(`ImageKit upload failed: ${errorMessage}`));
                    } else if (!result) {
                        console.error('❌ ImageKit returned no result');
                        reject(new Error('No result returned from ImageKit'));
                    } else {
                        console.log('✅ ImageKit upload successful:', {
                            fileId: result.fileId,
                            url: result.url
                        });
                        
                        // Generate thumbnail URL if not provided by ImageKit
                        const thumbnailUrl = result.thumbnailUrl || getImageKitThumbnail(result.url, 300, 300);
                        
                        resolve({
                            url: result.url,
                            fileId: result.fileId,
                            thumbnailUrl,
                            name: result.name || fileName,
                            size: result.size || file.size,
                            filePath: result.filePath
                        });
                    }
                },
                progressHandler
            );
        } catch (error: any) {
            console.error('❌ ImageKit upload setup error:', error);
            reject(new Error(`Failed to initialize upload: ${error.message || error}`));
        }
    });
}

/**
 * Get ImageKit URL with transformations
 */
export function getImageKitUrl(path: string, transformations?: string): string {
    const baseUrl = urlEndpoint;
    if (!baseUrl) {
        console.warn('ImageKit URL endpoint not configured');
        return path;
    }
    
    // Remove leading slash from path if present
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    if (transformations) {
        return `${baseUrl}/tr:${transformations}/${cleanPath}`;
    }
    return `${baseUrl}/${cleanPath}`;
}

/**
 * Predefined image transformations for common use cases
 */
export const IMAGE_TRANSFORMATIONS = {
    thumbnail: 'w-200,h-200,c-at_max,q-80',
    preview: 'w-800,h-600,c-at_max,q-85',
    fullsize: 'w-1920,h-1080,c-at_max,q-90',
    small: 'w-400,h-300,c-at_max,q-80'
};

/**
 * Delete an image from ImageKit
 */
export async function deleteFromImageKit(fileId: string): Promise<void> {
    if (!fileId) {
        throw new Error('File ID is required for deletion');
    }

    try {
        console.log('🗑️ Deleting image from ImageKit:', fileId);
        
        const response = await fetch('/api/imagekit-delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to delete image: ${response.statusText}`);
        }

        console.log('✅ Image deleted successfully');
    } catch (error: any) {
        console.error('❌ Error deleting image:', error);
        throw new Error(error.message || 'Failed to delete image');
    }
}

/**
 * Save image metadata to job in database
 */
export async function saveImageMetadata(
    jobId: string,
    category: 'before' | 'after',
    imageData: any
): Promise<void> {
    if (!jobId || !category || !imageData) {
        throw new Error('Job ID, category, and image data are required');
    }

    try {
        console.log('💾 Saving image metadata:', { jobId, category });
        
        const response = await fetch('/api/imagekit-save-metadata', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId, category, imageData })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to save metadata: ${response.statusText}`);
        }

        console.log('✅ Image metadata saved successfully');
    } catch (error: any) {
        console.error('❌ Error saving image metadata:', error);
        throw new Error(error.message || 'Failed to save image metadata');
    }
}

/**
 * Test ImageKit configuration
 */
export async function testImageKitConfiguration(): Promise<{ success: boolean; message: string }> {
    try {
        // Check client-side config
        if (!publicKey || !urlEndpoint) {
            return {
                success: false,
                message: 'Client-side ImageKit configuration is incomplete'
            };
        }

        // Test authentication endpoint
        const authResponse = await fetch(authEndpoint);
        if (!authResponse.ok) {
            return {
                success: false,
                message: `Authentication endpoint failed: ${authResponse.statusText}`
            };
        }

        const authData = await authResponse.json();
        if (!authData.token || !authData.expire || !authData.signature) {
            return {
                success: false,
                message: 'Authentication endpoint returned invalid data'
            };
        }

        return {
            success: true,
            message: 'ImageKit configuration is valid'
        };
    } catch (error: any) {
        return {
            success: false,
            message: `Configuration test failed: ${error.message}`
        };
    }
}
