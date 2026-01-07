'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  LinkIcon,
  ImageIcon,
  Undo,
  Redo,
} from 'lucide-react';
import React from 'react';

interface RichTextEditorProps {
  content: any;
  onChange: (content: any) => void;
  placeholder?: string;
}

const MenuButton = ({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    type="button"
    title={title}
    className={`
      relative p-2 rounded-md transition-all duration-200
      ${active
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50 scale-105'
        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
      }
      ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      ${active ? 'ring-2 ring-indigo-400' : ''}
    `}
  >
    {children}
    {active && (
      <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-indigo-300 rounded-full" />
    )}
  </button>
);

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('Εισάγετε τη διεύθυνση URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      // Step 1: Get signed upload URL
      const signRes = await fetch('/api/storage/article-img', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type,
        }),
      });

      if (!signRes.ok) {
        throw new Error('Αποτυχία λήψης URL μεταφόρτωσης');
      }

      const { signedUrl, path, bucket } = await signRes.json();

      // Step 2: Upload file to signed URL
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Αποτυχία μεταφόρτωσης εικόνας');
      }

      // Step 3: Get public URL
      const publicURL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`;

      // Insert image into editor
      editor.chain().focus().setImage({ src: publicURL }).run();
    } catch (error) {
      console.error('Image upload error:', error);
      alert('Αποτυχία μεταφόρτωσης εικόνας. Παρακαλώ δοκιμάστε ξανά.');
    } finally {
      setUploading(false);
    }
  };

  const addImage = () => {
    const choice = window.confirm(
      'Πατήστε OK για να ανεβάσετε εικόνα από τον υπολογιστή σας, ή Άκυρο για να εισάγετε URL'
    );

    if (choice) {
      // Trigger file input
      fileInputRef.current?.click();
    } else {
      // URL input
      const url = window.prompt('Εισάγετε τη διεύθυνση URL της εικόνας:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
  };

  return (
    <div className="space-y-2">
      {/* Help text */}
      <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-3 text-sm text-blue-100">
        <p className="font-semibold mb-1">💡 Οδηγίες χρήσης:</p>
        <ul className="space-y-1 text-xs text-blue-200">
          <li>• Επιλέξτε κείμενο και πατήστε τα κουμπιά για μορφοποίηση</li>
          <li>• Τα ενεργά κουμπιά έχουν <span className="font-bold text-white">μπλε χρώμα</span></li>
          <li>• Περάστε το ποντίκι πάνω από κάθε κουμπί για λεπτομέρειες</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 p-3 border border-white/20 bg-black/30 rounded-lg">
        {/* Text formatting */}
        <div className="flex gap-1.5">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Έντονα (Ctrl+B) - Κάντε το κείμενο έντονο"
          >
            <Bold size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Πλάγια (Ctrl+I) - Κάντε το κείμενο πλάγιο"
          >
            <Italic size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Υπογράμμιση (Ctrl+U) - Υπογραμμίστε το κείμενο"
          >
            <UnderlineIcon size={18} />
          </MenuButton>
        </div>

        <div className="w-px bg-white/20" />

        {/* Headings */}
        <div className="flex gap-1.5">
          <MenuButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Επικεφαλίδα 1 - Μεγάλος τίτλος"
          >
            <Heading1 size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Επικεφαλίδα 2 - Μεσαίος τίτλος"
          >
            <Heading2 size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Επικεφαλίδα 3 - Μικρός τίτλος"
          >
            <Heading3 size={18} />
          </MenuButton>
        </div>

        <div className="w-px bg-white/20" />

        {/* Lists */}
        <div className="flex gap-1.5">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Λίστα με κουκκίδες - Δημιουργήστε λίστα με κουκκίδες"
          >
            <List size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Αριθμημένη λίστα - Δημιουργήστε αριθμημένη λίστα"
          >
            <ListOrdered size={18} />
          </MenuButton>
        </div>

        <div className="w-px bg-white/20" />

        {/* Block elements */}
        <div className="flex gap-1.5">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="Παράθεση - Προσθέστε παράθεση κειμένου"
          >
            <Quote size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="Κώδικας - Προσθέστε μπλοκ κώδικα"
          >
            <Code size={18} />
          </MenuButton>
        </div>

        <div className="w-px bg-white/20" />

        {/* Media */}
        <div className="flex gap-1.5">
          <MenuButton
            onClick={addLink}
            active={editor.isActive('link')}
            title="Σύνδεσμος - Προσθέστε σύνδεσμο (επιλέξτε κείμενο πρώτα)"
          >
            <LinkIcon size={18} />
          </MenuButton>
          <MenuButton
            onClick={addImage}
            disabled={uploading}
            title={uploading ? "Μεταφόρτωση..." : "Εικόνα - Ανεβάστε ή προσθέστε εικόνα"}
          >
            <ImageIcon size={18} />
          </MenuButton>
        </div>

        <div className="w-px bg-white/20" />

        {/* History */}
        <div className="flex gap-1.5">
          <MenuButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Αναίρεση (Ctrl+Z) - Ακυρώστε την τελευταία ενέργεια"
          >
            <Undo size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Επανάληψη (Ctrl+Shift+Z) - Επαναλάβετε την ενέργεια"
          >
            <Redo size={18} />
          </MenuButton>
        </div>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleImageUpload(file);
          }
          e.target.value = ''; // Reset input
        }}
      />
    </div>
  );
};

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 underline hover:text-blue-300',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Αρχίστε να γράφετε το άρθρο σας...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none min-h-[300px] p-4 focus:outline-none bg-black/40 rounded-b-lg',
      },
    },
  });

  React.useEffect(() => {
    if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="border border-white/20 rounded-lg bg-black/50 backdrop-blur-sm shadow-lg">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
