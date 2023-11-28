import asyncio
import logging
import threading
from asyncio import BaseEventLoop, Task
from concurrent.futures import Future, ThreadPoolExecutor
import adbutils
from adbutils import AdbError, AdbTimeout, AdbDeviceInfo
from flask_socketio import SocketIO
import config
from device_control import DeviceConnector

DEVICES_ID_SET: set[str] = set()
RUNNING_DEVICE_LOOP_DICT: [str, BaseEventLoop] = dict()
RUNNING_DEVICE_TASK_DICT: [str, Task] = dict()
RUNNING_DEVICE_THREAD_DICT: dict[str, Future] = dict()
EXECUTOR = ThreadPoolExecutor(max_workers=20, thread_name_prefix="thread_device_running_loop")
flask_sio: None | SocketIO = None
devices_cache: dict[str, DeviceConnector] = {}


async def loop_for_detect_device():
    adb = adbutils.AdbClient(host=config.ADB_SERVER_ADDR, port=int(config.ADB_SERVER_PORT))
    while True:
        try:
            while True:
                old_set = DEVICES_ID_SET.copy()
                DEVICES_ID_SET.clear()
                [DEVICES_ID_SET.add(info.serial) for info in adb.list()]
                # deal listed devices
                for info in adb.list():
                    if info.serial not in old_set and info.state == "device":
                        logging.info(f"detect: new device connect-> {info.serial} {info.state}")
                        # device_id is the same as info.serial
                        device_id, a_future = start_run_loop(info.serial)
                        RUNNING_DEVICE_THREAD_DICT[device_id] = a_future
                    elif info.serial not in old_set and not info.state == "device":
                        # no deal device
                        continue
                    elif info.serial in old_set and info.state == "device":
                        # normal running device
                        continue
                    elif info.serial in old_set and not info.state == "device":
                        # should stop running device
                        logging.info(f"detect: device offline -> {info.serial} {info.state}")
                        stop_run_loop(info.serial)
                # deal dismiss devices
                for device_id in old_set:
                    if device_id not in DEVICES_ID_SET:
                        logging.info(f"detect: device dismiss -> {device_id}")
                        stop_run_loop(device_id)
                await asyncio.sleep(5)
        except (AdbError, AdbTimeout) as e:
            logging.error(f"abd server error!!{str(e)}")
        finally:
            logging.error("adb retry!!")
            await asyncio.sleep(3)


async def loop_for_run_each_device(device_id):
    logging.info(f"loop_for_run_each_device {device_id}")
    device_c = DeviceConnector(device_id, flask_sio)
    devices_cache[device_id] = device_c
    running_task = asyncio.create_task(device_c.on_connect())
    RUNNING_DEVICE_TASK_DICT[device_id] = running_task
    try:
        await running_task
    except asyncio.CancelledError:
        await device_c.disconnect(0)
        print(f"device[{device_id}] asyncio loop task is cancelled")


def start_run_loop(device_id) -> (str, Future):
    logging.info(f"start_run_loop [{device_id}]")

    def _thread_for_device():
        logging.info(f"_thread_for_device [{threading.current_thread()}]")
        device_running_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(device_running_loop)
        RUNNING_DEVICE_LOOP_DICT[device_id] = device_running_loop
        threading.current_thread().name = f"thread_device_running_loop[{device_id}]"
        device_running_loop.run_until_complete(loop_for_run_each_device(device_id))

    return device_id, EXECUTOR.submit(_thread_for_device)


def stop_run_loop(device_id):
    if device_id in RUNNING_DEVICE_LOOP_DICT and device_id in RUNNING_DEVICE_TASK_DICT:
        l: BaseEventLoop = RUNNING_DEVICE_LOOP_DICT[device_id]
        ts: Task = RUNNING_DEVICE_TASK_DICT[device_id]
        l.call_soon_threadsafe(ts.cancel)
        RUNNING_DEVICE_LOOP_DICT.pop(device_id)
        RUNNING_DEVICE_TASK_DICT.pop(device_id)
        if device_id in RUNNING_DEVICE_THREAD_DICT:
            t: Future = RUNNING_DEVICE_THREAD_DICT[device_id]
            t.cancel()
            RUNNING_DEVICE_THREAD_DICT.pop(device_id)
    logging.info(f"finally stop [{device_id}] ")


def begin_detect_devices():
    detect_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(detect_loop)
    asyncio.run(loop_for_detect_device())


def receive(device_id, data):
    if device_id in RUNNING_DEVICE_LOOP_DICT and device_id in devices_cache:
        device_running_loop: BaseEventLoop = RUNNING_DEVICE_LOOP_DICT[device_id]
        asyncio.run_coroutine_threadsafe(devices_cache[device_id].receive(data), device_running_loop)


def get_adb_devices_list():
    return DEVICES_ID_SET


def init(sio: SocketIO) -> Future:
    if sio:
        global flask_sio
        flask_sio = sio
    return EXECUTOR.submit(begin_detect_devices)

