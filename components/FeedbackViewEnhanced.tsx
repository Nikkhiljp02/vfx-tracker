'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Download, Upload, Search, X, Filter, Plus, Trash2, Edit2, Save, Calendar, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { showSuccess, showError, showLoading, dismissToast } from '@/lib/toast';
import { useVFXStore } from '@/lib/store';
import { matchesShotName } from '@/lib/searchUtils';
import { formatDisplayDate } from '@/lib/utils';

interface Feedback {
  id: string;
  showName: string;
  shotName: string;
  shotTag: string;
  version: string;
  department: string;
  leadName: string | null;
  status: string;
  feedbackNotes: string | null;
  feedbackDate: Date;
  taskId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FeedbackViewProps {
  prefilledData?: {
    showName?: string;
    shotName?: string;
    shotTag?: string;
    version?: string;
    department?: string;
    status?: string;
    taskId?: string;
  };
  onClose?: () => void;
}

export default function FeedbackView({ prefilledData, onClose }: FeedbackViewProps = {}) {
  const { shows } = useVFXStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<Feedback>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Get all shots and shows from store
  const allShots = useMemo(() => {
    return shows.flatMap(show => 
      (show.shots || []).map(shot => ({
        shotName: shot.shotName,
        showName: show.showName,
        shotTag: shot.shotTag,
      }))
    );
  }, [shows]);

  const allShowNames = useMemo(() => {
    return Array.from(new Set(shows.map(s => s.showName))).sort();
  }, [shows]);

  const [newFeedback, setNewFeedback] = useState({
    showName: prefilledData?.showName || '',
    shotName: prefilledData?.shotName || '',
    shotTag: prefilledData?.shotTag || 'Fresh',
    version: prefilledData?.version || '',
    department: prefilledData?.department || '',
    status: prefilledData?.status || 'C KB',
    feedbackNotes: '',
    feedbackDate: new Date().toISOString().split('T')[0],
    taskId: prefilledData?.taskId || '',
  });

  // Autocomplete states
  const [showDropdown, setShowDropdown] = useState(false);
  const [shotDropdown, setShotDropdown] = useState(false);
  const [filteredShows, setFilteredShows] = useState<string[]>([]);
  const [filteredShots, setFilteredShots] = useState<typeof allShots>([]);

  // Filters
  const [selectedShows, setSelectedShows] = useState<string[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Load feedbacks only once on mount
  useEffect(() => {
    if (initial