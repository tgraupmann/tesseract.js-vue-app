<template>
  <div id="app" style="display: flex; color: white">
    <div
      style="
        background: #002;
        min-width: 500px;
        min-height: 500px;
        text-align: left;
      "
    >
      <div>SEARCH:</div>
      <div>
        <input
          id="txtSearch"
          type="text"
          style="width: 100%"
          @input="filterHandler"
          @change="filterHandler"
          :value="search"
        />
      </div>
      <br />

      <div>SCAN:</div>
      <div>Provide a path to search in order to process images to text.</div>
      <input
        id="txtPath"
        type="text"
        style="width: 100%"
        @input="changeHandler"
        @change="changeHandler"
        :value="ocrPath"
      />
      <br />
      <br />

      <center>
        <button style="margin: 5px; padding: 10px" @click="scanFolder">
          Scan Folder For Images
        </button>
        <button style="margin: 5px; padding: 10px" @click="autoProcess">
          Auto Process Files
        </button>
      </center>
      <div>FILES: ({{ this.files.length }})</div>

      <div v-for="(file, index) in displayFiles" :key="index">
        <div
          v-show="!search || processSearch(file)"
          style="cursor: pointer; background: #003333; padding: 4px"
          @click="process(file)"
        >
          <span v-show="processed(file)"
            >&nbsp;
            <u style="color: #0f0" @click="showText(file)">T</u>
          </span>
          &nbsp;
          <u>{{ file }}</u>
        </div>
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
              var json = JSON.parse(evt.data);
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

                      let key = json.src;
                      let localStorage = window.localStorage;
                      if (localStorage) {
                        localStorage.setItem(key, text);
                      }
                      if (refThis.autoIndex != -1) {
                        refThis.autoProcess();
                      }
                      var files = refThis.files;
                      refThis.displayFiles = [];
                      setTimeout(function () {
                        refThis.displayFiles = files;
                      }, 0);
                    };
                    if (!refThis.processedKey(json.src)) {
                      recognize();
                    }
                    break;
                  case "readdir":
                    //console.log("json", JSON.stringify(json, null, 2));
                    this.files = json.files;
                    let localStorage = window.localStorage;
                    if (localStorage) {
                      localStorage.setItem(
                        "KEY_OCR_FILES",
                        JSON.stringify(json.files)
                      );
                    }
                    this.displayFiles = [];
                    setTimeout(function () {
                      refThis.displayFiles = json.files;
                    }, 0);
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
    scanFolder: function () {
      console.log("Scan Files");
      this.autoIndex = -1;
      this.files = [];
      this.displayFiles = [];

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
    autoProcess: function () {
      if (this.autoIndex < 0) {
        this.autoIndex = 0;
      }
      for (let i = this.autoIndex; i < this.files.length; ++i) {
        let file = this.files[i];
        if (this.processed(file)) {
          continue;
        }
        console.log("Processing", i);
        this.process(file);
        break;
      }
    },
    processedKey: function (key) {
      let localStorage = window.localStorage;
      if (localStorage) {
        if (localStorage.getItem(key)) {
          return true;
        }
      }
      return false;
    },
    processed: function (file) {
      let key = this.ocrPath + "\\" + file;
      return this.processedKey(key);
    },
    processSearch: function (file) {
      let key = this.ocrPath + "\\" + file;
      let localStorage = window.localStorage;
      if (localStorage) {
        let text = localStorage.getItem(key);
        if (text) {
          return text.toLowerCase().includes(this.search.toLowerCase());
        }
      }
      return false;
    },
    filterHandler: function (evt) {
      this.search = evt.target.value;
      console.log(this.search);
      var refThis = this;
      var files = refThis.files;
      refThis.displayFiles = [];
      setTimeout(function () {
        refThis.displayFiles = files;
      }, 0);
    },
    showText: function (file) {
      let key = this.ocrPath + "\\" + file;
      let localStorage = window.localStorage;
      if (localStorage) {
        if (localStorage.getItem(key)) {
          let txtResult = document.getElementById("txtResult");
          txtResult.value = localStorage.getItem(key);
        }
      }
    },
    process: function (file) {
      let txtResult = document.getElementById("txtResult");

      let key = this.ocrPath + "\\" + file;
      let localStorage = window.localStorage;
      let text = undefined;
      if (localStorage) {
        text = localStorage.getItem(key);
        if (text) {
          txtResult.value = text;
        }
      }

      if (!text) {
        txtResult.value = "Processing... " + key;
      }

      let sendJson = {
        method: "readfile",
        src: key,
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
      try {
        if (strFiles) {
          files = JSON.parse(strFiles);
          //console.log("files", JSON.stringify(files, null, 2));
        }
      } catch {
        files = [];
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
      displayFiles: files,
      autoIndex: -1,
      search: undefined,
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
