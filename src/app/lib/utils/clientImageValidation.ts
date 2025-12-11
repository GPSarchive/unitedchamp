/**
 * Client-side image validation
 * Lighter validation before upload to save bandwidth
 */

export interface ClientValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check magic bytes on client side (browser)
 */
function detectImageFormatClient(buffer: Uint8Array): string | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }

  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }

  // WebP: RIFF ... WEBP (check bytes 8-11)
  if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'webp';
  }

  // SVG
  const textDecoder = new TextDecoder();
  const start = textDecoder.decode(buffer.slice(0, 100));
  if (start.includes('<?xml') || start.includes('<svg')) {
    return 'svg';
  }

  return null;
}

/**
 * Validate image file on client side before upload
 */
export async function validateImageClient(
  file: File,
  options: {
    maxSizeBytes?: number;
    allowedFormats?: string[];
    checkDimensions?: boolean;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  } = {}
): Promise<ClientValidationResult> {
  const {
    maxSizeBytes = 5 * 1024 * 1024, // 5MB
    allowedFormats = ['jpeg', 'png', 'webp', 'gif', 'svg'],
    checkDimensions = true,
    minWidth = 64,
    maxWidth = 4096,
    minHeight = 64,
    maxHeight = 4096,
  } = options;

  try {
    // 1. Check file size
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max ${(maxSizeBytes / 1024 / 1024).toFixed(0)}MB)`,
      };
    }

    // 2. Read first 100 bytes to check magic bytes
    const headerBuffer = await file.slice(0, 100).arrayBuffer();
    const header = new Uint8Array(headerBuffer);
    const detectedFormat = detectImageFormatClient(header);

    if (!detectedFormat) {
      return {
        valid: false,
        error: 'Unable to detect image format - file may not be a valid image',
      };
    }

    // 3. Check allowed formats
    if (!allowedFormats.includes(detectedFormat)) {
      return {
        valid: false,
        error: `Format '${detectedFormat}' not allowed. Allowed: ${allowedFormats.join(', ')}`,
      };
    }

    // 4. Check SVG for dangerous content
    if (detectedFormat === 'svg') {
      const svgText = await file.text();
      const dangerousPatterns = [
        /<script[\s>]/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<embed/i,
        /<object/i,
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(svgText)) {
          return {
            valid: false,
            error: 'SVG contains potentially malicious content',
          };
        }
      }
    }

    // 5. Check dimensions (requires loading image)
    if (checkDimensions && detectedFormat !== 'svg') {
      const dimensions = await getImageDimensions(file);

      if (dimensions.width < minWidth) {
        return {
          valid: false,
          error: `Image width ${dimensions.width}px is below minimum ${minWidth}px`,
        };
      }

      if (dimensions.width > maxWidth) {
        return {
          valid: false,
          error: `Image width ${dimensions.width}px exceeds maximum ${maxWidth}px`,
        };
      }

      if (dimensions.height < minHeight) {
        return {
          valid: false,
          error: `Image height ${dimensions.height}px is below minimum ${minHeight}px`,
        };
      }

      if (dimensions.height > maxHeight) {
        return {
          valid: false,
          error: `Image height ${dimensions.height}px exceeds maximum ${maxHeight}px`,
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get image dimensions by loading it
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
