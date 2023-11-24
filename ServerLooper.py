import asyncio
import logging
import threading
from asyncio import BaseEventLoop, Task
from concurrent.futures import Future, ThreadPoolExecutor
import adbutils
from adbutils import AdbError, AdbTimeout

import config
from app import socketio
from device_control import DeviceConnector


DEVICES_ID_SET = set()
RUNNING_DEVICE_LOOP_DICT: [str, BaseEventLoop] = dict()
RUNNING_DEVICE_TASK_DICT: [str, Task] = dict()
RUNNING_DEVICE_THREAD_DICT: dict[str, Future] = dict()
EXECUTOR = ThreadPoolExecutor(max_workers=20, thread_name_prefix="thread_device_running_loop")

logging.basicConfig(format='%(asctime)s.%(msecs)s:%(name)s:%(thread)d:%(levelname)s:%(process)d:%(message)s',
                    level=logging.INFO)


async def loop_for_detect_device():
    adb = adbutils.AdbClient(host=config.ADB_SERVER_ADDR, port=int(config.ADB_SERVER_PORT))
    while True:
        try:
            while True:
                device_list = adb.list()
                old_set = DEVICES_ID_SET.copy()
                DEVICES_ID_SET.clear()
                for info in device_list:
                    if info.serial not in old_set and info.state == "device":
                        # device_id is the same as info.serial
                        device_id, a_future = start_run_loop(info.serial)
                        RUNNING_DEVICE_THREAD_DICT[device_id] = a_future
                        DEVICES_ID_SET.add(info.serial)
                        logging.info(f"detect: new device connect-> {device_id} {info.state}")
                    elif info.serial not in old_set and not info.state == "device":
                        # no deal device
                        continue
                    elif info.serial in old_set and info.state == "device":
                        # normal running device
                        old_set.remove(info.serial)
                        continue
                    elif info.serial in old_set and not info.state == "device":
                        # should stop running device
                        logging.info(f"detect: device state failed -> {info.serial} {info.state}")
                await asyncio.sleep(3)
                [stop_run_loop(d_id) for d_id in old_set]
        except (AdbError, AdbTimeout) as e:
            logging.error(f"abd server error!!{str(e)}")
        finally:
            logging.error("adb retry!!")
            await asyncio.sleep(3)


async def loop_for_run_each_device(device_id):
    logging.info(f"loop_for_run_each_device {device_id}")
    device_c = DeviceConnector(device_id, socketio)
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
        working_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(working_loop)
        RUNNING_DEVICE_LOOP_DICT[device_id] = working_loop
        threading.current_thread().name = f"thread_device_running_loop[{device_id}]"
        working_loop.run_until_complete(loop_for_run_each_device(device_id))
    return device_id, EXECUTOR.submit(_thread_for_device)


def stop_run_loop(device_id):
    if device_id in RUNNING_DEVICE_LOOP_DICT:
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


asyncio.run(loop_for_detect_device())
