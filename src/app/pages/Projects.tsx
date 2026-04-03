import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Plus, Trash2, Clock } from "lucide-react";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Card from "../components/Card";

interface Project {
  id: string;
  name: string;
  client: string;
  deadline: string;
  status: string;
  description: string;
  progress: number;
}

const emptyForm = {
  name: "",
  client: "",
  deadline: "",
  status: "To Do",
  description: "",
  progress: 0,
};

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "projects"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Project[];
      setProjects(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async () => {
    if (!user || !form.name) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "projects"), {
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
    await deleteDoc(doc(db, "projects", id));
  };

  const todo = projects.filter((p) => p.status === "To Do");
  const inProgress = projects.filter((p) => p.status === "In Progress");
  const review = projects.filter((p) => p.status === "Review");
  const done = projects.filter((p) => p.status === "Done");

  const renderCard = (project: Project) => (
    <div key={project.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-[#10B981]/30 transition-all">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm" style={{ color: "#0F1B2D" }}>{project.name}</h3>
        <button onClick={() => handleDelete(project.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {project.client && (
        <span className="inline-block px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-medium mb-3">
          {project.client}
        </span>
      )}
      {project.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{project.description}</p>
      )}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Progress</span>
          <span className="text-xs font-medium text-gray-700">{project.progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${project.progress}%`, backgroundColor: "#10B981" }}></div>
        </div>
      </div>
      {project.deadline && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{project.deadline}</span>
        </div>
      )}
    </div>
  );

  const columns = [
    { label: "To Do", color: "bg-gray-400", badge: "bg-gray-100 text-gray-600", items: todo },
    { label: "In Progress", color: "bg-blue-500", badge: "bg-blue-50 text-blue-600", items: inProgress },
    { label: "Review", color: "bg-[#F59E0B]", badge: "bg-amber-50 text-amber-600", items: review },
    { label: "Done", color: "bg-[#10B981]", badge: "bg-[#10B981]/10 text-[#10B981]", items: done },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>Projects</h1>
          <p className="text-gray-600">Track your active projects</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Add Project
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>New Project</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Project Name</label>
              <input type="text" placeholder="e.g. Brand Identity Design" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Client</label>
              <input type="text" placeholder="Client name" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Deadline</label>
              <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                <option>To Do</option>
                <option>In Progress</option>
                <option>Review</option>
                <option>Done</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Progress ({form.progress}%)</label>
              <input type="range" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} className="w-full" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
              <input type="text" placeholder="Brief description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="primary" onClick={handleAdd} disabled={loading}>
              {loading ? "Saving..." : "Save Project"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {projects.length === 0 && !showForm ? (
        <Card>
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No projects yet. Add your first project.</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Project
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {columns.map((col) => (
            <div key={col.label}>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold" style={{ color: "#0F1B2D" }}>{col.label}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${col.badge}`}>{col.items.length}</span>
                </div>
                <div className={`h-1 ${col.color} rounded-full`}></div>
              </div>
              <div className="space-y-3">{col.items.map(renderCard)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}