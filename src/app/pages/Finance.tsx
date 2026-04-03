import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, XCircle, CheckCircle2, Clock, ChevronDown, ChevronUp } from "lucide-react";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Card from "../components/Card";

interface FinanceEntry {
  id: string;
  date: string;
  description: string;
  category: string;
  customCategory?: string;
  amount: number;
  currency: string;
  status: "Paid" | "Received" | "Pending" | "Overdue" | "Bad Debt" | "Disputed";
  client: string;
  type: "income" | "expense";
  dueDate?: string;
  isBadDebt?: boolean;
  createdAt: string;
}

const INCOME_CATEGORIES = [
  "Design Services", "Consulting", "Coaching", "Freelance Work",
  "Product Sales", "Subscription Revenue", "Commission", "Royalties",
  "Retainer Fee", "Project Milestone", "Bonus", "Grant", "Investment",
  "Affiliate Income", "Speaking Fee", "Workshop/Training", "Other — type manually",
];

const EXPENSE_CATEGORIES = [
  "Software & Subscriptions", "Hardware & Equipment", "Office Supplies",
  "Marketing & Ads", "Professional Services", "Legal & Accounting",
  "Travel & Transport", "Meals & Entertainment", "Infrastructure & Hosting",
  "Phone & Internet", "Insurance", "Taxes & Fees", "Staff & Contractors",
  "Education & Training", "Bank Charges", "Utilities", "Rent & Workspace",
  "Stock & Inventory", "Other — type manually",
];

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD", "GHS", "KES", "ZAR"];

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  description: "",
  category: "Design Services",
  customCategory: "",
  amount: "",
  currency: "USD",
  status: "Received" as FinanceEntry["status"],
  client: "",
  type: "income" as "income" | "expense",
  dueDate: "",
};

