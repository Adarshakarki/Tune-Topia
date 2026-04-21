export class Virtualizer {
  constructor({ container, items, itemHeight, renderItem, buffer = 5 }) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.renderItem = renderItem;
    this.buffer = buffer;
    this.scroller = this._findScroller(container);
    this._ticking = false;

    this.onScroll = this.onScroll.bind(this);
    this.scroller.addEventListener('scroll', this.onScroll, { passive: true });

    // Ensure container has relative positioning for absolute child placement
    this.container.style.position = 'relative';
    this.update();
  }

  /**
   * Recursively finds the nearest scrollable parent.
   */
  _findScroller(el) {
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const overflow = window.getComputedStyle(p).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') return p;
      p = p.parentElement;
    }
    return window;
  }

  onScroll() {
    if (!this._ticking) {
      requestAnimationFrame(() => {
        this.update();
        this._ticking = false;
      });
      this._ticking = true;
    }
  }

  update() {
    const scrollTop = this.scroller === window ? window.scrollY : this.scroller.scrollTop;
    const viewHeight = this.scroller === window ? window.innerHeight : this.scroller.offsetHeight;
    
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
    const end = Math.min(this.items.length, Math.ceil((scrollTop + viewHeight) / this.itemHeight) + this.buffer);

    // Set container height to total items * height to maintain scrollbar scale
    this.container.style.height = `${this.items.length * this.itemHeight}px`;
    
    const html = [];
    for (let i = start; i < end; i++) {
      const transform = `transform: translateY(${i * this.itemHeight}px)`;
      html.push(`<div class="v-wrapper" style="position:absolute; top:0; left:0; width:100%; height:${this.itemHeight}px; ${transform}">
        ${this.renderItem(this.items[i], i)}
      </div>`);
    }
    this.container.innerHTML = html.join('');
  }

  destroy() {
    this.scroller.removeEventListener('scroll', this.onScroll);
  }
}