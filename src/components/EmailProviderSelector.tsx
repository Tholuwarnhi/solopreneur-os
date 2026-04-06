import { useState } from 'react';
import { Mail, MessageSquare, Send, Copy, Download } from 'lucide-react';
import { EmailService, EmailConfig } from '../lib/emailService';
import Button from './Button';

interface EmailProviderSelectorProps {
  invoiceData: {
    invoiceNumber: string;
    clientName: string;
    clientEmail: string;
    items: any[];
    total: number;
    currency: string;
    issueDate: string;
    dueDate: string;
    signatureData?: string;
  };
}

export default function EmailProviderSelector({ invoiceData }: EmailProviderSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<'mailto' | 'clipboard' | 'template' | 'export'>('mailto');

  const createEmailConfig = (): EmailConfig => ({
    from: 'your-email@example.com',
    to: [invoiceData.clientEmail],
    subject: `Invoice ${invoiceData.invoiceNumber} from ${invoiceData.clientName}`,
    body: `
Dear ${invoiceData.clientName},

Please find attached invoice ${invoiceData.invoiceNumber} for your records.

Invoice Details:
- Invoice Number: ${invoiceData.invoiceNumber}
- Issue Date: ${invoiceData.issueDate}
- Due Date: ${invoiceData.dueDate}
- Total Amount: ${invoiceData.currency} ${invoiceData.total.toFixed(2)}

You can view the full invoice in our system or download the PDF version.

Thank you for your business!

Best regards,
Solopreneur OS
    `.trim()
  });

  const handleSend = () => {
    const config = createEmailConfig();
    
    switch (selectedMethod) {
      case 'mailto':
        EmailService.sendViaMailto(config);
        break;
      case 'clipboard':
        EmailService.copyToClipboard(config);
        break;
      case 'template':
        EmailService.generateEmailTemplate(invoiceData);
        window.open('', '_blank').document.write(EmailService.generateEmailTemplate(invoiceData));
        break;
      case 'export':
        EmailService.exportAsEmailFile(config);
        break;
    }
  };

  const providers = [
    {
      id: 'mailto',
      name: 'Default Email App',
      description: 'Opens your default email client',
      icon: Mail,
      color: 'bg-blue-500'
    },
    {
      id: 'clipboard',
      name: 'Copy to Clipboard',
      description: 'Copy email content to paste anywhere',
      icon: Copy,
      color: 'bg-green-500'
    },
    {
      id: 'template',
      name: 'Email Template',
      description: 'Open formatted email in new tab',
      icon: MessageSquare,
      color: 'bg-purple-500'
    },
    {
      id: 'export',
      name: 'Export as HTML',
      description: 'Download email as HTML file',
      icon: Download,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Send Invoice</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {providers.map((provider) => {
          const Icon = provider.icon;
          return (
            <button
              key={provider.id}
              onClick={() => setSelectedMethod(provider.id)}
              className={`p-4 rounded-xl border-2 transition-all ${
                selectedMethod === provider.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${provider.color}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">{provider.name}</div>
                  <div className="text-xs text-gray-500">{provider.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Button
        onClick={handleSend}
        className="w-full rounded-full"
        size="lg"
      >
        <Send className="w-4 h-4 mr-2" />
        Send Invoice
      </Button>

      <div className="bg-blue-50 p-4 rounded-xl">
        <h4 className="font-medium text-blue-900 mb-2">Why Multiple Options?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Default Email:</strong> Opens Gmail, Outlook, Apple Mail</li>
          <li>• <strong>Clipboard:</strong> Copy to WhatsApp, Slack, or any app</li>
          <li>• <strong>Template:</strong> Professional HTML email format</li>
          <li>• <strong>Export:</strong> Save as file to send later</li>
        </ul>
      </div>
    </div>
  );
}
