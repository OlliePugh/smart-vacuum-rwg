v4l2-ctl --set-ctrl video_bitrate=500000 && gst-launch-1.0 -v v4l2src do-timestamp=true extra-controls="text,h264_profile=0" ! video/x-h264,framerate=20/1,width=512,height=288 ! h264parse config-interval=1 ! rtph264pay ! udpsink host=stream.ollieq.co.uk port=8004 sync=false
