import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Download, Send, Check, Clock, AlertCircle, X, Archive, Trash2 } from "lucide-react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import Button from '../components/Button';
import Badge from '../components/Badge';
import Card from "../components/Card";
import { auth, db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { apiErrorMessage, readResponseJson } from "../../lib/apiResponse";

type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue";

interface BillTo {
  name: string;
  company: string;
  email: string;
  address: string;
  city: string;
}

interface BillFrom {
  name: string;
  business: string;
  email: string;
  address: string;
  city: string;
}

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  notes: string;
}

interface InvoiceLineItem {
  title: string;
  description?: string;
  qty: number;
  rate: number;
  amount: number;
}

interface InvoiceLineItemDraft {
  title: string;
  description?: string;
  qty: number;
  rate: number;
}

interface InvoicePreview {
  // Firestore document id in `invoices`
  invoiceDocId: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  status: InvoiceStatus;
  currency: string;
  billTo: BillTo;
  billFrom: BillFrom;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentDetails: string;
  archived: boolean;
  createdAt: string;
}

type InvoiceSendChannel = "Email" | "Copy" | "WhatsApp" | "Telegram";

interface InvoiceMessageTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export default function Invoice() {
  const { user } = useAuth();

  const [currency, setCurrency] = useState("USD");
  const [savingPaid, setSavingPaid] = useState(false);
  const [savingSend, setSavingSend] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<InvoicePreview[]>([]);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "All">("All");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [showNewInvoice, setShowNewInvoice] = useState(false);
  const [invoiceFormError, setInvoiceFormError] = useState<string | null>(null);
  const [invoiceToast, setInvoiceToast] = useState<string | null>(null);
  const [sendReady, setSendReady] = useState<null | { to: string; subject: string; body: string }>(null);
  const [sendDraft, setSendDraft] = useState<null | { to: string; subject: string; body: string }>(null);
  const [sendChannel, setSendChannel] = useState<InvoiceSendChannel>("Email");

