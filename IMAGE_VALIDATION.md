# Image Validation Implementation

## Overview

This system validates images using **actual file content analysis**, not just MIME types. It prevents:

- ✅ Malicious file uploads (malware disguised as images)
- ✅ SVG XSS attacks (embedded scripts)
- ✅ Corrupted/invalid images
- ✅ Format spoofing (fake extensions)
- ✅ Invalid dimensions

---

## How It Works

### **3-Layer Validation**

```
File Upload
    ↓
1. Magic Byte Check (detects actual file type)
    ↓
2. Image Metadata Analysis (dimensions, corruption)
    ↓
3. Content Sanitization (SVG script removal)
    ↓
Upload to Storage
```

---

## Libraries Used

| Library | Purpose | Version |
|---------|---------|---------|
| **sharp** | Image metadata extraction & validation | Latest |
| **file-type** | Magic byte detection (file signatures) | Latest |
| **isomorphic-dompurify** | SVG sanitization (XSS prevention) | Latest |

---

## Validation Rules

### **Team Logos** (`/api/teams/logo-upload`)

```typescript
{
  maxSizeBytes: 3 * 1024 * 1024,  // 3MB
  minWidth: 64,
  maxWidth: 2048,
  minHeight: 64,
  maxHeight: 2048,
  allowedFormats: ['jpeg', 'png', 'webp', 'svg'],
  sanitizeSVG: true,
}
```

### **Tournament/Player Images** (Client-side pre-validation)

```typescript
{
  maxSizeBytes: 5 * 1024 * 1024,  // 5MB
  minWidth: 64,
  maxWidth: 4096,
  minHeight: 64,
  maxHeight: 4096,
  allowedFormats: ['jpeg', 'png', 'webp', 'gif', 'svg', 'avif'],
}
```

---

## File Validation Process

### **Magic Bytes (File Signatures)**

Each file format has a unique binary signature:

| Format | Magic Bytes | Detection |
|--------|-------------|-----------|
| JPEG | `FF D8 FF` | ✅ Yes |
| PNG | `89 50 4E 47` | ✅ Yes |
| GIF | `47 49 46` | ✅ Yes |
| WebP | `52 49 46 46 ... 57 45 42 50` | ✅ Yes |
| AVIF | `66 74 79 70` (ftyp box) | ✅ Yes |
| SVG | `<svg` or `<?xml` | ✅ Yes |

**Example Attack Blocked:**
```bash
# Attacker renames malware.exe to logo.png
# MIME type: "image/png"
# Magic bytes: 4D 5A (EXE signature)
# ❌ BLOCKED: "Unable to detect file type"
```

---

## SVG Security

### **Dangerous Patterns Blocked**

```xml
<!-- ❌ BLOCKED: Inline JavaScript -->
<svg><script>alert('XSS')</script></svg>

<!-- ❌ BLOCKED: Event handlers -->
<svg><rect onclick="alert('XSS')"/></svg>

<!-- ❌ BLOCKED: JavaScript URLs -->
<svg><a href="javascript:alert('XSS')">Click</a></svg>

<!-- ❌ BLOCKED: Embedded objects -->
<svg><iframe src="evil.com"></iframe></svg>

<!-- ✅ ALLOWED: Clean SVG -->
<svg><circle cx="50" cy="50" r="40"/></svg>
```

### **DOMPurify Configuration**

```typescript
DOMPurify.sanitize(svgString, {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['use'],
  FORBID_TAGS: ['script', 'iframe', 'embed', 'object', 'foreignObject'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
});
```

---

## Testing Your Validation

### **Test Endpoint**

Use the validation test endpoint to check files:

```bash
POST /api/storage/validate-image
Content-Type: multipart/form-data

file: [image file]
```

**Success Response:**
```json
{
  "valid": true,
  "message": "Image is valid!",
  "metadata": {
    "format": "png",
    "width": 512,
    "height": 512,
    "size": 245678
  },
  "fileInfo": {
    "name": "logo.png",
    "size": 245678,
    "type": "image/png"
  }
}
```

**Failure Response:**
```json
{
  "valid": false,
  "error": "Image width 4500px exceeds maximum 2048px",
  "fileInfo": {
    "name": "huge.png",
    "size": 8234567,
    "type": "image/png"
  }
}
```

---

## Test Cases

### **1. Test with cURL**

```bash
# Valid image
curl -X POST http://localhost:3000/api/storage/validate-image \
  -H "Cookie: your-auth-cookie" \
  -F "file=@valid-logo.png"

# Invalid image (too large)
curl -X POST http://localhost:3000/api/storage/validate-image \
  -H "Cookie: your-auth-cookie" \
  -F "file=@huge-image.jpg"

# Malicious SVG
curl -X POST http://localhost:3000/api/storage/validate-image \
  -H "Cookie: your-auth-cookie" \
  -F "file=@malicious.svg"
```

### **2. Test Attack Scenarios**

#### **Scenario 1: Fake Extension**
```bash
# Rename malware.exe to logo.png
cp malware.exe logo.png

# Upload attempt
curl -X POST http://localhost:3000/api/teams/logo-upload \
  -F "file=@logo.png" \
  -F "team=TestTeam"

# Expected: ❌ "Unable to detect file type - may not be a valid image"
```

