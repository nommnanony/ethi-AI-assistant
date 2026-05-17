use crate::audio_config::{SAMPLE_RATE, SILENCE_ENERGY_THRESHOLD};
use crate::vad::VadDecision;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SuppressionDecision {
    PassThrough,
    Suppressed,
    PartiallySuppressed,
}

pub struct SilenceSuppressor {
    enabled: bool,
    gate_open: bool,
    current_gain: f64,
    attack_frames: usize,
    release_frames: usize,
    comfort_noise_level: f64,
    noise_phase: f64,
}

impl Default for SilenceSuppressor {
    fn default() -> Self {
        Self::new()
    }
}

impl SilenceSuppressor {
    pub fn new() -> Self {
        let attack_ms: u64 = 5;
        let release_ms: u64 = 50;

        Self {
            enabled: true,
            gate_open: false,
            current_gain: 0.0,
            attack_frames: (SAMPLE_RATE as usize * attack_ms as usize) / 1000,
            release_frames: (SAMPLE_RATE as usize * release_ms as usize) / 1000,
            comfort_noise_level: 0.0005,
            noise_phase: 0.0,
        }
    }

    pub fn process(&mut self, samples: &mut [i16], vad: VadDecision) -> SuppressionDecision {
        if !self.enabled {
            return SuppressionDecision::PassThrough;
        }

        let sample_count = samples.len();

        match vad {
            VadDecision::Speech => {
                self.gate_open = true;
                let gain_step = 1.0 / self.attack_frames.max(1) as f64;

                let mut partially_suppressed = false;
                for sample in samples.iter_mut() {
                    if self.current_gain < 1.0 - 1e-6 {
                        self.current_gain = (self.current_gain + gain_step).min(1.0);
                        partially_suppressed = true;
                    } else {
                        self.current_gain = 1.0;
                    }
                    *sample = (*sample as f64 * self.current_gain) as i16;
                }

                if partially_suppressed {
                    SuppressionDecision::PartiallySuppressed
                } else {
                    SuppressionDecision::PassThrough
                }
            }

            VadDecision::Silence => {
                self.gate_open = false;
                let gain_step = 1.0 / self.release_frames.max(1) as f64;

                let mut partially_suppressed = false;
                for sample in samples.iter_mut() {
                    if self.current_gain > SILENCE_ENERGY_THRESHOLD {
                        self.current_gain = (self.current_gain - gain_step).max(0.0);
                        let attenuated = (*sample as f64 * self.current_gain) as i16;
                        *sample = attenuated;
                        partially_suppressed = true;
                    } else {
                        self.current_gain = 0.0;
                        self.noise_phase += 0.1;
                        if self.noise_phase > std::f64::consts::TAU * 100.0 {
                            self.noise_phase = 0.0;
                        }
                        let noise = (self.noise_phase.sin()
                            * self.comfort_noise_level
                            * f64::from(i16::MAX))
                            as i16;
                        *sample = noise;
                    }
                }

                if partially_suppressed {
                    SuppressionDecision::PartiallySuppressed
                } else {
                    SuppressionDecision::Suppressed
                }
            }

            VadDecision::Unknown => {
                if self.current_gain < 0.999 {
                    for sample in samples.iter_mut() {
                        *sample = (*sample as f64 * self.current_gain) as i16;
                    }
                    SuppressionDecision::PartiallySuppressed
                } else {
                    SuppressionDecision::PassThrough
                }
            }
        }
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            self.current_gain = 1.0;
        }
    }

    pub fn reset(&mut self) {
        self.gate_open = false;
        self.current_gain = 0.0;
        self.noise_phase = 0.0;
    }
}
