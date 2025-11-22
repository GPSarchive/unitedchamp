// app/lib/colorExtraction.ts
// Client-side color extraction using Canvas API

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b]
    .map((x) => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");
}

/**
 * Calculate perceived brightness of a color (0-255)
 */
function getBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Calculate color saturation (0-1)
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

/**
 * Extract dominant color from an image file using Canvas API
 * Works client-side in the browser
 */
export async function extractColorFromImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("Failed to read image file"));
    };

    img.onload = () => {
      try {
        // Create canvas and resize image to small size for faster processing
        const canvas = document.createElement("canvas");
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Count colors, but skip very bright/dark pixels and low saturation
        const colorCounts = new Map<string, { count: number; rgb: RGB }>();

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Skip transparent pixels
          if (a < 128) continue;

          // Skip very bright (likely white/background) or very dark pixels
          const brightness = getBrightness(r, g, b);
          if (brightness > 240 || brightness < 15) continue;

          // Skip low saturation (grayscale) pixels
          const saturation = getSaturation(r, g, b);
          if (saturation < 0.2) continue;

          // Quantize colors to reduce variations (group similar colors)
          const qr = Math.round(r / 10) * 10;
          const qg = Math.round(g / 10) * 10;
          const qb = Math.round(b / 10) * 10;
          const key = `${qr},${qg},${qb}`;

          const existing = colorCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorCounts.set(key, { count: 1, rgb: { r: qr, g: qg, b: qb } });
          }
        }

        // Find most common color
        let maxCount = 0;
        let dominantColor: RGB = { r: 0, g: 128, b: 255 }; // default blue

        for (const [_, { count, rgb }] of colorCounts) {
          if (count > maxCount) {
            maxCount = count;
            dominantColor = rgb;
          }
        }

        resolve(rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Extract dominant color from an image URL using Canvas API
 * Works client-side in the browser
 * Uses fetch + blob to bypass CORS restrictions
 */
export async function extractColorFromImageUrl(url: string): Promise<string> {
  try {
    // Fetch the image as a blob to bypass CORS restrictions
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    // Create a blob URL (this bypasses CORS for canvas operations)
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          // Clean up the blob URL
          URL.revokeObjectURL(blobUrl);

          // Create canvas and resize image to small size for faster processing
          const canvas = document.createElement("canvas");
          const maxSize = 100;
          const scale = Math.min(maxSize / img.width, maxSize / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          // Draw image on canvas
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          // Count colors, but skip very bright/dark pixels and low saturation
          const colorCounts = new Map<string, { count: number; rgb: RGB }>();

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            // Skip transparent pixels
            if (a < 128) continue;

            // Skip very bright (likely white/background) or very dark pixels
            const brightness = getBrightness(r, g, b);
            if (brightness > 240 || brightness < 15) continue;

            // Skip low saturation (grayscale) pixels
            const saturation = getSaturation(r, g, b);
            if (saturation < 0.2) continue;

            // Quantize colors to reduce variations (group similar colors)
            const qr = Math.round(r / 10) * 10;
            const qg = Math.round(g / 10) * 10;
            const qb = Math.round(b / 10) * 10;
            const key = `${qr},${qg},${qb}`;

            const existing = colorCounts.get(key);
            if (existing) {
              existing.count++;
            } else {
              colorCounts.set(key, { count: 1, rgb: { r: qr, g: qg, b: qb } });
            }
          }

          // Find most common color
          let maxCount = 0;
          let dominantColor: RGB = { r: 0, g: 128, b: 255 }; // default blue

          for (const [_, { count, rgb }] of colorCounts) {
            if (count > maxCount) {
              maxCount = count;
              dominantColor = rgb;
            }
          }

          resolve(rgbToHex(dominantColor.r, dominantColor.g, dominantColor.b));
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error("Failed to load image from blob URL"));
      };

      img.src = blobUrl;
    });
  } catch (error) {
    throw new Error(`Failed to extract color: ${error instanceof Error ? error.message : String(error)}`);
  }
}