#### **Scenario 2: SVG XSS**
```bash
# Create malicious SVG
cat > xss.svg <<EOF
<svg xmlns="http://www.w3.org/2000/svg">
  <script>alert('XSS')</script>
  <circle cx="50" cy="50" r="40"/>
</svg>
EOF

# Upload attempt
curl -X POST http://localhost:3000/api/teams/logo-upload \
  -F "file=@xss.svg" \
  -F "team=TestTeam"

# Expected: ❌ "SVG contains potentially malicious content"
```

#### **Scenario 3: Image Too Large**
```bash
# Create 5000x5000px image (exceeds 2048px limit)
convert -size 5000x5000 xc:red large.png

curl -X POST http://localhost:3000/api/teams/logo-upload \
  -F "file=@large.png" \
  -F "team=TestTeam"

# Expected: ❌ "Image width 5000px exceeds maximum 2048px"
```

#### **Scenario 4: Valid Image**
```bash
# Create valid 512x512 PNG
convert -size 512x512 xc:blue logo.png

curl -X POST http://localhost:3000/api/teams/logo-upload \
  -F "file=@logo.png" \
  -F "team=TestTeam"

# Expected: ✅ 201 Created with publicUrl
```

---

## Client-Side Integration

### **Example: React Component with Validation**

```typescript
import { validateImageClient } from '@/app/lib/utils/clientImageValidation';

async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Client-side pre-validation (before upload)
  const validation = await validateImageClient(file, {
    maxSizeBytes: 3 * 1024 * 1024,
    allowedFormats: ['jpeg', 'png', 'webp'],
    minWidth: 128,
    maxWidth: 2048,
    checkDimensions: true,
  });

  if (!validation.valid) {
    alert(`Invalid image: ${validation.error}`);
    return;
  }

  // Proceed with upload
  const formData = new FormData();
  formData.append('file', file);
  formData.append('team', 'MyTeam');

  const response = await fetch('/api/teams/logo-upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const result = await response.json();
  if (!response.ok) {
    alert(`Server validation failed: ${result.error}`);
    return;
  }

  console.log('Uploaded successfully:', result.publicUrl);
}
```

---

## Security Benefits

### **Before (MIME Type Only)**

```typescript
❌ if (!file.type.startsWith("image/")) { ... }

Problems:
- Client can fake MIME type
- Doesn't verify actual file content
- SVG scripts not detected
- Corrupted images not caught
```

### **After (Magic Bytes + Metadata)**

```typescript
✅ const validation = await validateImage(buffer, options);

Benefits:
- Reads actual file signature
- Verifies image metadata with sharp
- Sanitizes SVG content
- Checks dimensions and size
- Detects corrupted files
```

---

## Performance Impact

| Operation | Time | Notes |
|-----------|------|-------|
| Magic byte check | <1ms | First 100 bytes only |
| sharp metadata read | 10-50ms | Depends on file size |
| SVG sanitization | 5-20ms | Text parsing |
| **Total validation** | **20-100ms** | One-time per upload |

**Trade-off:** Slight latency increase for significantly better security.

---

## Monitoring Validation Failures

### **Log Failed Validations**

Add logging to track attack attempts:

```typescript
if (!validation.valid) {
  console.warn('Image validation failed:', {
    error: validation.error,
    fileName: file.name,
    fileSize: file.size,
    userAgent: req.headers.get('user-agent'),
    ip: req.headers.get('x-forwarded-for'),
  });

  return NextResponse.json({ error: validation.error }, { status: 400 });
}
```

---

## Customizing Validation Rules

Edit `/src/app/lib/utils/imageValidation.ts`:

```typescript
// Allow larger files
maxSizeBytes: 10 * 1024 * 1024, // 10MB

// Allow more formats
allowedFormats: ['jpeg', 'png', 'webp', 'gif', 'avif', 'svg', 'bmp'],

// Stricter dimensions
minWidth: 256,  // Require at least 256px
maxWidth: 1024, // Limit to 1024px

// Disable SVG (safest option)
allowedFormats: ['jpeg', 'png', 'webp'], // No SVG
```

---

## Best Practices

1. ✅ **Always validate server-side** (client validation is bypassable)
2. ✅ **Use magic bytes** (don't trust file extensions)
3. ✅ **Sanitize SVG** (or disable SVG uploads entirely)
4. ✅ **Check dimensions** (prevent resource exhaustion)
5. ✅ **Limit file size** (prevent storage abuse)
6. ✅ **Log failures** (detect attack patterns)

---

## Troubleshooting

### **Issue: "Unable to detect file type"**

**Cause:** File is not a valid image or is corrupted

**Solution:** Try opening the file in an image viewer first

### **Issue: "sharp validation failed"**

**Cause:** Image is corrupted or uses unsupported encoding

**Solution:** Re-export image from image editor

### **Issue: "SVG contains malicious content"**

**Cause:** SVG has scripts or event handlers

**Solution:** Clean SVG using an SVG optimizer (SVGO) before upload

---

## Additional Resources

- [sharp documentation](https://sharp.pixelplumbing.com/)
- [file-type documentation](https://github.com/sindresorhus/file-type)
- [DOMPurify documentation](https://github.com/cure53/DOMPurify)
- [List of file signatures (magic bytes)](https://en.wikipedia.org/wiki/List_of_file_signatures)
