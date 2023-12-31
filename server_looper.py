import asyncio
import logging
import threading
import time
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


def join_device(sid, device_id):
    if device_id in devices_cache:
        connector = devices_cache[device_id]
        if connector.device_client and len(connector.device_client.h264_sps_pps_nal) > 0:
            flask_sio.emit("video_nal", connector.device_client.h264_sps_pps_nal, to=device_id)
    return None


async def loop_for_trace_device():
    """
    True 77053db4 offline
    False 77053db4 absent
    True 77053db4 device
    False 77053db4 absent
    True 77053db4 offline
    False 77053db4 absent
    """
    adb = adbutils.AdbClient(host=config.ADB_SERVER_ADDR, port=int(config.ADB_SERVER_PORT))

    def trace_devices():
        logging.info("start trace_devices")
        while True:
            try:
                for event in adb.track_devices():
                    logging.info(f"track_device item: {event.present, event.serial, event.status}")
                    if event.present and event.status == "device":
                        logging.info(f"track_device: new device connect-> {event.serial}")
                        DEVICES_ID_SET.add(event.serial)
                        device_id, a_future = start_run_loop(event.serial)
                        RUNNING_DEVICE_THREAD_DICT[device_id] = a_future
                    else:
                        logging.info(f"detect: device offline -> {event.serial}")
                        stop_run_loop(event.serial)

            except AdbError as e:
                logging.error(f"adb trace_devices error: {e}")
            finally:
                logging.info(f"trace_devices will retry after 5s !!")
                time.sleep(5)

    await asyncio.to_thread(trace_devices)


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
    detect_loop.run_until_complete(loop_for_trace_device())


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
