from urllib.parse import parse_qs, urlparse, unquote

url = """
http://127.0.0.1:8000/api/v1/general/mobile/55fa3d4d/screen/?config=%7B%22recorder_enable%22%3A%20false%2C%20%22recorder_format%22%3A%20%22mp4%22%2C%20%22audio%22%3A%20true%2C%20%22video_codec%22%3A%20%22h264%22%2C%20%22audio_codec%22%3A%20%22aac%22%2C%20%22audio_source%22%3A%20%22output%22%2C%20%22max_size%22%3A%20720%2C%20%22video_bit_rate%22%3A%20800000%2C%20%22audio_bit_rate%22%3A%20128000%2C%20%22max_fps%22%3A%2025%2C%20%22tunnel_forward%22%3A%20true%2C%20%22crop%22%3A%20%22%22%2C%20%22control%22%3A%20true%2C%20%22show_touches%22%3A%20false%2C%20%22stay_awake%22%3A%20true%2C%20%22video_codec_options%22%3A%20%22profile%3D1%2Clevel%3D2%22%2C%20%22audio_codec_options%22%3A%20%22%22%2C%20%22video_encoder%22%3A%20%22%22%2C%20%22audio_encoder%22%3A%20%22%22%2C%20%22power_off_on_close%22%3A%20false%2C%20%22clipboard_autosync%22%3A%20false%2C%20%22power_on%22%3A%20true%7D
"""

# 解析URL
parsed_url = urlparse(url)
query_parameters = parse_qs(parsed_url.query)
decoded_params = {k: unquote(v[0]) for k, v in query_parameters.items()}

print(decoded_params)
