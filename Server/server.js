import { readFile } from "node:fs/promises";
import { createServer } from "node:https";
import { Http3Server } from "@fails-components/webtransport";
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const key = await readFile("./key.pem");
const cert = await readFile("./cert.pem");

const httpsServer = createServer({
  key,
  cert
}, async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    const html = await readFile("../Client/index.html", "utf8");
    const modifiedHtml = html.replace( // add variable not retrievable by the client
        "</head>",
        `<script>const SERVER_IP = "${url}";</script></head>`
    );
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(modifiedHtml);
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
const url = process.env.LOCAL_IP;
httpsServer.listen(port, () => {
  console.log(`server listening at https://${url}:${port}`);
});

const h3Server = new Http3Server({
  port,
  host: process.env.LOCAL_IP,
  secret: 'mysecret',
  cert,
  privKey: key,
});

h3Server.startServer();

const activeSessions = new Map(); // for all active sessions: session -> writer

(async () => {
  const sessionStream = await h3Server.sessionStream("/transport"); 
  const sessionReader = sessionStream.getReader(); //read sessions
  sessionReader.closed.catch((e) => console.log("sessionReader closed with error!", e));

  let sessionCounter = 0;

  //wait for session
  while (true) {
    const { done, value } = await sessionReader.read();

    if (done) {
      console.log("done! session");
      break;
    }
    
    const sessionId = `client-${++sessionCounter}`;

    console.log(`New WebTransport session with ID: ${sessionId}.`);

    activeSessions.set(value, null); // session initialyze

    //handleBidirectionalStream(value);
    value.ready.then(async () => {
      console.log("session ready!");
      handleBidirectionalStream(value, sessionId);
    }).catch((e) => {
      console.log("session failed to be ready!", e);
    });

    value.closed
      .then(() => {
        activeSessions.delete(value); 
        const timestamp = new Date().toLocaleTimeString(); 
        console.log(`[${timestamp}] Session closed gracefully.`);
      })
      .catch((error) => {
        activeSessions.delete(session);
        console.error(`Session closed with error: ${error}`);
      });
  }
})();


async function handleBidirectionalStream(session, sessionId) {
  const bdStream = session.incomingBidirectionalStreams;
  const reader = bdStream.getReader();
  let buffer = "";

  // Wait for bidirectional streams
  while (true) {
    try {
      const { done, value } = await reader.read();
      if (done) break;

      const bidiStream = value;

      const writer = bidiStream.writable.getWriter();
      activeSessions.set(session, writer); // Update map with session -> writer

      const streamReader = bidiStream.readable.getReader();

      try {
        // Wait for messages
        while (true) {
          const { done, value } = await streamReader.read();
          if (done) break;

          //console.log(`${getFormattedTimestamp()} Message read from client with ID ${sessionId}`);
          const decodedMessage = new TextDecoder().decode(value);
          buffer += decodedMessage;

          try {
            // Skip JSON.parse here
            if (buffer.includes('"type":"ping"')) { 
              console.log(`it was a ping`);
              buffer = "";
              continue;
            }
            
            //console.log(`${getFormattedTimestamp()} Message decoded from client ${sessionId}: `, message); 
            await broadcastMessageToAllClients(buffer, session, sessionId); 
            buffer = ""; 
          } catch (error) {
            // JSON is incomplete, keep buffering
            console.log('Incomplete message, buffering...'); //problem!
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

async function broadcastMessageToAllClients(message, senderSession, id) {
  //console.log(`${getFormattedTimestamp()}  Active Sessions Map:`, activeSessions.size); // number of active clients

  for (const [clientSession, writer] of activeSessions) {
    // not send back to sender
    if (clientSession !== senderSession) {
      try {
        if (writer) {
          //console.log(`${getFormattedTimestamp()}  Server writing to sessionId ${id}`); 
          await writer.write(new TextEncoder().encode(message));
          const t1 = performance.now(); 
          //console.log(`${getFormattedTimestamp()}  Server wrote from sessionId ${id}`); 

        } else {
          console.log('Writer is invalid or not available for session: ', clientSession);
        }
      } catch (err) {
        console.error('Error sending message to client: ', err);
      }
    }
  }
}

function getFormattedTimestamp() {
  const now = new Date();
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `[sek:${seconds}, millisek:${milliseconds}]`;
}