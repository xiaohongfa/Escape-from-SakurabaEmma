"""Build three single-shot M7 candidates from the user-supplied recording.

The ranges are selected from separate waveform transients. This script does not
play or judge the audio; the game exposes each candidate for user audition.
"""

import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/audio/m7-original.m4a"
RATE = 44100
SLICES = {
    "a": (0.115, 0.247),
    "b": (0.333, 0.427),
    "c": (0.805, 0.897),
}
BURST = (0.115, 2.215)


def main():
    raw = subprocess.check_output([
        imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error",
        "-i", str(SOURCE), "-t", str(BURST[1] + 0.05), "-ac", "1", "-ar", str(RATE),
        "-f", "f32le", "-",
    ])
    audio = np.frombuffer(raw, dtype="<f4")
    for variant, (start, end) in SLICES.items():
        piece = audio[round(start * RATE):round(end * RATE)].copy()
        fade = min(round(0.007 * RATE), len(piece) // 5)
        piece[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
        piece[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        peak = max(float(np.max(np.abs(piece))), 1e-6)
        piece *= min(1.0, 0.92 / peak)
        pcm = (np.clip(piece, -1, 1) * 32767).astype("<i2")
        destination = ROOT / f"assets/audio/m7-shot-{variant}.wav"
        with wave.open(str(destination), "wb") as result:
            result.setnchannels(1)
            result.setsampwidth(2)
            result.setframerate(RATE)
            result.writeframes(pcm.tobytes())
        print(f"{variant.upper()}: {start:.3f}-{end:.3f}s -> {destination.name}")

    # The held-fire track keeps the original recording's transient sequence intact.
    # Playback begins 90 ms into this track after the second game shot; the first
    # shot still uses the chosen single-shot slice for responsive tap firing.
    start, end = BURST
    burst = audio[round(start * RATE):round(end * RATE)].copy()
    fade = round(0.02 * RATE)
    burst[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    pcm = (np.clip(burst, -1, 1) * 32767).astype("<i2")
    destination = ROOT / "assets/audio/m7-burst.wav"
    with wave.open(str(destination), "wb") as result:
        result.setnchannels(1)
        result.setsampwidth(2)
        result.setframerate(RATE)
        result.writeframes(pcm.tobytes())
    print(f"Burst: {start:.3f}-{end:.3f}s -> {destination.name}")


if __name__ == "__main__":
    main()
