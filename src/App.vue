<template>
  <div id="app" style="display: flex; background: #333; color: white; height: 100%">
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
          <button style="margin: 5px; padding: 10px" @click="textImport">Import</button>
          <button style="margin: 5px; padding: 10px" @click="textExport">Export</button>
          <button style="margin: 5px; padding: 10px" @click="clearCache">
            Clear Cache
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
          <button
            v-if="autoIndex == -1"
            style="margin: 5px; padding: 10px"
            @click="autoProcess"
          >
            Auto Process Files
          </button>
          <button
            v-else
            style="margin: 5px; padding: 10px; background: green; color: white"
            @click="autoProcess"
          >
            Auto Process Files
          </button>
        </center>
      </div>

      <div style="background: #002; padding: 10px">
        <div>FILES: ({{ this.countProcessed }} / {{ this.files.length }})</div>

        <div style="max-height: 600px; overflow: scroll">
          <div v-for="(file, index) in displayFiles" :key="index">
            <div style="cursor: pointer; padding: 4px" @click="process(file)">
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
        <div style="display: flex; flex-direction: column; height: 100%; padding: 10px">
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

process.on("uncaughtException", (err) => {
  if (!err) {
    console.error("process uncaughtException");
  } else {
    console.error("process uncaughtException stack", err.stack);
  }
});

