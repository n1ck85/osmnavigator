function compassHeading(alpha, beta, gamma) {
    const d = Math.PI / 180;
    const a = alpha * d, b = beta * d, g = gamma * d;
    const cA = Math.cos(a), sA = Math.sin(a);
    const cB = Math.cos(b), sB = Math.sin(b);
    const cG = Math.cos(g), sG = Math.sin(g);

    let east, north;
    if (beta < 0 || cB * cG > 0.7) {
        // Top edge tipped down, or phone roughly flat:
        // use the direction the top edge of the phone points
        east = -sA * cB;
        north = cA * cB;
    } else {
        // Held upright: use the direction the back of the phone faces
        east = -cA * sG - sA * sB * cG;
        north = -sA * sG + cA * sB * cG;
    }

    return (Math.atan2(east, north) / d + 360) % 360;
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