"use client";

import { useState, useEffect } from "react";
import { showSuccess, showError, showLoading, dismissToast } from "@/lib/toast";

interface SendDeliveryListModalProps {
  onClose: () => void;
}

interface ExecutionLog {
  id: string;
  executedAt: string;
  status: string;
  dateRange?: string;
  deliveryCount?: number;
  errorMessage?: string;
}

interface Schedule {
  id: string;
  scheduleType: string;
  dateOption: string;
  specificDate?: string;
  customFrom?: string;
  customTo?: string;
  scheduledTime: string;
  isActive: boolean;
  sendDirectly: boolean;
  lastExecuted?: string;
  lastStatus?: string;
  lastError?: string;
  executionCount?: number;
  executionLogs?: ExecutionLog[];
}

export default function SendDeliveryListModal({ onClose }: SendDeliveryListModalProps) {
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [dateOption, setDateOption] = useState<"today" | "upcoming" | "specific" | "custom">("today");
  const [specificDate, setSpecificDate] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sendDirectly, setSendDirectly] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Schedule-specific states
  const [scheduleType, setScheduleType] = useState<"ONE_TIME" | "DAILY">("ONE_TIME");
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

  // Load existing schedules
  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    try {
      setLoadingSchedules(true);
      const response = await fetch("/api/deliveries/schedule");
      if (response.ok) {
        const data = await response.json();
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error("Error loading schedules:", error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleCreateSchedule = async () => {
    let loadingToast: string | undefined;
    try {
      setIsGenerating(true);
      loadingToast = showLoading("Creating schedule...");

      // Validation
      if (dateOption === "specific" && !specificDate) {
        if (loadingToast) dismissToast(loadingToast);
        showError("Please select a date");
        setIsGenerating(false);
        return;
      }
      if (dateOption === "custom" && (!customFrom || !customTo)) {
        if (loadingToast) dismissToast(loadingToast);
        showError("Please select both From and To dates");
        setIsGenerating(false);
        return;
      }
      if (dateOption === "custom" && new Date(customFrom) > new Date(customTo)) {
        if (loadingToast) dismissToast(loadingToast);
        showError("'From' date cannot be after 'To' date");
        setIsGenerating(false);
        return;
      }

      const scheduleData = {
        scheduleType,
        dateOption,
        specificDate: dateOption === "specific" ? specificDate : undefined,
        customFrom: dateOption === "custom" ? customFrom : undefined,
        customTo: dateOption === "custom" ? customTo : undefined,
        scheduledTime,
        sendDirectly,
      };

      const response = await fetch("/api/deliveries/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleData),
      });

      if (loadingToast) dismissToast(loadingToast);

      if (!response.ok) {
        throw new Error("Failed to create schedule");
      }

      showSuccess(`Schedule created successfully! Will run ${scheduleType === "DAILY" ? "daily" : "once"} at ${scheduledTime} UTC`);
      await loadSchedules();
    } catch (error: any) {
      if (loadingToast) dismissToast(loadingToast);
      console.error("Error creating schedule:", error);
      showError(error.message || "Failed to create schedule");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const response = await fetch(`/api/deliveries/schedule?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        showSuccess("Schedule deleted");
        await loadSchedules();
      } else {
        showError("Failed to delete schedule");
      }
    } catch (error) {
      console.error("Error deleting schedule:", error);
      showError("Failed to delete schedule");
    }
  };

  const handleToggleSchedule = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch("/api/deliveries/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !isActive }),
      });

      if (response.ok) {
        showSuccess(isActive ? "Schedule disabled" : "Schedule enabled");
        await loadSchedules();
      } else {
        showError("Failed to update schedule");
      }
    } catch (error) {
      console.error("Error toggling schedule:", error);
      showError("Failed to update schedule");
    }
  };

  const handleClearCompleted = async () => {
    try {
      const response = await fetch("/api/deliveries/schedule?clearCompleted=true", {
        method: "DELETE",
      });

      if (response.ok) {
        showSuccess("Completed schedules cleared");
        await loadSchedules();
      } else {
        showError("Failed to clear completed schedules");
      }
    } catch (error) {
      console.error("Error clearing completed:", error);
      showError("Failed to clear completed schedules");
    }
  };

  const handleGenerate = async () => {
    let loadingToast: string | undefined;
    try {
      setIsGenerating(true);
      loadingToast = showLoading("Sending delivery list email...");

      // Prepare date parameters based on selection
      let dateParams = {};
      const today = new Date().toISOString().split("T")[0];

      if (dateOption === "today") {
        dateParams = { date: today };
      } else if (dateOption === "upcoming") {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        dateParams = { fromDate: today, toDate: nextWeek.toISOString().split("T")[0] };
      } else if (dateOption === "specific") {
        if (!specificDate) {
          if (loadingToast) dismissToast(loadingToast);
          showError("Please select a date");
          setIsGenerating(false);
          return;
        }
        dateParams = { date: specificDate };
      } else if (dateOption === "custom") {
        if (!customFrom || !customTo) {
          if (loadingToast) dismissToast(loadingToast);
          showError("Please select both From and To dates");
          setIsGenerating(false);
          return;
        }
        if (new Date(customFrom) > new Date(customTo)) {
          if (loadingToast) dismissToast(loadingToast);
          showError("'From' date cannot be after 'To' date");
          setIsGenerating(false);
          return;
        }
        dateParams = { fromDate: customFrom, toDate: customTo };
      }

      // Call API to generate Excel and send email
      const params = new URLSearchParams(dateParams as any);
      params.append("sendDirectly", sendDirectly.toString());
      const response = await fetch(`/api/deliveries/export?${params}`, {
        method: "POST",
      });

      // Dismiss loading toast
      if (loadingToast) dismissToast(loadingToast);

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to send delivery list");
      }

      const result = await response.json();

      if (result.success) {
        showSuccess(sendDirectly ? `Email sent successfully! ${result.shotCount} shots included.` : `Email drafted successfully! ${result.shotCount} shots included.`);
        onClose();
      } else {
        showError(result.error || "Failed to send delivery list");
      }
    } catch (error: any) {
      // Dismiss loading toast on error
      if (loadingToast) dismissToast(loadingToast);
      console.error("Error sending delivery list:", error);
      showError(error.message || "Failed to send delivery list");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Send Delivery List</h2>

          {/* Send Mode Selection */}
          <div className="mb-4 flex gap-4 border-b pb-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="now"
                checked={sendMode === "now"}
                onChange={() => setSendMode("now")}
                className="w-4 h-4"
              />
              <span className="font-medium">Send Now</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                value="schedule"
                checked={sendMode === "schedule"}
                onChange={() => setSendMode("schedule")}
                className="w-4 h-4"
              />
              <span className="font-medium">Schedule</span>
            </label>
          </div>

          <div className="space-y-3">
            {/* Date Options */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateOption"
                value="today"
                checked={dateOption === "today"}
                onChange={(e) => setDateOption(e.target.value as any)}
                className="w-4 h-4"
              />
              <span>Today's Deliveries</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="dateOption"
                value="upcoming"
                checked={dateOption === "upcoming"}
                onChange={(e) => setDateOption(e.target.value as any)}
                className="w-4 h-4"
              />
              <span>Upcoming Deliveries (Next 7 days)</span>
            </label>

            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="radio"
                  name="dateOption"
                  value="specific"
                  checked={dateOption === "specific"}
                  onChange={(e) => setDateOption(e.target.value as any)}
                  className="w-4 h-4"
                />
                <span>Select Specific Date</span>
              </label>
              {dateOption === "specific" && (
                <input
                  type="date"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  className="ml-6 px-3 py-2 border rounded w-full max-w-xs"
                />
              )}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="radio"
                  name="dateOption"
                  value="custom"
                  checked={dateOption === "custom"}
                  onChange={(e) => setDateOption(e.target.value as any)}
                  className="w-4 h-4"
                />
                <span>Custom Date Range</span>
              </label>
              {dateOption === "custom" && (
                <div className="ml-6 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium w-16">From:</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-3 py-2 border rounded flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium w-16">To:</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-3 py-2 border rounded flex-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Schedule Options (only visible when sendMode is "schedule") */}
          {sendMode === "schedule" && (
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium w-20">Time (IST):</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="px-3 py-2 border rounded"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="ONE_TIME"
                    checked={scheduleType === "ONE_TIME"}
                    onChange={() => setScheduleType("ONE_TIME")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">One-time</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="DAILY"
                    checked={scheduleType === "DAILY"}
                    onChange={() => setScheduleType("DAILY")}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Daily recurring</span>
                </label>
              </div>
            </div>
          )}

          {/* Send Directly Checkbox */}
          <div className="mt-4 pt-4 border-t">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendDirectly}
                onChange={(e) => setSendDirectly(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Send directly (uncheck to draft)</span>
            </label>
          </div>

          {/* Active Schedules */}
          {schedules.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold">Schedules</h3>
                {schedules.some(s => !s.isActive && s.scheduleType === "ONE_TIME") && (
                  <button
                    onClick={handleClearCompleted}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Clear Completed
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`p-3 rounded border ${
                      schedule.isActive 
                        ? "bg-white border-gray-300" 
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {schedule.scheduleType === "DAILY" ? "🔄 Daily" : "📅 One-time"}
                          </span>
                          <span className="text-xs text-gray-600">
                            {schedule.dateOption} @ {schedule.scheduledTime} IST
                          </span>
                          {!schedule.isActive && (
                            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                              Completed
                            </span>
                          )}
                        </div>
                        
                        {/* Last execution status */}
                        {schedule.lastExecuted && (
                          <div className="mt-1 text-xs">
                            <span className="text-gray-500">Last run: </span>
                            <span className="text-gray-600">
                              {new Date(schedule.lastExecuted).toLocaleString()}
                            </span>
                            {schedule.lastStatus && (
                              <span className={`ml-2 px-1.5 py-0.5 rounded ${
                                schedule.lastStatus === "success" 
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {schedule.lastStatus === "success" ? "✓ Success" : "✗ Failed"}
                              </span>
                            )}
                            {schedule.executionCount && schedule.executionCount > 0 && (
                              <span className="ml-2 text-gray-500">
                                ({schedule.executionCount} total)
                              </span>
                            )}
                          </div>
                        )}
                        
                        {/* Last error */}
                        {schedule.lastError && (
                          <div className="mt-1 text-xs text-red-600">
                            Error: {schedule.lastError}
                          </div>
                        )}

                        {/* Recent execution logs */}
                        {schedule.executionLogs && schedule.executionLogs.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700">
                              View execution history ({schedule.executionLogs.length})
                            </summary>
                            <div className="mt-1 space-y-1 pl-2 border-l-2 border-gray-200">
                              {schedule.executionLogs.map((log) => (
                                <div key={log.id} className="text-xs py-1">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded ${
                                      log.status === "success"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}>
                                      {log.status}
                                    </span>
                                    <span className="text-gray-600">
                                      {new Date(log.executedAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {log.dateRange && (
                                    <div className="text-gray-500 mt-0.5">
                                      Range: {log.dateRange}
                                      {log.deliveryCount !== undefined && ` (${log.deliveryCount} deliveries)`}
                                    </div>
                                  )}
                                  {log.errorMessage && (
                                    <div className="text-red-600 mt-0.5">
                                      {log.errorMessage}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                      
                      <div className="flex gap-2 ml-2">
                        {schedule.isActive && (
                          <button
                            onClick={() => handleToggleSchedule(schedule.id, schedule.isActive)}
                            className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
                          >
                            Disable
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={sendMode === "now" ? handleGenerate : handleCreateSchedule}
              disabled={isGenerating}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isGenerating
                ? sendMode === "now"
                  ? (sendDirectly ? "Sending..." : "Drafting...")
                  : "Creating..."
                : sendMode === "now"
                ? (sendDirectly ? "Send Email" : "Draft Email")
                : "Create Schedule"
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
