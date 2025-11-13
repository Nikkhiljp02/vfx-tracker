'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface UserOption {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export default function MentionInput({
  value,
  onChange,
  onSend,
  placeholder = 'Type @ to mention users or departments...',
  disabled = false,
  className = '',
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<UserOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch all users for autocomplete
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursor = e.target.selectionStart;
    
    onChange(newValue);
    setCursorPosition(cursor);
    
    // Check if @ was just typed
    const textBeforeCursor = newValue.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const searchAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Check if we're still in a mention (no space after @)
      if (!searchAfterAt.includes(' ')) {
        setMentionSearch(searchAfterAt);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }
    
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredSuggestions[selectedIndex]) {
          insertMention(filteredSuggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const insertMention = (user: UserOption) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const mentionText = `@${user.username}`;
    const newValue = 
      textBeforeCursor.slice(0, lastAtIndex) +
      mentionText +
      ' ' +
      textAfterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);
    
    // Set cursor after the mention
    setTimeout(() => {
      const newCursor = lastAtIndex + mentionText.length + 1;
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
      textareaRef.current?.focus();
    }, 0);
  };

  // Filter suggestions based on search
  const filteredSuggestions = suggestions.filter((user) => {
    const searchLower = mentionSearch.toLowerCase();
    return (
      user.username.toLowerCase().startsWith(searchLower) ||
      user.firstName.toLowerCase().startsWith(searchLower) ||
      user.lastName.toLowerCase().startsWith(searchLower) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().startsWith(searchLower)
    );
  }).slice(0, 10); // Limit to 10 suggestions

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-transparent resize-none ${className}`}
        rows={1}
        style={{ minHeight: '32px', maxHeight: '120px' }}
      />
      
      {/* Mention Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto z-50"
        >
          {filteredSuggestions.map((user, index) => (
            <button
              key={user.id}
              onClick={() => insertMention(user)}
              className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-900">
                @{user.username}
              </div>
              <div className="text-xs text-gray-500">
                {user.firstName} {user.lastName}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
