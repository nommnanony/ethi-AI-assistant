#include <napi.h>
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <vector>
#include <atomic>
#include <mutex>

#define REFTIMES_PER_SEC 10000000
#define REFTIMES_PER_MILLISEC 10000

static std::atomic<bool> g_capturing(false);
static std::vector<float> g_audioBuffer;
static std::mutex g_bufferMutex;
static IMMDevice* g_device = nullptr;
static IAudioClient* g_audioClient = nullptr;
static IAudioCaptureClient* g_captureClient = nullptr;

class SystemAudioCapture {
public:
    static Napi::Value StartCapture(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        if (g_capturing.load()) {
            return Napi::Boolean::New(env, true);
        }

        HRESULT hr;
        
        // Get the default audio endpoint ( playback device for system audio )
        IMMDeviceEnumerator* pEnumerator = nullptr;
        hr = CoCreateInstance(
            __uuidof(MMDeviceEnumerator),
            nullptr,
            CLSCTX_ALL,
            __uuidof(IMMDeviceEnumerator),
            (void**)&pEnumerator
        );

        if (hr != S_OK) {
            return Napi::Boolean::New(env, false);
        }

        hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &g_device);
        pEnumerator->Release();

        if (hr != S_OK || g_device == nullptr) {
            return Napi::Boolean::New(env, false);
        }

        // Activate the audio client
        hr = g_device->Activate(
            __uuidof(IAudioClient),
            CLSCTX_ALL,
            nullptr,
            (void**)&g_audioClient
        );

        if (hr != S_OK) {
            g_device->Release();
            g_device = nullptr;
            return Napi::Boolean::New(env, false);
        }

        // Get the mix format
        WAVEFORMATEX* pwfx = nullptr;
        hr = g_audioClient->GetMixFormat(&pwfx);
        
        if (hr != S_OK || pwfx == nullptr) {
            g_audioClient->Release();
            g_audioClient = nullptr;
            g_device->Release();
            g_device = nullptr;
            return Napi::Boolean::New(env, false);
        }

        // Set audio format to 16kHz mono for better compatibility
        pwfx->wFormatTag = WAVE_FORMAT_PCM;
        pwfx->nChannels = 1;
        pwfx->nSamplesPerSec = 16000;
        pwfx->nAvgBytesPerSec = 32000;
        pwfx->nBlockAlign = 2;
        pwfx->wBitsPerSample = 16;

        // Initialize the audio client
        hr = g_audioClient->Initialize(
            AUDIO_CLIENT_SHAREMODE_SHARED,
            0,
            REFTIMES_PER_SEC,
            0,
            pwfx,
            nullptr
        );

        CoTaskMemFree(pwfx);

        if (hr != S_OK) {
            g_audioClient->Release();
            g_audioClient = nullptr;
            g_device->Release();
            g_device = nullptr;
            return Napi::Boolean::New(env, false);
        }

        // Get the capture client
        hr = g_audioClient->GetService(
            __uuidof(IAudioCaptureClient),
            (void**)&g_captureClient
        );

        if (hr != S_OK) {
            g_audioClient->Release();
            g_audioClient = nullptr;
            g_device->Release();
            g_device = nullptr;
            return Napi::Boolean::New(env, false);
        }

        // Start capturing
        hr = g_audioClient->Start();
        
        if (hr != S_OK) {
            g_captureClient->Release();
            g_captureClient = nullptr;
            g_audioClient->Release();
            g_audioClient = nullptr;
            g_device->Release();
            g_device = nullptr;
            return Napi::Boolean::New(env, false);
        }

        g_capturing.store(true);
        
        // Start capture thread
        std::thread captureThread(CaptureThread);
        captureThread.detach();

        return Napi::Boolean::New(env, true);
    }

    static Napi::Value StopCapture(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        g_capturing.store(false);

        if (g_audioClient) {
            g_audioClient->Stop();
        }

        if (g_captureClient) {
            g_captureClient->Release();
            g_captureClient = nullptr;
        }

        if (g_audioClient) {
            g_audioClient->Release();
            g_audioClient = nullptr;
        }

        if (g_device) {
            g_device->Release();
            g_device = nullptr;
        }

        {
            std::lock_guard<std::mutex> lock(g_bufferMutex);
            g_audioBuffer.clear();
        }

        return Napi::Boolean::New(env, true);
    }

    static Napi::Value GetAudioData(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        
        std::vector<float> data;
        
        {
            std::lock_guard<std::mutex> lock(g_bufferMutex);
            data = g_audioBuffer;
            g_audioBuffer.clear();
        }

        Napi::Float32Array result = Napi::Float32Array::New(env, data.size());
        for (size_t i = 0; i < data.size(); i++) {
            result[i] = data[i];
        }

        return result;
    }

    static Napi::Value IsCapturing(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        return Napi::Boolean::New(env, g_capturing.load());
    }

private:
    static void CaptureThread() {
        HRESULT hr;
        UINT32 numFramesAvailable;
        BYTE* pData;
        DWORD flags;

        while (g_capturing.load()) {
            Sleep(50); // Small delay to prevent busy loop

            if (!g_captureClient) break;

            hr = g_captureClient->GetNextPacketSize(&numFramesAvailable);

            if (hr != S_OK || numFramesAvailable == 0) {
                continue;
            }

            hr = g_captureClient->GetBuffer(&pData, &numFramesAvailable, &flags, nullptr, nullptr);

            if (hr != S_OK) {
                continue;
            }

            if (flags & AUDCLNT_BUFFERFLAGS_SILENCE) {
                // Add silence
                std::lock_guard<std::mutex> lock(g_bufferMutex);
                g_audioBuffer.insert(g_audioBuffer.end(), numFramesAvailable, 0.0f);
            } else {
                // Convert 16-bit samples to float
                int16_t* samples = reinterpret_cast<int16_t*>(pData);
                std::vector<float> floatSamples(numFramesAvailable);
                
                for (UINT32 i = 0; i < numFramesAvailable; i++) {
                    floatSamples[i] = static_cast<float>(samples[i]) / 32768.0f;
                }

                std::lock_guard<std::mutex> lock(g_bufferMutex);
                g_audioBuffer.insert(g_audioBuffer.end(), floatSamples.begin(), floatSamples.end());
            }

            g_captureClient->ReleaseBuffer(numFramesAvailable);
        }
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    
    exports.Set(Napi::String::New(env, "startCapture"), Napi::Function::New(env, SystemAudioCapture::StartCapture));
    exports.Set(Napi::String::New(env, "stopCapture"), Napi::Function::New(env, SystemAudioCapture::StopCapture));
    exports.Set(Napi::String::New(env, "getAudioData"), Napi::Function::New(env, SystemAudioCapture::GetAudioData));
    exports.Set(Napi::String::New(env, "isCapturing"), Napi::Function::New(env, SystemAudioCapture::IsCapturing));

    return exports;
}

NODE_API_MODULE(system_audio_capture, Init)