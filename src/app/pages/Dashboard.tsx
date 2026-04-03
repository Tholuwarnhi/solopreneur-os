import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { TrendingUp, TrendingDown, Wallet, Clock, ArrowUpRight } from "lucide-react";
import Card from "../components/Card";
import Badge from "../components/Badge";

export default function Dashboard() {
  const { user } = useAuth();
  const [finance, setFinance] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fq = query(collection(db, "finance"), where("userId", "==", user.uid));
    const unsubF = onSnapshot(fq, (snap) => setFinance(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    const pq = query(collection(db, "projects"), where("userId", "==", user.uid));
    const unsubP = onSnapshot(pq, (snap) => setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    const gq = query(collection(db, "goals"), where("userId", "==", user.uid));
    const unsubG = onSnapshot(gq, (snap) => setGoals(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    return () => { unsubF(); unsubP(); unsubG(); };
  }, [user]);

  const totalIncome = finance.filter((e) => e.type === "income").reduce((sum, e) => sum + e.amount, 0);
  const totalExpenses = finance.filter((e) => e.type === "expense").reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const activeProjects = projects.filter((p) => p.status !== "Done");
  const recentTransactions = [...finance].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const activeGoals = goals.filter((g) => !g.completed);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";
  const userName = user?.displayName || user?.email?.split("@")[0] || "there";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>
          {greeting}, {userName}! 👋
        </h1>
        <p className="text-gray-600">Here's your business overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm text-gray-600">Total Income</p>
            <div className="p-2 rounded-lg bg-[#10B981]/10">
              <TrendingUp className="w-5 h-5 text-[#10B981]" />
            </div>
          </div>
          <p className="text-3xl font-bold mb-2" style={{ color: "#0F1B2D" }}>
            ${totalIncome.toLocaleString()}
          </p>
          <p className="text-sm text-[#10B981] font-medium flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" /> {finance.filter((e) => e.type === "income").length} transactions
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm text-gray-600">Total Expenses</p>
            <div className="p-2 rounded-lg bg-red-50">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-3xl font-bold mb-2 text-red-500">
            ${totalExpenses.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 font-medium">
            {finance.filter((e) => e.type === "expense").length} expenses logged
          </p>
        </div>

        <div className="bg-gradient-to-br from-[#10B981] to-[#059669] rounded-2xl shadow-sm p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <p className="text-sm text-white/90">Net Profit</p>
            <Wallet className="w-5 h-5 text-white/90" />
          </div>
          <p className="text-3xl font-bold mb-2">${netProfit.toLocaleString()}</p>
          <p className="text-sm text-white/90 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" /> {goals.filter((g) => g.completed).length} goals completed
          </p>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: "#0F1B2D" }}>Active Projects</h2>
              <span className="text-sm text-gray-500">{activeProjects.length} active</span>
            </div>
            {activeProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No active projects. Add one in Projects.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeProjects.slice(0, 4).map((project) => (
                  <div key={project.id} className="border border-gray-100 rounded-xl p-4 hover:border-[#10B981]/30 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold mb-1" style={{ color: "#0F1B2D" }}>{project.name}</h3>
                        <p className="text-sm text-gray-600">{project.client}</p>
                      </div>
                      <Badge variant={project.status === "In Progress" ? "info" : project.status === "Review" ? "warning" : "success"}>
                        {project.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Progress</span>
                          <span className="text-xs font-medium text-gray-700">{project.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${project.progress}%`, backgroundColor: "#10B981" }}></div>
                        </div>
                      </div>
                      {project.deadline && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          <span>{project.deadline}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Active Goals */}
          <Card>
            <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>Active Goals</h2>
            {activeGoals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No active goals yet.</p>
            ) : (
              <div className="space-y-3">
                {activeGoals.slice(0, 3).map((goal) => (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium" style={{ color: "#0F1B2D" }}>{goal.title}</p>
                      <span className="text-xs text-gray-500">{goal.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${goal.progress}%`, backgroundColor: "#10B981" }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Transactions */}
          <Card>
            <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>Recent Transactions</h2>
            {recentTransactions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No transactions yet.</p>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-[#10B981]/10" : "bg-gray-100"}`}>
                        <span className="text-xs">{t.type === "income" ? "💰" : "💸"}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "#0F1B2D" }}>{t.description}</p>
                        <p className="text-xs text-gray-500">{t.date}</p>
                      </div>
                    </div>
                    <p className={`text-sm font-semibold ${t.type === "income" ? "text-[#10B981]" : "text-red-500"}`}>
                      {t.type === "income" ? "+" : "-"}${Math.abs(t.amount).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}