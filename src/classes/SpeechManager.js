export class SpeechManager {
    constructor() {
        this.loadVoices();
        this.lastMsg = '';
        this.lastMsgTime = 0;
        this.msgThrottle = 15000;
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }

    loadVoices() {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            console.log("Loaded voices:", voices);
        }
    }

    speak(text) {
        const msg = new SpeechSynthesisUtterance(text);
        const now = performance.now();

        //speech throttling
        if(this.lastMsg === text && now - this.lastMsgTime < this.msgThrottle) return;
        
        this.lastMsgTime = performance.now();
        this.lastMsg = text;
        const voices = speechSynthesis.getVoices();
        const chosenVoice = voices.find(v => v.name === "Microsoft Zira - English (United States)");

        if (chosenVoice) {
            msg.voice = chosenVoice;
            console.log("Using voice:", chosenVoice.name);
        } else {
            console.warn("Zira not found, using default voice.");
        }

        speechSynthesis.speak(msg);
    }
}