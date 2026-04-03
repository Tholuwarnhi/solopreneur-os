import { useEffect, useState } from "react";
import { Download, Send, Check, Clock, AlertCircle } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Button from '../components/Button';
import Badge from '../components/Badge';
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

export default function Invoice() {
  const { user } = useAuth();

  const [currency, setCurrency] = useState("USD");
  const [savingPaid, setSavingPaid] = useState(false);

  const invoiceData = {
    invoiceNumber: 'INV-2026-042',
    date: 'April 2, 2026',
    dueDate: 'April 16, 2026',
    status: 'Draft',
    billTo: {
      name: 'Emily Rodriguez',
      company: 'TechFlow Inc.',
      email: 'emily@techflow.com',
      address: '123 Innovation Drive',
      city: 'San Francisco, CA 94105',
    },
    billFrom: {
      name: 'Alex Rivera',
      business: 'Rivera Design Studio',
      email: 'alex@riveradesign.com',
      address: '456 Creative Lane',
      city: 'Austin, TX 78701',
    },
    lineItems: [
      { description: 'Brand Identity Design - Discovery & Research', qty: 1, rate: 1500, amount: 1500 },
      { description: 'Logo Design & Brand Guidelines', qty: 1, rate: 2500, amount: 2500 },
      { description: 'Business Card & Stationery Design', qty: 1, rate: 800, amount: 800 },
      { description: 'Social Media Brand Assets', qty: 1, rate: 600, amount: 600 },
    ],
    subtotal: 5400,
    tax: 540,
    total: 5940,
  };

  const [invoiceStatus, setInvoiceStatus] = useState(invoiceData.status);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data();
      setCurrency(data?.currency || "USD");
    };
    load().catch(console.error);
  }, [user]);

  const statusConfig = {
    Draft: { variant: 'info' as const, icon: Clock, color: '#3B82F6' },
    Sent: { variant: 'warning' as const, icon: Send, color: '#F59E0B' },
    Paid: { variant: 'success' as const, icon: Check, color: '#10B981' },
    Overdue: { variant: 'error' as const, icon: AlertCircle, color: '#EF4444' },
  };

  const currentStatus = statusConfig[invoiceStatus as keyof typeof statusConfig];
  const StatusIcon = currentStatus.icon;

  const handleMarkPaid = async () => {
    if (!user || invoiceStatus === "Paid") return;
    setSavingPaid(true);
    try {
      // Prevent duplicate finance rows by using a deterministic document id per invoice.
      const financeDocId = `invoice_${invoiceData.invoiceNumber}`;
      await setDoc(doc(db, "finance", financeDocId), {
        // FinanceEntry fields (mirrors src/app/pages/Finance.tsx expectations)
        userId: user.uid,
        date: invoiceData.date,
        description: `Invoice ${invoiceData.invoiceNumber}`,
        category: "Freelance Work",
        amount: invoiceData.total,
        currency,
        status: "Received", // Recommended for income payments
        client: invoiceData.billTo.company ? `${invoiceData.billTo.name} (${invoiceData.billTo.company})` : invoiceData.billTo.name,
        type: "income",
        dueDate: invoiceData.dueDate,
        isBadDebt: false,
        invoiceId: invoiceData.invoiceNumber,
        createdAt: new Date().toISOString(),
      });

      setInvoiceStatus("Paid");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPaid(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#0F1B2D' }}>
              Invoice #{invoiceData.invoiceNumber}
            </h1>
            <p className="text-gray-600">Create and manage your invoices</p>
          </div>
          <Badge variant={currentStatus.variant} className="flex items-center gap-2">
            <StatusIcon className="w-4 h-4" />
            {invoiceStatus}
          </Badge>
        </div>

        {/* Invoice Preview */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 mb-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-12">
            <div>
              <h2 className="text-4xl font-bold mb-2" style={{ color: '#0F1B2D' }}>
                INVOICE
              </h2>
              <p className="text-gray-600">#{invoiceData.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg mb-1" style={{ color: '#0F1B2D' }}>
                {invoiceData.billFrom.business}
              </p>
              <p className="text-sm text-gray-600">{invoiceData.billFrom.name}</p>
              <p className="text-sm text-gray-600">{invoiceData.billFrom.email}</p>
              <p className="text-sm text-gray-600">{invoiceData.billFrom.address}</p>
              <p className="text-sm text-gray-600">{invoiceData.billFrom.city}</p>
            </div>
          </div>

          {/* Bill To & Dates */}
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-3">BILL TO</p>
              <p className="font-semibold mb-1" style={{ color: '#0F1B2D' }}>
                {invoiceData.billTo.name}
              </p>
              <p className="text-sm text-gray-600">{invoiceData.billTo.company}</p>
              <p className="text-sm text-gray-600">{invoiceData.billTo.email}</p>
              <p className="text-sm text-gray-600">{invoiceData.billTo.address}</p>
              <p className="text-sm text-gray-600">{invoiceData.billTo.city}</p>
            </div>
            <div>
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-500 mb-1">INVOICE DATE</p>
                <p className="font-medium" style={{ color: '#0F1B2D' }}>
                  {invoiceData.date}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">DUE DATE</p>
                <p className="font-medium" style={{ color: '#0F1B2D' }}>
                  {invoiceData.dueDate}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">DESCRIPTION</th>
                  <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">QTY</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">RATE</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {invoiceData.lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-4 px-2 text-sm" style={{ color: '#0F1B2D' }}>
                      {item.description}
                    </td>
                    <td className="py-4 px-2 text-sm text-center text-gray-600">{item.qty}</td>
                    <td className="py-4 px-2 text-sm text-right text-gray-600">
                      ${item.rate.toLocaleString()}
                    </td>
                    <td className="py-4 px-2 text-sm text-right font-medium" style={{ color: '#0F1B2D' }}>
                      ${item.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-80">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <p className="text-sm text-gray-600">Subtotal</p>
                <p className="font-medium" style={{ color: '#0F1B2D' }}>
                  ${invoiceData.s