from bitstring import BitStream

raw_h264_stream = b'\x00\x00\x00\x01\x67\x42\x80\x1e\xda\x05' \
                  b'\x01\x68\xce\x3c\x80\x00\x00\x03\x00\x80' \
                  b'\x00\x00\x1e\x67\x4d\x00\x00\x03\x00\xf0' \
                  b'\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00' \
                  b'\x00\x01\x68\xee\x3c\x80\x00\x00\x00\x01' \
                  b'\x1e\xda\x05\x01\x68\xce\x3c'


def find_sps_pps(raw_stream):
    bitstream = BitStream(bytes=raw_stream)
    st = 0
    sps_nal_pos = bitstream.find('0x0000000167', bytealigned=True, start=st)
    if not sps_nal_pos:
        print("SPS NAL not found.")
    else:
        st = sps_nal_pos[0] + 8 * 5

    pps_nal_pos = bitstream.find('0x0000000168', bytealigned=True, start=st)
    if not pps_nal_pos:
        print("PPS NAL not found.")
    else:
        st = pps_nal_pos[0] + 8 * 5

    more_nal_pos = bitstream.find('0x00000001', bytealigned=True, start=st)
    if not more_nal_pos:
        print("No more NAL units found after PPS.")

    print(f"find result  SPS[{str(sps_nal_pos)}] PPS[{str(pps_nal_pos)}] more[{str(more_nal_pos)}]")

    sps_nal_data = bytes()
    if sps_nal_pos and pps_nal_pos:
        sps_nal_data = bitstream[sps_nal_pos[0]:pps_nal_pos[0]].bytes
    elif sps_nal_pos:
        sps_nal_data = bitstream[sps_nal_pos[0]:].bytes
    print("SPS NAL data:", sps_nal_data.hex())

    pps_nal_data = bytes()
    if pps_nal_pos and more_nal_pos:
        pps_nal_data = bitstream[pps_nal_pos[0]:more_nal_pos[0]].bytes        
    elif pps_nal_pos:
        pps_nal_data = bitstream[pps_nal_pos[0]:].bytes
    print("PPS NAL data:", pps_nal_data.hex())

    more_nal_data = bytes()
    if more_nal_pos:
        more_nal_data = bitstream[more_nal_pos[0]:].bytes
        print("more NAL data:", more_nal_data.hex())

    return sps_nal_data, pps_nal_data, more_nal_data

