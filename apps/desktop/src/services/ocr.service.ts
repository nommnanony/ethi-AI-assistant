import { create } from 'zustand';

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBoxes?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }>;
}

export interface OCRState {
  isProcessing: boolean;
  lastResult: OCRResult | null;
  error: string | null;
  
  setProcessing: (processing: boolean) => void;
  setResult: (result: OCRResult | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useOCRStore = create<OCRState>((set) => ({
  isProcessing: false,
  lastResult: null,
  error: null,

  setProcessing: (isProcessing) => set({ isProcessing }),
  setResult: (lastResult) => set({ lastResult, error: null }),
  setError: (error) => set({ error, isProcessing: false }),
  reset: () => set({ isProcessing: false, lastResult: null, error: null }),
}));

class OCRService {
  async processImage(imageSource: string | Blob | File): Promise<OCRResult> {
    useOCRStore.getState().setProcessing(true);
    useOCRStore.getState().reset();

    try {
      const imageData = await this.loadImage(imageSource);
      
      if (window.electronAPI?.sendVisionQuery) {
        const result = await this.processWithVisionAPI(imageData);
        useOCRStore.getState().setResult(result);
        return result;
      }

      throw new Error('OCR processing not available. Please configure AI vision.');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'OCR processing failed';
      useOCRStore.getState().setError(errorMessage);
      throw new Error(errorMessage);
    }
  }

  private async loadImage(source: string | Blob | File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (source instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(source);
      } else if (typeof source === 'string') {
        if (source.startsWith('data:')) {
          resolve(source);
        } else {
          reject(new Error('Invalid image source'));
        }
      } else {
        reject(new Error('Invalid image source'));
      }
    });
  }

  private async processWithVisionAPI(imageData: string): Promise<OCRResult> {
    if (window.electronAPI?.sendVisionQuery) {
      const result = await window.electronAPI.sendVisionQuery({
        text: 'Extract all text from this image. Return the complete text content.',
        imageBase64: imageData.split(',')[1] || '',
        apiKey: localStorage.getItem('apiKey_openai') || '',
        model: 'gpt-4o',
      });

      return {
        text: result.response,
        confidence: 0.9,
      };
    }

    throw new Error('Vision API not available');
  }
}

export const ocrService = new OCRService();
