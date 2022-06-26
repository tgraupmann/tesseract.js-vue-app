<template>
  <div id="app" style="display: flex; color: white">
    <div style="background: #002; width: 750px; height: 500px">
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
      <button @click="browse">Process</button>
    </div>
    <div>
      <button v-on:click="recognize">recognize</button>
      <img id="text-img" alt="Vue logo" src="./assets/testocr.png" />
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
            console.log("onmessage", evt);
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
    browse: function () {
      console.log("Open dialog");

      //console.log("streamSocket", this.streamSocket);
      if (!this.streamSocket) {
        this.connectStreamSocket();
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
    recognize: async () => {
      const img = document.getElementById("text-img");
      console.log(img);
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
    },
  },
  data() {
    let ocrPath = undefined;
    let localStorage = window.localStorage;
    if (localStorage) {
      ocrPath = localStorage.getItem("KEY_OCR_PATH");
    }
    if (!ocrPath) {
      ocrPath = ".";
    }
    return {
      SOCKET_OPEN: 1,
      streamSocket: undefined,
      ocrPath: ocrPath,
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