function getDaysOverdue(dueDate: string): number {
  const diff = new Date().getTime() - new Date(dueDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function Finance() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [currencyFilter, setCurrencyFilter] = useState("All");

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "finance"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as FinanceEntry[];
      data.forEach((entry) => {
        if (entry.status === "Pending" && entry.dueDate && new Date(entry.dueDate) < new Date()) {
          updateDoc(doc(db, "finance", entry.id), { status: "Overdue" });
        }
      });
      setEntries(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
    return () => unsubscribe();
  }, [user]);

  const confirmedIncome = entries.filter((e) => e.type === "income" && (e.status === "Received" || e.status === "Paid")).reduce((sum, e) => sum + e.amount, 0);
  const confirmedExpenses = entries.filter((e) => e.type === "expense" && (e.status === "Paid" || e.status === "Received")).reduce((sum, e) => sum + e.amount, 0);
  const netProfit = confirmedIncome - confirmedExpenses;
  const pendingIncome = entries.filter((e) => e.type === "income" && e.status === "Pending").reduce((sum, e) => sum + e.amount, 0);
  const overdueIncome = entries.filter((e) => e.type === "income" && e.status === "Overdue").reduce((sum, e) => sum + e.amount, 0);
  const badDebt = entries.filter((e) => e.status === "Bad Debt").reduce((sum, e) => sum + e.amount, 0);
  const pendingExpenses = entries.filter((e) => e.type === "expense" && (e.status === "Pending" || e.status === "Overdue")).reduce((sum, e) => sum + e.amount, 0);
  const projectedProfit = netProfit + pendingIncome - pendingExpenses;
  const overdueEntries = entries.filter((e) => e.status === "Overdue");

  const handleAdd = async () => {
    if (!user || !form.description || !form.amount) return;
    setLoading(true);
    const finalCategory = form.category === "Other — type manually" ? form.customCategory || "Other" : form.category;
    try {
      await addDoc(collection(db, "finance"), {
        ...form,
        category: finalCategory,
        amount: parseFloat(form.amount),
        userId: user.uid,
        createdAt: new Date().toISOString(),
        isBadDebt: false,
      });
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, "finance", id));
  };

  const handleStatusChange = async (entry: FinanceEntry, newStatus: FinanceEntry["status"]) => {
    await updateDoc(doc(db, "finance", entry.id), {
      status: newStatus,
      isBadDebt: newStatus === "Bad Debt",
    });
  };

  const filteredEntries = entries.filter((e) => {
    const matchStatus = filter === "All" || e.status === filter;
    const matchType = typeFilter === "All" || e.type === typeFilter;
    const matchCurrency = currencyFilter === "All" || e.currency === currencyFilter;
    return matchStatus && matchType && matchCurrency;
  });

  const getRowStyle = (entry: FinanceEntry) => {
    if (entry.status === "Bad Debt") return "bg-gray-50 opacity-60";
    if (entry.status === "Overdue") return "bg-red-50 border-l-4 border-red-400";
    if (entry.status === "Pending") return "bg-amber-50/50";
    if (entry.status === "Disputed") return "bg-orange-50";
    return "";
  };

  const getStatusBadgeVariant = (entry: FinanceEntry) => {
    const map: Record<string, any> = {
      Received: "success", Paid: "success",
      Pending: "warning", Overdue: "error",
      "Bad Debt": "error", Disputed: "warning",
    };
    return map[entry.status] || "info";
  };

  const categories = form.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>Finance Tracker</h1>
          <p className="text-gray-600">Monitor your income, expenses and financial health</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Add Entry
        </Button>
      </div>

      {/* Overdue Alert Banner */}
      {overdueEntries.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-700 mb-1">
              {overdueEntries.length} overdue {overdueEntries.length === 1 ? "entry" : "entries"} need your attention
            </p>
            <div className="space-y-1">
              {overdueEntries.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm flex-wrap gap-2">
                  <span className="text-red-600">
                    {e.description} — ${e.amount.toLocaleString()} {e.currency}
                    {e.dueDate && ` (${getDaysOverdue(e.dueDate)} days overdue)`}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => handleStatusChange(e, e.type === "income" ? "Received" : "Paid")} className="text-xs px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium">
                      Mark {e.type === "income" ? "Received" : "Paid"}
                    </button>
                    <button onClick={() => handleStatusChange(e, "Bad Debt")} className="text-xs px-2 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium">
                      Bad Debt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3 Main Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">Confirmed Income</p>
            <div className="p-2 rounded-lg bg-[#10B981]/10">
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
            </div>
          </div>
          <p className="text-3xl font-bold text-[#10B981]">${confirmedIncome.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Received & paid entries only</p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600">Confirmed Expenses</p>
            <div className="p-2 rounded-lg bg-red-50">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-3xl font-bold text-red-500">${confirmedExpenses.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Paid expenses only</p>
        </Card>

        <div className="bg-gradient-to-br from-[#10B981] to-[#059669] rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/90">Net Profit</p>
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-3xl font-bold">${netProfit.toLocaleString()}</p>
          <p className="text-xs text-white/70 mt-1">Confirmed income minus expenses</p>
        </div>
      </div>

      {/* Financial Health Collapsible */}
      <div className="mb-6">
        <button
          onClick={() => setShowHealth(!showHealth)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-[#10B981]/40 transition-all text-sm font-medium"
          style={{ color: "#0F1B2D" }}
        >
          <span>📊 Financial Health Breakdown</span>
          {showHealth ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showHealth && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <p className="text-xs text-gray-600">Pending Income</p>
              </div>
              <p className="text-xl font-bold text-amber-500">${pendingIncome.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Not yet received</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <p className="text-xs text-gray-600">Overdue / At Risk</p>
              </div>
              <p className="text-xl font-bold text-red-500">${overdueIncome.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Past due date</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-600">Bad Debt</p>
              </div>
              <p className="text-xl font-bold text-gray-400">${badDebt.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Written off</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-gray-600">Projected Profit</p>
              </div>
              <p className="text-xl font-bold text-blue-500">${projectedProfit.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">Including pending</p>
            </Card>
          </div>
        )}
      </div>

      {/* Add Entry Form */}
      {showForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>New Entry</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any, category: e.target.value === "income" ? "Design Services" : "Software & Subscriptions", status: e.target.value === "income" ? "Received" : "Paid" })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
              <input type="text" placeholder="e.g. Logo Design for TechFlow" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Amount</label>
              <input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Client / Vendor</label>
              <input type="text" placeholder="Who is this from/to?" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {form.category === "Other — type manually" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Custom Category</label>
                <input type="text" placeholder="Type your category..." value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                {form.type === "income" ? (
                  <>
                    <option value="Received">Received ✅</option>
                    <option value="Pending">Pending ⏳</option>
                  </>
                ) : (
                  <>
                    <option value="Paid">Paid ✅</option>
                    <option value="Pending">Pending ⏳</option>
                  </>
                )}
              </select>
            </div>
            {form.status === "Pending" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="primary" onClick={handleAdd} disabled={loading}>
              {loading ? "Saving..." : "Save Entry"}
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Filters — single clean row of dropdowns */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filter:</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
            <option value="All">All Statuses</option>
            <option value="Received">Received</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
            <option value="Bad Debt">Bad Debt</option>
            <option value="Disputed">Disputed</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
            <option value="All">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
            <option value="All">All Currencies</option>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="ml-auto text-sm text-gray-400">{filteredEntries.length} entries</span>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {filteredEntries.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No entries found. Add your first income or expense.</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Entry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Category</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Client</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Due Date</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((row) => (
                  <tr key={row.id} className={`border-b border-gray-100 transition-colors ${getRowStyle(row)}`}>
                    <td className="py-4 px-4 text-sm text-gray-600">{row.date}</td>
                    <td className="py-4 px-4">
                      <p className={`text-sm font-medium ${row.isBadDebt ? "line-through text-gray-400" : ""}`} style={row.isBadDebt ? {} : { color: "#0F1B2D" }}>
                        {row.description}
                      </p>
                      {row.status === "Overdue" && row.dueDate && (
                        <p className="text-xs text-red-500 font-medium mt-0.5">⚠️ {getDaysOverdue(row.dueDate)} days overdue</p>
                      )}
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600">{row.category}</td>
                    <td className="py-4 px-4 text-sm text-gray-600">{row.client}</td>
                    <td className="py-4 px-4 text-sm text-gray-500">{row.dueDate || "—"}</td>
                    <td className={`py-4 px-4 text-sm font-semibold text-right ${row.isBadDebt ? "text-gray-400 line-through" : row.type === "income" ? "text-[#10B981]" : "text-red-500"}`}>
                      {row.type === "income" ? "+" : "-"}${Math.abs(row.amount).toLocaleString()} {row.currency}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant={getStatusBadgeVariant(row)}>{row.status}</Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {(row.status === "Pending" || row.status === "Overdue") && (
                          <>
                            <button onClick={() => handleStatusChange(row, row.type === "income" ? "Received" : "Paid")} className="p-1.5 rounded-lg hover:bg-green-50 text-green-500 transition-colors" title="Mark received/paid">
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleStatusChange(row, "Bad Debt")} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Mark as bad debt">
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {row.status === "Bad Debt" && (
                          <button onClick={() => handleStatusChange(row, "Pending")} className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors" title="Reopen">
                            <Clock className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(row.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}