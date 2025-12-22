/**
 * ImageKit URL transformation utilities
 * Generates optimized URLs for thumbnails, resized images, etc.
 */

const IMAGEKIT_ENDPOINT = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT;

/**
 * Generate a thumbnail URL from an ImageKit image URL
 * @param url Original ImageKit URL
 * @param width Thumbnail width (default: 300)
 * @param height Thumbnail height (default: 300)
 * @returns Transformed URL with thumbnail parameters
 */
export function getImageKitThumbnail(url: string, width: number = 300, height: number = 300): string {
  if (!url || !url.includes('ik.imagekit.io')) {
    return url;
  }

  // ImageKit URL transformation format:
  // https://ik.imagekit.io/your_imagekit_id/tr:w-300,h-300,c-at_max/path/to/image.jpg
  
  // Extract the path after the endpoint
  const endpoint = IMAGEKIT_ENDPOINT || 'https://ik.imagekit.io/ropaxjhgke';
  const path = url.replace(endpoint, '');
  
  // Add transformation parameters
  const transformations = `tr:w-${width},h-${height},c-at_max,q-80,f-auto`;
  
  return `${endpoint}/${transformations}${path}`;
}

/**
 * Generate an optimized image URL with specific dimensions
 * @param url Original ImageKit URL
 * @param width Desired width
 * @param height Desired height (optional, maintains aspect ratio if not provided)
 * @param quality Image quality (1-100, default: 85)
 * @returns Transformed URL
 */
export function getImageKitOptimized(
  url: string,
  width: number,
  height?: number,
  quality: number = 85
): string {
  if (!url || !url.includes('ik.imagekit.io')) {
    return url;
  }

  const endpoint = IMAGEKIT_ENDPOINT || 'https://ik.imagekit.io/ropaxjhgke';
  const path = url.replace(endpoint, '');
  
  let transformations = `tr:w-${width}`;
  if (height) {
    transformations += `,h-${height}`;
  }
  transformations += `,q-${quality},f-auto`;
  
  return `${endpoint}/${transformations}${path}`;
}

/**
 * Generate a responsive image URL for different screen sizes
 * @param url Original ImageKit URL
 * @param size Screen size: 'small' | 'medium' | 'large' | 'xlarge'
 * @returns Transformed URL
 */
export function getImageKitResponsive(url: string, size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium'): string {
  const widths = {
    small: 640,    // Mobile
    medium: 1024,  // Tablet
    large: 1920,   // Desktop
    xlarge: 2560   // Large displays
  };

  return getImageKitOptimized(url, widths[size]);
}

/**
 * Extract file ID from ImageKit URL
 * @param url ImageKit URL
 * @returns File ID or null
 */
export function extractImageKitFileId(url: string): string | null {
  // ImageKit URLs typically contain the file ID in the path
  // Example: https://ik.imagekit.io/ropaxjhgke/jobs/JC123/before/image_abc123.jpg
  // The file ID would be extracted from the filename or path
  const match = url.match(/\/([a-zA-Z0-9_-]+)\.[a-z]+$/);
  return match ? match[1] : null;
}

/**
 * Check if a URL is an ImageKit URL
 * @param url URL to check
 * @returns true if it's an ImageKit URL
 */
export function isImageKitUrl(url: string): boolean {
  return url && url.includes('ik.imagekit.io');
}
