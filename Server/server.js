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
const url = '141.57.68.161' ; //local id htwk vpn //141.57.68.161 vorher .184
//Verbindungsspezifisches DNS-Suffix: htwk-leipzig.de
httpsServer.listen(port, () => {
  console.log(`server listening at https://${url}:${port}`);
});

const h3Server = new Http3Server({
  port,
  host: '141.57.68.161',
  secret: 'mysecret',
  cert,
  privKey: key,
});

h3Server.startServer();


const activeSessions = new Map(); // for all active sessions: session -> writer

(async () => {
  const stream = await h3Server.sessionStream("/transport"); //client 'https://127.0.0.1:3000/transport'
  const sessionReader = stream.getReader(); // Reads incoming WebTransport sessions

  //wait for session
  while (true) {
    const { done, value } = await sessionReader.read();
    if (done) {
      
      break;
    }
    const session = value;
    console.log('New WebTransport session.');

    activeSessions.set(session, null); // session initialyze

    handleBidirectionalStream(session);
  }
  console.log('Session closed.');//added this so 1 error
  activeSessions.delete(session);
})();


async function handleBidirectionalStream(session) {
  const bds = session.incomingBidirectionalStreams;
  const reader = bds.getReader();

  // Wait for bidirectional streams
  while (true) {
    try {
      const { done, value } = await reader.read();
      if (done) break;

      const bidiStream = value;
      console.log('Bidirectional stream.');

      const writer = bidiStream.writable.getWriter();
      activeSessions.set(session, writer); // Update map with session -> writer

      // read messages from the bidiStream
      const streamReader = bidiStream.readable.getReader();

      try {
        // Wait for messages
        while (true) {
          const { done, value } = await streamReader.read();
          if (done) break;

          const decodedMessage = new TextDecoder().decode(value);
          
          console.log('Message: ', decodedMessage);

          await broadcastMessageToAllClients(decodedMessage, session);
        }
      } catch (error) {
        console.error('Error handling stream: ', error);
      } finally {
        streamReader.releaseLock();
      }
    } catch (error) {
      if (error.name === 'WebTransportError') {
        console.log('Session closed:', error);
        // Remove the session from activeSessions when it closes
        activeSessions.delete(session);
        break;
      } else {
        console.error('Unexpected error:', error);
      }
    }
  }
}

async function broadcastMessageToAllClients(message, senderSession) {
  console.log('Active Sessions Map:', activeSessions.size); // number of active clients

  for (const [clientSession, writer] of activeSessions) {
    // not send back to sender
    if (clientSession !== senderSession) {
      try {
        if (writer) { // Check if writer is valid
          await writer.write(new TextEncoder().encode(message));
        } else {
          console.log('Writer is invalid or not available for session: ', clientSession);
        }
      } catch (err) {
        console.error('Error sending message to client: ', err);
      }
    }
  }
}