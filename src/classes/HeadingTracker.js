function compassHeading(alpha, beta, gamma) {
    const d = Math.PI / 180;
    const a = alpha * d, b = beta * d, g = gamma * d;
    const rA = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
    const rB = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);

    // Phone lying flat: formula breaks down, use alpha directly
    if (Math.hypot(rA, rB) < 0.1) return (360 - alpha) % 360;

    let h = Math.atan(rA / rB);
    if (rB < 0) h += Math.PI;
    else if (rA < 0) h += 2 * Math.PI;
    return h / d;
}

export class HeadingTracker {
    /**
     * @param {(heading:number)=>void} onHeading  called with a 0-360 heading
     * @param {number} throttle                   min ms between updates
     */
    constructor(onHeading, throttle = 50) {
        this.onHeading = onHeading;
        this.throttle = throttle;
        this.declination = 0; // degrees, east positive (set for true north)
        this.lastUpdate = 0;
        this.eventName = null;
        this.handleEvent = this.handleEvent.bind(this);
    }

    // Call from a tap/click handler (required by iOS)
    start() {
        if (this.eventName) return; // already running

        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(r => { if (r === 'granted') this.attach(); })
                .catch(console.error);
        } else {
            this.attach();
        }
    }

    stop() {
        if (!this.eventName) return;
        window.removeEventListener(this.eventName, this.handleEvent, true);
        this.eventName = null;
    }

    attach() {
        // Chromium has the absolute event; others only have the plain one
        this.eventName = ('ondeviceorientationabsolute' in window)
            ? 'deviceorientationabsolute'
            : 'deviceorientation';
        window.addEventListener(this.eventName, this.handleEvent, true);
    }

    handleEvent(event) {
        const now = performance.now();
        if (now - this.lastUpdate < this.throttle) return;
        this.lastUpdate = now;

        let heading = null;

        if (event.webkitCompassHeading != null) {
            heading = event.webkitCompassHeading; // iOS
        } else if (event.absolute && event.alpha != null &&
                   event.beta != null && event.gamma != null) {
            heading = compassHeading(event.alpha, event.beta, event.gamma);
        }

        if (heading !== null && !isNaN(heading)) {
            this.onHeading((heading + this.declination + 360) % 360);
        }
    }
}