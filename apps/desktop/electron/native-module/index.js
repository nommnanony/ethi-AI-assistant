let audioCapture;

try {
  audioCapture = require('./build/Release/system_audio_capture.node');
} catch (e) {
  console.log('Native audio capture not available, using fallback');
  audioCapture = null;
}

let isCapturing = false;
let audioContext = null;
let analyser = null;
let mediaStream = null;

async function startSystemAudioCapture() {
  if (audioCapture) {
    try {
      const result = audioCapture.startCapture();
      if (result) {
        isCapturing = true;
        return true;
      }
    } catch (e) {
      console.log('Native capture failed, trying fallback');
    }
  }

  // Fallback: Try to capture system audio via display media
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'monitor'
      },
      audio: true
    });

    // Check if we got audio
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      mediaStream = stream;
      isCapturing = true;
      return true;
    }

    // If no audio in display media, close the stream
    stream.getTracks().forEach(track => track.stop());
    return false;
  } catch (e) {
    console.error('Fallback capture failed:', e);
    return false;
  }
}

function stopSystemAudioCapture() {
  isCapturing = false;

  if (audioCapture) {
    try {
      audioCapture.stopCapture();
    } catch (e) {}
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyser = null;
  }
}

function getAudioLevel() {
  if (!isCapturing) return 0;

  if (audioCapture && audioCapture.isCapturing()) {
    // Native capture - just return a simple level based on buffer size
    try {
      const data = audioCapture.getAudioData();
      if (data && data.length > 0) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += Math.abs(data[i]);
        }
        return sum / data.length;
      }
    } catch (e) {}
    return 0;
  }

  // WebAudio fallback
  if (analyser) {
    const dataArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    return Math.sqrt(sum / dataArray.length);
  }

  return 0;
}

module.exports = {
  startSystemAudioCapture,
  stopSystemAudioCapture,
  getAudioLevel,
  isCapturing: () => isCapturing
};