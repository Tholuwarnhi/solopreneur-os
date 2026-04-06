import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { Upload, FileText, Download, Loader2, Check, AlertCircle, Camera, Image } from "lucide-react";
import Tesseract from 'tesseract.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import Button from "../components/Button";
import Card from "../components/Card";

interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    bbox: [number, number, number, number];
    confidence: number;
  }>;
}

interface ProcessedDocument {
  id: string;
  originalFile: File;
  extractedText: string;
  wordDocument?: Blob;
  confidence: number;
  processedAt: Date;
}

export default function DocumentScanner() {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [processedDocs, setProcessedDocs] = useState<ProcessedDocument[]>([]);
  const [processing, setProcessing] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const processFile = async (file: File): Promise<OCRResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const image = new Image();
          image.onload = async () => {
            try {
              const result = await Tesseract.recognize(
                image,
                'eng',
                {
                  logger: (m) => {
                    if (m.status === 'recognizing text') {
                      setCurrentProgress(Math.round(m.progress * 100));
                    }
                  }
                }
              );

              resolve({
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words
              });
            } catch (error) {
              reject(error);
            }
          };

          image.onerror = () => reject(new Error('Failed to load image'));
          image.src = e.target?.result as string;
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const createWordDocument = async (text: string): Promise<Blob> => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: text,
                size: 24,
                font: "Calibri"
              })
            ]
          })
        ]
      }]
    });

    return await Packer.toBlob(doc);
  };

  const processAllFiles = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setCurrentProgress(0);

    try {
      const results: ProcessedDocument[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentProgress(Math.round((i / files.length) * 100));

        try {
          // Process with Tesseract.js (free OCR)
          const ocrResult = await processFile(file);
          
          // Create Word document
          const wordBlob = await createWordDocument(ocrResult.text);

          const processedDoc: ProcessedDocument = {
            id: Date.now().toString() + i,
            originalFile: file,
            extractedText: ocrResult.text,
            wordDocument: wordBlob,
            confidence: ocrResult.confidence,
            processedAt: new Date()
          };

          results.push(processedDoc);
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          
          // Add error result
          const errorDoc: ProcessedDocument = {
            id: Date.now().toString() + i,
            originalFile: file,
            extractedText: `Error processing file: ${error}`,
            confidence: 0,
            processedAt: new Date()
          };
          
          results.push(errorDoc);
        }
      }

      setProcessedDocs(results);
      setCurrentProgress(100);
    } catch (error) {
      console.error('Error processing files:', error);
    } finally {
      setProcessing(false);
    }
  };

  const downloadWordDocument = (doc: ProcessedDocument) => {
    if (doc.wordDocument) {
      const fileName = `converted-${doc.originalFile.name.replace(/\.[^/.]+$/, "")}.docx`;
      saveAs(doc.wordDocument, fileName);
    }
  };

  const downloadTextFile = (doc: ProcessedDocument) => {
    const textBlob = new Blob([doc.extractedText], { type: 'text/plain' });
    const fileName = `converted-${doc.originalFile.name.replace(/\.[^/.]+$/, "")}.txt`;
    saveAs(textBlob, fileName);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setProcessedDocs([]);
    setCurrentProgress(0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return <Check className="w-4 h-4 text-green-600" />;
    if (confidence >= 60) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
    return <AlertCircle className="w-4 h-4 text-red-600" />;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "#0F1B2D" }}>
          Document Scanner & OCR
        </h1>
        <p className="text-gray-600">
          Extract text from images and PDFs, convert to Word documents instantly
        </p>
      </div>

      {/* Upload Area */}
      <Card className="mb-8 p-8">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">
            Drop files here or click to browse
          </h3>
          <p className="text-gray-600 mb-4">
            Supports images (JPG, PNG, WebP) and PDF files
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            Select Files
          </Button>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Files to Process</h3>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear All
              </Button>
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {file.type.startsWith('image/') ? (
                      <Image className="w-5 h-5 text-gray-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-500" />
                    )}
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>

            {/* Process Button */}
            <div className="mt-6 text-center">
              <Button
                onClick={processAllFiles}
                disabled={processing || files.length === 0}
                className="flex items-center gap-2"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing... {currentProgress}%
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Extract Text & Convert to Word
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Progress Bar */}
      {processing && (
        <Card className="mb-8 p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Processing documents...</span>
                <span className="text-sm text-gray-600">{currentProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${currentProgress}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {processedDocs.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Processed Documents</h3>
          <div className="space-y-4">
            {processedDocs.map((doc) => (
              <div key={doc.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    {doc.originalFile.type.startsWith('image/') ? (
                      <Image className="w-5 h-5 text-gray-500" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-500" />
                    )}
                    <div>
                      <p className="font-medium">{doc.originalFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {doc.processedAt.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getConfidenceIcon(doc.confidence)}
                    <span className={`text-sm font-medium ${getConfidenceColor(doc.confidence)}`}>
                      {Math.round(doc.confidence)}% confidence
                    </span>
                  </div>
                </div>

                {/* Extracted Text Preview */}
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Extracted Text:</h4>
                  <div className="bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {doc.extractedText.substring(0, 500)}
                      {doc.extractedText.length > 500 && '...'}
                    </p>
                  </div>
                </div>

                {/* Download Options */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTextFile(doc)}
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Text
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadWordDocument(doc)}
                    className="flex items-center gap-2"
                    disabled={!doc.wordDocument}
                  >
                    <Download className="w-4 h-4" />
                    Download Word
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Features Section */}
      <Card className="mt-8 p-6">
        <h3 className="text-lg font-semibold mb-4">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Free Unlimited OCR</p>
              <p className="text-sm text-gray-600">Powered by Tesseract.js - no API costs</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Multi-format Support</p>
              <p className="text-sm text-gray-600">Images, PDFs, screenshots</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Word Document Export</p>
              <p className="text-sm text-gray-600">Editable .docx files</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Batch Processing</p>
              <p className="text-sm text-gray-600">Process multiple files at once</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
