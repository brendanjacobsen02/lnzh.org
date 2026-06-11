/*
 * time-audio.js — the hum of /time/.
 *
 * A quiet generative drone: two close sines, a sub, and lowpassed pink noise,
 * breathing on a slow LFO. Drifting deeper opens the filter; holding a memory
 * plays a soft pentatonic blip. Everything is synthesized — no audio files, so
 * CSP `script-src 'self'` is all it needs.
 *
 * The AudioContext is created only inside the first real user gesture
 * (autoplay policy — also keeps the console clean for the verify gate).
 * Exposes window.lnzhHum for time-drift.js.
 */
(function () {
    'use strict';

    var STORE = 'time-audio';                 // 'off' = muted by choice
    var ctx = null, master = null, filter = null, started = false;
    var muted = false, hidden = false;
    var blipPool = [];

    var reduced = !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    try { muted = localStorage.getItem(STORE) === 'off'; } catch (e) { /* ignore */ }
    if (reduced) { muted = true; }            // silence is the calm default

    function pinkNoiseBuffer(ac) {
        // Voss-ish pink noise, 2s loop — soft static, no harsh hiss
        var len = ac.sampleRate * 2;
        var buf = ac.createBuffer(1, len, ac.sampleRate);
        var data = buf.getChannelData(0);
        var b0 = 0, b1 = 0, b2 = 0, white, i;
        for (i = 0; i < len; i++) {
            white = Math.random() * 2 - 1;
            b0 = 0.997 * b0 + 0.029 * white;
            b1 = 0.985 * b1 + 0.041 * white;
            b2 = 0.950 * b2 + 0.050 * white;
            data[i] = (b0 + b1 + b2) * 0.18;
        }
        return buf;
    }

    function build() {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0;

        filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 240;
        filter.Q.value = 0.4;
        filter.connect(master);
        master.connect(ctx.destination);

        function osc(type, freq, gain) {
            var o = ctx.createOscillator();
            var g = ctx.createGain();
            o.type = type;
            o.frequency.value = freq;
            g.gain.value = gain;
            o.connect(g);
            g.connect(filter);
            o.start();
            return o;
        }

        var drone1 = osc('sine', 55, 0.05);        // A1
        var drone2 = osc('sine', 82.4, 0.035);     // E2 — an open fifth
        osc('triangle', 110, 0.018);               // A2, faint body

        var noise = ctx.createBufferSource();
        noise.buffer = pinkNoiseBuffer(ctx);
        noise.loop = true;
        var nFilter = ctx.createBiquadFilter();
        nFilter.type = 'lowpass';
        nFilter.frequency.value = 220;
        var nGain = ctx.createGain();
        nGain.gain.value = 0.012;
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(filter);
        noise.start();

        // the field breathing: ±4 cents of detune, ~14s period
        var lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        var lfoGain = ctx.createGain();
        lfoGain.gain.value = 4;
        lfo.connect(lfoGain);
        lfoGain.connect(drone1.detune);
        lfoGain.connect(drone2.detune);
        lfo.start();
    }

    function rampMaster(target, secs) {
        if (!ctx) { return; }
        master.gain.setTargetAtTime(target, ctx.currentTime, secs);
    }

    /* ---- public API ---- */
    window.lnzhHum = {
        // call from inside a user gesture; safe to call repeatedly
        start: function () {
            if (started) {
                if (ctx && ctx.state === 'suspended' && !hidden) { ctx.resume(); }
                return;
            }
            started = true;
            try { build(); } catch (e) { ctx = null; return; }
            if (!muted) { rampMaster(0.5, 1.6); }   // fades in like fog clearing
        },

        // t01: 0 at the entrance, 1 at the deepest drift
        setDepth: function (t01) {
            if (!ctx || muted) { return; }
            var f = 180 + (900 - 180) * Math.max(0, Math.min(1, t01));
            filter.frequency.setTargetAtTime(f, ctx.currentTime, 0.25);
        },

        // a soft note when a memory is held; i seeds the pentatonic step
        blip: function (i) {
            if (!ctx || muted) { return; }
            var penta = [0, 2, 4, 7, 9];
            var step = penta[((i % 5) + 5) % 5] + 12 * (1 + (i % 3));
            var freq = 220 * Math.pow(2, step / 12);
            var o = ctx.createOscillator();
            var g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = freq;
            g.gain.value = 0;
            o.connect(g);
            g.connect(master.gain.value > 0 ? filter : master); // muted = silent anyway
            g.gain.setTargetAtTime(0.09, ctx.currentTime, 0.004);
            g.gain.setTargetAtTime(0, ctx.currentTime + 0.05, 0.18);
            o.start();
            o.stop(ctx.currentTime + 1.2);
            blipPool.push(o);
            if (blipPool.length > 8) { blipPool.shift(); }
        },

        setMute: function (m) {
            muted = !!m;
            try { localStorage.setItem(STORE, muted ? 'off' : 'on'); } catch (e) { /* ignore */ }
            if (!ctx) { return; }
            rampMaster(muted ? 0 : 0.5, 0.3);
        },

        muted: function () { return muted; },
        running: function () { return !!ctx; }
    };

    /* politeness: no humming in a backgrounded tab */
    document.addEventListener('visibilitychange', function () {
        hidden = document.hidden;
        if (!ctx) { return; }
        if (hidden) { ctx.suspend(); }
        else if (!muted) { ctx.resume(); }
    });
    window.addEventListener('pagehide', function () {
        if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } ctx = null; }
    });
})();