export default {
  name: "app",
  computed: {
    displayFiles() {
      if (this.refresh) {
        this.refresh = false;
      }
      let search = this.search;
      if (search) {
        let results = [];
        search = search.toLowerCase();
        for (var i = 0; i < this.files.length; ++i) {
          let file = this.files[i];
          let key = this.ocrPath + "\\" + file;
          let text = this.getItem(key);
          if (text) {
            if (text.toLowerCase().includes(search.toLowerCase())) {
              results.push(file);
            }
          }
        }
        return results;
      } else {
        let results = [];
        for (var i = 0; i < this.files.length; ++i) {
          let file = this.files[i];
          results.push(file);
        }
        return results;
      }
    },
    countProcessed() {
      if (this.refresh) {
        this.refresh = false;
      }
      let count = 0;
      let localStorage = window.localStorage;
      if (localStorage) {
        for (let i = 0; i < this.files.length; ++i) {
          let file = this.files[i];
          let key = this.ocrPath + "\\" + file;
          if (this.getItem(key)) {
            ++count;
          }
        }
      }
      return count;
    },
  },
  methods: {
    clearCache: function () {
      let localStorage = window.localStorage;
      if (localStorage) {
        localStorage.clear();
      }
    },

    getItem: function (key) {
      return this.textStorage[key];
    },

    setItem: function (key, val) {
      this.textStorage[key] = val;
    },

    changeHandler: function (evt) {
      //console.log("path:", evt.target.value);
      this.ocrPath = evt.target.value;
      let localStorage = window.localStorage;
      if (localStorage) {
        try {
          localStorage.setItem("KEY_OCR_PATH", this.ocrPath);
        } catch {}
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
                    if (json.src.endsWith("\\_ocr.json")) {
                      //console.log("textOcrInput", json.data);
                      refThis.textOcrInput(json.data);
                      return;
                    }
                    const img = document.getElementById("txtImg");
                    console.log("Loading src", json.src, json.data.length);
                    //console.log("data", json.data);
                    img.src = "data:image/png;base64," + json.data;
                    img.style.display = "";
                    var recognize = async function () {
                      //console.log('start recognize');
                      const img = document.getElementById("txtImg");
                      //console.log(img);
                      await refThis.worker.load();
                      await refThis.worker.loadLanguage("eng");
                      await refThis.worker.initialize("eng", OEM.LSTM_ONLY);
                      await refThis.worker.setParameters({
                        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
                      });
                      //console.log('worker.recognize');
                      let {
                        data: { text },
                      } = await refThis.worker.recognize(img);
                      if (!text || text.trim().length == 0) {
                        console.log("no text detected");
                        text = "(none)";
                      }

                      let txtResult = document.getElementById("txtResult");
                      txtResult.value = text;

                      let key = json.src;
                      refThis.setItem(key, text);
                      refThis.refresh = true; //refresh UI
                      if (refThis.autoIndex != -1) {
                        refThis.autoProcess();
                      }
                    };
                    if (refThis.processedKey(json.src)) {
                      refThis.progress = 100;
                    } else {
                      refThis.progress = 0;
                      try {
                        recognize();
                      } catch (e) {
                        console.error("Exception processing file", json.src, e);
                        if (refThis.autoIndex != -1) {
                          refThis.autoProcess();
                        }
                      }
                    }
                    break;
                  case "readdir":
                    //console.log("json", JSON.stringify(json, null, 2));
                    refThis.files = json.files;
                    refThis.refresh = true; //refresh UI
                    let localStorage = window.localStorage;
                    if (localStorage) {
                      try {
                        localStorage.setItem(
                          "KEY_OCR_FILES",
                          JSON.stringify(refThis.files)
                        );
                      } catch {}
                    }

                    // import text if available
                    let key = refThis.ocrPath + "\\_ocr.json";
                    let sendJson = {
                      method: "readfile",
                      src: key,
                    };
                    console.log("send", JSON.stringify(sendJson));
                    refThis.streamSocket.send(JSON.stringify(sendJson));

                    break;
                }
              }
            }
          };

          // import text if available
          let key = refThis.ocrPath + "\\_ocr.json";
          let sendJson = {
            method: "readfile",
            src: key,
          };
          console.log("send", JSON.stringify(sendJson));
          streamSocket.send(JSON.stringify(sendJson));
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
        console.log("Processing", file);
        this.process(file);
        break;
      }
    },
    processedKey: function (key) {
      if (this.getItem(key)) {
        return true;
      }
      return false;
    },
    processed: function (file) {
      let key = this.ocrPath + "\\" + file;
      return this.processedKey(key);
    },
    textOcrInput: function (content) {
      //console.log(content);
      let json = JSON.parse(content);
      if (json) {
        let keys = Object.keys(json);
        for (let i = 0; i < keys.length; ++i) {
          let key = keys[i];
          //console.log("key", key);
          this.setItem(key, json[key]);
        }
        this.refresh = true; //refresh UI
      }
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
                if (readerEvent && readerEvent.target && readerEvent.target.result) {
                  let content = readerEvent.target.result;
                  refThis.textOcrInput(content);
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
          let text = this.getItem(key);
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
          anchorDownload.setAttribute("download", "_ocr.json");

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
    filterHandler: function (evt) {
      this.search = evt.target.value;
      //console.log(this.search);
    },
    showText: function (file) {
      let key = this.ocrPath + "\\" + file;
      if (this.getItem(key)) {
        let txtResult = document.getElementById("txtResult");
        txtResult.value = this.getItem(key);
      }
    },
    process: function (file) {
      console.log("process", file);
      this.progress = 0;

      let txtResult = document.getElementById("txtResult");

      let key = this.ocrPath + "\\" + file;
      let text = this.getItem(key);
      if (text) {
        txtResult.value = text;
      } else {
        txtResult.value = "Processing... " + key;
      }

      let sendJson = {
        method: "readfile",
        src: key,
      };
      //console.log("send", JSON.stringify(sendJson));
      this.streamSocket.send(JSON.stringify(sendJson));
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
      try {
        ocrPath = localStorage.getItem("KEY_OCR_PATH");
      } catch {}
      let strFiles = undefined;
      try {
        strFiles = localStorage.getItem("KEY_OCR_FILES");
      } catch {}
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
        //console.log(m);
        if (m.status == "recognizing text" && m.progress) {
          refThis.progress = Math.round(m.progress * 100);
        }
      },
    });
    return {
      SOCKET_OPEN: 1,
      streamSocket: undefined,
      ocrPath: ocrPath,
      files: files,
      textStorage: {},
      autoIndex: -1,
      search: undefined,
      progress: 0,
      worker: worker,
      refresh: false,
    };
  },
};
</script>

<style></style>
