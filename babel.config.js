module.exports = {
  presets: [
    '@vue/app'
  ],
}

var ws = require('ws');
const wss = new ws.WebSocketServer({ port: 8081 });

wss.on('connection', function connection(ws) {
  ws.on('message', function message(data, isBinary) {
    if (!isBinary) {
      let json = JSON.parse(data);
      console.log('websocket onmessage:', JSON.stringify(json, null, 2));
      switch (json.method) {
        case 'readdir':
          const fse = require("fs-extra");
          console.log('The fs-extra module is accessible from a websocket hosted in babel.config.js');
          fse.readdir('.', (err, dir) => {
            console.log('readdir dir', dir);
            for (let filePath of dir) {
              console.log('readdir filePath', filePath);
            }
          });
          break;
      }
    }
  });
});
