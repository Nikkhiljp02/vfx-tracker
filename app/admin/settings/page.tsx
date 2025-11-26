"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Settings,
  ChevronLeft,
  Mail,
  Database,
  Key,
  Shield,
  Bell,
  Save,
  TestTube,
  CheckCircle,
  XCircle,
  Sheet,
  ExternalLink,
  Copy,
} from "lucide-react";

export default function SystemSettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<"email" | "database" | "notifications" | "security" | "googlesheets">("email");
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
  });

  const [googleSheetsSettings, setGoogleSheetsSettings] = useState({
    spreadsheetId: "",
  });
  const [googleSheetsSaved, setGoogleSheetsSaved] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user as any;
      if (user?.role !== "ADMIN") {
        router.push("/");
        return;
      }
      loadSettings();
    }
  }, [status, session, router]);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        if (data.email) {
          setEmailSettings({
            smtpHost: data.email.host || "",
            smtpPort: data.email.port || "587",
            smtpUser: data.email.user || "",
            smtpPass: "",  // Never load actual password
            smtpFrom: data.email.from || "",
          });
        }
      }

      // Load Google Sheets settings
      const gsResponse = await fetch("/api/admin/settings/google-sheets");
      if (gsResponse.ok) {
        const gsData = await gsResponse.json();
        setGoogleSheetsSettings({
          spreadsheetId: gsData.spreadsheetId || "",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSaveEmail = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/settings/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailSettings),
      });

      if (response.ok) {
        alert("Email settings saved successfully!");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailSettings),
      });

      const result = await response.json();
      setTestResult({
        success: response.ok,
        message: result.message || (response.ok ? "Test email sent successfully!" : "Test failed"),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to send test email",
      });
    }
  };

  const handleSaveGoogleSheets = async () => {
    setSaving(true);
    setGoogleSheetsSaved(false);
    try {
      const response = await fetch("/api/admin/settings/google-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(googleSheetsSettings),
      });

      if (response.ok) {
        setGoogleSheetsSaved(true);
        setTimeout(() => setGoogleSheetsSaved(false), 3000);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving Google Sheets settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const extractSpreadsheetId = (input: string): string => {
    // If it's a full URL, extract the ID
    const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) return urlMatch[1];
    // Otherwise, assume it's already an ID
    return input.trim();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <Settings className="w-8 h-8 mr-3" />
                  System Settings
                </h1>
                <p className="text-gray-600 mt-1">Configure system-wide settings</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab("email")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "email"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Email Settings
              </button>
              <button
                onClick={() => setActiveTab("database")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "database"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Database className="w-4 h-4 inline mr-2" />
                Database
              </button>
              <button
                onClick={() => setActiveTab("notifications")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "notifications"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Bell className="w-4 h-4 inline mr-2" />
                Notifications
              </button>
              <button
                onClick={() => setActiveTab("security")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "security"
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Security
              </button>
              <button
                onClick={() => setActiveTab("googlesheets")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "googlesheets"
                    ? "border-b-2 border-green-500 text-green-600"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Sheet className="w-4 h-4 inline mr-2" />
                Google Sheets
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Email Settings Tab */}
            {activeTab === "email" && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">SMTP Configuration</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={emailSettings.smtpHost}
                        onChange={(e) =>
                          setEmailSettings({ ...emailSettings, smtpHost: e.target.value })
                        }
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="text"
                        value={emailSettings.smtpPort}
                        onChange={(e) =>
                          setEmailSettings({ ...emailSettings, smtpPort: e.target.value })
                        }
                        placeholder="587"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Username/Email
                    </label>
                    <input
                      type="text"
                      value={emailSettings.smtpUser}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpUser: e.target.value })
                      }
                      placeholder="your-email@gmail.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Password
                    </label>
                    <input
                      type="password"
                      value={emailSettings.smtpPass}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpPass: e.target.value })
                      }
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      For Gmail, use an App Password. Leave blank to keep current password.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      From Email Address
                    </label>
                    <input
                      type="email"
                      value={emailSettings.smtpFrom}
                      onChange={(e) =>
                        setEmailSettings({ ...emailSettings, smtpFrom: e.target.value })
                      }
                      placeholder="VFX Tracker <noreply@vfxtracker.com>"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {testResult && (
                    <div
                      className={`p-4 rounded-lg flex items-start space-x-3 ${
                        testResult.success
                          ? "bg-green-50 border border-green-200"
                          : "bg-red-50 border border-red-200"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <p
                        className={`text-sm ${
                          testResult.success ? "text-green-800" : "text-red-800"
                        }`}
                      >
                        {testResult.message}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-3 pt-4">
                    <button
                      onClick={handleTestEmail}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition flex items-center space-x-2"
                    >
                      <TestTube className="w-4 h-4" />
                      <span>Test Connection</span>
                    </button>
                    <button
                      onClick={handleSaveEmail}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? "Saving..." : "Save Settings"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Database Tab */}
            {activeTab === "database" && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Database Information</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Database Type:</span>
                    <span className="text-sm font-medium text-gray-900">PostgreSQL</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Connection Status:</span>
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Provider:</span>
                    <span className="text-sm font-medium text-gray-900">Supabase</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Database connection is configured via environment variables. Contact your system administrator to modify database settings.
                </p>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === "notifications" && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Shot Updates</div>
                      <div className="text-xs text-gray-500">Notify users when shots are updated</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-medium text-gray-900">@Mentions</div>
                      <div className="text-xs text-gray-500">Notify users when mentioned in comments</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">Delivery Reminders</div>
                      <div className="text-xs text-gray-500">Email reminders for upcoming deliveries</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h3>
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-green-900">Security Features Enabled</div>
                        <ul className="text-sm text-green-800 mt-2 space-y-1">
                          <li>✓ Password hashing with bcrypt</li>
                          <li>✓ JWT session tokens</li>
                          <li>✓ Role-based access control</li>
                          <li>✓ HTTPS encryption</li>
                          <li>✓ SQL injection protection (Prisma ORM)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Additional security features like 2FA, SSO, and IP whitelisting can be implemented based on requirements.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Google Sheets Tab */}
            {activeTab === "googlesheets" && (
              <div className="max-w-2xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Google Sheets Integration</h3>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-green-900 mb-2">How it works:</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>1. Create a Google Sheet manually in your Google Drive</li>
                    <li>2. Share it with your service account or make it editable</li>
                    <li>3. Paste the Sheet ID or URL below</li>
                    <li>4. Use "Sync to Sheets" to push data, "Update from Sheets" to pull changes</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Google Sheet ID or URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={googleSheetsSettings.spreadsheetId}
                        onChange={(e) => {
                          const extracted = extractSpreadsheetId(e.target.value);
                          setGoogleSheetsSettings({ spreadsheetId: extracted });
                        }}
                        placeholder="Paste Sheet URL or ID (e.g., 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms)"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      {googleSheetsSettings.spreadsheetId && (
                        <button
                          onClick={() => copyToClipboard(googleSheetsSettings.spreadsheetId)}
                          className="px-3 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                          title="Copy ID"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      You can paste either the full Google Sheets URL or just the spreadsheet ID
                    </p>
                  </div>

                  {googleSheetsSettings.spreadsheetId && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-700">Linked Spreadsheet</div>
                          <div className="text-xs text-gray-500 mt-1 font-mono">
                            ID: {googleSheetsSettings.spreadsheetId}
                          </div>
                        </div>
                        <a
                          href={`https://docs.google.com/spreadsheets/d/${googleSheetsSettings.spreadsheetId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700"
                        >
                          Open Sheet <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  )}

                  {googleSheetsSaved && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-green-800">Settings saved successfully!</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-3 pt-4">
                    <button
                      onClick={handleSaveGoogleSheets}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? "Saving..." : "Save Settings"}</span>
                    </button>
                    {googleSheetsSettings.spreadsheetId && (
                      <button
                        onClick={() => setGoogleSheetsSettings({ spreadsheetId: "" })}
                        className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-8 border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Important Notes:</h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li>• <strong>Sync to Sheets:</strong> Overwrites the Google Sheet with current tracker data</li>
                    <li>• <strong>Update from Sheets:</strong> Reads changes from the Google Sheet and applies them to the tracker</li>
                    <li>• The Sheet must have proper column headers (created automatically on first sync)</li>
                    <li>• Make sure your Google account has edit access to the sheet</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
