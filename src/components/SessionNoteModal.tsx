import { useState } from 'react';
import { MessageSquare, X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  sessionId: string;
  currentNote: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function SessionNoteModal({ sessionId, currentNote, onClose, onSaved }: Props) {
  const [note, setNote] = useState(currentNote || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('charging_sessions')
        .update({ notes: note.trim() || null })
        .eq('id', sessionId);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err: any) {
      alert('Failed to save note: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-500" /> Session Note
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note about this session (e.g. meter dispute, hardware issue, anomaly explanation)..."
          rows={5}
          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}
