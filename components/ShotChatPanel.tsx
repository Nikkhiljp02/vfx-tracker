'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, Loader2, Trash2, Edit2 } from 'lucide-react';
import { ShotNote, Mention } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

interface ShotChatPanelProps {
  shotId: string;
  shotName: string;
  onClose: () => void;
  onNotesChange?: () => void; // Callback when notes are added/deleted
}

export default function ShotChatPanel({ shotId, shotName, onClose, onNotesChange }: ShotChatPanelProps) {
  const [notes, setNotes] = useState<ShotNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotes();
  }, [shotId]);

  useEffect(() => {
    // Auto-scroll to bottom when new notes arrive
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [notes]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/shot-notes?shotId=${shotId}`);
      const data = await res.json();
      setNotes(data);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const parseMentions = (content: string): Mention[] => {
    const mentions: Mention[] = [];
    const regex = /@(\w+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      // Check if it's a department (all uppercase) or user
      const type = name === name.toUpperCase() ? 'dept' : 'user';
      mentions.push({ type, name });
    }

    return mentions;
  };

  const handleSendNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSending(true);
      const mentions = parseMentions(newNote);

      const res = await fetch('/api/shot-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shotId,
          content: newNote,
          mentions: mentions.length > 0 ? mentions : null,
          userName: 'User', // TODO: Replace with actual user when auth is added
        }),
      });

      if (res.ok) {
        const createdNote = await res.json();
        setNotes([createdNote, ...notes]);
        setNewNote('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        // Notify parent component
        if (onNotesChange) onNotesChange();
      }
    } catch (error) {
      console.error('Failed to send note:', error);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;

    try {
      const res = await fetch(`/api/shot-notes/${noteId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setNotes(notes.filter(n => n.id !== noteId));
        // Notify parent component
        if (onNotesChange) onNotesChange();
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleClearAllNotes = async () => {
    if (!confirm(`Delete all ${notes.length} note(s) for this shot? This cannot be undone.`)) return;

    try {
      console.log('Starting to delete', notes.length, 'notes');
      
      // Delete all notes sequentially and wait for completion
      const deletePromises = notes.map(note => {
        console.log('Deleting note:', note.id);
        return fetch(`/api/shot-notes/${note.id}`, { method: 'DELETE' })
          .then(res => {
            console.log('Delete response for', note.id, ':', res.status, res.ok);
            if (!res.ok) {
              throw new Error(`Failed to delete note ${note.id}`);
            }
            return res.json();
          })
          .then(data => {
            console.log('Delete result:', data);
            return data;
          });
      });
      
      const results = await Promise.all(deletePromises);
      console.log('All deletes completed:', results);
      
      // Clear the local state after all deletes are successful
      setNotes([]);
      
      // Notify parent component to refresh indicators
      if (onNotesChange) onNotesChange();
      
      console.log('Clear all notes completed successfully');
    } catch (error) {
      console.error('Failed to clear all notes:', error);
      alert('Failed to delete some notes. Please try again.');
      // Refresh to get current state
      fetchNotes();
    }
  };

  const handleStartEdit = (note: ShotNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return;

    try {
      const mentions = parseMentions(editContent);

      const res = await fetch(`/api/shot-notes/${noteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editContent,
          mentions: mentions.length > 0 ? mentions : null,
        }),
      });

      if (res.ok) {
        const updatedNote = await res.json();
        setNotes(notes.map(n => n.id === noteId ? updatedNote : n));
        setEditingId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendNote();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewNote(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const renderContent = (content: string, mentions: Mention[] | null) => {
    if (!mentions || mentions.length === 0) {
      return <span>{content}</span>;
    }

    // Highlight mentions in the content
    let result = content;
    mentions.forEach(mention => {
      const mentionText = `@${mention.name}`;
      const color = mention.type === 'dept' ? 'text-blue-600 font-semibold' : 'text-purple-600 font-semibold';
      result = result.replace(
        mentionText,
        `<span class="${color}">${mentionText}</span>`
      );
    });

    return <span dangerouslySetInnerHTML={{ __html: result }} />;
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-50 animate-slideIn">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">Shot Notes</h3>
            <p className="text-sm text-gray-600">{shotName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        {notes.length > 0 && (
          <button
            onClick={handleClearAllNotes}
            className="w-full mt-2 px-3 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded border border-red-200 transition-colors flex items-center justify-center gap-1"
          >
            <Trash2 size={12} />
            Clear All Notes ({notes.length})
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-gray-700">
        <p>💡 Use <strong>@PAINT</strong>, <strong>@COMP</strong>, etc. to tag departments</p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-gray-400" size={32} />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
            <p className="text-sm">No notes yet</p>
            <p className="text-xs mt-1">Start a conversation about this shot</p>
          </div>
        ) : (
          <>
            {notes.map(note => (
              <div key={note.id} className="group">
                <div className="flex items-start gap-2">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {note.userName.charAt(0).toUpperCase()}
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-900">{note.userName}</span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(note.createdDate), { addSuffix: true })}
                      </span>
                      {note.isEdited && (
                        <span className="text-xs text-gray-400 italic">(edited)</span>
                      )}
                    </div>

                    {editingId === note.id ? (
                      <div className="mt-1">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleSaveEdit(note.id)}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditContent('');
                            }}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-gray-700 break-words">
                        {renderContent(note.content, note.mentions)}
                      </div>
                    )}

                    {/* Department Mentions Badge */}
                    {note.mentions && note.mentions.some(m => m.type === 'dept') && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {note.mentions
                          .filter(m => m.type === 'dept')
                          .map((mention, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full border border-blue-200"
                            >
                              {mention.name}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => handleStartEdit(note)}
                      className="p-1 hover:bg-gray-200 rounded"
                      title="Edit"
                    >
                      <Edit2 size={14} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 hover:bg-red-100 rounded"
                      title="Delete"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={newNote}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Add a note... (@PAINT, @COMP, etc.)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            rows={1}
            style={{ maxHeight: '120px' }}
            disabled={sending}
          />
          <button
            onClick={handleSendNote}
            disabled={!newNote.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {sending ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
