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
  } else {
    console.log(`server sends 404 error`);
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

console.log("h3Server.address: ", h3Server.address()); //address() gives information about the current server address.

(async () => {
  const stream = await h3Server.sessionStream("/transport"); // Updated path
  const sessionReader = stream.getReader(); //reads stream hello world from client

  while (true) {
    const { done, value } = await sessionReader.read();
    if (done) {
      break;
    }

    const session = value;
    console.log('New WebTransport session:', session);

    // Reading from a bidirectional stream
    const bidiStream = await session.createBidirectionalStream();
    const reader = bidiStream.readable.getReader();
    const writer = bidiStream.writable.getWriter();

    // Read the message sent by the client
    const { value: message } = await reader.read();
    console.log('Received message from client:', new TextDecoder().decode(message));

    // Respond back to the client
    const responseMessage = 'Message received!';
    await writer.write(new TextEncoder().encode(responseMessage));
    writer.close();

    session.closed.catch((err) => {
      console.error('Session closed with error:', err);
    });

    // Start receiving bidirectional streams
    await receiveBidirectional(session);
  }
})();

async function receiveBidirectional(session) {
  const bds = session.incomingBidirectionalStreams;
  const reader = bds.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    // value is an instance of WebTransportBidirectionalStream
    await readData(value.readable);
    //await writeData(value.writable);
  }
}

async function readData(readable) {
  const reader = readable.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    // value is a Uint8Array.
    console.log('Received data:', new TextDecoder().decode(value));
  }
}

async function writeData(writable) {
  const writer = writable.getWriter();
  const data1 = new Uint8Array([65, 66, 67]); // ABC
  const data2 = new Uint8Array([68, 69, 70]); // DEF
  await writer.write(data1);
  await writer.write(data2);
  writer.close();
}