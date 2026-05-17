use napi::bindgen_prelude::*;
use napi::threadsafe_function::{
    ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use ringbuf::traits::*;
use ringbuf::HeapRb;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

use crate::audio_config::*;
use crate::vad::VoiceActivityDetector;
use crate::silence_suppression::SilenceSuppressor;
use crate::AudioDeviceInfo;

// ---------------------------------------------------------------------------
// Linear interpolating resampler for streaming use
// ---------------------------------------------------------------------------
struct LinearResampler {
    ratio: f64,
    phase: f64,
    last_sample: f64,
}

impl LinearResampler {
    fn new(input_rate: f64, output_rate: f64) -> Self {
        Self {
            ratio: input_rate / output_rate,
            phase: 0.0,
            last_sample: 0.0,
        }
    }

    fn process(&mut self, input: &[f32]) -> Vec<f32> {
        if input.is_empty() {
            return Vec::new();
        }

        let max_output = (input.len() as f64 / self.ratio).ceil() as usize + 4;
        let mut output = Vec::with_capacity(max_output);

        let input_len = input.len() as f64;

        while self.phase < input_len {
            let idx = self.phase.floor() as usize;
            let frac = self.phase.fract();

            let sample = if idx + 1 < input.len() {
                input[idx] as f64 * (1.0 - frac) + input[idx + 1] as f64 * frac
            } else if idx < input.len() {
                input[idx] as f64
            } else {
                break;
            };

            output.push(sample as f32);
            self.phase += self.ratio;
        }

        self.phase -= input_len;
        if self.phase < 0.0 {
            self.phase = 0.0;
        }
        self.last_sample = f64::from(input[input.len().saturating_sub(1)]);

        output
    }

    fn reset(&mut self) {
        self.phase = 0.0;
        self.last_sample = 0.0;
    }
}

#[derive(Clone, Copy)]
struct AudioFormat {
    sample_rate: u32,
    channels: u16,
    bits_per_sample: u16,
    is_float: bool,
}

impl AudioFormat {
    fn from_wave_format(ptr: *const u8) -> Self {
        use windows::Win32::Media::Audio::*;

        unsafe {
            let fmt = ptr as *const WAVEFORMATEX;
            let tag = (*fmt).wFormatTag;
            let channels = (*fmt).nChannels;
            let sample_rate = (*fmt).nSamplesPerSec;
            let bits = (*fmt).wBitsPerSample;

            match tag {
                WAVE_FORMAT_IEEE_FLOAT => Self {
                    sample_rate,
                    channels,
                    bits_per_sample: bits,
                    is_float: true,
                },
                WAVE_FORMAT_PCM => Self {
                    sample_rate,
                    channels,
                    bits_per_sample: bits,
                    is_float: false,
                },
                WAVE_FORMAT_EXTENSIBLE => {
                    let ext = ptr as *const WAVEFORMATEXTENSIBLE;
                    let sub = (*ext).SubFormat;
                    let ieee_float = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
                    let is_f = sub == ieee_float;
                    Self {
                        sample_rate,
                        channels,
                        bits_per_sample: bits,
                        is_float: is_f,
                    }
                }
                _ => Self {
                    sample_rate,
                    channels,
                    bits_per_sample: bits,
                    is_float: false,
                },
            }
        }
    }
}

pub struct SpeakerCaptureInner {
    stop_flag: Arc<AtomicBool>,
    capture_thread: Option<JoinHandle<()>>,
    consumer_thread: Option<JoinHandle<()>>,
}

impl SpeakerCaptureInner {
    pub fn new() -> Self {
        Self {
            stop_flag: Arc::new(AtomicBool::new(false)),
            capture_thread: None,
            consumer_thread: None,
        }
    }

    pub fn start(&mut self, callback: JsFunction) -> Result<()> {
        if self.capture_thread.is_some() {
            return Err(napi::Error::from_reason("Already capturing system audio"));
        }

        self.stop_flag.store(false, Ordering::Relaxed);

        let tsfn: ThreadsafeFunction<Vec<u8>, ErrorStrategy::Fatal> = callback
            .create_threadsafe_function(0, |ctx| Ok(vec![Buffer::from(&ctx.value[..])]))?;

        let (mut producer, consumer) = HeapRb::<i16>::new(RING_BUFFER_CAPACITY).split();
        let capture_stop = self.stop_flag.clone();
        let consumer_stop = self.stop_flag.clone();

        // --- Consumer thread: reads i16 from ring buffer, runs VAD + suppression, sends to JS
        let consumer_handle = std::thread::Builder::new()
            .name("audio-consumer".into())
            .spawn(move || {
                let mut frame_buf = Vec::with_capacity(FRAME_SIZE);
                let mut vad = VoiceActivityDetector::default();
                let mut suppressor = SilenceSuppressor::new();
                let mut consumer = consumer;

                while !consumer_stop.load(Ordering::Relaxed) {
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

        let capture_handle = std::thread::Builder::new()
            .name("wasapi-capture".into())
            .spawn(move || {
                unsafe {
                    windows::Win32::System::Com::CoInitializeEx(
                        None,
                        windows::Win32::System::Com::COINIT_MULTITHREADED,
                    )
                    .ok();
                }

                if let Err(e) = Self::run_wasapi_loop(capture_stop, &mut producer) {
                    eprintln!("WASAPI capture error: {}", e);
                }

                unsafe {
                    windows::Win32::System::Com::CoUninitialize();
                }
            })
            .map_err(|e| napi::Error::from_reason(format!("Failed to spawn capture thread: {}", e)))?;

        self.capture_thread = Some(capture_handle);
        self.consumer_thread = Some(consumer_handle);

        Ok(())
    }

    fn run_wasapi_loop(
        stop: Arc<AtomicBool>,
        producer: &mut impl Producer<i16>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        use windows::Win32::Media::Audio::*;
        use windows::Win32::System::Com::*;
        use windows::Win32::System::Memory::*;
        use windows::core::*;

        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

        let device = unsafe { enumerator.GetDefaultAudioEndpoint(eRender, eConsole)? };

        let audio_client: IAudioClient =
            unsafe { device.Activate(&IID_IAudioClient, CLSCTX_ALL, None)? };

        let mix_format_ptr = unsafe { audio_client.GetMixFormat()? };
        let fmt = AudioFormat::from_wave_format(mix_format_ptr as *const u8);

        let hr = unsafe {
            audio_client.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK,
                0,
                0,
                mix_format_ptr,
                None,
            )
        };
        if hr.is_err() {
            CoTaskMemFree(Some(mix_format_ptr as *mut core::ffi::c_void));
            return Err(format!("IAudioClient::Initialize failed: {:?}", hr).into());
        }

        let capture_client: IAudioCaptureClient =
            unsafe { audio_client.GetService(&IID_IAudioCaptureClient)? };

        unsafe { audio_client.Start() }.ok();

        let mut resampler = LinearResampler::new(fmt.sample_rate as f64, SAMPLE_RATE as f64);
        let bytes_per_frame = fmt.channels as usize * (fmt.bits_per_sample as usize / 8);
        let mut temp_f32 = Vec::new();

        while !stop.load(Ordering::Relaxed) {
            let mut next_size = 0u32;
            unsafe {
                capture_client.GetNextPacketSize(&mut next_size as *mut u32)
            }
            .ok();

            if next_size == 0 {
                std::thread::sleep(Duration::from_millis(5));
                continue;
            }

            let mut data_ptr: *mut u8 = std::ptr::null_mut();
            let mut frames = 0u32;
            let mut flags = 0u32;

            let hr = unsafe {
                capture_client.GetBuffer(
                    &mut data_ptr as *mut *mut u8 as *mut *mut core::ffi::c_void,
                    &mut frames as *mut u32,
                    &mut flags as *mut u32,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            };

            if hr.is_err() || frames == 0 {
                continue;
            }

            let is_silent = (flags & 0x00000001) != 0; // AUDCLNT_BUFFERFLAGS_SILENT
            let buf_len = frames as usize * bytes_per_frame;

            if fmt.is_float {
                let samples = unsafe {
                    std::slice::from_raw_parts(data_ptr as *const u8, buf_len)
                };
                let f32_slice = unsafe {
                    std::slice::from_raw_parts(
                        samples.as_ptr() as *const f32,
                        frames as usize * fmt.channels as usize,
                    )
                };

                if is_silent {
                    let zeros = vec![0.0f32; f32_slice.len()];
                    mix_and_resample(
                        &zeros,
                        fmt.channels,
                        &mut resampler,
                        &mut temp_f32,
                        producer,
                    );
                } else {
                    mix_and_resample(
                        f32_slice,
                        fmt.channels,
                        &mut resampler,
                        &mut temp_f32,
                        producer,
                    );
                }
            } else if fmt.bits_per_sample == 16 {
                let samples = unsafe {
                    std::slice::from_raw_parts(
                        data_ptr as *const i16,
                        frames as usize * fmt.channels as usize,
                    )
                };

                if is_silent {
                    let zeros = vec![0i16; samples.len()];
                    mix_int_and_resample(
                        &zeros,
                        fmt.channels,
                        &mut resampler,
                        &mut temp_f32,
                        producer,
                    );
                } else {
                    mix_int_and_resample(
                        samples,
                        fmt.channels,
                        &mut resampler,
                        &mut temp_f32,
                        producer,
                    );
                }
            }

            unsafe { capture_client.ReleaseBuffer(frames) }.ok();
        }

        unsafe { audio_client.Stop() }.ok();
        CoTaskMemFree(Some(mix_format_ptr as *mut core::ffi::c_void));

        Ok(())
    }

    pub fn stop(&mut self) {
        self.stop_flag.store(true, Ordering::Relaxed);
        if let Some(h) = self.capture_thread.take() {
            let _ = h.join();
        }
        if let Some(h) = self.consumer_thread.take() {
            let _ = h.join();
        }
    }
}

fn mix_and_resample(
    interleaved: &[f32],
    channels: u16,
    resampler: &mut LinearResampler,
    temp: &mut Vec<f32>,
    producer: &mut impl Producer<i16>,
) {
    if channels == 1 {
        let resampled = resampler.process(interleaved);
        for &s in &resampled {
            let sample = (s * i16::MAX as f32).clamp(-32768.0, 32767.0) as i16;
            let _ = producer.push(sample);
        }
    } else {
        temp.clear();
        let ch = channels as usize;
        for frame in interleaved.chunks_exact(ch) {
            let mono: f32 = frame.iter().sum::<f32>() / ch as f32;
            temp.push(mono);
        }
        let resampled = resampler.process(temp);
        for &s in &resampled {
            let sample = (s * i16::MAX as f32).clamp(-32768.0, 32767.0) as i16;
            let _ = producer.push(sample);
        }
    }
}

fn mix_int_and_resample(
    interleaved: &[i16],
    channels: u16,
    resampler: &mut LinearResampler,
    temp: &mut Vec<f32>,
    producer: &mut impl Producer<i16>,
) {
    temp.clear();
    let ch = channels as usize;
    for frame in interleaved.chunks_exact(ch) {
        let mono_f: f64 = frame.iter().map(|&s| f64::from(s)).sum::<f64>() / ch as f64;
        temp.push((mono_f / f64::from(i16::MAX)) as f32);
    }
    let resampled = resampler.process(temp);
    for &s in &resampled {
        let sample = (s * i16::MAX as f32).clamp(-32768.0, 32767.0) as i16;
        let _ = producer.push(sample);
    }
}

// ---------------------------------------------------------------------------
// Device enumeration helpers
// ---------------------------------------------------------------------------
pub fn get_output_devices() -> Vec<AudioDeviceInfo> {
    use windows::Win32::Media::Audio::*;
    use windows::Win32::System::Com::*;
    use windows::core::*;

    let mut result = Vec::new();

    unsafe {
        if CoInitializeEx(None, COINIT_MULTITHREADED).is_err() {
            return result;
        }
    }

    let enumerator = unsafe { CoCreateInstance::<IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL) };
    if let Ok(enumerator) = enumerator {
        if let Ok(collection) = unsafe { enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) } {
            if let Ok(count) = unsafe { collection.GetCount() } {
                let default_id = get_default_output_device_id_inner(&enumerator);

                for i in 0..count {
                    if let Ok(device) = unsafe { collection.Item(i) } {
                        if let Ok(props) = unsafe { device.OpenPropertyStore(STGM_READ) } {
                            use windows::Win32::System::Com::StructuredStorage::*;
                            let pkey = DEVICE_DESC;
                            let mut prop = PROPVARIANT::default();
                            if unsafe { props.GetValue(&pkey, &mut prop).is_ok() } {
                                let name = if prop.vt == VARENUM(VT_LPWSTR) {
                                    unsafe {
                                        let pwsz = *(prop.Data.as_mut_ptr() as *const *mut u16);
                                        if !pwsz.is_null() {
                                            String::from_utf16_lossy(
                                                std::slice::from_raw_parts(pwsz, {
                                                    let mut len = 0;
                                                    while *pwsz.add(len) != 0 { len += 1; }
                                                    len
                                                })
                                            )
                                        } else {
                                            String::new()
                                        }
                                    }
                                } else {
                                    device_name_from_prop(&mut prop)
                                };

                                let id = device_id_string(&device, i);

                                result.push(AudioDeviceInfo {
                                    id: id.clone(),
                                    name,
                                    default: Some(id.as_str()) == default_id.as_deref(),
                                    channels: 2,
                                    sample_rate: SAMPLE_RATE,
                                });
                            }
                            unsafe { PropVariantClear(&mut prop) }.ok();
                        }
                    }
                }
            }
        }
    }

    unsafe { CoUninitialize() };

    result
}

fn device_name_from_prop(prop: &mut windows::Win32::System::Com::StructuredStorage::PROPVARIANT) -> String {
    use windows::Win32::System::Com::StructuredStorage::*;
    unsafe {
        if prop.vt == VARENUM(VT_LPWSTR) {
            let pwsz = *(prop.Data.as_mut_ptr() as *const *mut u16);
            if !pwsz.is_null() {
                let mut len = 0;
                while *pwsz.add(len) != 0 { len += 1; }
                return String::from_utf16_lossy(std::slice::from_raw_parts(pwsz, len));
            }
        }
    }
    format!("Output Device")
}

fn device_id_string(device: &windows::Win32::Media::Audio::IMMDevice, index: u32) -> String {
    if let Ok(ptr) = unsafe { device.GetId() } {
        unsafe {
            if !ptr.is_null() {
                let mut len = 0;
                while *ptr.add(len) != 0 { len += 1; }
                return String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len));
            }
        }
    }
    format!("output-{}", index)
}

