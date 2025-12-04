'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Users, Briefcase, Clock, Sliders } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

interface SoftBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  booking?: any; // For editing existing booking
  prefilledData?: {
    showName?: string;
    managerName?: string;
  };
  isSimplified?: boolean; // For right-click booking (only show name and manager)
}

const DEPARTMENTS = ['Comp', 'Paint', 'Roto', 'MMRA', 'Match Move', 'Prep', 'Layout', 'Animation'];

export default function SoftBookingModal({
  isOpen,
  onClose,
  onSuccess,
  booking,
  prefilledData,
  isSimplified = false,
}: SoftBookingModalProps) {
  const [formData, setFormData] = useState({
    showName: '',
    managerName: '',
    department: 'Comp',
    manDays: 1,
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    splitEnabled: false,
    srPercentage: 34,
    midPercentage: 33,
    jrPercentage: 33,
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [shows, setShows] = useState<any[]>([]);
  const [showsLoading, setShowsLoading] = useState(false);

  // Fetch shows for dropdown
  useEffect(() => {
    const fetchShows = async () => {
      setShowsLoading(true);
      try {
        const res = await fetch('/api/shows');
        if (res.ok) {
          const data = await res.json();
          setShows(data);
        }
      } catch (error) {
        console.error('Error fetching shows:', error);
      }
      setShowsLoading(false);
    };
    if (isOpen) fetchShows();
  }, [isOpen]);

  // Initialize form data
  useEffect(() => {
    if (booking) {
      setFormData({
        showName: booking.showName || '',
        managerName: booking.managerName || '',
        department: booking.department || 'Comp',
        manDays: booking.manDays || 1,
        startDate: booking.startDate ? format(new Date(booking.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        endDate: booking.endDate ? format(new Date(booking.endDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        splitEnabled: booking.splitEnabled || false,
        srPercentage: booking.srPercentage || 34,
        midPercentage: booking.midPercentage || 33,
        jrPercentage: booking.jrPercentage || 33,
        notes: booking.notes || '',
      });
    } else if (prefilledData) {
      setFormData(prev => ({
        ...prev,
        showName: prefilledData.showName || '',
        managerName: prefilledData.managerName || '',
      }));
    }
  }, [booking, prefilledData]);

  // Auto-adjust percentages to total 100%
  const handlePercentageChange = (field: 'srPercentage' | 'midPercentage' | 'jrPercentage', value: number) => {
    const newValue = Math.min(100, Math.max(0, value));
    const otherFields = ['srPercentage', 'midPercentage', 'jrPercentage'].filter(f => f !== field) as Array<'srPercentage' | 'midPercentage' | 'jrPercentage'>;
    
    const remaining = 100 - newValue;
    const currentOtherTotal = formData[otherFields[0]] + formData[otherFields[1]];
    
    if (currentOtherTotal === 0) {
      setFormData(prev => ({
        ...prev,
        [field]: newValue,
        [otherFields[0]]: remaining / 2,
        [otherFields[1]]: remaining / 2,
      }));
    } else {
      const ratio0 = formData[otherFields[0]] / currentOtherTotal;
      const ratio1 = formData[otherFields[1]] / currentOtherTotal;
      setFormData(prev => ({
        ...prev,
        [field]: newValue,
        [otherFields[0]]: Math.round(remaining * ratio0),
        [otherFields[1]]: Math.round(remaining * ratio1),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = booking
        ? `/api/resource/soft-bookings/${booking.id}`
        : '/api/resource/soft-bookings';
      
      const method = booking ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save booking');
      }

      toast.success(booking ? 'Booking updated successfully!' : 'Booking created successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save booking');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalPercentage = formData.srPercentage + formData.midPercentage + formData.jrPercentage;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {booking ? 'Edit Booking' : isSimplified ? 'Quick Book' : 'New Soft Booking'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Show Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Briefcase className="w-4 h-4 inline mr-2" />
              Show Name
            </label>
            <select
              value={formData.showName}
              onChange={(e) => setFormData({ ...formData, showName: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            >
              <option value="">Select a show</option>
              {shows.map((show) => (
                <option key={show.id} value={show.showName}>{show.showName}</option>
              ))}
            </select>
          </div>

          {/* Manager Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Users className="w-4 h-4 inline mr-2" />
              Manager Name
            </label>
            <input
              type="text"
              value={formData.managerName}
              onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
              placeholder="Enter manager name"
              className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              required
            />
          </div>

          {/* Simplified mode stops here */}
          {!isSimplified && (
            <>
              {/* Department */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Department
                </label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* Mandays */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Man Days
                </label>
                <input
                  type="number"
                  min="0.25"
                  step="0.25"
                  value={formData.manDays}
                  onChange={(e) => setFormData({ ...formData, manDays: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>

              {/* Split Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.splitEnabled}
                    onChange={(e) => setFormData({ ...formData, splitEnabled: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-600 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
                  />
                  <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    Split by Designation
                  </span>
                </label>
              </div>

              {/* Designation Sliders */}
              {formData.splitEnabled && (
                <div className="bg-slate-900/50 rounded-lg p-4 space-y-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">Designation Split</span>
                    <span className={`text-sm font-medium ${totalPercentage === 100 ? 'text-green-400' : 'text-red-400'}`}>
                      Total: {totalPercentage}%
                    </span>
                  </div>

                  {/* SR Slider */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-cyan-400 font-medium">SR (Senior)</span>
                      <span className="text-white">{formData.srPercentage}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.srPercentage}
                      onChange={(e) => handlePercentageChange('srPercentage', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                  </div>

                  {/* MID Slider */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-amber-400 font-medium">MID (Mid-Level)</span>
                      <span className="text-white">{formData.midPercentage}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.midPercentage}
                      onChange={(e) => handlePercentageChange('midPercentage', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  {/* JR Slider */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-emerald-400 font-medium">JR (Junior)</span>
                      <span className="text-white">{formData.jrPercentage}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.jrPercentage}
                      onChange={(e) => handlePercentageChange('jrPercentage', parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>

                  {/* Visual breakdown */}
                  <div className="h-4 rounded-full overflow-hidden flex mt-3">
                    <div 
                      className="bg-cyan-500 transition-all duration-200" 
                      style={{ width: `${formData.srPercentage}%` }}
                      title={`SR: ${formData.srPercentage}%`}
                    />
                    <div 
                      className="bg-amber-500 transition-all duration-200" 
                      style={{ width: `${formData.midPercentage}%` }}
                      title={`MID: ${formData.midPercentage}%`}
                    />
                    <div 
                      className="bg-emerald-500 transition-all duration-200" 
                      style={{ width: `${formData.jrPercentage}%` }}
                      title={`JR: ${formData.jrPercentage}%`}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />
              </div>
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (formData.splitEnabled && totalPercentage !== 100)}
            className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4" />
                {booking ? 'Update Booking' : 'Create Booking'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
