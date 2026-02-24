#!/usr/bin/env bash
# Audit all SFX files: duration, peak volume, size
# Usage: bash scripts/audit-sounds.sh
SFX=apps/mobile/assets/sfx
printf "%-30s %6s  %10s  %s\n" "FILE" "SIZE" "DURATION" "PEAK"
printf "%-30s %6s  %10s  %s\n" "----" "----" "--------" "----"
for f in "$SFX"/*.wav; do
  name=$(basename "$f")
  size=$(du -h "$f" | cut -f1)
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f" 2>/dev/null | xargs printf "%.3fs")
  peak=$(ffmpeg -i "$f" -af volumedetect -f null /dev/null 2>&1 | grep max_volume | awk '{print $5, $6}')
  printf "%-30s %6s  %10s  %s\n" "$name" "$size" "$dur" "$peak"
done
