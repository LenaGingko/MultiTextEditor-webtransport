I just test implemented webtransport with https://github.com/fails-components/webtransport.
Webtransport: https://developer.chrome.com/docs/capabilities/web-apis/webtransport

You need to use the chrome browser.

How to start: run in server directory: node server.js

create cert.pem and key.pem in the server directory

example: openssl req -new -x509 -nodes \
    -out cert.pem \
    -keyout key.pem \
    -newkey ec \
    -pkeyopt ec_paramgen_curve:prime256v1 \
    -subj '/CN=127.0.0.1' \
    -days 14
    
open the chrome browser by running open_browser.sh so all flags are activated (chrome should be in the PATH variables)

(Tip: You can open .sh script for example in GIT_BASH: documents/webtransport-1/server (main) $ ./open_browser.sh)
