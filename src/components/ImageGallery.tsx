import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { Badge } from './ui/badge';
import { Dialog, DialogContent } from './ui/dialog';
import { cn } from './ui/utils';
import { getImageKitThumbnail, isImageKitUrl } from '../utils/imagekit-transforms';

interface ImageData {
    id: string;
    url: string;
    thumbnailUrl?: string;
    caption?: string;
    category?: string;
}

interface ImageGalleryProps {
    images: ImageData[];
    category: 'before' | 'after';
    onDelete?: (imageId: string) => void;
}

export function ImageGallery({ images, category, onDelete }: ImageGalleryProps) {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    if (!images || images.length === 0) {
        return (
            <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-xs text-gray-500">No {category} images</p>
            </div>
        );
    }

    // Generate thumbnail URL for ImageKit images, otherwise use original
    const getThumbnailUrl = (image: ImageData) => {
        if (image.thumbnailUrl) return image.thumbnailUrl;
        if (isImageKitUrl(image.url)) {
            return getImageKitThumbnail(image.url, 300, 300);
        }
        return image.url;
    };

    return (
        <>
            <div className="grid grid-cols-3 gap-3">
                {images.map((image) => (
                    <div key={image.id} className="relative aspect-square group">
                        <img
                            src={getThumbnailUrl(image)}
                            alt={image.caption || category}
                            className="w-full h-full object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                            onClick={() => setSelectedImage(image.url)}
                            loading="lazy"
                            onError={(e) => {
                                console.error('Failed to load image:', image.url);
                                // Fallback to a placeholder if image fails to load
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                        />

                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ZoomIn className="w-8 h-8 text-white" />
                        </div>

                        {/* Category badge */}
                        {image.category && (
                            <Badge className={cn(
                                "absolute top-2 left-2 text-xs",
                                category === 'before' ? "bg-blue-600" : "bg-green-600"
                            )}>
                                {image.category}
                            </Badge>
                        )}

                        {/* Delete button */}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(image.id);
                                }}
                                className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                title="Delete image"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Lightbox for full-size view */}
            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="max-w-7xl max-h-[90vh] p-0 overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                        <img
                            src={selectedImage || ''}
                            alt="Full size"
                            className="max-w-full max-h-[90vh] object-contain"
                        />
                        <button
                            onClick={() => setSelectedImage(null)}
                            className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
