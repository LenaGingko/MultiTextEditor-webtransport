var toolbarOptions = [
  ['bold', 'italic'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['clean']  
];

const url = SERVER_IP;

async function connectToServer(quill) {
  const adress = 'https://' + url + ':3000/transport';
  const transport = new WebTransport(adress);

  const $status = document.getElementById("status");

  await transport.ready;
  console.log('The WebTransport connection is now ready.');
  $status.innerText = "Connected";

  const stream = await transport.createBidirectionalStream();
  console.log('Created bidirectional stream.');

  // Start reading from the server
  readFromServer(stream.readable, quill);

  const writer = stream.writable.getWriter();

  /**ping */
  setInterval(() => {
    writer.write(new TextEncoder().encode(JSON.stringify({ type: 'ping' })));
    //console.log('Ping sent to keep the connection alive');
  }, 25000); 
  

  transport.closed.then(async () => {
    console.log(`The HTTP/3 connection to ${url} closed gracefully.`);
    $status.innerText = "Disconnected";
  }).catch((error) => {
    console.error(`The HTTP/3 connection to ${url} closed due to ${error}.`);
    $status.innerText = "Disconnected";
  });

  return writer;
}

async function readFromServer(readable, quill) {
  const reader = readable.getReader();
  let buffer = ""; // Buffer to accumulate incomplete messages

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Stream has been closed by the server.');
        break;
      }
      console.log(`${getFormattedTimestamp()} Data read from stream.`);
      
      const decodedMessage = new TextDecoder().decode(value);
      buffer += decodedMessage;

      try {
        const parsedMessage = JSON.parse(buffer);
        
        //reset the buffer
        buffer = "";

        console.log(`${getFormattedTimestamp()} Data decoded from stream: `, parsedMessage);

        quill.updateContents(parsedMessage, 'remote');
      } catch (e) {
        console.log('Incomplete message, waiting for more chunks...');
      }
    }
  } catch (error) {
    console.error('Error reading from stream:', error);
  } finally {
    reader.releaseLock();
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const quill = new Quill('#editor-container', {
    modules: {
      toolbar: toolbarOptions
    },
    theme: 'snow'
  });

  let writer;

  try {
    writer = await connectToServer(quill); 
  } catch (error) {
    console.error("Failed to connect to the server:", error);
    return;
  }

  quill.on('text-change', function(delta, oldDelta, source) {
    if (source === 'user') {
      const deltaString = JSON.stringify(delta);
      const encodedDelta = new TextEncoder().encode(deltaString); //encode as Uint8Array

      console.log(`${getFormattedTimestamp()} writing...`);
      writer.write(encodedDelta)
        .then(() => {
          console.log(`${getFormattedTimestamp()} Delta sent:`, delta); //check time after writinh sending
        })
        .catch((error) => {
          console.error('Failed to send delta:', error);
        });
    }
  });
});

function getFormattedTimestamp() {
  const now = new Date();
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `[sek:${seconds}, millisek:${milliseconds}]`;
}