import { readFile } from "node:fs/promises";
import { createServer } from "node:https";
import { Http3Server } from "@fails-components/webtransport";

const key = await readFile("./key.pem");
const cert = await readFile("./cert.pem");

const httpsServer = createServer({
  key,
  cert
}, async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const content = await readFile("../Client/index.html");
    res.writeHead(200, {
      "content-type": "text/html"
    });
    res.write(content);
    res.end();
  } else if (req.method === "GET" && req.url === "/client.js") {
    const content = await readFile("../Client/client.js");
    res.writeHead(200, {
      "content-type": "application/javascript"
    });
    res.write(content);
    res.end();
  } else if (req.method === "GET" && req.url === "/favicon.ico") {
    const favicon = await readFile("./assets/favicon.ico");
    res.writeHead(200, {
      "content-type": "image/x-icon"
    });
    res.end(favicon);
  } else {
    console.log(`server sends 404 error for ${req.url}`);
    res.writeHead(404).end();
  }
});

const port = process.env.PORT || 3000;

httpsServer.listen(port, () => {
  console.log(`server listening at https://localhost:${port}`);
});

const h3Server = new Http3Server({
  port,
  host: '127.0.0.1',
  secret: 'mysecret',
  cert,
  privKey: key,
});

h3Server.startServer();
console.log("h3Server.address: ", h3Server.address());

(async () => {
  const stream = await h3Server.sessionStream("/transport"); // Listen for WebTransport sessions
  const sessionReader = stream.getReader(); // Reads incoming WebTransport sessions

  while (true) {
    const { done, value } = await sessionReader.read();
    if (done) break;

    const session = value;
    console.log('New WebTransport session');

    // Handling incoming bidirectional streams
    const bds = session.incomingBidirectionalStreams;
    const reader = bds.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const bidiStream = value;
      console.log('Received bidirectional stream.');

      // Read the message sent by the client
      const { value: message } = await bidiStream.readable.getReader().read();
      console.log('Received message from client:', new TextDecoder().decode(message));

      // Respond back to the client
      const writer = bidiStream.writable.getWriter();
      const responseMessage = 'Message from Server!';
      await writer.write(new TextEncoder().encode(responseMessage));
      await writer.close();
      console.log('Sent response to client.');
    }
  }
})();

async function readData(readable) {
  const reader = readable.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    
    console.log('Received data:', new TextDecoder().decode(value));
  }
}

