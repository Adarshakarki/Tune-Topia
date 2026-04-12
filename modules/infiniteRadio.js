// Radio
export class InfiniteRadio {
  constructor(audio, fetchBatch, options = {}) {
    this.audio = audio;
    this.fetchBatch = fetchBatch;

    this.batchSize = options.batchSize || 4;
    this.queue = [];
    this.history = new Set();

    this.loading = false;
    this.seed = options.seed || null; // starting point (track/user taste)

    this.init();
  }

  async init() {
    await this.fillQueue();

    this.playNext();

    this.audio.addEventListener('ended', () => {
      this.playNext();
    });
  }

  async fillQueue() {
    if (this.loading) return;
    this.loading = true;

    try {
      const tracks = await this.fetchBatch({
        seed: this.seed,
        history: Array.from(this.history),
        limit: this.batchSize
      });

      for (const track of tracks) {
        if (!this.history.has(track.id)) {
          this.queue.push(track);
        }
      }

      // update seed → last track influences next batch
      if (tracks.length) {
        this.seed = tracks[tracks.length - 1].id;
      }

    } catch (e) {
      console.error('batch fetch failed', e);
    }

    this.loading = false;
  }

  async playNext() {
    // if queue empty → fetch new batch
    if (this.queue.length === 0) {
      await this.fillQueue();
    }

    const next = this.queue.shift();
    if (!next) return;

    this.history.add(next.id);

    this.audio.src = next.url;
    await this.audio.play();
    
    if (this.queue.length <= 1) {
      this.fillQueue();
    }
  }
}