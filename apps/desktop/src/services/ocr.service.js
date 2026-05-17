import { create } from 'zustand';
export const useOCRStore = create((set) => ({
    isProcessing: false,
    lastResult: null,
    error: null,
    setProcessing: (isProcessing) => set({ isProcessing }),
    setResult: (lastResult) => set({ lastResult, error: null }),
    setError: (error) => set({ error, isProcessing: false }),
    reset: () => set({ isProcessing: false, lastResult: null, error: null }),
}));
class OCRService {
    async processImage(imageSource) {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'OCR processing failed';
            useOCRStore.getState().setError(errorMessage);
            throw new Error(errorMessage);
        }
    }
    async loadImage(source) {
        return new Promise((resolve, reject) => {
            if (source instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read image'));
                reader.readAsDataURL(source);
            }
            else if (typeof source === 'string') {
                if (source.startsWith('data:')) {
                    resolve(source);
                }
                else {
                    reject(new Error('Invalid image source'));
                }
            }
            else {
                reject(new Error('Invalid image source'));
            }
        });
    }
    async processWithVisionAPI(imageData) {
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
