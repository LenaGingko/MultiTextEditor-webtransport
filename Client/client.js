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
  }).catch((error) => {
      console.error(`The HTTP/3 connection to ${url} closed due to ${error}.`);
  });

  await transport.ready;
  console.log('The WebTransport connection is now ready.');
  $status.innerText = "Connected";

  const stream = await transport.createBidirectionalStream();
  console.log('created bidirectional stream.');
  const writer = stream.writable.getWriter();
  await writer.write(new TextEncoder().encode('Hello, world!'));
  console.log('wrote hello world.');
  writer.close();
  console.log('Data sent and stream closed.');

  // Reading response from the stream:
  const reader = stream.readable.getReader();
  const response = await reader.read();
  console.log(`Received response: ${new TextDecoder().decode(response.value)}`);
}

document.addEventListener('DOMContentLoaded', function() {
  var quill = new Quill('#editor-container', {
      modules: {
          toolbar: toolbarOptions
      },
      theme: 'snow'
  });

  // Call the async function
  connectToServer().catch(console.error);

////////////////////////////////////////////////////////////////////////////////////////////////////////////

  quill.on('text-change', function(delta, oldDelta, source) {
    console.log("text change!!!");
      /*if (source === 'user' && socket.connected) { //from socket.io implementation
          socket.send(JSON.stringify(delta));
      }*/
  });
});