import asyncio
import logging

import adbutils
from adbutils import AdbError, AdbTimeout


async def loop_for_detect_device():
    adb = adbutils.AdbClient(host="127.0.0.1", port=5037)
    while True:
        try:
            while True:
                for info in adb.list():
                    print(info.serial, info.state)
                await asyncio.sleep(2)
        except (AdbError, AdbTimeout) as e:
            logging.error(f"abd server error!!{str(e)}")
        finally:
            logging.error("abd retry!!")
            await asyncio.sleep(3)

asyncio.run(loop_for_detect_device())
