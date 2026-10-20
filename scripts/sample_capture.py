#!/usr/bin/env python3
"""Sample an existing recording locally, without controlling or reading the game."""

import argparse
import json
import math
import re
import shutil
import subprocess
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("output", type=Path, help="New directory for private analysis files")
    parser.add_argument("--crop", nargs=4, type=int, required=True, metavar=("X", "Y", "WIDTH", "HEIGHT"))
    parser.add_argument("--interval", type=float, default=2, help="Minimum seconds between sampled keyframes")
    parser.add_argument("--all-frames", action="store_true", help="Decode between keyframes for denser temporal analysis")
    args = parser.parse_args()
    if not args.video.is_file() or not math.isfinite(args.interval) or args.interval <= 0:
        parser.error("A readable recording and a positive interval are required")
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        parser.error("FFmpeg and ffprobe must be installed and available on PATH")
    metadata = json.loads(subprocess.check_output([
        ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries",
        "format=duration,size:stream=width,height,r_frame_rate", "-of", "json", str(args.video),
    ]))
    stream = metadata["streams"][0]
    x, y, width, height = args.crop
    if min(x, y) < 0 or min(width, height) <= 0 or x + width > stream["width"] or y + height > stream["height"]:
        parser.error("Crop must fit inside the recording")
    if args.output.exists():
        parser.error("Output directory already exists; choose a new directory to preserve previous results")
    args.output.mkdir(parents=True)
    filters = (
        f"select=isnan(prev_selected_t)+gte(t-prev_selected_t\\,{args.interval}),"
        f"showinfo,crop={width}:{height}:{x}:{y},scale=320:176:flags=area"
    )
    result = subprocess.run([
        ffmpeg, "-hide_banner", "-nostats", "-loglevel", "info", *([] if args.all_frames else ["-skip_frame", "nokey"]),
        "-i", str(args.video), "-map", "0:v:0", "-vf", filters, "-fps_mode", "vfr",
        str(args.output / "frame-%04d.png"),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    (args.output / "extraction.log").write_text(result.stderr)
    if result.returncode:
        raise SystemExit(f"FFmpeg failed; inspect {args.output / 'extraction.log'}")
    samples = [
        {"file": f"frame-{int(index) + 1:04d}.png", "seconds": float(seconds)}
        for index, seconds in re.findall(r"\bn:\s*(\d+).*?\bpts_time:([\d.eE+\-]+)", result.stderr)
    ]
    files = sorted(args.output.glob("frame-*.png"))
    if not samples or len(samples) != len(files):
        raise SystemExit("Frame timestamps did not match output files; inspect extraction.log")
    manifest = {
        "video": str(args.video.resolve()), "metadata": metadata, "crop": args.crop,
        "sample_size": [320, 176], "minimum_interval_seconds": args.interval,
        "sampling": ("All decoded frames" if args.all_frames else "Actual keyframes only") + "; timestamps come from decoded frame PTS, not frame numbering",
        "frames": samples,
    }
    (args.output / "capture.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Sampled {len(samples)} frames; recording unchanged. Manifest: {args.output / 'capture.json'}")


if __name__ == "__main__":
    main()
