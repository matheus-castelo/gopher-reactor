#!/bin/bash
set -e

echo "=== Building edge-tts-helper ==="
cd tools
pyinstaller --onefile --name edge-tts-helper --distpath ../build/bin edge_tts_helper.py
cd ..

echo "=== Building Wails app ==="
wails build -clean

echo "=== Done ==="
echo "Output: build/bin/"
ls -la build/bin/
