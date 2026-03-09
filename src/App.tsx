import React, { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { QrCode, Download, Settings2, FileText, Loader2, Eye, Image as ImageIcon } from "lucide-react";
import bwipjs from "bwip-js";
import * as htmlToImage from "html-to-image";

interface DataMatrixPreviewProps {
  code: string;
  codeSizeCm: number;
  fontSizePt: number;
  marginCm: number;
}

const DataMatrixPreview: React.FC<DataMatrixPreviewProps> = ({ code, codeSizeCm, fontSizePt, marginCm }) => {
  const [imgSrc, setImgSrc] = useState<string>("");

  useEffect(() => {
    if (code) {
      try {
        const canvas = document.createElement('canvas');
        bwipjs.toCanvas(canvas, {
          bcid: 'datamatrix',
          text: code,
          scale: 3,
          includetext: false,
        });
        setImgSrc(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error(`Error generating preview for ${code}:`, e);
      }
    }
  }, [code]);

  const cmToPt = 28.3465;
  const codeSizePt = codeSizeCm * cmToPt;
  const marginPt = marginCm * cmToPt;

  return (
    <div 
      style={{ 
        width: `${codeSizePt + marginPt * 2}pt`, 
        minHeight: `${codeSizePt + fontSizePt + marginPt * 2 + 5}pt`,
        padding: `${marginPt}pt`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {imgSrc && (
        <img 
          src={imgSrc} 
          alt={code}
          style={{ 
            width: `${codeSizePt}pt`, 
            height: `${codeSizePt}pt`,
            display: 'block'
          }} 
        />
      )}
      <div 
        style={{ 
          marginTop: '5pt', 
          fontSize: `${fontSizePt}pt`, 
          width: `${codeSizePt}pt`, 
          textAlign: 'center',
          wordBreak: 'break-all',
          lineHeight: 1,
          color: 'black',
          fontFamily: 'Helvetica, Arial, sans-serif'
        }}
      >
        {code}
      </div>
    </div>
  );
}

export default function App() {
  const [codesText, setCodesText] = useState("");
  const [codeSize, setCodeSize] = useState(2.5);
  const [fontSize, setFontSize] = useState(10);
  const [margin, setMargin] = useState(0.5);
  const [previewCodes, setPreviewCodes] = useState<string[]>([]);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const codes = codesText
        .split("\n")
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
        .slice(0, 500); // Limit preview to 500
      setPreviewCodes(codes);
    }, 500);
    return () => clearTimeout(timer);
  }, [codesText]);

  const handleSaveImage = async (format: 'png' | 'jpeg') => {
    if (!previewRef.current) return;
    
    setIsSavingImage(true);
    
    const parent = previewRef.current.parentElement;
    const originalOverflow = parent?.style.overflow;
    const originalMaxHeight = parent?.style.maxHeight;
    
    if (parent) {
      parent.style.overflow = 'visible';
      parent.style.maxHeight = 'none';
      // Small delay to allow DOM to update before capturing
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const options = {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        fontEmbedCSS: '',
      };

      let dataUrl = '';
      if (format === 'png') {
        dataUrl = await htmlToImage.toPng(previewRef.current, options);
      } else {
        dataUrl = await htmlToImage.toJpeg(previewRef.current, {
          ...options,
          quality: 1.0,
        });
      }
      
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `podglad_datamatrix.${format === 'jpeg' ? 'jpg' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success(`Pomyślnie zapisano podgląd jako ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Error saving image:", error);
      toast.error("Wystąpił błąd podczas zapisywania obrazu");
    } finally {
      if (parent) {
        parent.style.overflow = originalOverflow || '';
        parent.style.maxHeight = originalMaxHeight || '';
      }
      setIsSavingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <QrCode className="w-6 h-6" />
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              DataMatrix Generator
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Input */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-medium">Lista kodów</h2>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Wklej listę tekstów do wygenerowania kodów DataMatrix. Każdy kod w nowej linii. Maksymalnie 500 kodów.
              </p>
              <textarea
                className="w-full h-96 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow font-mono text-sm resize-none"
                placeholder="PAL-12345\nPAL-12346\nPAL-12347..."
                value={codesText}
                onChange={(e) => setCodesText(e.target.value)}
              />
              <div className="mt-2 text-sm flex justify-between">
                <span className={codesText.split("\n").filter(c => c.trim().length > 0).length > 500 ? "text-red-500 font-medium" : "text-slate-500"}>
                  Liczba linii: {codesText.split("\n").filter(c => c.trim().length > 0).length}
                </span>
                <span className="text-slate-500">Limit: 500</span>
              </div>
            </div>
          </div>

          {/* Right Column - Settings & Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-6">
                <Settings2 className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-medium">Ustawienia kodu 2D</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rozmiar kodu (cm)
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={codeSize}
                    onChange={(e) => setCodeSize(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rozmiar czcionki (pt)
                  </label>
                  <input
                    type="number"
                    min="6"
                    max="24"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Margines (cm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* PDF Preview Section */}
        <div className="mt-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-medium">Podgląd kodów</h2>
              </div>
              
              {previewCodes.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveImage('jpeg')}
                    disabled={isSavingImage}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    <span>Zapisz JPG</span>
                  </button>
                  <button
                    onClick={() => handleSaveImage('png')}
                    disabled={isSavingImage}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    <span>Zapisz PNG</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="bg-white rounded-xl p-4 flex overflow-auto min-h-[600px] max-h-[800px] border border-slate-200">
              {previewCodes.length > 0 ? (
                <div 
                  ref={previewRef}
                  className="w-full bg-white"
                  style={{ 
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignContent: 'flex-start',
                  }}
                >
                  {previewCodes.map((code, idx) => (
                    <DataMatrixPreview 
                      key={`${code}-${idx}`} 
                      code={code} 
                      codeSizeCm={codeSize} 
                      fontSizePt={fontSize} 
                      marginCm={margin} 
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-400 flex flex-col items-center justify-center w-full">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Wklej kody, aby zobaczyć podgląd</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
