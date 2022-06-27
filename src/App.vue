<template>
  <div
    id="app"
    style="display: flex; background: #333; color: white; height: 100%"
  >
    <div
      style="
        display: flex;
        flex-direction: column;
        min-width: 400px;
        row-gap: 10px;
        background: #888;
      "
    >
      <a id="anchorDownload" style="display: none"></a>
      <input id="inputImport" type="file" style="display: none" />
      <div style="background: #002; padding: 10px">
        <div>SEARCH:</div>
        <div>
          <input
            id="txtSearch"
            type="text"
            style="margin: 0px; padding: 0px; width: 100%"
            @input="filterHandler"
            @change="filterHandler"
            :value="search"
          />
        </div>
      </div>

      <div style="background: #002; padding: 10px">
        <center>
          <button style="margin: 5px; padding: 10px" @click="textImport">
            Import
          </button>
          <button style="margin: 5px; padding: 10px" @click="textExport">
            Export
          </button>
        </center>
      </div>

      <div style="background: #002; padding: 10px">
        <div>SCAN:</div>
        <div>Provide a path to search in order to process images to text.</div>
        <input
          id="txtPath"
          type="text"
          style="margin: 0px; padding: 0px; width: 100%"
          @input="changeHandler"
          @change="changeHandler"
          :value="ocrPath"
        />
      </div>

      <div style="background: #002; padding: 10px">
        <center>
          <button style="margin: 5px; padding: 10px" @click="scanFolder">
            Scan Folder For Images
          </button>
          <button style="margin: 5px; padding: 10px" @click="autoProcess">
            Auto Process Files
          </button>
        </center>
      </div>

      <div style="background: #002; padding: 10px">
        <div>FILES: ({{ this.files.length }})</div>

        <div style="max-height: 600px; overflow: scroll">
          <div v-for="(file, index) in displayFiles" :key="index">
            <div
              v-show="!search || processSearch(file)"
              style="cursor: pointer; padding: 4px"
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
      </div>
    </div>
    <div>
      <img id="txtImg" style="display: none" width="100%" />
      <div
        style="
          position: absolute;
          right: 0px;
          bottom: 0px;
          width: 50%;
          height: 50%;
          background: #003;
        "
      >
        <div
          style="
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 10px;
          "
        >
          <progress
            style="width: 100%; height: 30px"
            min="0"
            max="100"
            :value="progress"
          ></progress>

          <textarea id="txtResult" style="height: 100%" rows="10"> </textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/* eslint-disable */
import { createWorker, PSM, OEM } from "tesseract.js";

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
                      await refThis.worker.load();
                      await refThis.worker.loadLanguage("eng");
                      await refThis.worker.initialize("eng", OEM.LSTM_ONLY);
                      await refThis.worker.setParameters({
                        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
                      });
                      const {
                        data: { text },
                      } = await refThis.worker.recognize(img);
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
                    if (refThis.processedKey(json.src)) {
                      refThis.progress = 100;
                    } else {
                      refThis.progress = 0;
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
    textImport: function () {
      let refThis = this;
      let inputImport = document.getElementById("inputImport");
      if (inputImport) {
        inputImport.onchange = (e) => {
          if (e && e.target && e.target.files) {
            let file = e.target.files[0];
            if (file) {
              //console.log(file);
              let reader = new FileReader();
              reader.readAsText(file, "UTF-8");
              // read file
              reader.onload = (readerEvent) => {
                let localStorage = window.localStorage;
                if (
                  readerEvent &&
                  readerEvent.target &&
                  readerEvent.target.result &&
                  localStorage
                ) {
                  let content = readerEvent.target.result;
                  //console.log(content);
                  let json = JSON.parse(content);
                  if (json) {
                    let keys = Object.keys(json);
                    for (let i = 0; i < keys.length; ++i) {
                      let key = keys[i];
                      //console.log("key", key);
                      localStorage.setItem(key, json[key]);
                    }
                    refThis.displayFiles = [];
                    setTimeout(function () {
                      refThis.displayFiles = refThis.files;
                    }, 0);
                  }
                }
              };
            }
          }
        };
        inputImport.click();
      }
    },
    textExport: function () {
      let localStorage = window.localStorage;
      if (localStorage) {
        var results = {};
        for (let i = 0; i < this.files.length; ++i) {
          let file = this.files[i];
          let key = this.ocrPath + "\\" + file;
          let text = localStorage.getItem(key);
          if (text) {
            results[key] = text;
          }
        }

        let anchorDownload = document.getElementById("anchorDownload");
        if (anchorDownload) {
          anchorDownload.setAttribute(
            "href",
            "data:text/plain;charset=utf-8," +
              encodeURIComponent(JSON.stringify(results, null, 2))
          );
          anchorDownload.setAttribute("download", "ocr.json");

          if (document.createEvent) {
            var event = document.createEvent("MouseEvents");
            event.initEvent("click", true, true);
            anchorDownload.dispatchEvent(event);
          } else {
            anchorDownload.click();
          }
        }
      }
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
      this.progress = 0;

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
    var refThis = this;
    const worker = createWorker({
      logger: (m) => {
        console.log(m);
        if (m.progress) {
          refThis.progress = Math.round(m.progress * 100);
        }
      },
    });
    return {
      SOCKET_OPEN: 1,
      streamSocket: undefined,
      ocrPath: ocrPath,
      files: files,
      displayFiles: files,
      autoIndex: -1,
      search: undefined,
      progress: 0,
      worker: worker,
    };
  },
};
</script>

<style></style>
