/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload, 
  Plus, 
  Download, 
  Trash2, 
  Check, 
  Maximize2, 
  Minimize2, 
  Move, 
  Image as ImageIcon,
  Layers,
  Settings2,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface AdSize {
  id: string;
  name: string;
  width: number;
  height: number;
  category: string;
}

interface Offset {
  x: number;
  y: number;
  zoom: number;
  fitMode: 'fill';
  bgStyle: 'blur' | 'solid' | 'none';
  bgColor: string;
  padding: number;
}

// --- Constants ---

const AD_SIZES: AdSize[] = [
  { id: "m-sq", name: "Meta: Feed (1:1)", width: 1080, height: 1080, category: "Meta" },
  { id: "m-st", name: "Meta: Story/Reels", width: 1080, height: 1920, category: "Meta" },
  { id: "m-land", name: "Meta: Landscape", width: 1200, height: 628, category: "Meta" },
  { id: "g-rec", name: "Google: Rectangle", width: 300, height: 250, category: "Google" },
  { id: "t-sq", name: "TikTok: Feed", width: 1080, height: 1920, category: "TikTok" },
  { id: "x-post", name: "X: Post", width: 1200, height: 675, category: "X" },
];

export default function App() {
  const [sourceImg, setSourceImg] = useState<HTMLImageElement | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<AdSize[]>(AD_SIZES);
  const [customSizes, setCustomSizes] = useState<AdSize[]>([]);
  const [offsets, setOffsets] = useState<Record<string, Offset>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const workCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- Handlers ---

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSourceImg(img);
        setShowResults(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif']
    },
    multiple: false
  } as any);

  const toggleSize = (size: AdSize) => {
    setSelectedSizes(prev => {
      const exists = prev.find(s => s.id === size.id);
      if (exists) return prev.filter(s => s.id !== size.id);
      return [...prev, size];
    });
  };

  const addCustomSize = (w: number, h: number) => {
    if (w > 0 && h > 0) {
      const newItem: AdSize = {
        id: 'c' + Date.now(),
        name: `مقاس يدوي (${w}x${h})`,
        width: w,
        height: h,
        category: "Custom"
      };
      setCustomSizes(prev => [...prev, newItem]);
      setSelectedSizes(prev => [...prev, newItem]);
    }
  };

  const updateOffset = (key: string, updates: Partial<Offset>) => {
    setOffsets(prev => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }));
  };

  const drawImage = (size: AdSize, offset: Offset): string => {
    const canvas = workCanvasRef.current;
    if (!canvas || !sourceImg) return '';

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    canvas.width = size.width;
    canvas.height = size.height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const sW = sourceImg.width;
    const sH = sourceImg.height;
    const sRatio = sW / sH;
    
    // Apply padding to target dimensions
    const pX = size.width * (offset.padding || 0);
    const pY = size.height * (offset.padding || 0);
    const safeW = size.width - (pX * 2);
    const safeH = size.height - (pY * 2);
    const tRatio = safeW / safeH;

    // Smart Fill (Fill mode) always stretches to fill the target area.
    // We only need pan controls if the user zooms in.

    const drawW = safeW * offset.zoom;
    const drawH = safeH * offset.zoom;

    const dx = pX + (safeW - drawW) * offset.x;
    const dy = pY + (safeH - drawH) * offset.y;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Background (for padding)
    if (offset.padding > 0) {
      if (offset.bgStyle === 'blur') {
        ctx.save();
        ctx.filter = 'blur(40px) brightness(0.8)';
        let bW, bH;
        const canvasRatio = size.width / size.height;
        if (sRatio > canvasRatio) {
          bH = size.height;
          bW = bH * sRatio;
        } else {
          bW = size.width;
          bH = bW / sRatio;
        }
        ctx.drawImage(sourceImg, (size.width - bW) / 2, (size.height - bH) / 2, bW, bH);
        ctx.restore();
      } else if (offset.bgStyle === 'solid') {
        ctx.fillStyle = offset.bgColor;
        ctx.fillRect(0, 0, size.width, size.height);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size.width, size.height);
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);
    }

    // Draw main image with high quality
    ctx.drawImage(sourceImg, dx, dy, drawW, drawH);

    // Apply high-quality sharpening and clarity (Smart Fill)
    try {
        const imageData = ctx.getImageData(0, 0, size.width, size.height);
        const weights = [
          -0.1, -0.2, -0.1,
          -0.2,  2.2, -0.2,
          -0.1, -0.2, -0.1
        ];
        const side = 3;
        const halfSide = 1;
        const src = imageData.data;
        const sw = imageData.width;
        const sh = imageData.height;
        const output = ctx.createImageData(sw, sh);
        const dst = output.data;

        // Sharpening Pass
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const dstOff = (y * sw + x) * 4;
            let r = 0, g = 0, b = 0;
            for (let cy = 0; cy < side; cy++) {
              for (let cx = 0; cx < side; cx++) {
                const scy = Math.min(sh - 1, Math.max(0, y + cy - halfSide));
                const scx = Math.min(sw - 1, Math.max(0, x + cx - halfSide));
                const srcOff = (scy * sw + scx) * 4;
                const wt = weights[cy * side + cx];
                r += src[srcOff] * wt;
                g += src[srcOff + 1] * wt;
                b += src[srcOff + 2] * wt;
              }
            }
            
            // Apply a slight "Clarity" (local contrast) effect by boosting midtones
            // and sharpening edges more aggressively
            dst[dstOff] = Math.min(255, Math.max(0, r));
            dst[dstOff + 1] = Math.min(255, Math.max(0, g));
            dst[dstOff + 2] = Math.min(255, Math.max(0, b));
            dst[dstOff + 3] = src[dstOff + 3];
          }
        }
        ctx.putImageData(output, 0, 0);
        
        // Final "Clarity" and "Contrast" pass using global filters for efficiency
        ctx.save();
        // Boost contrast and saturation slightly to make logos/text pop
        // We use a multi-pass approach for better results
        ctx.filter = 'contrast(1.12) saturate(1.08) brightness(1.02) blur(0.2px)';
        ctx.globalAlpha = 0.15;
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();

        // One more pass for edge definition
        ctx.save();
        ctx.filter = 'contrast(1.05) brightness(1.05)';
        ctx.globalAlpha = 0.05;
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();

        // Mild Unsharp Mask Pass (High-Pass Sharpening)
        try {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tempCtx = tempCanvas.getContext('2d')!;
          
          // 1. Create a blurred version of the current state on tempCanvas
          tempCtx.filter = 'blur(1px)';
          tempCtx.drawImage(canvas, 0, 0);
          
          // 2. Get the difference (high-pass) on tempCanvas
          tempCtx.filter = 'none';
          tempCtx.globalCompositeOperation = 'difference';
          tempCtx.drawImage(canvas, 0, 0);
          
          // 3. Apply the high-pass back to the original with 'overlay'
          ctx.save();
          ctx.globalCompositeOperation = 'overlay';
          ctx.globalAlpha = 0.15; // Mild sharpening
          ctx.drawImage(tempCanvas, 0, 0);
          ctx.restore();
        } catch (e) {
          console.warn("Unsharp mask failed:", e);
        }
      } catch (e) {
        console.warn("Advanced processing failed:", e);
      }

    // Use PNG for maximum quality, or high-quality JPEG if PNG is too large
    // For this app, we'll use PNG to ensure the user gets exactly what they see
    return canvas.toDataURL('image/png');
  };

  const downloadImage = (size: AdSize) => {
    const key = `${size.width}x${size.height}`;
    const offset = offsets[key] || { x: 0.5, y: 0.5, zoom: 1, fitMode: 'fill', bgStyle: 'none', bgColor: '#ffffff', padding: 0 };
    const dataUrl = drawImage(size, offset);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${size.name}_HD.png`;
    link.click();
  };

  const downloadAll = async () => {
    setIsProcessing(true);
    for (let i = 0; i < selectedSizes.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      downloadImage(selectedSizes[i]);
    }
    setIsProcessing(false);
  };

  // Initialize offsets
  useEffect(() => {
    const newOffsets = { ...offsets };
    selectedSizes.forEach(size => {
      const key = `${size.width}x${size.height}`;
      if (!newOffsets[key]) {
        newOffsets[key] = { 
          x: 0.5, 
          y: 0.5, 
          zoom: 1, 
          fitMode: 'fill', 
          bgStyle: 'none', 
          bgColor: '#ffffff',
          padding: 0
        };
      }
    });
    setOffsets(newOffsets);
  }, [selectedSizes]);

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-[#333] font-sans rtl" dir="rtl">
      <div className="p-5 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          
          {/* Sidebar */}
          <aside className="bg-white rounded-2xl p-6 shadow-sm flex flex-col gap-6 h-fit lg:sticky lg:top-5 max-h-[calc(100vh-40px)] overflow-y-auto border border-gray-100">
            
            <header className="flex items-center gap-2 text-[#1a73e8]">
              <ImageIcon className="w-6 h-6" />
              <h1 className="text-xl font-bold">مُعدل المقاسات الاحترافي</h1>
            </header>

            {/* Step 1: Upload */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span className="bg-[#1a73e8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">1</span>
                رفع الصورة الأصلية
              </h3>
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-[#1a73e8] bg-[#f0f7ff]' : 'border-gray-200 hover:border-[#1a73e8] hover:bg-[#f8fbff]'}`}
              >
                <input {...getInputProps()} />
                {sourceImg ? (
                  <div className="space-y-3">
                    <img 
                      src={sourceImg.src} 
                      alt="Preview" 
                      className="max-h-32 mx-auto rounded-lg shadow-md border border-gray-200"
                    />
                    <p className="text-xs font-medium text-[#1a73e8]">تم الرفع بنجاح ✅</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-[#f0f7ff] w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6 text-[#1a73e8]" />
                    </div>
                    <p className="text-sm font-bold text-[#1a73e8]">اضغط أو اسحب الصورة هنا</p>
                    <p className="text-xs text-gray-400">يدعم JPG, PNG, WebP</p>
                  </div>
                )}
              </div>
            </section>

            {/* Step 2: Custom Size */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span className="bg-[#1a73e8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">2</span>
                مقاس مخصص
              </h3>
              <div className="flex gap-2 bg-[#f8fafc] p-3 rounded-xl border border-gray-100">
                <input 
                  type="number" 
                  id="customW" 
                  placeholder="العرض" 
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent outline-none transition-all"
                />
                <input 
                  type="number" 
                  id="customH" 
                  placeholder="الطول" 
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent outline-none transition-all"
                />
                <button 
                  onClick={() => {
                    const w = parseInt((document.getElementById('customW') as HTMLInputElement).value);
                    const h = parseInt((document.getElementById('customH') as HTMLInputElement).value);
                    addCustomSize(w, h);
                  }}
                  className="bg-[#1a73e8] text-white p-2 rounded-lg hover:bg-[#1557b0] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </section>

            {/* Step 3: Platform Selection */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <span className="bg-[#1a73e8] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">3</span>
                اختر المقاسات المطلوبة
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                {[...AD_SIZES, ...customSizes].map((size) => {
                  const isSelected = selectedSizes.some(s => s.id === size.id);
                  return (
                    <button
                      key={size.id}
                      onClick={() => toggleSize(size)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-right ${isSelected ? 'border-[#1a73e8] bg-[#f0f7ff]' : 'border-gray-50 hover:border-gray-200 bg-white'}`}
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-[#1a73e8] border-[#1a73e8]' : 'bg-white border-gray-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold">{size.name}</p>
                        <p className="text-[10px] text-gray-500">{size.width} × {size.height} px</p>
                      </div>
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{size.category}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <button 
              onClick={() => {
                if (sourceImg && selectedSizes.length > 0) {
                  setShowResults(true);
                  // Scroll to results on mobile
                  if (window.innerWidth < 1024) {
                    document.getElementById('mainArea')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }
              }}
              disabled={!sourceImg || selectedSizes.length === 0}
              className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-200 transition-all duration-300 ${(!sourceImg || selectedSizes.length === 0) ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#1a73e8] hover:bg-[#1557b0] active:scale-[0.98]'}`}
            >
              عرض النتائج وتعديل الزوايا
            </button>
          </aside>

          {/* Main Content Area */}
          <main id="mainArea" className="bg-white rounded-2xl p-8 shadow-sm min-h-[600px] border border-gray-100">
            <AnimatePresence mode="wait">
              {!showResults ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20"
                >
                  <div className="bg-[#f0f7ff] w-24 h-24 rounded-full flex items-center justify-center text-5xl">✨</div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-gray-800">النتائج ستظهر هنا بأعلى جودة</h2>
                    <p className="text-gray-500 max-w-md mx-auto">
                      ارفع صورتك واختر المقاسات المناسبة، وسنقوم بتوليد نسخ احترافية مع إمكانية التحكم الكامل في القص والاحتواء.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <div className="flex items-center gap-1">
                      <Maximize2 className="w-4 h-4" />
                      <span>تغطية كاملة</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Minimize2 className="w-4 h-4" />
                      <span>احتواء التصميم</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Move className="w-4 h-4" />
                      <span>تحريك حر</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8"
                >
                  <header className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-100 pb-6">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold text-[#1a73e8] flex items-center gap-2">
                        النتائج الاحترافية HD ✨
                      </h2>
                      <p className="text-sm text-gray-500">يمكنك تعديل وضعية كل صورة بشكل مستقل قبل التحميل.</p>
                    </div>
                    <button 
                      onClick={downloadAll}
                      disabled={isProcessing}
                      className="flex items-center gap-2 bg-[#28a745] hover:bg-[#218838] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-green-100 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-5 h-5" />
                      )}
                      تحميل الكل بالجودة الأصلية
                    </button>
                  </header>

                  {/* Info Box for Smart Fill */}
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                    <ShieldCheck className="w-5 h-5 shrink-0 text-blue-600" />
                    <p>
                      <strong>نصيحة:</strong> وضع <strong>"التعبئة الذكية"</strong> يقوم بمط الصورة لتناسب المقاس تماماً مع تحسين الجودة. إذا كانت هناك شعارات مهمة، استخدم <strong>"هامش الأمان"</strong> لترك مساحة حولها.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-8">
                    {selectedSizes.map((size) => {
                      const key = `${size.width}x${size.height}`;
                      const offset = offsets[key] || { x: 0.5, y: 0.5, zoom: 1, fitMode: 'fill', bgStyle: 'none', bgColor: '#ffffff', padding: 0 };
                      
                      const needsHorizontal = offset.zoom > 1;
                      const needsVertical = offset.zoom > 1;

                      return (
                        <div key={size.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                          {/* Preview Container */}
                          <div className="bg-[#f8fafc] aspect-video flex items-center justify-center p-4 relative group overflow-hidden">
                            <div 
                              className="relative shadow-2xl transition-all duration-300 overflow-hidden"
                              style={{ 
                                width: size.width, 
                                height: size.height,
                                maxWidth: '100%',
                                maxHeight: '100%',
                                aspectRatio: `${size.width}/${size.height}`,
                                backgroundColor: offset.bgStyle === 'solid' ? offset.bgColor : '#ffffff'
                              }}
                            >
                              {/* Background Layer (Blur) */}
                              {offset.padding > 0 && offset.bgStyle === 'blur' && (
                                <div 
                                  className="absolute inset-0 z-0"
                                  style={{
                                    backgroundImage: `url(${sourceImg!.src})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    filter: 'blur(20px) brightness(0.8)',
                                    transform: 'scale(1.2)'
                                  }}
                                />
                              )}

                              {/* Main Image Layer */}
                              <img 
                                src={sourceImg!.src} 
                                alt={size.name}
                                className="absolute inset-0 w-full h-full z-10 transition-transform duration-200"
                                style={{
                                  objectFit: 'fill',
                                  objectPosition: `${offset.x * 100}% ${offset.y * 100}%`,
                                  transform: `scale(${offset.zoom})`,
                                  padding: `${offset.padding * 100}%`,
                                  imageRendering: 'auto',
                                  filter: 'contrast(1.2) saturate(1.1) brightness(1.05) drop-shadow(0 0 1px rgba(0,0,0,0.1))'
                                }}
                              />
                            </div>

                            <div className="absolute top-3 right-3 flex gap-2 z-20">
                              <span className="bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-[10px] font-bold border border-gray-100 shadow-sm">
                                {size.width} × {size.height}
                              </span>
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="p-6 space-y-5 flex-1 flex flex-col">
                            <div className="flex justify-between items-center">
                              <h4 className="font-bold text-gray-800">{size.name}</h4>
                              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                <span className="text-[10px] font-bold text-blue-600">تعبئة ذكية (Smart Fill)</span>
                              </div>
                            </div>

                            {/* Reset to Default Button */}
                            <button 
                              onClick={() => {
                                updateOffset(key, { 
                                  fitMode: 'fill', 
                                  padding: 0, 
                                  zoom: 1, 
                                  x: 0.5, 
                                  y: 0.5,
                                  bgStyle: 'none'
                                });
                              }}
                              className="w-full py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-[11px] font-bold transition-all flex items-center justify-center gap-2"
                            >
                              <Settings2 className="w-4 h-4" />
                              إعادة ضبط المقاس
                            </button>

                            <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                              
                              {/* Zoom Control */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                                    <Settings2 className="w-3 h-3" />
                                    مستوى التكبير (Zoom):
                                  </label>
                                  <span className="text-[10px] font-mono text-gray-400">{Math.round(offset.zoom * 100)}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0.5" 
                                  max="2" 
                                  step="0.01" 
                                  value={offset.zoom}
                                  onChange={(e) => updateOffset(key, { zoom: parseFloat(e.target.value) })}
                                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1a73e8]"
                                />
                              </div>

                              {/* Padding Control (Safe Margin) */}
                              <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                                    <Maximize2 className="w-3 h-3" />
                                    هامش الأمان (Safe Margin):
                                  </label>
                                  <span className="text-[10px] font-mono text-gray-400">{Math.round(offset.padding * 100)}%</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="0.4" 
                                  step="0.01" 
                                  value={offset.padding}
                                  onChange={(e) => updateOffset(key, { padding: parseFloat(e.target.value) })}
                                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1a73e8]"
                                />
                              </div>

                              {/* Pan Controls */}
                              {(needsHorizontal || needsVertical) && (
                                <div className="space-y-3 pt-2 border-t border-gray-200">
                                  {needsHorizontal && (
                                    <div className="space-y-2">
                                      <label className="text-[11px] font-bold text-[#1a73e8] flex items-center gap-1">
                                        ↔️ تحريك أفقي:
                                      </label>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.001" 
                                        value={offset.x}
                                        onChange={(e) => updateOffset(key, { x: parseFloat(e.target.value) })}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1a73e8]"
                                      />
                                    </div>
                                  )}
                                  {needsVertical && (
                                    <div className="space-y-2">
                                      <label className="text-[11px] font-bold text-[#1a73e8] flex items-center gap-1">
                                        ↕️ تحريك رأسي:
                                      </label>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="1" 
                                        step="0.001" 
                                        value={offset.y}
                                        onChange={(e) => updateOffset(key, { y: parseFloat(e.target.value) })}
                                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1a73e8]"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Background Style for Padding */}
                              {offset.padding > 0 && (
                                <div className="space-y-2 pt-2 border-t border-gray-200">
                                  <label className="text-[11px] font-bold text-gray-500">نمط الخلفية:</label>
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => updateOffset(key, { bgStyle: 'blur' })}
                                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${offset.bgStyle === 'blur' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}
                                    >
                                      تضبيب (Blur)
                                    </button>
                                    <button 
                                      onClick={() => updateOffset(key, { bgStyle: 'solid' })}
                                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${offset.bgStyle === 'solid' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}
                                    >
                                      لون سادة
                                    </button>
                                    <button 
                                      onClick={() => updateOffset(key, { bgStyle: 'none' })}
                                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${offset.bgStyle === 'none' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}
                                    >
                                      بدون
                                    </button>
                                  </div>
                                  {offset.bgStyle === 'solid' && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <input 
                                        type="color" 
                                        value={offset.bgColor}
                                        onChange={(e) => updateOffset(key, { bgColor: e.target.value })}
                                        className="w-8 h-8 rounded border-none cursor-pointer"
                                      />
                                      <span className="text-[10px] font-mono text-gray-400 uppercase">{offset.bgColor}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {(offset.zoom === 1 && offset.padding === 0) && (
                                <div className="text-center py-2 text-[11px] text-green-600 font-medium bg-green-50 rounded-lg border border-green-100">
                                  تعبئة ذكية نشطة (Smart Fill Active) ✅
                                </div>
                              )}
                            </div>

                            <button 
                              onClick={() => downloadImage(size)}
                              className="w-full py-3 bg-[#f0f7ff] text-[#1a73e8] rounded-xl font-bold text-sm hover:bg-[#1a73e8] hover:text-white transition-all flex items-center justify-center gap-2 mt-auto"
                            >
                              <Download className="w-4 h-4" />
                              تحميل هذه الصورة
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Hidden Canvas for Processing */}
      <canvas ref={workCanvasRef} className="hidden" />

      {/* Global Styles for Custom Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #1a73e8;
        }
      `}</style>
    </div>
  );
}
