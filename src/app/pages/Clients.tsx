import { useState, useEffect } from "react";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Plus, Mail, Trash2 } from "lucide-react";
import Button from "../components/Button";
import Card from "../components/Card";

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
}

const emptyForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "Lead",
  notes: "",
};

const colors = ["#10B981", "#F59E0B", "#3B82F6", "#8B5CF6", "#EC4899"];
const getColor = (index: number) => colors[index % colors.length];
const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").toUpperCase();

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "clients"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Client[];
      setClients(data);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAdd = async () => {
    if (!user || !form.name) return;
    setLoading(true);
    try {
      await addDoc(collection(db, "clients"), {
        ...form,
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
    await deleteDoc(doc(db, "clients", id));
  };

  const leads = clients.filter((c) => c.status === "Lead");
  const active = clients.filter((c) => c.status === "Active");
  const completed = clients.filter((c) => c.status === "Completed");

  const renderCard = (client: Client, index: number) => (
    <div key={client.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-[#10B981]/30 transition-all">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0" style={{ backgroundColor: getColor(index) }}>
          {getInitials(client.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold mb-1 truncate" style={{ color: "#0F1B2D" }}>{client.name}</h3>
          <p className="text-sm text-gray-600 truncate">{client.company}</p>
        </div>
        <button onClick={() => handleDelete(client.id)} className="p-1 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Email:</span>
          <span className="font-medium text-gray-700 truncate ml-2">{client.email || "—"}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Phone:</span>
          <span className="font-medium text-gray-700">{client.phone || "—"}</span>
        </div>
        {client.notes && (
          <div className="text-sm text-gray-500 italic truncate">{client.notes}</div>
        )}
      </div>
      <div className="flex gap-2">
        <a href={`mailto:${client.email}`} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
          <Mail className="w-4 h-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Email</span>
        </a>
      </div>
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>Client CRM</h1>
          <p className="text-gray-600">Manage your client relationships</p>
        </div>
        <Button variant="primary" className="flex items-center gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Add Client
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>New Client</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Full Name</label>
              <input type="text" placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Company</label>
              <input type="text" placeholder="Company Ltd" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
              <input type="email" placeholder="john@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Phone</label>
              <input type="text" placeholder="+1 234 567 8900" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]">
                <option>Lead</option>
                <option>Active</option>
                <option>Completed</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
              <input type="text" placeholder="Any notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button variant="primary" onClick={handleAdd} disabled={loading}>
              {loading ? "Saving..." : "Save Client"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {clients.length === 0 && !showForm ? (
        <Card>
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No clients yet. Add your first client.</p>
            <Button variant="primary" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-lg" style={{ color: "#0F1B2D" }}>Lead</h2>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-sm font-medium">{leads.length}</span>
              </div>
              <div className="h-1 bg-blue-500 rounded-full"></div>
            </div>
            <div className="space-y-4">{leads.map((c, i) => renderCard(c, i))}</div>
          </div>
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-lg" style={{ color: "#0F1B2D" }}>Active</h2>
                <span className="px-3 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-sm font-medium">{active.length}</span>
              </div>
              <div className="h-1 bg-[#10B981] rounded-full"></div>
            </div>
            <div className="space-y-4">{active.map((c, i) => renderCard(c, i + 2))}</div>
          </div>
          <div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-bold text-lg" style={{ color: "#0F1B2D" }}>Completed</h2>
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">{completed.length}</span>
              </div>
              <div className="h-1 bg-gray-400 rounded-full"></div>
            </div>
            <div className="space-y-4">{completed.map((c, i) => renderCard(c, i + 5))}</div>
          </div>
        </div>
      )}
    </div>
  );
}