fn get_default_output_device_id_inner(
    enumerator: &windows::Win32::Media::Audio::IMMDeviceEnumerator,
) -> Option<String> {
    if let Ok(device) = unsafe { enumerator.GetDefaultAudioEndpoint(
        windows::Win32::Media::Audio::eRender,
        windows::Win32::Media::Audio::eConsole,
    ) } {
        if let Ok(ptr) = unsafe { device.GetId() } {
            unsafe {
                if !ptr.is_null() {
                    let mut len = 0;
                    while *ptr.add(len) != 0 { len += 1; }
                    return Some(String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len)));
                }
            }
        }
    }
    None
}

pub fn get_default_output_device_id() -> Option<String> {
    use windows::Win32::Media::Audio::*;
    use windows::Win32::System::Com::*;
    use windows::core::*;

    unsafe { CoInitializeEx(None, COINIT_MULTITHREADED).ok() };

    let result = (|| -> Option<String> {
        let enumerator = unsafe { CoCreateInstance::<IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL) }.ok()?;
        get_default_output_device_id_inner(&enumerator)
    })();

    unsafe { CoUninitialize() };
    result
}

// ---------------------------------------------------------------------------
// Window stealth (Windows-specific)
// ---------------------------------------------------------------------------
pub fn apply_stealth_to_window(hwnd: Buffer) -> napi::Result<()> {
    use windows::Win32::Graphics::Gdi::*;
    use windows::Win32::UI::WindowsAndMessaging::*;
    use windows::core::*;

    if hwnd.len() < std::mem::size_of::<isize>() {
        return Err(napi::Error::from_reason(
            "HWND buffer too small; expected pointer-sized value",
        ));
    }

    let hwnd_value: isize = unsafe {
        std::ptr::read_unaligned(hwnd.as_ref().as_ptr() as *const isize)
    };

    let hwnd = HWND(hwnd_value as *mut _);

    if hwnd.0.is_null() {
        return Err(napi::Error::from_reason("Invalid HWND (null)"));
    }

    unsafe {
        let ex_style = GetWindowLongPtrA(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrA(
            hwnd,
            GWL_EXSTYLE,
            ex_style
                | WS_EX_TOOLWINDOW as isize
                | WS_EX_LAYERED as isize
                | WS_EX_TRANSPARENT as isize
                | WS_EX_NOACTIVATE as isize,
        );

        SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);

        SetLayeredWindowAttributes(hwnd, 0, 254, LWA_ALPHA);
    }

    Ok(())
}
