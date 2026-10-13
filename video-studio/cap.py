"""python3 cap.py preview t1 t2 ...   |   python3 cap.py full   (frames/ at 30 fps)"""
import asyncio, sys, os, pathlib
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).parent.resolve()
async def main():
    mode = sys.argv[1]
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        pg = await br.new_page(viewport={"width": 1080, "height": 1350})
        pg.on("pageerror", lambda e: print("err", str(e)[:300], flush=True))
        await pg.goto((HERE / "index.html").as_uri()); await pg.wait_for_timeout(1200)
        if mode == "preview":
            os.makedirs(HERE / "prev", exist_ok=True)
            for t in sys.argv[2:]:
                await pg.evaluate(f"void seek({t})")
                await asyncio.wait_for(pg.screenshot(path=str(HERE / f"prev/t{float(t):05.1f}.jpg"), type="jpeg", quality=80), 30)
        else:
            os.makedirs(HERE / "frames", exist_ok=True)
            n = int(await pg.evaluate("DURATION") * 30)
            for i in range(n):
                await pg.evaluate(f"void seek({i / 30})")
                await asyncio.wait_for(pg.screenshot(path=str(HERE / f"frames/{i:05d}.jpg"), type="jpeg", quality=92), 30)
                if i % 300 == 0: print(i, n, flush=True)
        await br.close()
asyncio.run(main())
