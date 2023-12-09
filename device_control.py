import json
import os
import random
import asyncio
import logging

from flask_socketio import SocketIO

import config
from device import DeviceClient
from constants import sc_control_msg_type
from serializers import ReceiveMsgObj, format_get_clipboard_data, format_set_clipboard_data, format_other_data

logging.basicConfig(format='%(asctime)s.%(msecs)s:%(name)s:%(thread)d:%(levelname)s:%(process)d:%(message)s',
                    level=logging.INFO)
"""
{"recorder_enable": false, "recorder_format": "mp4", "audio": true,
 "video_codec": "h264", "audio_codec": "aac", "audio_source": "output", 
 "max_size": 720, "video_bit_rate": 800000, "audio_bit_rate": 128000, 
 "max_fps": 25, "tunnel_forward": true, "crop": "", "control": true, 
 "show_touches": false, "stay_awake": true, "video_codec_options": "profile=1,level=2",
  "audio_codec_options": "", "video_encoder": "", "audio_encoder": "", 
  "power_off_on_close": false, "clipboard_autosync": false, "power_on": true}
"""

"""
{'audio': True, 'video_codec': 'h264', 'audio_codec': 'aac', 'audio_source': 'output',
 'max_size': 720, 'video_bit_rate': 800000, 'audio_bit_rate': 128000, 'max_fps': 25, 
 'tunnel_forward': True, 'crop': '', 'control': True, 'show_touches': False, 
 'stay_awake': True, 'video_codec_options': 'profile=1,level=2', 'audio_codec_options': '',
  'video_encoder': '', 'audio_encoder': '', 'power_off_on_close': False, 'clipboard_autosync': False,
   'power_on': True, 'scid': '0fff2f7a'}
"""

"""
 CLASSPATH=/data/local/tmp/scrcpy-server.jar app_process / com.genymobile.scrcpy.Server 2.1.1
 audio=true video_codec=h264 audio_codec=aac audio_source=output max_size=720 video_bit_rate=800000
 audio_bit_rate=128000 max_fps=25 tunnel_forward=true crop= control=true show_touches=false
 stay_awake=true video_codec_options=profile=1 
 level=2 audio_codec_options= video_encoder= audio_encoder= power_off_on_close=false clipboard_autosync=false
 power_on=true scid=046c7eee
"""


class DeviceConnector:
    is_connected = False

    def __init__(self, device_id: str, socket_io: SocketIO):
        # 投屏的scid,极端情况下会出现scid重复的情况，同一个手机的scrcpy进程scid不能相同
        self.scid = '0' + ''.join([hex(random.randint(0, 15))[-1] for _ in range(7)])
        self.device_id = device_id
        self.query_params = config.DEFAULT_CONTROL_INFO
        self.device_client = None
        self.socket_io = socket_io

    def init_async_worker(self):
        pass

    async def on_connect(self):
        # 1.获取请求参数
        logging.info(f"【DeviceControl】on connect({self.device_id}:{self.scid})")
        self.device_client = DeviceClient(self.socket_io, json.loads(self.query_params), self.device_id, self.scid)
        recorder_filename = self.device_client.recorder_filename.split(os.sep)[-1]
        logging.info(f"【DeviceControl】recorder_filename ({self.device_id}:{self.scid})")
        self.socket_io.emit("other_data", format_other_data(recorder_filename.encode()))
        try:
            await self.device_client.start()

        except Exception as e:
            logging.exception(f"&#8203;``【oaicite:0】``&#8203;({self.device_id}:{self.scid}) start session error: {e}!!!")

    async def receive(self, data):
        """receive used to control device"""
        if not self.device_client.scrcpy_kwargs['control']:
            return
        obj = ReceiveMsgObj()
        if type(data) is dict:
            obj.format_dict_data(data)
        else:
            obj.format_text_data(data)

        # keycode
        if obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_INJECT_KEYCODE:
            if obj.action is None:
                await self.device_client.controller.inject_keycode(obj.keycode, action=0)
                await self.device_client.controller.inject_keycode(obj.keycode, action=1)
            else:
                await self.device_client.controller.inject_keycode(obj.keycode, action=obj.action)
        # text
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_INJECT_TEXT:
            await self.device_client.controller.inject_text(obj.text)
        # touch
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_INJECT_TOUCH_EVENT:
            await self.device_client.controller.inject_touch_event(x=obj.x, y=obj.y, resolution=obj.resolution,
                                                                   action=obj.action)
        # scroll
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_INJECT_SCROLL_EVENT:
            await self.device_client.controller.inject_scroll_event(x=obj.x, y=obj.y, distance_x=obj.distance_x,
                                                                    distance_y=obj.distance_y,
                                                                    resolution=obj.resolution)
        # back_or_screen_on
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_BACK_OR_SCREEN_ON:
            if not obj.action:
                await self.device_client.controller.back_or_screen_on(action=0)
                await self.device_client.controller.back_or_screen_on(action=1)
            else:
                await self.device_client.controller.back_or_screen_on(action=obj.action)
        # get_clipboard
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_GET_CLIPBOARD:
            data = await self.device_client.controller.get_clipboard(copy_key=obj.copy_key)
            self.socket_io.emit("control", format_get_clipboard_data(data), binary=True)
        # set_clipboard
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_SET_CLIPBOARD:
            data = await self.device_client.controller.set_clipboard(text=obj.text, sequence=obj.sequence,
                                                                     paste=obj.paste)
            self.socket_io.emit("control", format_set_clipboard_data(data), binary=True)
        # set_screen_power_mode
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_SET_SCREEN_POWER_MODE:
            await self.device_client.controller.set_screen_power_mode(obj.screen_power_mode)
        # swipe
        elif obj.msg_type == sc_control_msg_type.SC_CONTROL_MSG_TYPE_INJECT_SWIPE_EVENT:
            await self.device_client.controller.swipe(x=obj.x, y=obj.y, end_x=obj.end_x, end_y=obj.end_y,
                                                      resolution=obj.resolution, unit=obj.unit, delay=obj.delay)
        # update resolution
        elif obj.msg_type == 999:
            self.device_client.resolution = obj.resolution

    async def disconnect(self, code):
        if self.device_client:
            await self.device_client.stop()
            self.device_client = None
        self.is_connected = False
        logging.info(f"【DeviceControl】close({self.device_id}:{self.scid}) =======> disconnected")
