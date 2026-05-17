use napi::bindgen_prelude::*;
use napi::threadsafe_function::{
    ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use ringbuf::traits::*;
use ringbuf::HeapRb;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use crate::audio_config::*;
use crate::silence_suppression::SilenceSuppressor;
use crate::vad::VoiceActivityDetector;
use crate::AudioDeviceInfo;

struct CaptureState {
    stop_flag: Arc<AtomicBool>,
    consumer_handle: Option<JoinHandle<()>>,
    stream: Option<cpal::Stream>,
}

pub struct MicrophoneCaptureInner {
    device_id: Option<String>,
    state: Arc<Mutex<Option<CaptureState>>>,
}

impl MicrophoneCaptureInner {
    pub fn new(device_id: Option<String>) -> Result<Self> {
        Ok(Self {
            device_id,
            state: Arc::new(Mutex::new(None)),
        })
    }

    pub fn start(&mut self, callback: JsFunction) -> Result<()> {
        let mut state_guard = self
            .state
            .lock()
            .map_err(|_| napi::Error::from_reason("Mutex poisoned"))?;

        if state_guard.is_some() {
            return Err(napi::Error::from_reason("Already capturing microphone"));
        }

        let host = cpal::default_host();

        let device = match &self.device_id {
            Some(id) => find_input_device(host, id)
                .ok_or_else(|| napi::Error::from_reason(format!("Input device not found: {}", id)))?,
            None => host
                .default_input_device()
                .ok_or_else(|| napi::Error::from_reason("No default input device available"))?,
        };

        let config = Self::select_config(&device)?;

        let tsfn: ThreadsafeFunction<Vec<u8>, ErrorStrategy::Fatal> = callback
            .create_threadsafe_function(0, |ctx| Ok(vec![Buffer::from(&ctx.value[..])]))?;

        let (mut producer, consumer) = HeapRb::<i16>::new(RING_BUFFER_CAPACITY).split();
        let stop_flag = Arc::new(AtomicBool::new(false));
        let cb_stop = stop_flag.clone();
        let stream_stop = stop_flag.clone();

        // Consumer thread: reads i16 from ring buffer, runs VAD + suppression, sends to JS
        let consumer_handle = std::thread::Builder::new()
            .name("mic-consumer".into())
            .spawn(move || {
                let mut frame_buf = Vec::with_capacity(FRAME_SIZE);
                let mut vad = VoiceActivityDetector::default();
                let mut suppressor = SilenceSuppressor::new();
                let mut consumer = consumer;

                while !cb_stop.load(Ordering::Relaxed) {
                    if consumer.len() < FRAME_SIZE {
                        std::thread::sleep(Duration::from_millis(1));
                        continue;
                    }

                    frame_buf.clear();
                    frame_buf.resize(FRAME_SIZE, 0i16);
                    let n = consumer.pop_slice(&mut frame_buf);
                    if n < FRAME_SIZE {
                        continue;
                    }

                    let decision = vad.process_chunk(&frame_buf);
                    let _suppr = suppressor.process(&mut frame_buf, decision);

                    let bytes: Vec<u8> = frame_buf
                        .iter()
                        .flat_map(|s| s.to_le_bytes())
                        .collect();

                    let _ = tsfn.call(bytes, ThreadsafeFunctionCallMode::NonBlocking);
                }
            })
            .map_err(|e| napi::Error::from_reason(format!("Failed to spawn consumer thread: {}", e)))?;

        // CPAL stream: pushes audio data to ring buffer
        let err_fn = move |err: cpal::StreamError| {
            eprintln!("CPAL stream error: {}", err);
        };

        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if stream_stop.load(Ordering::Relaxed) {
                        return;
                    }
                    for &sample in data {
                        let i16_sample = (sample * i16::MAX as f32)
                            .clamp(-32768.0, 32767.0) as i16;
                        let _ = producer.push(i16_sample);
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| napi::Error::from_reason(format!("Failed to build input stream: {}", e)))?;

        stream
            .play()
            .map_err(|e| napi::Error::from_reason(format!("Failed to start stream: {}", e)))?;

        state_guard.replace(CaptureState {
            stop_flag,
            consumer_handle: Some(consumer_handle),
            stream: Some(stream),
        });

        Ok(())
    }

    fn select_config(device: &cpal::Device) -> Result<cpal::StreamConfig> {
        let pref_config = cpal::StreamConfig {
            channels: CHANNELS,
            sample_rate: cpal::SampleRate(SAMPLE_RATE),
            buffer_size: cpal::BufferSize::Default,
        };

        if let Ok(supported) = device.supported_input_configs() {
            for cfg in supported {
                if cfg.channels() == CHANNELS as cpal::ChannelCount
                    && cfg.min_sample_rate() <= cpal::SampleRate(SAMPLE_RATE)
                    && cfg.max_sample_rate() >= cpal::SampleRate(SAMPLE_RATE)
                {
                    return Ok(pref_config);
                }
            }
        }

        // Fallback to default config (will need resampling — caller handles via rubato)
        device
            .default_input_config()
            .map(|c| cpal::StreamConfig {
                channels: CHANNELS,
                sample_rate: cpal::SampleRate(SAMPLE_RATE),
                buffer_size: cpal::BufferSize::Default,
            })
            .map_err(|e| napi::Error::from_reason(format!("No compatible input config: {}", e)))
    }

    pub fn stop(&mut self) {
        if let Ok(mut guard) = self.state.lock() {
            if let Some(state) = guard.take() {
                state.stop_flag.store(true, Ordering::Relaxed);

                // Drop the stream to stop capture immediately
                drop(state.stream);

                if let Some(h) = state.consumer_handle {
                    let _ = h.join();
                }
            }
        }
    }
}

pub fn get_input_devices() -> Vec<AudioDeviceInfo> {
    let host = cpal::default_host();
    let default_device = host.default_input_device();

    let mut result: Vec<AudioDeviceInfo> = Vec::new();
    let mut index = 0u32;

    if let Ok(devices) = host.input_devices() {
        for device in devices {
            let name = device.name().unwrap_or_else(|_| format!("Input Device {}", index));
            let is_default = default_device
                .as_ref()
                .map(|d| {
                    d.name().ok().as_deref() == Some(name.as_str())
                })
                .unwrap_or(false);

            let channels = device
                .default_input_config()
                .map(|c| c.channels() as u16)
                .unwrap_or(CHANNELS);

            result.push(AudioDeviceInfo {
                id: name.clone(),
                name,
                default: is_default,
                channels,
                sample_rate: SAMPLE_RATE,
            });

            index += 1;
        }
    }

    result
}

fn find_input_device(host: &cpal::Host, id: &str) -> Option<cpal::Device> {
    if let Ok(devices) = host.input_devices() {
        for device in devices {
            if let Ok(name) = device.name() {
                if name == id {
                    return Some(device);
                }
            }
        }
    }
    None
}
