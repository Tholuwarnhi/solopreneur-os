import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Plus, Trash2, Target, CheckCircle2 } from "lucide-react";
import Button from "../components/Button";
import Card from "../components/Card";

interface Goal {
  id: string;
  title: string;
  description: string;
  target: string;
  deadline: string;
  progress: number;
  completed: boolean;
  category: string;
}

const emptyForm = {
  title: "",
  description: "",
  target: "",
  deadline: "",
  progress: 0,
  completed: false,
  category: "Revenue",
};

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "goals"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Goal[];
      setGoals(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async () => {
    if (!user || !form.title) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "goals"), {
        ...form,
        progress: Number(form.progress),
        userId: user.uid,
        createdAt: new Date().toISOString(),
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
    await deleteDoc(doc(db, "goals", id));
  };

  const handleToggleComplete = async (goal: Goal) => {
    await updateDoc(doc(db, "goals", goal.id), {
      completed: !goal.completed,
      progress: !goal.completed ? 100 : goal.progress,
    });
  };

  const handleProgressUpdate = async (goal: Goal, progress: number) => {
    await updateDoc(doc(db, "goals", goal.id), { progress });
  };

  const active = goals.filter((g) => !g.completed);
  const completed = goals.filter((g) => g.completed);

  const categoryColors: Record<string, string> = {
    Revenue: "bg-[#10B981]/10 text-[#10B981]",
    Clients: "bg-blue-50 text-blue-600",
    Marketing: "bg-purple-50 text-purple-600",
    Learning: "bg-amber-50 text-amber-600",
    Personal: "bg-pink-50 text-pink-600",
    Other: "bg-gray-100 text-gray-600",
  };

  const renderGoal = (goal: Goal) => (
    <Card key={goal.id} className={goal.completed ? "opacity-70" : ""}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <button onClick={() => handleToggleComplete(goal)} className="mt-1 flex-shrink-0">
            <CheckCircle2 className={`w-5 h-5 ${goal.completed ? "text-[#10B981]" : "text-gray-300"}`} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className={`font-semibold ${goal.completed ? "line-through text-gray-400" : ""}`} style={goal.completed ? {} : { color: "#0F1B2D" }}>
                {goal.title}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors[goal.category] || categoryColors.Other}`}>
                {goal.category}
              </span>
            </div>
            {goal.description && (
              <p className="text-sm text-gray-500 mb-2">{goal.description}</p>
            )}
            {goal.target && (
              <p className="text-sm font-medium text-gray-700 mb-3">🎯 Target: {goal.target}</p>
            )}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs font-medium text-gray-700">{goal.progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={goal.progress}
                onChange={(e) => handleProgressUpdate(goal, Number(e.target.value))}
                className="w-full"
                disabled={goal.completed}
              />
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${goal.progress}%`, backgroundColor: "#10B981" }}
                ></div>
              </div>
            </div>
            {goal.deadline && (
              <p className="text-xs text-gray-500">📅 Due: {goal.deadline}</p>
            )}
          </div>
        </div>
        <button onClick={() => handleDelete(goal.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors ml-2">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </Card>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>Goals</h1>
          <p className="text-gray-600">Track your business and personal goals</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Add Goal
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>New Goal</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Goal Title</label>
              <input type="text" placeholder="e.g. Earn $10k this month" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                <option>Revenue</option>
                <option>Clients</option>
                <option>Marketing</option>
                <option>Learning</option>
                <option>Personal</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Target</label>
              <input type="text" placeholder="e.g. $10,000 revenue" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Deadline</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Initial Progress ({form.progress}%)</label>
              <input type="range" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
              <input type="text" placeholder="Optional notes..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="primary" onClick={handleAdd} disabled={loading}>
              {loading ? "Saving..." : "Save Goal"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {goals.length === 0 && !showForm ? (
        <Card>
          <div className="text-center py-16">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No goals yet. Set your first goal.</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Goal
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>Active Goals ({active.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {active.map(renderGoal)}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 text-gray-400">Completed ({completed.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completed.map(renderGoal)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}