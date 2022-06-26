<template>
  <div id="app" style="display: flex; color: white">
    <div style="background: #002; min-width: 500px; min-height: 500px">
      <div>Input the folder to process images to text.</div>
      <div>
        <input
          id="txtPath"
          type="text"
          style="width: 100%"
          @input="changeHandler"
          @change="changeHandler"
          :value="ocrPath"
        />
      </div>
      <button @click="scan">Scan</button>
      <div>Files:</div>
      <div v-for="(file, index) in files" :key="index" style="padding: 4px">
        <span>{{ file }}</span>
        <button @click="process(file)">Process</button>
      </div>
    </div>
    <div>
      <img id="txtImg" style="display: none" width="100%" />
      <textarea
        id="txtResult"
        style="
          position: absolute;
          right: 0px;
          bottom: 0px;
          width: 50%;
          height: 50%;
        "
        cols="40"
        rows="10"
      >
      </textarea>
    </div>
  </div>
</template>

<script>
/* eslint-disable */
import { createWorker, PSM, OEM } from "tesseract.js";
const worker = createWorker({
  logger: (m) => console.log(m),
});

export default {
  name: "app",
  methods: {
    changeHandler: function (evt) {
      //console.log("path:", evt.target.value);
      this.ocrPath = evt.target.value;
      let localStorage = window.localStorage;
      if (localStorage) {
        localStorage.setItem("KEY_OCR_PATH", this.ocrPath);
      }
    },
    connectStreamSocket: function () {
      //console.log("connectStreamSocket");
      var refThis = this;
      //console.log("refThis", refThis);
      if (!refThis.streamSocket) {
        //console.log("create stream socket");
        var streamSocket = new WebSocket("ws://localhost:8081");
        refThis.streamSocket = streamSocket;
        streamSocket.onopen = function (event) {
          //console.log("Stream socket opened");
          streamSocket.onmessage = function (evt) {
            //console.log("onmessage", evt.data);
            if (evt.data) {
              let json = JSON.parse(evt.data);
              if (json) {
                switch (json.method) {
                  case "readfile":
                    const img = document.getElementById("txtImg");
                    console.log("Loading src", json.src);
                    //console.log("data", json.data);
                    img.src = "data:image/png;base64," + json.data;
                    img.style.display = "";
                    var recognize = async function () {
                      const img = document.getElementById("txtImg");
                      //console.log(img);
                      await worker.load();
                      await worker.loadLanguage("eng");
                      await worker.initialize("eng", OEM.LSTM_ONLY);
                      await worker.setParameters({
                        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
                      });
                      const {
                        data: { text },
                      } = await worker.recognize(img);
                      console.log(text);

                      let txtResult = document.getElementById("txtResult");
                      txtResult.value = text;
                    };
                    recognize();
                    break;
                  case "readdir":
                    //console.log("json", JSON.stringify(json, null, 2));
                    this.files = json.files;
                    let localStorage = window.localStorage;
                    if (localStorage) {
                      localStorage.setItem(
                        "KEY_OCR_FILES",
                        JSON.stringify(this.files)
                      );
                    }
                    break;
                }
              }
            }
          };
        };
        streamSocket.onclose = function (event) {
          refThis.streamSocket = undefined;
          setTimeout(function () {
            //reconnect
            refThis.connectStreamSocket();
          }, 1000);
        };
        streamSocket.onerror = function (error) {
          console.error("streamSocket error! ", error);
        };
        refThis.streamSocket = streamSocket;
      }
    },
    scan: function () {
      console.log("Scan Files");

      //console.log("streamSocket", this.streamSocket);
      if (!this.streamSocket) {
        return;
      }

      console.log("streamSocket.readyState", this.streamSocket.readyState);
      if (this.streamSocket.readyState === this.SOCKET_OPEN) {
        let sendJson = {
          method: "readdir",
          path: this.ocrPath,
        };
        console.log("send", JSON.stringify(sendJson));
        this.streamSocket.send(JSON.stringify(sendJson));
      }
    },
    process: function (file) {
      let src = this.ocrPath + "\\" + file;
      console.log("src", src);

      let txtResult = document.getElementById("txtResult");
      txtResult.value = "Processing... " + src;

      let sendJson = {
        method: "readfile",
        src: src,
      };
      console.log("send", JSON.stringify(sendJson));
      this.streamSocket.send(JSON.stringify(sendJson));
      // read bytes on server and receive on socket message
    },
  },
  created() {
    this.connectStreamSocket();
  },
  data() {
    let ocrPath = undefined;
    let localStorage = window.localStorage;
    let files = [];
    if (localStorage) {
      ocrPath = localStorage.getItem("KEY_OCR_PATH");
      let strFiles = localStorage.getItem("KEY_OCR_FILES");
      if (strFiles) {
        files = JSON.parse(strFiles);
        console.log("files", JSON.stringify(files, null, 2));
      }
    }
    if (!ocrPath) {
      ocrPath = ".";
    }
    return {
      SOCKET_OPEN: 1,
      streamSocket: undefined,
      ocrPath: ocrPath,
      files: files,
    };
  },
};
</script>

<style>
#app {
  font-family: "Avenir", Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
