#!/bin/bash

# Generate the certificate and key
openssl req -new -x509 -nodes -verbose \
-out cert.pem \
-keyout key.pem \
-newkey ec \
-pkeyopt ec_paramgen_curve:prime256v1 \
-subj "//CN=ip-adress" \
-days 14
