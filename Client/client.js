var toolbarOptions = [
  ['bold', 'italic'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['clean']                    // Remove formatting button
];

async function connectToServer(quill) { // Pass quill as a parameter
  const url = 'https://127.0.0.1:3000/transport';
  const transport = new WebTransport(url);

  const $status = document.getElementById("status");

  transport.closed.then(() => {
    console.log(`The HTTP/3 connection to ${url} closed gracefully.`);
    $status.innerText = "Disconnected";
  }).catch((error) => {
    console.error(`The HTTP/3 connection to ${url} closed due to ${error}.`);
    $status.innerText = "Disconnected";
  });

  await transport.ready;
  console.log('The WebTransport connection is now ready.');
  $status.innerText = "Connected";

  const stream = await transport.createBidirectionalStream();
  console.log('Created bidirectional stream.');

  // Start reading from the server
  readFromServer(stream.readable, quill); // Pass quill to readFromServer

  const writer = stream.writable.getWriter();
  return writer; // Return the writer so it can be used to send data on text-change
}

async function readFromServer(readable, quill) { // Accept quill as a parameter
  const reader = readable.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Stream has been closed by the server.');
        break;
      }

      const decodedMessage = new TextDecoder().decode(value);
      console.log('Received message from server:', decodedMessage);

      try {
        const delta = JSON.parse(decodedMessage);
        quill.updateContents(delta); // Update the Quill editor with the delta
      } catch (e) {
        console.error('Error parsing message', e);
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
