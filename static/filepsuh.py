import asyncio

from tools.adb import AsyncAdbDevice

adb_device = AsyncAdbDevice('55fa3d4d')


async def push_file():
    print("start push file ")
    await adb_device.push_file('1234.pptx', '/data/local/tmp/scrcpy-server.hhe')
    print("finished push file ")


if __name__ == '__main__':
    # asyncio.run(main())
    mytask = asyncio.create_task(push_file())
    asyncio.run(mytask)
