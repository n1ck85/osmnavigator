export class DeviceManager {
    constructor() {
        this.wakeLockSentinel = null;
        this.wakeLockActive = false;
        this.getHeading = this.getHeading.bind(this);
        this.heading = 0;
        this.lastHeadingUpdate = 0;
    }

    supportLogger(name,message) {
        const logEl = document.getElementById("device-support-log");
        if (logEl) {
            const entry = document.createElement("div");
            entry.textContent = `${name}: ${message}`;
            //log without duplicates
            if (!logEl.textContent.includes(entry.textContent)) {
                logEl.appendChild(entry);
            }
        }
    }

    startOrientationTracking() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            // iOS 13+ Safari requires this call
            DeviceOrientationEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        window.addEventListener('deviceorientation', this.getHeading);
                    }
                }).catch(console.error);
        } else if ('ondeviceorientationabsolute' in window) {
            // Non-iOS 13+ or desktop: events fire automatically
            window.addEventListener('deviceorientationabsolute', this.getHeading);
        }
    }

    getHeading(event) {
        const now = performance.now();

        // throttle to 10Hz (100ms)
        if (now - this.lastHeadingUpdate < 100) return;
        this.lastHeadingUpdate = now;

        if (event.webkitCompassHeading) {
            // iOS gives true compass heading
            this.setHeading(event.webkitCompassHeading);
        } else {
            // Android: use absolute orientation to calculate heading
            if(event.alpha !== null) {
                //this.supportLogger("Magnetic Heading", `Device orientation absolute alpha: ${event.alpha.toFixed(2)}°`);
                this.setHeading((360 - event.alpha) % 360);
            }
            else {
                this.supportLogger("Magnetic Heading", "Device orientation not available");
            }
        }
    }

    setHeading(heading) {
        this.heading = heading;
        const el = document.getElementById("heading-marker");

        if (el) {
            el.style.transform = `rotate(${heading}deg)`;
        }
    }

    toggleWakeLock(e) {console.log("Toggling Wake Lock...");
        const icon = e.currentTarget.querySelector("i");

        if ('wakeLock' in navigator) {
            if (!this.wakeLockActive) {
                navigator.wakeLock.request('screen').then(sentinel => {
                    this.wakeLockSentinel = sentinel;
                    this.wakeLockActive = true;
                    if (icon) {
                        icon.classList.remove("bi-eye");
                        icon.classList.add("bi-eye-fill");
                    }
                }).catch(err => {
                    console.error('Wake Lock failed:', err);
                    this.supportLogger("Wake Lock", "Failed to activate Wake Lock.");
                });
            }
            else {
                this.wakeLockSentinel.release().then(() => {
                    this.wakeLockActive = false;
                    if (icon) {
                        icon.classList.remove("bi-eye-fill");
                        icon.classList.add("bi-eye");
                    }
                }); 
            }
        } else {
            this.supportLogger("Wake Lock", "Wake Lock API not supported on this device.");
        }
    }
}