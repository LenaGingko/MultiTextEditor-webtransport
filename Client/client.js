var toolbarOptions = [
  ['bold', 'italic'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['clean']  
];

const url = '192.168.0.104'; //public id global am besten

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

  // Notify the server of disconnection
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

      const decodedMessage = new TextDecoder().decode(value);
      buffer += decodedMessage;

      // Check if buffer contains a complete JSON object
      try {
        const parsedMessage = JSON.parse(buffer);
        
        // If parsing succeeds, reset the buffer and process the message
        buffer = ""; // Clear buffer after successful parsing

        console.log('Received complete message:', parsedMessage);

        // Process the parsed delta
        quill.updateContents(parsedMessage, 'remote');
      } catch (e) {
        // Catch the JSON parse error; message might be incomplete
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
    writer = await connectToServer(quill); // Pass quill when connecting to the server
  } catch (error) {
    console.error("Failed to connect to the server:", error);
    return;
  }

  quill.on('text-change', function(delta, oldDelta, source) {
    if (source === 'user') {
      console.log("Text change detected!");

      const deltaString = JSON.stringify(delta); // Serialize the delta object
      const encodedDelta = new TextEncoder().encode(deltaString); // Encode as Uint8Array

      writer.write(encodedDelta)
        .then(() => {
          console.log('Delta sent:', delta); // Works every time
        })
        .catch((error) => {
          console.error('Failed to send delta:', error);
        });
    }
  });
});
