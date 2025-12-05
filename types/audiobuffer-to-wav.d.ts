declare module 'audiobuffer-to-wav' {
  interface AudioBuffer {
    sampleRate: number;
    length: number;
    duration: number;
    numberOfChannels: number;
    getChannelData(channel: number): Float32Array;
  }

  function toWav(audioBuffer: AudioBuffer): ArrayBuffer;
  
  export default toWav;
}

