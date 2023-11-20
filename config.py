# adb
import os

ADB_SERVER_ADDR = os.environ.get('ADB_SERVER_ADDR') or '127.0.0.1'
ADB_SERVER_PORT = os.environ.get('ADB_SERVER_PORT') or '5037'

DEFAULT_CONTROL_INFO = """
{'audio': True, 'video_codec': 'h264', 'audio_codec': 'aac', 'audio_source': 'output',
 'max_size': 720, 'video_bit_rate': 800000, 'audio_bit_rate': 128000, 'max_fps': 25, 
 'tunnel_forward': True, 'crop': '', 'control': True, 'show_touches': False, 
 'stay_awake': True, 'video_codec_options': 'profile=1,level=2', 'audio_codec_options': '',
  'video_encoder': '', 'audio_encoder': '', 'power_off_on_close': False, 'clipboard_autosync': False,
   'power_on': True, 'scid': '0fff2f7a'}
"""