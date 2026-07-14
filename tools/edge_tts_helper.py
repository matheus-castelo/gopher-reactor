import sys
import asyncio
import edge_tts

async def main():
    if len(sys.argv) < 4:
        print("Usage: edge_tts_helper <voice> <output_path> <text>", file=sys.stderr)
        sys.exit(1)

    voice = sys.argv[1]
    output_path = sys.argv[2]
    text = " ".join(sys.argv[3:])

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

if __name__ == "__main__":
    asyncio.run(main())
