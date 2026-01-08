'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
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

// Error boundary to catch TipTap crashes
class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('TipTap Editor Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-rose-500/50 bg-rose-900/20 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-rose-200 mb-2">
            Σφάλμα Επεξεργαστή
          </h3>
          <p className="text-sm text-rose-300/80 mb-4">
            Παρουσιάστηκε πρόβλημα με τον επεξεργαστή κειμένου. Παρακαλώ ανανεώστε τη σελίδα.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors"
          >
            Ανανέωση Σελίδας
          </button>
          {this.state.error && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-rose-400 cursor-pointer hover:text-rose-300">
                Τεχνικές Λεπτομέρειες
              </summary>
              <pre className="mt-2 text-xs text-rose-200/70 bg-black/30 p-3 rounded overflow-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
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

const MenuBar = React.memo(({ editor }: { editor: Editor | null }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadCount, setUploadCount] = React.useState(0);
  const uploadQueueRef = React.useRef<Promise<void>>(Promise.resolve());

  if (!editor) {
    return null;
  }

  const handleImageUpload = async (file: File) => {
    // Queue this upload after any pending uploads
    uploadQueueRef.current = uploadQueueRef.current.then(async () => {
      setUploading(true);
      setUploadCount((prev) => prev + 1);
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
        setUploadCount((prev) => {
          const newCount = prev - 1;
          if (newCount === 0) {
            setUploading(false);
          }
          return newCount;
        });
      }
    });
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
    <div className="space-y-3">
      {/* Help text */}
      <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg p-4">
        <p className="font-semibold text-base text-blue-100 mb-3">💡 Πώς να χρησιμοποιήσετε τον επεξεργαστή</p>
        <div className="text-sm text-blue-100">
        <div className="grid md:grid-cols-2 gap-3 text-xs text-blue-200">
          <div className="space-y-1.5">
            <p className="font-semibold text-white">Για Έντονα/Πλάγια/Υπογράμμιση:</p>
            <p>1. Επιλέξτε το κείμενο με το ποντίκι</p>
            <p>2. Πατήστε το κουμπί (B, I, U)</p>
            <p>3. Το κείμενο αλλάζει αμέσως!</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-white">Για Επικεφαλίδες (H1, H2, H3):</p>
            <p>1. Βάλτε τον κέρσορα σε κενή γραμμή</p>
            <p>2. Πατήστε H1, H2 ή H3</p>
            <p>3. Γράψτε τον τίτλο σας</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-white">Για Λίστες (•  1.):</p>
            <p>1. Πατήστε το κουμπί λίστας</p>
            <p>2. Γράψτε το πρώτο στοιχείο</p>
            <p>3. Πατήστε Enter για νέο στοιχείο</p>
          </div>
        </div>
        <div className="mt-3 space-y-2 border-t border-blue-400/30 pt-3">
          <div className="space-y-1.5">
            <p className="font-semibold text-white">Για Εικόνες (📷):</p>
            <p>1. Πατήστε το κουμπί εικόνας (📷)</p>
            <p>2. Επιλέξτε: <span className="font-semibold">OK</span> = ανέβασμα από υπολογιστή | <span className="font-semibold">Άκυρο</span> = εισαγωγή URL</p>
            <p>3. Η εικόνα θα εμφανιστεί αμέσως στο κείμενο!</p>
            <p className="text-blue-300 italic">• Οι εικόνες αποθηκεύονται στο Supabase Storage (φάκελος: articles/)</p>
            <p className="text-blue-300 italic">• Θα είναι ορατές στο δημοσιευμένο άρθρο στη σελίδα /article/[slug]</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-blue-300 border-t border-blue-400/30 pt-2">
          <span className="font-semibold">💡 Σημείωση:</span> Τα ενεργά κουμπιά έχουν <span className="font-bold text-white">μπλε χρώμα και φωτεινό περίγραμμα</span>
        </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-3 border border-white/20 bg-black/30 rounded-lg">
        {/* Invisible dummy button to prevent first button bug */}
        <button
          type="button"
          className="w-0 h-0 opacity-0 pointer-events-none absolute"
          onClick={() => {}}
          aria-hidden="true"
        />

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
            title="Επικεφαλίδα 1 (Μεγάλος Τίτλος) - Βάλτε κέρσορα σε κενή γραμμή και πατήστε"
          >
            <Heading1 size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Επικεφαλίδα 2 (Μεσαίος Τίτλος) - Βάλτε κέρσορα σε κενή γραμμή και πατήστε"
          >
            <Heading2 size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Επικεφαλίδα 3 (Μικρός Τίτλος) - Βάλτε κέρσορα σε κενή γραμμή και πατήστε"
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
            title="Λίστα με Κουκκίδες (• • •) - Πατήστε, γράψτε, Enter για νέο στοιχείο"
          >
            <List size={18} />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Αριθμημένη Λίστα (1. 2. 3.) - Πατήστε, γράψτε, Enter για νέο στοιχείο"
          >
            <ListOrdered size={18} />
          </MenuButton>
        </div>

        <div className="w-px bg-white/20" />

        {/* Media */}
        <div className="flex gap-1.5">
          <MenuButton
            onClick={addImage}
            disabled={uploading}
            title={uploading ? `Μεταφόρτωση${uploadCount > 1 ? ` (${uploadCount} εικόνες)` : '...'}` : "Εικόνα - Ανεβάστε ή προσθέστε εικόνα"}
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
});

// Validate TipTap JSON content structure
const isValidTipTapContent = (content: any): boolean => {
  if (!content || typeof content !== 'object') return false;
  if (content.type !== 'doc') return false;
  if (!Array.isArray(content.content)) return false;
  return true;
};

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  // Track if the update is coming from the editor itself (to avoid circular updates)
  const isInternalUpdate = React.useRef(false);
  const updateTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Debounced onChange to reduce parent re-renders during typing
  const debouncedOnChange = React.useCallback((json: any) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      isInternalUpdate.current = true;
      onChange(json);
      // Reset flag synchronously in next tick
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 0);
    }, 300); // 300ms debounce - adjust if needed
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg my-4',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Αρχίστε να γράφετε το άρθρο σας...',
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: isValidTipTapContent(content) ? content : undefined,
    onUpdate: ({ editor }) => {
      // Debounce the onChange call to reduce re-renders
      debouncedOnChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-invert max-w-none min-h-[300px] p-4 focus:outline-none bg-black/40 rounded-b-lg cursor-text',
        tabindex: '0',
      },
    },
    autofocus: false,
    // Ensure editor retains focus during interactions
    editable: true,
  });

  // Sync external content changes to the editor (e.g., when loading an article to edit)
  // Use useMemo to cache the current content JSON to avoid repeated serialization
  const currentContentRef = React.useRef<any>(null);

  React.useEffect(() => {
    // Don't sync if this is an internal update (user typing)
    if (!editor || isInternalUpdate.current || !content) {
      return;
    }

    // Don't update content if editor is currently focused (user is actively editing)
    if (editor.isFocused) {
      return;
    }

    // Only check if content reference changed (not deep equality)
    if (content !== currentContentRef.current) {
      currentContentRef.current = content;

      // Batch this update to avoid blocking the main thread
      requestAnimationFrame(() => {
        if (editor && !editor.isDestroyed && !editor.isFocused) {
          editor.commands.setContent(content, { emitUpdate: false });
        }
      });
    }
  }, [content, editor]);

  // Cleanup: Destroy editor instance and clear timeouts when component unmounts
  React.useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      editor?.destroy();
    };
  }, [editor]);

  return (
    <EditorErrorBoundary>
      <div className="space-y-3">
        <div className="border border-white/20 rounded-lg bg-black/50 backdrop-blur-sm shadow-lg">
          <MenuBar editor={editor} />
          <EditorContent editor={editor} />
        </div>

        {/* Visual Examples */}
        <details className="bg-emerald-600/10 border border-emerald-500/30 rounded-lg">
        <summary className="cursor-pointer p-3 font-semibold text-emerald-200 hover:bg-emerald-600/20 rounded-lg transition-colors">
          📚 Παραδείγματα Μορφοποίησης (πατήστε για να δείτε)
        </summary>
        <div className="p-4 space-y-3 text-sm text-white/90">
          <div className="space-y-2 border-b border-emerald-500/20 pb-3">
            <p className="font-semibold text-emerald-300">Επικεφαλίδες:</p>
            <h1 className="text-3xl font-bold">Επικεφαλίδα 1 - Πολύ Μεγάλη</h1>
            <h2 className="text-2xl font-bold">Επικεφαλίδα 2 - Μεσαία</h2>
            <h3 className="text-xl font-bold">Επικεφαλίδα 3 - Μικρή</h3>
          </div>

          <div className="space-y-2 border-b border-emerald-500/20 pb-3">
            <p className="font-semibold text-emerald-300">Μορφοποίηση Κειμένου:</p>
            <p><strong>Έντονο κείμενο</strong> (B)</p>
            <p><em>Πλάγιο κείμενο</em> (I)</p>
            <p><u>Υπογραμμισμένο κείμενο</u> (U)</p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold text-emerald-300">Λίστες:</p>
            <ul className="list-disc pl-6">
              <li>Πρώτο στοιχείο λίστας</li>
              <li>Δεύτερο στοιχείο</li>
              <li>Τρίτο στοιχείο</li>
            </ul>
            <ol className="list-decimal pl-6">
              <li>Πρώτο στοιχείο</li>
              <li>Δεύτερο στοιχείο</li>
              <li>Τρίτο στοιχείο</li>
            </ol>
          </div>
        </div>
      </details>
      </div>
    </EditorErrorBoundary>
  );
}
