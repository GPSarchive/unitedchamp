import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Validates that a file is actually an image by checking:
 * 1. Magic bytes (file signature)
 * 2. Image metadata (dimensions, format)
 * 3. SVG sanitization (if applicable)
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  metadata?: {
    format: string;
    width: number;
    height: number;
    size: number;
  };
}

export interface ImageValidationOptions {
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxSizeBytes?: number;
  allowedFormats?: string[]; // ['jpeg', 'png', 'webp', 'gif', 'avif']
  sanitizeSVG?: boolean;
}

const DEFAULT_OPTIONS: ImageValidationOptions = {
  maxWidth: 4096,
  minWidth: 16,
  maxHeight: 4096,
  minHeight: 16,
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedFormats: ['jpeg', 'png', 'webp', 'gif', 'avif', 'svg'],
  sanitizeSVG: true,
};

/**
 * Validates image from ArrayBuffer or Buffer
 */
export async function validateImage(
  buffer: ArrayBuffer | Buffer,
  options: ImageValidationOptions = {}
): Promise<ImageValidationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  try {
    // 1. Check file size
    if (opts.maxSizeBytes && buf.length > opts.maxSizeBytes) {
      return {
        valid: false,
        error: `File too large: ${(buf.length / 1024 / 1024).toFixed(2)}MB (max ${(opts.maxSizeBytes / 1024 / 1024).toFixed(0)}MB)`,
      };
    }

    // 2. Detect actual file type from magic bytes
    const fileType = await fileTypeFromBuffer(buf);

    // Handle SVG separately (file-type doesn't detect SVG well)
    const isSVG = buf.toString('utf8', 0, 100).includes('<svg');

    if (!fileType && !isSVG) {
      return {
        valid: false,
        error: 'Unable to detect file type - may not be a valid image',
      };
    }

    const detectedFormat = isSVG ? 'svg' : fileType?.ext;

    // 3. Check if format is allowed
    if (detectedFormat && opts.allowedFormats && !opts.allowedFormats.includes(detectedFormat)) {
      return {
        valid: false,
        error: `Format '${detectedFormat}' not allowed. Allowed: ${opts.allowedFormats.join(', ')}`,
      };
    }

    // 4. Handle SVG validation
    if (isSVG) {
      return validateSVG(buf, opts);
    }

    // 5. Validate image metadata with sharp
    const metadata = await sharp(buf).metadata();

    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: 'Unable to read image dimensions - file may be corrupted',
      };
    }

    // 6. Check dimensions
    if (opts.minWidth && metadata.width < opts.minWidth) {
      return {
        valid: false,
        error: `Image width ${metadata.width}px is below minimum ${opts.minWidth}px`,
      };
    }

    if (opts.maxWidth && metadata.width > opts.maxWidth) {
      return {
        valid: false,
        error: `Image width ${metadata.width}px exceeds maximum ${opts.maxWidth}px`,
      };
    }

    if (opts.minHeight && metadata.height < opts.minHeight) {
      return {
        valid: false,
        error: `Image height ${metadata.height}px is below minimum ${opts.minHeight}px`,
      };
    }

    if (opts.maxHeight && metadata.height > opts.maxHeight) {
      return {
        valid: false,
        error: `Image height ${metadata.height}px exceeds maximum ${opts.maxHeight}px`,
      };
    }

    // 7. Success
    return {
      valid: true,
      metadata: {
        format: metadata.format || detectedFormat || 'unknown',
        width: metadata.width,
        height: metadata.height,
        size: buf.length,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: `Image validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validates and sanitizes SVG files
 */
function validateSVG(
  buffer: Buffer,
  options: ImageValidationOptions
): ImageValidationResult {
  try {
    const svgString = buffer.toString('utf8');

    // Check for obvious malicious content
    const dangerousPatterns = [
      /<script[\s>]/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick, onload, etc.
      /<iframe/i,
      /<embed/i,
      /<object/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(svgString)) {
        return {
          valid: false,
          error: 'SVG contains potentially malicious content (scripts, event handlers, or embedded objects)',
        };
      }
    }

    // Sanitize SVG if enabled
    if (options.sanitizeSVG) {
      const sanitized = DOMPurify.sanitize(svgString, {
        USE_PROFILES: { svg: true, svgFilters: true },
        ADD_TAGS: ['use'],
        FORBID_TAGS: ['script', 'iframe', 'embed', 'object', 'foreignObject'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
      });

      if (!sanitized || sanitized.length === 0) {
        return {
          valid: false,
          error: 'SVG sanitization removed all content - file may be malicious',
        };
      }
    }

    // Basic validation - should have svg root element
    if (!/<svg[\s>]/.test(svgString)) {
      return {
        valid: false,
        error: 'Invalid SVG - missing root <svg> element',
      };
    }

    return {
      valid: true,
      metadata: {
        format: 'svg',
        width: 0, // SVG dimensions are dynamic
        height: 0,
        size: buffer.length,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: `SVG validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Quick magic byte check (lightweight alternative to file-type)
 */
export function detectImageFormat(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;

  // Check magic bytes
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }
  if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'webp';
  }
  if (buffer.toString('utf8', 0, 5) === '<?xml' || buffer.toString('utf8', 0, 4) === '<svg') {
    return 'svg';
  }
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    // Check for 'avif' or 'avis' in ftyp box
    const ftypBox = buffer.toString('utf8', 4, 12);
    if (ftypBox.includes('avif') || ftypBox.includes('avis')) {
      return 'avif';
    }
  }

  return null;
}
