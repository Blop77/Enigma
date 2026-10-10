# Enigma Machine Simulator

An interactive, historically accurate simulator of the German **Enigma** cipher machine used in WWII.
Encrypt and decrypt your own messages on a machine that looks, clicks and lights up like the real one.

![Enigma](https://img.shields.io/badge/Enigma-I%20%2F%20M3-c9a356) ![No build step](https://img.shields.io/badge/build-none-555) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Looks like the real machine:** wooden case, rotor windows with thumbwheels, glowing lampboard, round keys in the German QWERTZ layout, and a plugboard with coloured cables.
- **Mechanical sounds:** key clacks, rotor ratchet clicks (you can hear the double step), thumbwheel ticks and plugs going in. All sounds are made live with the Web Audio API, with mute and volume controls.
- **Encrypt and decrypt:** separate tabs with step-by-step instructions. Paste a whole message, or type it letter by letter on the machine.
- **Animate on the machine:** watch a whole message being typed, with keys going down, lamps lighting up and rotors turning.
- **Accurate cipher:**
  - Rotors I–VIII with their real wirings and turnover notches
  - Reflectors UKW-A, UKW-B and UKW-C
  - Ring settings (*Ringstellung*) and start positions (*Grundstellung*)
  - Plugboard (*Steckerbrett*) with up to 13 cables
  - The middle rotor's "double-stepping" quirk
- **Signal path view:** shows how the current runs through the plugboard, the three rotors, the reflector and back to a lamp.
- **Shareable keys:** use *Copy key* / *Load key* to send your settings to a friend as one line of text:
  `Enigma I | UKW-B | Rotors I II III | Rings 01 01 01 | Start AAA | Plugs AB CD`
- **A real 1941 message:** one click loads a genuine German Army message from Operation Barbarossa and its key, ready for you to decrypt.
- **Authentic output formats:** groups of five letters, with X in place of spaces, just like real operators wrote them.
- Works on desktop and mobile, supports your physical keyboard, and remembers your settings between visits.

## How to run it

It's plain HTML, CSS and JavaScript. There's no build step and nothing to install.

- **Locally:** download the repo and open `index.html` in any modern browser.
- **Online with GitHub Pages:** in the repo, go to **Settings → Pages**, set *Source* to **Deploy from a branch**, choose `main` and `/ (root)`, then save. The site will be live at `https://blop77.github.io/enigma/`.

## How to use it

1. **Agree on a key.** Both people set the same *Machine settings*: rotors, rings, start position, reflector and plugboard. *🎲 Random key* followed by *📋 Copy key* is the easiest way.
2. **Encrypt.** On the 🔒 Encrypt tab, type your message and press **Encrypt message**. Send the result.
3. **Decrypt.** The receiver loads the same key (*📥 Load key*), opens the 🔓 Decrypt tab, pastes the ciphertext and presses **Decrypt message**.

Enigma is *reciprocal*: running the ciphertext through a machine with the same settings gives back the plaintext. Every message starts from the configured start position, so encrypting and decrypting always line up.

**Tip:** before you type anything, turning the rotor thumbwheels also sets the start position. After you've typed, press **Reset** to return to it.

## Project structure

```
index.html            page layout and the guide
css/style.css         all styling (the machine is pure CSS, no images)
js/enigma.js          the cipher engine (works in browser and Node.js)
js/sound.js           synthesised mechanical sound effects
js/app.js             user interface: keys, lamps, rotors, plugboard, messages
tests/enigma.test.js  engine tests against known historical values
```

## Tests

```bash
node tests/enigma.test.js
```

The tests check the engine against reference values: `AAAAA → BDZGO`, the `ADU → ADV → AEW → BFX` double step, the two-notch rotors VI–VIII, and the full decryption of the 1941 Barbarossa message.

## How Enigma works (short version)

Pressing a key sends current through the **plugboard** (which swaps letter pairs), then right to left through three **rotors** (each one scrambles the alphabet). The **reflector** then sends it back through the rotors by a different path, and through the plugboard again to light a **lamp**. Before each key press the right rotor steps, and now and then it carries the middle and left rotors along, so the scramble changes with every letter.

Because of the reflector, a letter can never be encrypted as itself. That was a weakness that helped Alan Turing and the codebreakers at Bletchley Park break Enigma.

## License

MIT, see [LICENSE](LICENSE).
