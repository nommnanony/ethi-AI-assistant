use crate::audio_config::{VAD_THRESHOLD, MIN_SPEECH_FRAMES};

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum VadDecision {
    Speech,
    Silence,
    Unknown,
}

pub struct VoiceActivityDetector {
    threshold: f64,
    min_speech_frames: u32,
    consecutive_speech: u32,
    consecutive_silence: u32,
}

impl Default for VoiceActivityDetector {
    fn default() -> Self {
        Self::new(VAD_THRESHOLD, MIN_SPEECH_FRAMES)
    }
}

impl VoiceActivityDetector {
    pub fn new(threshold: f64, min_speech_frames: u32) -> Self {
        Self {
            threshold,
            min_speech_frames,
            consecutive_speech: 0,
            consecutive_silence: 0,
        }
    }

    pub fn process_chunk(&mut self, samples: &[i16]) -> VadDecision {
        let rms = compute_rms(samples);

        if rms >= self.threshold {
            self.consecutive_speech += 1;
            self.consecutive_silence = 0;

            if self.consecutive_speech >= self.min_speech_frames {
                VadDecision::Speech
            } else {
                VadDecision::Unknown
            }
        } else {
            self.consecutive_silence += 1;
            self.consecutive_speech = 0;

            if self.consecutive_silence >= self.min_speech_frames {
                VadDecision::Silence
            } else {
                VadDecision::Unknown
            }
        }
    }

    pub fn reset(&mut self) {
        self.consecutive_speech = 0;
        self.consecutive_silence = 0;
    }

    pub fn set_threshold(&mut self, threshold: f64) {
        self.threshold = threshold;
    }
}

fn compute_rms(samples: &[i16]) -> f64 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_sq: f64 = samples
        .iter()
        .map(|&s| {
            let normalized = f64::from(s) / f64::from(i16::MAX);
            normalized * normalized
        })
        .sum();

    (sum_sq / samples.len() as f64).sqrt()
}
