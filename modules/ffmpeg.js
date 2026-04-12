// FFmpeg
const CORE_BASE = '../node_modules/@ffmpeg/core/dist/esm';
const FFMPEG_BASE = '../node_modules/@ffmpeg/ffmpeg/dist/esm';

export class FfmpegError extends Error {
    constructor(message) {
        super(message);
        this.name = 'FfmpegError';
    }
}

const getAssets = (() => {
    let promise = null;
    return async () => {
        if (!promise) {
            promise = (async () => ({
                coreURL:  new URL(`${CORE_BASE}/ffmpeg-core.js`, import.meta.url).href,
                wasmURL:  new URL(`${CORE_BASE}/ffmpeg-core.wasm`, import.meta.url).href,
                workerURL: new URL(`${FFMPEG_BASE}/worker.js`, import.meta.url).href,
            }))();
        }
        return promise;
    };
})();

export async function ffmpeg(inputBlob, options = {}) {
    const {
        inputName = 'input',
        args = [],
        outputName = 'output',
        outputMime = 'application/octet-stream',
        onProgress = null,
        signal = null,
        extraFiles = [],
    } = options;

    const assets = await getAssets();
    let audioData = null;
    if (inputBlob) {
        if (inputBlob instanceof Blob) {
            audioData = await inputBlob.arrayBuffer();
        } else {
            // If it's a Uint8Array, get its underlying buffer; otherwise assume it's an ArrayBuffer
            audioData = inputBlob.buffer || inputBlob;
        }
    }

    return new Promise((resolve, reject) => {
        // Ensure your Vite config is set up to handle the ?worker import
        const worker = new Worker(new URL('./ffmpeg.worker.js', import.meta.url), { type: 'module' });
        
        const cleanup = () => {
            if (signal) signal.removeEventListener('abort', handleAbort);
            worker.terminate();
        };

        const handleAbort = () => {
            cleanup();
            reject(new FfmpegError('FFMPEG aborted'));
        };

        if (signal?.aborted) return handleAbort();
        signal?.addEventListener('abort', handleAbort);

        worker.onmessage = (e) => {
            const { type, buffer, mime, message, progress } = e.data;

            if (type === 'complete') {
                cleanup();
                resolve({ buffer, mime });
            } else if (type === 'error') {
                console.error(`%c[FFmpeg Error]`, 'color: #ef4444; font-weight: bold;', message);
                cleanup();
                reject(new FfmpegError(message));
            } else if (type === 'progress') {
                onProgress?.({ stage: 'encoding', progress: progress || 0 });
            } else if (type === 'log') {
                console.log(`%c[FFmpeg]`, 'color: #3b82f6;', message);
            }
        };

        worker.postMessage({
            audioData,
            inputName,
            extraFiles,
            args,
            output: { name: outputName, mime: outputMime },
            loadOptions: assets,
        }, audioData ? [audioData] : []);
    });
}