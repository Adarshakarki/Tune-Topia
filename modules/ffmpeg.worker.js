import { FFmpeg } from '../node_modules/@ffmpeg/ffmpeg/dist/esm/index.js';

let ffmpeg = null;

self.onmessage = async (e) => {
    console.log('[FFmpeg Worker] Processing:', e.data.inputName);
    const { audioData, inputName, extraFiles, args, output, loadOptions } = e.data;

    try {
        // Initialize FFmpeg instance if it doesn't exist
        if (!ffmpeg) {
            ffmpeg = new FFmpeg();
            console.log('[FFmpeg Worker] Initializing FFmpeg core...');
            ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg Log]', message);
                self.postMessage({ type: 'log', message });
            });
            ffmpeg.on('progress', ({ progress }) => self.postMessage({ type: 'progress', progress }));
            
            // Load using the Blob URLs provided by the main thread to fix CORS issues
            await ffmpeg.load({
                ...loadOptions,
                coreOptions: {
                    initialMemory: 1024 * 1024 * 1024 // Increased to 1GB for heavy OGG encoding
                }
            });
            console.log('[FFmpeg Worker] Core loaded successfully.');
        }

        // 1. Write the source audio to virtual FS
        console.log(`[FFmpeg Worker] Input Buffer Size: ${(audioData.byteLength / 1024 / 1024).toFixed(2)} MB`);
        const inputArr = new Uint8Array(audioData);
        await ffmpeg.writeFile(inputName, inputArr);
        // Clear reference to free memory
        e.data.audioData = null;

        // 2. Write any extra files (like album art for metadata)
        if (extraFiles) {
            for (const file of extraFiles) {
                const fileArr = new Uint8Array(file.data);
                await ffmpeg.writeFile(file.name, fileArr).catch(() => {});
            }
        }

        // 3. Execute the command
        // Global options must come BEFORE -i. We'll enforce loglevel here.
        let fullArgs = [
            '-nostdin',
            '-y', 
            '-threads', '1', // Critical: Prevents memory spikes from multi-threading in WASM
            '-loglevel', 'debug', 
            '-i', inputName
        ];
        fullArgs = [...fullArgs, ...args, output.name];

        console.log('[FFmpeg Worker] Running command with args:', fullArgs.join(' '));
        const code = await ffmpeg.exec(fullArgs);
        
        if (code !== 0) {
            throw new Error(`FFmpeg execution failed with exit code ${code}`);
        }

        console.log('[FFmpeg Worker] Execution complete. Reading output...');
        // 4. Read the resulting file
        const data = await ffmpeg.readFile(output.name);
        // Explicitly clear the worker's copy of the input buffer
        await ffmpeg.deleteFile(inputName).catch(() => {});
        // Transfer the underlying ArrayBuffer back to the main thread to avoid a memory copy
        self.postMessage({ type: 'complete', buffer: data.buffer, mime: output.mime }, [data.buffer]);
    } catch (error) {
        console.error('[FFmpeg Worker Error]', error);
        self.postMessage({ type: 'error', message: error.message || String(error) });
    } finally {
        // 5. Cleanup virtual filesystem to free memory (Always run)
        if (ffmpeg) {
            try {
                await ffmpeg.deleteFile(inputName).catch(() => {});
                await ffmpeg.deleteFile(output.name).catch(() => {});
                if (extraFiles) {
                    for (const file of extraFiles) await ffmpeg.deleteFile(file.name);
                }
            } catch (e) { /* ignore cleanup errors */ }
        }
    }
};