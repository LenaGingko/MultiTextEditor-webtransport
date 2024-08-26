var toolbarOptions = [
  ['bold', 'italic'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['clean']                    // Remove formatting button
];
async function connectToServer() {
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
  // stream is a WebTransportBidirectionalStream
  // stream.readable is a ReadableStream
  // stream.writable is a WritableStream
  
  console.log('Created bidirectional stream.');
  const writer = stream.writable.getWriter();

  return writer; // Return the writer so it can be used to send data on text-change
}

document.addEventListener('DOMContentLoaded', async function() {
  var quill = new Quill('#editor-container', {
      modules: {
          toolbar: toolbarOptions
      },
      theme: 'snow'
  });

  let writer;

  try {
    writer = await connectToServer(); // Initialize the WebTransport connection and get the writer
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
          console.log('Delta sent:', delta);//works every time
        })
        .catch((error) => {
          console.error('Failed to send delta:', error);
        });
    }
  });
});