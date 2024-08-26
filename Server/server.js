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
/////////////////////////////////////////////////////////////////////

// Keep track of all active WebTransport sessions
const activeSessions = new Map();

(async () => {
  const stream = await h3Server.sessionStream("/transport"); // Listen for WebTransport sessions
  const sessionReader = stream.getReader(); // Reads incoming WebTransport sessions

  while (true) {
    const { done, value } = await sessionReader.read();
    if (done) break;

    const session = value;
    console.log('New WebTransport session');
    activeSessions.set(session, new Map());

    // Handling incoming bidirectional streams
    handleBidirectionalStream(session);
  }
})();

async function handleBidirectionalStream(session) {
  const bds = session.incomingBidirectionalStreams;
  const reader = bds.getReader();

  while (true) {
    const { done, value } = await reader.read(); // value is an instance of WebTransportReceiveStream
    if (done) break;

    const bidiStream = value;
    console.log('Received bidirectional stream.');

    // Continuously read messages from the bidiStream
    const streamReader = bidiStream.readable.getReader();
    const writer = bidiStream.writable.getWriter();

    try {
      while (true) {
        const { done, value } = await streamReader.read(); // Read continuously
        if (done) break;

        const decodedMessage = new TextDecoder().decode(value);
        console.log('Received message from client:', decodedMessage);

        // Echo the message back to the client
        await writer.write(new TextEncoder().encode(decodedMessage));
        console.log('Sent response to client.');
      }
    } catch (error) {
      console.error('Error handling stream:', error);
    } finally {
      streamReader.releaseLock(); // Release the reader lock after we're done
      writer.releaseLock(); // Release the writer lock after we're done
    }
  }
}

async function broadcastMessageToAllClients(message, senderSession) {
  console.log('broadcastMessageToAllClients');

  for (const [clientSession, streams] of activeSessions) {
    if (clientSession !== senderSession) {
      console.log('Broadcasting to session:', clientSession);

      for (const writer of streams.values()) { // Iterate through all stored writers
        try {
          await writer.write(new TextEncoder().encode(message));
          console.log('Message sent to client.');
        } catch (err) {
          console.error('Error sending message to client:', err);
        }
      }
    }
  }
}
///////////////////////////////////////////////////////////////////////////7
/*(async () => {
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

async function readData(readable) {//from docs
  const reader = readable.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    
    console.log('Received data:', new TextDecoder().decode(value));
  }
}*/

