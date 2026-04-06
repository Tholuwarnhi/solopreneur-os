import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Plus, Download, Send, Trash2, Edit2, Check, X, Eye, FileText, Calendar, DollarSign, User } from "lucide-react";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Button from "../components/Button";
import Card from "../components/Card";
import Badge from "../components/Badge";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  issueDate: string;
  dueDate: string;
  notes?: string;
  paymentMethod?: string;
  createdAt: Date;
}

interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
];

const TAX_RATES = [
  { label: 'No Tax', rate: 0 },
  { label: '5% VAT', rate: 0.05 },
  { label: '7.5% VAT (NG)', rate: 0.075 },
  { label: '10% Tax', rate: 0.10 },
  { label: '15% Tax', rate: 0.15 },
  { label: '20% VAT', rate: 0.20 },
];

export default function Invoice() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [form, setForm] = useState({
    clientId: '',
    clientName: '',
    clientEmail: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }] as InvoiceItem[],
    currency: 'USD',
    tax: 0,
    notes: '',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user) return;

    // Fetch invoices
    const q = query(collection(db, "invoices"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeInvoices = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Invoice[];
      setInvoices(data);
    });

    // Fetch clients
    const clientQ = query(collection(db, "clients"), where("userId", "==", user.uid));
    const unsubscribeClients = onSnapshot(clientQ, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Client[];
      setClients(data);
    });

    return () => {
      unsubscribeInvoices();
      unsubscribeClients();
    };
  }, [user]);

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}-${random}`;
  };

  const calculateTotals = () => {
    const subtotal = form.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = subtotal * form.tax;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...form.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate amount if quantity or rate changed
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    
    setForm({ ...form, items: newItems });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { description: '', quantity: 1, rate: 0, amount: 0, id: Date.now().toString() }]
    });
  };

  const removeItem = (index: number) => {
    setForm({
      ...form,
      items: form.items.filter((_, i) => i !== index)
    });
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setForm({
        ...form,
        clientId,
        clientName: client.name,
        clientEmail: client.email
      });
    }
  };

  const generatePDF = async (invoiceId: string) => {
    const element = document.getElementById(`invoice-preview-${invoiceId}`);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`invoice-${invoiceId}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const sendInvoice = async (invoice: Invoice) => {
    setLoading(true);
    try {
      // Update invoice status to sent
      await updateDoc(doc(db, "invoices", invoice.id), {
        status: 'sent',
        sentAt: new Date()
      });

      // Here you would integrate with email service
      // For now, we'll just copy email to clipboard
      if (invoice.clientEmail) {
        const emailBody = `Dear ${invoice.clientName},

Please find attached invoice ${invoice.invoiceNumber} for your records.

Invoice Details:
- Amount: ${CURRENCIES.find(c => c.code === invoice.currency)?.symbol}${invoice.total.toFixed(2)}
- Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}

You can view the full invoice in your client portal.

Best regards`;
        
        await navigator.clipboard.writeText(`To: ${invoice.clientEmail}\nSubject: Invoice ${invoice.invoiceNumber}\n\n${emailBody}`);
      }
    } catch (error) {
      console.error('Error sending invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsPaid = async (invoiceId: string) => {
    try {
      await updateDoc(doc(db, "invoices", invoiceId), {
        status: 'paid',
        paidAt: new Date()
      });
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
    }
  };

  const saveInvoice = async () => {
    if (!user || !form.clientName || form.items.length === 0) return;

    setLoading(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals();
      const invoiceData = {
        userId: user.uid,
        invoiceNumber: editingInvoice?.invoiceNumber || generateInvoiceNumber(),
        clientId: form.clientId,
        clientName: form.clientName,
        clientEmail: form.clientEmail,
        items: form.items,
        subtotal,
        tax: taxAmount,
        total,
        currency: form.currency,
        status: 'draft',
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        notes: form.notes,
        createdAt: editingInvoice?.createdAt || new Date()
      };

      if (editingInvoice) {
        await updateDoc(doc(db, "invoices", editingInvoice.id), invoiceData);
      } else {
        await addDoc(collection(db, "invoices"), invoiceData);
      }

      // Reset form
      setForm({
        clientId: '',
        clientName: '',
        clientEmail: '',
        items: [{ description: '', quantity: 1, rate: 0, amount: 0 }] as InvoiceItem[],
        currency: 'USD',
        tax: 0,
        notes: '',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      setEditingInvoice(null);
      setShowForm(false);
    } catch (error) {
      console.error('Error saving invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: 'secondary',
      sent: 'primary',
      paid: 'success',
      overdue: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>
            Invoice Generator
          </h1>
          <p className="text-gray-600">Create and manage professional invoices</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
          <Plus size={20} />
          New Invoice
        </Button>
      </div>

      {/* Invoice List */}
      <div className="grid gap-4">
        {invoices.map((invoice) => (
          <Card key={invoice.id} className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg mb-1">{invoice.invoiceNumber}</h3>
                <p className="text-gray-600">{invoice.clientName}</p>
                <p className="text-sm text-gray-500">{invoice.clientEmail}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold mb-2">
                  {CURRENCIES.find(c => c.code === invoice.currency)?.symbol}
                  {invoice.total.toFixed(2)}
                </div>
                {getStatusBadge(invoice.status)}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <span>Issued: {new Date(invoice.issueDate).toLocaleDateString()}</span>
                <span className="mx-2">•</span>
                <span>Due: {new Date(invoice.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingInvoice(invoice);
                    setForm({
                      clientId: invoice.clientId,
                      clientName: invoice.clientName,
                      clientEmail: invoice.clientEmail,
                      items: invoice.items,
                      currency: invoice.currency,
                      tax: invoice.tax / invoice.subtotal,
                      notes: invoice.notes || '',
                      issueDate: invoice.issueDate,
                      dueDate: invoice.dueDate,
                    });
                    setShowForm(true);
                  }}
                >
                  <Edit2 size={16} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generatePDF(invoice.id)}
                >
                  <Download size={16} />
                </Button>
                {invoice.status === 'draft' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => sendInvoice(invoice)}
                    disabled={loading}
                  >
                    <Send size={16} />
                  </Button>
                )}
                {invoice.status === 'sent' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAsPaid(invoice.id)}
                  >
                    <Check size={16} />
                  </Button>
                )}
              </div>
            </div>

            {/* Hidden Preview for PDF Generation */}
            <div id={`invoice-preview-${invoice.id}`} className="hidden">
              <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ marginBottom: '30px' }}>
                  <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>INVOICE</h1>
                  <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{invoice.invoiceNumber}</p>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', marginBottom: '5px' }}>Bill To:</h3>
                    <p style={{ fontSize: '14px' }}>{invoice.clientName}</p>
                    <p style={{ fontSize: '14px' }}>{invoice.clientEmail}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '14px' }}><strong>Issue Date:</strong> {new Date(invoice.issueDate).toLocaleDateString()}</p>
                    <p style={{ fontSize: '14px' }}><strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <table style={{ width: '100%', marginBottom: '30px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #000' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Quantity</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Rate</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '10px' }}>{item.description}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          {CURRENCIES.find(c => c.code === invoice.currency)?.symbol}{item.rate.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          {CURRENCIES.find(c => c.code === invoice.currency)?.symbol}{item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ padding: '10px', textAlign: 'right' }}><strong>Subtotal:</strong></td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {CURRENCIES.find(c => c.code === invoice.currency)?.symbol}{invoice.subtotal.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} style={{ padding: '10px', textAlign: 'right' }}><strong>Tax:</strong></td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {CURRENCIES.find(c => c.code === invoice.currency)?.symbol}{invoice.tax.toFixed(2)}
                      </td>
                    </tr>
                    <tr style={{ borderTop: '2px solid #000' }}>
                      <td colSpan={3} style={{ padding: '10px', textAlign: 'right' }}><strong>Total:</strong></td>
                      <td style={{ padding: '10px', textAlign: 'right', fontSize: '18px', fontWeight: 'bold' }}>
                        {CURRENCIES.find(c => c.code === invoice.currency)?.symbol}{invoice.total.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {invoice.notes && (
                  <div style={{ marginTop: '30px' }}>
                    <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>Notes:</h3>
                    <p style={{ fontSize: '14px' }}>{invoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Invoice Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
              </h2>
              <Button variant="ghost" onClick={() => {
                setShowForm(false);
                setEditingInvoice(null);
              }}>
                <X size={24} />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Client</label>
                <select
                  value={form.clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Issue Date</label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
              </div>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Invoice Items</h3>
                <Button onClick={addItem} variant="outline" size="sm">
                  <Plus size={16} className="mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-6">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        className="w-full p-3 border rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full p-3 border rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Rate"
                        value={item.rate}
                        onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full p-3 border rounded-lg"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="text"
                        value={CURRENCIES.find(c => c.code === form.currency)?.symbol + item.amount.toFixed(2)}
                        disabled
                        className="w-full p-3 border rounded-lg bg-gray-50"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">Tax Rate</label>
                <select
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: parseFloat(e.target.value) })}
                  className="w-full p-3 border rounded-lg"
                >
                  {TAX_RATES.map((tax) => (
                    <option key={tax.rate} value={tax.rate}>{tax.label}</option>
                  ))}
                </select>
              </div>
              <div className="text-right">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{CURRENCIES.find(c => c.code === form.currency)?.symbol}{calculateTotals().subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax:</span>
                    <span>{CURRENCIES.find(c => c.code === form.currency)?.symbol}{calculateTotals().taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>{CURRENCIES.find(c => c.code === form.currency)?.symbol}{calculateTotals().total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                placeholder="Additional notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full p-3 border rounded-lg h-24"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingInvoice(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={saveInvoice} disabled={loading}>
                {loading ? 'Saving...' : (editingInvoice ? 'Update Invoice' : 'Create Invoice')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
