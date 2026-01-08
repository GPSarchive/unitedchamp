# Articles System Setup Guide

## Overview
A complete blog/articles system has been implemented with a beginner-friendly TipTap WYSIWYG editor, live preview, and public display pages.

## Features
✅ Rich text editor (TipTap) with Word-like interface
✅ Side-by-side live preview while editing
✅ Image upload support (drag & drop or URL)
✅ Draft/Published workflow
✅ SEO-friendly URLs with auto-generated slugs
✅ Admin dashboard for content management
✅ Public article display pages
✅ Full CRUD operations

---

## Step 1: Run Database Migration

The articles table needs to be created in your Supabase database.

### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file: `migrations/add-articles-table.sql`
4. Copy the entire SQL content
5. Paste into Supabase SQL Editor
6. Click **Run** to execute the migration

### Option B: Using Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push
```

### Verify Migration
Run this query in Supabase SQL Editor to verify the table was created:
```sql
SELECT * FROM articles LIMIT 1;
```

---

## Step 2: Access the Articles Dashboard

Once the migration is complete:

1. **Login as Admin**
   - Go to `/login` and sign in with your admin account
   - Ensure your user has the `admin` role in `app_metadata.roles`

2. **Navigate to Articles Dashboard**
   - Go to `/dashboard/articles`
   - You'll see the articles management interface

---

## Step 3: Create Your First Article

### Creating an Article

1. **Enter Title**
   - Type your article title in the "Title" field
   - The URL slug will auto-generate (you can customize it)

2. **Write Content**
   - Use the TipTap editor toolbar (buttons work like Microsoft Word):
     - **B** = Bold
     - **I** = Italic
     - **U** = Underline
     - **H1, H2, H3** = Headings
     - **List icons** = Bullet/numbered lists
     - **Quote** = Blockquote
     - **Code** = Code block
     - **Link** = Add hyperlink
     - **Image** = Upload image or add URL

3. **Add Images**
   - Click the **Image** button
   - Choose "OK" to upload from computer, or "Cancel" to enter a URL
   - Images are automatically uploaded to Supabase Storage

4. **Preview**
   - Click **"Show Preview"** to see side-by-side editing
   - Or click **"Preview Full Page"** to see exactly how it will look published

5. **Save**
   - Click **"Save as Draft"** to save without publishing
   - Click **"Publish Now"** to make it live immediately

---

## Step 4: Manage Articles

### Edit an Article
1. Find the article in the list
2. Click **"Edit"**
3. Make your changes
4. Click **"Save Changes"**

### Publish/Unpublish
- Click **"Publish"** button to make a draft article live
- Click **"Unpublish"** to revert to draft status

### Delete an Article
- Click **"Delete"** button
- Confirm the deletion

### View Published Article
- Click **"View"** button to open the article in a new tab
- Articles are available at: `/article/your-slug`

---

## URL Structure

- **Admin Dashboard**: `/dashboard/articles`
- **Public Article**: `/article/[slug]`
  - Example: `/article/match-highlights-january-2026`
- **API Endpoints**:
  - `GET /api/articles` - List articles
  - `POST /api/articles` - Create article (admin only)
  - `GET /api/articles/[id]` - Get article by ID
  - `PATCH /api/articles/[id]` - Update article (admin only)
  - `DELETE /api/articles/[id]` - Delete article (admin only)
  - `GET /api/articles/slug/[slug]` - Get article by slug

---

## For Complete Beginners

### Using the Editor (No Coding Knowledge Needed!)

The TipTap editor works just like Microsoft Word or Google Docs:

1. **Formatting Text**:
   - Select text → Click **B** button → Text becomes bold
   - Select text → Click **I** button → Text becomes italic
   - No need to remember any codes!

2. **Creating Headings**:
   - Click where you want a heading
   - Click **H1**, **H2**, or **H3** button
   - Type your heading

3. **Adding Links**:
   - Select text you want to make a link
   - Click the **Link** button (chain icon)
   - Enter the URL in the popup
   - Click OK

4. **Adding Images**:
   - Click where you want the image
   - Click the **Image** button (picture icon)
   - Choose to upload from computer or enter URL
   - Image appears in your article!

5. **Creating Lists**:
   - Click the **bullet list** icon for bullet points
   - Click the **numbered list** icon for numbered items
   - Just start typing!

### Live Preview
- Click **"Show Preview"** to see your article as you type
- What you see in the preview is exactly how it will look when published
- No surprises!

---

## Database Schema

```sql
Table: articles
├── id (bigserial) - Auto-generated ID
├── title (text) - Article title
├── slug (text) - URL-friendly identifier
├── content (jsonb) - Rich content (TipTap JSON)
├── excerpt (text) - Short description for SEO
├── featured_image (text) - Path to featured image
├── status (text) - draft | published | archived
├── author_id (uuid) - User who created the article
├── published_at (timestamptz) - Publication date
├── created_at (timestamptz) - Creation date
└── updated_at (timestamptz) - Last update date
```

---

## Troubleshooting

### "Unauthorized" Error
- Make sure you're logged in
- Verify your user has the `admin` role in Supabase

### Images Not Uploading
- Check Supabase Storage bucket exists: `GPSarchive's Project`
- Verify bucket permissions allow authenticated uploads
- Check file size (should be < 5MB)

### Slug Already Exists
- Each article must have a unique slug
- Modify the slug field to make it unique
- Example: `my-article-2` instead of `my-article`

### Article Not Appearing on Public Page
- Make sure status is set to **"published"** (not draft)
- Check the URL matches the slug: `/article/exact-slug`

---

## Next Steps

1. **Run the migration** (Step 1)
2. **Create a test article** to familiarize yourself
3. **Customize styling** in `/app/article/[slug]/page.tsx` if needed
4. **Add navigation links** to your main menu to link to articles

---

## Support

If you encounter any issues:
1. Check the browser console for errors (F12)
2. Verify the database migration ran successfully
3. Ensure you're logged in as an admin user
4. Check Supabase logs for API errors

---

**System created on**: 2026-01-07
**Technologies**: Next.js 15, TipTap, Supabase, TypeScript
