#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

mod audio_config;
mod microphone;
mod silence_suppression;
mod speaker;
mod vad;

use napi::bindgen_prelude::*;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

#[napi(object)]
#[derive(Clone, Default)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub default: bool,
    pub channels: u16,
    pub sample_rate: u32,
}

// ---------------------------------------------------------------------------
// SystemAudioCapture – high-level wrapper around platform speaker capture
// ---------------------------------------------------------------------------

#[napi]
pub struct SystemAudioCapture {
    inner: Option<speaker::SpeakerCaptureInner>,
    started: bool,
}

#[napi]
impl SystemAudioCapture {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self {
            inner: Some(speaker::SpeakerCaptureInner::new()),
            started: false,
        }
    }

    #[napi]
    pub fn start(&mut self, callback: JsFunction) -> Result<()> {
        if self.started {
            return Err(napi::Error::from_reason("SystemAudioCapture already started"));
        }
        let inner = self
            .inner
            .as_mut()
            .ok_or_else(|| napi::Error::from_reason("Capture already stopped"))?;
        inner.start(callback)?;
        self.started = true;
        Ok(())
    }

    #[napi]
    pub fn stop(&mut self) {
        if let Some(ref mut inner) = self.inner {
            inner.stop();
        }
        self.started = false;
    }
}

impl Drop for SystemAudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}

// ---------------------------------------------------------------------------
// MicrophoneCapture – high-level wrapper around CPAL mic capture
// ---------------------------------------------------------------------------

#[napi]
pub struct MicrophoneCapture {
    inner: Option<microphone::MicrophoneCaptureInner>,
    started: bool,
}

#[napi]
impl MicrophoneCapture {
    #[napi(constructor)]
    pub fn new(device_id: Option<String>) -> Result<Self> {
        let inner = microphone::MicrophoneCaptureInner::new(device_id)?;
        Ok(Self {
            inner: Some(inner),
            started: false,
        })
    }

    #[napi]
    pub fn start(&mut self, callback: JsFunction) -> Result<()> {
        if self.started {
            return Err(napi::Error::from_reason("MicrophoneCapture already started"));
        }
        let inner = self
            .inner
            .as_mut()
            .ok_or_else(|| napi::Error::from_reason("Capture already stopped"))?;
        inner.start(callback)?;
        self.started = true;
        Ok(())
    }

    #[napi]
    pub fn stop(&mut self) {
        if let Some(ref mut inner) = self.inner {
            inner.stop();
        }
        self.started = false;
    }
}

impl Drop for MicrophoneCapture {
    fn drop(&mut self) {
        self.stop();
    }
}

// ---------------------------------------------------------------------------
// Free functions
// ---------------------------------------------------------------------------

#[napi]
pub fn get_input_devices() -> Vec<AudioDeviceInfo> {
    microphone::get_input_devices()
}

#[napi]
pub fn get_output_devices() -> Vec<AudioDeviceInfo> {
    speaker::get_output_devices()
}

#[napi]
pub fn get_default_output_device_id() -> Option<String> {
    speaker::get_default_output_device_id()
}

#[napi]
pub fn apply_stealth_to_window(hwnd: Buffer) -> Result<()> {
    speaker::apply_stealth_to_window(hwnd)
}
