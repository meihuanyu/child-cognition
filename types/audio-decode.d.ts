declare module 'audio-decode' {
  interface AudioBuffer {
    sampleRate: number;
    length: number;
    duration: number;
    numberOfChannels: number;
    getChannelData(channel: number): Float32Array;
  }

  function audioDecode(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<AudioBuffer>;
  
  export default audioDecode;
}

