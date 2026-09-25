const SVG_NS = 'http://www.w3.org/2000/svg';
const idleHint = 'Click or drag between an output and an input. Click a connected input to unplug it.';
const colors = ['#ef9755', '#a9c9aa', '#dfc966', '#82b9c9', '#df8a87', '#c0a1d7'];
const center = element => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function cableCurve(start, end) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const slack = Math.min(120, 18 + distance * .14);
  return `M${start.x},${start.y} C${start.x},${start.y + slack} ${end.x},${end.y + slack} ${end.x},${end.y}`;
}

export class PatchBay {
  constructor({ rack, cables, hint, routes, onPatch, status, sourceNames, destNames }) {
    Object.assign(this, { rack, cables, hint, routes, onPatch, status, sourceNames, destNames });
    this.jacks = [...rack.querySelectorAll('.jack')];
    this.pending = null;
    this.gesture = null;
    this.frame = null;
    this.overlay = svgElement('svg', { class: 'patch-preview', 'aria-hidden': 'true' });
    document.body.append(this.overlay);
    this.hint.textContent = idleHint;

    for (const jack of this.jacks) {
      jack.setAttribute('aria-pressed', 'false');
      jack.addEventListener('pointerdown', event => this.pointerDown(event, jack));
      // Native keyboard activation generates a click without a pointer sequence.
      jack.addEventListener('click', event => {
        if (event.detail === 0) this.activate(jack);
      });
      jack.addEventListener('focus', () => {
        if (this.pending && this.compatible(jack)) {
          this.pending.point = center(jack);
          this.setHover(jack);
          this.schedulePreview();
        }
      });
      jack.addEventListener('contextmenu', event => {
        event.preventDefault();
        this.cancel();
        if (jack.dataset.type === 'input' && this.routes()[jack.dataset.jack]) {
          this.onPatch(jack.dataset.jack, null);
        }
      });
    }
    document.addEventListener('pointermove', event => this.pointerMove(event));
    document.addEventListener('pointerup', event => this.pointerUp(event));
    document.addEventListener('pointercancel', event => {
      if (this.gesture?.id === event.pointerId) this.cancel('Cable cancelled.');
    });
    document.addEventListener('pointerdown', event => {
      if (this.pending && !event.target.closest('.jack')) this.cancel();
    });
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.pending) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.cancel('Cable cancelled.');
      }
    }, true);
    window.addEventListener('blur', () => this.cancel());
    window.addEventListener('scroll', () => this.schedulePreview(), { passive: true });
    window.addEventListener('resize', () => this.schedulePreview());
    new ResizeObserver(() => this.draw()).observe(rack);
  }

  compatible(jack) {
    return !!(this.pending && jack && this.jacks.includes(jack) && jack.dataset.type !== this.pending.jack.dataset.type);
  }

  begin(jack, point = center(jack)) {
    this.cancel();
    const color = colors[Object.keys(this.routes()).length % colors.length];
    this.pending = { jack, point, color, hover: null };
    jack.classList.add('selected');
    jack.setAttribute('aria-pressed', 'true');
    for (const target of this.jacks) target.classList.toggle('patch-target', this.compatible(target));
    this.previewShadow = svgElement('path', { class: 'cable-shadow' });
    this.previewCable = svgElement('path', { class: 'pending-cable', stroke: color });
    this.previewTip = svgElement('circle', { class: 'cable-tip', r: 5, fill: color });
    this.overlay.append(this.previewShadow, this.previewCable, this.previewTip);
    const name = (jack.dataset.type === 'output' ? this.sourceNames : this.destNames)[jack.dataset.jack];
    const direction = jack.dataset.type === 'output' ? 'input' : 'output';
    this.hint.textContent = `Choose a green-ringed ${direction} for ${name}. Press Escape to cancel.`;
    this.status(this.hint.textContent);
    this.schedulePreview();
  }

  cancel(message) {
    this.pending = null;
    this.gesture = null;
    document.body.classList.remove('patch-dragging');
    this.overlay.replaceChildren();
    for (const jack of this.jacks) {
      jack.classList.remove('selected', 'patch-target', 'patch-hover');
      jack.setAttribute('aria-pressed', 'false');
    }
    this.hint.textContent = idleHint;
    if (message) this.status(message);
  }

  connect(jack) {
    if (!this.compatible(jack)) return;
    const origin = this.pending.jack;
    const input = jack.dataset.type === 'input' ? jack : origin;
    const output = jack.dataset.type === 'output' ? jack : origin;
    this.cancel();
    this.onPatch(input.dataset.jack, output.dataset.jack);
  }

  activate(jack) {
    if (this.compatible(jack)) this.connect(jack);
    else if (this.pending?.jack === jack) this.cancel('Cable cancelled.');
    else if (!this.pending && jack.dataset.type === 'input' && this.routes()[jack.dataset.jack]) {
      this.onPatch(jack.dataset.jack, null);
    } else this.begin(jack);
  }

  pointerDown(event, jack) {
    if (event.button !== 0 || this.gesture) return;
    event.preventDefault();
    jack.focus({ preventScroll: true });
    const previous = this.pending;
    const toggle = previous?.jack === jack;
    const unplugOnTap = !previous && jack.dataset.type === 'input' && !!this.routes()[jack.dataset.jack];
    if (!previous || (!toggle && !this.compatible(jack))) this.begin(jack, { x: event.clientX, y: event.clientY });
    this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, toggle, unplugOnTap, jack };
    jack.setPointerCapture(event.pointerId);
  }

  pointerMove(event) {
    if (!this.pending || (this.gesture && this.gesture.id !== event.pointerId)) return;
    if (this.gesture && Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 5) {
      this.gesture.moved = true;
      document.body.classList.add('patch-dragging');
    }
    this.pending.point = { x: event.clientX, y: event.clientY };
    this.setHover(document.elementFromPoint(event.clientX, event.clientY)?.closest('.jack'));
    this.schedulePreview();
  }

  pointerUp(event) {
    if (!this.gesture || this.gesture.id !== event.pointerId) return;
    const gesture = this.gesture;
    this.gesture = null;
    document.body.classList.remove('patch-dragging');
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.jack');
    if (this.compatible(target)) this.connect(target);
    else if (!gesture.moved && gesture.unplugOnTap) {
      this.cancel();
      this.onPatch(gesture.jack.dataset.jack, null);
    } else if (gesture.moved || gesture.toggle) this.cancel('Cable cancelled.');
  }

  setHover(jack) {
    if (!this.pending) return;
    const target = this.compatible(jack) ? jack : null;
    if (this.pending.hover === target) return;
    this.pending.hover?.classList.remove('patch-hover');
    this.pending.hover = target;
    target?.classList.add('patch-hover');
  }

  schedulePreview() {
    if (this.frame !== null || !this.pending) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (!this.pending) return;
      const { jack, point, hover } = this.pending;
      const end = hover ? center(hover) : point;
      const path = cableCurve(center(jack), end);
      this.previewShadow.setAttribute('d', path);
      this.previewCable.setAttribute('d', path);
      this.previewTip.setAttribute('cx', end.x);
      this.previewTip.setAttribute('cy', end.y);
      // Holding a cable near an edge scrolls the panel on mouse, pen and touch.
      if (this.gesture?.moved) {
        const direction = point.y < 55 ? -1 : point.y > innerHeight - 55 ? 1 : 0;
        if (direction) {
          window.scrollBy(0, direction * 12);
          this.setHover(document.elementFromPoint(point.x, point.y)?.closest('.jack'));
          this.schedulePreview();
        }
      }
    });
  }

  draw() {
    this.cables.replaceChildren();
    const rect = this.rack.getBoundingClientRect();
    this.jacks.forEach(jack => jack.classList.remove('connected'));
    Object.entries(this.routes()).forEach(([dest, src], index) => {
      const output = this.jacks.find(j => j.dataset.jack === src && j.dataset.type === 'output');
      const input = this.jacks.find(j => j.dataset.jack === dest && j.dataset.type === 'input');
      if (!output || !input) return;
      const local = jack => { const p = center(jack); return { x: p.x - rect.left, y: p.y - rect.top }; };
      const d = cableCurve(local(output), local(input));
      const color = colors[index % colors.length];
      this.cables.append(svgElement('path', { d, class: 'cable-shadow' }), svgElement('path', { d, class: 'cable', stroke: color }));
      for (const jack of [output, input]) {
        jack.classList.add('connected');
        jack.style.setProperty('--cable', color);
      }
    });
    this.schedulePreview();
  }
}
