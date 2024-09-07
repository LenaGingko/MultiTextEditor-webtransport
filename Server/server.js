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
const url = '192.168.0.104' ; //local id htwk vpn //141.57.68.161 vorher 
//Verbindungsspezifisches DNS-Suffix: htwk-leipzig.de
httpsServer.listen(port, () => {
  console.log(`server listening at https://${url}:${port}`);
});

const h3Server = new Http3Server({
  port,
  host: '192.168.0.104',
  secret: 'mysecret',
  cert,
  privKey: key,
});

h3Server.startServer();


const activeSessions = new Map(); // for all active sessions: session -> writer

(async () => {
  const sessionStream = await h3Server.sessionStream("/transport"); //client 'https://127.0.0.1:3000/transport'
  const sessionReader = sessionStream.getReader(); // Reads incoming WebTransport sessions
  sessionReader.closed.catch((e) => console.log("sessionReader closed with error!", e));

  //wait for session
  while (true) {
    console.log("sessionReader.read() - waiting for session...");
    const { done, value } = await sessionReader.read();
    if (done) {
      console.log("done! session");
      break;
    }
    //const session = value;
    console.log('New WebTransport session.');

    activeSessions.set(value, null); // session initialyze

    //handleBidirectionalStream(value);
    value.ready.then(async () => {
      console.log("session ready!");
      handleBidirectionalStream(value);
    }).catch((e) => {
      console.log("session failed to be ready!", e);
    });

    value.closed
      .then(() => {
        activeSessions.delete(value); // Remove session from activeSessions
        console.log("Session closed gracefully.");
      })
      .catch((error) => {
        activeSessions.delete(session); // Cleanup even on error
        console.error(`Session closed with error: ${error}`);
      });
  }
  console.log('Session closed..................while loop over'); //added this to avoid 1 error
})();


async function handleBidirectionalStream(session) {
  const bdStream = session.incomingBidirectionalStreams;
  const reader = bdStream.getReader();
  let buffer = ""; // Buffer to accumulate incomplete messages

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
          buffer += decodedMessage;

          try {
            const message = JSON.parse(buffer);

            // Clear the buffer after successful parsing
            buffer = "";

            console.log('Message: ', message);
            await broadcastMessageToAllClients(JSON.stringify(message), session);

          } catch (error) {
            // JSON is incomplete, keep buffering
            console.log('Incomplete message, buffering...');
          }
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
        if (activeSessions.has(session)) {
          activeSessions.delete(session);
        }
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