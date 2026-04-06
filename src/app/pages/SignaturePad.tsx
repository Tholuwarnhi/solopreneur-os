import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Pen, Type, Upload, Download, Save, Trash2, Check, X, FileText, Image } from "lucide-react";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { download } from '../../lib/download';
import Button from "../components/Button";
import Card from "../components/Card";

interface SignatureField {
  id: string;
  type: 'signature' | 'date' | 'text' | 'initial';
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  value?: string;
  signed: boolean;
}

interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: Date;
}

interface DocumentTemplate {
  id: string;
  name: string;
  fields: SignatureField[];
  backgroundUrl?: string;
}

export default function SignaturePad() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [selectedSignature, setSelectedSignature] = useState<string>('');
  const [signatureType, setSignatureType] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [selectedFont, setSelectedFont] = useState('cursive');
  const [fontSize, setFontSize] = useState(24);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [currentDocument, setCurrentDocument] = useState<DocumentTemplate | null>(null);
  const [documentFields, setDocumentFields] = useState<SignatureField[]>([]);
  const [uploadedDocument, setUploadedDocument] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fonts = [
    { name: 'Cursive', value: 'cursive' },
    { name: 'Print', value: 'Arial' },
    { name: 'Script', value: 'Brush Script MT' },
    { name: 'Formal', value: 'Georgia' },
  ];

  useEffect(() => {
    loadSavedSignatures();
  }, []);

  const loadSavedSignatures = () => {
    const saved = localStorage.getItem('savedSignatures');
    if (saved) {
      setSignatures(JSON.parse(saved));
    }
  };

  const saveSignaturesToStorage = (sigs: SavedSignature[]) => {
    localStorage.setItem('savedSignatures', JSON.stringify(sigs));
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (signatureType !== 'draw') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || signatureType !== 'draw') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL();
    const newSignature: SavedSignature = {
      id: Date.now().toString(),
      name: `Signature ${signatures.length + 1}`,
      dataUrl,
      createdAt: new Date()
    };

    const updatedSignatures = [...signatures, newSignature];
    setSignatures(updatedSignatures);
    saveSignaturesToStorage(updatedSignatures);
  };

  const deleteSignature = (id: string) => {
    const updatedSignatures = signatures.filter(sig => sig.id !== id);
    setSignatures(updatedSignatures);
    saveSignaturesToStorage(updatedSignatures);
  };

  const loadSignatureToCanvas = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      clearCanvas();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
  };

  const drawTypedSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !typedSignature) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearCanvas();
    ctx.font = `${fontSize}px ${selectedFont}`;
    ctx.fillStyle = strokeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      loadSignatureToCanvas(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedDocument(file);
    
    // Convert to image for preview
    if (file.type === 'application/pdf') {
      // For PDF, we'd need a PDF to image converter
      // For now, just show file info
      setDocumentPreview('');
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addSignatureField = (type: SignatureField['type']) => {
    const newField: SignatureField = {
      id: Date.now().toString(),
      type,
      x: 50,
      y: 50 + (documentFields.length * 80),
      width: type === 'signature' ? 200 : 150,
      height: type === 'signature' ? 60 : 30,
      required: true,
      signed: false
    };

    setDocumentFields([...documentFields, newField]);
  };

  const updateFieldPosition = (fieldId: string, x: number, y: number) => {
    setDocumentFields(fields =>
      fields.map(field =>
        field.id === fieldId ? { ...field, x, y } : field
      )
    );
  };

  const signField = (fieldId: string, value: string) => {
    setDocumentFields(fields =>
      fields.map(field =>
        field.id === fieldId ? { ...field, value, signed: true } : field
      )
    );
  };

  const createSignedPDF = async () => {
    if (!uploadedDocument) return;

    setIsProcessing(true);
    try {
      let pdfDoc: PDFDocument;

      if (uploadedDocument.type === 'application/pdf') {
        // Load existing PDF
        const existingPdfBytes = await uploadedDocument.arrayBuffer();
        pdfDoc = await PDFDocument.load(existingPdfBytes);
      } else {
        // Create new PDF from image
        pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4 size
        
        if (documentPreview) {
          const imgBytes = await fetch(documentPreview).then(res => res.arrayBuffer());
          const img = await pdfDoc.embedJpg(imgBytes);
          page.drawImage(img, {
            x: 50,
            y: 400,
            width: 495,
            height: 350
          });
        }
      }

      // Add signature fields
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      for (const field of documentFields) {
        if (field.signed && field.value) {
          const page = pdfDoc.getPages()[0];
          
          if (field.type === 'signature') {
            // For signature fields, we'd need to convert canvas to image and embed
            // For now, just add text
            page.drawText(field.value, {
              x: field.x,
              y: 842 - field.y - 20,
              size: 12,
              font: font,
              color: rgb(0, 0, 0)
            });
          } else {
            page.drawText(field.value, {
              x: field.x,
              y: 842 - field.y - 20,
              size: 12,
              font: font,
              color: rgb(0, 0, 0)
            });
          }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      download(blob, `signed-document-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error creating signed PDF:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL();
    const link = document.createElement('a');
    link.download = `signature-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>
          Digital Signature Studio
        </h1>
        <p className="text-gray-600">
          Create, manage, and apply digital signatures to documents
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Signature Creation Area */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Create Signature</h3>
          
          {/* Signature Type Selection */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={signatureType === 'draw' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSignatureType('draw')}
            >
              <Pen className="w-4 h-4 mr-2" />
              Draw
            </Button>
            <Button
              variant={signatureType === 'type' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSignatureType('type')}
            >
              <Type className="w-4 h-4 mr-2" />
              Type
            </Button>
            <Button
              variant={signatureType === 'upload' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSignatureType('upload')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          </div>

          {/* Drawing Controls */}
          {signatureType === 'draw' && (
            <div className="space-y-4 mb-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Color:</label>
                <input
                  type="color"
                  value={strokeColor}
                  onChange={(e) => setStrokeColor(e.target.value)}
                  className="w-10 h-10 border rounded"
                />
                <label className="text-sm font-medium">Width:</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={strokeWidth}
                  onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm w-8">{strokeWidth}px</span>
              </div>
            </div>
          )}

          {/* Typed Signature Controls */}
          {signatureType === 'type' && (
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type your signature:</label>
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  placeholder="Type your signature"
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Font:</label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="flex-1 p-2 border rounded"
                >
                  {fonts.map(font => (
                    <option key={font.value} value={font.value}>{font.name}</option>
                  ))}
                </select>
                <label className="text-sm font-medium">Size:</label>
                <input
                  type="number"
                  min="12"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-16 p-2 border rounded"
                />
              </div>
              <Button onClick={drawTypedSignature} variant="outline">
                Apply Typed Signature
              </Button>
            </div>
          )}

          {/* Upload Controls */}
          {signatureType === 'upload' && (
            <div className="mb-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="signature-upload"
              />
              <Button onClick={() => document.getElementById('signature-upload')?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Choose Image File
              </Button>
            </div>
          )}

          {/* Canvas */}
          <div className="border-2 border-gray-300 rounded-lg mb-4 bg-white">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              className="cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={clearCanvas} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button onClick={saveSignature} variant="outline" size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button onClick={downloadSignature} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </Card>

        {/* Saved Signatures */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Saved Signatures</h3>
          <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {signatures.map((signature) => (
              <div
                key={signature.id}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  selectedSignature === signature.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => {
                  setSelectedSignature(signature.id);
                  loadSignatureToCanvas(signature.dataUrl);
                }}
              >
                <img
                  src={signature.dataUrl}
                  alt={signature.name}
                  className="w-full h-16 object-contain mb-2"
                />
                <p className="text-sm font-medium truncate">{signature.name}</p>
                <p className="text-xs text-gray-500">
                  {signature.createdAt.toLocaleDateString()}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSignature(signature.id);
                  }}
                  className="mt-2"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Document Signing Area */}
      <Card className="mt-8 p-6">
        <h3 className="text-lg font-semibold mb-4">Sign Document</h3>
        
        {/* Document Upload */}
        <div className="mb-6">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleDocumentUpload}
            className="hidden"
            id="document-upload"
          />
          <Button onClick={() => document.getElementById('document-upload')?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {uploadedDocument && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="w-4 h-4" />
              {uploadedDocument.name}
            </div>

            {/* Document Preview */}
            {documentPreview && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <img
                  src={documentPreview}
                  alt="Document preview"
                  className="max-w-full h-auto max-h-96 object-contain"
                />
              </div>
            )}

            {/* Add Signature Fields */}
            <div className="space-y-2">
              <p className="font-medium">Add signature fields:</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addSignatureField('signature')}
                >
                  <Pen className="w-4 h-4 mr-2" />
                  Signature
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addSignatureField('date')}
                >
                  Date
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addSignatureField('text')}
                >
                  Text
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addSignatureField('initial')}
                >
                  Initials
                </Button>
              </div>
            </div>

            {/* Signature Fields */}
            {documentFields.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Signature fields:</p>
                {documentFields.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 p-2 border rounded">
                    <span className="text-sm">{field.type}</span>
                    {field.signed ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const canvas = canvasRef.current;
                          if (canvas) {
                            const value = canvas.toDataURL();
                            signField(field.id, value);
                          }
                        }}
                      >
                        Sign
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Create Signed PDF */}
            <Button
              onClick={createSignedPDF}
              disabled={isProcessing || documentFields.length === 0}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Create Signed PDF
                </>
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
