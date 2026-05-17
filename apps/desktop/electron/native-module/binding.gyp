{
  "targets": [
    {
      "target_name": "system_audio_capture",
      "sources": [ "system_audio_capture.cc" ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "link_settings": {
        "libraries": [ "-lksuser", "-lole32", "-lmfplat", "-lmfuuid" ]
      }
    }
  ]
}