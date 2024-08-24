var toolbarOptions = [
  ['bold', 'italic'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['clean']                    // Remove formatting button
];

async function connectToServer() {
  const url = 'https://localhost:3000/transport';
  const transport = new WebTransport(url);

  const $status = document.getElementById("status");
  const $transport = document.getElementById("transport");

  // Optionally, set up functions to respond to the connection closing:
  transport.closed.then(() => {
      console.log(`The HTTP/3 connection to ${url} closed gracefully.`);
  }).catch((error) => {
      console.error(`The HTTP/3 connection to ${url} closed due to ${error}.`);
  });

  // Wait for the transport to be ready before using it
  await transport.ready;
  console.log('The WebTransport connection is now ready.');
  $status.innerText = "Connected";
  $transport.innerText = transport.ready;

  // You can now use the transport object to create streams, etc.
  // For example, creating a bidirectional stream:
  const stream = await transport.createBidirectionalStream();
  const writer = stream.writable.getWriter();
  await writer.write(new TextEncoder().encode('Hello, world!'));
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
  /*const $status = document.getElementById("status");
  const $transport = document.getElementById("transport");
  
  const socket = io({
    transportOptions: {
      webtransport: {
        hostname: "127.0.0.1"
      }
    }
  });
  
  socket.on("connect", () => {
    console.log(`connected with transport ${socket.io.engine.transport.name}`);
  
    $status.innerText = "Connected";
    $transport.innerText = socket.io.engine.transport.name;
  
    socket.io.engine.on("upgrade", (transport) => {
      console.log(`transport upgraded to ${transport.name}`);
  
      $transport.innerText = transport.name;
    });
  });

  socket.on('message', function(data) {
    try {
        var delta = JSON.parse(data);
        quill.updateContents(delta);
    } catch (e) {
        console.error('Error parsing message', e);
    }
  });
  
  socket.on("connect_error", (err) => {
    console.log(err.message, err.description, err.context);
  });
  
  socket.on("disconnect", (reason) => {
    console.log(`disconnect due to ${reason}`);
  
    $status.innerText = "Disconnected";
    $transport.innerText = "N/A";
  });*/

  quill.on('text-change', function(delta, oldDelta, source) {
      /*if (source === 'user' && socket.connected) {
          socket.send(JSON.stringify(delta));
      }*/
  });
});