  const [templates, setTemplates] = useState<InvoiceMessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("default");
  const [templateName, setTemplateName] = useState("New template");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);

  const todayISO = new Date().toISOString().split("T")[0];
  const defaultDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [draft, setDraft] = useState<{
    clientId: string;
    invoiceDate: string;
    dueDate: string;
    taxPercent: number;
    lineItems: InvoiceLineItemDraft[];
    paymentMethod: string;
    paymentDetails: string;
  }>({
    clientId: "",
    invoiceDate: todayISO,
    dueDate: defaultDueDate,
    taxPercent: 10,
    lineItems: [{ title: "", description: "", qty: 1, rate: 0 }],
    paymentMethod: "Bank Transfer",
    paymentDetails:
      "Bank transfer. Add your account details here (name, account number, bank, and reference).",
  });

  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);

  useEffect(() => {
    if (!user) return;
    const loadUserBasics = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data();

      const nextCurrency = data?.currency || "USD";
      const billFrom: BillFrom = {
        name: data?.displayName || user.displayName || user.email?.split("@")[0] || "Owner",
        business: data?.businessName || "",
        email: data?.businessEmail || user.email || "",
        address: data?.businessAddress || "",
        city: "",
      };

      setCurrency(nextCurrency);
      setInvoice((prev) => (prev ? { ...prev, currency: nextCurrency, billFrom } : prev));
      setDraft((prev) => ({ ...prev, taxPercent: prev.taxPercent ?? 10, invoiceDate: prev.invoiceDate || todayISO }));
    };
    loadUserBasics().catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      setGmailConnected(Boolean(data?.gmailConnected));
      setGmailEmail((data?.gmailEmail as string) || null);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Keep the listener stable: query without orderBy and sort client-side.
    // This avoids index requirements and reduces risk of internal assertion errors.
    const q = query(collection(db, "invoices"), where("userId", "==", user.uid));

    const unsub = onSnapshot(q, (snap) => {
      const all: InvoicePreview[] = snap.docs.map((docSnap) => {
        const docData = docSnap.data() as any;
        const safeLineItems: InvoiceLineItem[] = (docData.lineItems || []).map((li: any) => {
          const qty = Number(li?.qty || 0);
          const rate = Number(li?.rate || 0);
          const amount = li?.amount != null ? Number(li.amount) : qty * rate;
          return {
            title: li?.title || li?.description || "",
            description: li?.description || "",
            qty,
            rate,
            amount,
          };
        });

        const createdAt = (docData.createdAt || "") as string;

        const base: InvoicePreview = {
          invoiceDocId: docSnap.id,
          invoiceNumber: docData.invoiceNumber,
          date: docData.date,
          dueDate: docData.dueDate,
          status: (docData.status as InvoiceStatus) || "Draft",
          currency: docData.currency || "USD",
          billTo: docData.billTo || { name: "", company: "", email: "", address: "", city: "" },
          billFrom: docData.billFrom || { name: "", business: "", email: "", address: "", city: "" },
          lineItems: safeLineItems,
          subtotal: Number(docData.subtotal || 0),
          tax: Number(docData.tax || 0),
          total: Number(docData.total || 0),
          paymentMethod: docData.paymentMethod || "",
          paymentDetails: docData.paymentDetails || "",
          archived: Boolean(docData.archived),
          createdAt,
        };

        // Derive "Overdue" in UI if dueDate has passed and it hasn't been paid.
        // We don't force-write this back to Firestore here to avoid noisy writes.
        if (
          base.status !== "Paid" &&
          base.dueDate &&
          /^\d{4}-\d{2}-\d{2}$/.test(base.dueDate) &&
          new Date(base.dueDate).getTime() < new Date(new Date().toISOString().split("T")[0]).getTime()
        ) {
          return { ...base, status: base.status === "Draft" ? "Draft" : "Overdue" };
        }

        return base;
      });

      const sorted = [...all].sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });

      setInvoices(sorted);

      const visible = sorted.filter((inv) => (showArchived ? true : !inv.archived));
      if (visible.length === 0) {
        setSelectedInvoiceId(null);
        setInvoice(null);
        return;
      }

      const currentId = selectedInvoiceId;
      const nextSelected =
        currentId && visible.some((inv) => inv.invoiceDocId === currentId)
          ? currentId
          : visible[0].invoiceDocId;

      setSelectedInvoiceId(nextSelected);

      const nextInvoice = visible.find((inv) => inv.invoiceDocId === nextSelected) || visible[0];
      setInvoice(nextInvoice);
      setCurrency(nextInvoice.currency || "USD");
    }, (err) => {
      console.error(err);
      setInvoiceFormError("Could not load invoices. Please refresh or check Firestore rules.");
    });

    return () => unsub();
  }, [user, selectedInvoiceId, showArchived]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "clients"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as unknown as Client)
      );
      setClients(data);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!showNewInvoice) return;
    if (!draft.clientId && clients.length > 0) {
      setDraft((prev) => ({ ...prev, clientId: clients[0].id }));
    }
  }, [showNewInvoice, clients, draft.clientId]);

  const selectedClient = clients.find((c) => c.id === draft.clientId);

  const computedDraft = (() => {
    const lineItems = (draft.lineItems || []).map((li) => ({
      title: li.title,
      description: li.description || "",
      qty: Number(li.qty || 0),
      rate: Number(li.rate || 0),
      amount: Number(li.qty || 0) * Number(li.rate || 0),
    }));
    const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
    const tax = subtotal * (Number(draft.taxPercent || 0) / 100);
    const total = subtotal + tax;
    return { lineItems, subtotal, tax, total };
  })();

  const statusConfig = {
    Draft: { variant: 'info' as const, icon: Clock, color: '#3B82F6' },
    Sent: { variant: 'warning' as const, icon: Send, color: '#F59E0B' },
    Paid: { variant: 'success' as const, icon: Check, color: '#10B981' },
    Overdue: { variant: 'error' as const, icon: AlertCircle, color: '#EF4444' },
  };

  const currentStatus = invoice ? statusConfig[invoice.status as keyof typeof statusConfig] : statusConfig.Draft;
  const StatusIcon = currentStatus.icon;

  const getFinanceDocId = (invoiceDocId: string) => `invoice_${invoiceDocId}`;

  const showToast = (msg: string) => {
    setInvoiceToast(msg);
    window.setTimeout(() => setInvoiceToast(null), 2500);
  };

  const buildInvoiceEmail = (inv: InvoicePreview) => {
    const formatMoney = (n: number) =>
      new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const clientLabel =
      inv.billTo.company?.trim()
        ? inv.billTo.company.trim()
        : inv.billTo.name?.trim()
        ? inv.billTo.name.trim()
        : "Client";

    const fromLabel = inv.billFrom.business?.trim()
      ? inv.billFrom.business.trim()
      : inv.billFrom.name?.trim()
      ? inv.billFrom.name.trim()
      : "Solopreneur OS";

    const subject = `${clientLabel} — Invoice ${inv.invoiceNumber} from ${fromLabel}`;

    const lines = [
      `Hi ${inv.billTo.name || "there"},`,
      ``,
      `Here is your invoice:`,
      ``,
      `Invoice #${inv.invoiceNumber}`,
      `Total due: ${formatMoney(inv.total)} ${inv.currency}`,
      `Due date: ${inv.dueDate}`,
      ``,
      `How to pay`,
      `- Method: ${inv.paymentMethod}`,
      inv.paymentDetails ? `- Details: ${inv.paymentDetails}` : ``,
      ``,
      `Line items`,
      ...inv.lineItems.map((li) => `- ${li.title} — ${li.qty} × ${formatMoney(li.rate)} = ${formatMoney(li.amount)} ${inv.currency}`),
      ``,
      `Thank you,`,
      `${fromLabel}`,
    ].filter(Boolean);

    const body = lines.join("\n");
    return { subject, body };
  };

  const defaultTemplate = {
    id: "default",
    name: "Default (built-in)",
    subject: "{{clientCompany}} — Invoice {{invoiceNumber}} from {{businessName}}",
    body: [
      "Hi {{clientName}},",
      "",
      "Here is your invoice:",
      "",
      "Invoice #{{invoiceNumber}}",
      "Total due: {{total}} {{currency}}",
      "Due date: {{dueDate}}",
      "",
      "How to pay",
      "- Method: {{paymentMethod}}",
      "{{paymentDetailsLine}}",
      "",
      "Thank you,",
      "{{businessName}}",
    ].join("\n"),
  };

  const applyTemplate = (inv: InvoicePreview, tpl: { subject: string; body: string }) => {
    const formatMoney = (n: number) =>
      new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const businessName =
      inv.billFrom.business?.trim() || inv.billFrom.name?.trim() || "Solopreneur OS";
    const clientName = inv.billTo.name?.trim() || "there";
    const clientCompany = inv.billTo.company?.trim() || clientName;
    const paymentDetailsLine =
      inv.paymentDetails && inv.paymentDetails.trim().length > 0 ? `- Details: ${inv.paymentDetails}` : "";

    const subject = tpl.subject
      .replaceAll("{{clientName}}", clientName)
      .replaceAll("{{clientCompany}}", clientCompany)
      .replaceAll("{{invoiceNumber}}", inv.invoiceNumber)
      .replaceAll("{{total}}", formatMoney(inv.total))
      .replaceAll("{{currency}}", inv.currency)
      .replaceAll("{{dueDate}}", inv.dueDate)
      .replaceAll("{{paymentMethod}}", inv.paymentMethod)
      .replaceAll("{{paymentDetails}}", inv.paymentDetails || "")
      .replaceAll("{{businessName}}", businessName)
      .replaceAll("{{paymentDetailsLine}}", paymentDetailsLine);

    const body = tpl.body
      .replaceAll("{{clientName}}", clientName)
      .replaceAll("{{clientCompany}}", clientCompany)
      .replaceAll("{{invoiceNumber}}", inv.invoiceNumber)
      .replaceAll("{{total}}", formatMoney(inv.total))
      .replaceAll("{{currency}}", inv.currency)
      .replaceAll("{{dueDate}}", inv.dueDate)
      .replaceAll("{{paymentMethod}}", inv.paymentMethod)
      .replaceAll("{{paymentDetails}}", inv.paymentDetails || "")
      .replaceAll("{{businessName}}", businessName)
      .replaceAll("{{paymentDetailsLine}}", paymentDetailsLine);

    return { subject, body };
  };

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "invoiceTemplates"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || "Untitled",
          subject: data.subject || "",
          body: data.body || "",
          createdAt: data.createdAt || "",
          updatedAt: data.updatedAt || "",
        } as InvoiceMessageTemplate;
      });
      setTemplates(rows);
    });
    return () => unsub();
  }, [user]);

  const handleToggleArchive = async (inv: InvoicePreview) => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "invoices", inv.invoiceDocId),
        { archived: !inv.archived, archivedAt: !inv.archived ? new Date().toISOString() : null, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (err) {
      console.error(err);
      setInvoiceFormError("Could not archive invoice. Please try again.");
    }
  };

  const handleDeleteInvoice = async (inv: InvoicePreview) => {
    if (!user) return;
    if (inv.status !== "Draft") {
      setInvoiceFormError("Only Draft invoices can be permanently deleted.");
      return;
    }
    const ok = window.confirm(`Permanently delete invoice ${inv.invoiceNumber}? This cannot be undone.`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "invoices", inv.invoiceDocId));
    } catch (err) {
      console.error(err);
      setInvoiceFormError("Could not delete invoice. Please try again.");
    }
  };

  const handleSendToClient = async () => {
    if (!user) return;
    if (!invoice) return;
    if (savingSend || invoice.status !== "Draft") return;
    if (!invoice.invoiceDocId) {
      setInvoiceFormError("Save an invoice first before sending.");
      return;
    }
    if (!invoice.billTo?.email) {
      setInvoiceFormError("Client email is missing. Add the client email to send.");
      return;
    }

    setSavingSend(true);
    setInvoiceFormError(null);
    try {
      await setDoc(
        doc(db, "invoices", invoice.invoiceDocId),
        {
          userId: user.uid,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          dueDate: invoice.dueDate,
          status: "Sent",
          currency: invoice.currency,
          billTo: invoice.billTo,
          billFrom: invoice.billFrom,
          lineItems: invoice.lineItems,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          total: invoice.total,
          invoiceId: invoice.invoiceNumber,
          paymentMethod: invoice.paymentMethod,
          paymentDetails: invoice.paymentDetails,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setInvoice((prev) => ({ ...prev, status: "Sent" }));

      const { subject, body } = buildInvoiceEmail({ ...invoice, status: "Sent" });
      const tpl =
        selectedTemplateId === "default"
          ? defaultTemplate
          : templates.find((t) => t.id === selectedTemplateId) || defaultTemplate;
      const rendered = applyTemplate(invoice, { subject: tpl.subject, body: tpl.body });

      setSendReady({ to: invoice.billTo.email, subject: rendered.subject, body: rendered.body });
      setSendDraft({ to: invoice.billTo.email, subject: rendered.subject, body: rendered.body });
      setTemplateName(tpl.name);

      // Best-effort: try to copy + open email, but always show manual controls in UI.
      try {
        await navigator.clipboard.writeText(body);
        showToast("Copied invoice message. Ready to send.");
      } catch {
        showToast("Invoice marked as Sent. Ready to send.");
      }

      // Do not force-open external apps. The user can choose a channel in the send composer.
    } catch (err) {
      console.error(err);
      setInvoiceFormError("Could not update invoice status. Please try again.");
    } finally {
      setSavingSend(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!user || !invoice || invoice.status === "Paid") return;
    if (!invoice.invoiceDocId) {
      setInvoiceFormError("Save an invoice first before marking it as paid.");
      return;
    }
    if (invoice.status !== "Sent") {
      setInvoiceFormError("Send the invoice first (status must be Sent) before marking it as Paid.");
      return;
    }
    setSavingPaid(true);
    setInvoiceFormError(null);
    try {
      const finalCurrency = currency || invoice.currency || "USD";

      // Prevent duplicate finance rows by using a deterministic document id per invoice.
      const financeDocId = getFinanceDocId(invoice.invoiceDocId);

      // 1) Persist invoice status in `invoices`
      await setDoc(
        doc(db, "invoices", invoice.invoiceDocId),
        {
          userId: user.uid,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          dueDate: invoice.dueDate,
          status: "Paid",
          currency: finalCurrency,
          billTo: invoice.billTo,
          billFrom: invoice.billFrom,
          lineItems: invoice.lineItems,
          subtotal: invoice.subtotal,
          tax: invoice.tax,
          total: invoice.total,
          invoiceId: invoice.invoiceNumber,
          financeEntryId: financeDocId,
          paidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          paymentMethod: invoice.paymentMethod,
          paymentDetails: invoice.paymentDetails,
        },
        { merge: true }
      );

      // 2) Upsert the linked finance entry (A-flow)
      await setDoc(doc(db, "finance", financeDocId), {
        // FinanceEntry fields (mirrors src/app/pages/Finance.tsx expectations)
        userId: user.uid,
        date: invoice.date,
        description: `Invoice ${invoice.invoiceNumber}`,
        category: "Freelance Work",
        amount: invoice.total,
        currency: finalCurrency,
        status: "Received", // Recommended for income payments
        client: invoice.billTo.company ? `${invoice.billTo.name} (${invoice.billTo.company})` : invoice.billTo.name,
        type: "income",
        dueDate: invoice.dueDate,
        isBadDebt: false,
        invoiceId: invoice.invoiceNumber,
        createdAt: new Date().toISOString(),
      });

      setInvoice((prev) => ({ ...prev, status: "Paid", currency: finalCurrency }));
    } catch (err) {
      console.error(err);
      setInvoiceFormError("Could not mark invoice as paid. Please try again.");
    } finally {
      setSavingPaid(false);
    }
  };

  const handleSaveNewInvoice = async () => {
    if (!user) return;
    setInvoiceFormError(null);

    if (!draft.clientId) {
      setInvoiceFormError("Please select a client.");
      return;
    }
    if (!draft.dueDate) {
      setInvoiceFormError("Please set a due date.");
      return;
    }

    const lineItems = computedDraft.lineItems.filter((li) => li.title.trim().length > 0);
    if (lineItems.length === 0) {
      setInvoiceFormError("Please add at least one line item (title + qty/rate).");
      return;
    }

    // Use Firestore doc id as the unique key to prevent overwriting invoices.
    const invoiceRef = doc(collection(db, "invoices"));
    const invoiceDocId = invoiceRef.id;
    const invoiceNumber = `INV-${new Date().getFullYear()}-${invoiceDocId.slice(-6).toUpperCase()}`;

    const billTo: BillTo = {
      name: selectedClient?.name || "",
      company: selectedClient?.company || "",
      email: selectedClient?.email || "",
      address: "",
      city: "",
    };

    const nextInvoice: InvoicePreview = {
      invoiceDocId,
      invoiceNumber,
      date: draft.invoiceDate,
      dueDate: draft.dueDate,
      status: "Draft",
      currency,
      billTo,
      billFrom: invoice?.billFrom || { name: "", business: "", email: "", address: "", city: "" },
      lineItems,
      subtotal: computedDraft.subtotal,
      tax: computedDraft.tax,
      total: computedDraft.total,
      paymentMethod: draft.paymentMethod,
      paymentDetails: draft.paymentDetails,
      archived: false,
      createdAt: new Date().toISOString(),
    };

    setSavingInvoice(true);
    try {
      await setDoc(
        doc(db, "invoices", invoiceDocId),
        {
          ...nextInvoice,
          userId: user.uid,
          invoiceId: nextInvoice.invoiceNumber,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          archived: false,
        },
        { merge: true }
      );

      setInvoice(nextInvoice);
      setSelectedInvoiceId(invoiceDocId);
      setShowNewInvoice(false);
    } catch (err) {
      console.error(err);
      setInvoiceFormError("Could not save invoice. Please try again.");
    } finally {
      setSavingInvoice(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#0F1B2D' }}>
              Invoices
            </h1>
            <p className="text-gray-600">Create, send and track invoice payments</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium ${
                showArchived ? "bg-[#0F1B2D] text-white border-[#0F1B2D]" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {showArchived ? "Showing Archived" : "Hide Archived"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 mb-6">
          <Button
            variant="secondary"
            onClick={() => setShowNewInvoice((v) => !v)}
            disabled={savingInvoice}
          >
            {showNewInvoice ? "Close New Invoice" : "New Invoice"}
          </Button>

          <div className="text-sm text-gray-500">
            {clients.length === 0 ? "Add clients first to generate invoices." : `Clients available: ${clients.length}`}
          </div>
        </div>

        {invoiceFormError && !showNewInvoice && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
            {invoiceFormError}
          </div>
        )}

        {invoiceToast && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
            {invoiceToast}
          </div>
        )}

        {sendReady && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-auto"
               onClick={() => { setSendReady(null); setSendDraft(null); }}>
            <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <Card className="p-0 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div>
                    <p className="font-semibold" style={{ color: "#0F1B2D" }}>Send invoice</p>
                    <p className="text-sm text-gray-500">To: {sendDraft?.to}</p>
                  </div>
                  <button
                    onClick={() => { setSendReady(null); setSendDraft(null); }}
                    className="p-2 rounded-lg hover:bg-gray-50 border border-gray-200"
                    title="Close"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {sendStatus && (
                    <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700">
                      {sendStatus}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Template</label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => setSelectedTemplateId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      >
                        <option value="default">{defaultTemplate.name}</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Send via</label>
                      <select
                        value={sendChannel}
                        onChange={(e) => setSendChannel(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      >
                        <option>Email</option>
                        <option>WhatsApp</option>
                        <option>Telegram</option>
                        <option>Copy</option>
                      </select>
                    </div>
                  </div>

                  {sendChannel === "Email" && (
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Send from</label>
                      <div className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                        {gmailConnected && gmailEmail ? `My Gmail (${gmailEmail})` : "My Gmail (not connected yet)"}
                      </div>
                      {!gmailConnected && (
                        <p className="text-xs text-gray-500 mt-2">
                          <Link to="/settings?tab=integrations" className="text-[#0F1B2D] underline font-medium">
                            Connect Gmail
                          </Link>{" "}
                          to send invoices from your own address. Until then, use “Copy” or WhatsApp/Telegram.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Subject</label>
                    <input
                      value={sendDraft?.subject || ""}
                      onChange={(e) => setSendDraft((prev) => prev ? ({ ...prev, subject: e.target.value }) : prev)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Message</label>
                    <textarea
                      value={sendDraft?.body || ""}
                      onChange={(e) => setSendDraft((prev) => prev ? ({ ...prev, body: e.target.value }) : prev)}
                      rows={12}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={async () => {
                        if (!sendDraft) return;
                        try {
                          await navigator.clipboard.writeText(sendDraft.body);
                          showToast("Copied message to clipboard.");
                        } catch {
                          showToast("Clipboard permission blocked.");
                        }
                      }}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                    >
                      Copy
                    </button>

                    {sendDraft && sendChannel === "Email" && (
                      <button
                        className="px-3 py-2 rounded-lg bg-[#0F1B2D] text-white text-sm font-medium hover:bg-[#1a2942] transition-colors disabled:opacity-50"
                        disabled={sendingEmail || !gmailConnected}
                        onClick={async () => {
                          if (!sendDraft || !invoice) return;
                          if (!gmailConnected) {
                            showToast("Connect Gmail in Settings first.");
                            setSendStatus("Connect Gmail in Settings → Integrations, then try again.");
                            return;
                          }
                          try {
                            setSendingEmail(true);
                            setSendStatus(null);
                            const idToken = await auth.currentUser?.getIdToken();
                            if (!idToken) {
                              showToast("Please log in again.");
                              return;
                            }
                            const resp = await fetch("/api/send-invoice-email", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                idToken,
                                to: sendDraft.to,
                                subject: sendDraft.subject,
                                body: sendDraft.body,
                                invoiceDocId: invoice.invoiceDocId,
                              }),
                            });
                            const { data: json, raw } = await readResponseJson<{ error?: string }>(resp);
                            if (!resp.ok) {
                              const msg = apiErrorMessage(json, raw, "Email failed to send.");
                              showToast(msg);
                              setSendStatus(msg);
                              return;
                            }
                            showToast("Email sent.");
                            setSendStatus("Email sent successfully. Check your inbox/spam folder.");
                          } catch (e) {
                            console.error(e);
                            showToast("Email failed to send.");
                            setSendStatus("Email failed to send.");
                          } finally {
                            setSendingEmail(false);
                          }
                        }}
                      >
                        {sendingEmail ? "Sending..." : "Send Email"}
                      </button>
                    )}

                    {sendDraft && sendChannel === "WhatsApp" && (
                      <a
                        className="px-3 py-2 rounded-lg bg-[#0F1B2D] text-white text-sm font-medium hover:bg-[#1a2942] transition-colors"
                        href={`https://wa.me/?text=${encodeURIComponent(`${sendDraft.subject}\n\n${sendDraft.body}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open WhatsApp
                      </a>
                    )}

                    {sendDraft && sendChannel === "Telegram" && (
                      <a
                        className="px-3 py-2 rounded-lg bg-[#0F1B2D] text-white text-sm font-medium hover:bg-[#1a2942] transition-colors"
                        href={`https://t.me/share/url?text=${encodeURIComponent(`${sendDraft.subject}\n\n${sendDraft.body}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Telegram
                      </a>
                    )}

                    {sendDraft && sendChannel === "Copy" && (
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(`${sendDraft.subject}\n\n${sendDraft.body}`);
                            showToast("Copied subject + message.");
                          } catch {
                            showToast("Clipboard permission blocked.");
                          }
                        }}
                        className="px-3 py-2 rounded-lg bg-[#0F1B2D] text-white text-sm font-medium hover:bg-[#1a2942] transition-colors"
                      >
                        Copy all
                      </button>
                    )}
                  </div>

                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">Manage templates</p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm flex-1 min-w-[180px]"
                        placeholder="Template name"
                      />
                      <button
                        onClick={async () => {
                          if (!user || !sendDraft) return;
                          const ref = doc(collection(db, "invoiceTemplates"));
                          await setDoc(doc(db, "invoiceTemplates", ref.id), {
                            userId: user.uid,
                            name: templateName.trim() || "Untitled",
                            subject: sendDraft.subject,
                            body: sendDraft.body,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                          });
                          showToast("Template saved.");
                          setSelectedTemplateId(ref.id);
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                      >
                        Save as new
                      </button>
                      <button
                        onClick={async () => {
                          if (!user || !sendDraft) return;
                          if (selectedTemplateId === "default") {
                            showToast("Built-in template cannot be updated.");
                            return;
                          }
                          await setDoc(doc(db, "invoiceTemplates", selectedTemplateId), {
                            userId: user.uid,
                            name: templateName.trim() || "Untitled",
                            subject: sendDraft.subject,
                            body: sendDraft.body,
                            updatedAt: new Date().toISOString(),
                          }, { merge: true });
                          showToast("Template updated.");
                        }}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
                      >
                        Update
                      </button>
                      <button
                        onClick={async () => {
                          if (!user) return;
                          if (selectedTemplateId === "default") return;
                          const ok = window.confirm("Delete this template?");
                          if (!ok) return;
                          await deleteDoc(doc(db, "invoiceTemplates", selectedTemplateId));
                          setSelectedTemplateId("default");
                          showToast("Template deleted.");
                        }}
                        className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Invoices list + filters */}
        {invoices.filter((inv) => (showArchived ? true : !inv.archived)).length > 0 ? (
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: "#0F1B2D" }}>
                Invoices
              </h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Filter:</span>
                {(["All", "Draft", "Sent", "Paid", "Overdue"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s === "All" ? "All" : (s as InvoiceStatus))}
                    className={`px-3 py-1 rounded-full border text-xs font-medium ${
                      statusFilter === s || (statusFilter === "All" && s === "All")
                        ? "bg-[#0F1B2D] text-white border-[#0F1B2D]"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-500">
                    <th className="text-left py-2 px-2 font-medium">Invoice #</th>
                    <th className="text-left py-2 px-2 font-medium">Client</th>
                    <th className="text-left py-2 px-2 font-medium">Date</th>
                    <th className="text-left py-2 px-2 font-medium">Due</th>
                    <th className="text-center py-2 px-2 font-medium">Status</th>
                    <th className="text-right py-2 px-2 font-medium">Total</th>
                    <th className="text-right py-2 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices
                    .filter((inv) => (showArchived ? true : !inv.archived))
                    .filter((inv) => (statusFilter === "All" ? true : inv.status === statusFilter))
                    .map((inv) => {
                      const isSelected = selectedInvoiceId === inv.invoiceDocId;
                      return (
                        <tr
                          key={inv.invoiceDocId}
                          onClick={() => {
                            setSelectedInvoiceId(inv.invoiceDocId);
                            setInvoice(inv);
                            setOpenInvoiceId(inv.invoiceDocId);
                          }}
                          className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                            isSelected ? "bg-gray-50" : ""
                          }`}
                        >
                          <td className="py-2 px-2" style={{ color: "#0F1B2D" }}>
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-2 px-2 text-gray-600">
                            {inv.billTo?.name || "—"}
                          </td>
                          <td className="py-2 px-2 text-gray-600">{inv.date}</td>
                          <td className="py-2 px-2 text-gray-600">{inv.dueDate}</td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                inv.status === "Paid"
                                  ? "bg-green-50 text-green-700"
                                  : inv.status === "Sent"
                                  ? "bg-blue-50 text-blue-700"
                                  : inv.status === "Overdue"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-gray-50 text-gray-600"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-gray-700">
                            {inv.total.toLocaleString()} {inv.currency}
                          </td>
                          <td className="py-2 px-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                className="text-xs px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleArchive(inv);
                                }}
                                title={inv.archived ? "Unarchive" : "Archive"}
                              >
                                <Archive className="w-4 h-4" />
                              </button>
                              <button
                                className={`text-xs px-2 py-1 rounded-lg border ${
                                  inv.status === "Draft" ? "border-red-200 hover:bg-red-50 text-red-600" : "border-gray-200 text-gray-300 cursor-not-allowed"
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (inv.status !== "Draft") return;
                                  handleDeleteInvoice(inv);
                                }}
                                title={inv.status === "Draft" ? "Delete" : "Only Draft can be deleted"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="mb-6">
            <div className="text-center py-10">
              <p className="text-gray-600 mb-2">No invoices yet.</p>
              <p className="text-sm text-gray-500 mb-5">Create your first invoice to start tracking payments.</p>
              <Button variant="primary" onClick={() => setShowNewInvoice(true)}>New Invoice</Button>
            </div>
          </Card>
        )}

        {showNewInvoice && (
          <Card className="mb-6">
            <h2 className="text-lg font-bold mb-4" style={{ color: "#0F1B2D" }}>
              Create Invoice (Draft)
            </h2>

            {invoiceFormError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
                {invoiceFormError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="text-sm font-medium text-gray-700 block mb-1">Client</label>
                <select
                  value={draft.clientId}
                  onChange={(e) => setDraft((prev) => ({ ...prev, clientId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                >
                  <option value="" disabled>Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={draft.invoiceDate}
                  onChange={(e) => setDraft((prev) => ({ ...prev, invoiceDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Due Date</label>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                />
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ color: "#0F1B2D" }}>
                  Line Items
                </h3>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                    lineItems: [...prev.lineItems, { title: "", description: "", qty: 1, rate: 0 }],
                    }))
                  }
                  disabled={savingInvoice}
                >
                  Add Line
                </Button>
              </div>

              <div className="space-y-4">
                {draft.lineItems.map((li, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-700 block mb-1">Title (required)</label>
                      <input
                        type="text"
                        value={li.title}
                        onChange={(e) =>
                          setDraft((prev) => {
                            const next = [...prev.lineItems];
                            next[idx] = { ...next[idx], title: e.target.value };
                            return { ...prev, lineItems: next };
                          })
                        }
                        placeholder="e.g. Logo Design"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                      />

                      <label className="text-sm font-medium text-gray-700 block mb-1 mt-3">Description (optional)</label>
                      <input
                        type="text"
                        value={li.description || ""}
                        onChange={(e) =>
                          setDraft((prev) => {
                            const next = [...prev.lineItems];
                            next[idx] = { ...next[idx], description: e.target.value };
                            return { ...prev, lineItems: next };
                          })
                        }
                        placeholder="Add details (optional)"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Qty</label>
                      <input
                        type="number"
                        min="0"
                        value={li.qty}
                        onChange={(e) =>
                          setDraft((prev) => {
                            const next = [...prev.lineItems];
                            next[idx] = { ...next[idx], qty: Number(e.target.value) };
                            return { ...prev, lineItems: next };
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Rate</label>
                      <input
                        type="number"
                        min="0"
                        value={li.rate}
                        onChange={(e) =>
                          setDraft((prev) => {
                            const next = [...prev.lineItems];
                            next[idx] = { ...next[idx], rate: Number(e.target.value) };
                            return { ...prev, lineItems: next };
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                      />
                    </div>

                    <div className="md:col-span-4 text-sm text-gray-600">
                      Amount: <span className="font-semibold" style={{ color: "#0F1B2D" }}>{(Number(li.qty) * Number(li.rate)).toLocaleString()}</span>
                      <Button
                        variant="ghost"
                        className="ml-3"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            lineItems: prev.lineItems.length <= 1 ? prev.lineItems : prev.lineItems.filter((_, i) => i !== idx),
                          }))
                        }
                        disabled={savingInvoice || draft.lineItems.length <= 1}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 block mb-1">Tax % (MVP)</label>
                <input
                  type="number"
                  min="0"
                  value={draft.taxPercent}
                  onChange={(e) => setDraft((prev) => ({ ...prev, taxPercent: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                />
              </div>
              <div>
                <div className="text-sm text-gray-500">
                  Subtotal: <span className="font-medium" style={{ color: "#0F1B2D" }}>{computedDraft.subtotal.toLocaleString()}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Tax: <span className="font-medium" style={{ color: "#0F1B2D" }}>{computedDraft.tax.toLocaleString()}</span>
                </div>
                <div className="text-sm text-gray-500">
                  Total: <span className="font-bold" style={{ color: "#0F1B2D" }}>{computedDraft.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Payment Method</label>
                <select
                  value={draft.paymentMethod}
                  onChange={(e) => setDraft((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                >
                  <option>Bank Transfer</option>
                  <option>Flutterwave</option>
                  <option>Cash</option>
                  <option>Card</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Payment Details (optional)</label>
                <textarea
                  value={draft.paymentDetails}
                  onChange={(e) => setDraft((prev) => ({ ...prev, paymentDetails: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <Button
                variant="primary"
                onClick={handleSaveNewInvoice}
                disabled={savingInvoice}
              >
                {savingInvoice ? "Saving..." : "Save Draft Invoice"}
              </Button>
              <Button variant="ghost" onClick={() => setShowNewInvoice(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Invoice Preview (modal) */}
        {openInvoiceId && invoice && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-auto"
            onClick={() => setOpenInvoiceId(null)}
          >
            <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={currentStatus.variant} className="flex items-center gap-2">
                    <StatusIcon className="w-4 h-4" />
                    {invoice.status}
                  </Badge>
                  <span className="text-sm text-white/80">Invoice {invoice.invoiceNumber}</span>
                </div>
                <button
                  onClick={() => setOpenInvoiceId(null)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-12">
            <div>
              <h2 className="text-4xl font-bold mb-2" style={{ color: '#0F1B2D' }}>
                INVOICE
              </h2>
              <p className="text-gray-600">#{invoice.invoiceNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg mb-1" style={{ color: '#0F1B2D' }}>
                {invoice.billFrom.business}
              </p>
              <p className="text-sm text-gray-600">{invoice.billFrom.name}</p>
              <p className="text-sm text-gray-600">{invoice.billFrom.email}</p>
              <p className="text-sm text-gray-600">{invoice.billFrom.address}</p>
              <p className="text-sm text-gray-600">{invoice.billFrom.city}</p>
            </div>
          </div>

          {/* Bill To & Dates */}
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-3">BILL TO</p>
              <p className="font-semibold mb-1" style={{ color: '#0F1B2D' }}>
                {invoice.billTo.name}
              </p>
              <p className="text-sm text-gray-600">{invoice.billTo.company}</p>
              <p className="text-sm text-gray-600">{invoice.billTo.email}</p>
              <p className="text-sm text-gray-600">{invoice.billTo.address}</p>
              <p className="text-sm text-gray-600">{invoice.billTo.city}</p>
            </div>
            <div>
              <div className="mb-4">
                <p className="text-sm font-semibold text-gray-500 mb-1">INVOICE DATE</p>
                <p className="font-medium" style={{ color: '#0F1B2D' }}>
                  {invoice.date}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-1">DUE DATE</p>
                <p className="font-medium" style={{ color: '#0F1B2D' }}>
                  {invoice.dueDate}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">TITLE / DESCRIPTION</th>
                  <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">QTY</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">RATE</th>
                  <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-4 px-2 text-sm" style={{ color: '#0F1B2D' }}>
                      <div className="font-medium">{item.title}</div>
                      {item.description && item.description.trim().length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                      )}
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
                  ${invoice.subtotal.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <p className="text-sm text-gray-600">Tax (10%)</p>
                <p className="font-medium" style={{ color: '#0F1B2D' }}>
                  ${invoice.tax.toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-between py-4 bg-[#0F1B2D] rounded-xl px-4 mt-4">
                <p className="font-bold text-white">TOTAL</p>
                <p className="text-2xl font-bold text-white">
                  ${invoice.total.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-500 mb-2">PAYMENT DETAILS</p>
            <p className="text-sm text-gray-600">
              <span className="font-medium" style={{ color: "#0F1B2D" }}>{invoice.paymentMethod}:</span>{" "}
              {invoice.paymentDetails}
            </p>
          </div>

          {/* Notes */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-500 mb-2">NOTES</p>
            <p className="text-sm text-gray-600">
              Thank you for your business! Payment is due within 14 days of invoice date. Please make payment to the account details provided separately.
            </p>
          </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" className="flex items-center gap-2" disabled>
                  <Download className="w-4 h-4" />
                  Download PDF (soon)
                </Button>
                <Button
                  variant="secondary"
                  className="flex items-center gap-2"
                  onClick={handleSendToClient}
                  disabled={savingSend || invoice.status !== "Draft" || !invoice.invoiceDocId}
                >
                  <Send className="w-4 h-4" />
                  {savingSend ? "Sending..." : "Send"}
                </Button>
                <Button
                  variant="primary"
                  className="flex items-center gap-2"
                  onClick={handleMarkPaid}
                  disabled={savingPaid || invoice.status !== "Sent" || !invoice.invoiceDocId}
                >
                  <Check className="w-4 h-4" />
                  {savingPaid ? "Saving..." : invoice.status === "Paid" ? "Paid" : "Mark as Paid"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
