import { useState, useEffect } from "react";
import { useSearchParams } from "react-router";
import { updateProfile, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { User, Building2, Bell, Lock, Trash2, Save, ChevronRight, Mail } from "lucide-react";
import Button from "../components/Button";
import Card from "../components/Card";
import { apiErrorMessage, readResponseJson } from "../../lib/apiResponse";

const TABS = ["Profile", "Business", "Integrations", "Notifications", "Security", "Danger Zone"];

const TAB_ICONS: Record<string, any> = {
  Profile: User,
  Business: Building2,
  Integrations: Mail,
  Notifications: Bell,
  Security: Lock,
  "Danger Zone": Trash2,
};

export default function Settings() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("Profile");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [gmailBusy, setGmailBusy] = useState(false);

  // Profile
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  // Business
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxId, setTaxId] = useState("");

  // Notifications
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [overdueAlerts, setOverdueAlerts] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);
  const [goalReminders, setGoalReminders] = useState(true);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Danger zone
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setPhone(data.phone || "");
        setLocation(data.location || "");
        setBio(data.bio || "");
        setWebsite(data.website || "");
        setBusinessName(data.businessName || "");
        setBusinessType(data.businessType || "");
        setIndustry(data.industry || "");
        setBusinessEmail(data.businessEmail || "");
        setBusinessPhone(data.businessPhone || "");
        setBusinessAddress(data.businessAddress || "");
        setCurrency(data.currency || "USD");
        setTaxId(data.taxId || "");
        setEmailNotifs(data.emailNotifs ?? true);
        setOverdueAlerts(data.overdueAlerts ?? true);
        setWeeklyReport(data.weeklyReport ?? false);
        setGoalReminders(data.goalReminders ?? true);
        setGmailConnected(Boolean(data.gmailConnected));
        setGmailEmail((data.gmailEmail as string) || null);
      }
    };
    load();
  }, [user]);

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    const gmail = searchParams.get("gmail");
    if (tab === "integrations") setActiveTab("Integrations");
    if (gmail === "connected") showMessage("Gmail connected. You can send invoices from your address.", "success");
    if (gmail === "error") showMessage("Could not connect Gmail. Check Google Cloud OAuth client, redirect URI, and server env vars.", "error");
    if (tab || gmail) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser!, { displayName });
      await setDoc(doc(db, "users", user.uid), {
        displayName, phone, location, bio, website,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      showMessage("Profile saved successfully.", "success");
    } catch (err: any) {
      showMessage(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveBusiness = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        businessName, businessType, industry, businessEmail,
        businessPhone, businessAddress, currency, taxId,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      showMessage("Business info saved.", "success");
    } catch (err: any) {
      showMessage(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveNotifications = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        emailNotifs, overdueAlerts, weeklyReport, goalReminders,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      showMessage("Notification preferences saved.", "success");
    } catch (err: any) {
      showMessage(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!user || !user.email) return;
    if (newPassword !== confirmNewPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }
    if (newPassword.length < 6) {
      showMessage("Password must be at least 6 characters.", "error");
      return;
    }
    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser!, credential);
      await updatePassword(auth.currentUser!, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      showMessage("Password changed successfully.", "success");
    } catch (err: any) {
      showMessage("Current password is incorrect.", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!user || deleteConfirm !== "DELETE") return;
    try {
      await deleteUser(auth.currentUser!);
      await logout();
    } catch (err: any) {
      showMessage("Please log out and log back in before deleting your account.", "error");
    }
  };

  const initials = (displayName || user?.email || "U").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? "bg-[#10B981]" : "bg-gray-200"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>Settings & Profile</h1>
        <p className="text-gray-600">Manage your account, business info and preferences</p>
      </div>

      {message.text && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar Tabs */}
        <div className="w-56 flex-shrink-0">
          <Card>
            <div className="space-y-1">
              {TABS.map((tab) => {
                const Icon = TAB_ICONS[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-[#0F1B2D] text-white" : "text-gray-600 hover:bg-gray-50"} ${tab === "Danger Zone" ? activeTab === tab ? "" : "text-red-500 hover:bg-red-50" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {tab}
                    </div>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Profile Tab */}
          {activeTab === "Profile" && (
            <Card>
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: "#10B981" }}>
                  {initials}
                </div>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: "#0F1B2D" }}>{displayName || user?.email}</h2>
                  <p className="text-sm text-gray-500">{user?.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Member since {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Display Name</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your full name" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
                  <input type="email" value={user?.email || ""} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-400" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 234 567 8900" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Website</label>
                  <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Bio</label>
                  <input type="text" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="One line about yourself" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
              </div>
              <div className="mt-6">
                <Button variant="primary" onClick={saveProfile} disabled={saving} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </Card>
          )}

          {/* Business Tab */}
          {activeTab === "Business" && (
            <Card>
              <h2 className="font-bold text-lg mb-6" style={{ color: "#0F1B2D" }}>Business Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Business Name</label>
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Your Business Ltd" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Business Type</label>
                  <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                    <option value="">Select type...</option>
                    <option>Sole Proprietor</option>
                    <option>LLC</option>
                    <option>Corporation</option>
                    <option>Partnership</option>
                    <option>Freelancer</option>
                    <option>Non-profit</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Industry</label>
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                    <option value="">Select industry...</option>
                    <option>Design & Creative</option>
                    <option>Technology</option>
                    <option>Marketing & Advertising</option>
                    <option>Consulting</option>
                    <option>Finance</option>
                    <option>Legal</option>
                    <option>Education</option>
                    <option>Health & Wellness</option>
                    <option>E-commerce</option>
                    <option>Media & Entertainment</option>
                    <option>Real Estate</option>
                    <option>Construction</option>
                    <option>Manufacturing</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Default Currency</label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                    {["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "GHS", "KES", "ZAR"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Business Email</label>
                  <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="hello@yourbusiness.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Business Phone</label>
                  <input type="text" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="+1 234 567 8900" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 block mb-1">Business Address</label>
                  <input type="text" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="123 Main St, City, Country" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Tax ID / RC Number</label>
                  <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
              </div>
              <div className="mt-6">
                <Button variant="primary" onClick={saveBusiness} disabled={saving} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Business Info"}
                </Button>
              </div>
            </Card>
          )}

          {activeTab === "Integrations" && (
            <Card>
              <h2 className="font-bold text-lg mb-2" style={{ color: "#0F1B2D" }}>Integrations</h2>
              <p className="text-sm text-gray-500 mb-6">Connect external services to send invoices and more.</p>

              <div className="border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                    <Mail className="w-5 h-5 text-gray-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold" style={{ color: "#0F1B2D" }}>Gmail</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Send invoices from your own Gmail address using Google&apos;s secure sign-in.
                    </p>
                    {gmailConnected && gmailEmail && (
                      <p className="text-sm text-green-700 mt-2 font-medium">Connected as {gmailEmail}</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {!gmailConnected ? (
                    <Button
                      variant="primary"
                      disabled={gmailBusy}
                      onClick={async () => {
                        if (!user) return;
                        setGmailBusy(true);
                        try {
                          const idToken = await auth.currentUser?.getIdToken();
                          if (!idToken) {
                            showMessage("Please sign in again.", "error");
                            return;
                          }
                          const resp = await fetch("/api/gmail-oauth-start", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ idToken }),
                          });
                          const { data: json, raw } = await readResponseJson<{ url?: string; error?: string }>(resp);
                          if (!resp.ok || !json?.url) {
                            showMessage(
                              apiErrorMessage(json, raw, "Could not start Gmail connection."),
                              "error"
                            );
                            return;
                          }
                          window.location.href = json.url;
                        } catch (e: any) {
                          showMessage(e?.message || "Connection failed.", "error");
                        } finally {
                          setGmailBusy(false);
                        }
                      }}
                      className="flex items-center gap-2"
                    >
                      {gmailBusy ? "Redirecting..." : "Connect Gmail"}
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      disabled={gmailBusy}
                      onClick={async () => {
                        if (!user) return;
                        if (!window.confirm("Disconnect Gmail? Invoice sends will use the app relay until you connect again.")) return;
                        setGmailBusy(true);
                        try {
                          const idToken = await auth.currentUser?.getIdToken();
                          if (!idToken) {
                            showMessage("Please sign in again.", "error");
                            return;
                          }
                          const resp = await fetch("/api/gmail-disconnect", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ idToken }),
                          });
                          const { data: json, raw } = await readResponseJson<{ error?: string }>(resp);
                          if (!resp.ok) {
                            showMessage(apiErrorMessage(json, raw, "Could not disconnect."), "error");
                            return;
                          }
                          setGmailConnected(false);
                          setGmailEmail(null);
                          showMessage("Gmail disconnected.", "success");
                        } catch (e: any) {
                          showMessage(e?.message || "Disconnect failed.", "error");
                        } finally {
                          setGmailBusy(false);
                        }
                      }}
                      className="flex items-center gap-2 bg-gray-700 hover:bg-gray-800"
                    >
                      {gmailBusy ? "Working..." : "Disconnect Gmail"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === "Notifications" && (
            <Card>
              <h2 className="font-bold text-lg mb-6" style={{ color: "#0F1B2D" }}>Notification Preferences</h2>
              <div className="space-y-5">
                {[
                  { label: "Email Notifications", desc: "Receive general updates via email", value: emailNotifs, onChange: () => setEmailNotifs(!emailNotifs) },
                  { label: "Overdue Payment Alerts", desc: "Get alerted when a payment is overdue", value: overdueAlerts, onChange: () => setOverdueAlerts(!overdueAlerts) },
                  { label: "Weekly Summary Report", desc: "Receive a weekly business summary every Monday", value: weeklyReport, onChange: () => setWeeklyReport(!weeklyReport) },
                  { label: "Goal Reminders", desc: "Get reminders about upcoming goal deadlines", value: goalReminders, onChange: () => setGoalReminders(!goalReminders) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#0F1B2D" }}>{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <Toggle value={item.value} onChange={item.onChange} />
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Button variant="primary" onClick={saveNotifications} disabled={saving} className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === "Security" && (
            <Card>
              <h2 className="font-bold text-lg mb-6" style={{ color: "#0F1B2D" }}>Change Password</h2>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">New Password</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Confirm New Password</label>
                  <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
                </div>
                <Button variant="primary" onClick={changePassword} disabled={saving} className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  {saving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </Card>
          )}

          {/* Danger Zone Tab */}
          {activeTab === "Danger Zone" && (
            <Card>
              <h2 className="font-bold text-lg mb-2 text-red-600">Danger Zone</h2>
              <p className="text-sm text-gray-500 mb-6">These actions are permanent and cannot be undone.</p>
              <div className="border border-red-200 rounded-xl p-6 bg-red-50">
                <h3 className="font-semibold text-red-700 mb-2">Delete Account</h3>
                <p className="text-sm text-red-600 mb-4">This will permanently delete your account and all your data including finance records, clients, projects and goals.</p>
                <div className="mb-4">
                  <label className="text-sm font-medium text-red-700 block mb-1">Type DELETE to confirm</label>
                  <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
                </div>
                <button onClick={deleteAccount} disabled={deleteConfirm !== "DELETE"} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Permanently Delete Account
                </button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}