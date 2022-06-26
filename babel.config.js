module.exports = {
  presets: [
    '@vue/app'
  ],
}

var ws = require('ws');
const wss = new ws.WebSocketServer({ port: 8081 });

wss.on('connection', function connection(ws) {
  ws.on('message', async function message(data, isBinary) {
    if (!isBinary) {
      var json = JSON.parse(data);
      console.log('websocket onmessage:', JSON.stringify(json, null, 2));
      switch (json.method) {
        case 'readfile':
          if (json.src) {
            const fse = require("fs-extra");
            fse.readFile(json.src, function (err, data) {
              if (!err) {
                let result = {
                  "method": json.method,
                  "src": json.src,
                  "data": data.toString('base64')
                };

                //console.log('send', JSON.stringify(result, null, 2));
                ws.send(JSON.stringify(result));
              }
            });
          }
          break;
        case 'readdir':
          if (json.path) {
            var results = {
              "method": json.method,
              "path": json.path,
              "files": []
            };
            const fse = require("fs-extra");
            fse.readdir(json.path, (err, dir) => {
              console.log('readdir dir', dir);
              for (let filename of dir) {
                console.log('readdir filename', filename);
                results.files.push(filename);
              }
              //console.log('send', JSON.stringify(results, null, 2));
              ws.send(JSON.stringify(results));
            });
          }
          break;
      }
    }
  });
});
